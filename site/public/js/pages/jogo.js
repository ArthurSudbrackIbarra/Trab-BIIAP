// IAês · Antes ou depois? (spec 4.8; d-jogo, m-jogo, e-jogo-revelacao, e-jogo-fim).
//
// Quatro fases na mesma página, sem recarregar: escolha da língua (o formulário de jogo.html),
// pergunta, revelação e fim. Uma rodada tem N resumos de dados/jogo.json, metade de cada período
// (antes: 2019 a 2021; depois: 2024 e 2025); "misturados" também divide as línguas ao meio. A
// rodada seguinte prefere resumos que a pessoa ainda não viu nesta visita.
//
// Placar só na memória da página: nada vai para o endereço nem para armazenamento.
//
// A revelação realça as palavras-marcadoras com a regra de "Marcas num texto" (site/DADOS.md): as
// marcas são as de jogo.json (`marcas`), e o nível do realce (.mk-1 a .mk-4) vem de
// dados/marcadoras.json, baixado em segundo plano; sem ele, o realce sai no nível 2. Cada marca é um
// botão com data-palavra, que abre o painel da palavra (painel.js, via cabecalho.js).
//
// A regra das marcadoras do fim diz "depois" quando por100 > limiar[lingua] (jogo.json) e é
// calculada nos mesmos N resumos que a pessoa jogou.
//
// Teclado: ← e → respondem na pergunta; Enter passa ao próximo resumo na revelação (com o foco
// fora de botões e links, que já tratam o Enter). O foco vai para "Resumo N" a cada pergunta, para
// "Próximo resumo" na revelação e para o título no fim; o resultado é anunciado em #jogo-vivo.
import { el, icone, t, fmt, carregarEm, dados, nomeArea, siglaLingua, chave as fazerChave, rota, semMovimento } from '../lib/base.js';

const N = 10;
const RE_MARCA = /[a-zà-öø-ÿ]{4,}/g;
const ICONE_CERTO = 'M5 12.5l4.5 4.5L19 7.5';
const ICONE_ERRADO = 'M6 6l12 12M18 6L6 18';
const $ = (id) => document.getElementById(id);
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');

const inicio = $('jogo-inicio');
const form = $('jogo-form');
const area = $('jogo-area');
const vivo = $('jogo-vivo');

const estado = {
  fase: 'inicio', modo: 'misto', rodada: [], respostas: [], i: 0,
  jogo: null, marcadoras: null, vistos: new Set(),
};
let observador = null;

// Baixa os dados já na escolha, para a primeira pergunta abrir na hora. Os erros aparecem só
// quando a pessoa começa (carregarEm mostra o erro com "Tentar de novo" na área do jogo).
dados('jogo.json').catch(() => {});
dados('marcadoras.json').then((d) => {
  estado.marcadoras = d;
  if (estado.fase === 'revelacao') atualizarRealce();
}, () => {});

// ---------- Ajudas ----------
const svg = (d, classe = 'ic') => el('svg', { class: classe, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d }));

function embaralhar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chaveLingua(l) {
  if (l === 'misto') return el('span', { class: 'chave-par' }, el('span', { class: 'chave chave-pt' }), el('span', { class: 'chave chave-en' }));
  return el('span', { class: `chave chave-${l}` });
}

/** Rola até o elemento só se o topo dele estiver fora da janela. */
function trazer(no) {
  const r = no.getBoundingClientRect();
  if (r.top < 0 || r.top > innerHeight * 0.8) no.scrollIntoView({ block: 'start', behavior: semMovimento() ? 'auto' : 'smooth' });
}

const regraDiz = (r) => (r.por100 > estado.jogo.limiar[r.lingua] ? 'depois' : 'antes');
const textoMarcas = (n) => (n === 0 ? t('marcas_0') : n === 1 ? t('marcas_1') : t('marcas_n', { n: fmt.num(n) }));
const textoPista = (n) => (n === 0 ? t('pista_0') : n === 1 ? t('pista_1') : t('pista_n', { n: fmt.num(n) }));

/** Tamanho da letra do resumo pelo comprimento, para a pergunta caber na tela do computador. */
function tamanhoTexto(texto) {
  if (texto.length <= 1000) return 'jogo-texto-g';
  if (texto.length <= 1400) return 'jogo-texto-m';
  return 'jogo-texto-p';
}

// ---------- Sorteio ----------
function sortear() {
  const { resumos } = estado.jogo;
  const metade = N / 2;
  const balde = (l, p) => embaralhar(resumos.filter((r) => r.lingua === l && r.periodo === p))
    .sort((a, b) => Number(estado.vistos.has(a.id)) - Number(estado.vistos.has(b.id)));
  let pedidos;
  if (estado.modo === 'misto') {
    // Metade em cada língua e metade em cada período: k resumos de antes em português, os outros
    // de antes em inglês, e o contrário depois.
    const k = Math.random() < 0.5 ? Math.floor(metade / 2) : Math.ceil(metade / 2);
    pedidos = [['pt', 'antes', k], ['en', 'antes', metade - k], ['pt', 'depois', metade - k], ['en', 'depois', k]];
  } else {
    pedidos = [[estado.modo, 'antes', metade], [estado.modo, 'depois', metade]];
  }
  const escolhidos = pedidos.flatMap(([l, p, q]) => balde(l, p).slice(0, q));
  escolhidos.forEach((r) => estado.vistos.add(r.id));
  estado.rodada = embaralhar(escolhidos);
  estado.respostas = [];
  estado.i = 0;
}

// ---------- Partes comuns da pergunta e da revelação ----------
function topo() {
  const i = estado.i;
  const feitos = estado.fase === 'revelacao' ? i + 1 : i;
  const passos = Array.from({ length: N }, (_, k) => el('li', {
    class: `jogo-passo${k < feitos ? ' jogo-passo-feito' : k === i ? ' jogo-passo-agora' : ''}`,
  }));
  return el('div', { class: 'jogo-topo' },
    el('h1', { class: 't-h1 jogo-h1', text: t('titulo') }),
    el('div', { class: 'jogo-progresso' },
      el('p', { class: 'num jogo-contador', 'aria-hidden': 'true', html: t('progresso', { i: `<strong>${fmt.num(i + 1)}</strong>`, n: fmt.num(N) }) }),
      el('ol', { class: 'jogo-passos', 'aria-hidden': 'true' }, passos)));
}

function linhaModo() {
  return el('div', { class: 'jogo-modo' },
    el('p', { class: 't-p jogo-modo-texto' },
      el('span', { text: t('resumos_rotulo') }),
      el('span', { class: 'etq' }, chaveLingua(estado.modo), t(`modo_${estado.modo}`)),
      el('span', { class: 'jogo-so-largo', text: `· ${t('periodos_curto')}` })),
    el('button', { class: 'btn btn-fantasma btn-p jogo-recomecar', type: 'button', on: { click: recomecar } }, icone('recarregar'), t('recomecar')));
}

function etqLingua(l) {
  return el('span', { class: 'etq' }, chaveLingua(l), siglaLingua(l));
}

function trocar(...nos) {
  observador?.disconnect();
  observador = null;
  area.replaceChildren(...nos);
}

// ---------- Pergunta ----------
function botaoResposta(qual) {
  const seta = svg(qual === 'antes' ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6', 'ic ic-g');
  const rotulo = el('span', { class: 'jogo-resp-rotulo' }, el('span', { text: t(qual) }), el('span', { class: 't-legenda', text: t(`${qual}_sub`) }));
  const tecla = el('span', { class: 'kbd jogo-kbd', 'aria-hidden': 'true', text: qual === 'antes' ? '←' : '→' });
  const corpo = qual === 'antes'
    ? [el('span', { class: 'jogo-resp-lado' }, seta, rotulo), tecla]
    : [tecla, el('span', { class: 'jogo-resp-lado' }, rotulo, seta)];
  return el('button', {
    class: `btn btn-g jogo-resp jogo-resp-${qual}`, type: 'button', dataset: { resposta: qual },
    'aria-keyshortcuts': qual === 'antes' ? 'ArrowLeft' : 'ArrowRight',
    on: { click: () => responder(qual) },
  }, ...corpo);
}

/** Os botões ficam presos ao pé da janela enquanto o resumo é mais alto que ela. */
function botoesPresos(botoes) {
  const envolve = el('div', { class: 'jogo-botoes-envolve' }, botoes);
  const sentinela = el('div', { class: 'jogo-sentinela', 'aria-hidden': 'true' });
  return { envolve, sentinela };
}

function observar(envolve, sentinela) {
  if (!('IntersectionObserver' in window)) return;
  observador = new IntersectionObserver(([e]) => {
    envolve.classList.toggle('jogo-preso', !e.isIntersecting && e.boundingClientRect.top > 0);
  });
  observador.observe(sentinela);
}

function desenharPergunta() {
  estado.fase = 'pergunta';
  const r = estado.rodada[estado.i];
  const titulo = el('h2', { class: 't-rotulo jogo-resumo-n', id: 'jogo-resumo-n', tabindex: '-1' },
    t('resumo_n', { i: fmt.num(estado.i + 1) }), el('span', { class: 'sr', text: ` ${t('resumo_de', { n: fmt.num(N) })}` }));
  const cartao = el('article', { class: 'cartao jogo-cartao', 'aria-labelledby': 'jogo-resumo-n' },
    el('div', { class: 'jogo-cartao-topo' }, titulo, etqLingua(r.lingua)),
    el('p', { class: `jogo-texto ${tamanhoTexto(r.texto)}`, lang: langDe(r.lingua), text: r.texto }));
  const botoes = el('div', { class: 'jogo-botoes', role: 'group', 'aria-label': t('botoes_rotulo') }, botaoResposta('antes'), botaoResposta('depois'));
  const { envolve, sentinela } = botoesPresos(botoes);
  trocar(el('div', { class: 'jogo-rodada' },
    topo(), linhaModo(), cartao, envolve, sentinela,
    el('p', { class: 't-legenda jogo-nota', html: t('nota_rodada') })));
  observar(envolve, sentinela);
  vivo.textContent = '';
}

function responder(resposta) {
  if (estado.fase !== 'pergunta') return;
  const r = estado.rodada[estado.i];
  estado.respostas[estado.i] = { resposta, certo: resposta === r.periodo, regra: regraDiz(r) === r.periodo };
  desenharRevelacao();
}

// ---------- Revelação ----------
/** Nós do texto com cada palavra-marcadora trocada por um botão realçado que abre o painel. */
function realcar(r) {
  const exibido = r.texto.normalize('NFC');
  let baixo = exibido.toLowerCase();
  if (baixo.length !== exibido.length) {
    baixo = Array.from(exibido, (c) => { const m = c.toLowerCase(); return m.length === c.length ? m : c; }).join('');
  }
  const conjunto = new Set(r.marcas);
  const tabela = estado.marcadoras?.[r.lingua];
  const nos = [];
  let pos = 0;
  for (const m of baixo.matchAll(RE_MARCA)) {
    const k = m[0];
    if (!conjunto.has(k)) continue;
    if (m.index > pos) nos.push(exibido.slice(pos, m.index));
    const forma = exibido.slice(m.index, m.index + k.length);
    const info = tabela && Object.hasOwn(tabela, k) ? tabela[k] : null;
    nos.push(el('button', {
      type: 'button', class: `mk mk-${info ? info[1] : 2} jogo-mk`, dataset: { palavra: fazerChave(k, r.lingua) },
      'aria-label': info ? t('marca_aria', { palavra: forma, razao: fmt.razao(info[0]) }) : null,
      title: info ? t('marca_titulo', { razao: fmt.razao(info[0]) }) : null,
    }, forma));
    pos = m.index + k.length;
  }
  if (pos < exibido.length) nos.push(exibido.slice(pos));
  return nos;
}

function escala() {
  return el('div', { class: 'legenda jogo-escala', hidden: !estado.marcadoras },
    el('span', { class: 'sr', text: t('escala_rotulo') }),
    [1, 2, 3, 4].map((n) => el('span', { class: `mk mk-${n} num jogo-escala-mk`, text: t(`escala_${n}`) })));
}

function atualizarRealce() {
  const r = estado.rodada[estado.i];
  const texto = area.querySelector('.jogo-texto-rev');
  if (!r || !texto) return;
  texto.replaceChildren(...realcar(r));
  area.querySelector('.jogo-escala')?.removeAttribute('hidden');
}

function desenharRevelacao() {
  estado.fase = 'revelacao';
  const r = estado.rodada[estado.i];
  const { resposta, certo } = estado.respostas[estado.i];
  const ultimo = estado.i === N - 1;
  const ano = String(r.ano);
  const mensagem = certo ? t('certo', { ano }) : t(`errado_${r.periodo}`, { ano });
  const pista = textoPista(r.marcas.length);

  const proximoBotao = el('button', { class: 'btn btn-primario jogo-proximo', type: 'button', on: { click: proximo } },
    t(ultimo ? 'ver_resultado' : 'proximo'), icone('seta'));
  const veredito = el('div', { class: `jogo-veredito ${certo ? 'jogo-certo' : 'jogo-errado'}` },
    el('span', { class: 'jogo-veredito-icone' }, svg(certo ? ICONE_CERTO : ICONE_ERRADO)),
    el('div', { class: 'jogo-veredito-texto' },
      el('p', { class: 'jogo-veredito-titulo', text: mensagem }),
      el('p', { class: 't-p jogo-veredito-sub', text: t('sua_resposta', { resposta: t(`resposta_${resposta}`) }) })),
    proximoBotao);

  const areas = (r.areas || []).map(nomeArea).join(', ');
  const meta = el('p', { class: 't-legenda jogo-rev-meta' },
    el('span', { class: 'num jogo-rev-ano', text: ano }),
    el('span', { text: '·' }), el('span', { text: r.revista }),
    areas && el('span', { text: '·' }), areas && el('span', { text: areas }),
    el('span', { text: '·' }),
    el('a', { href: `https://doi.org/${r.doi}`, target: '_blank', rel: 'noopener noreferrer' }, t('ver_artigo'), el('span', { class: 'sr', text: ` ${t('nova_aba')}` })));
  const cartao = el('article', { class: 'cartao jogo-cartao jogo-cartao-rev', 'aria-labelledby': 'jogo-rev-titulo' },
    el('div', { class: 'jogo-rev-cabeca' },
      el('h2', { class: 'jogo-rev-titulo', id: 'jogo-rev-titulo', lang: r.titulo ? langDe(r.lingua) : null, text: r.titulo || t('sem_titulo') }),
      meta),
    el('p', { class: `jogo-texto jogo-texto-rev ${tamanhoTexto(r.texto)}`, lang: langDe(r.lingua) }, ...realcar(r)),
    el('div', { class: 'jogo-pista' },
      el('p', { class: 't-p' }, el('strong', { text: t('pista') }), ` ${pista}`),
      escala()));

  const enter = el('p', { class: 't-legenda jogo-enter jogo-so-teclado', 'aria-hidden': 'true' },
    el('span', { class: 'kbd', text: 'Enter' }), t(ultimo ? 'enter_resultado' : 'enter_proximo'));

  const rodada = el('div', { class: 'jogo-rodada' }, topo(), veredito, cartao, enter);
  trocar(rodada);
  vivo.textContent = `${mensagem} ${t('pista')} ${pista}`;
  proximoBotao.focus({ preventScroll: true });
  trazer(rodada);
}

function proximo() {
  if (estado.fase !== 'revelacao') return;
  estado.i += 1;
  if (estado.i >= N) {
    desenharFim();
    return;
  }
  desenharPergunta();
  const titulo = $('jogo-resumo-n');
  titulo.focus({ preventScroll: true });
  trazer(area.querySelector('.jogo-rodada'));
}

// ---------- Fim ----------
function barra(rotulo, valor, classe) {
  return [
    el('span', { class: 't-p jogo-barra-rotulo', text: rotulo }),
    el('span', { class: 'jogo-barra-trilho', 'aria-hidden': 'true' },
      el('span', { class: `jogo-barra ${classe}`, style: { width: `${(100 * valor) / N}%` } })),
    el('span', { class: 'num jogo-barra-valor', text: fmt.num(valor, Number.isInteger(valor) ? 0 : 1) }),
  ];
}

function desenharFim() {
  estado.fase = 'fim';
  const acertos = estado.respostas.filter((x) => x.certo).length;
  const regra = estado.respostas.filter((x) => x.regra).length;
  const { limiar, regra: geral } = estado.jogo;

  const titulo = el('h1', { class: 'jogo-fim-titulo', id: 'jogo-fim-titulo', tabindex: '-1',
    html: t('fim_titulo', { acertos: `<span class="num">${fmt.num(acertos)}</span>`, n: fmt.num(N) }) });
  const barras = el('div', { class: 'jogo-barras', role: 'group', 'aria-label': t('barras_rotulo') },
    barra(t('barra_voce'), acertos, 'jogo-barra-voce'),
    barra(t('barra_regra'), regra, 'jogo-barra-regra'),
    barra(t('barra_acaso'), N / 2, 'jogo-barra-acaso'));
  const esquerda = el('section', { class: 'jogo-fim-resultado', 'aria-labelledby': 'jogo-fim-titulo' },
    titulo,
    el('p', { class: 't-lede', html: t('fim_regra', { regra: `<span class="num">${fmt.num(regra)}</span>` }) }),
    el('p', { class: 't-ui jogo-fim-texto', text: t('fim_texto', {
      pt: fmt.num(geral.pt.acertos), tpt: fmt.num(geral.pt.total), en: fmt.num(geral.en.acertos), ten: fmt.num(geral.en.total),
    }) }),
    barras,
    el('p', { class: 't-legenda', text: t('regra_explica', { pt: fmt.num(limiar.pt, 2), en: fmt.num(limiar.en, 2) }) }),
    el('div', { class: 'jogo-fim-acoes' },
      el('button', { class: 'btn btn-primario btn-g', type: 'button', on: { click: jogarDeNovo } }, icone('recarregar', 'ic'), t('jogar_de_novo')),
      el('a', { class: 'btn btn-g', href: `${rota('metodo')}#marcadoras` }, t('ver_como'))),
    el('p', { class: 't-legenda', text: t('fim_placar') }));

  const linhas = estado.rodada.map((r, k) => {
    const { certo, regra: regraCerta } = estado.respostas[k];
    return el('li', { class: 'jogo-lista-linha' },
      el('span', { class: 't-legenda num', text: fmt.num(k + 1) }),
      el('span', { class: `jogo-lista-icone${certo ? ' jogo-lista-certo' : ''}` }, svg(certo ? ICONE_CERTO : ICONE_ERRADO)),
      el('span', { class: 't-p jogo-lista-titulo' },
        el('span', { class: 'sr', text: `${t('linha_sr', { voce: t(certo ? 'acertou' : 'errou'), regra: t(regraCerta ? 'regra_certa' : 'regra_errada') })} ` }),
        el('a', { href: `https://doi.org/${r.doi}`, target: '_blank', rel: 'noopener noreferrer', lang: r.titulo ? langDe(r.lingua) : null, title: r.titulo || null },
          r.titulo || r.revista, el('span', { class: 'sr', text: ` ${t('nova_aba')}` }))),
      el('span', { class: 't-legenda num jogo-lista-dado', text: `${r.ano} · ${textoMarcas(r.marcas.length)}` }));
  });
  const direita = el('section', { class: 'jogo-fim-lista', 'aria-labelledby': 'jogo-lista-titulo' },
    el('h2', { class: 't-rotulo', id: 'jogo-lista-titulo', text: t('lista_titulo', { n: fmt.num(N) }) }),
    el('ol', { class: 'cartao jogo-lista' }, linhas));

  trocar(el('div', { class: 'jogo-fim' }, esquerda, direita));
  vivo.textContent = t('vivo_fim', { acertos: fmt.num(acertos), n: fmt.num(N), regra: fmt.num(regra) });
  titulo.focus({ preventScroll: true });
  trazer(titulo);
}

// ---------- Começar, recomeçar ----------
async function comecar() {
  estado.modo = new FormData(form).get('modo') || 'misto';
  inicio.hidden = true;
  area.hidden = false;
  estado.fase = 'carregando';
  estado.jogo = await carregarEm(area, 'jogo.json', { altura: 520, erroTitulo: t('erro_jogo_titulo'), erroTexto: t('erro_texto_tela') });
  if (estado.fase !== 'carregando') return;   // a pessoa voltou à escolha enquanto carregava
  sortear();
  desenharPergunta();
  $('jogo-resumo-n').focus({ preventScroll: true });
  trazer(area);
}

function jogarDeNovo() {
  sortear();
  desenharPergunta();
  $('jogo-resumo-n').focus({ preventScroll: true });
  trazer(area);
}

function recomecar() {
  estado.fase = 'inicio';
  trocar();
  area.hidden = true;
  inicio.hidden = false;
  vivo.textContent = '';
  const marcado = form.querySelector(`input[value="${estado.modo}"]`);
  if (marcado) marcado.checked = true;
  $('jogo-titulo').focus({ preventScroll: true });
  trazer(inicio);
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  comecar();
});

// ---------- Teclado ----------
document.addEventListener('keydown', (evento) => {
  if (evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
  if (document.documentElement.classList.contains('painel-aberto')) return;
  const alvo = evento.target instanceof Element ? evento.target : null;
  if (alvo?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .cab')) return;
  if (estado.fase === 'pergunta' && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) {
    evento.preventDefault();
    if (evento.repeat) return;
    responder(evento.key === 'ArrowLeft' ? 'antes' : 'depois');
  } else if (estado.fase === 'revelacao' && evento.key === 'Enter') {
    if (alvo?.closest('a, button, summary, [role="button"]')) return;   // Enter já ativa o que tem foco
    evento.preventDefault();
    proximo();
  }
});
