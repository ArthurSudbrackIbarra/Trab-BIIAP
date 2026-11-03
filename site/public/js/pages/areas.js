// IAês · Áreas do conhecimento (d-areas, m-areas, e-areas-reproduzindo; spec 4.4, guia seção 7).
// Mapa de calor das oito áreas (e de todas juntas) por ano, com Reproduzir, régua, barras do ano
// escolhido e o cartão de uma célula. Estado no endereço:
//   ?resumos=en&metrica=indice&ano=2025[&area=saude]   (area = cartão aberto)
// Dados: dados/areas.json (contrato em site/DADOS.md).
import {
  el, icone, t, fmt, lingua, ANOS, AREAS, nomeArea, siglaLingua, lerUrl, gravarUrl, botaoCopiarLink, avisoLink,
  carregarEm, escapar, semMovimento,
} from '../lib/base.js';
import { linhaTempo } from '../lib/grafico.js';
import { criarDica, conteudoDica } from '../lib/dica.js';
import { tabela, botaoTabela } from '../lib/tabela.js';
import { segmentos, filtroResumos } from '../lib/filtros.js';

const $ = (id) => document.getElementById(id);
const I2021 = ANOS.indexOf(2021);
const I2022 = ANOS.indexOf(2022);
const I2023 = ANOS.indexOf(2023);
const I2025 = ANOS.indexOf(2025);
const ULTIMO = ANOS.length - 1;
const MIN_INDICE = 100;      // abaixo disso a célula fica hachurada (DADOS.md)
const MIN_MINIMO = 200;      // a estimativa mínima só existe com 200 resumos ou mais
const PASSO_MS = 600;        // Reproduzir: um ano a cada 600 ms (guia, seção 7)
const LINHAS = [...AREAS, 'todas'];
// Faixas do calor: índice pelo guia (até 1,1; 1,1 a 1,3; ...; 2,1 ou mais). A estimativa mínima
// não tem faixa no design: passos de 3 pontos percentuais, do zero aos 18% ou mais.
const FAIXAS = {
  indice: [1.1, 1.3, 1.5, 1.7, 1.9, 2.1],
  minimo: [0.03, 0.06, 0.09, 0.12, 0.15, 0.18],
};
const largo = matchMedia('(min-width: 1200px)');
const celular = matchMedia('(max-width: 599px)');
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');
const listaAnos = (anos) => new Intl.ListFormat(langDe(lingua), { type: 'conjunction' }).format(anos.map(String));

const estado = { resumos: 'en', metrica: 'indice', i: I2025, area: null, modo: 'livre' };
let D = null;                // areas.json
let ordem = [];              // linhas do mapa, na ordem de 2025
let refs = {};               // nós do modelo, depois da carga
let celulas = new Map();     // `${area}|${i}` → nó
let cabecas = [];            // cabeçalhos dos anos
let foco = { r: 0, c: I2025 };
let dica = null;
let cartao = null;
let cartaoGrafico = null;
let timer = null;
let botaoTab = null;
const barrasItens = new Map();
const filtros = {};

// ---------- Dados ----------
const serie = (campo, l, area) => (area === 'todas' ? D.todas[campo][l] : D[campo][l][area]);

/**
 * Anos sem estimativa mínima na língua (minimo_sem_marcadoras): nenhuma das duas metades do corpus
 * achou mais de uma marcadora, e com uma palavra só a conta mediria a palavra, não o uso de LLM.
 */
const semMarcadoras = (i, l = estado.resumos) => Boolean(D.minimo_sem_marcadoras?.[l]?.includes(ANOS[i]));

/** Primeiro ano (índice) com estimativa mínima na língua: 2023, ou o que vem depois dos anos sem marcadoras. */
function inicioMinimo(l = estado.resumos) {
  let i = I2023;
  while (semMarcadoras(i, l)) i += 1;
  return i;
}

/** O que explica as colunas sem estimativa mínima no começo do mapa (nota, dica e cartão). */
function textoAntes(l = estado.resumos) {
  const inicio = inicioMinimo(l);
  if (inicio === I2023) return t('antes_2023');
  return t('antes_sem_marcadoras', { Nos: t(`Nos_${l}`), ano: ANOS[inicio], anos: listaAnos(ANOS.slice(I2023, inicio)) });
}

/** Tudo de uma célula, com a situação dela para a métrica: ok, poucos, sem, nenhum, antes (de 2023) ou semMarcadoras. */
function celula(area, i, l = estado.resumos, metrica = estado.metrica) {
  const n = serie('resumos', l, area)[i] ?? 0;
  const indice = serie('indice', l, area)[i];
  const parcela = serie('parcela', l, area)[i];
  const minimo = serie('minimo', l, area)[i];
  const ep = serie('minimo_ep', l, area)[i];
  const indiceOk = n >= MIN_INDICE && indice != null;
  let situacao;
  if (metrica === 'minimo') {
    if (i < I2023) situacao = 'antes';
    else if (semMarcadoras(i, l)) situacao = 'semMarcadoras';
    else if (minimo != null) situacao = 'ok';
    else situacao = n < MIN_MINIMO ? 'poucos' : 'sem';
  } else if (n < MIN_INDICE) situacao = n === 0 ? 'nenhum' : 'poucos';
  else situacao = indice == null ? 'sem' : 'ok';
  if (situacao === 'poucos' && n === 0) situacao = 'nenhum';
  return {
    area, i, ano: ANOS[i], n, indice, parcela, minimo, ep, indiceOk, situacao,
    valor: situacao === 'ok' ? (metrica === 'minimo' ? minimo : indice) : null,
    base: indiceOk && indice ? parcela / indice : null,
  };
}

function faixaDe(v, metrica = estado.metrica) {
  const k = FAIXAS[metrica].findIndex((limite) => v < limite);
  return k < 0 ? FAIXAS[metrica].length : k;
}

const fmtValor = (v, metrica = estado.metrica) => (metrica === 'minimo' ? fmt.pct(v, 1) : fmt.num(v, 2));
const fmtLimite = (v, metrica = estado.metrica) => (metrica === 'minimo' ? fmt.pct(v, 0) : fmt.num(v, 1));
function fmtDelta(d, metrica = estado.metrica) {
  if (metrica === 'minimo') return fmt.pp(d, 1);
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt.num(Math.abs(d), 2)}`;
}
function nResumos(n, l = estado.resumos) {
  if (n === 0) return t(`n_0_${l}`);
  return n === 1 ? t(`n_1_${l}`) : t(`n_${l}`, { n: fmt.num(n) });
}
const nomeCurto = (area) => t(`area_curta_${area}`);
const anoTexto = (i) => (i === ULTIMO ? `${ANOS[i]} ${t('parcial')}` : String(ANOS[i]));

/** Linhas em ordem decrescente do valor de 2025 na métrica; sem valor em 2025 vão para o fim. */
function calcularOrdem() {
  const areas = [...AREAS].sort((a, b) => {
    const ca = celula(a, I2025);
    const cb = celula(b, I2025);
    const oa = ca.situacao === 'ok';
    const ob = cb.situacao === 'ok';
    if (oa !== ob) return oa ? -1 : 1;
    if (oa && cb.valor !== ca.valor) return cb.valor - ca.valor;
    return AREAS.indexOf(a) - AREAS.indexOf(b);
  });
  return [...areas, 'todas'];
}

// ---------- Endereço ----------
function gravar() {
  if (estado.modo === 'tocando') return;
  gravarUrl({ resumos: estado.resumos, metrica: estado.metrica, ano: ANOS[estado.i], area: estado.area });
}

const anunciar = (texto) => { $('ar-vivo').textContent = texto; };

// ---------- Mapa de calor ----------
function montarMapa() {
  const mapa = refs.mapa;
  dica?.esconder();
  celulas = new Map();
  const linhaAnos = el('div', { class: 'ar-linha ar-linha-anos', role: 'row' },
    el('span', { class: 'ar-canto', role: 'columnheader' }, el('span', { class: 'sr', text: t('col_area') })));
  cabecas = ANOS.map((ano, i) => {
    const rotulo = i === 0
      ? [el('span', { class: 'ar-so-largo', text: String(ano) }), el('span', { class: 'ar-so-celular', text: String(ano).slice(2) })]
      : [String(ano).slice(2)];
    const cab = el('div', {
      class: 'ar-ano-col num', role: 'columnheader', 'aria-label': anoTexto(i), dataset: { i },
    }, el('span', { class: 'ar-ano-num', 'aria-hidden': 'true' }, ...rotulo), el('span', { class: 'ar-ano-nota', 'aria-hidden': 'true' }));
    return cab;
  });
  linhaAnos.append(...cabecas);

  const corpo = el('div', { class: 'ar-mapa-corpo', role: 'rowgroup' });
  ordem.forEach((area, r) => {
    const linha = el('div', { class: `ar-linha${area === 'todas' ? ' ar-linha-todas' : ''}`, role: 'row', dataset: { area } },
      el('div', { class: 'ar-area', role: 'rowheader' },
        el('span', { class: 'ar-so-largo', text: nomeArea(area) }),
        el('span', { class: 'ar-so-celular', text: nomeCurto(area) })));
    ANOS.forEach((ano, i) => {
      const no = el('div', { class: 'ar-celula', role: 'gridcell', tabindex: '-1', dataset: { area, i, r } });
      celulas.set(`${area}|${i}`, no);
      linha.append(no);
    });
    corpo.append(linha);
  });
  const nota = el('div', { class: 'ar-antes-nota', 'aria-hidden': 'true' }, el('span', { text: textoAntes() }));
  nota.style.setProperty('--ar-antes', String(inicioMinimo()));
  corpo.append(nota);
  mapa.replaceChildren(el('div', { class: 'ar-mapa-cabeca', role: 'rowgroup' }, linhaAnos), corpo);
  mapa.setAttribute('aria-label', t(`mapa_rotulo_${estado.metrica}`, { nos: t(`nos_${estado.resumos}`) }));
  foco.r = Math.min(foco.r, ordem.length - 1);
}

function rotuloCelula(c) {
  const lugar = `${nomeArea(c.area)}, ${anoTexto(c.i)}: `;
  if (c.situacao === 'antes') return lugar + t('celula_antes');
  if (c.situacao === 'semMarcadoras') return lugar + t('sem_estimativa');
  if (c.situacao === 'nenhum') return lugar + t('dica_nenhum');
  if (c.situacao !== 'ok') return lugar + t('celula_poucos', { n: nResumos(c.n) });
  return lugar + t(`celula_${estado.metrica}`, { v: fmtValor(c.valor), n: nResumos(c.n) });
}

function pintarMapa() {
  const livre = estado.modo === 'livre';
  for (const [chave, no] of celulas) {
    const [area, k] = chave.split('|');
    const i = Number(k);
    const c = celula(area, i);
    const futura = !livre && i > estado.i;
    const semEstimativa = c.situacao === 'antes' || c.situacao === 'semMarcadoras';
    const classes = ['ar-celula'];
    if (futura) classes.push('ar-futura');
    else if (c.situacao === 'ok') classes.push(`ar-c${faixaDe(c.valor)}`);
    else if (semEstimativa) classes.push('ar-antes');
    else classes.push('hachura');
    if (i === estado.i && (!livre || !estado.area) && !semEstimativa) classes.push('ar-col');
    if (livre && estado.area === area && i === estado.i) classes.push('ar-aberta');
    no.className = classes.join(' ');
    no.setAttribute('aria-label', futura ? `${nomeArea(area)}, ${anoTexto(i)}` : rotuloCelula(c));
    no.setAttribute('aria-selected', String(livre && estado.area === area && i === estado.i));
  }
  cabecas.forEach((cab, i) => {
    const escolhido = i === estado.i;
    cab.classList.toggle('ar-ano-escolhido', escolhido);
    cab.classList.toggle('ar-ano-futuro', !livre && i > estado.i);
    const nota = i === ULTIMO ? t('parcial') : (escolhido && livre ? t('escolhido') : '');
    cab.querySelector('.ar-ano-nota').textContent = nota;
  });
  refs.mapa.classList.toggle('ar-modo-minimo', estado.metrica === 'minimo');
  atualizarTabIndex();
}

function atualizarTabIndex() {
  foco.c = Math.max(0, Math.min(ULTIMO, foco.c));
  for (const no of celulas.values()) no.tabIndex = -1;
  const alvo = celulas.get(`${ordem[foco.r]}|${foco.c}`);
  if (alvo) alvo.tabIndex = 0;
}

function focarCelula(r, c) {
  foco = { r: Math.max(0, Math.min(ordem.length - 1, r)), c: Math.max(0, Math.min(ULTIMO, c)) };
  atualizarTabIndex();
  celulas.get(`${ordem[foco.r]}|${foco.c}`)?.focus();
}

// ---------- Dica ----------
function conteudoDicaCelula(c) {
  const sub = `${nomeArea(c.area)} · ${anoTexto(c.i)}`;
  if (c.situacao === 'antes') return conteudoDica({ sub, valor: t('sem_estimativa'), leitura: textoAntes() });
  if (c.situacao === 'semMarcadoras') return conteudoDica({ sub, valor: t('sem_estimativa'), extra: nResumos(c.n), leitura: t('cartao_sem_marcadoras') });
  if (c.situacao === 'nenhum') return conteudoDica({ sub, valor: t('dica_nenhum') });
  if (c.situacao !== 'ok') {
    return conteudoDica({
      sub, valor: t('dica_poucos'), extra: nResumos(c.n),
      leitura: t(estado.metrica === 'minimo' ? 'dica_poucos_minimo' : 'dica_poucos_indice'),
    });
  }
  if (estado.metrica === 'minimo') {
    // Abaixo de zero, "no mínimo −3%" não diz nada: o número fica sozinho e a leitura explica.
    const ep = t('dica_ep', { ep: fmt.num(c.ep * 100, 1) });
    return c.valor < 0
      ? conteudoDica({ sub, valor: fmtValor(c.valor), extra: nResumos(c.n), leitura: `${t('dica_minimo_neg')} ${ep}` })
      : conteudoDica({ sub, valor: t('dica_minimo', { v: fmtValor(c.valor) }), extra: nResumos(c.n), leitura: ep });
  }
  return conteudoDica({
    sub, valor: t('dica_indice', { v: fmtValor(c.valor) }), extra: nResumos(c.n),
    leitura: c.base != null ? t('dica_parcela', { agora: fmt.pct(c.parcela, 1), antes: fmt.pct(c.base, 1) }) : null,
  });
}

function mostrarDica(no) {
  const area = no.dataset.area;
  const i = Number(no.dataset.i);
  if (estado.modo !== 'livre' && i > estado.i) { dica.esconder(); return; }
  const caixa = refs.caixaMapa.getBoundingClientRect();
  const r = no.getBoundingClientRect();
  // A dica abre ao lado da célula sem cobri-la: à esquerda a partir da 5ª coluna, à direita antes.
  const x = i >= 4 ? r.left - caixa.left + 8 : r.right - caixa.left - 8;
  dica.mostrar(conteudoDicaCelula(celula(area, i)), { x, y: r.top - caixa.top + r.height / 2 });
}

// ---------- Cartão da célula ----------
function fecharCartao({ devolverFoco = false } = {}) {
  if (!estado.area) return;
  const area = estado.area;
  estado.area = null;
  desenharCartao();
  pintarMapa();
  gravar();
  if (devolverFoco) {
    const r = ordem.indexOf(area);
    focarCelula(r < 0 ? 0 : r, estado.i);
  }
}

function abrirCartao(area, i, { focar = false } = {}) {
  pararReproducao();
  estado.area = area;
  estado.i = i;
  foco = { r: Math.max(0, ordem.indexOf(area)), c: i };
  dica?.esconder();
  doAno();
  gravar();
  if (focar) cartao?.querySelector('.ar-cartao-fechar')?.focus({ preventScroll: !largo.matches });
  // Tablet e celular: o cartão entra abaixo da legenda e pode ficar fora da tela.
  if (!largo.matches) cartao?.scrollIntoView({ block: 'nearest', behavior: semMovimento() ? 'auto' : 'smooth' });
}

function blocoValor(c) {
  const l = estado.resumos;
  const resumos = t(`resumos_${l}`);
  if (c.situacao === 'nenhum' || (c.situacao === 'sem' && c.n === 0)) return [el('p', { class: 't-p ar-cartao-texto', text: t('cartao_sem') })];
  if (estado.metrica === 'minimo') {
    const partes = [];
    if (c.situacao === 'antes') partes.push(el('p', { class: 't-p ar-cartao-texto', text: textoAntes() }));
    else if (c.situacao === 'semMarcadoras') partes.push(el('p', { class: 't-p ar-cartao-texto', text: t('cartao_sem_marcadoras') }));
    else if (c.situacao !== 'ok') partes.push(el('p', { class: 't-p ar-cartao-texto', text: t('cartao_poucos_minimo') }));
    else {
      const ep = fmt.num(c.ep * 100, 1);
      partes.push(el('p', { class: 'ar-cartao-valor' },
        el('span', { class: 't-numero num', text: fmtValor(c.valor) }),
        el('span', { class: 't-p', text: c.valor < 0 ? t('cartao_minimo_neg', { ep }) : t('cartao_minimo', { resumos, ep }) })));
    }
    if (c.indiceOk) partes.push(el('p', { class: 't-p ar-cartao-texto', text: t('cartao_indice_linha', { v: fmt.num(c.indice, 2) }) }));
    return partes;
  }
  if (c.situacao !== 'ok') return [el('p', { class: 't-p ar-cartao-texto', text: t('cartao_poucos_indice') })];
  return [
    el('p', { class: 'ar-cartao-valor' },
      el('span', { class: 't-numero num', text: fmtValor(c.valor) }),
      el('span', { class: 't-p', text: t('cartao_indice') })),
    c.base != null && el('p', { class: 't-p ar-cartao-texto', text: t('cartao_parcela', { agora: fmt.pct(c.parcela, 1), antes: fmt.pct(c.base, 1), resumos }) }),
  ];
}

function blocoPalavras(c) {
  const l = estado.resumos;
  const titulo = el('p', { class: 't-rotulo', text: t('cartao_top') });
  if (c.n === 0) return null;
  if (c.area === 'todas') return el('div', { class: 'ar-cartao-secao' }, titulo, el('p', { class: 't-legenda', text: t('cartao_top_todas') }));
  if (c.i < I2023) return el('div', { class: 'ar-cartao-secao' }, titulo, el('p', { class: 't-legenda', text: t('cartao_top_antes') }));
  const lista = D.top[l]?.[c.area]?.[String(c.ano)] || [];
  if (!lista.length) return el('div', { class: 'ar-cartao-secao' }, titulo, el('p', { class: 't-legenda', text: t('cartao_top_vazio', { ano: c.ano }) }));
  return el('div', { class: 'ar-cartao-secao' }, titulo,
    el('div', { class: 'ar-chips' }, lista.map(([palavra, razao]) => el('button', {
      type: 'button', class: 'chip-sug ar-chip', lang: langDe(l), dataset: { palavra: `${palavra}.${l}` },
    },
    el('span', { class: 'w', text: palavra }),
    el('span', { class: 'ar-chip-razao num', 'aria-hidden': 'true', text: fmt.razao(razao) }),
    el('span', { class: 'sr', lang: langDe(document.documentElement.dataset.lingua), text: `, ${fmt.num(razao, 1)} ${t('cartao_razao_sr')}` })))));
}

/** As séries do índice da área nas duas línguas, sem os anos com menos de 100 resumos. */
function seriesMini(area) {
  const linguas = [estado.resumos, estado.resumos === 'en' ? 'pt' : 'en'];
  const series = [];
  const sem = [];
  for (const l of linguas) {
    const ind = serie('indice', l, area);
    const n = serie('resumos', l, area);
    const obs = ind.map((v, k) => (n[k] >= MIN_INDICE && v != null ? v : null));
    if (obs[I2021] == null || obs[I2022] == null) { sem.push(l); continue; }
    series.push({ palavra: nomeArea(area), lingua: l, obs, esp: null });
  }
  return { series, sem };
}

function blocoMini(c) {
  const { series, sem } = seriesMini(c.area);
  const legenda = el('div', { class: 'legenda ar-mini-legenda', 'aria-hidden': 'true' },
    series.map((s) => el('span', { class: 'legenda-item' }, el('span', { class: `chave chave-${s.lingua}` }), siglaLingua(s.lingua))),
    el('span', { class: 'legenda-item' }, el('span', { class: 'am-marco' }), t('marco_chatgpt_curto')));
  const caixa = el('div', { class: 'ar-mini' });
  const notas = [
    ...sem.map((l) => el('p', { class: 't-legenda', text: t('mini_sem', { sigla: siglaLingua(l) }) })),
    series.length ? el('p', { class: 't-legenda', text: t('mini_nota') }) : null,
  ];
  const bloco = el('div', { class: 'ar-cartao-secao ar-cartao-mini', role: 'group', 'aria-label': t('mini_titulo', { area: nomeArea(c.area) }) },
    series.length ? legenda : null, series.length ? caixa : null, ...notas);
  return { bloco, caixa, series };
}

function desenharCartao() {
  cartaoGrafico?.destruir();
  cartaoGrafico = null;
  if (!estado.area || estado.modo !== 'livre') {
    cartao?.remove();
    cartao = null;
    return;
  }
  const c = celula(estado.area, estado.i);
  const l = estado.resumos;
  const fechar = el('button', {
    class: 'btn btn-fantasma btn-icone btn-p ar-cartao-fechar', type: 'button', 'aria-label': t('cartao_fechar'),
    on: { click: () => fecharCartao({ devolverFoco: true }) },
  }, icone('fechar'));
  const mini = blocoMini(c);
  const novo = el('div', {
    class: 'cartao ar-cartao', role: 'dialog', 'aria-labelledby': 'ar-cartao-titulo',
    on: { keydown: (evento) => { if (evento.key === 'Escape') { evento.stopPropagation(); fecharCartao({ devolverFoco: true }); } } },
  },
  el('div', { class: 'ar-cartao-topo' },
    el('div', { class: 'ar-cartao-cabeca' },
      el('h3', { class: 't-h3 ar-cartao-titulo', id: 'ar-cartao-titulo', text: `${nomeArea(c.area)} · ${anoTexto(c.i)}` }),
      el('p', { class: 't-legenda' }, `${t(`cartao_lingua_${l}`)} · `, el('span', { class: 'num', text: nResumos(c.n) }))),
    fechar),
  ...blocoValor(c),
  blocoPalavras(c),
  mini.bloco);
  const tinhaFoco = cartao?.contains(document.activeElement);
  if (cartao) cartao.replaceWith(novo);
  cartao = novo;
  colocarCartao();
  if (mini.series.length) {
    cartaoGrafico = linhaTempo(mini.caixa, {
      series: mini.series, escala: 'relativa', esperado: false, altura: 140, compacto: true,
      rotuloDireto: false, rotuloParcial: true, marco: true, anel: 'var(--superficie)',
      titulo: t('mini_titulo', { area: nomeArea(c.area) }),
      resumo: () => t('mini_resumo', {
        area: nomeArea(c.area),
        valores: mini.series.map((s) => t('mini_valor', {
          v: s.obs[I2025] == null ? t('sem_dado') : fmt.num(s.obs[I2025], 2), nos: t(`nos_${s.lingua}`),
        })).join('; '),
      }),
    });
  }
  if (tinhaFoco) fechar.focus();
}

/** Desktop: o cartão flutua ao lado da célula. Tablet e celular: entra abaixo da legenda. */
function colocarCartao() {
  if (!cartao) return;
  if (!largo.matches) {
    cartao.classList.remove('ar-cartao-flutua');
    cartao.style.left = '';
    cartao.style.top = '';
    if (cartao.parentNode !== refs.cartaoLugar) refs.cartaoLugar.append(cartao);
    return;
  }
  cartao.classList.add('ar-cartao-flutua');
  if (cartao.parentNode !== refs.caixaMapa) refs.caixaMapa.append(cartao);
  const no = celulas.get(`${estado.area}|${estado.i}`);
  if (!no) return;
  const caixa = refs.caixaMapa.getBoundingClientRect();
  const r = no.getBoundingClientRect();
  const limite = refs.grade.getBoundingClientRect().right - caixa.left;
  const largura = cartao.offsetWidth;
  let left = r.right - caixa.left + 14;
  if (left + largura > limite) left = r.left - caixa.left - 14 - largura;
  left = Math.max(0, Math.min(left, limite - largura));
  // Perto da linha da célula, mas sem passar muito do pé do mapa (o cartão cabe na primeira dobra).
  // Nunca acima da primeira linha de células, para não cobrir o ano grande ao lado.
  const fundo = caixa.height + 160;
  const primeira = refs.mapa.querySelector('.ar-mapa-corpo').getBoundingClientRect().top - caixa.top - 8;
  const top = Math.max(primeira, Math.min(r.top - caixa.top - 8, fundo - cartao.offsetHeight));
  cartao.style.left = `${Math.round(left)}px`;
  cartao.style.top = `${Math.round(top)}px`;
}

// ---------- Barras do ano escolhido ----------
function dominioBarras() {
  const base = estado.metrica === 'indice' ? 1 : 0;
  let lo = base;
  let hi = base;
  for (const area of LINHAS) {
    for (let i = 0; i < ANOS.length; i += 1) {
      const c = celula(area, i);
      if (c.situacao !== 'ok') continue;
      lo = Math.min(lo, c.valor);
      hi = Math.max(hi, c.valor);
    }
  }
  if (hi === lo) hi = lo + 1;
  return { base, pos: (v) => (100 * (v - lo)) / (hi - lo) };
}

function itemBarra(area) {
  if (barrasItens.has(area)) return barrasItens.get(area);
  const nome = el('span', { class: 'ar-barra-area' });
  const delta = el('span', { class: 'num t-legenda ar-barra-delta', 'aria-hidden': 'true' });
  const deltaSr = el('span', { class: 'sr' });
  const base = el('span', { class: 'ar-barra-base' });
  const barra = el('span', { class: 'ar-barra' });
  const valor = el('span', { class: 'ar-barra-valor num' });
  const nota = el('span', { class: 't-legenda ar-barra-nota' });
  const li = el('li', { class: `ar-barra-item${area === 'todas' ? ' ar-barra-todas' : ''}`, dataset: { area } },
    el('div', { class: 'ar-barra-topo' }, nome, delta),
    el('div', { class: 'ar-barra-trilho' }, el('div', { class: 'ar-barra-dentro' }, base, barra, valor), nota),
    deltaSr);
  const item = { li, nome, delta, deltaSr, base, barra, valor, nota };
  barrasItens.set(area, item);
  return item;
}

function desenharLado() {
  const i = estado.i;
  const ano = ANOS[i];
  const metrica = estado.metrica;
  // Ano grande e nota.
  refs.anoGrande.textContent = String(ano);
  refs.anoTocador.textContent = String(ano);
  const nota = estado.modo === 'tocando'
    ? [t('reproduzindo'), t('reproduzindo_de', { ini: ANOS[0], fim: ANOS[ULTIMO] })]
    : estado.modo === 'pausado'
      ? [t('pausado'), t('pausado_dica')]
      : [i === ULTIMO ? t('ano_parcial') : t('ano_escolhido'), t('ano_dica')];
  refs.anoNota.replaceChildren(nota[0], el('br'), nota[1]);

  refs.ladoTitulo.textContent = celular.matches ? t('lado_titulo_curto', { ano }) : t(`lado_titulo_${metrica}`, { ano });
  const pe = [t(`lado_pe_${metrica}`)];
  // A variação só existe quando o ano anterior também tem estimativa.
  if (i > 0 && !(metrica === 'minimo' && (i <= I2023 || semMarcadoras(i - 1)))) pe.push(t(metrica === 'minimo' ? 'lado_pe_variacao_pp' : 'lado_pe_variacao', { anterior: ANOS[i - 1] }));
  refs.ladoPe.textContent = pe.join(' ');

  if (metrica === 'minimo' && (i < I2023 || semMarcadoras(i))) {
    const texto = i < I2023 ? t('lado_antes', { ano: ANOS[inicioMinimo()] }) : t('cartao_sem_marcadoras');
    refs.barras.replaceChildren(el('li', { class: 't-p ar-barras-vazio', text: texto }));
    refs.ladoPe.textContent = '';
    return;
  }
  const { base, pos } = dominioBarras();
  const celulasAno = AREAS.map((area) => celula(area, i));
  celulasAno.sort((a, b) => {
    const oa = a.situacao === 'ok';
    const ob = b.situacao === 'ok';
    if (oa !== ob) return oa ? -1 : 1;
    if (oa && b.valor !== a.valor) return b.valor - a.valor;
    return ordem.indexOf(a.area) - ordem.indexOf(b.area);
  });
  celulasAno.push(celula('todas', i));
  const itens = celulasAno.map((c) => {
    const item = itemBarra(c.area);
    item.nome.textContent = nomeArea(c.area);
    const anterior = i > 0 ? celula(c.area, i - 1) : null;
    const ok = c.situacao === 'ok';
    if (ok && anterior?.situacao === 'ok') {
      const d = fmtDelta(c.valor - anterior.valor);
      item.delta.textContent = `(${d})`;
      item.deltaSr.textContent = t('lado_variacao', { anterior: ANOS[i - 1], v: d });
    } else {
      item.delta.textContent = '';
      item.deltaSr.textContent = '';
    }
    item.li.classList.toggle('ar-barra-sem', !ok);
    if (!ok) {
      item.nota.textContent = c.situacao === 'nenhum' ? t('lado_nenhum') : t('lado_poucos');
      item.valor.textContent = '';
      return item.li;
    }
    item.nota.textContent = '';
    const x0 = pos(base);
    const x1 = pos(c.valor);
    const negativo = c.valor < base;
    item.base.style.left = `${x0}%`;
    item.barra.classList.toggle('ar-barra-neg', negativo);
    item.barra.style.left = `${Math.min(x0, x1)}%`;
    item.barra.style.width = `${Math.max(Math.abs(x1 - x0), 0.6)}%`;
    item.valor.style.left = `calc(${Math.max(x0, x1)}% + 8px)`;
    item.valor.textContent = fmtValor(c.valor);
    return item.li;
  });
  refs.barras.replaceChildren(...itens);
}

// ---------- Tocador e régua ----------
function desenharTocador() {
  const tocando = estado.modo === 'tocando';
  const rotulo = tocando ? t('pausar') : estado.modo === 'pausado' && estado.i < ULTIMO ? t('continuar') : t('tocar');
  refs.tocar.replaceChildren(icone(tocando ? 'pausa' : 'play', 'ic'), el('span', { class: 'ar-tocar-texto', text: rotulo }));
  const f = estado.i / ULTIMO;
  refs.feito.style.width = `calc((100% - 16px) * ${f})`;
  refs.pega.style.left = `calc(8px + (100% - 16px) * ${f})`;
  refs.regua.setAttribute('aria-valuenow', String(ANOS[estado.i]));
  refs.regua.setAttribute('aria-valuetext', estado.i === ULTIMO ? t('regua_parcial', { ano: ANOS[ULTIMO] }) : String(ANOS[estado.i]));
}

function doAno() {
  pintarMapa();
  desenharLado();
  desenharTocador();
  desenharCartao();
}

function tocar() {
  if (estado.modo === 'tocando') { pausar(); return; }
  if (estado.modo !== 'pausado' || estado.i >= ULTIMO) estado.i = 0;
  estado.modo = 'tocando';
  estado.area = null;
  dica?.esconder();
  anunciar(t('vivo_tocando', { ini: ANOS[0], fim: ANOS[ULTIMO] }));
  doAno();
  timer = setInterval(() => {
    if (estado.i < ULTIMO) {
      estado.i += 1;
      doAno();
    }
    if (estado.i >= ULTIMO) terminar();
  }, PASSO_MS);
}

function pausar() {
  clearInterval(timer);
  timer = null;
  estado.modo = 'pausado';
  anunciar(t('vivo_pausado', { ano: ANOS[estado.i] }));
  doAno();
  gravar();
}

function terminar() {
  clearInterval(timer);
  timer = null;
  estado.modo = 'livre';
  foco.c = estado.i;
  anunciar(t('vivo_fim', { ano: ANOS[estado.i] }));
  doAno();
  gravar();
}

/** Sai de Reproduzir (tocando ou pausado) e volta ao mapa inteiro. */
function pararReproducao() {
  clearInterval(timer);
  timer = null;
  estado.modo = 'livre';
}

/** Régua, cabeçalho de coluna: troca o ano. Pausado, as colunas se preenchem até ele. */
function escolherAno(i) {
  i = Math.max(0, Math.min(ULTIMO, i));
  if (estado.modo === 'tocando') {
    clearInterval(timer);
    timer = null;
    estado.modo = 'pausado';
  }
  if (i === estado.i) { desenharTocador(); return; }
  estado.i = i;
  foco.c = i;
  doAno();
  gravar();
}

function ligarRegua() {
  const regua = refs.regua;
  let arrastando = false;
  const deX = (x) => {
    const r = regua.getBoundingClientRect();
    const f = (x - r.left - 8) / Math.max(1, r.width - 16);
    return Math.round(f * ULTIMO);
  };
  regua.addEventListener('pointerdown', (evento) => {
    if (evento.button !== 0) return;
    arrastando = true;
    regua.setPointerCapture(evento.pointerId);
    regua.focus({ preventScroll: true });
    escolherAno(deX(evento.clientX));
  });
  regua.addEventListener('pointermove', (evento) => { if (arrastando) escolherAno(deX(evento.clientX)); });
  const soltar = () => { arrastando = false; };
  regua.addEventListener('pointerup', soltar);
  regua.addEventListener('pointercancel', soltar);
  regua.addEventListener('keydown', (evento) => {
    const i = estado.i;
    const destino = {
      ArrowLeft: i - 1, ArrowDown: i - 1, ArrowRight: i + 1, ArrowUp: i + 1,
      PageDown: i - 3, PageUp: i + 3, Home: 0, End: ULTIMO,
    }[evento.key];
    if (destino == null) return;
    evento.preventDefault();
    escolherAno(destino);
  });
}

// ---------- Legenda, explicação e leitura ----------
function desenharLegenda() {
  const metrica = estado.metrica;
  const limites = FAIXAS[metrica];
  const faixas = limites.length + 1;
  const textoFaixa = (k) => {
    if (k === 0) return t(metrica === 'minimo' ? 'leg_menos' : 'leg_ate', { v: fmtLimite(limites[0]) });
    if (k === faixas - 1) return t('leg_mais', { v: fmtLimite(limites[k - 1]) });
    return t('leg_faixa', { a: fmtLimite(limites[k - 1]), b: fmtLimite(limites[k]) });
  };
  // O rótulo do meio fica na borda da faixa central: 1,5 no índice, 9% na estimativa mínima.
  const meio = Math.floor((limites.length - 1) / 2);
  const escala = el('div', {
    class: 'ar-escala', role: 'img',
    'aria-label': `${t(`leg_escala_${metrica}`)}: ${Array.from({ length: faixas }, (_, k) => textoFaixa(k)).join('; ')}`,
  },
  el('div', { class: 'ar-escala-cores' }, Array.from({ length: faixas }, (_, k) => el('span', { class: `ar-c${k}` }))),
  el('div', { class: 'ar-escala-rotulos t-legenda num', 'aria-hidden': 'true' },
    el('span', { class: 'ar-escala-ini', text: textoFaixa(0) }),
    el('span', { class: 'ar-escala-meio', style: { left: `${(100 * (meio + 1)) / faixas}%` }, text: fmtLimite(limites[meio]) }),
    el('span', { class: 'ar-escala-fim', text: textoFaixa(faixas - 1) })));
  refs.legenda.replaceChildren(escala,
    el('span', { class: 'legenda-item t-legenda ar-leg-hachura' }, el('span', { class: 'hachura ar-am-hachura' }), t('leg_poucos')));
  refs.explica.textContent = t(`explica_${metrica}`, { resumos: t(`resumos_${estado.resumos}_longo`), ini: ANOS[inicioMinimo()] });
}

function desenharLeitura() {
  const l = estado.resumos;
  const Nos = t(`Nos_${l}`);
  const caixa = $('ar-leitura');
  $('ar-como').textContent = t(estado.metrica === 'minimo' ? 'como_minimo' : 'como_calculamos');
  const extremos = (k, metrica) => {
    const oks = AREAS.map((a) => celula(a, k, l, metrica)).filter((c) => c.situacao === 'ok');
    if (!oks.length) return null;
    oks.sort((a, b) => a.valor - b.valor);
    return { oks, lo: oks[0], hi: oks[oks.length - 1] };
  };
  if (estado.metrica === 'minimo') {
    const e = extremos(I2025, 'minimo');
    const todas = D.todas.minimo[l][I2025];
    const todasTexto = todas == null ? t('sem_dado') : fmt.pct(todas, 1);
    if (!e || e.oks.length < 2) {
      caixa.textContent = t('leitura_minimo_poucas', { Nos, ini: ANOS[inicioMinimo()], ano: 2025, todas: todasTexto });
      return;
    }
    const ep = Math.max(...e.oks.map((c) => c.ep || 0));
    caixa.textContent = t('leitura_minimo', {
      Nos, ini: ANOS[inicioMinimo()], ano: 2025, lo: fmt.pct(e.lo.valor, 1), areaLo: nomeArea(e.lo.area), hi: fmt.pct(e.hi.valor, 1),
      areaHi: nomeArea(e.hi.area), todas: todasTexto, ep: fmt.num(ep * 100, 1),
    });
    return;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const a of AREAS) {
    for (let k = 0; k <= I2022; k += 1) {
      const c = celula(a, k, l, 'indice');
      if (c.situacao !== 'ok') continue;
      min = Math.min(min, c.valor);
      max = Math.max(max, c.valor);
    }
  }
  let depois = '';
  for (let k = I2023; k <= I2025; k += 1) {
    const e = extremos(k, 'indice');
    if (e && e.oks.length >= 2 && e.lo.valor > max) {
      depois = t('leitura_primeiro', { ano: ANOS[k], lo: fmt.num(e.lo.valor, 2), areaLo: nomeArea(e.lo.area), hi: fmt.num(e.hi.valor, 2), areaHi: nomeArea(e.hi.area) });
      break;
    }
  }
  if (!depois) {
    const e = extremos(I2025, 'indice');
    if (e) depois = t('leitura_ultimo', { ano: 2025, lo: fmt.num(e.lo.valor, 2), areaLo: nomeArea(e.lo.area), hi: fmt.num(e.hi.valor, 2), areaHi: nomeArea(e.hi.area) });
  }
  caixa.textContent = t('leitura_indice', {
    Nos, ini: ANOS[0], min: fmt.num(min, 2), max: fmt.num(max, 2), depois, n: fmt.num(D.marcadoras[l]),
  }).replace(/\s{2,}/g, ' ');
}

// ---------- Tabela ----------
function criarTabela() {
  const metrica = estado.metrica;
  const indices = ANOS.map((_, i) => i).filter((i) => metrica === 'indice' || i >= I2023);
  const colunas = [{ rotulo: t('col_area') }, ...indices.map((i) => ({
    rotulo: i === ULTIMO ? el('span', {}, String(ANOS[i]), ' ', el('span', { class: 'etq-nota', text: t('parcial') })) : String(ANOS[i]),
    num: true,
  }))];
  const linhas = ordem.map((area) => [
    { conteudo: nomeArea(area), classe: area === 'todas' ? 'ar-tab-todas' : null },
    ...indices.map((i) => {
      const c = celula(area, i);
      const fora = { sem: t('sem_dado'), nenhum: '0', semMarcadoras: t('sem_estimativa') };
      const valor = c.situacao === 'ok' ? fmtValor(c.valor) : fora[c.situacao] ?? t('tabela_poucos');
      return {
        conteudo: el('span', { class: 'ar-tab-celula' },
          el('span', { class: c.situacao === 'ok' ? 'ar-tab-valor' : 'ar-tab-valor ar-tab-fora', text: valor }),
          el('span', { class: 'ar-tab-n', text: fmt.num(c.n) })),
      };
    }),
  ]);
  // Sem o mapa à vista, a nota diz por que um ano inteiro fica sem estimativa mínima.
  const sem = metrica === 'minimo' ? D.minimo_sem_marcadoras?.[estado.resumos] || [] : [];
  const nota = [t(`tabela_nota_${metrica}`), sem.length ? t('tabela_nota_sem_marcadoras', { anos: listaAnos(sem) }) : null];
  return el('div', { class: 'ar-tabela' },
    tabela(colunas, linhas, {
      legenda: t(`tabela_legenda_${metrica}`, { nos: t(`nos_${estado.resumos}`) }),
      minLargura: metrica === 'indice' ? 760 : 420,
    }),
    el('p', { class: 't-legenda', text: nota.filter(Boolean).join(' ') }));
}

// ---------- Filtros ----------
function mudar() {
  ordem = calcularOrdem();
  barrasItens.clear();
  montarMapa();
  desenharLegenda();
  desenharLeitura();
  doAno();
  botaoTab?.atualizar();
  gravar();
}

function montarControles() {
  $('ar-acoes').append(botaoCopiarLink('btn btn-p'));
  filtros.metrica = segmentos({
    rotulo: t('metrica'), valor: estado.metrica,
    opcoes: [{ valor: 'indice', texto: t('metrica_indice') }, { valor: 'minimo', texto: t('metrica_minimo') }],
    aoMudar: (v) => { estado.metrica = v; if (D) mudar(); else gravar(); },
  });
  filtros.resumos = filtroResumos({
    valor: estado.resumos,
    aoMudar: (v) => { estado.resumos = v; if (D) mudar(); else gravar(); },
  });
  $('ar-filtros').append(filtros.metrica, filtros.resumos);
}

function posicionarBotoes() {
  if (!botaoTab || !refs.acoesCelular) return;
  const destino = celular.matches ? refs.acoesCelular : $('ar-acao-tabela');
  destino.prepend(botaoTab.botao);
}

// ---------- Aviso de link ----------
function mostrarAviso(ruins) {
  if (!ruins.length) return;
  const lista = ruins.length === 1 ? ruins[0] : `${ruins.slice(0, -1).join(t('aviso_virgula'))}${t('aviso_e')}${ruins[ruins.length - 1]}`;
  $('ar-aviso').replaceChildren(avisoLink(`${t('aviso_inicio')}${lista}${t(ruins.length === 1 ? 'aviso_nao_existe_1' : 'aviso_nao_existe_n')}${t('aviso_mostramos', {
    metrica: t(`mostra_${estado.metrica}`), ano: ANOS[estado.i], nos: t(`nos_${estado.resumos}`),
  })}`));
}

// ---------- Início ----------
function lerEndereco() {
  const url = lerUrl();
  const ruins = [];
  if (url.resumos != null) {
    if (url.resumos === 'pt' || url.resumos === 'en') estado.resumos = url.resumos;
    else ruins.push(t('aviso_resumos', { v: escapar(url.resumos) }));
  }
  if (url.metrica != null) {
    if (url.metrica === 'indice' || url.metrica === 'minimo') estado.metrica = url.metrica;
    else ruins.push(t('aviso_metrica', { v: escapar(url.metrica) }));
  }
  if (url.ano != null) {
    const i = /^\d{4}$/.test(url.ano) ? ANOS.indexOf(Number(url.ano)) : -1;
    if (i >= 0) estado.i = i;
    else ruins.push(t('aviso_ano', { v: escapar(url.ano) }));
  }
  if (url.area != null) {
    if (LINHAS.includes(url.area)) estado.area = url.area;
    else ruins.push(t('aviso_area', { v: escapar(url.area) }));
  }
  foco.c = estado.i;
  return ruins;
}

function ligarMapa() {
  const mapa = refs.mapa;
  dica = criarDica(refs.caixaMapa, { fixaNoCelular: false });
  mapa.addEventListener('click', (evento) => {
    const no = evento.target.closest('.ar-celula');
    if (no) {
      abrirCartao(no.dataset.area, Number(no.dataset.i));
      return;
    }
    const cab = evento.target.closest('.ar-ano-col');
    if (cab) escolherAno(Number(cab.dataset.i));
  });
  mapa.addEventListener('pointerover', (evento) => {
    if (evento.pointerType === 'touch') return;
    const no = evento.target.closest('.ar-celula');
    if (no) mostrarDica(no);
  });
  mapa.addEventListener('pointerleave', () => {
    if (!mapa.contains(document.activeElement)) dica.esconder();
  });
  mapa.addEventListener('focusin', (evento) => {
    const no = evento.target.closest('.ar-celula');
    if (!no) return;
    foco = { r: Number(no.dataset.r), c: Number(no.dataset.i) };
    atualizarTabIndex();
    // Só com o teclado: um toque também dá foco à célula, e ali quem responde é o cartão.
    if (no.matches(':focus-visible')) mostrarDica(no);
  });
  mapa.addEventListener('focusout', (evento) => {
    if (!mapa.contains(evento.relatedTarget)) dica.esconder();
  });
  mapa.addEventListener('keydown', (evento) => {
    const no = evento.target.closest('.ar-celula');
    if (!no) return;
    const r = Number(no.dataset.r);
    const c = Number(no.dataset.i);
    const k = evento.key;
    if (k === 'Enter' || k === ' ') {
      evento.preventDefault();
      abrirCartao(no.dataset.area, c, { focar: true });
      return;
    }
    if (k === 'Escape') {
      dica.esconder();
      if (estado.area) fecharCartao();
      return;
    }
    const destino = {
      ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1], ArrowUp: [r - 1, c], ArrowDown: [r + 1, c],
      Home: evento.ctrlKey ? [0, 0] : [r, 0], End: evento.ctrlKey ? [ordem.length - 1, ULTIMO] : [r, ULTIMO],
      PageUp: [0, c], PageDown: [ordem.length - 1, c],
    }[k];
    if (!destino) return;
    evento.preventDefault();
    focarCelula(...destino);
  });
}

async function iniciar() {
  const ruins = lerEndereco();
  montarControles();
  const carga = $('ar-carga');
  D = await carregarEm(carga, 'areas.json', { altura: 460, erroTexto: t('erro_texto_tela') });
  carga.replaceChildren($('ar-modelo').content.cloneNode(true));
  refs = {
    grade: carga.querySelector('.ar-grade'), figura: $('ar-figura'), tocar: $('ar-tocar'), regua: $('ar-regua'),
    feito: $('ar-regua-feito'), pega: $('ar-regua-pega'), anoTocador: $('ar-ano-tocador'), caixaMapa: $('ar-mapa-caixa'),
    mapa: $('ar-mapa'), legenda: $('ar-legenda'), explica: $('ar-explica'), cartaoLugar: $('ar-cartao-lugar'),
    acoesCelular: $('ar-acoes-celular'), tabelaLugar: $('ar-tabela-lugar'), anoGrande: $('ar-ano-grande'),
    anoNota: $('ar-ano-nota'), ladoTitulo: $('ar-lado-titulo'), barras: $('ar-barras'), ladoPe: $('ar-lado-pe'),
  };
  refs.regua.setAttribute('aria-valuemin', String(ANOS[0]));
  refs.regua.setAttribute('aria-valuemax', String(ANOS[ULTIMO]));
  refs.acoesCelular.append(botaoCopiarLink('btn btn-p'));
  refs.tocar.addEventListener('click', tocar);
  ligarRegua();
  ligarMapa();
  botaoTab = botaoTabela({
    grafico: refs.figura, lugar: refs.tabelaLugar, criar: criarTabela,
    // No desktop, as barras saem com a tabela, que fica com a largura toda (areas.css).
    aoMudar: (mostrando) => refs.grade.classList.toggle('ar-com-tabela', mostrando),
  });
  posicionarBotoes();
  mudar();
  mostrarAviso(ruins);
}

largo.addEventListener('change', () => colocarCartao());
celular.addEventListener('change', () => { posicionarBotoes(); if (D) desenharLado(); });
let quadro = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(quadro);
  quadro = requestAnimationFrame(() => colocarCartao());
});
document.fonts?.ready.then(() => colocarCartao());

iniciar();
