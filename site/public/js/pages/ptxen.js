// IAês · O mesmo artigo em duas línguas.
// Hexágonos de 2019 e de outro ano (marcas a cada 100 palavras no resumo em português × no
// abstract em inglês), a linha do tempo da parcela de artigos com mais marcas no inglês, e os
// pares lado a lado com as palavras-marcadoras realçadas.
//
// Estado no endereço: ?ano=2025&area=todas&artigo=<id SciELO>. `ano` é o ano da lista de pares
// (o do artigo); `comparar` é o ano do gráfico e só aparece quando difere de `ano` (sem ele, o
// gráfico usa `ano`, ou 2025 quando `ano` é 2019); `diferenca=nao` desliga "Maior diferença
// primeiro". A área vale para a página toda: os dois seletores de área mostram o mesmo estado.
//
// Dados: pares/linha.json (linha do tempo e tabela), pares/<ano>.json (hexágonos e lista) e, só
// quando um par aparece na tela, pares/textos-<ano>.json e marcadoras.json. As marcas no texto
// seguem "Marcas num texto" de site/DADOS.md, a mesma conta dos arquivos.
import {
  el, icone, t, fmt, lingua, ANOS, AREAS, nomeArea, siglaLingua, lerUrl, gravarUrl, botaoCopiarLink,
  avisoLink, carregarEm, esqueleto, semMovimento, rota, escapar,
} from '../lib/base.js';
import { linhaTempo } from '../lib/grafico.js';
import { criarDica, conteudoDica } from '../lib/dica.js';
import { tabela, botaoTabela } from '../lib/tabela.js';
import { interruptor, seletorArea } from '../lib/filtros.js';

const ANO_BASE = 2019;
const ANO_PADRAO = 2025;
const ULTIMO = ANOS[ANOS.length - 1];
const I2022 = ANOS.indexOf(2022);
// Os dois eixos vão de 0 a 20 marcas a cada 100 palavras, em todo ano: quase todo artigo cabe, e
// os poucos que passam disso entram nas porcentagens e numa nota abaixo do gráfico.
const EIXO_MAX = 20;
const MARCAS_EIXO = [0, 5, 10, 15, 20];
const RAIO = 0.5;                       // raio do hexágono, em marcas a cada 100 palavras
const DX = Math.sqrt(3) * RAIO;
const DY = 1.5 * RAIO;
const VB = { W: 480, H: 470, x0: 56, y0: 16, lado: 400 };
const ESCALA = VB.lado / EIXO_MAX;
const RE_MARCA = /[a-zà-öø-ÿ]{4,}/g;

const $ = (id) => document.getElementById(id);
const celular = matchMedia('(max-width: 599px)');
const langDe = (l) => (l === 'en' ? 'en' : l === 'pt' ? 'pt-BR' : l);
const r1 = (n) => Math.round(n * 10) / 10;
const pct0 = (v) => (v == null ? t('sem_dado') : fmt.pct(v, 0));

const caixas = {
  acoes: $('ptx-acoes'), aviso: $('ptx-aviso'), filtros: $('ptx-filtros'), acaoTabela: $('ptx-acao-tabela'),
  acaoTabelaCelular: $('ptx-acao-tabela-celular'), destaque: $('ptx-destaque'), hex: $('ptx-hex'),
  hexBase: $('ptx-hex-base'), hexAno: $('ptx-hex-ano'), fora: $('ptx-fora'), poucos: $('ptx-poucos'),
  linha: $('ptx-linha'), leitura: $('ptx-leitura'), filtrosPares: $('ptx-filtros-pares'),
  sortear: $('ptx-sortear'), lista: $('ptx-lista'), par: $('ptx-par'), vivo: $('ptx-vivo'),
};

const estado = {
  comparar: ANO_PADRAO, ano: ANO_PADRAO, area: 'todas', artigo: null, diferenca: true, visiveis: 0,
  textosPedidos: false,
};
const anos = new Map();      // ano → artigos (pares/<ano>.json)
let linhaDados = null;       // pares/linha.json
let grafLinha = null;
let botaoTab = null;
const filtros = {};
const hexEstado = new Map(); // figura → { dica }
let versaoPar = 0;

const anunciar = (texto) => { caixas.vivo.textContent = texto; };
const passoLista = () => (celular.matches ? 2 : 6);
const passoMais = () => (celular.matches ? 5 : 6);

// ---------- Endereço ----------
const compararPadrao = (ano) => (ano !== ANO_BASE ? ano : ANO_PADRAO);
function gravar() {
  gravarUrl({
    ano: estado.ano, area: estado.area, artigo: estado.artigo, comparar: estado.comparar,
    diferenca: estado.diferenca ? null : 'nao',
  }, { ano: ANO_PADRAO, area: 'todas', comparar: compararPadrao(estado.ano) });
}

// ---------- Artigos ----------
const daArea = (a) => estado.area === 'todas' || a.areas.includes(estado.area);
const acima = (a) => a.en.por100 > a.pt.por100;
const abaixo = (a) => a.pt.por100 > a.en.por100;

// Os títulos já chegam limpos e em caixa de frase (clean_title, em site/DADOS.md).
function tituloDe(a) {
  const texto = lingua === 'en' && a.titulo_en ? a.titulo_en : a.titulo;
  const lang = texto === a.titulo_en ? 'en' : langDe(a.lingua);
  return { texto: texto || a.titulo_en || a.id, lang };
}
const areasDe = (a) => a.areas.map((s) => nomeArea(s)).join(', ');

// ---------- Hexágonos ----------
/** Hexágono (pontudo em cima, linhas deslocadas) mais perto de (x, y), como o d3-hexbin. */
function hexDe(x, y) {
  const py = y / DY;
  let pj = Math.round(py);
  const px = x / DX - (pj & 1) / 2;
  let pi = Math.round(px);
  const py1 = py - pj;
  if (Math.abs(py1) * 3 > 1) {
    const px1 = px - pi;
    const pi2 = pi + (px < pi ? -1 : 1) / 2;
    const pj2 = pj + (py < pj ? -1 : 1);
    const px2 = px - pi2;
    const py2 = py - pj2;
    if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) {
      pi = pi2 + (pj & 1 ? 1 : -1) / 2;
      pj = pj2;
    }
  }
  return { chave: `${pi},${pj}`, cx: (pi + (pj & 1) / 2) * DX, cy: pj * DY };
}

function agrupar(artigos) {
  const bins = new Map();
  let fora = 0;
  for (const a of artigos) {
    const x = a.pt.por100;
    const y = a.en.por100;
    if (x > EIXO_MAX || y > EIXO_MAX) { fora += 1; continue; }
    const h = hexDe(x, y);
    let b = bins.get(h.chave);
    if (!b) { b = { ...h, n: 0, en: 0, pt: 0 }; bins.set(h.chave, b); }
    b.n += 1;
    if (y > x) b.en += 1;
    else if (x > y) b.pt += 1;
  }
  return { bins, fora };
}
// O lado vem do centro do hexágono; no centro exato da diagonal, decide a maioria.
const ladoDe = (b) => (b.cy > b.cx ? 'en' : b.cy < b.cx ? 'pt' : b.en > b.pt ? 'en' : 'pt');
const nivelDe = (n) => (n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : 4);
const px = (v) => VB.x0 + v * ESCALA;
const py = (v) => VB.y0 + VB.lado - v * ESCALA;

function caminhoHex(b, encolher = 0.7) {
  const cx = px(b.cx);
  const cy = py(b.cy);
  const r = RAIO * ESCALA - encolher;
  let d = '';
  for (let i = 0; i < 6; i += 1) {
    const ang = (Math.PI / 180) * (60 * i - 90);
    d += `${i ? 'L' : 'M'}${r1(cx + r * Math.cos(ang))} ${r1(cy + r * Math.sin(ang))}`;
  }
  return `${d}Z`;
}

function rotulo(classe, texto, pos, extra = {}) {
  return el('span', { class: `plot-rot ${classe}`, style: { left: `${pos[0]}%`, top: `${pos[1]}%` }, ...extra }, texto);
}
const pctX = (v) => r1((v / VB.W) * 1000) / 10;
const pctY = (v) => r1((v / VB.H) * 1000) / 10;

/** Desenha uma figura de hexágonos. Devolve { n, en, pt, fora }. */
function desenharHex(fig, ano, todos) {
  const artigos = todos.filter(daArea);
  const n = artigos.length;
  const en = artigos.filter(acima).length;
  const pt = artigos.filter(abaixo).length;
  const { bins, fora } = agrupar(artigos);
  hexEstado.get(fig)?.dica.destruir();

  const anoEl = el('p', { class: 'ptx-hex-ano num' }, String(ano),
    ano === ULTIMO ? el('span', { class: 't-legenda ptx-hex-parcial', text: t('parcial') }) : null);
  const acimaEl = el('p', { class: 'ptx-hex-acima' },
    el('span', { class: 'num ptx-hex-pct', text: n ? pct0(en / n) : t('sem_dado') }),
    el('span', { class: 't-legenda ptx-so-largo', text: t('acima', { n: fmt.num(n) }) }),
    el('span', { class: 't-legenda ptx-so-celular', text: t('acima_curto') }));
  const cabeca = el('figcaption', { class: 'ptx-hex-cabeca' }, anoEl, acimaEl);

  const grade = MARCAS_EIXO.filter((v) => v > 0)
    .map((v) => `M${px(v)} ${VB.y0} V${VB.y0 + VB.lado} M${VB.x0} ${py(v)} H${VB.x0 + VB.lado}`).join(' ');
  const grupos = {};
  for (const l of ['pt', 'en']) for (let k = 1; k <= 4; k += 1) grupos[`${l}-${k}`] = '';
  for (const b of bins.values()) grupos[`${ladoDe(b)}-${nivelDe(b.n)}`] += caminhoHex(b);
  // Os hexágonos ficam dentro do quadro: o de um artigo com 0 marcas não passa do eixo.
  const quadro = `ptx-quadro-${ano}`;
  const foco = el('path', { class: 'ptx-hex-foco', d: '', 'clip-path': `url(#${quadro})` });
  const svg = el('svg', {
    viewBox: `0 0 ${VB.W} ${VB.H}`, role: 'img', focusable: 'false',
    'aria-label': t('hex_resumo', { ano: String(ano), n: fmt.num(n), en: fmt.num(en), pt: fmt.num(pt) }),
  },
  el('defs', {}, el('clipPath', { id: quadro }, el('rect', { x: VB.x0, y: VB.y0, width: VB.lado, height: VB.lado }))),
  el('path', { class: 'ptx-hex-grade', d: grade }),
  el('g', { 'clip-path': `url(#${quadro})` },
    Object.entries(grupos).filter(([, d]) => d).map(([k, d]) => el('path', { class: `ptx-h-${k}`, d }))),
  el('path', { class: 'ptx-hex-eixo', d: `M${VB.x0} ${VB.y0} V${VB.y0 + VB.lado} H${VB.x0 + VB.lado}` }),
  el('path', { class: 'ptx-hex-diag', d: `M${VB.x0} ${VB.y0 + VB.lado} L${VB.x0 + VB.lado} ${VB.y0}` }),
  foco);

  const rotulos = [
    // No celular ficam só 0, 10 e 20 (três marcas por eixo, como no design).
    ...MARCAS_EIXO.map((v) => rotulo(`rot-x${v % 10 ? ' ptx-rot-meio' : ''}`, fmt.num(v), [pctX(px(v)), pctY(VB.y0 + VB.lado)])),
    ...MARCAS_EIXO.map((v) => rotulo(`rot-y${v % 10 ? ' ptx-rot-meio' : ''}`, fmt.num(v), [pctX(VB.x0), pctY(py(v))])),
    rotulo('ptx-canto ptx-canto-en', [el('span', { class: 'ptx-so-largo', text: t('canto_en') }), el('span', { class: 'ptx-so-celular', text: t('canto_en_curto') })], [16, 6], { 'aria-hidden': 'true' }),
    rotulo('ptx-canto ptx-canto-pt', [el('span', { class: 'ptx-so-largo', text: t('canto_pt') }), el('span', { class: 'ptx-so-celular', text: t('canto_pt_curto') })], [94, 80], { 'aria-hidden': 'true' }),
    rotulo('ptx-diag-rot', t('diagonal'), [79, 15], { 'aria-hidden': 'true' }),
    rotulo('ptx-eixo-x', [el('span', { class: 'ptx-so-largo', text: t('eixo_x') }), el('span', { class: 'ptx-so-celular', text: t('eixo_x_curto') })], [53, 95.5], { 'aria-hidden': 'true' }),
    rotulo('ptx-eixo-y', t('eixo_y'), [0, 47], { 'aria-hidden': 'true' }),
  ];
  const plot = el('div', { class: 'plot ptx-hex-plot' }, svg, ...rotulos);
  fig.classList.remove('esmaecido');
  fig.replaceChildren(cabeca, plot);

  // Dica: quantos artigos há no hexágono sob o mouse (ou o toque).
  let atual = null;
  const limpar = () => { atual = null; foco.setAttribute('d', ''); };
  const dica = criarDica(plot, { aoFechar: limpar, aoEsc: limpar });
  hexEstado.set(fig, { dica });
  const binNoPonto = (evento) => {
    const r = svg.getBoundingClientRect();
    const k = r.width / VB.W;
    const x = ((evento.clientX - r.left) / k - VB.x0) / ESCALA;
    const y = (VB.y0 + VB.lado - (evento.clientY - r.top) / k) / ESCALA;
    if (x < 0 || y < 0 || x > EIXO_MAX || y > EIXO_MAX) return null;
    return bins.get(hexDe(x, y).chave) || null;
  };
  const mostrar = (b) => {
    const k = svg.getBoundingClientRect().width / VB.W;
    foco.setAttribute('d', caminhoHex(b, -0.5));
    const lado = ladoDe(b);
    dica.mostrar(conteudoDica({
      sub: `${ano} · ${t(lado === 'en' ? 'leg_en' : 'leg_pt')}`,
      valor: b.n === 1 ? t('hex_dica_n_1') : t('hex_dica_n', { n: fmt.num(b.n) }),
      leitura: t('hex_dica_leitura', { pt: fmt.num(b.cx, 1), en: fmt.num(b.cy, 1) }),
    }), { x: px(b.cx) * k, y: py(b.cy) * k });
  };
  const esconder = () => { foco.setAttribute('d', ''); dica.esconder(); };
  plot.addEventListener('pointermove', (evento) => {
    if (evento.pointerType === 'touch') return;
    const b = binNoPonto(evento);
    if (b === atual) return;
    atual = b;
    if (b) mostrar(b); else esconder();
  });
  plot.addEventListener('pointerleave', (evento) => {
    if (evento.pointerType === 'touch') return;
    atual = null;
    esconder();
  });
  plot.addEventListener('pointerdown', (evento) => {
    if (evento.pointerType === 'mouse') return;
    const b = binNoPonto(evento);
    if (b) mostrar(b); else esconder();
  });
  return { n, en, pt, fora };
}

const resultadosHex = { base: null, ano: null };

function desenharHexs() {
  const base = anos.get(ANO_BASE);
  const outro = anos.get(estado.comparar);
  if (base) resultadosHex.base = desenharHex(caixas.hexBase, ANO_BASE, base);
  if (outro) resultadosHex.ano = desenharHex(caixas.hexAno, estado.comparar, outro);
  notasHex();
}

function notasHex() {
  const { base, ano } = resultadosHex;
  // Fora do quadro.
  const itens = [];
  if (base?.fora) itens.push(base.fora === 1 ? t('fora_item_1', { ano: ANO_BASE }) : t('fora_item', { n: fmt.num(base.fora), ano: ANO_BASE }));
  if (ano?.fora) itens.push(ano.fora === 1 ? t('fora_item_1', { ano: estado.comparar }) : t('fora_item', { n: fmt.num(ano.fora), ano: estado.comparar }));
  caixas.fora.hidden = !itens.length;
  caixas.fora.textContent = itens.length ? t('fora', { max: fmt.num(EIXO_MAX), lista: itens.join(t('fora_e')) }) : '';
  // Área com poucos artigos.
  const poucos = estado.area !== 'todas' && base && ano && Math.min(base.n, ano.n) < 100;
  caixas.poucos.hidden = !poucos;
  caixas.poucos.textContent = poucos ? t('poucos', { area: nomeArea(estado.area), n1: fmt.num(base.n), n2: fmt.num(ano.n), ano: estado.comparar }) : '';
  // O número em destaque do celular.
  if (base && ano && base.n && ano.n) {
    caixas.destaque.hidden = false;
    caixas.destaque.replaceChildren(
      el('p', { class: 't-numero num ptx-destaque-num', text: pct0(ano.en / ano.n) }),
      el('p', { class: 't-p ptx-destaque-texto', text: t('destaque', { ano: estado.comparar, v2019: pct0(base.en / base.n) }) }));
  } else {
    caixas.destaque.hidden = true;
  }
}

async function carregarHex(fig, ano, suave) {
  const d = await carregarEm(fig, `pares/${ano}.json`, { altura: alturaHex(), semEsqueleto: suave });
  anos.set(ano, d.artigos);
  return d.artigos;
}
const alturaHex = () => (celular.matches ? 400 : 560);

async function carregarHexBase() {
  await carregarHex(caixas.hexBase, ANO_BASE, false);
  desenharHexs();
}
async function carregarHexAno(suave = false) {
  const ano = estado.comparar;
  await carregarHex(caixas.hexAno, ano, suave && caixas.hexAno.querySelector('svg'));
  if (ano !== estado.comparar) return;
  desenharHexs();
  desenharLinha();
}

// ---------- Linha do tempo ----------
function serieLinha() {
  if (!linhaDados) return null;
  return estado.area === 'todas' ? linhaDados : linhaDados.areas?.[estado.area] || null;
}
const contagemLinha = (s, i) => {
  const n = s.artigos[i];
  const en = s.en_maior[i] == null ? null : Math.round(s.en_maior[i] * n);
  const pt = s.pt_maior[i] == null ? null : Math.round(s.pt_maior[i] * n);
  return { n, en, pt, empates: en == null || pt == null ? null : n - en - pt };
};

function dicaLinha(info, s) {
  const i = info.i;
  const v = s.en_maior[i];
  const c = contagemLinha(s, i);
  const leitura = c.en == null ? null
    : `${t('linha_dica_leitura', { en: fmt.num(c.en), n: fmt.num(c.n), pt: fmt.num(c.pt) })}${c.empates ? ` ${t('linha_dica_empates', { e: fmt.num(c.empates) })}` : ''}`;
  return conteudoDica({
    chave: 'base', sub: info.parcial ? t('parcial_ate') : String(info.ano),
    valor: v == null ? t('sem_dado') : t('dica_valor_par', { valor: fmt.pct(v, 1) }), leitura,
  });
}

function faixaAntes(s) {
  const antes = s.en_maior.slice(0, I2022 + 1).filter((v) => v != null);
  if (!antes.length) return null;
  return { min: Math.min(...antes), max: Math.max(...antes) };
}

function desenharLinha() {
  const s = serieLinha();
  if (!s) return;
  const opcoes = {
    series: [{ palavra: t('linha_serie'), lingua: 'par', obs: s.en_maior, esp: null, cor: 'var(--tinta-2)', chave: 'base' }],
    esperado: false, altura: celular.matches ? 200 : 230, formatoValor: (v) => fmt.pct(v, 1),
    titulo: t('linha_titulo'), dica: (info) => dicaLinha(info, s),
    resumo: () => {
      const f = faixaAntes(s);
      const i = ANOS.indexOf(estado.comparar);
      return f ? t('linha_resumo', { min: pct0(f.min), max: pct0(f.max), ano: estado.comparar, valor: pct0(s.en_maior[i]) }) : '';
    },
  };
  if (!grafLinha) {
    caixas.linha.replaceChildren();
    grafLinha = linhaTempo(caixas.linha, opcoes);
  } else {
    grafLinha.atualizar(opcoes);
  }
  desenharLeitura();
  botaoTab?.atualizar();
}

function desenharLeitura() {
  const s = serieLinha();
  if (!s) { caixas.leitura.replaceChildren(); return; }
  const f = faixaAntes(s);
  const v = s.en_maior[ANOS.indexOf(estado.comparar)];
  const dadosTexto = { min: pct0(f?.min), max: pct0(f?.max), ano: estado.comparar, valor: pct0(v), area: nomeArea(estado.area) };
  caixas.leitura.replaceChildren(
    f ? el('p', { class: 't-texto ptx-leitura-1', text: t(estado.area === 'todas' ? 'leitura' : 'leitura_area', dadosTexto) }) : null,
    el('p', { class: 't-p ptx-leitura-2' }, t('leitura_teste'), ' ',
      el('a', { href: `${rota('metodo')}#mesmo-artigo`, text: t('leitura_link') }), '.'));
}

async function carregarLinha() {
  linhaDados = await carregarEm(caixas.linha, 'pares/linha.json', { altura: celular.matches ? 200 : 230 });
  desenharLinha();
}

// ---------- Tabela (Ver como tabela) ----------
function tabelaAnos() {
  const s = serieLinha();
  if (!s) return esqueleto(320);
  const pc = (v) => (v == null ? '' : ` (${fmt.pct(v, 1)})`);
  const linhas = ANOS.map((ano, i) => {
    const c = contagemLinha(s, i);
    const anoCel = ano === ULTIMO ? el('span', {}, String(ano), ' ', el('span', { class: 'etq-nota', text: t('parcial') })) : String(ano);
    if (!c.n) return [anoCel, fmt.num(c.n || 0), t('sem_dado'), t('sem_dado'), '', '', ''];
    return [anoCel, fmt.num(c.n), `${fmt.num(c.en)}${pc(s.en_maior[i])}`, `${fmt.num(c.pt)}${pc(s.pt_maior[i])}`,
      fmt.num(c.empates), s.media_pt[i] == null ? t('sem_dado') : fmt.num(s.media_pt[i], 2),
      s.media_en[i] == null ? t('sem_dado') : fmt.num(s.media_en[i], 2)];
  });
  return el('div', { class: 'ptx-tabela' },
    tabela([
      { rotulo: t('tabela_ano') },
      { rotulo: t('col_artigos'), num: true },
      { rotulo: t('col_en'), curto: t('col_en_curto'), num: true },
      { rotulo: t('col_pt'), curto: t('col_pt_curto'), num: true },
      { rotulo: t('col_empates'), num: true },
      { rotulo: t('col_media_pt'), curto: t('col_media_pt_curto'), num: true },
      { rotulo: t('col_media_en'), curto: t('col_media_en_curto'), num: true },
    ], linhas, { legenda: `${t('tab_legenda')}${estado.area === 'todas' ? '' : `. ${nomeArea(estado.area)}`}`, classe: 'ptx-tabela-caixa' }),
    el('p', { class: 't-legenda', text: t('tab_nota') }));
}

// ---------- Lista de pares ----------
function filtrados() {
  const todos = anos.get(estado.ano) || [];
  const lista = todos.filter(daArea);
  if (estado.diferenca) {
    const dif = (a) => Math.abs(a.en.por100 - a.pt.por100);
    lista.sort((a, b) => dif(b) - dif(a) || (a.id < b.id ? -1 : 1));
  }
  return lista;
}

function artigoAtual(lista = filtrados()) {
  if (estado.artigo) {
    const a = lista.find((x) => x.id === estado.artigo);
    if (a) return a;
  }
  return lista[0] || null;
}

function barras(a) {
  const largura = (v) => `${Math.min(100, (100 * v) / EIXO_MAX)}%`;
  return el('span', { class: 'ptx-item-barras', 'aria-hidden': 'true' },
    el('span', { class: 'ptx-item-sigla', text: siglaLingua('pt') }),
    el('span', { class: 'ptx-item-trilho' }, el('span', { class: 'ptx-item-barra ptx-item-barra-pt', style: { width: largura(a.pt.por100) } })),
    el('span', { class: 'dado ptx-item-valor', text: fmt.num(a.pt.por100, 1) }),
    el('span', { class: 'ptx-item-sigla', text: siglaLingua('en') }),
    el('span', { class: 'ptx-item-trilho' }, el('span', { class: 'ptx-item-barra ptx-item-barra-en', style: { width: largura(a.en.por100) } })),
    el('span', { class: 'dado ptx-item-valor', text: fmt.num(a.en.por100, 1) }));
}

function itemLista(a, atual) {
  const tit = tituloDe(a);
  const valores = `${siglaLingua('pt')} ${fmt.num(a.pt.por100, 1)} · ${siglaLingua('en')} ${fmt.num(a.en.por100, 1)}`;
  return el('li', {}, el('button', {
    type: 'button', class: 'ptx-item', 'aria-current': atual ? 'true' : null, dataset: { id: a.id },
    on: { click: () => selecionar(a.id, { origem: 'lista' }) },
  },
  el('span', { class: 'ptx-item-titulo', lang: tit.lang, text: tit.texto }),
  el('span', { class: 't-legenda ptx-item-meta ptx-so-largo', text: `${a.revista} · ${estado.ano} · ${areasDe(a)}` }),
  el('span', { class: 't-legenda num ptx-item-meta ptx-so-celular' }, `${estado.ano} · ${areasDe(a)}`, el('span', { 'aria-hidden': 'true', text: ` · ${valores}` })),
  barras(a),
  el('span', { class: 'sr', text: `${valores}.` })));
}

function desenharLista(focarNovo = -1) {
  if (!anos.has(estado.ano)) return;
  const lista = filtrados();
  const atual = artigoAtual(lista);
  if (!lista.length) {
    caixas.lista.replaceChildren(el('div', { class: 'estado-vazio', text: t('lista_vazia', { area: nomeArea(estado.area), ano: estado.ano }) }));
    return;
  }
  const mostrar = lista.slice(0, Math.max(estado.visiveis, passoLista()));
  const ol = el('ol', { class: 'ptx-lista', 'aria-label': t('lista_rotulo', { ano: estado.ano }) },
    mostrar.map((a) => itemLista(a, a === atual)));
  const resta = lista.length - mostrar.length;
  const pe = el('div', { class: 'ptx-lista-pe' },
    resta > 0 ? el('button', {
      type: 'button', class: 'btn btn-fantasma ptx-mais',
      on: { click: () => { const antes = mostrar.length; estado.visiveis = antes + passoMais(); desenharLista(antes); } },
    }, t('ver_mais'), el('span', { class: 't-legenda num ptx-mais-n', text: t('mostrando', { n: fmt.num(mostrar.length), total: fmt.num(lista.length) }) })) : null,
    el('p', { class: 't-legenda ptx-lista-nota', text: estado.area === 'todas'
      ? t('lista_pe', { n: fmt.num(lista.length), ano: estado.ano })
      : t('lista_pe_area', { n: fmt.num(lista.length), ano: estado.ano, area: nomeArea(estado.area) }) }));
  caixas.lista.classList.remove('esmaecido');
  caixas.lista.replaceChildren(ol, pe);
  if (focarNovo >= 0) ol.querySelectorAll('.ptx-item')[focarNovo]?.focus();
}

function marcarAtual() {
  const atual = artigoAtual();
  for (const b of caixas.lista.querySelectorAll('.ptx-item')) {
    if (b.dataset.id === atual?.id) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  }
}

async function carregarLista() {
  const ano = estado.ano;
  const suave = Boolean(caixas.lista.querySelector('.ptx-lista'));
  const d = await carregarEm(caixas.lista, `pares/${ano}.json`, {
    altura: celular.matches ? 240 : 640, semEsqueleto: suave, erroTitulo: t('erro_titulo_parte'),
  });
  anos.set(ano, d.artigos);
  if (ano !== estado.ano) return;
  desenharLista();
  desenharPar();
}

function selecionar(id, { origem } = {}) {
  estado.artigo = id;
  gravar();
  marcarAtual();
  estado.textosPedidos = true;
  const cartao = desenharPar();
  const a = artigoAtual();
  if (!a || !cartao) return;
  anunciar(t(origem === 'sortear' ? 'sorteado' : 'aberto', { titulo: tituloDe(a).texto }));
  const titulo = cartao.querySelector('.ptx-par-titulo');
  if (origem === 'sortear' || celular.matches) {
    titulo.focus({ preventScroll: true });
    cartao.scrollIntoView({ block: 'start', behavior: semMovimento() ? 'auto' : 'smooth' });
  } else if (cartao.getBoundingClientRect().top < 0) {
    cartao.scrollIntoView({ block: 'start', behavior: semMovimento() ? 'auto' : 'smooth' });
  }
}

function sortear() {
  const lista = filtrados();
  if (!lista.length) return;
  const atual = artigoAtual(lista);
  const outros = lista.length > 1 ? lista.filter((a) => a !== atual) : lista;
  selecionar(outros[Math.floor(Math.random() * outros.length)].id, { origem: 'sortear' });
}

// ---------- O par ----------
let observador = null;

function contagemTexto(c) {
  if (!c.marcas) return t('marcas_0');
  const por100 = fmt.num(c.por100, 1);
  return c.marcas === 1 ? t('marcas_1', { por100 }) : t('marcas_n', { n: fmt.num(c.marcas), por100 });
}

function desenharPar() {
  const lista = filtrados();
  const a = anos.has(estado.ano) ? artigoAtual(lista) : null;
  versaoPar += 1;
  if (!a) {
    caixas.par.replaceChildren(anos.has(estado.ano) ? el('div', { class: 'estado-vazio', text: t('lista_vazia', { area: nomeArea(estado.area), ano: estado.ano }) }) : esqueleto(480));
    return null;
  }
  const tit = tituloDe(a);
  const meta = el('p', { class: 't-legenda ptx-par-meta' },
    `${a.revista} · ${estado.ano} · ${areasDe(a)} · ${t(`escrito_${a.lingua}`)} · `,
    el('a', { href: `https://doi.org/${a.doi}`, rel: 'noopener noreferrer', class: 'ptx-par-link' }, t('ver_scielo'), icone('externo', 'ic ptx-ic-externo')));
  const colunas = el('div', { class: 'ptx-par-colunas' }, esqueleto(320));
  const legenda = el('div', { class: 'legenda ptx-par-legenda' },
    el('span', { text: t('realce_rotulo') }),
    [1, 2, 3, 4].map((k) => el('span', { class: `mk mk-${k} num`, text: t(`realce_${k}`) })));
  const cartao = el('article', { class: 'cartao ptx-par', 'aria-labelledby': 'ptx-par-titulo', dataset: { id: a.id } },
    el('div', { class: 'ptx-par-cabeca' },
      el('h3', { class: 'ptx-par-titulo', id: 'ptx-par-titulo', tabindex: '-1', lang: tit.lang, text: tit.texto }),
      meta),
    colunas, legenda);
  caixas.par.replaceChildren(cartao);
  if (estado.textosPedidos) carregarTextos(a, colunas, versaoPar);
  else esperarPar(a, colunas, versaoPar);
  return cartao;
}

// Os textos (2 MB por ano) só baixam quando o par chega perto da tela ou quando alguém o abre.
function esperarPar(a, colunas, versao) {
  observador?.disconnect();
  if (!('IntersectionObserver' in window)) { estado.textosPedidos = true; carregarTextos(a, colunas, versao); return; }
  observador = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    observador.disconnect();
    estado.textosPedidos = true;
    if (versao === versaoPar) carregarTextos(a, colunas, versao);
  }, { rootMargin: '400px 0px' });
  observador.observe(caixas.par);
}

async function carregarTextos(a, colunas, versao) {
  observador?.disconnect();
  const ano = estado.ano;
  const marcadoras = await carregarEm(colunas, 'marcadoras.json', { altura: 320, erroTitulo: t('erro_titulo_parte') });
  if (versao !== versaoPar) return;
  const textos = await carregarEm(colunas, `pares/textos-${ano}.json`, { altura: 320, erroTitulo: t('erro_titulo_parte') });
  if (versao !== versaoPar) return;
  const par = textos[a.id] || {};
  colunas.replaceChildren(
    coluna('pt', par.pt, a.pt, marcadoras.pt),
    coluna('en', par.en, a.en, marcadoras.en));
}

/** Texto com as marcadoras realçadas: a regra de "Marcas num texto" (DADOS.md). */
function realcar(texto, l, lista) {
  const s = texto.normalize('NFC');
  // Minúsculas com o mapa de posições, para realçar o trecho original.
  let baixo = '';
  const mapa = [];
  for (let i = 0; i < s.length;) {
    const ch = String.fromCodePoint(s.codePointAt(i));
    const lo = ch.toLowerCase();
    for (let k = 0; k < lo.length; k += 1) mapa.push(i);
    baixo += lo;
    i += ch.length;
  }
  mapa.push(s.length);
  const frag = document.createDocumentFragment();
  let pos = 0;
  let marcas = 0;
  for (const m of baixo.matchAll(RE_MARCA)) {
    if (!Object.hasOwn(lista, m[0])) continue;
    const ini = mapa[m.index];
    const fim = mapa[m.index + m[0].length];
    const [razao, nivel] = lista[m[0]];
    const palavra = s.slice(ini, fim);
    if (ini > pos) frag.append(s.slice(pos, ini));
    frag.append(el('button', {
      type: 'button', class: `mk mk-${nivel} ptx-mk`, 'aria-label': t('marca_aria', { palavra, razao: fmt.razao(razao) }),
      dataset: { palavra: `${m[0]}.${l}`, chaveTexto: m[0], razao, nivel, lingua: l },
    }, palavra));
    pos = fim;
    marcas += 1;
  }
  if (pos < s.length) frag.append(s.slice(pos));
  return { frag, marcas };
}

function coluna(l, texto, contagem, lista) {
  const topo = el('div', { class: `ptx-col-topo ptx-col-topo-${l}` },
    el('h4', { class: 'ptx-col-nome', text: t(l === 'pt' ? 'resumo_pt' : 'abstract_en') }),
    el('p', { class: 't-legenda num', text: contagemTexto(contagem) }));
  const caixa = el('div', { class: 'ptx-col-texto-caixa' });
  if (!texto) {
    caixa.append(el('p', { class: 't-p ptx-col-vazio', text: t('texto_sem') }));
  } else {
    const { frag } = realcar(texto, l, lista);
    caixa.append(el('p', { class: 't-texto ptx-col-texto', lang: langDe(l) }, frag));
  }
  return el('div', { class: `ptx-col ptx-col-${l}` }, topo, caixa);
}

// ---------- Dica das palavras no texto ----------
const dicasTexto = new WeakMap();   // caixa do texto → dica
let palavraAtiva = null;

function dicaDaCaixa(caixa) {
  if (!dicasTexto.has(caixa)) {
    dicasTexto.set(caixa, criarDica(caixa, {
      aoEsc: () => { palavraAtiva = null; },
      // Celular: o botão de fechar do cartão some, e o foco volta para a palavra.
      aoFechar: ({ devolverFoco } = {}) => {
        const botao = palavraAtiva;
        palavraAtiva = null;
        if (devolverFoco) botao?.focus({ preventScroll: true });
      },
    }));
  }
  return dicasTexto.get(caixa);
}

function conteudoPalavra(botao) {
  const { chaveTexto: palavra, lingua: l, razao, nivel } = botao.dataset;
  const frag = document.createDocumentFragment();
  frag.append(
    el('div', { class: 'dica-topo' },
      el('span', { class: `mk mk-${nivel} ptx-dica-palavra`, lang: langDe(l), text: palavra }),
      el('span', { text: `${siglaLingua(l)} · ${t('classe_estilo')}` })),
    el('p', { class: 'dica-valor', text: t('palavra_valor', { razao: fmt.razao(Number(razao)) }) }),
    el('p', { class: 'dica-leitura', text: t(celular.matches ? 'palavra_leitura_toque' : 'palavra_leitura') }));
  if (celular.matches) {
    frag.append(el('button', { type: 'button', class: 'btn btn-p ptx-dica-abrir', dataset: { palavra: botao.dataset.palavra } }, t('abrir_painel')));
  }
  return frag;
}

function mostrarPalavra(botao) {
  const caixa = botao.closest('.ptx-col-texto-caixa');
  if (!caixa) return;
  if (palavraAtiva && palavraAtiva !== botao) esconderPalavra();
  palavraAtiva = botao;
  const dica = dicaDaCaixa(caixa);
  dica.mostrar(conteudoPalavra(botao), { x: 0, topo: 0 });
  if (celular.matches) {
    // O cartão fica abaixo do texto; num resumo longo, ele pode estar fora da tela.
    const cartao = caixa.nextElementSibling;
    const r = cartao?.getBoundingClientRect();
    if (r && (r.bottom > innerHeight || r.top < 0)) cartao.scrollIntoView({ block: 'nearest', behavior: semMovimento() ? 'auto' : 'smooth' });
    return;
  }
  // dica.js põe a dica ao lado de um ponto; no texto ela fica acima da palavra, como no design.
  const flutuante = caixa.querySelector(':scope > .dica');
  if (!flutuante) return;
  const rc = caixa.getBoundingClientRect();
  const rb = botao.getBoundingClientRect();
  const w = flutuante.offsetWidth;
  const h = flutuante.offsetHeight;
  const minimo = 8 - rc.left;
  const maximo = document.documentElement.clientWidth - 8 - rc.left - w;
  const esquerda = Math.max(minimo, Math.min(rb.left - rc.left - 6, maximo));
  let topo = rb.top - rc.top - h - 10;
  if (rb.top - h - 10 < 8) topo = rb.bottom - rc.top + 10;
  flutuante.style.left = `${esquerda}px`;
  flutuante.style.top = `${topo}px`;
}

function esconderPalavra() {
  if (!palavraAtiva) return;
  const caixa = palavraAtiva.closest('.ptx-col-texto-caixa');
  palavraAtiva = null;
  if (caixa && dicasTexto.has(caixa)) dicasTexto.get(caixa).esconder();
}

caixas.par.addEventListener('pointerover', (evento) => {
  if (evento.pointerType !== 'mouse') return;
  const b = evento.target.closest('.ptx-mk');
  if (b) mostrarPalavra(b);
});
caixas.par.addEventListener('pointerout', (evento) => {
  if (evento.pointerType !== 'mouse') return;
  const b = evento.target.closest('.ptx-mk');
  if (b && !b.contains(evento.relatedTarget) && document.activeElement !== b) esconderPalavra();
});
caixas.par.addEventListener('focusin', (evento) => {
  const b = evento.target.closest('.ptx-mk');
  if (b && !celular.matches) mostrarPalavra(b);
});
caixas.par.addEventListener('focusout', (evento) => {
  const b = evento.target.closest('.ptx-mk');
  if (b && !celular.matches) esconderPalavra();
});
// No celular, o toque mostra o cartão com o excesso e o botão do painel; no resto, o clique abre
// o painel (cabecalho.js escuta [data-palavra] no documento).
caixas.par.addEventListener('click', (evento) => {
  const b = evento.target.closest('.ptx-mk');
  if (!b) return;
  if (celular.matches) {
    evento.stopPropagation();
    evento.preventDefault();
    mostrarPalavra(b);
  } else {
    esconderPalavra();
  }
});

// ---------- Controles ----------
function seletorAno({ rotulo, valor, anosOpcoes, aoMudar }) {
  // seletorArea com anos no lugar das áreas; o último ano leva "parcial".
  const s = seletorArea({
    valor: String(valor), rotulo, areas: anosOpcoes.map(String), comTodas: false,
    nome: (v) => (Number(v) === ULTIMO ? `${v} ${t('parcial')}` : v), aoMudar: (v) => aoMudar(Number(v)),
  });
  s.classList.add('ptx-seletor-ano');
  return s;
}

function mudarArea(area, origem) {
  estado.area = area;
  (origem === filtros.area ? filtros.areaPares : filtros.area).definir(area);
  const lista = anos.get(estado.ano)?.filter(daArea) || [];
  if (estado.artigo && !lista.some((a) => a.id === estado.artigo)) estado.artigo = null;
  estado.visiveis = 0;
  gravar();
  desenharHexs();
  desenharLinha();
  desenharLista();
  desenharPar();
}

function montarControles() {
  caixas.acoes.append(botaoCopiarLink('btn btn-p'));
  filtros.area = seletorArea({ valor: estado.area, aoMudar: (v) => mudarArea(v, filtros.area) });
  filtros.comparar = seletorAno({
    rotulo: t('comparar'), valor: estado.comparar, anosOpcoes: ANOS.filter((a) => a !== ANO_BASE),
    aoMudar: (v) => {
      estado.comparar = v;
      estado.ano = v;
      estado.artigo = null;
      estado.visiveis = 0;
      filtros.ano.definir(String(v));
      gravar();
      carregarHexAno(true);
      carregarLista();
    },
  });
  caixas.filtros.append(filtros.area, filtros.comparar);

  botaoTab = botaoTabela({ grafico: [caixas.hex, document.querySelector('.ptx-legenda')], criar: tabelaAnos });
  posicionarBotaoTabela();

  filtros.ano = seletorAno({
    rotulo: t('ano'), valor: estado.ano, anosOpcoes: ANOS,
    aoMudar: (v) => {
      estado.ano = v;
      estado.artigo = null;
      estado.visiveis = 0;
      gravar();
      carregarLista();
    },
  });
  filtros.areaPares = seletorArea({ valor: estado.area, aoMudar: (v) => mudarArea(v, filtros.areaPares) });
  filtros.areaPares.classList.add('ptx-seletor-area-pares');
  filtros.diferenca = interruptor({
    texto: t('maior_diferenca'), ligado: estado.diferenca,
    aoMudar: (v) => {
      estado.diferenca = v;
      estado.visiveis = 0;
      gravar();
      desenharLista();
      if (!estado.artigo) desenharPar();
    },
  });
  caixas.filtrosPares.append(filtros.ano, filtros.areaPares, filtros.diferenca);
  caixas.sortear.append(el('button', { type: 'button', class: 'btn ptx-sortear-botao', on: { click: sortear } }, icone('sortear', 'ic'), t('sortear')));

  celular.addEventListener('change', () => {
    posicionarBotaoTabela();
    desenharLista();
    if (grafLinha) desenharLinha();
  });
}

function posicionarBotaoTabela() {
  (celular.matches ? caixas.acaoTabelaCelular : caixas.acaoTabela).append(botaoTab.botao);
}

// ---------- Início ----------
function lerEstado() {
  const url = lerUrl();
  const problemas = [];
  const anoValido = (v) => ANOS.includes(Number(v)) && /^\d{4}$/.test(String(v));
  if (url.ano != null) {
    if (anoValido(url.ano)) estado.ano = Number(url.ano);
    else problemas.push(t('aviso_ano', { ano: escapar(url.ano) }));
  }
  estado.comparar = compararPadrao(estado.ano);
  if (url.comparar != null) {
    if (url.comparar === String(ANO_BASE)) problemas.push(t('aviso_comparar_base'));
    else if (anoValido(url.comparar)) estado.comparar = Number(url.comparar);
    else problemas.push(t('aviso_comparar', { ano: escapar(url.comparar) }));
  }
  if (url.area && url.area !== 'todas') {
    if (AREAS.includes(url.area)) estado.area = url.area;
    else problemas.push(t('aviso_area', { area: escapar(url.area) }));
  }
  // Os textos do artigo do link só baixam de saída se ele existir (iniciar confere).
  if (url.artigo) estado.artigo = url.artigo;
  estado.diferenca = url.diferenca !== 'nao';
  return problemas;
}

function mostrarAviso(problemas) {
  if (!problemas.length) return;
  // Cada problema já tem vírgula ("o ano 1999, que não está nos dados"): a lista separa com ponto e vírgula.
  const lista = problemas.length > 1
    ? `${problemas.slice(0, -1).join(t('aviso_sep'))}${t('aviso_e')}${problemas.at(-1)}`
    : problemas[0];
  caixas.aviso.replaceChildren(avisoLink(`${t('aviso_inicio')}${lista}${t('aviso_fim')}`));
}

async function iniciar() {
  const problemas = lerEstado();
  montarControles();
  caixas.par.replaceChildren(esqueleto(480));
  carregarHexBase();
  carregarHexAno();
  carregarLinha();
  await carregarLista();
  // O artigo do link precisa existir no ano e na área escolhidos. Se existe, os textos dele baixam
  // logo; se não, a página fica com o primeiro par, já desenhado, e os textos esperam a vez dele.
  if (estado.artigo) {
    if (filtrados().some((a) => a.id === estado.artigo)) {
      estado.textosPedidos = true;
      desenharPar();
    } else {
      const noAno = anos.get(estado.ano)?.some((a) => a.id === estado.artigo);
      problemas.push(noAno
        ? t('aviso_artigo_area', { id: escapar(estado.artigo), area: nomeArea(estado.area) })
        : t('aviso_artigo', { id: escapar(estado.artigo), ano: estado.ano }));
      estado.artigo = null;
    }
  }
  gravar();
  mostrarAviso(problemas);
}

iniciar();
