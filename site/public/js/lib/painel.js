// IAês · o painel da palavra (cmp-painel, e-painel, e-painel-celular; spec 4.10).
// Gaveta de 440 px à direita no desktop e no tablet; folha que sobe de baixo no celular. Cobre o
// cabeçalho e escurece a página. role="dialog" com aria-modal, foco preso dentro (o resto da
// página fica inert), Esc fecha, o foco volta para quem abriu.
//
//   abrirPainel(chave, origem)  chave 'crucial.pt'; origem: o elemento que abriu (recebe o foco de
//                               volta). Acrescenta #palavra=crucial.pt ao endereço com pushState,
//                               então o Voltar do navegador fecha o painel. Com o painel aberto,
//                               troca a palavra sem criar outra entrada no histórico.
//   fecharPainel() → Promise     fecha e tira o #palavra=... do endereço; resolve quando o
//                               endereço já mudou (antes disso, não grave estado na URL).
//   doEndereco()                abre (ou fecha) conforme o #palavra=... do endereço atual. Um
//                               #palavra= fora do formato palavra.pt ou palavra.en sai do endereço
//                               e vira o aviso de link com problema no topo da página.
//
//   fraseContexto(frase, { lingua, nivel, tamanho }) → <figure class="frase">: uma frase de
//                               `contexto` (palavras/<l>/<inicial>.json) com a palavra realçada
//                               (.mk-<nivel>; sem nivel, só negrito), revista, ano e "ver artigo".
//
// cabecalho.js carrega este módulo sob demanda: qualquer clique em [data-palavra] chama
// abrirPainel, e #palavra=... no endereço chama doEndereco.
//
// "Abrir em Palavras no tempo" é um link para /palavras/?p=<chave>. Antes de navegar, o painel
// dispara no document o evento cancelável 'iaes:abrir-em-palavras' (detail: { chave, fechado });
// a tela Palavras no tempo cancela o evento e, quando a promessa `fechado` resolve (painel
// fechado e endereço já sem #palavra), acrescenta a palavra ao gráfico.
import {
  el, icone, t, fmt, lerChave, chave as fazerChave, siglaLingua, ordinal, rota, dados, estadoErro, esqueleto, faixa,
  semMovimento, descreverErro, esperarConexao, avisoLink, escapar,
} from './base.js';
import { ficha, medidas, faixaResumos, MINIMO_RESUMOS } from './palavras.js';
import { linhaTempo } from './grafico.js';

const MODELOS = ['chatgpt', 'gemini', 'claude'];
const TAREFAS = ['polish-pt', 'polish-en', 'translate-pt-en'];

let painel = null;        // { raiz, veu, aside, corpo, titulo }
let origem = null;
let empurrou = false;
let ignorarPop = 0;
let atual = null;
let versao = 0;
let grafico = null;
let inertes = [];

const aberto = () => Boolean(painel);
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');

function chaveDoHash() {
  const m = /^#palavra=(.+)$/.exec(location.hash);
  if (!m) return null;
  let texto = m[1];
  try { texto = decodeURIComponent(texto); } catch { /* fica como veio */ }
  const k = lerChave(texto);
  return k ? fazerChave(k.palavra, k.lingua) : null;
}
const urlCom = (hash) => `${location.pathname}${location.search}${hash}`;
const hashDe = (c) => `#palavra=${encodeURIComponent(c)}`;

// ---------- Abrir e fechar ----------
export function abrirPainel(texto, de) {
  const k = lerChave(texto);
  if (!k) return;
  const c = fazerChave(k.palavra, k.lingua);
  if (!aberto()) {
    origem = de instanceof Element && de !== document.body ? de : document.activeElement;
    if (chaveDoHash() !== c) {
      history.pushState({ ...(history.state || {}), iaesPainel: c }, '', urlCom(hashDe(c)));
      empurrou = true;
    } else {
      empurrou = false;
    }
    montar();
  } else if (chaveDoHash() !== c) {
    history.replaceState(history.state, '', urlCom(hashDe(c)));
  }
  mostrar(k.palavra, k.lingua);
}

export function fecharPainel() {
  if (!aberto()) return Promise.resolve();
  desmontar();
  let pronto = Promise.resolve();
  if (empurrou && history.state?.iaesPainel) {
    // Volta a entrada que o painel criou; a promessa resolve quando o endereço já mudou.
    pronto = new Promise((resolve) => {
      const timer = setTimeout(() => {
        const i = esperas.indexOf(fim);
        if (i >= 0) esperas.splice(i, 1);
        resolve();
      }, 600);
      const fim = () => { clearTimeout(timer); resolve(); };
      esperas.push(fim);
    });
    ignorarPop += 1;
    history.back();
  } else if (/^#palavra=/.test(location.hash)) {
    history.replaceState(history.state, '', urlCom(''));
  }
  empurrou = false;
  return pronto;
}

export function doEndereco() {
  const c = chaveDoHash();
  if (!c) {
    if (/^#palavra=/.test(location.hash)) avisarHashRuim();
    if (aberto()) { empurrou = false; desmontar(); }
    return;
  }
  if (aberto() && atual === c) return;
  if (!aberto()) {
    origem = document.activeElement;
    empurrou = Boolean(history.state?.iaesPainel);
    montar();
  }
  const k = lerChave(c);
  mostrar(k.palavra, k.lingua);
}

// #palavra=crucial.fr, #palavra=xyz...: tira do endereço e avisa no topo da página o que o link
// pedia. #palavra= vazio só sai do endereço.
function avisarHashRuim() {
  let valor = location.hash.slice('#palavra='.length);
  try { valor = decodeURIComponent(valor); } catch { /* fica como veio */ }
  history.replaceState(history.state, '', urlCom(''));
  if (!valor.trim()) return;
  document.querySelector('main')?.prepend(el('div', { class: 'pagina' }, avisoLink(t('aviso_hash_palavra', { valor: escapar(valor) }))));
}

const esperas = [];
window.addEventListener('popstate', () => {
  if (ignorarPop > 0) {
    ignorarPop -= 1;
    esperas.shift()?.();
    return;
  }
  doEndereco();
});

// ---------- Estrutura ----------
function tipo() { return faixa() === 'celular' ? 'folha' : 'gaveta'; }

function aoRedimensionar() {
  if (!painel) return;
  painel.aside.classList.remove('gaveta', 'folha');
  painel.aside.classList.add(tipo());
  ajustarTitulo();
}

// Palavra longa (desinstitucionalização) encolhe até caber numa linha, até 22 px (a mais longa
// dos dados, cholangiopancreatography, cabe assim num celular de 360 px); abaixo disso, quebra com
// hífen onde o navegador souber e, no último caso, em qualquer letra (site.css).
function ajustarTitulo() {
  const titulo = painel?.titulo;
  const palavra = titulo?.querySelector('[lang]');
  if (!palavra) return;
  titulo.style.fontSize = '';
  const caixa = titulo.clientWidth;   // a largura ao lado do botão de fechar (flex:1 em site.css)
  titulo.style.whiteSpace = 'nowrap';
  const natural = palavra.getBoundingClientRect().width;
  titulo.style.whiteSpace = '';
  if (caixa > 0 && natural > caixa) {
    const base = parseFloat(getComputedStyle(titulo).fontSize);
    titulo.style.fontSize = `${Math.max(22, Math.floor((base * (caixa - 2)) / natural))}px`;
  }
}

function montar() {
  const veu = el('div', { class: 'painel-veu', 'aria-hidden': 'true', on: { click: fecharPainel } });
  // tabindex -1: o título recebe o foco quando o conteúdo troca sob ele (a palavra par, o erro).
  const titulo = el('h2', { class: 'w painel-palavra', id: 'painel-titulo', tabindex: '-1' });
  const fechar = el('button', { class: 'btn btn-fantasma btn-icone painel-fechar', type: 'button', 'aria-label': t('painel_fechar'), on: { click: fecharPainel } }, icone('fechar', 'ic'));
  const etqs = el('div', { class: 'painel-etqs' });
  const corpo = el('div', { class: 'painel-corpo' });
  const aside = el('aside', { class: `painel ${tipo()}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'painel-titulo', tabindex: '-1' },
    el('div', { class: 'painel-alca', 'aria-hidden': 'true' }, el('span', { class: 'alca' })),
    el('div', { class: 'painel-cabeca' }, el('div', { class: 'painel-titulo-linha' }, titulo, fechar), etqs),
    corpo);
  const raiz = el('div', { class: 'painel-raiz' }, veu, aside);
  inertes = [...document.body.children].filter((n) => !n.inert && n.tagName !== 'SCRIPT');
  inertes.forEach((n) => { n.inert = true; });
  document.body.append(raiz);
  document.documentElement.classList.add('painel-aberto');
  painel = { raiz, veu, aside, corpo, titulo, etqs, fechar };
  aside.addEventListener('keydown', teclado);
  window.addEventListener('resize', aoRedimensionar);
  if (!semMovimento()) {
    const de = tipo() === 'folha' ? 'translateY(100%)' : 'translateX(100%)';
    aside.animate([{ transform: de }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
    veu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  }
  fechar.focus();
}

function desmontar() {
  if (!painel) return;
  versao += 1;
  grafico?.destruir();
  grafico = null;
  window.removeEventListener('resize', aoRedimensionar);
  painel.raiz.remove();
  inertes.forEach((n) => { n.inert = false; });
  inertes = [];
  document.documentElement.classList.remove('painel-aberto');
  painel = null;
  atual = null;
  const volta = origem;
  origem = null;
  if (volta && volta.isConnected && typeof volta.focus === 'function') volta.focus();
}

function teclado(evento) {
  if (evento.key === 'Escape') {
    evento.stopPropagation();
    fecharPainel();
    return;
  }
  if (evento.key !== 'Tab') return;
  const focaveis = [...painel.aside.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((n) => n.tabIndex >= 0 && (n.offsetParent !== null || n === document.activeElement));
  if (!focaveis.length) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  const noTopo = [primeiro, painel.aside, painel.titulo].includes(document.activeElement);
  if (evento.shiftKey && noTopo) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primeiro.focus();
  }
}

// ---------- Conteúdo ----------
async function mostrar(palavra, l, tentativa = 1) {
  const c = fazerChave(palavra, l);
  atual = c;
  const meu = ++versao;
  grafico?.destruir();
  grafico = null;
  // Só a palavra leva o lang da língua dela; o rótulo para leitor de tela fica na língua da página.
  painel.titulo.replaceChildren(el('span', { class: 'sr', text: t('painel_rotulo') }), el('span', { lang: langDe(l), text: palavra }));
  ajustarTitulo();
  document.fonts?.ready.then(() => { if (meu === versao) ajustarTitulo(); });
  painel.etqs.replaceChildren(el('span', { class: 'etq' }, el('span', { class: `chave chave-${l}` }), `${siglaLingua(l)} · ${t(`painel_lingua_${l}`)}`));
  painel.corpo.replaceChildren(esqueleto(210), esqueleto(44), esqueleto(240));
  painel.aside.scrollTop = 0;
  // O botão que trocou a palavra (a par, "Tentar de novo") sumiu com o corpo: o foco vai ao título.
  if (!painel.aside.contains(document.activeElement)) painel.titulo.focus();
  let f;
  try {
    f = await ficha(palavra, l);
  } catch (erro) {
    if (meu !== versao) return;
    if (erro.status === 'rede' && !navigator.onLine) {
      painel.corpo.replaceChildren(el('div', { class: 'estado-vazio painel-estado' },
        el('p', { class: 'painel-estado-titulo', text: t('offline_titulo') }),
        el('p', { class: 't-p', text: t('painel_offline') })));
      esperarConexao(() => { if (painel && meu === versao) mostrar(palavra, l, tentativa); });
      return;
    }
    painel.corpo.replaceChildren(estadoErro({
      arquivo: erro.arquivo, erro: descreverErro(erro), tentativa,
      titulo: t('painel_erro_titulo'), texto: t('painel_erro_texto'),
      tentar: () => mostrar(palavra, l, tentativa + 1),
    }));
    return;
  }
  if (meu !== versao) return;
  let textos = null;
  if (f.experimento) {
    textos = await dados('inicio.json').then((d) => d.experimento?.textos ?? null, () => null);
    if (meu !== versao) return;
  }
  desenhar(f, textos);
}

function secao(tituloTexto, ...filhos) {
  return el('section', { class: 'painel-secao' }, el('h3', { class: 't-rotulo', text: tituloTexto }), ...filhos);
}

function desenhar(f, textos) {
  const l = f.lingua;
  const partes = [];
  if (f.classe) {
    const nota = { estilo: 'painel_classe_estilo', conteudo: 'painel_classe_conteudo', 'sem-classe': 'painel_classe_sem' }[f.classe];
    if (nota) painel.etqs.append(el('span', { class: 'etq-nota', text: t(nota) }));
  }

  if (f.ausente) {
    partes.push(el('div', { class: 'estado-vazio painel-estado' },
      el('p', { class: 'painel-estado-titulo' }, t('busca_nenhum_antes'), el('span', { class: 'w', lang: langDe(l), text: f.palavra }), t('busca_nenhum_depois')),
      el('p', { class: 't-p', text: t('painel_ausente_texto') })));
    painel.corpo.replaceChildren(...partes);
    return;
  }

  // Linha do tempo pequena, ou o aviso de palavra rara com a contagem por ano.
  if (f.rara) {
    partes.push(el('div', { class: 'estado-vazio painel-estado' },
      el('p', { class: 'painel-estado-titulo' }, el('span', { class: 'w', lang: langDe(l), text: f.palavra }), ' ', t('rara_texto', { minimo: MINIMO_RESUMOS })),
      el('p', { class: 't-p', text: t('painel_rara_texto') }),
      contagem(f)));
  } else {
    const figura = el('figure', { class: 'figura painel-figura' },
      el('div', { class: 'legenda painel-legenda' },
        el('span', { class: 'legenda-item' }, el('span', { class: `chave chave-${l}` }), t('painel_leg_observado')),
        el('span', { class: 'legenda-item' }, el('span', { class: 'am-esp' }), t('painel_leg_esperado')),
        el('span', { class: 'legenda-item' }, el('span', { class: 'am-area' }), t('leg_excesso'))));
    const lugar = el('div', { class: 'painel-grafico' });
    const [menor, maior] = faixaResumos(f);
    figura.append(lugar, el('figcaption', { class: 't-legenda painel-nota' },
      f.poucos && `${t('poucos_resumos', { min: fmt.num(menor), max: fmt.num(maior) })} `,
      t('nota_esperado')));
    partes.push(figura);
    requestAnimationFrame(() => {
      if (!lugar.isConnected) return;
      grafico = linhaTempo(lugar, {
        series: [{ palavra: f.palavra, lingua: l, obs: f.obs, esp: f.esp, n: f.n }],
        altura: 210, compacto: true, anel: 'var(--superficie)', raio: 3.5, rotuloDireto: false,
      });
    });
  }

  // A palavra equivalente na outra língua (teste H3).
  if (f.par) {
    const p = lerChave(f.par);
    if (p) {
      partes.push(el('div', { class: 'painel-par' },
        el('button', { class: 'btn painel-par-botao', type: 'button', on: { click: () => abrirPainel(f.par) } },
          el('span', {}, t('painel_par_antes'), el('span', { class: 'w', lang: langDe(p.lingua), text: p.palavra }), t(`painel_par_depois_${p.lingua}`)),
          icone('seta', 'ic')),
        p.palavra !== f.palavra && el('p', { class: 't-legenda', text: t('painel_par_nota') })));
    }
  }

  if (!f.rara) partes.push(numeros(f));
  if (f.experimento) partes.push(experimento(f, textos));
  partes.push(contexto(f));
  partes.push(botaoAbrir(f));
  painel.corpo.replaceChildren(...partes);
}

function contagem(f) {
  return el('dl', { class: 'painel-contagem' }, f.n.map((n, i) => el('div', {},
    el('dt', { text: String(2015 + i) }), el('dd', { class: 'num', text: n == null ? t('sem_dado') : fmt.num(n) }))));
}

function numeros(f) {
  const m = medidas(f);
  const pct = (v) => (v == null ? t('sem_dado') : fmt.pct(v));
  const linhas = [
    [t('painel_em2122'), pct(m.base)],
    [t('painel_em2025'), pct(m.obs2025)],
    [t('painel_esperado'), pct(m.esp2025)],
    [t('painel_razao'), m.razao == null ? t('sem_dado') : fmt.razao(m.razao)],
    [t('painel_diferenca'), m.dif == null ? t('sem_dado') : fmt.pp(m.dif)],
    [t('painel_posicao', { sigla: siglaLingua(f.lingua) }), f.posicao ? ordinal(f.posicao) : t('painel_fora')],
  ];
  return secao(t('painel_numeros'), el('dl', { class: 'painel-numeros' },
    linhas.map(([rot, val]) => el('div', {}, el('dt', { text: rot }), el('dd', { class: 'dado', text: val })))));
}

function experimento(f, textos) {
  const tarefas = TAREFAS.filter((tarefa) => MODELOS.some((m) => f.experimento[m]?.[tarefa] != null));
  let maxPos = 0;
  let maxNeg = 0;
  for (const m of MODELOS) for (const tarefa of tarefas) {
    const v = f.experimento[m]?.[tarefa];
    if (v > maxPos) maxPos = v;
    if (v < 0 && -v > maxNeg) maxNeg = -v;
  }
  const total = maxPos + maxNeg || 1;
  const zero = (100 * maxNeg) / total;
  const grupos = tarefas.map((tarefa) => el('div', { class: 'painel-exp-grupo' },
    tarefas.length > 1 && el('p', { class: 'painel-exp-tarefa', text: t(`tarefa_${tarefa}`) }),
    tarefa === 'translate-pt-en' && el('p', { class: 't-legenda', text: t('painel_exp_traducao') }),
    el('div', { class: 'painel-exp' }, MODELOS.flatMap((m) => {
      const v = f.experimento[m]?.[tarefa];
      const nome = el('span', { class: 'painel-exp-nome', text: t(`modelo_${m}`) });
      if (v == null) return [nome, el('span', { class: 'painel-exp-raro t-legenda', text: t('painel_exp_raro') })];
      const largura = (100 * Math.abs(v)) / total;
      const barra = el('span', {
        class: `painel-exp-barra ${v < 0 ? 'painel-exp-neg' : ''}`.trim(),
        style: { left: `${v < 0 ? zero - largura : zero}%`, width: `${largura}%` },
      });
      const valor = v > 0 ? `+${fmt.num(v)}` : fmt.num(v);
      // aria-label não vale num span sem papel: o leitor de tela lê o texto do .sr.
      return [nome, el('span', { class: 'painel-exp-trilho' }, maxNeg > 0 && el('span', { class: 'painel-exp-zero', style: { left: `${zero}%` } }), barra),
        el('span', { class: 'painel-exp-valor dado' },
          el('span', { 'aria-hidden': 'true', text: valor }),
          el('span', { class: 'sr', text: t(v === 1 || v === -1 ? 'painel_exp_valor_1' : 'painel_exp_valor', { valor }) }))];
    }))));
  return el('section', { class: 'painel-secao' },
    el('div', { class: 'painel-secao-topo' }, el('h3', { class: 't-rotulo', text: t('painel_experimento') }), el('a', { class: 't-legenda', href: rota('experimento'), text: t('painel_exp_link') })),
    el('p', { class: 't-p painel-texto', text: textos ? t('painel_exp_texto', { n: fmt.num(textos) }) : t('painel_exp_texto_sem') }),
    ...grupos);
}

/** Uma frase em contexto: texto do resumo com a palavra realçada, revista, ano e "ver artigo". */
export function fraseContexto(frase, { lingua, nivel = 3, tamanho } = {}) {
  const marca = nivel ? el('span', { class: `mk mk-${nivel}`, text: frase.palavra }) : el('span', { class: 'w', text: frase.palavra });
  return el('figure', { class: 'frase' },
    el('blockquote', { class: 'frase-texto', lang: langDe(lingua), style: tamanho ? { fontSize: `${tamanho}px` } : null }, frase.antes, marca, frase.depois),
    el('figcaption', { class: 't-legenda' }, `${frase.revista} · ${frase.ano} · `,
      el('a', { href: `https://doi.org/${frase.doi}`, rel: 'noopener noreferrer', text: t('ver_artigo') })));
}

function contexto(f) {
  if (!f.contexto) return secao(t('painel_contexto'), el('p', { class: 't-p painel-texto', text: t('contexto_sem') }));
  // O nível de realce vem dos dados (o mesmo de marcadoras.json); palavra que não é marcadora vai
  // só em negrito.
  const nivel = f.nivel ?? null;
  return secao(t('painel_contexto'), ...['2019', '2025'].map((ano) => {
    const frases = (f.contexto[ano] || []).slice(0, 2);
    return el('div', { class: 'painel-contexto-ano' },
      el('p', { class: 'painel-contexto-rotulo', text: ano }),
      frases.length ? frases.map((fr) => fraseContexto(fr, { lingua: f.lingua, nivel }))
        : el('p', { class: 't-p painel-texto', text: t('contexto_vazio_ano', { ano }) }));
  }));
}

function botaoAbrir(f) {
  const c = fazerChave(f.palavra, f.lingua);
  return el('a', {
    class: 'btn btn-primario painel-abrir',
    href: `${rota('palavras')}?p=${encodeURIComponent(c)}`,
    on: {
      click: (evento) => {
        let liberar;
        const fechado = new Promise((resolve) => { liberar = resolve; });
        const aviso = new CustomEvent('iaes:abrir-em-palavras', { detail: { chave: c, fechado }, cancelable: true });
        if (!document.dispatchEvent(aviso)) {
          evento.preventDefault();
          fecharPainel().then(liberar);
        }
      },
    },
  }, t('painel_abrir'));
}
