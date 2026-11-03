// IAês · Palavras no tempo: um painel por palavra (até cinco), com observado, esperado e excesso.
// Estado no endereço: ?p=delve.en,crucial.pt&area=engenharias&escala=relativa&esperado=nao.
// Sem parâmetros, abre com palavras/padrao.json. Partes do link que não existem nos dados viram
// o aviso "link com problema" e o resto continua.
import {
  el, icone, t, fmt, ANOS, AREAS, nomeArea, siglaLingua, lerUrl, gravarUrl, botaoCopiarLink, avisoLink, escapar,
  avisoRapido, lerChave, chave as fazerChave, inicial, carregarEm, esqueleto, estadoErro, descreverErro, ordinal,
  palavraBotao, semMovimento,
} from '../lib/base.js';
import {
  indice, serie, serieArea, padrao, medidas, rara, poucos, faixaResumos, MINIMO_RESUMOS,
} from '../lib/palavras.js';
import { linhaTempo } from '../lib/grafico.js';
import { tabela, botaoTabela } from '../lib/tabela.js';
import { segmentos, interruptor, seletorArea } from '../lib/filtros.js';
import { criarBusca } from '../lib/busca.js';
import { fraseContexto } from '../lib/painel.js';

const MAX = 5;
const $ = (id) => document.getElementById(id);
const celular = matchMedia('(max-width: 599px)');
const langDe = (l) => (l === 'en' ? 'en' : 'pt-BR');

const estado = { palavras: [], area: 'todas', escala: 'pct', esperado: true, tabela: false, aba: null };
const paineis = new Map();
let sugestoes = [];
let busca;
let filtros = {};
let botaoTab;

const caixas = {
  acoes: $('pal-acoes'), aviso: $('pal-aviso'), busca: $('pal-busca'), chips: $('pal-chips'),
  contagem: $('pal-contagem'), filtros: $('pal-filtros'), acaoTabela: $('pal-acao-tabela'),
  acaoTabelaCelular: $('pal-acao-tabela-celular'), legenda: $('pal-legenda'), paineis: $('pal-paineis'),
  tabela: $('pal-tabela'), tabelaNota: $('pal-tabela-nota'), abas: $('pal-abas'),
  contexto: $('pal-contexto-corpo'), sugestoes: $('pal-sugestoes'), vivo: $('pal-vivo'),
};

const alturaPlot = () => (celular.matches ? 240 : 330);
const anunciar = (texto) => { caixas.vivo.textContent = texto; };
const dadosDe = (palavra, l) => ({ palavra, sigla: siglaLingua(l) });

// ---------- Endereço ----------
function gravar() {
  gravarUrl({
    p: estado.palavras.join(','), area: estado.area, escala: estado.escala, esperado: estado.esperado ? null : 'nao',
  }, { area: 'todas', escala: 'pct' });
}

// ---------- Controles ----------
function montarControles() {
  caixas.acoes.append(botaoCopiarLink('btn btn-p'));
  busca = criarBusca({
    aoEscolher: (item) => adicionar(item.chave, { focar: true }),
    escolhida: (item) => estado.palavras.includes(item.chave),
    vazio: () => {
      const livres = sugestoes.filter((c) => !estado.palavras.includes(c)).slice(0, 3);
      if (!livres.length) return null;
      return el('div', { class: 'busca-vazio-sug' },
        el('p', { class: 't-p', text: t('vazio_sugestoes') }),
        el('div', { class: 'pal-sug-lista' }, livres.map((c) => botaoSugestao(c, () => busca.limpar()))));
    },
  });
  caixas.busca.append(busca.elemento);

  filtros.area = seletorArea({ valor: estado.area, aoMudar: mudarArea });
  filtros.escala = segmentos({
    rotulo: t('escala'), valor: estado.escala,
    opcoes: [{ valor: 'pct', texto: t('escala_pct') }, { valor: 'relativa', texto: t('escala_rel') }],
    aoMudar: (v) => { estado.escala = v; redesenharGraficos(); gravar(); },
  });
  filtros.esperado = interruptor({
    texto: t('mostrar_esperado'), ligado: estado.esperado,
    aoMudar: (v) => { estado.esperado = v; legenda(); redesenharGraficos(); gravar(); },
  });
  caixas.filtros.append(filtros.area, filtros.escala, filtros.esperado);

  botaoTab = botaoTabela({ aoMudar: (v) => { estado.tabela = v; for (const p of paineis.values()) desenharCorpo(p); } });
  posicionarBotaoTabela();
  celular.addEventListener('change', () => { posicionarBotaoTabela(); contagem(); });
  legenda();
}

function posicionarBotaoTabela() {
  (celular.matches ? caixas.acaoTabelaCelular : caixas.acaoTabela).append(botaoTab.botao);
}

function legenda() {
  caixas.legenda.querySelectorAll('.pal-leg-esp').forEach((n) => { n.hidden = !estado.esperado; });
}

function contagem() {
  const n = estado.palavras.length;
  caixas.contagem.textContent = t('contagem', { n: fmt.num(n), max: fmt.num(MAX) });
  $('pal-barra').querySelector('.pal-linha1').classList.toggle('pal-cheia', n >= MAX);
  if (n >= MAX) {
    const tinhaFoco = busca.entrada === document.activeElement;
    busca.desativar(true, t('busca_limite'));
    if (tinhaFoco) caixas.chips.querySelector('li:last-child .chip-x')?.focus();
  }
  else {
    busca.desativar(false);
    busca.definirPlaceholder(celular.matches ? t('busca_placeholder_n', { n: fmt.num(n), max: fmt.num(MAX) }) : t('busca_rotulo'));
  }
  caixas.paineis.dataset.n = String(n);
  caixas.paineis.style.setProperty('--colunas', String(Math.max(1, n)));
}

function botaoSugestao(c, depois) {
  const k = lerChave(c);
  const cheio = estado.palavras.length >= MAX;
  return el('button', {
    class: 'chip-sug', type: 'button', disabled: cheio || null, title: cheio ? t('busca_limite') : null,
    on: { click: () => { depois?.(); adicionar(c, { focar: true }); } },
  }, el('span', { class: 'w', lang: langDe(k.lingua), text: k.palavra }), el('span', { class: 'chip-lingua', text: siglaLingua(k.lingua) }));
}

// ---------- Chips ----------
function desenharChips() {
  caixas.chips.replaceChildren(...estado.palavras.map((c) => {
    const { palavra, lingua: l } = lerChave(c);
    return el('li', {}, el('span', { class: 'chip' },
      el('span', { class: `chave chave-${l}` }),
      el('span', { class: 'w', lang: langDe(l), text: palavra }),
      el('span', { class: 'chip-lingua', text: siglaLingua(l) }),
      el('button', {
        class: 'chip-x', type: 'button', dataset: { chave: c },
        'aria-label': t('chip_remover', { palavra, lingua: t(`lingua_${l}_nome`) }),
        on: { click: () => remover(c, { focar: true }) },
      }, icone('fechar'))));
  }));
}

// ---------- Painéis ----------
function criarPainel(c) {
  const { palavra, lingua: l } = lerChave(c);
  const razao = el('p', { class: 'pal-painel-razao' });
  const corpo = el('div', { class: 'pal-painel-corpo' });
  const fig = el('figure', { class: 'pal-painel', dataset: { chave: c } },
    el('figcaption', { class: 'pal-painel-cabeca' },
      el('div', { class: 'pal-painel-nome' },
        el('h3', { class: 'pal-painel-palavra' }, el('span', { class: 'w', lang: langDe(l), text: palavra })),
        el('span', { class: 'etq' }, el('span', { class: `chave chave-${l}` }), `${siglaLingua(l)} · ${t(`unidade_${l}`)}`)),
      razao),
    corpo);
  const p = { chave: c, palavra, lingua: l, fig, corpo, razao, grafico: null, s: null, sTodas: null, item: null, situacao: 'carregando' };
  paineis.set(c, p);
  return p;
}

function ordenarPaineis() {
  const nos = estado.palavras.map((c) => paineis.get(c)?.fig).filter(Boolean);
  if (!nos.length) {
    caixas.paineis.replaceChildren(el('div', { class: 'estado-vazio pal-vazio' },
      el('p', { class: 'pal-estado-titulo', text: t('nenhuma_titulo') }), el('p', { class: 't-p', text: t('nenhuma_texto') })));
    return;
  }
  caixas.paineis.replaceChildren(...nos);
}

async function carregarPainel(p) {
  p.situacao = 'carregando';
  desenharCabeca(p);
  // A linha do índice (classe e posição no excesso) baixa junto com a série. Sem o índice, a
  // tabela fica sem a posição e a palavra rara se decide só pela contagem.
  const pedidoItem = indice(p.lingua).then((ind) => ind.get(p.palavra) ?? null, () => null);
  const arquivo = `palavras/${p.lingua}/${inicial(p.palavra)}.json`;
  await carregarEm(p.corpo, arquivo, { altura: alturaPlot() });
  if (!paineis.has(p.chave)) return p;
  p.sTodas = await serie(p.palavra, p.lingua);
  if (!p.sTodas) {
    p.situacao = 'ausente';
    desenharPainel(p);
    return p;
  }
  p.item = await pedidoItem;
  if (!paineis.has(p.chave)) return p;
  await aplicarArea(p, false);
  return p;
}

async function aplicarArea(p, suave = true) {
  if (!p.sTodas) return;
  if (estado.area === 'todas') {
    p.s = p.sTodas;
  } else {
    const arquivo = `palavras/${p.lingua}/areas/${inicial(p.palavra)}.json`;
    await carregarEm(p.corpo, arquivo, { altura: alturaPlot(), semEsqueleto: suave && p.situacao === 'ok' });
    if (!paineis.has(p.chave)) return;
    p.s = await serieArea(p.palavra, p.lingua, estado.area);
  }
  // Palavra com classe teve excesso no conjunto e nunca é rara ali; numa área, vale só a contagem.
  p.situacao = !p.s ? 'sem-area' : rara(p.s, estado.area === 'todas' ? p.item : null) ? 'rara' : 'ok';
  desenharPainel(p);
}

function desenharCabeca(p) {
  p.razao.replaceChildren();
  if (p.situacao !== 'ok') return;
  const m = medidas(p.s);
  if (m?.razao == null) return;
  p.razao.append(
    el('span', { class: 't-numero num', text: fmt.razao(m.razao) }),
    el('span', { class: 't-legenda', text: t(estado.area === 'todas' ? 'razao_rotulo' : 'razao_rotulo_area') }));
}

function desenharPainel(p) {
  desenharCabeca(p);
  desenharCorpo(p);
  atualizarTabela();
  desenharContexto();
}

function opcoesGrafico(p) {
  return {
    series: [{ palavra: p.palavra, lingua: p.lingua, obs: p.s.obs, esp: p.s.esp, n: p.s.n }],
    escala: estado.escala, esperado: estado.esperado, altura: alturaPlot(), rotuloDireto: false,
    colunasTabela: ['resumos', 'esperado', 'razao'],
    titulo: `${p.palavra} (${siglaLingua(p.lingua)})${estado.area === 'todas' ? '' : `, ${nomeArea(estado.area)}`}`,
  };
}

function caixaEstado(titulo, texto) {
  return el('div', { class: 'estado-vazio pal-painel-estado' },
    el('p', { class: 'pal-estado-titulo' }, ...[titulo].flat()),
    texto && el('p', { class: 't-p', text: texto }));
}

function tabelaContagem(p) {
  return tabela([{ rotulo: t('tabela_ano') }, { rotulo: t('tabela_resumos'), num: true }],
    ANOS.map((ano, i) => [String(ano), p.s.n[i] == null ? t('sem_dado') : fmt.num(p.s.n[i])]),
    { legenda: t('tabela_legenda', { titulo: `${p.palavra} (${siglaLingua(p.lingua)})`, inicio: ANOS[0], fim: ANOS[ANOS.length - 1] }) });
}

function desenharCorpo(p) {
  const { corpo } = p;
  if (p.situacao === 'carregando') return;
  const palavraW = el('span', { class: 'w', lang: langDe(p.lingua), text: p.palavra });
  if (p.situacao !== 'ok' && p.grafico) { p.grafico.destruir(); p.grafico = null; }
  if (p.situacao === 'ausente') {
    corpo.replaceChildren(caixaEstado([t('busca_nenhum_antes'), palavraW, t('busca_nenhum_depois')], t('ausente_painel')));
    return;
  }
  if (p.situacao === 'sem-area') {
    corpo.replaceChildren(caixaEstado(t('area_sem', { area: nomeArea(estado.area) }), t('area_sem_dica')));
    return;
  }
  if (p.situacao === 'rara') {
    // Numa área, a palavra pode ser comum no conjunto: o texto diz de que área se trata.
    const textoRara = estado.area === 'todas'
      ? t('rara_texto', { minimo: MINIMO_RESUMOS })
      : t('rara_texto_area', { minimo: MINIMO_RESUMOS, area: nomeArea(estado.area) });
    corpo.replaceChildren(estado.tabela
      ? el('div', { class: 'pal-painel-tabela' }, tabelaContagem(p))
      : caixaEstado([palavraW, ' ', textoRara], t('rara_tabela')));
    return;
  }
  corpo.replaceChildren();
  if (!p.grafico) p.grafico = linhaTempo(corpo, opcoesGrafico(p));
  else {
    corpo.append(p.grafico.elemento);
    p.grafico.atualizar(opcoesGrafico(p));
  }
  p.grafico.elemento.hidden = estado.tabela;
  if (estado.tabela) corpo.append(el('div', { class: 'pal-painel-tabela' }, p.grafico.tabela()));
  // Nenhum ano com 20 resumos: a linha aparece, com o aviso de que oscila (como no painel da palavra).
  if (poucos(p.s)) {
    const [menor, maior] = faixaResumos(p.s);
    corpo.append(el('p', { class: 't-legenda pal-painel-nota', text: t('poucos_resumos', { min: fmt.num(menor), max: fmt.num(maior) }) }));
  }
}

function redesenharGraficos() {
  for (const p of paineis.values()) {
    if (p.situacao === 'ok') desenharCorpo(p);
  }
}

// ---------- Acrescentar e tirar palavras ----------
function adicionar(c, { focar = false, carregar = true } = {}) {
  const k = lerChave(c);
  if (!k) return null;
  c = fazerChave(k.palavra, k.lingua);
  if (estado.palavras.includes(c)) {
    anunciar(t('ja_esta', dadosDe(k.palavra, k.lingua)));
    paineis.get(c)?.fig.scrollIntoView({ block: 'nearest' });
    return paineis.get(c);
  }
  if (estado.palavras.length >= MAX) {
    avisoRapido(t('busca_limite'));
    return null;
  }
  estado.palavras.push(c);
  const p = criarPainel(c);
  if (estado.aba == null) estado.aba = c;
  desenharChips();
  ordenarPaineis();
  contagem();
  desenharSugestoes();
  gravar();
  if (carregar) carregarPainel(p);
  if (focar) {
    anunciar(t('adicionada', dadosDe(k.palavra, k.lingua)));
    busca.focar();
    // No celular os chips rolam de lado e o novo entra no fim da fileira, fora da tela.
    if (celular.matches) caixas.chips.scrollTo({ left: caixas.chips.scrollWidth, behavior: semMovimento() ? 'auto' : 'smooth' });
  }
  return p;
}

function remover(c, { focar = false } = {}) {
  const i = estado.palavras.indexOf(c);
  if (i < 0) return;
  const k = lerChave(c);
  estado.palavras.splice(i, 1);
  const p = paineis.get(c);
  p?.grafico?.destruir();
  paineis.delete(c);
  if (estado.aba === c) estado.aba = estado.palavras[0] ?? null;
  desenharChips();
  ordenarPaineis();
  contagem();
  atualizarTabela();
  desenharContexto();
  desenharSugestoes();
  gravar();
  if (focar) {
    anunciar(t('removida', dadosDe(k.palavra, k.lingua)));
    const proximo = caixas.chips.querySelectorAll('.chip-x')[Math.min(i, estado.palavras.length - 1)];
    (proximo || busca.entrada).focus();
  }
}

async function mudarArea(area) {
  estado.area = area;
  gravar();
  await Promise.all([...paineis.values()].map((p) => (p.sTodas ? aplicarArea(p) : null)));
  atualizarTabela();
}

// ---------- Tabela das palavras escolhidas ----------
function atualizarTabela() {
  const linhas = [];
  const pct = (v) => (v == null ? t('sem_dado') : fmt.pct(v));
  for (const c of estado.palavras) {
    const p = paineis.get(c);
    if (!p || p.situacao === 'ausente') continue;
    const nome = el('span', {}, palavraBotao(p.palavra, p.lingua, { class: 'pal-tab-palavra' }),
      el('span', { class: 'chip-lingua pal-tab-sigla', text: siglaLingua(p.lingua) }));
    const lingua = el('span', { class: 'etq' }, el('span', { class: `chave chave-${p.lingua}` }), siglaLingua(p.lingua));
    // Posição no excesso de 2025, da linha do índice (vazia enquanto ele não chega ou se falhar).
    const pos = p.item?.posicao;
    const posTexto = !p.item ? '' : pos ? ordinal(pos) : t('painel_fora');
    if (p.situacao === 'carregando') {
      linhas.push([nome, lingua, '', '', '', '', '', posTexto]);
      continue;
    }
    if (p.situacao === 'sem-area') {
      const poucos = t('tabela_poucos');
      linhas.push([nome, lingua, poucos, poucos, poucos, poucos, poucos, posTexto]);
      continue;
    }
    const m = medidas(p.s);
    const raraLinha = p.situacao === 'rara';
    // Ao lado do esperado e da razão de 2025, a parcela de 2021-22 é a do recorte de 2025 (base);
    // obs de 2021 e 2022 vem de outro conjunto de revistas (DADOS.md).
    linhas.push([nome, lingua, pct(p.s.base ?? m.base), pct(m.obs2025), pct(m.esp2025),
      raraLinha ? t('tabela_poucos') : { conteudo: m.razao == null ? t('sem_dado') : fmt.razao(m.razao), forte: true },
      raraLinha ? t('tabela_poucos') : (m.dif == null ? t('sem_dado') : fmt.pp(m.dif)),
      posTexto]);
  }
  if (!linhas.length) {
    caixas.tabela.replaceChildren(el('p', { class: 't-p', text: t('tabela_vazia') }));
  } else {
    caixas.tabela.replaceChildren(tabela([
      { rotulo: t('col_palavra') },
      { rotulo: t('col_lingua'), classe: 'pal-col-lingua' },
      { rotulo: t('col_2122'), curto: t('col_2122_curto'), num: true },
      { rotulo: t('col_2025'), curto: t('col_2025_curto'), num: true },
      { rotulo: t('col_esperado'), curto: t('col_esperado_curto'), num: true },
      { rotulo: t('col_razao'), num: true },
      { rotulo: t('col_diferenca'), num: true },
      { rotulo: t('col_posicao'), curto: t('col_posicao_curto'), num: true },
    ], linhas, { legenda: t('escolhidas_legenda'), classe: 'pal-tabela-caixa' }));
  }
  caixas.tabelaNota.textContent = estado.area === 'todas' ? t('tabela_nota') : `${t('tabela_nota_area', { area: nomeArea(estado.area) })} ${t('tabela_nota')}`;
}

// ---------- Em contexto ----------
function desenharContexto() {
  const lista = estado.palavras.map((c) => paineis.get(c)).filter((p) => p && p.situacao !== 'ausente');
  if (!lista.some((p) => p.chave === estado.aba)) estado.aba = lista[0]?.chave ?? null;
  caixas.abas.replaceChildren(...lista.map((p) => {
    const sel = p.chave === estado.aba;
    return el('button', {
      class: 'aba', type: 'button', role: 'tab', id: `pal-aba-${p.chave}`, 'aria-selected': String(sel),
      'aria-controls': 'pal-contexto-corpo', tabindex: sel ? '0' : '-1', dataset: { chave: p.chave },
      on: { click: () => { estado.aba = p.chave; desenharContexto(); } },
    }, el('span', { class: 'w', lang: langDe(p.lingua), text: p.palavra }), ` · ${siglaLingua(p.lingua)}`);
  }));
  const corpo = caixas.contexto;
  const p = paineis.get(estado.aba);
  if (!p) { corpo.replaceChildren(); return; }
  corpo.setAttribute('aria-labelledby', `pal-aba-${p.chave}`);
  if (p.situacao === 'carregando' || !p.sTodas) { corpo.replaceChildren(esqueleto(200)); return; }
  if (!p.sTodas.contexto) {
    corpo.replaceChildren(el('p', { class: 't-p pal-coluna-vazia', text: t('contexto_sem') }));
    return;
  }
  // O nível de realce vem dos dados (o mesmo de marcadoras.json); palavra que não é marcadora vai
  // só em negrito.
  const nivel = p.sTodas.nivel ?? null;
  corpo.replaceChildren(el('div', { class: 'pal-colunas' }, ['2019', '2025'].map((ano) => {
    const frases = (p.sTodas.contexto[ano] || []).slice(0, 3);
    return el('div', { class: 'pal-coluna' },
      el('h3', { class: 't-rotulo pal-coluna-ano', text: ano }),
      frases.length ? frases.map((f) => fraseContexto(f, { lingua: p.lingua, nivel }))
        : el('p', { class: 'pal-coluna-vazia', text: t('contexto_vazio_ano', { ano }) }));
  })));
}

caixas.abas.addEventListener('keydown', (evento) => {
  const abas = [...caixas.abas.querySelectorAll('[role=tab]')];
  const i = abas.indexOf(document.activeElement);
  if (i < 0) return;
  const destino = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: abas.length - 1 }[evento.key];
  if (destino == null) return;
  evento.preventDefault();
  const alvo = abas[(destino + abas.length) % abas.length];
  estado.aba = alvo.dataset.chave;
  desenharContexto();
  caixas.abas.querySelector(`[data-chave="${CSS.escape(estado.aba)}"]`)?.focus();
});

// ---------- Sugestões ----------
function desenharSugestoes() {
  const livres = sugestoes.filter((c) => !estado.palavras.includes(c));
  caixas.sugestoes.closest('section').hidden = !livres.length;
  caixas.sugestoes.replaceChildren(...livres.map((c) => botaoSugestao(c)));
}

// ---------- Aviso de link com problema ----------
function listaTexto(itens, e = t('aviso_e')) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(t('aviso_virgula'))}${e}${itens[itens.length - 1]}`;
}

function mostrarAvisoLink({ ausentes, formato, opcoes, areaRuim, excedeu, usouPadrao }) {
  const partes = [];
  // Uma lista e o fecho no singular ou no plural: "a e b, que não estão nos dados".
  const grupo = (itens, chave) => listaTexto(itens) + t(itens.length === 1 ? `${chave}_1` : `${chave}_n`);
  const negrito = (texto) => `<b>${escapar(texto)}</b>`;
  if (ausentes.length) {
    partes.push(grupo(ausentes.map(({ palavra, lingua: l }) => t('aviso_palavra', { palavra: escapar(palavra), resumos: t(`aviso_resumos_${l}`) })), 'aviso_nao_esta'));
  }
  if (formato.length) partes.push(grupo(formato.map(negrito), 'aviso_formato'));
  if (excedeu) partes.push(t('aviso_limite', { max: fmt.num(MAX) }));
  if (areaRuim) partes.push(t('aviso_area', { area: escapar(areaRuim) }));
  if (opcoes.length) partes.push(grupo(opcoes.map(negrito), 'aviso_opcao'));
  if (!partes.length) return;
  const onde = estado.area === 'todas' ? t('aviso_onde_todas') : t('aviso_onde_area', { area: escapar(nomeArea(estado.area)) });
  const mostradas = listaTexto(estado.palavras.map((c) => `<b>${escapar(lerChave(c).palavra)}</b>`));
  const fim = usouPadrao ? t('aviso_mostramos_padrao', { onde }) : t('aviso_mostramos', { palavras: mostradas, onde });
  caixas.aviso.replaceChildren(avisoLink(`${t('aviso_inicio')}${listaTexto(partes, t('aviso_e_partes'))}${fim}`));
}

// ---------- Início ----------
function esqueletoInicial(n) {
  caixas.chips.replaceChildren(...Array.from({ length: n }, () => el('li', { 'aria-hidden': 'true' }, el('span', { class: 'esq pal-esq-chip' }))));
  caixas.paineis.dataset.n = String(n);
  caixas.paineis.style.setProperty('--colunas', String(n));
  caixas.paineis.replaceChildren(...Array.from({ length: n }, () => el('div', { class: 'pal-painel pal-painel-esq', 'aria-hidden': 'true' },
    el('div', { class: 'pal-painel-cabeca' }, el('span', { class: 'esq', style: { width: '120px', height: '26px' } }), el('span', { class: 'esq', style: { width: '70px', height: '30px' } })),
    esqueleto(alturaPlot()))));
}

// As palavras de partida, com o erro e o "Tentar de novo" no lugar dos painéis.
function padraoComErro() {
  return new Promise((resolve) => {
    let tentativa = 0;
    const tentar = () => {
      tentativa += 1;
      esqueletoInicial(3);
      padrao().then(resolve, (erro) => {
        caixas.chips.replaceChildren();
        caixas.paineis.style.setProperty('--colunas', '1');
        caixas.paineis.replaceChildren(estadoErro({
          arquivo: erro.arquivo, erro: descreverErro(erro), tentativa, tentar, texto: t('erro_texto_tela'),
        }));
      });
    };
    tentar();
  });
}

async function iniciar() {
  const url = lerUrl();
  // Valores que a tela não conhece voltam ao padrão e entram no aviso.
  const opcoes = [];
  if (url.escala && !['pct', 'relativa'].includes(url.escala)) opcoes.push(`escala=${url.escala}`);
  if (url.esperado && !['sim', 'nao'].includes(url.esperado)) opcoes.push(`esperado=${url.esperado}`);
  estado.escala = url.escala === 'relativa' ? 'relativa' : 'pct';
  estado.esperado = url.esperado !== 'nao';
  let areaRuim = null;
  if (url.area && url.area !== 'todas') {
    if (AREAS.includes(url.area)) estado.area = url.area;
    else areaRuim = url.area;
  }
  montarControles();

  // Sugestões (e as palavras de partida, se o link não trouxer nenhuma).
  const sugPromessa = padrao().then((d) => { sugestoes = d.sugestoes || []; desenharSugestoes(); return d; }, () => {
    caixas.sugestoes.closest('section').hidden = true;
    return null;
  });

  // Palavras do link: fora do formato palavra.pt ou palavra.en, viram aviso; das outras, entram até cinco.
  const ausentes = [];
  const formato = [];
  let candidatas = [];
  const tokens = (url.p || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const token of tokens) {
    const k = lerChave(token);
    if (!k) { formato.push(token); continue; }
    const c = fazerChave(k.palavra, k.lingua);
    if (!candidatas.includes(c)) candidatas.push(c);
  }
  // Com mais de cinco, as que não estão nos dados saem antes do limite: o índice diz quais são.
  if (candidatas.length > MAX) {
    esqueletoInicial(MAX);
    const linguas = [...new Set(candidatas.map((c) => lerChave(c).lingua))];
    const indices = new Map(await Promise.all(linguas.map((l) => indice(l).then((ind) => [l, ind], () => [l, null]))));
    candidatas = candidatas.filter((c) => {
      const k = lerChave(c);
      const ind = indices.get(k.lingua);
      if (!ind || ind.get(k.palavra)) return true;
      ausentes.push(k);
      return false;
    });
  }
  const pedidas = candidatas.slice(0, MAX);
  const excedeu = candidatas.length > MAX;

  let usouPadrao = false;
  if (!pedidas.length) {
    usouPadrao = tokens.length > 0;
    esqueletoInicial(3);
    const d = await padraoComErro();
    sugestoes = d.sugestoes || [];
    pedidas.push(...(d.padrao || []).slice(0, MAX));
  }

  for (const c of pedidas) adicionar(c, { carregar: false });
  const resultados = await Promise.all(estado.palavras.map((c) => carregarPainel(paineis.get(c))));
  for (const p of resultados) {
    if (p.situacao === 'ausente' && pedidas.includes(p.chave)) {
      ausentes.push({ palavra: p.palavra, lingua: p.lingua });
      remover(p.chave);
    }
  }
  if (!estado.palavras.length && (ausentes.length || areaRuim)) {
    // Nada do link existe: abre com as palavras de partida.
    usouPadrao = true;
    const d = await sugPromessa;
    for (const c of d?.padrao || []) adicionar(c);
  }
  gravar();
  mostrarAvisoLink({
    ausentes, formato, opcoes, areaRuim, excedeu, usouPadrao: usouPadrao && (ausentes.length > 0 || formato.length > 0 || areaRuim),
  });
  desenharSugestoes();
}

// O painel da palavra pede "Abrir em Palavras no tempo": a palavra entra aqui mesmo.
document.addEventListener('iaes:abrir-em-palavras', (evento) => {
  const c = evento.detail?.chave;
  if (!c) return;
  if (!estado.palavras.includes(c) && estado.palavras.length >= MAX) {
    evento.preventDefault();
    evento.detail.fechado.then(() => avisoRapido(t('busca_limite')));
    return;
  }
  evento.preventDefault();
  evento.detail.fechado.then(() => {
    const p = adicionar(c);
    p?.fig.scrollIntoView({ block: 'center' });
  });
});

iniciar();
