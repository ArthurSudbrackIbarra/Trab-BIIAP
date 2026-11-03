// IAês · Mapa de palavras (spec 4.3; design d-mapa, m-mapa, e-mapa-lado).
// Dispersão em canvas de todas as palavras de 2025 de uma língua e área (dados/mapa/<l>-<area>.json):
// X = parcela em 2021-22, Y = razão observado/esperado em 2025, os dois em log. Ao lado, a lista
// "Maiores excessos"; no modo lado a lado, PT e EN com os mesmos eixos e a tradução realçada no
// outro mapa (dados/mapa/pares.json).
// Estado no endereço: ?resumos=en&area=todas&rotulos=20&ordem=razao&achar=notably (padrões omitidos).
import {
  el, icone, t, fmt, lingua, AREAS, nomeArea, siglaLingua, lerUrl, gravarUrl, botaoCopiarLink, avisoLink, escapar,
  chave as fazerChave, carregarEm, dados, palavraBotao, rota,
} from '../lib/base.js';
import { escalaLog } from '../lib/grafico.js';
import { criarDica, conteudoDica } from '../lib/dica.js';
import { tabela, botaoTabela } from '../lib/tabela.js';
import { segmentos, seletorArea, filtroResumos } from '../lib/filtros.js';
import { criarBusca } from '../lib/busca.js';

const $ = (id) => document.getElementById(id);
const celular = matchMedia('(max-width: 599px)');
const largo = matchMedia('(min-width: 1200px)');
const semMouse = matchMedia('(pointer: coarse)');
const porToque = () => semMouse.matches || celular.matches;
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');
const outra = (l) => (l === 'pt' ? 'en' : 'pt');

// Corte de Kobak et al. pela razão: r > 2^(−log10(p)/4), com p a parcela em 2025 (DADOS.md). O eixo X
// do mapa é a parcela de 2021-22 (x); com p = r·x, o corte vira a reta r = x^(−1/K), K = 1 + 4/log10(2).
const K_CORTE = 1 + 4 / Math.log10(2);
const corteEm = (x) => x ** (-1 / K_CORTE);

const MIN_RESUMOS = 20;      // abaixo disso, a área não vira mapa
const POUCOS_RESUMOS = 100;  // abaixo disso, a nota avisa que as razões oscilam
const N_LISTA = 20;
const N_LISTA_CELULAR = 10;
const N_ROTULOS = { unico: 20, lado: 10, celular: 5 };
const EXEMPLO = { pt: 'generativa', en: 'chatgpt' };   // palavra de conteúdo citada na nota, se estiver no mapa
const PADRAO = { resumos: 'en', area: 'todas', rotulos: '20', ordem: 'razao' };
// Deslocamentos para rótulos com linha guia, do mais perto ao mais longe (o vertical pesa um pouco mais).
const DESLOCAMENTOS = (() => {
  const lista = [];
  for (let dx = -320; dx <= 320; dx += 12) {
    for (let dy = -170; dy <= 170; dy += 8) {
      const d = Math.hypot(dx, dy * 1.4);
      if (d >= 20) lista.push([dx, dy, d]);
    }
  }
  return lista.sort((a, b) => a[2] - b[2]);
})();
const ANEIS = [['traducao', 11, true], ['achada', 11, false], ['lista', 9, false], ['mouse', 9, false]];

const estado = { resumos: 'en', area: 'todas', rotulos: 20, ordem: 'razao', achar: null, zoom: null, verTodas: false, tabelaTodas: false, tabelaLimite: 0 };
const PAGINA_TABELA = 500;   // a tabela de todas as palavras cresce de 500 em 500 linhas
const caixas = {
  acoes: $('mapa-acoes'), aviso: $('mapa-aviso'), filtros: $('mapa-filtros'), acoesBarra: $('mapa-acoes-barra'),
  acharStatus: $('mapa-achar-status'), ladoIntro: $('mapa-lado-intro'), grade: $('mapa-grade'),
  graficos: $('mapa-graficos'), legenda: $('mapa-legenda'), notaCelular: $('mapa-nota-celular'),
  peAcoes: $('mapa-pe-acoes'), lista: $('mapa-lista'), ordem: $('mapa-ordem'), listaNota: $('mapa-lista-nota'),
  itens: $('mapa-itens'), verMais: $('mapa-ver-mais'), nota: $('mapa-nota'), recorte: $('mapa-recorte'), vivo: $('mapa-vivo'),
};

let mapas = [];
let chaveModo = '';
let pares = null;
let busca = null;
let botaoTab = null;
let botaoInteiro = null;
let botaoAproximar = null;
let botaoAfastar = null;
let extensaoTotal = null;
let pedido = 0;
const filtros = {};

const modoLado = () => estado.resumos === 'lado';
const anunciar = (texto) => { caixas.vivo.textContent = texto; };
const unidade = (l) => t(`mapa_unidade_${l}`);
const areaMin = () => (estado.area === 'todas' ? t('mapa_area_todas_min') : nomeArea(estado.area));

// ---------- Números e cores ----------
const nfs = new Map();
function numero(v, casas) {
  if (!nfs.has(casas)) nfs.set(casas, new Intl.NumberFormat(lingua === 'pt' ? 'pt-BR' : 'en', { maximumFractionDigits: casas }));
  return nfs.get(casas).format(v);
}
const rotuloX = (v) => {
  const pct = v * 100;
  return `${numero(pct, pct < 0.1 ? 3 : pct < 1 ? 2 : pct < 10 ? 1 : 0)}%`;
};
const rotuloY = (v) => `${numero(v, v < 1 ? 2 : 1)}×`;
/** Parcela com casas fixas para colunas: 0,014% / 2,46% / 12,40%. */
const pctColuna = (v) => fmt.pct(v, v < 0.001 ? 3 : 2);

let cores = null;
function lerCores() {
  const s = getComputedStyle(document.documentElement);
  const v = (nome) => s.getPropertyValue(nome).trim();
  cores = {
    base: v('--base'), baseClaro: v('--base-claro'), excesso: v('--excesso'), papel: v('--papel'), grade: v('--grade'),
    eixo: v('--eixo'), tinta: v('--tinta'), tinta2: v('--tinta-2'), tinta3: v('--tinta-3'),
    familia: getComputedStyle(document.body).fontFamily,
  };
}

const medidor = document.createElement('canvas').getContext('2d');
const medidas = new Map();
function medir(texto, px, peso = 700) {
  const k = `${peso}|${px}|${texto}`;
  if (!medidas.has(k)) {
    medidor.font = `${peso} ${px}px ${cores.familia}`;
    medidas.set(k, medidor.measureText(texto).width);
  }
  return medidas.get(k);
}

function prepararCanvas(cv, W, H) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(W * dpr);
  const h = Math.round(H * dpr);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return ctx;
}

/** Marcas de um eixo log: a série mais fina (1 a 9, 1-2-5, 1-3, potências de 10) que cabe em `max`. */
function marcasLog(d0, d1, max) {
  const e0 = Math.floor(Math.log10(d0));
  const e1 = Math.ceil(Math.log10(d1));
  let ultima = [];
  for (const bases of [[1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 5], [1, 3], [1]]) {
    const marcas = [];
    for (let e = e0; e <= e1; e += 1) {
      for (const b of bases) {
        const v = Number((b * 10 ** e).toPrecision(6));
        if (v >= d0 && v <= d1) marcas.push(v);
      }
    }
    if (marcas.length <= max) return marcas;
    ultima = marcas;
  }
  const passo = Math.ceil(ultima.length / max);
  return ultima.filter((_, i) => i % passo === 0);
}

const cruza = (a, b, folga = 0) => a[0] < b[2] + folga && a[2] > b[0] - folga && a[1] < b[3] + folga && a[3] > b[1] - folga;
const cruzaCirculo = (c, m) => {
  const x = Math.max(c[0], Math.min(m.x, c[2]));
  const y = Math.max(c[1], Math.min(m.y, c[3]));
  return (x - m.x) ** 2 + (y - m.y) ** 2 < m.r * m.r;
};
const dentroCaixa = (x, y, c) => x >= c[0] - 2 && x <= c[2] + 2 && y >= c[1] - 2 && y <= c[3] + 2;
const lado3 = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const segCruza = (a, b, c, d) => lado3(a, b, c) !== lado3(a, b, d) && lado3(c, d, a) !== lado3(c, d, b);
function segCruzaCaixa(a, b, c) {
  if (dentroCaixa(a[0], a[1], c) || dentroCaixa(b[0], b[1], c)) return true;
  const q = [[c[0] - 2, c[1] - 2], [c[2] + 2, c[1] - 2], [c[2] + 2, c[3] + 2], [c[0] - 2, c[3] + 2]];
  return q.some((v, i) => segCruza(a, b, v, q[(i + 1) % 4]));
}

function nomeClasse(c) {
  if (c === 'estilo') return t('classe_estilo');
  if (c === 'conteudo') return t('classe_conteudo');
  return t('classe_sem');
}

function iconeForma(c, classeExtra = '') {
  const svg = (filho) => el('svg', { class: `mapa-forma ${classeExtra}`.trim(), viewBox: '0 0 12 12', 'aria-hidden': 'true' }, filho);
  if (c === 'estilo') return svg(el('circle', { class: 'mapa-f-estilo', cx: 6, cy: 6, r: 5 }));
  if (c === 'conteudo') return svg(el('rect', { class: 'mapa-f-conteudo', x: 1.5, y: 1.5, width: 9, height: 9 }));
  if (c === 'cinza') return svg(el('circle', { class: 'mapa-f-cinza', cx: 6, cy: 6, r: 2.5 }));
  return svg(el('circle', { class: 'mapa-f-sem', cx: 6, cy: 6, r: 2.5 }));
}

function iconeAnel(tracejado) {
  return el('svg', { class: 'mapa-forma mapa-forma-anel', viewBox: '0 0 14 14', 'aria-hidden': 'true' },
    el('circle', { class: tracejado ? 'mapa-f-anel mapa-f-anel-tracejado' : 'mapa-f-anel', cx: 7, cy: 7, r: 6 }));
}

function iconeInteiro() {
  return el('svg', { class: 'ic ic-p', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }));
}

function iconeMenos() {
  return el('svg', { class: 'ic ic-p', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d: 'M5 12h14' }));
}

// ---------- Um mapa (um canvas, uma língua) ----------
const ponto = (a, i) => ({ p: a[0], x: a[1], r: a[2], d: a[3], n: a[4], c: a[5], e: a[6] === 1, o: a[7], i });

class Mapa {
  constructor(l, opcoes) {
    this.l = l;
    this.lado = opcoes.lado;
    this.cb = opcoes;
    this.json = null;
    this.pontos = [];
    this.excesso = [];
    this.porPalavra = new Map();
    this.realces = { achada: null, mouse: null, traducao: null, lista: null };
    this.colocados = [];
    this.temps = [];
    this.obstaculos = [];
    this.marcTopo = [];
    this.topo = new Set();
    this.ordenados = {};
    this.g = null;
    this.vazio = false;
    this.pairado = null;

    this.cabeca = el('figcaption', { class: 'mapa-fig-cabeca' });
    this.corpo = el('div', { class: 'mapa-fig-corpo' });
    this.fig = el('figure', { class: `mapa-fig mapa-fig-${l}${this.lado ? ' mapa-fig-lado' : ''}` }, this.cabeca, this.corpo);
    this.base = el('canvas', { class: 'mapa-base', role: 'img' });
    this.sobre = el('canvas', { class: 'mapa-sobre', 'aria-hidden': 'true' });
    this.eixos = el('div', { class: 'mapa-eixos', 'aria-hidden': 'true' });
    this.camada = el('div', { class: 'mapa-rotulos', 'aria-hidden': 'true' });
    this.selecao = el('div', { class: 'mapa-selecao', hidden: true });
    this.plot = el('div', { class: 'plot mapa-plot' }, this.base, this.sobre, this.eixos, this.camada, this.selecao);
    this.dica = criarDica(this.plot, { fixaNoCelular: true, aoFechar: () => this.cb.aoPairar(this, null) });
    this.ligarEventos();
    // Língua e área desde já: se o arquivo falhar, o erro não fica sem dizer de que mapa é.
    this.desenharCabeca();
  }

  definirDados(json) {
    this.json = json;
    this.pontos = (json.pontos || []).map(ponto);
    this.excesso = this.pontos.filter((p) => p.e);
    this.porPalavra = new Map(this.pontos.map((p) => [p.p, p]));
    this.ordenados = {};
    this.realces = { achada: null, mouse: null, traducao: null, lista: null };
    this.pairado = null;
    this.vazio = json.resumos < MIN_RESUMOS || !this.pontos.length;
    this.desenharCabeca();
    if (this.vazio) {
      this.g = null;
      this.dica.destruir();
      this.corpo.replaceChildren(estadoVazioArea(this));
      return;
    }
    if (this.plot.parentNode !== this.corpo) {
      this.dica.destruir();
      this.corpo.replaceChildren(this.plot);
    }
  }

  /**
   * Os dados de outra área estão a caminho: o desenho antigo fica a 40% (carregarEm) e deixa de
   * responder, e o cabeçalho já diz a área nova, sem a contagem.
   */
  esperar() {
    this.json = null;
    this.pontos = [];
    this.excesso = [];
    this.porPalavra = new Map();
    this.ordenados = {};
    this.realces = { achada: null, mouse: null, traducao: null, lista: null };
    this.colocados = [];
    this.temps = [];
    this.pairado = null;
    this.dica.esconder();
    this.desenharCabeca();
  }

  /** As palavras com excesso que entram na lista, na ordem pedida (razão ou diferença). */
  maiores(ordem) {
    if (!this.ordenados[ordem]) {
      const lista = this.excesso.filter((p) => p.r > 1 && p.d > 0);
      lista.sort(ordem === 'diferenca' ? (a, b) => b.d - a.d || b.r - a.r : (a, b) => b.r - a.r || b.d - a.d);
      this.ordenados[ordem] = lista;
    }
    return this.ordenados[ordem];
  }

  desenharCabeca() {
    const l = this.l;
    const vazio = !this.json || this.vazio;
    const n = vazio ? '' : this.pontos.length === 1 ? t('mapa_n_palavras_1') : t('mapa_n_palavras', { n: fmt.num(this.pontos.length) });
    if (this.lado) {
      this.cabeca.replaceChildren(
        el('p', { class: 't-h3 mapa-fig-nome', text: t(`mapa_lingua_${l}`) }),
        el('span', { class: 'etq' }, el('span', { class: `chave chave-${l}` }), siglaLingua(l)),
        el('span', { class: 't-legenda num mapa-fig-n', text: n }));
      return;
    }
    // replaceChildren, ao contrário de el(), escreveria um null como o texto "null".
    this.cabeca.replaceChildren(...[
      el('p', { class: 't-p mapa-fig-titulo' },
        el('span', { class: 'mapa-so-largo' }, [t(`mapa_lingua_${l}`), areaMin(), n].filter(Boolean).join(' · ')),
        el('span', { class: 'mapa-so-celular', text: t('mapa_fig_celular', { resumos: t(`mapa_lingua_${l}_min`) }) })),
      !vazio && el('p', { class: 't-legenda mapa-fig-uso mapa-so-largo', text: t('mapa_dica_uso') }),
    ].filter(Boolean));
  }

  // ----- Desenho -----
  desenhar() {
    if (!this.json || this.vazio) return;
    const W = Math.floor(this.corpo.clientWidth);
    if (!W) return;
    if (!cores?.excesso) lerCores();
    const cel = celular.matches;
    const H = cel ? 300 : this.lado ? (largo.matches ? 440 : 400) : 500;
    const m = cel ? { l: 40, r: 8, t: 12, b: 42 } : { l: 56, r: 16, t: 28, b: 52 };
    const g = { W, H, cel, x0: m.l, x1: W - m.r, y0: m.t, y1: H - m.b };
    this.g = g;
    this.plot.style.height = `${H}px`;
    const dom = this.cb.dominio();
    this.dom = dom;
    this.sx = escalaLog(dom.x, [g.x0, g.x1]);
    this.sy = escalaLog(dom.y, [g.y1, g.y0]);
    const n = this.pontos.length;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vis = new Uint8Array(n);
    for (const p of this.pontos) {
      const X = this.sx(p.x);
      const Y = this.sy(p.r);
      this.px[p.i] = X;
      this.py[p.i] = Y;
      this.vis[p.i] = X >= g.x0 - 1 && X <= g.x1 + 1 && Y >= g.y0 - 1 && Y <= g.y1 + 1 ? 1 : 0;
    }
    this.marcasX = marcasLog(dom.x[0], dom.x[1], cel ? 4 : 6);
    this.marcasY = marcasLog(dom.y[0], dom.y[1], cel ? 4 : 9);
    this.desenharEixos();
    this.colocarRotulos();
    this.desenharBase();
    this.desenharSobre();
    this.base.setAttribute('aria-label', this.cb.resumo(this));
  }

  desenharEixos() {
    const g = this.g;
    const dom = this.dom;
    const filhos = [];
    for (const v of this.marcasX) filhos.push(el('span', { class: 'plot-rot rot-x', style: { left: `${this.sx(v)}px`, top: `${g.y1}px` } }, rotuloX(v)));
    for (const v of this.marcasY) filhos.push(el('span', { class: 'plot-rot rot-y', style: { left: `${g.x0}px`, top: `${this.sy(v)}px` } }, rotuloY(v)));
    const pe = g.H - (g.cel ? 15 : 16);
    filhos.push(el('span', { class: 'plot-rot mapa-eixo-ponta', style: { left: `${g.x0}px`, top: `${pe}px` } }, t('mapa_rara')));
    filhos.push(el('span', { class: 'plot-rot mapa-eixo-ponta mapa-eixo-dir', style: { left: `${g.x1}px`, top: `${pe}px` } }, t('mapa_comum')));
    this.obstaculos = [];
    if (!g.cel) {
      filhos.push(el('span', { class: 'plot-rot mapa-eixo-titulo mapa-eixo-x', style: { left: `${(g.x0 + g.x1) / 2}px`, top: `${pe}px` } },
        this.lado ? t('mapa_eixo_x_curto') : t(`mapa_eixo_x_${this.l}`)));
      filhos.push(el('span', { class: 'plot-rot mapa-eixo-titulo', style: { left: `${g.x0}px`, top: '0px' } }, t('mapa_eixo_y')));
      this.obstaculos.push([g.x0, 0, g.x0 + medir(t('mapa_eixo_y'), 11, 600) + 4, 15]);
    }
    // Rótulos das duas linhas, na ponta direita: "1×" logo abaixo da linha, "corte" logo acima.
    const direita = g.x1 - 2;
    if (!g.cel && dom.y[0] < 1 && dom.y[1] > 1) {
      const Y = this.sy(1);
      const texto = t('mapa_linha_um');
      const w = medir(texto, 11, 500);
      filhos.push(el('span', { class: 'plot-rot mapa-rot-linha', style: { left: `${direita - w}px`, top: `${Y + 3}px` } }, texto));
      this.obstaculos.push([direita - w, Y + 2, direita, Y + 17]);
    }
    const xFim = this.sx.inverso(direita - 30);
    const corte = corteEm(xFim);
    if (corte > dom.y[0] && corte < dom.y[1]) {
      const Y = this.sy(corte);
      const texto = t('mapa_linha_corte');
      const w = medir(texto, 11, 600);
      filhos.push(el('span', { class: 'plot-rot mapa-rot-linha mapa-rot-corte', style: { left: `${direita - w}px`, top: `${Y - 17}px` } }, texto));
      this.obstaculos.push([direita - w, Y - 18, direita, Y - 2]);
    }
    this.eixos.replaceChildren(...filhos);
  }

  /** Posição do rótulo de um ponto: colado ao ponto, ou mais longe com linha guia; null se não couber. */
  /**
   * Posição do rótulo de um ponto. Rótulo nenhum cobre outro rótulo, outro ponto do topo ou uma linha
   * guia. Vale a posição de menor custo: colado ao ponto custa 0 a 3; com linha guia, o comprimento
   * da guia, mais uma multa por guia que cruza outra guia ou outro rótulo. null se nada servir
   * (com `forcar`, fica à direita do ponto mesmo assim).
   */
  posicao(p, caixas, marcadores, forcar = false, guias = []) {
    const g = this.g;
    const fonte = g.cel ? 13 : 14;
    const h = g.cel ? 16 : 18;
    const w = medir(p.p, fonte) + 2;
    const X = this.px[p.i];
    const Y = this.py[p.i];
    const lim = { l: g.x0 + 3, r: g.W - 2, t: 0, b: g.y1 - 2 };
    const MULTA = 120;
    const livre = (c) => {
      if (c[0] < lim.l || c[2] > lim.r || c[1] < lim.t || c[3] > lim.b) return false;
      for (const o of caixas) if (cruza(c, o, 2)) return false;
      for (const m of marcadores) if (m.p !== p.p && cruzaCirculo(c, m)) return false;
      for (const s of guias) if (segCruzaCaixa(s[0], s[1], c)) return false;
      return true;
    };
    const d = 8;
    const pertos = [[X + d, Y - h / 2], [X - d - w, Y - h / 2], [X - w / 2, Y - d - h], [X - w / 2, Y + d]];
    for (const [left, top] of pertos) {
      const c = [left, top, left + w, top + h];
      if (livre(c)) return { caixa: c, guia: null };
    }
    let melhor = null;
    for (const [dx, dy, distancia] of DESLOCAMENTOS) {
      if (melhor && distancia * 0.8 > melhor.custo) break;
      const left = dx >= 0 ? X + dx : X + dx - w;
      const top = Y + dy - h / 2;
      const c = [left, top, left + w, top + h];
      if (!livre(c)) continue;
      const ax = Math.max(left, Math.min(X, left + w));
      const ay = Math.max(top, Math.min(Y, top + h));
      const comprimento = Math.hypot(ax - X, ay - Y) || 1;
      const guia = [[X + (7 * (ax - X)) / comprimento, Y + (7 * (ay - Y)) / comprimento], [ax, ay]];
      if (caixas.some((o) => segCruzaCaixa(guia[0], guia[1], o))) continue;
      let custo = comprimento;
      for (const s of guias) if (segCruza(guia[0], guia[1], s[0], s[1])) custo += MULTA;
      if (!melhor || custo < melhor.custo) melhor = { caixa: c, guia, custo };
    }
    if (melhor && melhor.custo < 110) return { caixa: melhor.caixa, guia: melhor.guia };
    if (!forcar) return null;
    let left = X + d;
    if (left + w > lim.r) left = X - d - w;
    const top = Math.min(Math.max(Y - h / 2, lim.t), lim.b - h);
    return { caixa: [left, top, left + w, top + h], guia: null };
  }

  colocarRotulos() {
    const palavras = this.cb.rotular(this);
    this.topo = new Set();
    const lista = [];
    for (const w of palavras) {
      const p = this.porPalavra.get(w);
      if (!p || !this.vis[p.i]) continue;
      this.topo.add(w);
      lista.push(p);
    }
    this.marcTopo = lista.map((p) => ({ x: this.px[p.i], y: this.py[p.i], r: 6.5, p: p.p }));
    const ocupadas = [...this.obstaculos];
    const guias = [];
    this.colocados = [];
    for (const p of lista) {
      const pos = this.posicao(p, ocupadas, this.marcTopo, false, guias);
      if (!pos) continue;
      ocupadas.push(pos.caixa);
      if (pos.guia) guias.push(pos.guia);
      this.colocados.push({ p, ...pos });
    }
    this.guiasOcupadas = guias;
    this.camada.replaceChildren(...this.colocados.map((c) => {
      c.el = el('span', { class: 'mapa-rot', lang: langDe(this.l), style: { left: `${c.caixa[0]}px`, top: `${c.caixa[1]}px` } }, c.p.p);
      return c.el;
    }));
  }

  /** Marcas das palavras com excesso: estilo é círculo cheio, conteúdo é quadrado vazado, sem classe é ponto. */
  marcadores(ctx, lista, grande) {
    const cel = this.g.cel;
    const rEstilo = grande ? (cel ? 4.5 : 5) : (cel ? 2.8 : 3.2);
    const hConteudo = grande ? (cel ? 4 : 4.5) : (cel ? 2.6 : 3);
    const rPonto = grande ? 3 : (cel ? 1.8 : 2.2);
    ctx.fillStyle = cores.excesso;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (const p of lista) {
      if (p.c === 'estilo' || p.c === 'conteudo') continue;
      const X = this.px[p.i];
      const Y = this.py[p.i];
      ctx.moveTo(X + rPonto, Y);
      ctx.arc(X, Y, rPonto, 0, 2 * Math.PI);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    // Quadrados antes dos círculos: o quadrado vazado é cheio de papel e esconderia um círculo quase
    // no mesmo lugar (aligns, sob chatgpt); o círculo, com contorno de papel, deixa o quadrado à vista.
    ctx.beginPath();
    for (const p of lista) {
      if (p.c !== 'conteudo') continue;
      ctx.rect(this.px[p.i] - hConteudo, this.py[p.i] - hConteudo, 2 * hConteudo, 2 * hConteudo);
    }
    ctx.fillStyle = cores.papel;
    ctx.fill();
    ctx.lineWidth = grande ? 2 : 1.5;
    ctx.strokeStyle = cores.excesso;
    ctx.stroke();
    ctx.beginPath();
    for (const p of lista) {
      if (p.c !== 'estilo') continue;
      const X = this.px[p.i];
      const Y = this.py[p.i];
      ctx.moveTo(X + rEstilo, Y);
      ctx.arc(X, Y, rEstilo, 0, 2 * Math.PI);
    }
    ctx.fillStyle = cores.excesso;
    ctx.fill();
    ctx.lineWidth = grande ? 1.5 : 1;
    ctx.strokeStyle = cores.papel;
    ctx.stroke();
  }

  recortar(ctx) {
    const g = this.g;
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0 + 1, g.y0 - 10, g.x1 - g.x0 + 9, g.y1 - g.y0 + 9);
    ctx.clip();
  }

  desenharBase() {
    const g = this.g;
    const dom = this.dom;
    const ctx = prepararCanvas(this.base, g.W, g.H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = cores.grade;
    ctx.beginPath();
    for (const v of this.marcasX) {
      const X = Math.round(this.sx(v)) + 0.5;
      ctx.moveTo(X, g.y0);
      ctx.lineTo(X, g.y1);
    }
    for (const v of this.marcasY) {
      const Y = Math.round(this.sy(v)) + 0.5;
      ctx.moveTo(g.x0, Y);
      ctx.lineTo(g.x1, Y);
    }
    ctx.stroke();
    ctx.strokeStyle = cores.eixo;
    ctx.beginPath();
    ctx.moveTo(g.x0 + 0.5, g.y0);
    ctx.lineTo(g.x0 + 0.5, g.y1 + 0.5);
    ctx.lineTo(g.x1, g.y1 + 0.5);
    ctx.stroke();

    this.recortar(ctx);
    // Palavras sem excesso: ponto pequeno cinza.
    const rc = g.cel ? 1.6 : 2;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = cores.baseClaro;
    ctx.beginPath();
    for (const p of this.pontos) {
      if (p.e || !this.vis[p.i]) continue;
      const X = this.px[p.i];
      const Y = this.py[p.i];
      ctx.moveTo(X + rc, Y);
      ctx.arc(X, Y, rc, 0, 2 * Math.PI);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    // Linha em 1 (como esperado) e o corte tracejado.
    if (dom.y[0] < 1 && dom.y[1] > 1) {
      const Y = Math.round(this.sy(1)) + 0.5;
      ctx.strokeStyle = cores.tinta3;
      ctx.beginPath();
      ctx.moveTo(g.x0, Y);
      ctx.lineTo(g.x1, Y);
      ctx.stroke();
    }
    ctx.strokeStyle = cores.tinta2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    const l0 = Math.log10(dom.x[0]);
    const l1 = Math.log10(dom.x[1]);
    for (let k = 0; k <= 48; k += 1) {
      const x = 10 ** (l0 + ((l1 - l0) * k) / 48);
      const X = this.sx(x);
      const Y = this.sy(corteEm(x));
      if (k) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Palavras com excesso: primeiro as pequenas, depois as guias e as do topo, maiores.
    const pequenos = [];
    const grandes = [];
    for (const p of this.excesso) {
      if (!this.vis[p.i]) continue;
      (this.topo.has(p.p) ? grandes : pequenos).push(p);
    }
    this.marcadores(ctx, pequenos, false);
    this.guias(ctx, this.colocados);
    this.marcadores(ctx, grandes, true);
    ctx.restore();
  }

  guias(ctx, lista) {
    ctx.strokeStyle = cores.tinta3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of lista) {
      if (!c.guia) continue;
      ctx.moveTo(c.guia[0][0], c.guia[0][1]);
      ctx.lineTo(c.guia[1][0], c.guia[1][1]);
    }
    ctx.stroke();
  }

  /** Camada de cima: anéis da palavra achada, sob o mouse, da lista e da tradução, e os rótulos extras. */
  desenharSobre() {
    if (!this.g || this.vazio || !this.json) return;
    const g = this.g;
    const destacadas = [...new Set(['achada', 'traducao', 'lista', 'mouse'].map((k) => this.realces[k]).filter(Boolean))];
    const comRotulo = new Set(this.colocados.map((c) => c.p.p));
    const ocupadas = [...this.obstaculos, ...this.colocados.map((c) => c.caixa)];
    this.temps = [];
    for (const w of destacadas) {
      if (comRotulo.has(w)) continue;
      const p = this.porPalavra.get(w);
      if (!p || !this.vis[p.i]) continue;
      const pos = this.posicao(p, ocupadas, this.marcTopo, true, this.guiasOcupadas || []);
      ocupadas.push(pos.caixa);
      this.temps.push({ p, ...pos });
    }
    const ctx = prepararCanvas(this.sobre, g.W, g.H);
    this.recortar(ctx);
    this.guias(ctx, this.temps);
    const feitos = new Set();
    for (const [tipo, raio, tracejado] of ANEIS) {
      const w = this.realces[tipo];
      if (!w || feitos.has(w)) continue;
      const p = this.porPalavra.get(w);
      if (!p || !this.vis[p.i]) continue;
      feitos.add(w);
      const X = this.px[p.i];
      const Y = this.py[p.i];
      if (p.e) this.marcadores(ctx, [p], true);
      else {
        ctx.fillStyle = cores.base;
        ctx.beginPath();
        ctx.arc(X, Y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = cores.tinta;
      ctx.setLineDash(tracejado ? [3, 2] : []);
      ctx.beginPath();
      ctx.arc(X, Y, raio, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    for (const c of this.colocados) c.el.classList.toggle('mapa-rot-forte', destacadas.includes(c.p.p));
    this.camada.querySelectorAll('.mapa-rot-temp').forEach((no) => no.remove());
    for (const c of this.temps) {
      c.el = el('span', { class: 'mapa-rot mapa-rot-forte mapa-rot-temp', lang: langDe(this.l), style: { left: `${c.caixa[0]}px`, top: `${c.caixa[1]}px` } }, c.p.p);
      this.camada.append(c.el);
    }
  }

  // ----- Mouse, toque e pinça -----
  dentro(x, y) {
    const g = this.g;
    return g && x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1;
  }

  acharPonto(x, y, toque = false) {
    if (!this.g) return null;
    for (const c of [...this.temps, ...this.colocados]) if (dentroCaixa(x, y, c.caixa)) return c.p;
    let melhor = null;
    let limite = (toque ? 16 : 9) ** 2;
    for (const p of this.excesso) {
      if (!this.vis[p.i]) continue;
      const d2 = (this.px[p.i] - x) ** 2 + (this.py[p.i] - y) ** 2;
      if (d2 < limite) { limite = d2; melhor = p; }
    }
    if (melhor) return melhor;
    limite = (toque ? 12 : 6) ** 2;
    for (const p of this.pontos) {
      if (p.e || !this.vis[p.i]) continue;
      const d2 = (this.px[p.i] - x) ** 2 + (this.py[p.i] - y) ** 2;
      if (d2 < limite) { limite = d2; melhor = p; }
    }
    return melhor;
  }

  pairar(p) {
    if (p === this.pairado) return;
    this.pairado = p;
    this.cb.aoPairar(this, p);
  }

  mostrarDica(p, conteudo) {
    this.dica.mostrar(conteudo, { x: this.px[p.i], y: this.py[p.i] });
  }

  ligarEventos() {
    const s = this.sobre;
    let arrasto = null;
    let toque = null;
    const local = (e) => {
      const r = s.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    s.addEventListener('pointerdown', (e) => {
      if (!this.g) return;
      const { x, y } = local(e);
      if (e.pointerType === 'touch') {
        if (e.isPrimary) { toque = { x, y }; this.pincou = false; }
        return;
      }
      if (e.button !== 0 || !this.dentro(x, y)) return;
      arrasto = { x0: x, y0: y, x1: x, y1: y, ativo: false };
      try { s.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ }
      e.preventDefault();
    });
    s.addEventListener('pointermove', (e) => {
      if (!this.g || e.pointerType === 'touch') return;
      const { x, y } = local(e);
      const g = this.g;
      if (arrasto) {
        arrasto.x1 = Math.max(g.x0, Math.min(x, g.x1));
        arrasto.y1 = Math.max(g.y0, Math.min(y, g.y1));
        if (!arrasto.ativo && Math.hypot(x - arrasto.x0, y - arrasto.y0) > 5) {
          arrasto.ativo = true;
          this.pairar(null);
        }
        if (arrasto.ativo) {
          Object.assign(this.selecao.style, {
            left: `${Math.min(arrasto.x0, arrasto.x1)}px`, top: `${Math.min(arrasto.y0, arrasto.y1)}px`,
            width: `${Math.abs(arrasto.x1 - arrasto.x0)}px`, height: `${Math.abs(arrasto.y1 - arrasto.y0)}px`,
          });
          this.selecao.hidden = false;
        }
        return;
      }
      const p = this.acharPonto(x, y);
      s.style.cursor = p ? 'pointer' : 'crosshair';
      this.pairar(p);
    });
    s.addEventListener('pointerup', (e) => {
      if (!this.g) return;
      const { x, y } = local(e);
      if (e.pointerType === 'touch') {
        if (toque && !this.pincou && Math.hypot(x - toque.x, y - toque.y) < 10) this.cb.aoToque(this, this.acharPonto(x, y, true));
        toque = null;
        return;
      }
      if (!arrasto) return;
      const a = arrasto;
      arrasto = null;
      this.selecao.hidden = true;
      if (a.ativo) {
        if (Math.abs(a.x1 - a.x0) > 8 && Math.abs(a.y1 - a.y0) > 8) {
          this.cb.aoZoom({
            x: [this.sx.inverso(Math.min(a.x0, a.x1)), this.sx.inverso(Math.max(a.x0, a.x1))],
            y: [this.sy.inverso(Math.max(a.y0, a.y1)), this.sy.inverso(Math.min(a.y0, a.y1))],
          });
        }
        return;
      }
      const p = this.acharPonto(x, y);
      if (p) this.cb.aoClicar(this, p);
    });
    s.addEventListener('pointercancel', () => {
      arrasto = null;
      toque = null;
      this.selecao.hidden = true;
    });
    s.addEventListener('pointerleave', (e) => {
      if (arrasto || e.pointerType === 'touch') return;
      s.style.cursor = '';
      this.pairar(null);
    });

    // Pinça no celular e no tablet: zoom em torno do ponto entre os dois dedos.
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    this.plot.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2 || !this.g) return;
      const [a, b] = e.touches;
      const r = this.plot.getBoundingClientRect();
      const mx = (a.clientX + b.clientX) / 2 - r.left;
      const my = (a.clientY + b.clientY) / 2 - r.top;
      this.pincou = true;
      this.pinca = { d: Math.max(dist(a, b), 1), cx: Math.log10(this.sx.inverso(mx)), cy: Math.log10(this.sy.inverso(my)), dom: this.cb.dominio() };
    }, { passive: true });
    this.plot.addEventListener('touchmove', (e) => {
      if (!this.pinca || e.touches.length !== 2) return;
      e.preventDefault();
      const f = this.pinca.d / Math.max(dist(e.touches[0], e.touches[1]), 1);
      const escala = ([lo, hi], c) => [10 ** (c - (c - Math.log10(lo)) * f), 10 ** (c + (Math.log10(hi) - c) * f)];
      this.cb.aoZoom({ x: escala(this.pinca.dom.x, this.pinca.cx), y: escala(this.pinca.dom.y, this.pinca.cy) }, { pinca: true });
    }, { passive: false });
    this.plot.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) this.pinca = null;
    });
  }

  destruir() {
    this.dica.destruir();
    this.fig.remove();
  }
}

// ---------- Estados e textos ----------
function estadoVazioArea(m) {
  const j = m.json;
  const titulo = j.resumos > 0
    ? t('mapa_area_vazia', { n: fmt.num(j.resumos), unidade: unidade(m.l), area: nomeArea(estado.area) })
    : t('mapa_area_vazia_0', { area: nomeArea(estado.area), resumos: t(`mapa_lingua_${m.l}_min`) });
  return el('div', { class: 'estado-vazio mapa-vazio' },
    el('p', { class: 'mapa-vazio-titulo', text: titulo }),
    el('p', { class: 't-p', text: t('mapa_area_vazia_dica') }));
}

function textoClasse(p) {
  return p.e ? `${nomeClasse(p.c)} · ${t('mapa_com_excesso')}` : t('mapa_sem_excesso');
}

function linhaTraducao(m, p) {
  const o = mapas.find((x) => x !== m);
  const tr = pares?.[m.l]?.[p.p];
  if (!tr || !o) return el('p', { class: 'mapa-dica-acao' }, t('mapa_sem_par'));
  const q = o.porPalavra.get(tr);
  const resto = q ? t(`mapa_traducao_em_${o.l}`, { razao: fmt.razao(q.r) }) : t(`mapa_traducao_fora_${o.l}`);
  return el('p', { class: 'mapa-dica-acao' }, t('mapa_traducao_antes'), el('span', { class: 'w', lang: langDe(o.l), text: tr }), resto);
}

function conteudoPonto(m, p) {
  const frag = conteudoDica({
    chave: m.l, palavra: p.p, lingua: m.l,
    sub: `${siglaLingua(m.l)} · ${textoClasse(p)}`,
    valor: t('mapa_dica_razao', { razao: fmt.razao(p.r) }),
    extra: t('mapa_dica_parcelas', { base: fmt.pctAuto(p.x), obs: fmt.pctAuto(p.o) }),
  });
  const n = p.n === 1 ? t(`mapa_dica_n_1_${m.l}`) : t(`mapa_dica_n_${m.l}`, { n: fmt.num(p.n) });
  frag.append(el('div', { class: 'dica-leitura num' }, el('p', { text: t('mapa_dica_dif', { dif: fmt.pp(p.d) }) }), el('p', { text: n })));
  // A linha da tradução espera os dados do outro mapa (sem eles, ela diria que a tradução está fora).
  if (modoLado() && mapas.every((x) => x.json)) frag.append(linhaTraducao(m, p));
  if (!modoLado() || porToque()) frag.append(el('p', { class: 'mapa-dica-acao' }, t(porToque() ? 'mapa_dica_abrir_toque' : 'mapa_dica_abrir')));
  return frag;
}

function resumoMapa(m) {
  let texto = t('mapa_resumo', {
    n: fmt.num(m.pontos.length), resumos: t(`mapa_lingua_${m.l}_min`), area: areaMin(), e: fmt.num(m.excesso.length),
  });
  const topo = m.excesso.reduce((a, p) => (!a || p.r > a.r ? p : a), null);
  if (topo) texto += t('mapa_resumo_maior', { palavra: topo.p, razao: fmt.razao(topo.r) });
  return texto + t(modoLado() ? 'mapa_resumo_fim_lado' : 'mapa_resumo_fim');
}

// ---------- Ligações entre os mapas, a lista e a página ----------
function dominio() {
  return estado.zoom || extensaoTotal || { x: [1e-4, 1], y: [0.1, 30] };
}

function calcularExtensao() {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const m of mapas) {
    if (m.vazio) continue;
    for (const p of m.pontos) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.r < y0) y0 = p.r;
      if (p.r > y1) y1 = p.r;
    }
  }
  if (!Number.isFinite(x0)) return { x: [1e-4, 1], y: [0.1, 30] };
  const lx0 = Math.log10(x0);
  const lx1 = Math.log10(Math.min(Math.max(x1, x0 * 2), 0.97));
  const ly0 = Math.log10(Math.min(y0, 0.9));
  const ly1 = Math.log10(Math.max(y1, 2));
  const fx = (lx1 - lx0) * 0.03;
  const fy = ly1 - ly0;
  // A borda esquerda desce até a década logo abaixo quando está perto dela (a marca 0,01% aparece).
  let ex0 = lx0 - fx;
  if (ex0 - Math.floor(ex0) < 0.15) ex0 = Math.floor(ex0) - 0.02;
  return { x: [10 ** ex0, Math.min(1, 10 ** (lx1 + fx))], y: [10 ** (ly0 - fy * 0.03), 10 ** (ly1 + fy * 0.14)] };
}

function rotular(m) {
  const lista = [];
  if (!m.lado && estado.achar && m.porPalavra.has(estado.achar)) lista.push(estado.achar);
  if (estado.rotulos) {
    const n = celular.matches ? N_ROTULOS.celular : m.lado ? N_ROTULOS.lado : N_ROTULOS.unico;
    for (const p of m.maiores(estado.ordem).slice(0, n)) if (!lista.includes(p.p)) lista.push(p.p);
  }
  return lista;
}

function abrir(m, p) {
  const c = fazerChave(p.p, m.l);
  const linha = caixas.itens.querySelector(`[data-palavra="${CSS.escape(c)}"]`);
  import('../lib/painel.js').then((mod) => mod.abrirPainel(c, linha || m.base));
}

function aoPairar(m, p) {
  m.realces.mouse = p?.p ?? null;
  m.pairado = p;
  if (modoLado()) {
    const o = mapas.find((x) => x !== m);
    if (o) {
      const tr = p ? pares?.[m.l]?.[p.p] : null;
      o.realces.traducao = tr && o.porPalavra.has(tr) ? tr : null;
      if (p) { o.realces.mouse = null; o.pairado = null; o.dica.esconder(); }
      o.desenharSobre();
    }
  }
  m.desenharSobre();
  if (p) m.mostrarDica(p, conteudoPonto(m, p));
  else m.dica.esconder();
  marcarLinhas();
}

function aoToque(m, p) {
  if (!p) { aoPairar(m, null); return; }
  if (!modoLado() || m.realces.mouse === p.p) { abrir(m, p); return; }
  aoPairar(m, p);
}

let quadro = 0;
function agendarDesenho() {
  if (quadro) return;
  quadro = requestAnimationFrame(() => {
    quadro = 0;
    for (const m of mapas) m.desenhar();
  });
}

function aoZoom(dom, { pinca = false } = {}) {
  const total = extensaoTotal;
  if (!total) return;
  const limitar = (d, tot) => {
    let a = Math.max(d[0], tot[0]);
    let b = Math.min(d[1], tot[1]);
    if (b / a < 1.15) {
      const c = Math.sqrt(a * b);
      a = Math.max(tot[0], c / 1.08);
      b = Math.min(tot[1], c * 1.08);
    }
    return [a, b];
  };
  const x = limitar(dom.x, total.x);
  const y = limitar(dom.y, total.y);
  const inteiro = x[0] <= total.x[0] && x[1] >= total.x[1] && y[0] <= total.y[0] && y[1] >= total.y[1];
  estado.zoom = inteiro ? null : { x, y };
  for (const m of mapas) m.dica.esconder();
  agendarDesenho();
  atualizarBotoesZoom();
  if (!pinca) anunciar(estado.zoom ? t('mapa_zoom_feito') : t('mapa_zoom_desfeito'));
}

/**
 * Zoom pelos botões + e − (teclado ou um toque, sem arrastar nem pinçar): metade ou o dobro da
 * extensão em escala log, em torno da palavra achada ou do centro do que está à vista.
 */
function zoomBotao(fator) {
  const { x, y } = dominio();
  const m = mapas[0];
  const p = !modoLado() && m?.realces.achada ? m.porPalavra.get(m.realces.achada) : null;
  const escala = ([lo, hi], centro) => {
    const a = Math.log10(lo);
    const b = Math.log10(hi);
    const c = centro ?? (a + b) / 2;
    return [10 ** (c - (c - a) * fator), 10 ** (c + (b - c) * fator)];
  };
  aoZoom({ x: escala(x, p ? Math.log10(p.x) : null), y: escala(y, p ? Math.log10(p.r) : null) });
}

function verInteiro() {
  if (!estado.zoom) return;
  estado.zoom = null;
  agendarDesenho();
  atualizarBotoesZoom();
  anunciar(t('mapa_zoom_desfeito'));
}

/** + vale até o zoom máximo de aoZoom; − e "Ver o mapa inteiro", só com zoom. */
function atualizarBotoesZoom() {
  if (!botaoInteiro) return;
  const foco = document.activeElement;
  const { x, y } = dominio();
  botaoAproximar.disabled = x[1] / x[0] < 1.2 && y[1] / y[0] < 1.2;
  botaoAfastar.disabled = !estado.zoom;
  botaoInteiro.disabled = !estado.zoom;
  // Botão desativado perde o foco: ele passa para o vizinho que ainda funciona.
  if (foco?.disabled) (botaoAproximar.disabled ? botaoAfastar : botaoAproximar).focus();
}

// ---------- Lista "Maiores excessos" ----------
function realcarLista(w) {
  const m = mapas[0];
  if (!m || modoLado()) return;
  m.realces.lista = w;
  m.desenharSobre();
  marcarLinhas();
}

function marcarLinhas() {
  const m = mapas[0];
  if (!m || modoLado()) return;
  const ativas = new Set([m.realces.mouse, m.realces.lista, m.realces.achada].filter(Boolean));
  for (const b of caixas.itens.querySelectorAll('.mapa-linha')) b.classList.toggle('mapa-linha-ativa', ativas.has(b.dataset.w));
}

function desenharLista() {
  const m = mapas[0];
  if (!m || modoLado() || !m.json) return;
  caixas.lista.classList.remove('esmaecido');
  const itens = m.vazio ? [] : m.maiores(estado.ordem).slice(0, N_LISTA);
  caixas.listaNota.hidden = estado.area === 'todas';
  caixas.listaNota.textContent = t('mapa_lista_area', { area: nomeArea(estado.area) });
  const razao = estado.ordem !== 'diferenca';
  caixas.itens.classList.toggle('mapa-itens-dif', !razao);
  caixas.itens.classList.toggle('mapa-itens-todos', estado.verTodas);
  if (!itens.length) {
    caixas.itens.replaceChildren(el('li', { class: 't-p mapa-itens-vazio', text: t('mapa_lista_vazia') }));
    caixas.verMais.hidden = true;
    return;
  }
  const topo = razao ? Math.log(itens[0].r) : itens[0].d;
  caixas.itens.replaceChildren(...itens.map((p, i) => {
    const fracao = razao ? Math.log(p.r) / topo : p.d / topo;
    const botao = el('button', {
      type: 'button', class: 'mapa-linha', dataset: { palavra: fazerChave(p.p, m.l), w: p.p },
      on: {
        mouseenter: () => realcarLista(p.p), mouseleave: () => realcarLista(null),
        focus: () => realcarLista(p.p), blur: () => realcarLista(null),
      },
    },
    el('span', { class: 't-legenda num mapa-linha-n', text: fmt.num(i + 1) }),
    iconeForma(p.c),
    el('span', { class: 'w mapa-linha-palavra', lang: langDe(m.l), text: p.p }),
    el('span', { class: 'sr', text: `, ${nomeClasse(p.c)},` }),
    el('span', { class: 'mapa-linha-trilho', 'aria-hidden': 'true' }, el('span', { class: 'mapa-linha-barra', style: { width: `${Math.max(4, 100 * fracao).toFixed(1)}%` } })),
    el('span', { class: 'num mapa-linha-valor', text: razao ? fmt.razao(p.r) : fmt.pp(p.d) }));
    return el('li', { class: i >= N_LISTA_CELULAR ? 'mapa-item-extra' : null }, botao);
  }));
  caixas.verMais.hidden = itens.length <= N_LISTA_CELULAR;
  caixas.verMais.textContent = estado.verTodas ? t('mapa_ver_10') : t('mapa_ver_n', { n: fmt.num(itens.length) });
  caixas.verMais.setAttribute('aria-expanded', String(estado.verTodas));
  marcarLinhas();
}

function esqueletoLista() {
  caixas.itens.replaceChildren(...Array.from({ length: celular.matches ? N_LISTA_CELULAR : N_LISTA }, () => el('li', { 'aria-hidden': 'true', class: 'mapa-esq-linha' }, el('span', { class: 'esq' }))));
}

/** O arquivo do mapa falhou: a lista não mostra os números de outra área enquanto espera por ele. */
function listaEspera() {
  caixas.lista.classList.remove('esmaecido');
  caixas.listaNota.hidden = true;
  caixas.itens.replaceChildren(el('li', { class: 't-p mapa-itens-vazio', text: t('mapa_lista_espera') }));
  caixas.verMais.hidden = true;
}

// ---------- Legenda, notas e tabela ----------
function desenharLegenda() {
  const item = (icone, texto, classe) => el('span', { class: `legenda-item ${classe || ''}`.trim() }, icone, texto);
  const lado = modoLado();
  const itens = [
    item(iconeForma('estilo'), t('classe_estilo')),
    item(iconeForma('conteudo'), t('classe_conteudo')),
    item(iconeForma('sem-classe'), t('mapa_leg_sem_classe')),
    item(iconeForma('cinza'), t('mapa_leg_sem_excesso')),
  ];
  if (lado) {
    // Com toque não há ponteiro: o anel marca a palavra tocada.
    itens.push(item(iconeAnel(false), t(porToque() ? 'mapa_leg_toque' : 'mapa_leg_mouse')), item(iconeAnel(true), t('mapa_leg_traducao')),
      el('span', { class: 't-legenda mapa-leg-pares', text: t('mapa_leg_pares') }));
  } else {
    itens.push(item(iconeAnel(false), t('mapa_leg_achada')));
  }
  caixas.legenda.replaceChildren(...itens);
  caixas.legenda.hidden = mapas.length > 0 && mapas.every((m) => m.json && m.vazio);
  caixas.notaCelular.hidden = lado || !estado.rotulos;
  caixas.notaCelular.textContent = t('mapa_nota_celular', { n: fmt.num(N_ROTULOS.celular) });
}

function desenharNotas() {
  // As notas falam de todos os mapas da tela: esperam os dados de cada um.
  if (!mapas.length || mapas.some((m) => !m.json)) return;
  const ativos = mapas;
  caixas.nota.classList.remove('esmaecido');
  caixas.recorte.classList.remove('esmaecido');
  const partes = [];
  if (estado.area !== 'todas') partes.push(t('mapa_nota_cor_area', { area: nomeArea(estado.area) }));
  else if (modoLado()) {
    const n = (l) => fmt.num(ativos.find((m) => m.l === l)?.excesso.length ?? 0);
    partes.push(t('mapa_nota_cor_lado', { pt: n('pt'), en: n('en') }));
  } else partes.push(t('mapa_nota_cor', { n: fmt.num(ativos[0].excesso.length) }));
  partes.push(t('mapa_nota_regra'), t('mapa_nota_corte'), t('mapa_nota_forma'));
  const nos = [partes.join(' ')];
  const exemplo = ativos.find((m) => {
    const p = m.porPalavra.get(EXEMPLO[m.l]);
    return p && p.e && p.c === 'conteudo';
  });
  if (exemplo) nos.push(' ', el('span', { class: 'w', lang: langDe(exemplo.l), text: EXEMPLO[exemplo.l] }), t('mapa_nota_exemplo'));
  nos.push(' ', el('a', { href: `${rota('metodo')}#corte`, text: t('mapa_como_corte') }));
  caixas.nota.replaceChildren(...nos);

  const recortes = ativos.filter((m) => !m.vazio).map((m) => {
    const vars = {
      resumos: t(`mapa_lingua_${m.l}_min`), area: nomeArea(estado.area), n: fmt.num(m.json.resumos),
      unidade: unidade(m.l), revistas: fmt.num(m.json.revistas),
    };
    let texto = t(estado.area === 'todas' ? 'mapa_nota_recorte' : 'mapa_nota_recorte_area', vars);
    if (m.json.resumos < POUCOS_RESUMOS) texto += ` ${t('mapa_nota_poucos', { unidade: unidade(m.l) })}`;
    return texto;
  });
  caixas.recorte.textContent = recortes.join(' ');
  caixas.recorte.hidden = !recortes.length;
}

function criarTabela() {
  const ativos = mapas.filter((m) => m.json && !m.vazio);
  if (!ativos.length) return null;
  const lado = modoLado();
  const todas = estado.tabelaTodas;
  const ordenar = estado.ordem === 'diferenca' ? (a, b) => b.d - a.d || b.r - a.r : (a, b) => b.r - a.r || b.d - a.d;
  const linhas = [];
  let total = 0;
  const itens = [];
  for (const m of ativos) {
    total += m.pontos.length;
    for (const p of todas ? m.pontos : m.excesso) itens.push([m, p]);
  }
  itens.sort((a, b) => ordenar(a[1], b[1]));
  const limite = todas ? Math.max(PAGINA_TABELA, estado.tabelaLimite) : itens.length;
  for (const [m, p] of itens.slice(0, limite)) {
    const linha = [palavraBotao(p.p, m.l)];
    if (lado) linha.push(siglaLingua(m.l));
    linha.push(p.c || p.e ? nomeClasse(p.c) : '');
    if (todas) linha.push(p.e ? t('mapa_sim') : '');
    linha.push(pctColuna(p.x), pctColuna(p.o), { conteudo: fmt.razao(p.r), forte: true }, fmt.pp(p.d), fmt.num(p.n));
    if (lado) {
      const tr = pares?.[m.l]?.[p.p];
      linha.push(tr ? { conteudo: tr, lang: langDe(outra(m.l)) } : '');
    }
    linhas.push(linha);
  }
  const colunas = [{ rotulo: t('mapa_col_palavra') }];
  if (lado) colunas.push({ rotulo: t('mapa_col_lingua') });
  colunas.push({ rotulo: t('mapa_col_classe') });
  if (todas) colunas.push({ rotulo: t('mapa_col_excesso') });
  colunas.push(
    { rotulo: t('mapa_col_2122'), curto: t('mapa_col_2122_curto'), num: true },
    { rotulo: t('mapa_col_2025'), curto: t('mapa_col_2025_curto'), num: true },
    { rotulo: t('mapa_col_razao'), num: true },
    { rotulo: t('mapa_col_dif'), num: true },
    { rotulo: t('mapa_col_n'), curto: t('mapa_col_n_curto'), num: true });
  if (lado) colunas.push({ rotulo: t('mapa_col_traducao') });
  const resumos = ativos.map((m) => t(`mapa_lingua_${m.l}_min`)).join(lingua === 'pt' ? ' e ' : ' and ');
  const legenda = t(todas ? 'mapa_tab_legenda_todas' : 'mapa_tab_legenda', { resumos, area: areaMin() });
  const nota = estado.area === 'todas' ? t('mapa_tab_nota') : `${t('mapa_tab_nota_area', { area: nomeArea(estado.area) })} ${t('mapa_tab_nota')}`;
  const alternar = el('button', {
    class: 'btn btn-p', type: 'button',
    on: {
      click: () => {
        estado.tabelaTodas = !estado.tabelaTodas;
        estado.tabelaLimite = PAGINA_TABELA;
        botaoTab.atualizar();
        // A tabela foi refeita com um botão novo: o foco volta para ele.
        caixas.graficos.parentNode.querySelector('.mapa-tabela-botoes .btn:last-child')?.focus();
      },
    },
  }, todas ? t('mapa_tab_excesso') : t('mapa_tab_todas', { n: fmt.num(total) }));
  const faltam = itens.length - linhas.length;
  const mais = faltam > 0 && el('button', {
    class: 'btn btn-p', type: 'button',
    on: {
      click: () => {
        const rolagem = caixas.graficos.parentNode.querySelector('.mapa-tabela-caixa')?.scrollTop || 0;
        estado.tabelaLimite = limite + PAGINA_TABELA;
        botaoTab.atualizar();
        const caixa = caixas.graficos.parentNode.querySelector('.mapa-tabela-caixa');
        if (caixa) caixa.scrollTop = rolagem;
        caixas.graficos.parentNode.querySelector('.mapa-tabela-pe .btn')?.focus();
      },
    },
  }, t('mapa_tab_mais', { n: fmt.num(Math.min(PAGINA_TABELA, faltam)) }));
  const contagem = todas ? ` ${t('mapa_tab_contagem', { n: fmt.num(linhas.length), total: fmt.num(itens.length) })}` : '';
  return el('div', { class: 'mapa-tabela' },
    tabela(colunas, linhas, { legenda, classe: 'mapa-tabela-caixa' }),
    el('div', { class: 'mapa-tabela-pe' }, el('p', { class: 't-legenda', text: nota + contagem }),
      el('div', { class: 'mapa-tabela-botoes' }, mais, alternar)));
}

// ---------- Achar palavra ----------
function achar(palavra, { doUsuario = false } = {}) {
  estado.achar = palavra || null;
  const m = mapas[0];
  caixas.acharStatus.replaceChildren();
  if (m && !modoLado()) {
    m.realces.achada = null;
    if (estado.achar && m.json) {
      const p = m.vazio ? null : m.porPalavra.get(estado.achar);
      if (p) {
        m.realces.achada = p.p;
        const { x, y } = dominio();
        if (estado.zoom && (p.x < x[0] || p.x > x[1] || p.r < y[0] || p.r > y[1])) {
          estado.zoom = null;
          atualizarBotoesZoom();
        }
        if (doUsuario) anunciar(t('mapa_achar_ok', { palavra: p.p }));
      } else {
        const onde = estado.area === 'todas' ? '' : t('mapa_achar_onde', { area: nomeArea(estado.area) });
        caixas.acharStatus.replaceChildren(el('span', { class: 'w', lang: langDe(m.l), text: estado.achar }),
          t('mapa_achar_fora', { unidade: unidade(m.l), onde }));
      }
    }
  }
  agendarDesenho();
  marcarLinhas();
  gravar();
}

function criarBuscaAchar() {
  const lugar = filtros.achar.querySelector('.mapa-achar-campo');
  const l = modoLado() ? 'en' : estado.resumos;
  busca = criarBusca({
    linguas: [l], rotulo: t('mapa_achar'), placeholder: t('mapa_achar'),
    aoEscolher: (item) => {
      achar(item.palavra, { doUsuario: true });
      busca.entrada.value = item.palavra;
    },
  });
  lugar.replaceChildren(busca.elemento);
  if (estado.achar) busca.entrada.value = estado.achar;
  const limparSeVazio = () => {
    if (!busca.entrada.value.trim() && estado.achar) achar(null);
  };
  busca.entrada.addEventListener('input', limparSeVazio);
  busca.entrada.addEventListener('keyup', (e) => { if (e.key === 'Escape') limparSeVazio(); });
}

// ---------- Controles e endereço ----------
function gravar() {
  gravarUrl({
    resumos: estado.resumos, area: estado.area, rotulos: String(estado.rotulos), ordem: estado.ordem,
    achar: modoLado() ? null : estado.achar,
  }, PADRAO);
}

function posicionarBotoes() {
  (celular.matches ? caixas.peAcoes : caixas.acoesBarra).append(botaoAproximar, botaoAfastar, botaoInteiro, botaoTab.botao);
}

function montarControles() {
  caixas.acoes.append(botaoCopiarLink('btn btn-p'));
  filtros.resumos = filtroResumos({ valor: estado.resumos, ladoALado: true, aoMudar: mudarResumos });
  filtros.area = seletorArea({ valor: estado.area, aoMudar: mudarArea });
  filtros.achar = el('div', { class: 'filtro filtro-empilha mapa-achar' },
    el('span', { class: 'filtro-rotulo', 'aria-hidden': 'true', text: t('mapa_achar') }),
    el('div', { class: 'mapa-achar-campo' }));
  filtros.rotulos = segmentos({
    rotulo: t('mapa_rotulos'), valor: String(estado.rotulos), classe: 'mapa-filtro-rotulos',
    opcoes: [{ valor: '20', texto: t('mapa_rotulos_top') }, { valor: '0', texto: t('mapa_rotulos_nenhum') }],
    aoMudar: (v) => { estado.rotulos = Number(v); desenharLegenda(); agendarDesenho(); gravar(); },
  });
  caixas.filtros.append(filtros.resumos, filtros.area, filtros.achar, filtros.rotulos);
  criarBuscaAchar();

  // + e − dão zoom sem arrastar nem pinçar (teclado, um dedo só).
  const botaoZoom = (fator, rotulo, desenho) => el('button', {
    class: 'btn btn-p btn-icone', type: 'button', 'aria-label': rotulo, title: rotulo, on: { click: () => zoomBotao(fator) },
  }, desenho);
  botaoAproximar = botaoZoom(0.5, t('mapa_aproximar'), icone('mais'));
  botaoAfastar = botaoZoom(2, t('mapa_afastar'), iconeMenos());
  botaoAfastar.disabled = true;
  botaoInteiro = el('button', { class: 'btn btn-p mapa-botao-inteiro', type: 'button', disabled: true, on: { click: verInteiro } },
    iconeInteiro(), t('mapa_ver_inteiro'));
  botaoTab = botaoTabela({
    grafico: [caixas.graficos, caixas.legenda], criar: criarTabela,
    aoMudar: (mostrando) => { if (!mostrando) agendarDesenho(); },
  });
  posicionarBotoes();

  filtros.ordem = segmentos({
    rotulo: t('mapa_ordenar'), valor: estado.ordem, classe: 'mapa-filtro-ordem',
    opcoes: [{ valor: 'razao', texto: t('mapa_ordem_razao') }, { valor: 'diferenca', texto: t('mapa_ordem_diferenca') }],
    aoMudar: (v) => { estado.ordem = v; desenharLista(); agendarDesenho(); botaoTab.atualizar(); gravar(); },
  });
  caixas.ordem.append(filtros.ordem);
  caixas.verMais.addEventListener('click', () => {
    estado.verTodas = !estado.verTodas;
    desenharLista();
    if (!estado.verTodas) caixas.lista.scrollIntoView({ block: 'nearest' });
  });
}

function ajustarModo() {
  const lado = modoLado();
  const linguas = lado ? ['pt', 'en'] : [estado.resumos];
  const chave = linguas.join(',');
  if (chave === chaveModo) return;
  chaveModo = chave;
  for (const m of mapas) m.destruir();
  mapas = linguas.map((l) => new Mapa(l, {
    lado, dominio, rotular, aoPairar, aoToque, aoZoom, resumo: resumoMapa, aoClicar: abrir,
  }));
  caixas.graficos.replaceChildren(...mapas.map((m) => m.fig));
  caixas.graficos.classList.toggle('mapa-graficos-lado', lado);
  caixas.grade.classList.toggle('mapa-grade-lado', lado);
  caixas.lista.hidden = lado;
  caixas.ladoIntro.hidden = !lado;
  caixas.ladoIntro.textContent = t(porToque() ? 'mapa_lado_intro_toque' : 'mapa_lado_intro');
  filtros.achar.hidden = lado;
  caixas.acharStatus.replaceChildren();
  const top = filtros.rotulos.querySelector('[data-valor="20"]');
  if (top) top.textContent = t(lado ? 'mapa_rotulos_top_lado' : 'mapa_rotulos_top');
  desenharLegenda();
}

async function carregar() {
  const meu = ++pedido;
  ajustarModo();
  const lado = modoLado();
  const altura = celular.matches ? 300 : lado ? 440 : 500;
  const tinha = mapas.map((m) => Boolean(m.json));
  if (!lado && !tinha[0]) esqueletoLista();
  // Até os dados da área nova chegarem, os mapas, a lista e as notas da anterior ficam a 40%.
  if (tinha.some(Boolean)) {
    for (const m of mapas) if (m.json) m.esperar();
    for (const caixa of [caixas.lista, caixas.nota, caixas.recorte]) caixa.classList.add('esmaecido');
  }
  const promessaPares = lado ? dados('mapa/pares.json').catch(() => null) : Promise.resolve(pares);
  // Cada mapa entra quando o seu arquivo chega: no lado a lado, um arquivo com falha não segura o outro.
  await Promise.all(mapas.map(async (m, i) => {
    const caminho = `mapa/${m.l}-${estado.area}.json`;
    // Com um mapa só, o arquivo alimenta a tela toda (mapa, lista e notas): não há "outros gráficos".
    const promessa = carregarEm(m.corpo, caminho, { altura, semEsqueleto: tinha[i], erroTexto: lado ? null : t('erro_texto_tela') });
    // Se o arquivo falhar, o erro com "Tentar de novo" fica no mapa; a lista diz que espera por ele e
    // o recorte, que dá números de outra área, sai até os dados chegarem.
    dados(caminho).catch(() => {
      if (meu !== pedido) return;
      caixas.recorte.hidden = true;
      if (!lado) listaEspera();
    });
    const [json, paresJson] = await Promise.all([promessa, promessaPares]);
    if (meu !== pedido) return;
    pares = paresJson;
    m.definirDados(json);
    extensaoTotal = calcularExtensao();
    achar(estado.achar);
    desenharLista();
    desenharNotas();
    desenharLegenda();
    botaoTab.atualizar();
    atualizarBotoesZoom();
  }));
}

function mudarResumos(v) {
  estado.resumos = v;
  estado.zoom = null;
  estado.achar = null;
  estado.verTodas = false;
  ajustarModo();
  criarBuscaAchar();
  carregar();
  gravar();
}

function mudarArea(area) {
  estado.area = area;
  estado.zoom = null;
  carregar();
  gravar();
}

/** "a, b e c", para o aviso de link com problema. */
function listaAviso(itens, e = t('mapa_aviso_e')) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(t('mapa_aviso_virgula'))}${e}${itens[itens.length - 1]}`;
}

async function iniciar() {
  lerCores();
  const url = lerUrl();
  // Valores que a tela não conhece voltam ao padrão e entram no aviso.
  const opcoes = [];
  if (['pt', 'en', 'lado'].includes(url.resumos)) estado.resumos = url.resumos;
  else if (url.resumos) opcoes.push(`resumos=${url.resumos}`);
  if (url.rotulos === '0' || url.rotulos === 'nenhum') estado.rotulos = 0;
  else if (url.rotulos && url.rotulos !== '20') opcoes.push(`rotulos=${url.rotulos}`);
  if (url.ordem === 'diferenca') estado.ordem = 'diferenca';
  else if (url.ordem && url.ordem !== 'razao') opcoes.push(`ordem=${url.ordem}`);
  let areaRuim = null;
  if (url.area && url.area !== 'todas') {
    if (AREAS.includes(url.area)) estado.area = url.area;
    else areaRuim = url.area;
  }
  const acharPedido = !modoLado() && url.achar ? url.achar.trim().toLowerCase() : null;
  estado.achar = acharPedido;
  montarControles();
  await carregar();

  // Uma frase só: o que o link pedia e não existe, e o que a tela mostra no lugar.
  const partes = [];
  if (areaRuim) partes.push(t('mapa_aviso_area', { area: escapar(areaRuim) }));
  const m = mapas[0];
  if (acharPedido && !m.porPalavra.has(acharPedido)) {
    partes.push(t('mapa_aviso_achar', { palavra: escapar(acharPedido) }));
    busca.entrada.value = '';
    achar(null);
  }
  if (opcoes.length) {
    partes.push(listaAviso(opcoes.map((o) => `<b>${escapar(o)}</b>`)) + t(opcoes.length === 1 ? 'mapa_aviso_opcao_1' : 'mapa_aviso_opcao_n'));
  }
  if (partes.length) {
    const fim = modoLado()
      ? t('mapa_aviso_fim_lado', { area: escapar(areaMin()) })
      : t('mapa_aviso_fim', { resumos: t(`mapa_lingua_${m.l}_min`), area: escapar(areaMin()) });
    caixas.aviso.replaceChildren(avisoLink(`${t('mapa_aviso_inicio')}${listaAviso(partes, t('mapa_aviso_e_partes'))}${fim}`));
  }
  gravar();
}

celular.addEventListener('change', () => {
  posicionarBotoes();
  caixas.ladoIntro.textContent = t(porToque() ? 'mapa_lado_intro_toque' : 'mapa_lado_intro');
  desenharLista();
  desenharLegenda();
  agendarDesenho();
});
new ResizeObserver(() => agendarDesenho()).observe(caixas.graficos);
document.fonts?.ready.then(() => {
  lerCores();
  medidas.clear();
  agendarDesenho();
});

iniciar();
