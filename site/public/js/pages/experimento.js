// IAês · Máquina do tempo (spec 4.6; d-experimento, m-experimento, e-experimento-modelos,
// e-experimento-traduzir). Três partes:
//   1. um resumo antes e depois: diferenças palavra a palavra calculadas aqui (melhorar a escrita)
//      ou as marcadoras realçadas na tradução do modelo e na dos autores (traduzir);
//   2. o que cada modelo insere: barras de experimento/<tarefa>.json (insere, resumo);
//   3. a prova cruzada: excesso no SciELO em 2025 contra inserção pelos modelos (prova.json).
// Estado no endereço: ?tarefa=traduzir&resumo=tr-012&modelo=chatgpt. Na tarefa de melhorar, a
// língua sai do identificador do resumo (pt-001, en-001); sem resumo, ?lingua=en também vale.
// Dados: experimento/<tarefa>.json, experimento/prova.json e, na tarefa de traduzir,
// marcadoras.json (o nível de realce de cada marcadora). Nenhum número é escrito à mão.
import {
  el, icone, t, fmt, lingua, lerUrl, gravarUrl, botaoCopiarLink, avisoLink, escapar, carregarEm, dados,
  palavraBotao, nomeArea, faixa,
} from '../lib/base.js';
import { segmentos, interruptor } from '../lib/filtros.js';
import { tabela, botaoTabela } from '../lib/tabela.js';
import { criarDica, conteudoDica } from '../lib/dica.js';
import { escalaLinear, escalaLog } from '../lib/grafico.js';
import { abrirPainel } from '../lib/painel.js';

const $ = (id) => document.getElementById(id);
const celular = matchMedia('(max-width: 599px)');
const MODELOS = ['chatgpt', 'gemini', 'claude'];
const LIMIAR = 4;             // textos a mais para uma palavra entrar em `insere` (DADOS.md)
const LOTE = 10;              // resumos por lote (experiment/batches/, e o `como` de cada modelo)
const CORTE_PADRAO = 150;     // palavras: o resumo de partida cabe na primeira dobra de 1440 × 900
const N_COMPARAR = 8;         // barras por coluna em Comparar modelos (e-experimento-modelos)
const N_CELULAR = 10;         // barras antes de "Ver as 15" no celular (m-experimento)
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');
const sinal = (v) => (v > 0 ? `+${fmt.num(v)}` : fmt.num(v));
const casas = (x) => (Number.isInteger(x) ? 0 : Number.isInteger(Math.round(x * 1e6) / 1e5) ? 1 : 2);
const vezes = (x) => `${fmt.num(x, casas(x))}×`;
const razao2 = (x) => `${fmt.num(x, 2)}×`;   // razão da prova cruzada: perto de 1, uma casa não basta

const estado = {
  tarefa: 'melhorar',          // 'melhorar' | 'traduzir'
  lingua,                      // língua dos resumos na tarefa de melhorar
  resumo: null,
  modelo: 'chatgpt',
  visao: celular.matches ? 'unico' : 'lado',
  so: false,
  insere: 'um',                // 'um' | 'comparar'
  insereTodas: false,
  insereTabela: false,
  provaLingua: null,
  provaTabela: false,
  pedido: null,                // resumo pedido pelo link, conferido quando os dados chegam
};
let dadosTarefa = null;
let niveis = null;             // marcadoras.json
let padrao = null;             // { arquivo, resumo, modelo }: o resumo de partida
const diffs = new Map();
const ctl = {};

const arquivoAtual = () => (estado.tarefa === 'traduzir' ? 'translate-pt-en' : `polish-${estado.lingua}`);
const itemAtual = () => dadosTarefa?.itens.find((i) => i.id === estado.resumo) || null;
const modeloInfo = (m = estado.modelo) => dadosTarefa?.modelos.find((x) => x.id === m) || null;
const nomeModelo = (m = estado.modelo) => modeloInfo(m)?.nome || t(`modelo_${m}`);
const linguaSaida = () => (dadosTarefa ? dadosTarefa.lingua : estado.tarefa === 'traduzir' ? 'en' : estado.lingua);
const anunciar = (texto) => { $('exp-vivo').textContent = texto; };

/** t(chave) com {nome} trocado por nós ou textos de `nos`. */
function montar(chave, nos = {}) {
  const frag = document.createDocumentFragment();
  t(chave).split(/\{(\w+)\}/).forEach((parte, i) => {
    if (i % 2 === 0) { if (parte) frag.append(parte); return; }
    const v = nos[parte];
    frag.append(v instanceof Node ? v : String(v ?? `{${parte}}`));
  });
  return frag;
}
const forte = (n) => el('strong', { class: 'num', text: typeof n === 'number' ? fmt.num(n) : n });
const plural = (base, n, zero = false) => (zero && n === 0 ? `${base}_0` : n === 1 ? `${base}_1` : base);
const textoAno = (ano) => String(ano);

// ---------- Texto: palavras, marcas e diferenças ----------
const RE_PALAVRA = /\p{L}+(?:['-]\p{L}+)*/gu;              // palavras do texto (DADOS.md)
const RE_MARCA = /[a-zà-öø-ÿ]{4,}/g;                        // regra das marcas, em minúsculas
const RE_MARCA_I = /[a-zà-öø-ÿ]{4,}/giu;
const RE_TOKEN = /\\[A-Za-z]+|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|\s+|[^\s\p{L}\p{N}]/gu;
const contarPalavras = (texto) => (texto.match(RE_PALAVRA) || []).length;
const por100 = (marcas, palavras) => (palavras ? Math.floor((20000 * marcas + palavras) / (2 * palavras)) / 100 : 0);

let conjuntoAtual = null;
function marcadorasAtuais() {
  if (!conjuntoAtual || conjuntoAtual.dados !== dadosTarefa) conjuntoAtual = { dados: dadosTarefa, set: new Set(dadosTarefa.marcadoras) };
  return conjuntoAtual.set;
}

function marcaDe(baixo, conjunto) {
  for (const m of baixo.matchAll(RE_MARCA)) if (conjunto.has(m[0])) return m[0];
  return null;
}

/** Marcadoras de um texto, na ordem, com a posição de cada uma (a mesma conta de DADOS.md). */
function marcasNoTexto(texto, conjunto) {
  const norm = texto.normalize('NFC');
  const baixo = norm.toLowerCase();
  const lista = [];
  const mesmo = baixo.length === norm.length;
  for (const m of (mesmo ? baixo : norm).matchAll(mesmo ? RE_MARCA : RE_MARCA_I)) {
    const p = m[0].toLowerCase();
    if (conjunto.has(p)) lista.push({ ini: m.index, fim: m.index + m[0].length, palavra: p });
  }
  return { texto: norm, lista, palavras: contarPalavras(norm) };
}

/** Palavras e sinais do texto, cada um com o espaço que vinha antes. Comando LaTeX não é palavra. */
function tokens(texto, conjunto) {
  const out = [];
  let espaco = '';
  for (const m of texto.normalize('NFC').matchAll(RE_TOKEN)) {
    const s = m[0];
    if (!s.trim()) { espaco += s; continue; }
    const k = s.toLowerCase().replace(/’/g, "'");
    const palavra = !s.startsWith('\\') && /\p{L}/u.test(s);
    out.push({ s, antes: out.length ? espaco : '', k, palavra, marca: palavra ? marcaDe(k, conjunto) : null });
    espaco = '';
  }
  return out;
}

/** Diferença palavra a palavra (maior subsequência comum). Em cada trecho que mudou, as palavras
 *  removidas vêm antes das inseridas, como no texto único. */
function diferencas(a, b) {
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini].k === b[ini].k) ini += 1;
  let fa = a.length;
  let fb = b.length;
  while (fa > ini && fb > ini && a[fa - 1].k === b[fb - 1].k) { fa -= 1; fb -= 1; }
  const A = a.slice(ini, fa);
  const B = b.slice(ini, fb);
  const n = A.length;
  const m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    const Li = L[i];
    const L1 = L[i + 1];
    for (let j = m - 1; j >= 0; j -= 1) Li[j] = A[i].k === B[j].k ? L1[j + 1] + 1 : Math.max(L1[j], Li[j + 1]);
  }
  const ops = [];
  for (let k = 0; k < ini; k += 1) ops.push({ t: '=', a: a[k], b: b[k] });
  let i = 0;
  let j = 0;
  let rem = [];
  let ins = [];
  const despejar = () => { ops.push(...rem, ...ins); rem = []; ins = []; };
  while (i < n || j < m) {
    if (i < n && j < m && A[i].k === B[j].k) { despejar(); ops.push({ t: '=', a: A[i], b: B[j] }); i += 1; j += 1; }
    else if (j >= m || (i < n && L[i + 1][j] >= L[i][j + 1])) { rem.push({ t: '-', a: A[i] }); i += 1; }
    else { ins.push({ t: '+', b: B[j] }); j += 1; }
  }
  despejar();
  for (let k = 0; k < a.length - fa; k += 1) ops.push({ t: '=', a: a[fa + k], b: b[fb + k] });
  return ops;
}

function diffDe(item, modelo) {
  const saida = item.saidas[modelo];
  if (!saida) return null;
  const chave = `${dadosTarefa.tarefa}|${item.id}|${modelo}`;
  if (!diffs.has(chave)) {
    const conjunto = marcadorasAtuais();
    const ops = diferencas(tokens(item.original, conjunto), tokens(saida, conjunto));
    let ins = 0;
    let insMarca = 0;
    let rem = 0;
    for (const o of ops) {
      if (o.t === '+' && o.b.palavra) { ins += 1; if (o.b.marca) insMarca += 1; }
      if (o.t === '-' && o.a.palavra) rem += 1;
    }
    diffs.set(chave, { ops, ins, insMarca, rem, palavrasA: contarPalavras(item.original), palavrasB: contarPalavras(saida) });
  }
  return diffs.get(chave);
}

/** Resumo de partida: entre os que cabem na primeira dobra, o que mais ganhou marcadoras. */
function escolherPadrao() {
  const conjunto = marcadorasAtuais();
  const linhas = dadosTarefa.itens.filter((it) => it.saidas[estado.modelo]).map((it) => {
    if (dadosTarefa.tarefa === 'translate-pt-en') {
      const m = marcasNoTexto(it.saidas[estado.modelo], conjunto);
      const a = it.autores ? marcasNoTexto(it.autores, conjunto) : { lista: [], palavras: 0 };
      return { it, tam: Math.max(contarPalavras(it.original), m.palavras, a.palavras), valor: m.lista.length - a.lista.length };
    }
    const d = diffDe(it, estado.modelo);
    return { it, tam: Math.max(d.palavrasA, d.palavrasB), valor: d.insMarca };
  });
  const curtos = linhas.filter((l) => l.tam <= CORTE_PADRAO);
  const base = curtos.length ? curtos : linhas;
  base.sort((x, y) => y.valor - x.valor || x.tam - y.tam || (x.it.id < y.it.id ? -1 : 1));
  return base[0]?.it.id || dadosTarefa.itens[0].id;
}

// ---------- Endereço ----------
function gravar() {
  gravarUrl({ tarefa: estado.tarefa === 'traduzir' ? 'traduzir' : null, resumo: estado.resumo, modelo: estado.modelo });
}

function lerEstado() {
  const p = lerUrl();
  const problemas = [];
  if (p.tarefa) {
    if (p.tarefa === 'traduzir' || p.tarefa === 'melhorar') estado.tarefa = p.tarefa;
    else problemas.push(['aviso_tarefa', p.tarefa]);
  }
  if (p.modelo) {
    const m = p.modelo.toLowerCase();
    if (MODELOS.includes(m)) estado.modelo = m;
    else problemas.push(['aviso_modelo', p.modelo]);
  }
  if (p.lingua === 'pt' || p.lingua === 'en') estado.lingua = p.lingua;
  if (p.resumo) {
    estado.pedido = p.resumo;
    const m = /^(pt|en|tr)-\d+$/.exec(p.resumo);
    if (m?.[1] === 'tr' && !p.tarefa) estado.tarefa = 'traduzir';
    else if (m && m[1] !== 'tr' && estado.tarefa === 'melhorar') estado.lingua = m[1];
  }
  return problemas;
}

function mostrarAviso(problemas) {
  const caixa = $('exp-aviso');
  caixa.replaceChildren();
  if (!problemas.length) return;
  const itens = problemas.map(([chave, v]) => t(chave, { v: escapar(v) }));
  const partes = itens.length === 1 ? itens[0] : `${itens.slice(0, -1).join(t('aviso_virgula'))}${t('aviso_e')}${itens[itens.length - 1]}`;
  caixa.append(avisoLink(t('aviso_link', { partes })));
}

// ---------- Controles ----------
function textoDuplo(longo, curto) {
  return el('span', {}, el('span', { class: 'exp-longo', text: longo }), el('span', { class: 'exp-curto', 'aria-hidden': 'true', text: curto }));
}

function montarControles() {
  $('exp-acoes').append(botaoCopiarLink('btn btn-p'));

  ctl.tarefa = segmentos({
    rotulo: t('tarefa'), valor: estado.tarefa, classe: 'exp-tarefa',
    opcoes: [{ valor: 'melhorar', texto: t('tarefa_polish-pt') }, { valor: 'traduzir', texto: t('tarefa_translate-pt-en') }],
    aoMudar: (v) => { estado.tarefa = v; trocarArquivo(); },
  });
  ctl.lingua = segmentos({
    rotulo: t('resumo_em'), valor: estado.lingua, classe: 'exp-lingua',
    opcoes: [
      { valor: 'pt', texto: textoDuplo(t('lingua_pt'), t('sigla_pt')), chave: 'pt' },
      { valor: 'en', texto: textoDuplo(t('lingua_en'), t('sigla_en')), chave: 'en' },
    ],
    aoMudar: (v) => mudarLingua(v),
  });
  ctl.escolha = criarEscolha();
  ctl.outro = el('button', {
    type: 'button', class: 'btn exp-outro', 'aria-label': t('outro_rotulo'),
    on: { click: sortear },
  }, icone('sortear', 'ic'), textoDuplo(t('outro_resumo'), t('outro_curto')));
  $('exp-linha1').append(ctl.tarefa, ctl.lingua, ctl.escolha, ctl.outro);

  ctl.abas = criarAbas();
  ctl.visao = segmentos({
    rotulo: t('visao'), valor: estado.visao, classe: 'exp-visao',
    opcoes: [{ valor: 'lado', texto: t('visao_lado') }, { valor: 'unico', texto: t('visao_unico') }],
    aoMudar: (v) => { estado.visao = v; desenharTextos(); },
  });
  ctl.so = interruptor({ texto: t('so_marcadoras'), ligado: estado.so, aoMudar: (v) => { estado.so = v; desenharTextos(); } });
  $('exp-linha2').append(ctl.abas, el('div', { class: 'exp-linha2-dir' }, ctl.visao, ctl.so));

  ctl.insLingua = segmentos({
    rotulo: t('resumos_em'), valor: estado.lingua, classe: 'exp-ins-lingua',
    opcoes: [{ valor: 'pt', texto: t('lingua_pt'), chave: 'pt' }, { valor: 'en', texto: t('lingua_en'), chave: 'en' }],
    aoMudar: (v) => mudarLingua(v),
  });
  ctl.insVisao = segmentos({
    rotulo: t('insere_visao'), rotuloVisivel: false, classe: 'exp-ins-visao',
    valor: estado.insere === 'comparar' ? 'comparar' : estado.modelo,
    opcoes: [...MODELOS.map((m) => ({ valor: m, texto: t(`modelo_${m}`) })), { valor: 'comparar', texto: textoDuplo(t('comparar'), t('comparar_curto')) }],
    aoMudar: (v) => {
      if (v === 'comparar') { estado.insere = 'comparar'; desenharInsere(); return; }
      estado.insere = 'um';
      if (v !== estado.modelo) escolherModelo(v, { rolar: false });
      else desenharInsere();
    },
  });
  $('exp-ins-controles').append(ctl.insLingua, ctl.insVisao);

  ctl.provaLingua = segmentos({
    rotulo: t('resumos_em'), valor: estado.provaLingua, classe: 'exp-prova-lingua',
    opcoes: [{ valor: 'pt', texto: t('lingua_pt'), chave: 'pt' }, { valor: 'en', texto: t('lingua_en'), chave: 'en' }],
    aoMudar: (v) => { estado.provaLingua = v; desenharProva(); },
  });
  $('exp-prova-controles').append(ctl.provaLingua);
  sincronizarControles();
}

function sincronizarControles() {
  const traduzir = estado.tarefa === 'traduzir';
  document.querySelector('main').classList.toggle('exp-traduzindo', traduzir);
  ctl.tarefa.definir(estado.tarefa);
  ctl.lingua.definir(estado.lingua);
  ctl.lingua.hidden = traduzir;
  ctl.insLingua.definir(estado.lingua);
  ctl.insLingua.hidden = traduzir;
  ctl.visao.definir(estado.visao);
  ctl.visao.hidden = traduzir;
  ctl.insVisao.definir(estado.insere === 'comparar' ? 'comparar' : estado.modelo);
  ctl.abas.definir();
  const anoRodada = dadosTarefa ? (modeloInfo()?.datas?.[0] || '').slice(0, 4) : '';
  $('exp-subtitulo').textContent = traduzir ? t('subtitulo_traduzir', { ano: anoRodada || '…' }) : t('subtitulo_melhorar');
}

function criarAbas() {
  const abas = el('div', { class: 'abas exp-abas', role: 'tablist', 'aria-label': t('modelo_rotulo') });
  const botoes = MODELOS.map((m) => el('button', {
    type: 'button', class: 'aba', role: 'tab', id: `exp-aba-${m}`, 'aria-controls': 'exp-textos', dataset: { modelo: m },
    on: { click: () => { if (botao(m).getAttribute('aria-disabled') !== 'true') escolherModelo(m); } },
  }, t(`modelo_${m}`)));
  const botao = (m) => botoes[MODELOS.indexOf(m)];
  abas.append(...botoes);
  abas.addEventListener('keydown', (evento) => {
    const atual = botoes.indexOf(document.activeElement);
    if (atual < 0) return;
    const livres = botoes.filter((b) => b.getAttribute('aria-disabled') !== 'true');
    const k = livres.indexOf(botoes[atual]);
    let alvo = null;
    if (evento.key === 'ArrowRight') alvo = livres[(k + 1) % livres.length];
    else if (evento.key === 'ArrowLeft') alvo = livres[(k - 1 + livres.length) % livres.length];
    else if (evento.key === 'Home') alvo = livres[0];
    else if (evento.key === 'End') alvo = livres[livres.length - 1];
    if (!alvo) return;
    evento.preventDefault();
    alvo.focus();
    escolherModelo(alvo.dataset.modelo, { rolar: false });
  });
  abas.definir = () => {
    const it = itemAtual();
    for (const b of botoes) {
      const m = b.dataset.modelo;
      const sel = m === estado.modelo;
      const sem = Boolean(it && !it.saidas[m]);
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
      b.setAttribute('aria-disabled', sem ? 'true' : 'false');
      b.title = sem ? `${t('modelo_sem', { modelo: nomeModelo(m) })}. ${t('modelo_sem_texto')}` : '';
    }
    $('exp-textos').setAttribute('aria-labelledby', `exp-aba-${estado.modelo}`);
  };
  return abas;
}

// ---------- Escolha do resumo (lista com busca) ----------
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tituloDe = (it) => it.titulo || it.revista;
const linguaTitulo = () => (dadosTarefa?.tarefa === 'polish-en' ? 'en' : 'pt');

function criarEscolha() {
  const id = 'exp-escolha';
  const caixa = el('div', { class: 'filtro filtro-empilha exp-escolha' });
  const texto = el('span', { class: 'exp-escolha-texto' });
  const botao = el('button', {
    type: 'button', class: 'entrada exp-escolha-botao', id: `${id}-botao`,
    'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-labelledby': `${id}-rot ${id}-botao`,
  }, icone('busca', 'ic ic-p exp-escolha-lupa'), texto, icone('abaixo'));
  const entrada = el('input', {
    type: 'text', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'true', 'aria-controls': `${id}-lista`,
    'aria-label': t('busca_resumo'), placeholder: t('busca_resumo'), autocomplete: 'off', spellcheck: 'false',
  });
  const lista = el('ul', { role: 'listbox', id: `${id}-lista`, class: 'exp-lista', 'aria-label': t('lista_rotulo') });
  const contagem = el('p', { class: 't-legenda exp-lista-n', role: 'status' });
  const pop = el('div', { class: 'cartao exp-escolha-pop', hidden: true },
    el('div', { class: 'entrada exp-escolha-busca' }, icone('busca', 'ic ic-p'), entrada), contagem, lista);
  const envolve = el('div', { class: 'exp-escolha-envolve' }, botao, pop);
  caixa.append(el('span', { class: 'filtro-rotulo', id: `${id}-rot`, text: t('resumo_rotulo') }), envolve);

  let visiveis = [];
  let ativo = 0;

  function opcao(it) {
    return el('li', { role: 'option', id: `${id}-o-${it.id}`, class: 'exp-opcao', dataset: { id: it.id }, 'aria-selected': String(it.id === estado.resumo) },
      el('span', { class: 'exp-opcao-titulo', lang: langDe(it.titulo ? linguaTitulo() : 'pt'), text: tituloDe(it) }),
      el('span', { class: 't-legenda' }, `${it.revista} · ${textoAno(it.ano)} · ${nomeArea(it.area)}`));
  }
  function filtrar() {
    const q = normalizar(entrada.value.trim());
    const itens = dadosTarefa?.itens || [];
    visiveis = q ? itens.filter((it) => normalizar(`${it.titulo || ''} ${it.revista} ${nomeArea(it.area)} ${it.id} ${it.ano}`).includes(q)) : itens;
    lista.replaceChildren(...visiveis.map(opcao));
    if (!visiveis.length) lista.append(el('li', { class: 'exp-lista-vazia t-p', role: 'presentation', text: t('busca_vazia', { texto: entrada.value.trim() }) }));
    contagem.textContent = t('exp_resumos_n', { n: fmt.num(visiveis.length), total: fmt.num(itens.length) });
    realcar(Math.max(0, visiveis.findIndex((it) => it.id === estado.resumo)));
  }
  function realcar(i) {
    if (!visiveis.length) { entrada.removeAttribute('aria-activedescendant'); return; }
    ativo = (i + visiveis.length) % visiveis.length;
    const nos = lista.querySelectorAll('.exp-opcao');
    nos.forEach((n, k) => n.classList.toggle('exp-opcao-ativa', k === ativo));
    entrada.setAttribute('aria-activedescendant', nos[ativo].id);
    nos[ativo].scrollIntoView?.({ block: 'nearest' });
  }
  function abrir() {
    if (!dadosTarefa) return;
    pop.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    entrada.value = '';
    filtrar();
    entrada.focus();
    document.addEventListener('pointerdown', fora, true);
  }
  function fechar(devolverFoco = true) {
    if (pop.hidden) return;
    pop.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', fora, true);
    if (devolverFoco) botao.focus();
  }
  function fora(evento) { if (!envolve.contains(evento.target)) fechar(false); }
  function escolher(i) {
    const it = visiveis[i];
    if (!it) return;
    fechar();
    if (it.id !== estado.resumo) escolherResumo(it.id);
  }
  botao.addEventListener('click', () => (pop.hidden ? abrir() : fechar()));
  botao.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(); } });
  entrada.addEventListener('input', filtrar);
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') realcar(ativo + 1);
    else if (e.key === 'ArrowUp') realcar(ativo - 1);
    else if (e.key === 'PageDown') realcar(Math.min(visiveis.length - 1, ativo + 8));
    else if (e.key === 'PageUp') realcar(Math.max(0, ativo - 8));
    else if (e.key === 'Enter') escolher(ativo);
    else if (e.key === 'Escape') fechar();
    else if (e.key === 'Tab') { fechar(false); return; }
    else return;
    e.preventDefault();
  });
  lista.addEventListener('click', (e) => {
    const li = e.target.closest('.exp-opcao');
    if (li) escolher(visiveis.findIndex((it) => it.id === li.dataset.id));
  });
  lista.addEventListener('pointermove', (e) => {
    const li = e.target.closest('.exp-opcao');
    if (li) {
      const k = visiveis.findIndex((it) => it.id === li.dataset.id);
      if (k !== ativo) { ativo = k; lista.querySelectorAll('.exp-opcao').forEach((n, j) => n.classList.toggle('exp-opcao-ativa', j === k)); entrada.setAttribute('aria-activedescendant', li.id); }
    }
  });
  caixa.definir = () => {
    const it = itemAtual();
    texto.replaceChildren();
    if (!it) return;
    texto.append(el('span', { class: 'exp-escolha-titulo', lang: langDe(it.titulo ? linguaTitulo() : 'pt'), text: tituloDe(it) }),
      el('span', { class: 'exp-escolha-ano', text: ` · ${textoAno(it.ano)}` }));
    botao.title = `${tituloDe(it)} · ${it.ano}`;
  };
  caixa.fechar = fechar;
  return caixa;
}

// ---------- Mudanças de estado ----------
function escolherResumo(id) {
  estado.resumo = id;
  ctl.escolha.definir();
  ctl.abas.definir();
  desenharTextos();
  gravar();
}

function sortear() {
  const itens = dadosTarefa?.itens.filter((it) => it.id !== estado.resumo) || [];
  if (!itens.length) return;
  escolherResumo(itens[Math.floor(Math.random() * itens.length)].id);
}

function escolherModelo(m, { rolar = false } = {}) {
  estado.modelo = m;
  ctl.abas.definir();
  ctl.insVisao.definir(estado.insere === 'comparar' ? 'comparar' : m);
  sincronizarControles();
  desenharTextos();
  if (estado.insere === 'um') desenharInsere();
  gravar();
  if (rolar) $('exp-textos').scrollIntoView({ block: 'nearest' });
}

function mudarLingua(v) {
  if (v === estado.lingua && estado.tarefa === 'melhorar') return;
  estado.lingua = v;
  if (estado.provaLingua !== v) { estado.provaLingua = v; ctl.provaLingua.definir(v); if (provaDados) desenharProva(); }
  trocarArquivo();
}

async function trocarArquivo() {
  ctl.escolha.fechar(false);
  sincronizarControles();
  await carregarTarefa({ suave: true });
}

// ---------- Carga ----------
let pedidoCarga = 0;
async function carregarTarefa({ suave = false, problemas = [] } = {}) {
  const arquivo = arquivoAtual();
  const numero = ++pedidoCarga;
  const caminho = `experimento/${arquivo}.json`;
  const semEsqueleto = suave && Boolean(dadosTarefa);
  // O resumo e as barras vêm do mesmo arquivo. Cada região mostra a própria carga e o próprio erro;
  // a primeira que recebe o arquivo (pelo "Tentar de novo" de qualquer uma) desenha as duas.
  const erroTexto = t('erro_texto_tarefa');
  const d = await Promise.race([
    carregarEm($('exp-textos'), caminho, { altura: celular.matches ? 420 : 520, semEsqueleto, erroTitulo: t('erro_titulo_parte'), erroTexto }),
    carregarEm($('exp-ins-corpo'), caminho, { altura: 420, semEsqueleto, erroTexto }),
  ]);
  if (arquivo === 'translate-pt-en' && !niveis) niveis = await dados('marcadoras.json').catch(() => null);
  if (numero !== pedidoCarga) return;
  dadosTarefa = d;
  if (!d.modelos.some((m) => m.id === estado.modelo)) estado.modelo = d.modelos[0].id;
  const pedido = estado.pedido;
  estado.pedido = null;
  padrao = { arquivo, resumo: escolherPadrao(), modelo: estado.modelo };
  if (pedido && d.itens.some((it) => it.id === pedido)) estado.resumo = pedido;
  else {
    if (pedido) problemas.push(['aviso_resumo', pedido]);
    estado.resumo = padrao.resumo;
  }
  if (problemas.length) { mostrarAviso(problemas); gravar(); }
  else if (suave) gravar();
  ctl.escolha.definir();
  sincronizarControles();
  desenharTextos();
  desenharInsere();
}

// ---------- Parte 1: o resumo ----------
function botaoMarca(texto, palavra, classe, l) {
  return el('button', { type: 'button', class: `exp-pal ${classe}`, dataset: { palavra: `${palavra}.${l}` }, lang: langDe(l) }, texto);
}

/** Pinta uma lista de { tok, tipo } (tipo '=', '+' ou '-'): inseridas em verde, removidas riscadas,
 *  inserida que é marcadora com o contorno laranja. Com `so`, só as marcadoras ficam marcadas.
 *  Cada trecho marcado vai num <ins> ou <del>, que o leitor de tela lê como "[inserido: …]". */
function pintar(itens, { so, l }) {
  const p = el('p', { class: `t-texto exp-texto${so ? ' exp-so' : ''}`, lang: langDe(l) });
  let trecho = null;           // o <ins> ou <del> do trecho
  let tipoTrecho = null;
  let fim = null;              // o "]" do leitor de tela, último filho do trecho
  let grupo = null;            // palavras seguidas sem marcadora, num <span> dentro do trecho
  let texto = '';
  const soltarTexto = () => { if (texto) { p.append(texto); texto = ''; } };
  for (const { tok, tipo } of itens) {
    let classe = null;
    if (tipo === '+') classe = tok.marca ? 'ins ins-marca' : so ? null : 'ins';
    else if (tipo === '-') classe = tok.marca || !so ? 'rem' : null;
    if (!classe) { trecho = grupo = null; texto += tok.antes + tok.s; continue; }
    if (trecho && tipoTrecho === tipo) {
      if (grupo && !tok.marca) { grupo.append(tok.antes + tok.s); continue; }
      if (tok.antes) fim.before(tok.antes);
    } else {
      texto += tok.antes;
      soltarTexto();
      fim = el('span', { class: 'sr', text: t('sr_fim') });
      trecho = el(tipo === '+' ? 'ins' : 'del', {},
        el('span', { class: 'sr', lang: langDe(lingua), text: t(tipo === '+' ? 'sr_inserido' : 'sr_removido') }), fim);
      tipoTrecho = tipo;
      p.append(trecho);
    }
    if (tok.marca) { grupo = null; fim.before(botaoMarca(tok.s, tok.marca, classe, l)); }
    else { grupo = el('span', { class: classe }, tok.s); fim.before(grupo); }
  }
  soltarTexto();
  return p;
}

function pintarMarcas(texto, conjunto, { so, l, realce = true }) {
  const p = el('p', { class: `t-texto exp-texto${so && realce ? ' exp-so' : ''}`, lang: langDe(l) });
  if (!realce) { p.textContent = texto; return p; }
  const { texto: norm, lista } = marcasNoTexto(texto, conjunto);
  let pos = 0;
  for (const m of lista) {
    if (m.ini > pos) p.append(norm.slice(pos, m.ini));
    const nivel = niveis?.[l]?.[m.palavra]?.[1] || 2;
    p.append(botaoMarca(norm.slice(m.ini, m.fim), m.palavra, `mk mk-${nivel}`, l));
    pos = m.fim;
  }
  if (pos < norm.length) p.append(norm.slice(pos));
  return p;
}

function fonte(it, chave = 'fonte', extra = {}) {
  return el('p', { class: 't-legenda exp-fonte' },
    t(chave, { revista: it.revista, ano: textoAno(it.ano), area: nomeArea(it.area), ...extra }), ' · ',
    el('a', { href: `https://doi.org/${it.doi}`, text: t('ver_artigo') }));
}

function cabecaColuna(titulo, direita, classe = '') {
  return el('div', { class: `exp-col-cabeca ${classe}`.trim() }, el('h3', { class: 'exp-col-titulo', text: titulo }), direita && el('span', { class: 't-legenda num', text: direita }));
}

function botaoVisao() {
  const unico = estado.visao === 'unico';
  return el('button', {
    type: 'button', class: 'btn btn-fantasma btn-p exp-visao-celular',
    on: {
      click: () => {
        estado.visao = unico ? 'lado' : 'unico';
        ctl.visao.definir(estado.visao);
        desenharTextos();
        $('exp-textos').querySelector('.exp-visao-celular')?.focus();   // o botão foi redesenhado
      },
    },
  }, t(unico ? 'botao_lado' : 'botao_unico'));
}

function desenharTextos() {
  const caixa = $('exp-textos');
  caixa.setAttribute('role', 'tabpanel');
  const it = itemAtual();
  if (!it || !dadosTarefa) return;
  ctl.abas.definir();
  const corpo = estado.tarefa === 'traduzir' ? textosTraducao(it) : textosMelhoria(it);
  caixa.replaceChildren(...corpo);
  desenharComo(it);
}

function contagemMelhoria(d) {
  const p = el('p', { class: 'exp-contagem' });
  p.append(montar(plural('cont_ins', d.ins, true), { n: forte(d.ins) }));
  if (d.ins === 0) p.append(t('cont_ponto'));
  else if (d.ins === 1) p.append(t(d.insMarca ? 'cont_marca_um_sim' : 'cont_marca_um_nao'));
  else p.append(montar(plural('cont_marca', d.insMarca, true), { n: forte(d.insMarca) }));
  p.append(montar(plural('cont_rem', d.rem, true), { n: forte(d.rem) }));
  return p;
}

function notaMedia(chave, chavePadrao) {
  const r = dadosTarefa.resumo[estado.modelo];
  const n = dadosTarefa.itens.length;
  const partes = [];
  if (r) partes.push(t(chave, { n: fmt.num(r.textos), modelo: nomeModelo(), antes: fmt.num(r.antes, 1), depois: fmt.num(r.depois, 1) }));
  if (padrao && padrao.arquivo === arquivoAtual() && padrao.resumo === estado.resumo && padrao.modelo === estado.modelo) {
    partes.push(t(chavePadrao, { modelo: nomeModelo(), n: fmt.num(n) }));
  }
  return el('p', { class: 't-legenda exp-nota' }, partes.join(' '));
}

function textosMelhoria(it) {
  const l = dadosTarefa.lingua;
  const saida = it.saidas[estado.modelo];
  if (!saida) {
    return [el('div', { class: 'estado-vazio exp-sem' }, el('p', { class: 'exp-sem-titulo', text: t('modelo_sem', { modelo: nomeModelo() }) }), el('p', { class: 't-p', text: t('modelo_sem_texto') }))];
  }
  const d = diffDe(it, estado.modelo);
  const so = estado.so;
  const contagem = contagemMelhoria(d);
  anunciar(`${t('vivo_resumo', { id: it.id, modelo: nomeModelo() })} ${contagem.textContent}`);
  const legenda = el('div', { class: 'legenda exp-legenda' },
    el('span', { class: 'legenda-item' }, el('span', { class: 'ins', text: t('leg_inserida') })),
    el('span', { class: 'legenda-item' }, el('span', { class: 'ins ins-marca' }, textoDuplo(t('leg_inserida_marca'), t('leg_marca_curto')))),
    el('span', { class: 'legenda-item' }, el('span', { class: 'rem', text: t('leg_removida') })));
  const topo = el('div', { class: 'exp-topo' }, contagem, legenda);
  let colunas;
  if (estado.visao === 'unico') {
    const itens = d.ops.filter((o) => !(so && o.t === '-' && !o.a.marca)).map((o) => (o.t === '-' ? { tok: o.a, tipo: '-' } : { tok: o.b, tipo: o.t }));
    colunas = el('article', { class: 'cartao exp-unico' },
      el('div', { class: 'exp-col-cabeca' },
        el('h3', { class: 'exp-col-titulo', text: t('col_unico', { ano: textoAno(it.ano), modelo: nomeModelo() }) }),
        botaoVisao()),
      pintar(itens, { so, l }),
      fonte(it));
  } else {
    const a = d.ops.filter((o) => o.t !== '+').map((o) => ({ tok: o.a, tipo: o.t }));
    const b = d.ops.filter((o) => o.t !== '-').map((o) => ({ tok: o.b, tipo: o.t }));
    colunas = el('div', { class: 'exp-colunas exp-colunas-2' },
      el('article', { class: 'exp-col' },
        cabecaColuna(t('col_original', { ano: textoAno(it.ano) }), t('col_palavras', { n: fmt.num(d.palavrasA) })),
        pintar(a, { so, l }),
        fonte(it)),
      el('article', { class: 'exp-col' },
        el('div', { class: 'exp-col-cabeca' },
          el('h3', { class: 'exp-col-titulo', text: t('col_reescrito', { modelo: nomeModelo() }) }),
          el('span', { class: 'exp-col-direita' }, el('span', { class: 't-legenda num', text: t('col_palavras', { n: fmt.num(d.palavrasB) }) }), botaoVisao())),
        pintar(b, { so, l })));
  }
  return [topo, colunas, notaMedia('media_melhorar', 'nota_padrao')];
}

function qtdMarcas(m) {
  const n = m.lista.length;
  return n ? t(plural('marcas_qtd', n), { n: fmt.num(n), p: fmt.num(por100(n, m.palavras), 1) }) : t('marcas_qtd_0');
}

function textosTraducao(it) {
  const conjunto = marcadorasAtuais();
  const saida = it.saidas[estado.modelo];
  const so = estado.so;
  if (!saida) {
    return [el('div', { class: 'estado-vazio exp-sem' }, el('p', { class: 'exp-sem-titulo', text: t('modelo_sem', { modelo: nomeModelo() }) }), el('p', { class: 't-p', text: t('modelo_sem_texto') }))];
  }
  const m = marcasNoTexto(saida, conjunto);
  const a = it.autores ? marcasNoTexto(it.autores, conjunto) : null;
  const contagem = el('p', { class: 'exp-contagem' },
    t('trad_modelo', { modelo: nomeModelo() }), qtdComForte(m), '.',
    a ? [t('trad_autores'), qtdComForte(a), '.'] : null);
  anunciar(`${t('vivo_resumo', { id: it.id, modelo: nomeModelo() })} ${contagem.textContent}`);
  const faixas = [[null, 1.5], [1.5, 2.5], [2.5, 5], [5, null]];
  const legenda = el('div', { class: 'legenda exp-legenda' }, el('span', { text: t('exp_leg_marcadoras') }),
    faixas.map(([x, y], i) => el('span', {
      class: `mk mk-${i + 1} num`,
      text: i === 0 ? t('nivel_1', { b: vezes(y) }) : i === 3 ? t('nivel_4', { a: vezes(x) }) : t('nivel_faixa', { a: vezes(x), b: vezes(y) }),
    })));
  const colunas = el('div', { class: 'exp-colunas exp-colunas-3' },
    el('article', { class: 'exp-col' },
      cabecaColuna(t('col_resumo_pt', { ano: textoAno(it.ano) }), t('col_ponto'), 'exp-col-pt'),
      pintarMarcas(it.original, conjunto, { so, l: 'pt', realce: false }),
      fonte(it)),
    el('article', { class: 'exp-col' },
      cabecaColuna(t('col_traducao', { modelo: nomeModelo() }), `${t(plural('col_marcas', m.lista.length), { n: fmt.num(m.lista.length) })} · ${t('col_palavras', { n: fmt.num(m.palavras) })}`, 'exp-col-en'),
      pintarMarcas(saida, conjunto, { so, l: 'en' })),
    a && el('article', { class: 'exp-col' },
      cabecaColuna(t('col_autores'), `${t(plural('col_marcas', a.lista.length), { n: fmt.num(a.lista.length) })} · ${t('col_palavras', { n: fmt.num(a.palavras) })}`, 'exp-col-en'),
      pintarMarcas(it.autores, conjunto, { so, l: 'en' }),
      fonte(it, 'fonte_autores')));
  return [el('div', { class: 'exp-topo' }, contagem, legenda), colunas,
    el('p', { class: 't-p exp-nota-trad', text: t('nota_traduzir') }),
    notaMedia('media_traduzir', 'nota_padrao_traduzir')];
}

function qtdComForte(m) {
  const n = m.lista.length;
  if (!n) return el('strong', { text: t('marcas_qtd_0') });
  return montar(plural('marcas_qtd', n), { n: forte(n), p: el('span', { class: 'num', text: fmt.num(por100(n, m.palavras), 1) }) });
}

// ---------- Como pedimos ----------
const formatoData = new Intl.DateTimeFormat(lingua === 'en' ? 'en' : 'pt-BR', { dateStyle: 'long', timeZone: 'UTC' });
const data = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return Number.isNaN(d.getTime()) ? iso : formatoData.format(d); };

function desenharComo(it) {
  const corpo = $('exp-como-corpo');
  const m = modeloInfo();
  const d = dadosTarefa;
  if (!m || !d) { corpo.replaceChildren(); return; }
  const i = d.itens.indexOf(it);
  const ini = Math.floor(i / LOTE) * LOTE;
  const doLote = d.itens.slice(ini, ini + LOTE);
  const lote = `${d.tarefa}-${String(ini / LOTE + 1).padStart(2, '0')}`;
  const prompt = m.prompt
    .replace(`=== ${d.tarefa}-01 ===`, `=== ${lote} ===`)
    .replace(`### ${d.itens[0].id}"`, `### ${doLote[0].id}"`);
  const anos = d.itens.map((x) => x.ano);
  const porArea = new Map();
  for (const x of d.itens) porArea.set(x.area, (porArea.get(x.area) || 0) + 1);
  const k = new Set(porArea.values()).size === 1 ? [...porArea.values()][0] : null;
  const varsAmostra = {
    n: fmt.num(d.itens.length), inicio: textoAno(Math.min(...anos)), fim: textoAno(Math.max(...anos)),
    k: k ? fmt.num(k) : '', lingua: t(`lingua_${d.lingua_original}_nome`),
  };
  const amostra = !k ? t('como_amostra_sem_k', varsAmostra) : t(d.tarefa === 'translate-pt-en' ? 'como_amostra_traduzir' : 'como_amostra_melhorar', varsAmostra);
  const linha = (rotulo, valor, classe) => el('div', {}, el('dt', { class: 't-legenda', text: rotulo }), el('dd', { class: classe || null }, valor));
  const linguaPedido = d.tarefa === 'polish-en' ? 'en' : 'pt';   // o pedido vai na língua do resumo enviado
  corpo.replaceChildren(
    el('div', { class: 'exp-como-prompt' },
      el('p', { class: 't-rotulo', text: t(linguaPedido === lingua ? 'como_prompt' : 'como_prompt_outra', { lote }) }),
      el('pre', { class: 'codigo exp-codigo', lang: langDe(linguaPedido) }, prompt),
      el('p', { class: 't-legenda', text: t('como_prompt_nota', { lote, n: fmt.num(doLote.length), primeiro: doLote[0].id, ultimo: doLote[doLote.length - 1].id, id: it.id }) })),
    el('dl', { class: 'exp-como-dl' },
      // "Gemini 3.6 Flash" já traz o nome; "GPT-6" não ("ChatGPT, GPT-6").
      linha(t('como_modelo'), m.versao.startsWith(m.nome) ? m.versao : `${m.nome}, ${m.versao}`),
      linha(t('como_acesso'), m.plano?.[lingua] || ''),
      linha(t(m.datas.length > 1 ? 'como_datas' : 'como_data'), m.datas.map(data).join(', '), 'num'),
      linha(t('como_config'), m.como?.[lingua] || ''),
      linha(t('como_amostra'), amostra)));
}

// ---------- Parte 2: o que cada modelo insere ----------
function barras(lista, max, { compacto = false, l } = {}) {
  return el('div', { class: `exp-barras${compacto ? ' exp-barras-p' : ''}`, role: 'list' },
    lista.map(([palavra, v, marca]) => el('div', { class: 'exp-barra-linha', role: 'listitem' },
      el('span', { class: 'exp-barra-pal' }, palavraBotao(palavra, l)),
      el('span', { class: 'exp-barra-trilho' },
        el('span', { class: `exp-barra${marca ? ' exp-barra-marca' : ''}`, style: { width: `${(86 * Math.max(0, v)) / max}%` }, 'aria-hidden': 'true' }),
        el('span', { class: 'num exp-barra-valor', 'aria-hidden': 'true', text: sinal(v) }),
        el('span', { class: 'sr', text: `${t('valor_barra', { v: fmt.num(v) })}${marca ? `, ${t('prova_marcadora')}` : ''}` })))));
}

function legendaBarras() {
  return el('div', { class: 'legenda exp-leg-barras' },
    el('span', { class: 'legenda-item' }, el('span', { class: 'exp-am exp-am-marca' }), t('leg_marcadora')),
    el('span', { class: 'legenda-item' }, el('span', { class: 'exp-am' }), t('leg_nao_marcadora')));
}

function desenharInsere() {
  const d = dadosTarefa;
  if (!d) return;
  const corpo = $('exp-ins-corpo');
  const traduzir = d.tarefa === 'translate-pt-en';
  const n = d.resumo[MODELOS[0]]?.textos ?? d.itens.length;
  const comparar = estado.insere === 'comparar';
  $('exp-ins-sub').textContent = comparar
    ? t('insere_sub_comparar', { k: fmt.num(N_COMPARAR), n: fmt.num(n) })
    : t(traduzir ? 'insere_sub_traduzir' : 'insere_sub_um', { n: fmt.num(n) });
  $('exp-ins-aviso').replaceChildren(traduzir
    ? el('div', { class: 'aviso exp-aviso-trad' }, icone('info', 'ic'), el('p', { class: 't-p', text: t('aviso_traduzir') }))
    : '');
  corpo.replaceChildren(comparar ? compararModelos(d, n) : umModelo(d, n));
}

function umModelo(d, n) {
  const m = estado.modelo;
  const l = d.lingua;
  const traduzir = d.tarefa === 'translate-pt-en';
  const todas = d.insere[m] || [];
  const curta = celular.matches && !estado.insereTodas && todas.length > N_CELULAR;
  const lista = curta ? todas.slice(0, N_CELULAR) : todas;
  const max = Math.max(1, ...todas.map((x) => x[1]));
  const grafico = el('div', { class: 'exp-barras-caixa' },
    el('p', { class: 'sr', text: t('barras_titulo', { modelo: nomeModelo(m) }) }),
    barras(lista, max, { l }),
    celular.matches && todas.length > N_CELULAR && el('button', {
      type: 'button', class: 'btn btn-fantasma exp-ver-todas',
      on: { click: () => { estado.insereTodas = !estado.insereTodas; desenharInsere(); $('exp-ins-corpo').querySelector('.exp-ver-todas')?.focus(); } },
    }, estado.insereTodas ? t('ver_menos') : t('ver_todas', { n: fmt.num(todas.length) })));
  const tab = botaoTabela({
    grafico, mostrando: estado.insereTabela,
    aoMudar: (v) => { estado.insereTabela = v; },
    criar: () => tabela(
      [{ rotulo: t('tab_posicao'), num: true }, { rotulo: t('tab_palavra') }, { rotulo: t('tab_textos'), num: true }, { rotulo: t('tab_marcadora') }],
      todas.map(([p, v, mk], i) => [fmt.num(i + 1), palavraBotao(p, l), sinal(v), t(mk ? 'sim' : 'nao')]),
      { legenda: t('insere_legenda', { modelo: nomeModelo(m) }), cabecalhoLinha: false }),
  });
  const pe = el('div', { class: 'figura-pe exp-pe' },
    el('span', {}, traduzir
      ? t('insere_pe_traduzir', { modelo: nomeModelo(m), n: fmt.num(n) })
      : t('insere_pe_melhorar', { lingua: t(`lingua_${l}_nome`), modelo: nomeModelo(m), n: fmt.num(n) })),
    tab.botao);
  const fig = el('figure', { class: 'figura exp-barras-fig' }, grafico, pe);
  if (tab.mostrando) tab.atualizar();

  const r = d.resumo[m];
  const k = todas.filter((x) => x[2]).length;
  const lado = el('div', { class: 'exp-lado' }, legendaBarras(),
    el('p', { class: 't-texto exp-lado-frase', text: t(k === 0 ? 'insere_frase_0' : k === 1 ? 'insere_frase_1' : 'insere_frase', { n: fmt.num(todas.length), k: fmt.num(k), modelo: nomeModelo(m) }) }));
  if (todas.length < 15) lado.append(el('p', { class: 't-p exp-lado-p', text: t('insere_limiar', { limiar: fmt.num(LIMIAR), modelo: nomeModelo(m), n: fmt.num(todas.length) }) }));
  if (r) {
    lado.append(el('p', { class: 't-p exp-lado-p', text: t('insere_fisher', { modelo: nomeModelo(m), limiar: fmt.num(LIMIAR), im: fmt.num(r.inseridas_marcadoras), i: fmt.num(r.inseridas), r: fmt.num(r.removidas), rm: r.removidas_marcadoras ? fmt.num(r.removidas_marcadoras) : t('nenhuma') }) }));
    lado.append(el('p', { class: 't-p exp-lado-p', text: t(traduzir ? 'insere_media_traduzir' : 'insere_media', { modelo: nomeModelo(m), antes: fmt.num(r.antes, 1), depois: fmt.num(r.depois, 1), mudanca: fmt.num(r.mudanca, 1), ic0: fmt.num(r.ic[0], 1), ic1: fmt.num(r.ic[1], 1) }) }));
  }
  lado.append(el('p', { class: 't-p exp-lado-p', text: t('insere_comparar_dica') }));
  return el('div', { class: 'exp-grade' }, fig, lado);
}

function compararModelos(d, n) {
  const l = d.lingua;
  const traduzir = d.tarefa === 'translate-pt-en';
  const listas = MODELOS.map((m) => (d.insere[m] || []).slice(0, N_COMPARAR));
  const max = Math.max(1, ...listas.flat().map((x) => x[1]));
  const colunas = el('div', { class: 'exp-comparar' }, MODELOS.map((m, i) => {
    const r = d.resumo[m];
    const k = listas[i].filter((x) => x[2]).length;
    return el('figure', { class: 'exp-comp-col' },
      el('figcaption', { class: 'exp-comp-cabeca' },
        el('h3', { class: 't-h3', text: nomeModelo(m) }),
        el('p', { class: 't-legenda num', text: t('comparar_marcas', { k: fmt.num(k), n: fmt.num(listas[i].length) }) })),
      barras(listas[i], max, { compacto: true, l }),
      r && el('p', { class: 't-p exp-comp-nota', text: t(traduzir ? 'comparar_nota_traduzir' : 'comparar_nota', { antes: fmt.num(r.antes, 1), depois: fmt.num(r.depois, 1) }) }));
  }));
  const tab = botaoTabela({
    grafico: colunas, mostrando: estado.insereTabela,
    aoMudar: (v) => { estado.insereTabela = v; },
    criar: () => tabela(
      [{ rotulo: t('tab_modelo') }, { rotulo: t('tab_posicao'), num: true }, { rotulo: t('tab_palavra') }, { rotulo: t('tab_textos'), num: true }, { rotulo: t('tab_marcadora') }],
      MODELOS.flatMap((m) => (d.insere[m] || []).map(([p, v, mk], i) => [nomeModelo(m), fmt.num(i + 1), palavraBotao(p, l), sinal(v), t(mk ? 'sim' : 'nao')])),
      { legenda: t('insere_legenda_comparar') }),
  });
  const pe = el('div', { class: 'figura-pe exp-comp-pe' }, legendaBarras(),
    el('span', { class: 'exp-comp-pe-dir' }, el('span', { text: t('comparar_pe', { max: fmt.num(max), n: fmt.num(n) }) }), tab.botao));
  const caixa = el('div', { class: 'exp-comparar-caixa' }, colunas, pe);
  if (tab.mostrando) tab.atualizar();
  return caixa;
}

// ---------- Parte 3: a prova cruzada ----------
let provaDados = null;
let provaGrafico = null;

async function carregarProva() {
  provaDados = await carregarEm($('exp-prova'), 'experimento/prova.json', { altura: celular.matches ? 320 : 460 });
  desenharProva();
}

function postos(v) {
  const ordem = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < ordem.length;) {
    let j = i;
    while (j + 1 < ordem.length && ordem[j + 1][0] === ordem[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) r[ordem[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}
function correlacao(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let c = 0; let va = 0; let vb = 0;
  for (let i = 0; i < n; i += 1) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return c / Math.sqrt(va * vb);
}

function contasProva(pts) {
  const insere = pts.filter((p) => p[3] > 0);
  const tira = pts.filter((p) => p[3] < 0);
  const acima = (lista) => (lista.length ? lista.filter((p) => p[1] > 1).length / lista.length : 0);
  const contraA = [...tira].sort((x, y) => y[1] - x[1])[0] || null;
  const contraB = pts.filter((p) => p[1] < 1).sort((x, y) => y[3] - x[3])[0] || null;
  return {
    nIns: insere.length, pIns: acima(insere), nTira: tira.length, pTira: acima(tira),
    r: correlacao(postos(pts.map((p) => p[1])), postos(pts.map((p) => p[3]))),
    contraA, contraB,
  };
}

function desenharProva() {
  if (!provaDados) return;
  const l = estado.provaLingua;
  const pts = provaDados[l] || [];
  const caixa = $('exp-prova');
  provaGrafico?.destruir();
  const c = contasProva(pts);
  const plot = el('div', { class: 'plot exp-plot', tabindex: '0', role: 'group', 'aria-label': t('prova_teclado', { n: fmt.num(pts.length) }) });
  const ordenados = [...pts].sort((a, b) => b[3] - a[3] || b[1] - a[1]);
  const tab = botaoTabela({
    grafico: plot, mostrando: estado.provaTabela,
    aoMudar: (v) => { estado.provaTabela = v; },
    criar: () => {
      const tb = tabela(
        [{ rotulo: t('tab_palavra') }, { rotulo: t('tab_razao'), num: true }, { rotulo: t('tab_media'), num: true },
          ...MODELOS.map((m) => ({ rotulo: t(`modelo_${m}`), num: true })), { rotulo: t('tab_marcadora') }],
        ordenados.map((p) => [palavraBotao(p[0], l), razao2(p[1]), fmt.num(p[3], 1), ...MODELOS.map((m) => sinal(p[4][m])), t(p[5] ? 'sim' : 'nao')]),
        { legenda: t('prova_legenda'), classe: 'exp-tabela-rola' });
      return el('div', { class: 'exp-tabela-envolve' }, tb, el('p', { class: 't-legenda', text: t('prova_tabela_nota') }));
    },
  });
  const pe = el('div', { class: 'figura-pe exp-pe' },
    el('span', { class: 'exp-so-largo', text: t('prova_pe') }),
    el('span', { class: 'exp-so-celular', text: t('prova_pe_curto') }),
    tab.botao);
  const fig = el('figure', { class: 'figura exp-prova-fig' }, plot, pe);
  const forteW = (p) => el('span', {}, palavraBotao(p[0], l));
  const texto = el('div', { class: 'exp-lado' },
    el('p', { class: 't-texto exp-lado-frase', text: t('prova_frase', { n_ins: fmt.num(c.nIns), p_ins: fmt.pct(c.pIns, 0), n_tira: fmt.num(c.nTira), p_tira: fmt.pct(c.pTira, 0) }) }),
    el('p', { class: 't-p exp-lado-p', text: t('prova_spearman', { r: fmt.num(c.r, 2), n: fmt.num(pts.length) }) }),
    c.contraA && c.contraB && el('p', { class: 't-p exp-lado-p' }, montar('prova_contraste', {
      a: forteW(c.contraA), ra: razao2(c.contraA[1]), b: forteW(c.contraB),
      ib: fmt.num(c.contraB[3], 1), rb: razao2(c.contraB[1]),
    })),
    el('p', { class: 't-p exp-lado-p', text: t('prova_entram', { lingua: t(`lingua_${l}_nome`) }) }));
  caixa.replaceChildren(fig, texto);
  if (tab.mostrando) tab.atualizar();
  provaGrafico = dispersao(plot, pts, l, c);
}

function dispersao(plot, pts, l, contas) {
  const camada = el('div', { class: 'exp-camada' });
  plot.append(camada);
  // O cartão do celular fechou pelo botão: o foco volta ao gráfico, com o anel no ponto.
  const dica = criarDica(plot, { fixaNoCelular: true, aoFechar: () => plot.focus() });
  let foco = -1;
  let geo = null;
  const porX = pts.map((_, i) => i).sort((a, b) => pts[a][1] - pts[b][1] || pts[a][3] - pts[b][3]);
  const porY = pts.map((_, i) => i).sort((a, b) => pts[a][3] - pts[b][3] || pts[a][1] - pts[b][1]);

  function desenhar() {
    const compacto = faixa() === 'celular';
    const W = Math.max(280, plot.clientWidth);
    const H = compacto ? 320 : 460;
    const M = compacto ? { l: 40, r: 10, t: 26, b: 40 } : { l: 52, r: 16, t: 30, b: 50 };
    const xsVal = pts.map((p) => p[1]);
    const ysVal = pts.map((p) => p[3]);
    const x0 = Math.min(0.25, Math.min(...xsVal) * 0.92);
    const x1 = Math.max(2, Math.max(...xsVal) * 1.1);
    const passos = compacto ? [2, 5, 10, 20] : [1, 2, 5, 10, 20];
    const yMin = Math.min(0, ...ysVal);
    const yMax = Math.max(1, ...ysVal);
    const passo = passos.find((s) => Math.ceil(yMax / s) - Math.floor(yMin / s) <= (compacto ? 4 : 8)) || 20;
    const y0 = Math.floor(yMin / passo) * passo;
    const y1 = Math.ceil(yMax / passo) * passo;
    const xs = escalaLog([x0, x1], [M.l, W - M.r]);
    const ys = escalaLinear([y0, y1], [H - M.b, M.t]);
    const marcasX = [0.25, 0.5, 1, 2, 4, 8, 16].filter((v) => v >= x0 && v <= x1 && (!compacto || Number.isInteger(Math.log2(v) / 2)));
    const marcasY = [];
    for (let v = y0; v <= y1 + 1e-9; v += passo) marcasY.push(v);
    const r1 = (v) => Math.round(v * 10) / 10;
    const circ = (lista, r) => lista.map(([x, y]) => `M${r1(x - r)} ${r1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`).join('');
    const xy = pts.map((p) => [xs(p[1]), ys(p[3])]);
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' },
      el('rect', { class: 'exp-quadrante', x: r1(xs(1)), y: M.t, width: r1(W - M.r - xs(1)), height: r1(ys(0) - M.t) }),
      el('path', { class: 'exp-grade-linha', d: [...marcasX.map((v) => `M${r1(xs(v))} ${M.t}V${H - M.b}`), ...marcasY.map((v) => `M${M.l} ${r1(ys(v))}H${W - M.r}`)].join('') }),
      el('path', { class: 'exp-eixo', d: `M${M.l} ${M.t}V${H - M.b}H${W - M.r}` }),
      el('path', { class: 'exp-limite', d: `M${r1(xs(1))} ${M.t}V${H - M.b}M${M.l} ${r1(ys(0))}H${W - M.r}` }),
      el('path', { class: 'exp-ponto', d: circ(xy.filter((_, i) => !pts[i][5]), compacto ? 2.6 : 3) }),
      el('path', { class: 'exp-ponto-marca', d: circ(xy.filter((_, i) => pts[i][5]), compacto ? 4 : 4.5) }),
      el('circle', { class: 'exp-foco', r: 8, cx: 0, cy: 0, visibility: 'hidden' }));
    const rotulos = [];
    for (const v of marcasX) rotulos.push(el('span', { class: 'plot-rot rot-x', style: { left: `${xs(v)}px`, top: `${H - M.b}px` }, text: vezes(v) }));
    for (const v of marcasY) rotulos.push(el('span', { class: 'plot-rot rot-y', style: { left: `${M.l}px`, top: `${ys(v)}px` }, text: sinal(v) }));
    rotulos.push(el('span', { class: 'plot-rot exp-eixo-y', style: { left: `${M.l}px`, top: '0px' }, text: t(compacto ? 'prova_eixo_y_curto' : 'prova_eixo_y') }));
    rotulos.push(el('span', { class: 'plot-rot exp-eixo-x', style: { left: `${(M.l + W - M.r) / 2}px`, top: `${H - 16}px` }, text: t(compacto ? 'prova_eixo_x_curto' : 'prova_eixo_x') }));
    if (!compacto) rotulos.push(el('span', { class: 'plot-rot exp-quad-rot', style: { right: `${M.r + 6}px`, top: `${M.t + 6}px` }, text: t('prova_quadrante') }));
    rotulos.push(...rotulosPalavras(pts, xy, { W, M, compacto, contas, l, origem: [xs(1), ys(0)], quadLargura: compacto ? 0 : medir(t('prova_quadrante'), '600 12px') + 12 }));
    camada.replaceChildren(svg, ...rotulos);
    geo = { xy, W, H, focoEl: svg.querySelector('.exp-foco') };
    if (foco >= 0) mostrar(foco, false);
  }

  function mostrar(i, anunciarPonto = true) {
    foco = i;
    const p = pts[i];
    const [x, y] = geo.xy[i];
    geo.focoEl.setAttribute('cx', x);
    geo.focoEl.setAttribute('cy', y);
    geo.focoEl.setAttribute('visibility', 'visible');
    const conteudo = conteudoDica({
      palavra: p[0], lingua: l, sub: p[5] ? `${t(`sigla_${l}`)} · ${t('prova_marcadora')}` : t(`sigla_${l}`),
      valor: t('prova_dica_razao', { r: razao2(p[1]) }),
      extra: t('prova_dica_media', { v: fmt.num(p[3], 1) }),
      linhas: MODELOS.map((m) => ({ texto: t(`modelo_${m}`), valor: sinal(p[4][m]) })),
    });
    dica.mostrar(conteudo, { x, y });
    if (anunciarPonto) anunciar(`${p[0]}: ${t('prova_dica_razao', { r: razao2(p[1]) })}. ${t('prova_dica_media', { v: fmt.num(p[3], 1) })}.`);
  }
  function esconder() {
    foco = -1;
    dica.esconder();
    geo?.focoEl.setAttribute('visibility', 'hidden');
  }
  function maisPerto(px, py, raio = 16) {
    let melhor = -1;
    let dist = raio * raio;
    geo.xy.forEach(([x, y], i) => {
      const d2 = (x - px) ** 2 + (y - py) ** 2;
      if (d2 < dist || (d2 === dist && melhor >= 0 && pts[i][5] && !pts[melhor][5])) { dist = d2; melhor = i; }
    });
    return melhor;
  }
  const posicao = (e) => { const r = plot.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  plot.addEventListener('pointermove', (e) => {
    if (!geo || e.pointerType === 'touch') return;
    const i = maisPerto(...posicao(e));
    if (i >= 0) { if (i !== foco) mostrar(i, false); plot.style.cursor = 'pointer'; }
    else { plot.style.cursor = ''; if (document.activeElement !== plot) esconder(); }
  });
  plot.addEventListener('pointerleave', () => { if (document.activeElement !== plot) esconder(); });
  plot.addEventListener('click', (e) => {
    if (!geo || e.target.closest('.palavra-botao')) return;
    const i = maisPerto(...posicao(e), e.pointerType === 'touch' ? 24 : 16);
    if (i < 0) return;
    if (faixa() === 'celular' && foco !== i) { mostrar(i, false); return; }
    abrirPainel(`${pts[i][0]}.${l}`, plot);
  });
  plot.addEventListener('focus', () => { if (foco < 0 && pts.length) mostrar(porY[porY.length - 1]); });
  plot.addEventListener('blur', () => { if (faixa() !== 'celular') esconder(); });
  plot.addEventListener('keydown', (e) => {
    if (!pts.length) return;
    const atual = foco >= 0 ? foco : porY[porY.length - 1];
    const ix = porX.indexOf(atual);
    const iy = porY.indexOf(atual);
    let alvo = null;
    if (e.key === 'ArrowRight') alvo = porX[Math.min(porX.length - 1, ix + 1)];
    else if (e.key === 'ArrowLeft') alvo = porX[Math.max(0, ix - 1)];
    else if (e.key === 'ArrowUp') alvo = porY[Math.min(porY.length - 1, iy + 1)];
    else if (e.key === 'ArrowDown') alvo = porY[Math.max(0, iy - 1)];
    else if (e.key === 'Home') alvo = porX[0];
    else if (e.key === 'End') alvo = porX[porX.length - 1];
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPainel(`${pts[atual][0]}.${l}`, plot); return; }
    else if (e.key === 'Escape') { esconder(); return; }
    if (alvo == null) return;
    e.preventDefault();
    mostrar(alvo);
  });

  let largura = 0;
  const observador = new ResizeObserver(() => {
    if (plot.clientWidth && plot.clientWidth !== largura) { largura = plot.clientWidth; desenhar(); }
  });
  observador.observe(plot);
  return { destruir: () => { observador.disconnect(); dica.destruir(); } };
}

/** Largura de um texto na fonte do site (para os rótulos não se sobreporem). */
let regua = null;
function medir(texto, fonte) {
  regua ||= document.createElement('canvas').getContext('2d');
  regua.font = `${fonte} Figtree, 'Helvetica Neue', Arial, sans-serif`;
  return regua.measureText(texto).width;
}

/** Rótulos das palavras mais afastadas no canto de cima à direita (as que mais combinam as duas
 *  coisas) e das duas palavras do contraste, sem sobrepor uns aos outros nem às marcadoras. */
function rotulosPalavras(pts, xy, { W, M, compacto, contas, l, origem, quadLargura }) {
  const max = compacto ? 5 : 10;
  const [ox, oy] = origem;
  const quad = pts.map((p, i) => ({ p, i })).filter(({ p }) => p[1] > 1 && p[3] > 0)
    .map((c) => ({ ...c, d: Math.hypot(xy[c.i][0] - ox, oy - xy[c.i][1]) * (c.p[5] ? 1.25 : 1) }))
    .sort((a, b) => b.d - a.d);
  const extras = compacto ? [] : [contas.contraA, contas.contraB].filter(Boolean).map((p) => ({ p, i: pts.indexOf(p), fora: true }));
  const caixas = [{ x: W - M.r - quadLargura, y: M.t, w: quadLargura, h: 26 }];
  const pontos = xy.map(([x, y], k) => ({ k, x: x - 4, y: y - 4, w: 8, h: 8 })).filter(({ k }) => pts[k][5]);
  const sobrepoe = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const fonte = compacto ? '700 13px' : '700 14px';
  const out = [];
  let n = 0;
  for (const c of [...extras, ...quad]) {
    if (!c.fora && n >= max) break;
    const [x, y] = xy[c.i];
    const w = medir(c.p[0], c.fora ? '600 14px' : fonte) + 2;
    const h = 16;
    const livre = (cx) => {
      const caixa = { x: cx, y: y - h / 2, w, h };
      return cx >= M.l && cx + w <= W - M.r && !caixas.some((b) => sobrepoe(caixa, b)) && !pontos.some((b) => b.k !== c.i && sobrepoe(caixa, b)) ? caixa : null;
    };
    let lado = 'dir';
    let caixa = livre(x + 8);
    if (!caixa) { caixa = livre(x - 8 - w); lado = 'esq'; }
    if (!caixa) continue;
    caixas.push(caixa);
    if (!c.fora) n += 1;
    out.push(el('span', {
      class: `plot-rot exp-rot${c.fora ? ' exp-rot-fora' : ''}${lado === 'esq' ? ' exp-rot-esq' : ''}`,
      style: { left: `${lado === 'esq' ? x - 8 : x + 8}px`, top: `${y}px` }, lang: langDe(l), text: c.p[0],
    }));
  }
  return out;
}

// ---------- Início ----------
function iniciar() {
  const problemas = lerEstado();
  estado.provaLingua = estado.tarefa === 'traduzir' ? 'en' : estado.lingua;
  montarControles();
  carregarTarefa({ problemas });
  carregarProva();
  celular.addEventListener('change', () => { if (dadosTarefa) desenharInsere(); });
}

iniciar();
