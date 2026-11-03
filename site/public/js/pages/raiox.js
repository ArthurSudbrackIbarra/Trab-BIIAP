// IAês · Raio-X do seu texto (spec 4.7; d-raiox, m-raiox, e-raiox-entrada, e-vazio-erro, e-falhas).
//
// Tudo roda no navegador, só com dados/marcadoras.json (site/DADOS.md, "marcadoras.json" e "Marcas
// num texto"). O texto colado não vai para o endereço, para armazenamento nenhum nem para
// requisição nenhuma: a página não grava estado na URL, a caixa tem autocomplete e corretor
// desligados, e nenhum arquivo é pedido por causa do texto. Só o clique numa palavra realçada abre o
// painel da palavra (painel.js), que acrescenta #palavra=<palavra>.<lingua> ao endereço e baixa os
// dados daquela palavra, como em qualquer tela.
//
// Entrada: caixa de texto, Analisar, Limpar e os dois exemplos reais; a língua é detectada por
// palavras de função (detectar()) e a pessoa pode trocar (PT | EN). Texto com menos de 50 palavras
// ganha o aviso e o botão "Analisar mesmo assim"; texto em outra língua, ou misturado, deixa os
// botões de língua livres e Analisar desligado até a pessoa escolher.
//
// Resultado: o texto com as marcadoras realçadas pelo nível de marcadoras.json (.mk-1 a .mk-4), com
// dica (mouse e foco) e painel no clique; no celular, o toque abre o cartão da dica com o botão do
// painel. A linha de resumo conta como "Marcas num texto". O histograma é desenhado a partir de
// hist.<lingua>.ordenados (todos os por100 de 2019 e de 2025), em faixas de 0,5 de 0 a TOPO; os
// resumos acima de TOPO são contados no pé do gráfico. "Isto não é um detector de IA" abre os
// resumos de 2019 a 2021 de `parecidos` com por100 igual ou maior que o do texto, os mais próximos.
import { el, icone, t, fmt, lingua as linguaSite, carregarEm, faixa, semMovimento, siglaLingua, nomeArea, chave as fazerChave, avisoRapido } from '../lib/base.js';
import { escalaLinear, marcasBonitas } from '../lib/grafico.js';
import { criarDica, conteudoDica } from '../lib/dica.js';
import { tabela, botaoTabela } from '../lib/tabela.js';
import { segmentos } from '../lib/filtros.js';

const $ = (id) => document.getElementById(id);
const MINIMO = 50;               // abaixo disto, o aviso de texto curto
const PASSO = 0.5;               // largura de cada faixa do histograma
const TOPO = 16;                 // o histograma vai de 0 a 16 marcas a cada 100 palavras
const N_FAIXAS = TOPO / PASSO;
const RE_PALAVRA = /[\p{L}]+(?:['-][\p{L}]+)*/gu;
const RE_MARCA = /[a-zà-öø-ÿ]{4,}/g;
const ANOS_EXEMPLO = ['2019', '2025'];
const CLASSE = { estilo: 'classe_estilo', conteudo: 'classe_conteudo', 'sem-classe': 'classe_sem' };
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');
const celular = () => faixa() === 'celular';
const rolar = (no, bloco = 'start') => no.scrollIntoView({ block: bloco, behavior: semMovimento() ? 'auto' : 'smooth' });

// ---------- Contagem: a regra de site/DADOS.md, "Marcas num texto" ----------
export function contarPalavras(texto) {
  return (String(texto).match(RE_PALAVRA) || []).length;
}
export function contarMarcas(texto, conjunto) {
  let n = 0;
  for (const m of String(texto).normalize('NFC').toLowerCase().matchAll(RE_MARCA)) if (conjunto.has(m[0])) n += 1;
  return n;
}
export const por100 = (marcas, palavras) => (palavras ? Math.floor((20000 * marcas + palavras) / (2 * palavras)) / 100 : 0);

// ---------- Língua: palavras de função ----------
const LISTAS = Object.fromEntries(Object.entries({
  pt: 'a à ao aos as às com como da das de do dos e é em entre essa esse esta este estes estas foi foram isso mais na nas não no nos o os ou para pela pelas pelo pelos por que se seu seus sua suas são sobre também um uma umas uns',
  en: 'a an and are as at be been between by for from has have in is it its not of on or our that the their these this to was we were which with',
  es: 'a al como con de del el en entre es esta este estos estas fue fueron la las lo los más no o para por que se son su sus sobre también un una unos unas y',
  fr: 'au aux avec ce ces cette dans de des du elle en est et il la le les leur mais ne nous ou par pas plus pour qui que se son sont sur un une été',
  it: 'al alla che con da dal degli dei del della delle di e gli il in la le nel nella non per più sono tra un una è stato stati',
  de: 'auch auf aus bei das dem den der des die ein eine einer eines für im in ist mit nach nicht sich sind und von wird werden wurde wurden zu zur',
}).map(([l, lista]) => [l, new Set(lista.split(' '))]));

/** 'pt' | 'en' | 'outra' (outra língua ou mistura) | null (sem palavras). */
export function detectar(texto) {
  const palavras = String(texto).toLowerCase().match(RE_PALAVRA) || [];
  if (!palavras.length) return null;
  const pontos = Object.fromEntries(Object.keys(LISTAS).map((l) => [l, 0]));
  for (const p of palavras) for (const l in LISTAS) if (LISTAS[l].has(p)) pontos[l] += 1;
  const ordem = Object.entries(pontos).sort((a, b) => b[1] - a[1]);
  const [melhor, n] = ordem[0];
  if (!n || (melhor !== 'pt' && melhor !== 'en')) return 'outra';
  const outra = melhor === 'pt' ? 'en' : 'pt';
  if (pontos[outra] >= 4 && pontos[outra] >= 0.5 * n) return 'outra';          // as duas misturadas
  const [segunda, n2] = ordem[1];
  if (segunda !== outra && n2 >= 3 && n2 >= 0.85 * n) return 'outra';          // espanhol perto do português
  return melhor;
}

// ---------- Estado ----------
const estado = {
  dados: null,
  conjuntos: {},
  deteccao: null,      // resultado de detectar()
  escolhida: null,     // 'pt' | 'en' escolhida à mão (vale até a caixa ficar vazia)
  lingua: null,        // a língua usada na análise
  exemplo: null,       // { ano, lingua, texto } quando a caixa tem um exemplo sem edição
  analisado: null,     // { texto, lingua } da última análise
  parecidos: false,    // a lista de resumos parecidos está aberta
  terceiro: false,     // no celular, o terceiro resumo parecido está aberto
};
const cacheHist = {};
let limpezas = [];

const area = $('rx-texto');
const botaoAnalisar = $('rx-analisar');
const botaoLimpar = $('rx-limpar');
const botoesExemplo = [...document.querySelectorAll('.rx-exemplo')];
const situacao = $('rx-situacao');
const mudou = $('rx-mudou');
const fonte = $('rx-fonte');
const curto = $('rx-curto');
const curtoTexto = $('rx-curto-texto');
const offline = $('rx-offline');
const resultado = $('rx-resultado');
const vivo = $('rx-vivo');

const nPalavras = (n) => (n === 1 ? t('n_palavras_1') : t('n_palavras', { n: fmt.num(n) }));
const nomeLingua = (l) => t(`lingua_${l}_nome`);

// ---------- Seletor de língua ----------
const seletor = segmentos({
  rotulo: t('lingua_rotulo'),
  valor: null,
  opcoes: ['pt', 'en'].map((l) => ({ valor: l, texto: siglaLingua(l), chave: l })),
  aoMudar: escolherLingua,
  classe: 'rx-seg',
});
seletor.setAttribute('aria-label', t('lingua_aria'));
const botoesLingua = [...seletor.querySelectorAll('button')];
$('rx-lingua').append(seletor);

function escolherLingua(l) {
  // Um exemplo sem edição troca pelo exemplo do mesmo ano na outra língua.
  if (estado.exemplo && area.value === estado.exemplo.texto && estado.dados) {
    usarExemplo(estado.exemplo.ano, l);
    return;
  }
  estado.escolhida = l;
  atualizarEntrada();
  if (estado.analisado && estado.analisado.texto === area.value) analisar({ focar: false });
}

// ---------- Entrada ----------
function atualizarEntrada() {
  const texto = area.value;
  const vazio = !texto.trim();
  const n = vazio ? 0 : contarPalavras(texto);
  if (vazio) estado.escolhida = null;
  estado.deteccao = vazio ? null : detectar(texto);
  const detectada = estado.deteccao === 'pt' || estado.deteccao === 'en' ? estado.deteccao : null;
  estado.lingua = estado.escolhida || detectada;

  botoesLingua.forEach((b) => { b.disabled = vazio; });
  seletor.definir(estado.lingua);

  let frase;
  if (vazio) frase = t('situacao_vazia');
  else if (!n) frase = t('situacao_sem_palavras');
  else if (estado.escolhida && estado.escolhida !== detectada) frase = t('situacao_escolhida', { lingua: nomeLingua(estado.escolhida), palavras: nPalavras(n) });
  else if (detectada) frase = t('situacao_detectada', { lingua: nomeLingua(detectada), palavras: nPalavras(n) });
  else frase = t('situacao_desconhecida');
  situacao.textContent = frase;
  situacao.classList.toggle('rx-situacao-alerta', Boolean(n && !estado.lingua));

  const eCurto = n > 0 && n < MINIMO;
  curto.hidden = !eCurto;
  if (eCurto) curtoTexto.textContent = t('curto_aviso', { palavras: nPalavras(n) });
  botaoAnalisar.textContent = t(eCurto ? 'botao_analisar_curto' : 'botao_analisar');
  botaoAnalisar.disabled = !n || !estado.lingua;
  botaoLimpar.disabled = texto === '';

  const comExemplo = Boolean(estado.exemplo && texto === estado.exemplo.texto);
  if (!comExemplo) estado.exemplo = null;
  botoesExemplo.forEach((b) => b.setAttribute('aria-pressed', String(comExemplo && b.dataset.ano === estado.exemplo.ano)));
  mostrarFonte();

  const desatualizado = Boolean(estado.analisado) && (estado.analisado.texto !== texto || estado.analisado.lingua !== estado.lingua);
  mudou.hidden = !desatualizado;
  for (const s of resultado.querySelectorAll('.rx-res, .rx-comp, .rx-parecidos')) s.classList.toggle('esmaecido', desatualizado);
  $('rx-entrada').classList.toggle('rx-com-resultado', Boolean(estado.analisado));
}

function mostrarFonte() {
  const ex = estado.exemplo;
  fonte.hidden = !ex;
  if (!ex) return;
  const dado = estado.dados.exemplos[ex.lingua][ex.ano];
  fonte.replaceChildren(t('exemplo_fonte', { ano: dado.ano, revista: dado.revista }), ' ',
    el('a', { href: `https://doi.org/${dado.doi}`, rel: 'noopener noreferrer', text: t('ver_artigo') }));
}

function usarExemplo(ano, l) {
  const lingua = l || estado.lingua || linguaSite;
  const dado = estado.dados.exemplos[lingua][ano];
  area.value = dado.texto;
  estado.exemplo = { ano, lingua, texto: dado.texto };
  estado.escolhida = null;
  atualizarEntrada();
  if (estado.lingua !== lingua) { // a detecção errou o exemplo: vale a língua do exemplo
    estado.escolhida = lingua;
    atualizarEntrada();
  }
  analisar({ focar: false });
}

area.addEventListener('input', atualizarEntrada);
area.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey) && !botaoAnalisar.disabled) {
    evento.preventDefault();
    analisar();
  }
});
botaoAnalisar.addEventListener('click', () => analisar());
botaoLimpar.addEventListener('click', () => {
  area.value = '';
  estado.exemplo = null;
  estado.analisado = null;
  atualizarEntrada();
  desenharVazio();
  area.focus();
});
for (const b of botoesExemplo) {
  b.addEventListener('click', async () => {
    await pronto;
    usarExemplo(b.dataset.ano);
  });
}

function atualizarOffline() { offline.hidden = navigator.onLine; }
window.addEventListener('online', atualizarOffline);
window.addEventListener('offline', atualizarOffline);
atualizarOffline();

// ---------- Dados ----------
const carga = el('div', { class: 'pagina rx-carga' });
resultado.append(carga);
const pronto = carregarEm(carga, 'marcadoras.json', { altura: 150, erroTitulo: t('erro_lista_titulo'), erroTexto: t('erro_lista_texto') }).then((d) => {
  estado.dados = d;
  estado.conjuntos = { pt: new Set(Object.keys(d.pt)), en: new Set(Object.keys(d.en)) };
  if (!estado.analisado) desenharVazio();
  return d;
});

// ---------- Realce ----------
/** Nós do texto com cada marcadora trocada por criar(formaNoTexto, chaveDaMarcadora). */
function realcar(texto, l, criar) {
  const exibido = String(texto).normalize('NFC');
  let baixo = exibido.toLowerCase();
  if (baixo.length !== exibido.length) {
    baixo = Array.from(exibido, (c) => { const m = c.toLowerCase(); return m.length === c.length ? m : c; }).join('');
  }
  const conjunto = estado.conjuntos[l];
  const nos = [];
  let pos = 0;
  for (const m of baixo.matchAll(RE_MARCA)) {
    if (!conjunto.has(m[0])) continue;
    if (m.index > pos) nos.push(exibido.slice(pos, m.index));
    nos.push(criar(exibido.slice(m.index, m.index + m[0].length), m[0]));
    pos = m.index + m[0].length;
  }
  if (pos < exibido.length) nos.push(exibido.slice(pos));
  return nos;
}

const marcaEstatica = (l) => (forma, k) => el('span', { class: `mk mk-${estado.dados[l][k][1]}` }, forma);
const marcaBotao = (l) => (forma, k) => {
  const [razao, nivel] = estado.dados[l][k];
  return el('button', {
    type: 'button', class: `mk mk-${nivel} rx-marca`, dataset: { k },
    'aria-label': t('marca_aria', { palavra: forma, razao: fmt.razao(razao) }),
  }, forma);
};

// ---------- Estado vazio ----------
function limpar() {
  limpezas.forEach((f) => f());
  limpezas = [];
}

function desenharVazio() {
  limpar();
  resultado.replaceChildren(el('section', { class: 'pagina rx-vazio-secao', 'aria-labelledby': 'rx-vazio-titulo' },
    el('div', { class: 'rx-vazio' },
      el('div', { class: 'rx-vazio-texto' },
        el('h2', { class: 'rx-vazio-titulo', id: 'rx-vazio-titulo', text: t('vazio_titulo') }),
        el('p', { class: 't-texto rx-vazio-p', text: t('vazio_texto') })),
      el('p', { class: 't-texto rx-vazio-explica' },
        t('vazio_explica_antes'), el('span', { class: 'mk mk-2', text: t('vazio_explica_marca') }), t('vazio_explica_depois')))));
}

// ---------- Análise ----------
async function analisar({ focar = true } = {}) {
  await pronto;
  const texto = area.value;
  const l = estado.lingua;
  const palavras = contarPalavras(texto);
  if (!l || !palavras) return;
  const marcas = contarMarcas(texto, estado.conjuntos[l]);
  const r = { texto, lingua: l, palavras, marcas, por100: por100(marcas, palavras) };
  estado.analisado = { texto, lingua: l };
  desenharResultado(r);
  atualizarEntrada();
  const titulo = $('rx-res-titulo');
  const resumo = t('res_vivo', { marcas: textoMarcas(marcas), palavras: nPalavras(palavras), valor: fmt.num(r.por100, 1) });
  if (focar) titulo.focus({ preventScroll: true });
  else vivo.textContent = resumo;
  if (titulo.getBoundingClientRect().top > innerHeight * 0.6) rolar(titulo);
}

function textoMarcas(n) {
  if (n === 0) return t('res_marcas_0');
  if (n === 1) return t('res_marcas_1');
  return t('res_marcas', { n: fmt.num(n) });
}

function desenharResultado(r) {
  limpar();
  resultado.replaceChildren(desenharTexto(r), desenharComparacao(r), desenharParecidos(r));
}

function desenharTexto(r) {
  const l = r.lingua;
  const escala = el('div', { class: 'legenda rx-escala' },
    el('span', { class: 'sr', text: `${t('escala_rotulo')}:` }),
    el('span', {}, el('span', { class: 'rx-so-largo', text: t('escala_pouco') }), el('span', { class: 'rx-so-celular', text: t('escala_pouco_curto') })),
    [1, 2, 3, 4].map((n) => el('span', { class: `mk mk-${n} rx-escala-mk num` },
      n === 1 || n === 4
        ? [el('span', { class: 'rx-so-largo', text: t(`escala_${n}`) }), el('span', { class: 'rx-so-celular', text: t(`escala_${n}_curto`) })]
        : t(`escala_${n}`))),
    el('span', {}, el('span', { class: 'rx-so-largo', text: t('escala_muito') }), el('span', { class: 'rx-so-celular', text: t('escala_muito_curto') })));

  const texto = el('div', { class: 'rx-texto', lang: langDe(l) }, ...realcar(r.texto, l, marcaBotao(l)));
  const caixaTexto = el('div', { class: 'rx-texto-caixa' }, texto);
  ligarMarcas(caixaTexto, l);

  return el('section', { class: 'pagina rx-res', 'aria-labelledby': 'rx-res-titulo' },
    el('div', { class: 'rx-res-topo' },
      el('h2', { class: 'rx-res-titulo num', id: 'rx-res-titulo', tabindex: '-1' },
        textoMarcas(r.marcas), t('res_em', { palavras: nPalavras(r.palavras) }),
        el('span', { class: 'rx-res-por100', text: t('res_por100', { valor: fmt.num(r.por100, 1) }) })),
      escala),
    el('h3', { class: 'sr', text: t('texto_rotulo') }),
    caixaTexto);
}

// Dica das palavras realçadas: mouse e foco no desktop, toque abre o cartão no celular.
function ligarMarcas(caixa, l) {
  let ativa = null;
  let mouse = null;
  let ignorarFoco = false;   // o foco volta à palavra sem reabrir a dica
  const dica = criarDica(caixa, {
    fixaNoCelular: true,
    // O cartão do celular fechou com o foco nele: o foco volta à palavra que o abriu.
    aoFechar: ({ devolverFoco } = {}) => {
      const botao = ativa;
      ativar(null);
      if (!devolverFoco || !botao) return;
      ignorarFoco = true;
      botao.focus();
      ignorarFoco = false;
    },
    // dica.js fecha a dica com o Esc; a palavra perde a marca, e o foco, se estiver nela, fica.
    aoEsc: () => ativar(null),
  });
  limpezas.push(() => dica.destruir());

  function ativar(botao) {
    ativa?.classList.remove('rx-ativa');
    ativa = botao;
    ativa?.classList.add('rx-ativa');
  }

  function conteudo(botao) {
    const k = botao.dataset.k;
    const [razao, nivel, classe] = estado.dados[l][k];
    const frag = document.createDocumentFragment();
    frag.append(
      el('div', { class: 'dica-topo' },
        el('span', { class: `mk mk-${nivel} rx-dica-mk`, lang: langDe(l), text: k }),
        el('span', { text: `${siglaLingua(l)} · ${t(CLASSE[classe] || 'classe_sem')}` })),
      el('p', { class: 'dica-valor', text: t('dica_valor_razao', { razao: fmt.razao(razao) }) }),
      el('p', { class: 't-legenda', text: t('dica_razao_extra') }),
      celular()
        ? el('button', { type: 'button', class: 'btn btn-fantasma btn-p rx-abrir', dataset: { palavra: fazerChave(k, l) } }, t('dica_abrir'), icone('seta'))
        : el('p', { class: 'dica-leitura', text: t('dica_clique') }));
    return frag;
  }

  function mostrar(botao) {
    ativar(botao);
    dica.mostrar(conteudo(botao), { x: 0, y: 0 });
    if (celular()) {
      const cartao = caixa.nextElementSibling;
      if (cartao?.classList.contains('dica-fixa') && cartao.getBoundingClientRect().top > innerHeight - 40) rolar(cartao, 'nearest');
      return;
    }
    // Abaixo da palavra (acima, se não couber na janela), alinhada ao começo dela.
    const flutuante = caixa.querySelector(':scope > .dica');
    if (!flutuante) return;
    const rc = caixa.getBoundingClientRect();
    const rb = botao.getBoundingClientRect();
    const largura = flutuante.offsetWidth;
    const altura = flutuante.offsetHeight;
    const minimo = 8 - rc.left;
    const maximo = document.documentElement.clientWidth - 8 - rc.left - largura;
    const esquerda = Math.max(minimo, Math.min(rb.left - rc.left - 6, maximo));
    let topo = rb.bottom - rc.top + 10;
    if (rb.bottom + 10 + altura > innerHeight - 8 && rb.top - 10 - altura > 8) topo = rb.top - rc.top - 10 - altura;
    flutuante.style.left = `${esquerda}px`;
    flutuante.style.top = `${topo}px`;
  }

  function esconder() {
    ativar(null);
    dica.esconder();
  }

  caixa.addEventListener('pointerover', (evento) => {
    if (evento.pointerType === 'touch' || celular()) return;
    const botao = evento.target.closest('.rx-marca');
    mouse = botao;
    if (botao && botao !== ativa) mostrar(botao);
  });
  caixa.addEventListener('pointerout', (evento) => {
    if (evento.pointerType === 'touch' || celular()) return;
    const botao = evento.target.closest('.rx-marca');
    if (!botao || botao.contains(evento.relatedTarget)) return;
    mouse = null;
    const focada = document.activeElement?.closest?.('.rx-marca');
    if (focada && caixa.contains(focada)) { if (focada !== ativa) mostrar(focada); return; }
    esconder();
  });
  caixa.addEventListener('focusin', (evento) => {
    const botao = evento.target.closest('.rx-marca');
    if (botao && !ignorarFoco) mostrar(botao);
  });
  caixa.addEventListener('focusout', (evento) => {
    if (celular() || caixa.contains(evento.relatedTarget)) return;
    if (mouse) { mostrar(mouse); return; }
    esconder();
  });
  caixa.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.rx-marca');
    if (!botao) return;
    if (celular()) { mostrar(botao); return; }
    import('../lib/painel.js').then((m) => m.abrirPainel(fazerChave(botao.dataset.k, l), botao), () => avisoRapido(t('painel_sem_rede')));
  });
  // Só a troca entre celular e desktop fecha a dica (a barra do navegador do celular também
  // dispara resize ao rolar, e o cartão aberto não deve sumir por isso).
  let faixaAtual = faixa();
  const aoRedimensionar = () => {
    if (faixa() === faixaAtual) return;
    faixaAtual = faixa();
    if (dica.aberta) esconder();
  };
  window.addEventListener('resize', aoRedimensionar);
  limpezas.push(() => window.removeEventListener('resize', aoRedimensionar));
}

// ---------- A comparação honesta ----------
function prepararHist(l) {
  if (cacheHist[l]) return cacheHist[l];
  const h = estado.dados.hist[l];
  const contar = (ordenados) => {
    const faixas = new Array(N_FAIXAS).fill(0);
    let fora = 0;
    for (const v of ordenados) {
      const i = Math.floor(v / PASSO + 1e-9);
      if (i >= N_FAIXAS) fora += 1;
      else faixas[i] += 1;
    }
    return { faixas, fora };
  };
  const mediana = (o) => (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2);
  const anos = {};
  for (const ano of ['2019', '2025']) {
    const ordenados = h.ordenados[ano];
    const n = h[`n${ano}`];
    const { faixas, fora } = contar(ordenados);
    anos[ano] = { ordenados, n, faixas, fora, parcelas: faixas.map((c) => c / n), mediana: mediana(ordenados) };
  }
  const a = anos['2019'];
  const b = anos['2025'];
  let comum = Math.min(a.fora / a.n, b.fora / b.n);
  for (let i = 0; i < N_FAIXAS; i += 1) comum += Math.min(a.parcelas[i], b.parcelas[i]);
  cacheHist[l] = { ...anos, comum };
  return cacheHist[l];
}

/** Parcela dos resumos com por100 igual ou maior que v (ordenados em ordem crescente). */
function parcelaAcima(ordenados, v) {
  let lo = 0;
  let hi = ordenados.length;
  while (lo < hi) {
    const meio = (lo + hi) >> 1;
    if (ordenados[meio] < v) lo = meio + 1;
    else hi = meio;
  }
  return (ordenados.length - lo) / ordenados.length;
}

const pct1 = (p) => fmt.pct(p, 1);
function frasesParcela(hd, v, chave) {
  const p19 = parcelaAcima(hd['2019'].ordenados, v);
  const p25 = parcelaAcima(hd['2025'].ordenados, v);
  if (!p19 && !p25) return t(`${chave}_nenhum`, { valor: fmt.num(v, 1) });
  const a = p19 ? t('parcela_a', { pct: pct1(p19) }) : t('parcela_a_zero');
  const b = p25 ? t('parcela_b', { pct: pct1(p25) }) : t('parcela_b_zero');
  const frase = t(chave, { a, b, valor: fmt.num(v, 1) });
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

function rotuloFaixa(i) {
  const de = i * PASSO;
  if (i >= N_FAIXAS) return t('faixa_ultima', { de: fmt.num(TOPO) });
  return t('faixa', { de: fmt.num(de, de % 1 ? 1 : 0), ate: fmt.num(de + PASSO - 0.01, 2) });
}

function desenharComparacao(r) {
  const l = r.lingua;
  const hd = prepararHist(l);
  const v = r.por100;
  const legenda = el('div', { class: 'legenda rx-hist-legenda' },
    el('span', { class: 'legenda-item' }, el('span', { class: 'rx-am-2019' }),
      el('span', { class: 'rx-so-largo', text: t('leg_2019') }), el('span', { class: 'rx-so-celular', text: t('leg_2019_curto') })),
    el('span', { class: 'legenda-item' }, el('span', { class: 'rx-am-2025' }),
      el('span', { class: 'rx-so-largo', text: t('leg_2025') }), el('span', { class: 'rx-so-celular', text: t('leg_2025_curto') })),
    el('span', { class: 'legenda-item' }, el('span', { class: 'rx-am-seu' }), t('leg_seu')));
  const plot = el('div', { class: 'plot rx-hist' });
  const nota = el('div', { class: 'rx-hist-nota' });
  const lugarTabela = el('div', { class: 'rx-hist-tabela' });
  const resumoSr = el('p', { class: 'sr' });
  const linhaFonte = el('p', { text: `${t('comp_fonte')} ${t('fora', { max: fmt.num(TOPO), n19: fmt.num(hd['2019'].fora), n25: fmt.num(hd['2025'].fora) })}` });
  const pe = el('div', { class: 'figura-pe rx-hist-pe' }, linhaFonte);

  const tab = botaoTabela({
    grafico: [legenda, plot],
    lugar: lugarTabela,
    criar: () => tabela(
      [{ rotulo: t('tab_faixa') }, { rotulo: t('tab_2019'), num: true }, { rotulo: t('tab_2025'), num: true }],
      [...Array.from({ length: N_FAIXAS }, (_, i) => i), N_FAIXAS].map((i) => {
        const celula = (ano) => {
          const d = hd[ano];
          const c = i < N_FAIXAS ? d.faixas[i] : d.fora;
          return t('faixa_valor', { pct: pct1(c / d.n), n: fmt.num(c) });
        };
        return [rotuloFaixa(i), celula('2019'), celula('2025')];
      }),
      { legenda: t('tab_legenda', { lingua: nomeLingua(l) }) }),
  });
  pe.append(tab.botao);

  const figura = el('figure', { class: 'figura rx-figura' },
    el('figcaption', { class: 'rx-comp-cabeca' },
      el('h2', { class: 't-h2', id: 'rx-comp-titulo', text: t('comp_titulo') }),
      el('p', { class: 't-p', text: t('comp_sub', { n19: fmt.num(hd['2019'].n), n25: fmt.num(hd['2025'].n), lingua: nomeLingua(l) }) })),
    resumoSr, legenda, plot, lugarTabela, nota, pe);

  const sobre = [el('strong', { text: t('sobre_forte', { pct: fmt.pct(hd.comum, 0) }) }), t('sobre_resto')];
  const mediana = t('mediana', { m19: fmt.num(hd['2019'].mediana, 1), m25: fmt.num(hd['2025'].mediana, 1) });
  resumoSr.textContent = [t('hist_resumo', { lingua: nomeLingua(l) }),
    `${t('sobre_forte', { pct: fmt.pct(hd.comum, 0) })}${t('sobre_resto')}`, mediana,
    t('hist_seu', { valor: fmt.num(v, 1) }), frasesParcela(hd, v, 'parcela_isso')].join(' ');

  const grafico = histograma(plot, { hd, v, sobre, mediana, nota });
  limpezas.push(() => grafico.destruir());

  const botaoPar = el('button', {
    class: 'btn rx-par-botao', type: 'button', 'aria-expanded': String(estado.parecidos), 'aria-controls': 'rx-parecidos',
  }, el('span', { text: t('detector_botao') }), icone('abaixo', 'ic ic-p rx-seta'));
  botaoPar.addEventListener('click', () => {
    estado.parecidos = !estado.parecidos;
    botaoPar.setAttribute('aria-expanded', String(estado.parecidos));
    const secao = $('rx-parecidos');
    secao.hidden = !estado.parecidos;
    if (estado.parecidos) {
      const titulo = secao.querySelector('h2');
      if (titulo.getBoundingClientRect().top > innerHeight - 80) rolar(titulo, 'nearest');
    }
  });

  const aviso = el('aside', { class: 'aviso rx-detector', 'aria-labelledby': 'rx-det-titulo' },
    el('div', { class: 'rx-detector-cabeca' },
      el('svg', { class: 'ic ic-g', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d: 'M12 3.5l9 16H3zM12 10v4M12 17v.5' })),
      el('h2', { class: 't-h3', id: 'rx-det-titulo', text: t('detector_titulo') })),
    el('p', { class: 't-texto rx-detector-texto', text: t('detector_texto') }),
    botaoPar);

  return el('section', { class: 'pagina rx-comp', 'aria-labelledby': 'rx-comp-titulo' },
    el('div', { class: 'rx-comp-grade' }, figura, aviso));
}

// O histograma: SVG na largura real da caixa, rótulos em HTML por cima, uma parada de Tab com as
// faixas (setas, Home e End), dica com mouse, foco e toque.
function histograma(plot, { hd, v, sobre, mediana, nota }) {
  const p19 = hd['2019'].parcelas;
  const p25 = hd['2025'].parcelas;
  let geo = null;
  let ativo = null;
  let foco = Math.min(N_FAIXAS - 1, Math.floor(v / PASSO + 1e-9));
  let larguraDesenhada = 0;
  let mouseDentro = false;
  let dispensado = null;     // faixa cuja dica o Esc fechou: o mouse parado nela não a reabre
  let ignorarFoco = false;   // o foco volta à faixa sem reabrir a dica
  const r1 = (n) => Math.round(n * 10) / 10;
  const dica = criarDica(plot, {
    fixaNoCelular: true,
    // O cartão do celular fechou com o foco nele: o foco volta à faixa, que fica marcada.
    aoFechar: ({ devolverFoco } = {}) => {
      const botao = ativo != null && geo?.botoes?.[ativo];
      if (!devolverFoco || !botao) { limparFoco(); return; }
      foco = ativo;
      geo.botoes.forEach((b, k) => b.setAttribute('tabindex', k === foco ? '0' : '-1'));
      ignorarFoco = true;
      botao.focus();
      ignorarFoco = false;
    },
    // Com o foco numa faixa, a marca da faixa fica (é o indicador de foco); com o mouse, some.
    aoEsc: () => {
      if (plot.contains(document.activeElement)) return;
      dispensado = ativo;
      limparFoco();
    },
  });

  function desenhar() {
    const W = Math.round(plot.clientWidth);
    if (!W) return;
    larguraDesenhada = W;
    const compacto = W < 560;
    const L = compacto ? 36 : 48;
    const R = compacto ? 8 : 16;
    const X = escalaLinear([0, TOPO], [L, W - R]);
    const xv = r1(X(Math.min(v, TOPO)));

    // Rótulos da faixa de cima: "seu texto" ao lado da linha e, se couber, a nota da sobreposição.
    const rotSeu = el('span', { class: 'plot-rot rx-seu-rot' },
      el('strong', { text: t(v > TOPO ? 'seu_texto_fora' : 'seu_texto', { valor: fmt.num(v, 1), max: fmt.num(TOPO) }) }),
      !compacto && el('span', { class: 'rx-seu-nota', text: frasesParcela(hd, v, 'parcela_isso') }));
    const rotSobre = el('span', { class: 'plot-rot rx-sobre-rot' }, el('span', {}, ...sobre.map((n) => (n instanceof Node ? n.cloneNode(true) : n))), ' ', mediana);
    plot.replaceChildren(rotSeu);
    const larguraSeu = rotSeu.offsetWidth;
    const aDireita = xv + 8 + larguraSeu <= W - 4;
    const caixaSeu = aDireita ? [xv + 8, xv + 8 + larguraSeu] : [xv - 8 - larguraSeu, xv - 8];
    if (aDireita) rotSeu.style.left = `${xv + 8}px`;
    else rotSeu.style.right = `${W - xv + 8}px`;
    rotSeu.classList.toggle('rx-seu-esq', !aDireita);
    rotSeu.style.top = '0px';

    let sobreNaFaixa = false;
    if (!compacto) {
      const esquerda = [L, caixaSeu[0] - 24];
      const direita = [caixaSeu[1] + 24, W - R];
      const [ini, fim] = esquerda[1] - esquerda[0] >= direita[1] - direita[0] ? esquerda : direita;
      if (fim - ini >= 210) {
        const largura = Math.min(300, fim - ini);
        rotSobre.style.width = `${largura}px`;
        rotSobre.style.left = `${ini === L ? L : fim - largura}px`;
        rotSobre.style.top = '0px';
        plot.append(rotSobre);
        sobreNaFaixa = true;
      }
    }
    const alturaFaixa = Math.max(rotSeu.offsetHeight, sobreNaFaixa ? rotSobre.offsetHeight : 0);

    // Geometria vertical.
    const T = alturaFaixa + (compacto ? 26 : 34);
    const ph = compacto ? 170 : 220;
    const base = T + ph;
    const H = base + (compacto ? 40 : 46);
    const maximo = Math.max(...p19, ...p25);
    const marcasY = marcasBonitas(0, maximo, compacto ? 2 : 4);
    const Y = escalaLinear([0, marcasY[marcasY.length - 1]], [base, T]);
    const casasY = Math.max(0, marcasY.casas - 2);

    const degrau = (p) => {
      let d = `M${r1(X(0))} ${r1(base)}`;
      p.forEach((valor, i) => { d += ` L${r1(X(i * PASSO))} ${r1(Y(valor))} L${r1(X((i + 1) * PASSO))} ${r1(Y(valor))}`; });
      return d;
    };
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' },
      el('path', { class: 'lt-grade', d: marcasY.slice(1).map((m) => `M${L} ${r1(Y(m))} H${W - R}`).join(' ') }),
      el('g', { class: 'rx-foco' }),
      el('path', { class: 'rx-h19', d: `${degrau(p19)} L${r1(X(TOPO))} ${r1(base)} Z` }),
      el('path', { class: 'rx-h25', d: `${degrau(p25)} L${r1(X(TOPO))} ${r1(base)} Z` }),
      el('path', { class: 'rx-h25-linha', d: `${degrau(p25)} L${r1(X(TOPO))} ${r1(base)}` }),
      el('path', { class: 'lt-eixo', d: `M${L} ${r1(base)} H${W - R}` }),
      el('path', { class: 'rx-seu-linha', d: `M${xv} 2 V${r1(base)}` }));

    const rotulos = [];
    const passoX = compacto ? 4 : 2;
    for (let m = 0; m <= TOPO; m += passoX) rotulos.push(el('span', { class: 'plot-rot rot-x', style: { left: `${r1(X(m))}px`, top: `${r1(base)}px` }, text: fmt.num(m) }));
    for (const m of marcasY) rotulos.push(el('span', { class: 'plot-rot rot-y', style: { left: `${L}px`, top: `${r1(Y(m))}px` }, text: fmt.pct(m, casasY) }));
    rotulos.push(el('span', { class: 'plot-rot rx-eixo-y', style: { left: '0px', top: `${r1(T - 22)}px` }, text: t('eixo_y') }));
    rotulos.push(el('span', { class: 'plot-rot rx-eixo-x', style: { left: `${r1((L + W - R) / 2)}px`, top: `${r1(H - 14)}px` }, text: t('eixo_x') }));

    // Faixas para teclado, mouse e toque.
    const pw = W - R - L;
    const passo = pw / N_FAIXAS;
    const faixas = el('div', { class: 'rx-faixas', role: 'group', 'aria-label': t('bins_rotulo'), style: { left: `${L}px`, top: `${T}px`, width: `${pw}px`, height: `${ph}px` } });
    const botoes = Array.from({ length: N_FAIXAS }, (_, i) => el('button', {
      type: 'button', class: 'rx-faixa', tabindex: i === foco ? '0' : '-1', dataset: { i },
      style: { left: `${r1(passo * i)}px`, width: `${r1(passo)}px` },
      'aria-label': t('faixa_aria', { faixa: rotuloFaixa(i), p19: pct1(p19[i]), p25: pct1(p25[i]) }),
    }));
    faixas.append(...botoes);

    plot.replaceChildren(svg, ...rotulos, rotSeu, ...(sobreNaFaixa ? [rotSobre] : []), faixas);
    plot.style.height = `${H}px`;
    geo = { X, Y, T, base, L, passo, botoes };

    // Abaixo do gráfico: o que não coube nos rótulos.
    const partes = [];
    if (!sobreNaFaixa) partes.push(el('p', { class: 't-p' }, ...sobre.map((n) => (n instanceof Node ? n.cloneNode(true) : n)), ' ', mediana));
    if (compacto) partes.push(el('p', { class: 't-p', text: frasesParcela(hd, v, 'parcela_valor') }));
    nota.replaceChildren(...partes);
    nota.hidden = !partes.length;

    if (ativo != null) mostrarFaixa(ativo);
  }

  function limparFoco() {
    ativo = null;
    plot.querySelector('.rx-foco')?.replaceChildren();
  }

  function mostrarFaixa(i, moverFoco = false) {
    if (!geo) return;
    ativo = i;
    const { X, Y, T, base } = geo;
    const x0 = X(i * PASSO);
    const x1 = X((i + 1) * PASSO);
    plot.querySelector('.rx-foco')?.replaceChildren(el('rect', { class: 'rx-foco-faixa', x: r1(x0), y: r1(T), width: r1(x1 - x0), height: r1(base - T) }));
    const d19 = hd['2019'];
    const d25 = hd['2025'];
    const conteudo = conteudoDica({
      sub: t('faixa_dica', { faixa: rotuloFaixa(i) }),
      linhas: [
        { chave: 'base', texto: '2019', valor: t('faixa_valor', { pct: pct1(p19[i]), n: fmt.num(d19.faixas[i]) }) },
        { chave: 'exc', texto: '2025', valor: t('faixa_valor', { pct: pct1(p25[i]), n: fmt.num(d25.faixas[i]) }) },
      ],
    });
    dica.mostrar(conteudo, { x: (x0 + x1) / 2, y: Y(Math.max(p19[i], p25[i])), topo: T + 4 });
    if (moverFoco) {
      foco = i;
      geo.botoes.forEach((b, k) => b.setAttribute('tabindex', k === i ? '0' : '-1'));
      geo.botoes[i].focus();
    }
  }

  function esconder() {
    limparFoco();
    dica.esconder();
  }

  plot.addEventListener('pointermove', (evento) => {
    if (!geo || evento.pointerType === 'touch') return;
    const caixa = plot.querySelector('.rx-faixas');
    if (!caixa) return;
    const r = caixa.getBoundingClientRect();
    const x = evento.clientX - r.left;
    const y = evento.clientY - r.top;
    if (x < 0 || x > r.width || y < -8 || y > r.height + 8) {
      if (mouseDentro && !plot.contains(document.activeElement)) esconder();
      mouseDentro = false;
      return;
    }
    mouseDentro = true;
    const i = Math.max(0, Math.min(N_FAIXAS - 1, Math.floor(x / geo.passo)));
    if (i === dispensado) return;
    dispensado = null;
    if (i !== ativo) mostrarFaixa(i);
  });
  plot.addEventListener('pointerleave', (evento) => {
    if (evento.pointerType === 'touch') return;
    mouseDentro = false;
    dispensado = null;
    if (!plot.contains(document.activeElement)) esconder();
  });
  plot.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.rx-faixa');
    if (botao) mostrarFaixa(Number(botao.dataset.i));
  });
  plot.addEventListener('focusin', (evento) => {
    const botao = evento.target.closest('.rx-faixa');
    if (botao && !ignorarFoco) mostrarFaixa(Number(botao.dataset.i));
  });
  plot.addEventListener('focusout', (evento) => {
    if (plot.contains(evento.relatedTarget)) return;
    // No celular, a faixa continua marcada enquanto o cartão da dica está aberto.
    if (!mouseDentro && !(celular() && dica.aberta)) esconder();
  });
  // O Esc é de dica.js (aoEsc, acima): fecha a dica e deixa a marca da faixa com o foco.
  plot.addEventListener('keydown', (evento) => {
    const botao = evento.target.closest('.rx-faixa');
    if (!botao) return;
    const i = Number(botao.dataset.i);
    const destino = { ArrowLeft: i - 1, ArrowDown: i - 1, ArrowRight: i + 1, ArrowUp: i + 1, Home: 0, End: N_FAIXAS - 1 }[evento.key];
    if (destino == null) return;
    evento.preventDefault();
    mostrarFaixa(Math.max(0, Math.min(N_FAIXAS - 1, destino)), true);
  });

  const observador = new ResizeObserver(() => {
    const W = Math.round(plot.clientWidth);
    if (W && Math.abs(W - larguraDesenhada) > 1) requestAnimationFrame(desenhar);
  });
  observador.observe(plot);
  requestAnimationFrame(desenhar);

  return {
    destruir() {
      observador.disconnect();
      dica.destruir();
    },
  };
}

// ---------- Resumos de 2019 a 2021 com marca parecida ----------
function escolherParecidos(l, v) {
  const lista = estado.dados.parecidos[l];            // do maior por100 para o menor
  const acima = lista.filter((p) => p.por100 >= v);
  if (acima.length >= 3) return { itens: acima.slice(-3), caso: 3 };
  if (acima.length) return { itens: acima, caso: acima.length };
  return { itens: lista.slice(0, 3), caso: 0 };
}

function desenharParecidos(r) {
  const l = r.lingua;
  const { itens, caso } = escolherParecidos(l, r.por100);
  const lista = el('div', { class: `rx-par-lista${estado.terceiro ? ' rx-todos' : ''}` }, itens.map((p) => {
    const areas = (p.areas || []).map(nomeArea).join(', ');
    const titulo = p.titulo || p.revista;
    return el('article', { class: 'rx-par', tabindex: '-1' },
      el('div', { class: 'rx-par-meta' },
        el('p', { class: 'rx-par-nota' },
          el('span', { class: 'dado rx-par-valor', text: fmt.num(p.por100, 1) }),
          el('span', { class: 't-legenda rx-par-unidade' },
            el('span', { class: 'rx-so-largo', text: t('par_marcas') }), el('span', { class: 'rx-so-celular', text: t('par_marcas_curto') }))),
        el('p', { class: 't-legenda rx-par-fonte' }, el('span', { text: `${p.revista} · ${p.ano}` }), areas && el('span', { class: 'rx-par-area', text: ` · ${areas}` })),
        el('a', {
          class: 't-legenda rx-par-link', href: `https://doi.org/${p.doi}`, rel: 'noopener noreferrer',
          'aria-label': t('par_artigo_aria', { ver: t('ver_artigo'), titulo }), text: t('ver_artigo'),
        })),
      el('p', { class: 'rx-par-texto', lang: langDe(l) }, ...realcar(p.texto, l, marcaEstatica(l))));
  }));
  const terceiro = itens.length >= 3 && el('button', {
    class: 'btn btn-fantasma rx-terceiro', type: 'button', hidden: estado.terceiro || null,
    on: {
      click: (evento) => {
        estado.terceiro = true;
        lista.classList.add('rx-todos');
        evento.currentTarget.hidden = true;
        lista.children[2]?.focus();
      },
    },
  }, t('par_terceiro'));
  return el('section', { class: 'pagina rx-parecidos', id: 'rx-parecidos', 'aria-labelledby': 'rx-par-titulo', hidden: !estado.parecidos || null },
    el('h2', { class: 'rx-par-titulo', id: 'rx-par-titulo', text: t(`par_titulo_${caso}`) }),
    lista, terceiro);
}

atualizarEntrada();
