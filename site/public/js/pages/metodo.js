// IAês · Método: índice da página, esquema do excesso, resumos por ano e estimativa mínima.
// Os números, as versões dos modelos e o pedido do experimento vêm de dados/inicio.json; os textos
// sem número ficam no HTML e valem se o arquivo (ou um campo dele) não chegar.
import { t, fmt, el, lingua, ANOS, carregarEm, dados, escapar } from '../lib/base.js';

const estreito = matchMedia('(max-width: 599px)');
const anoParcial = Number(t('parcial_ano'));
const ultimoCompleto = anoParcial - 1;
const r1 = (n) => Math.round(n * 10) / 10;
const pct = (x, total) => `${r1((x / total) * 100)}%`;
/** "a, b e c" (ou "a, b and c"). */
const lista = (itens) => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} ${t('e')} ${itens[itens.length - 1]}` : String(itens[0] ?? ''));

// ---------- Índice: lateral no desktop, recolhido no celular e no tablet ----------
const secoes = [...document.querySelectorAll('.metodo-secao')];
const linksIndice = [...document.querySelectorAll('.indice-lista a, .indice-celular-itens a')];
const atual = document.querySelector('.indice-atual');
let secaoAtual = null;

function marcarSecao() {
  const limite = Math.min(160, innerHeight * 0.3);
  let escolhida = secoes[0];
  for (const secao of secoes) if (secao.getBoundingClientRect().top - limite <= 0) escolhida = secao;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
    // No fim da página, a última seção que aparece inteira na tela.
    escolhida = secoes.filter((s) => s.getBoundingClientRect().top < innerHeight).pop() || escolhida;
    const ultima = secoes[secoes.length - 1];
    if (ultima.getBoundingClientRect().top < innerHeight * 0.6) escolhida = ultima;
  }
  if (escolhida === secaoAtual) return;
  secaoAtual = escolhida;
  for (const link of linksIndice) {
    if (link.getAttribute('href') === `#${escolhida.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  const link = linksIndice.find((l) => l.getAttribute('href') === `#${escolhida.id}`);
  if (atual && link) atual.textContent = link.textContent;
}
let pedido = 0;
addEventListener('scroll', () => {
  if (!pedido) pedido = requestAnimationFrame(() => { pedido = 0; marcarSecao(); });
}, { passive: true });
addEventListener('resize', marcarSecao);
marcarSecao();

const botaoIndice = document.querySelector('.indice-celular .entrada');
const listaIndice = document.getElementById('indice-celular-lista');
function abrirIndice(abrir) {
  botaoIndice.setAttribute('aria-expanded', String(abrir));
  listaIndice.hidden = !abrir;
}
botaoIndice?.addEventListener('click', () => abrirIndice(listaIndice.hidden));
listaIndice?.addEventListener('click', (evento) => {
  if (evento.target.closest('a')) abrirIndice(false);
});
document.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Escape' || !listaIndice || listaIndice.hidden) return;
  abrirIndice(false);
  botaoIndice.focus();
});
document.addEventListener('click', (evento) => {
  if (listaIndice && !listaIndice.hidden && !evento.target.closest('.indice-celular')) abrirIndice(false);
});

// ---------- Esquema "como medimos o excesso" (sem dados reais) ----------
// Valores ilustrativos: uma palavra estável até 2022 que sobe a partir de 2023.
const ESQ_OBS = [0.700, 0.720, 0.740, 0.760, 0.778, 0.796, 0.814, 0.826, 1.05, 1.62, 2.08];
const ESQ_ESP = [0.814, 0.826, 0.837, 0.849, 0.860]; // 2021 a 2025

function linha(pontos) {
  return 'M' + pontos.map((p) => `${r1(p[0])} ${r1(p[1])}`).join(' L');
}
function circulos(pontos, raio) {
  return pontos.map((p) => `M${r1(p[0] - raio)} ${r1(p[1])} a${raio} ${raio} 0 1 0 ${2 * raio} 0 a${raio} ${raio} 0 1 0 ${-2 * raio} 0`).join(' ');
}
function rotulo(texto, x, y, larg, alt, classe, html = false) {
  return el('span', {
    class: `plot-rot ${classe}`, style: { left: pct(x, larg), top: pct(y, alt) },
    [html ? 'html' : 'text']: texto, 'aria-hidden': 'true',
  });
}

function desenharEsquema(caixa) {
  const celular = estreito.matches;
  const [W, H, L, R, T, B] = celular ? [358, 230, 8, 26, 16, 26] : [760, 330, 30, 210, 24, 30];
  const pw = W - L - R;
  const ph = H - T - B;
  const ps = pw / 11;
  const X = (i) => L + ps * (i + 0.5);
  const Y = (v) => T + ph * (1 - v / 2.4);
  const P = ESQ_OBS.map((v, i) => [X(i), Y(v)]);
  const E = ESQ_ESP.map((v, k) => [X(k + 6), Y(v)]);
  const xChat = X(7) - ps / 2 + ps * (334 / 365); // 30/11/2022 dentro de 2022
  const id = 'hachura-metodo';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' },
    el('defs', {}, el('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(135)' },
      el('rect', { width: 6, height: 6, style: { fill: 'var(--papel)' } }),
      el('path', { d: 'M0 0 V6', style: { stroke: 'var(--linha-forte)', strokeWidth: '1.2' } }))),
    el('rect', { x: r1(X(6) - ps / 2), y: T, width: r1(ps * 2), height: r1(ph), style: { fill: 'var(--sutil)' } }),
    el('rect', { x: r1(X(8) - ps / 2), y: T, width: r1(ps), height: r1(ph), fill: `url(#${id})` }),
    el('path', { d: `M${L} ${r1(Y(0))} H${celular ? W - 8 : W - R + 10}`, style: { fill: 'none', stroke: 'var(--eixo)', strokeWidth: '1' } }),
    el('path', { d: `${linha(P.slice(8).concat(E.slice(2).reverse()))} Z`, style: { fill: 'var(--excesso-veu)' } }),
    el('path', { d: linha(E), style: { fill: 'none', stroke: 'var(--base)', strokeWidth: '2', strokeDasharray: '5 4' } }),
    el('path', { d: linha(P), style: { fill: 'none', stroke: 'var(--pt)', strokeWidth: '2.5', strokeLinejoin: 'round' } }),
    !celular && el('path', { d: circulos(P, 4.5), style: { fill: 'var(--pt)', stroke: 'var(--papel)', strokeWidth: '2' } }),
    el('path', {
      d: `M${r1(X(10) + (celular ? 8 : 10))} ${r1(P[10][1])} h${celular ? 5 : 6} V${r1(E[4][1])} h${celular ? -5 : -6}`,
      style: { fill: 'none', stroke: 'var(--tinta)', strokeWidth: '1.5' },
    }),
    !celular && el('path', { d: `M${r1(xChat)} ${T + 8} V${T + ph}`, style: { fill: 'none', stroke: 'var(--tinta-3)', strokeWidth: '1' } }));

  const anos = celular ? [0, 5, 10] : ESQ_OBS.map((_, i) => i);
  const rotulos = anos.map((i) => {
    const ano = String(2015 + i);
    const texto = celular || i === 0 || i === 10 ? ano : ano.slice(2);
    return rotulo(texto, X(i), T + ph, W, H, 'rot-x');
  });
  rotulos.push(
    rotulo(celular ? t('diag_base_curto') : t('diag_base_rot'), X(6.5), celular ? 0 : 3, W, H, 'rot-faixa'),
    rotulo('2023', X(8), celular ? 0 : 3, W, H, 'rot-faixa'));
  if (!celular) {
    rotulos.push(
      el('span', { class: 'plot-rot rot-marco', style: { left: pct(xChat, W), top: '9%' }, text: t('diag_chatgpt'), 'aria-hidden': 'true' }),
      rotulo(t('diag_formula'), X(10) + 16, (P[10][1] + E[4][1]) / 2, W, H, 'rot-chave', true),
      rotulo(t('diag_obs'), X(9), P[9][1], W, H, 'rot-linha'),
      rotulo(t('diag_esp'), X(9), E[3][1], W, H, 'rot-linha'));
    rotulos[rotulos.length - 2].style.transform = 'translate(-110%,-120%)';
    rotulos[rotulos.length - 1].style.transform = 'translate(-50%,10px)';
  }
  caixa.replaceChildren(el('div', { class: 'plot' }, svg, ...rotulos));
}

const caixaEsquema = document.querySelector('.caixa-esquema');
if (caixaEsquema) {
  desenharEsquema(caixaEsquema);
  estreito.addEventListener('change', () => desenharEsquema(caixaEsquema));
}

// ---------- Resumos por ano e língua ----------
const LINGUAS_GRAF = ['pt', 'en', 'es'];
const COR = { pt: 'var(--pt)', en: 'var(--en)', es: 'var(--base-claro)' };
const COR_PARCIAL = { pt: 'var(--pt-2)', en: 'var(--en-2)', es: 'var(--sutil)' };

function passoBonito(bruto) {
  const mag = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 5, 10].map((m) => m * mag).find((p) => p >= bruto);
}

function seriesResumos(d) {
  return ANOS.map((ano) => {
    const v = Object.fromEntries(LINGUAS_GRAF.map((l) => [l, d.resumos[l]?.[String(ano)] || 0]));
    return { ano, ...v, total: v.pt + v.en + v.es };
  });
}

function graficoResumos(linhas) {
  const celular = estreito.matches;
  const [W, H, L, R, base, topo, bw] = celular ? [358, 160, 8, 8, 130, 18, 16] : [760, 160, 48, 10, 136, 14, 22];
  const maximo = Math.max(...linhas.map((l) => l.total));
  const yMax = maximo * 1.12;
  const passoY = passoBonito(yMax / 3);
  const Y = (v) => base - ((base - topo) * v) / yMax;
  const passo = (W - L - R) / linhas.length;
  const cx = (i) => L + passo * (i + 0.5);
  const marcas = [];
  for (let v = passoY; v < yMax; v += passoY) marcas.push(v);

  const grupos = linhas.map((linha, i) => {
    const parcial = linha.ano === anoParcial;
    const x0 = cx(i) - bw / 2;
    let acumulado = 0;
    const partes = [];
    const presentes = LINGUAS_GRAF.filter((l) => linha[l] > 0);
    presentes.forEach((l, k) => {
      const y0 = Y(acumulado);
      acumulado += linha[l];
      const y1 = Y(acumulado);
      const fundo = k === 0 ? y0 : y0 - 1; // 1 px de papel entre as línguas
      const r = k === presentes.length - 1 ? Math.min(2, (fundo - y1) / 2) : 0;
      const d = r > 0
        ? `M${r1(x0)} ${r1(fundo)} V${r1(y1 + r)} a${r} ${r} 0 0 1 ${r} ${-r} H${r1(x0 + bw - r)} a${r} ${r} 0 0 1 ${r} ${r} V${r1(fundo)} Z`
        : `M${r1(x0)} ${r1(fundo)} V${r1(y1)} H${r1(x0 + bw)} V${r1(fundo)} Z`;
      partes.push(el('path', { d, style: { fill: (parcial ? COR_PARCIAL : COR)[l] } }));
    });
    if (parcial) {
      partes.push(el('path', {
        d: `M${r1(x0)} ${base} V${r1(Y(linha.total))} H${r1(x0 + bw)} V${base}`,
        style: { fill: 'none', stroke: 'var(--base)', strokeWidth: '1.5', strokeDasharray: '3 3' },
      }));
    }
    const dica = t('graf_dica', {
      ano: parcial ? t('tab_parcial', { ano: linha.ano }) : linha.ano,
      total: fmt.num(linha.total), pt: fmt.num(linha.pt), en: fmt.num(linha.en), es: fmt.num(linha.es),
    });
    return el('g', {}, el('title', { text: dica }), ...partes);
  });

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' },
    !celular && el('path', { d: marcas.map((v) => `M${L} ${r1(Y(v))} H${W - R}`).join(' '), style: { fill: 'none', stroke: 'var(--grade)', strokeWidth: '1' } }),
    ...grupos,
    el('path', { d: `M${L} ${base} H${W - R}`, style: { fill: 'none', stroke: 'var(--eixo)', strokeWidth: '1' } }));

  const indices = celular ? [0, 3, 6, 9, linhas.length - 1] : linhas.map((_, i) => i);
  const rotulos = indices.map((i) => {
    const ano = String(linhas[i].ano);
    const texto = i === 0 || (!celular && i === linhas.length - 1) ? ano : ano.slice(2);
    return rotulo(texto, cx(i), base, W, H, 'rot-x');
  });
  if (!celular) for (const v of marcas) rotulos.push(rotulo(fmt.num(v), L, Y(v), W, H, 'rot-y'));
  const iCompleto = linhas.findIndex((l) => l.ano === ultimoCompleto);
  const iParcial = linhas.findIndex((l) => l.ano === anoParcial);
  const valores = [0, iCompleto].filter((i) => i >= 0);
  for (const i of valores) rotulos.push(rotulo(fmt.num(linhas[i].total), cx(i), Y(linhas[i].total), W, H, 'plot-valor'));
  // O valor do ano parcial só entra se não encostar no do último ano completo (está na tabela).
  const folga = iCompleto >= 0 && iParcial >= 0 ? Math.abs(Y(linhas[iParcial].total) - Y(linhas[iCompleto].total)) : Infinity;
  if (!celular && iParcial >= 0 && folga >= 16) {
    rotulos.push(rotulo(t('graf_parcial_rot', { n: fmt.num(linhas[iParcial].total) }), cx(iParcial), Y(linhas[iParcial].total), W, H, 'plot-valor'));
    rotulos[rotulos.length - 1].style.transform = 'translate(-72%,-130%)';
  }
  return el('div', { class: 'plot' }, svg, ...rotulos);
}

function tabelaResumos(linhas) {
  const cab = ['tab_ano', 'tab_pt', 'tab_en', 'tab_es', 'tab_total'];
  return el('div', { class: 'tabela-caixa' },
    el('table', { class: 'tabela', 'aria-labelledby': 'graf-titulo' },
      el('thead', {}, el('tr', {}, cab.map((c, i) => el('th', { scope: 'col', class: i ? 'n' : null, text: t(c) })))),
      el('tbody', {}, linhas.map((l) => el('tr', {},
        el('th', { scope: 'row', class: 'num', text: l.ano === anoParcial ? t('tab_parcial', { ano: l.ano }) : String(l.ano) }),
        ...['pt', 'en', 'es', 'total'].map((k) => el('td', { class: 'n', text: fmt.num(l[k]) })))))));
}

const caixaResumos = document.querySelector('.caixa-resumos');
const botaoTabela = document.querySelector('.botao-tabela');
let emTabela = false;

function mostrarResumos(d) {
  const linhas = seriesResumos(d);
  const desenhar = () => {
    caixaResumos.replaceChildren(emTabela ? tabelaResumos(linhas) : graficoResumos(linhas));
    botaoTabela.replaceChildren(
      el('svg', { class: 'ic ic-p', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        el('path', { d: emTabela ? 'M4 19V5M4 19h16M7 15l4-4 3 3 5-6' : 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14' })),
      t(emTabela ? 'ver_grafico' : 'ver_tabela'));
    const legenda = caixaResumos.parentElement.querySelector('.legenda');
    if (legenda) legenda.hidden = emTabela;
  };
  botaoTabela.hidden = false;
  botaoTabela.onclick = () => { emTabela = !emTabela; desenhar(); };
  estreito.addEventListener('change', () => { if (!emTabela) desenhar(); });
  desenhar();

  const completas = linhas.filter((l) => l.ano < anoParcial);
  const pts = completas.map((l) => l.pt);
  const fim = linhas.find((l) => l.ano === ultimoCompleto);
  document.getElementById('graf-resumo').textContent = t('graf_resumo', {
    ultimo: anoParcial, ano: ultimoCompleto, en0: fmt.num(linhas[0].en), en1: fmt.num(fim.en),
    ptmin: fmt.num(Math.min(...pts)), ptmax: fmt.num(Math.max(...pts)),
  });
}

// ---------- Estimativa mínima ----------
function mostrarMinimo(caixa, d) {
  const anos = Object.keys(d.minimo.en || {}).map(Number).sort((a, b) => a - b);
  // Com uma marcadora no máximo em cada metade, a conta mede aquela palavra: não há estimativa.
  const quase = (m) => !m || Math.max(...(m.marcadoras || [0])) <= 1;
  const celula = (m) => {
    if (!m) return el('td', { class: 'n fraco', text: t('sem_dado') });
    if (quase(m)) return el('td', { class: 'n fraco', text: t('min_zero') });
    return el('td', { class: 'n', text: t('min_valor', { v: fmt.pct(m.gap, 1), ep: fmt.num(m.ep * 100, 1) }) });
  };
  const tabela = el('div', { class: 'tabela-caixa' },
    el('table', { class: 'tabela', 'aria-labelledby': 'min-titulo' },
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col', text: t('min_tab_ano') }),
        el('th', { scope: 'col', class: 'n', text: t('min_tab_en') }),
        el('th', { scope: 'col', class: 'n', text: t('min_tab_pt') }))),
      el('tbody', {}, anos.map((ano) => el('tr', {},
        el('td', { class: 'num', text: ano === anoParcial ? t('tab_parcial', { ano }) : String(ano) }),
        celula(d.minimo.en[ano]), celula(d.minimo.pt?.[ano]))))));
  const placebos = ['en', 'pt'].flatMap((l) => Object.values(d.minimo[l] || {}).filter((m) => !quase(m)).map((m) => m.placebo));
  const notas = [t('min_nota', { pmin: fmt.pct(Math.min(...placebos), 1), pmax: fmt.pct(Math.max(...placebos), 1) })];
  const anosZero = anos.filter((ano) => d.minimo.pt?.[ano] && quase(d.minimo.pt[ano]));
  if (anosZero.length) notas.push(t('min_nota_pt', { anos: lista(anosZero) }));
  caixa.replaceChildren(tabela, el('p', { class: 't-legenda', text: notas.join(' ') }));
}

// ---------- Textos com número ----------
const num1 = (fracao) => fmt.num(fracao * 100, 1);
const pct0 = (fracao) => fmt.pct(fracao, 0);

// Data do experimento no formato do site: 30/10/2026 ou October 30, 2026.
function dataCurta(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const dois = (n) => String(n).padStart(2, '0');
  return lingua === 'en' ? `${t(`mes_${mes}`)} ${dia}, ${ano}` : `${dois(dia)}/${dois(mes)}/${ano}`;
}

// "Claude em 30/10/2026; ChatGPT e Gemini em 31/10/2026": os modelos agrupados pelas datas.
function datasExperimento(versoes) {
  const grupos = new Map();
  for (const v of versoes) {
    const chave = v.datas.join(' ');
    grupos.set(chave, [...(grupos.get(chave) || []), v.nome]);
  }
  return [...grupos].sort(([a], [b]) => a.localeCompare(b))
    .map(([datas, nomes]) => t('exp_datas_grupo', { modelos: lista(nomes), datas: lista(datas.split(' ').map(dataCurta)) }))
    .join('; ');
}

/**
 * Para cada [data-num], uma função que devolve as variáveis do texto t(chave) (vira innerHTML),
 * um texto pronto (vira textContent) ou null (fica o texto sem número do HTML).
 */
function variaveis(d) {
  const m = d.metodo;
  const p = d.pares;
  const soma = (l) => Object.values(d.resumos[l] || {}).reduce((a, b) => a + b, 0);
  const versoes = d.experimento?.versoes || [];
  const comVersao = (id) => {
    const v = versoes.find((x) => x.id === id);
    return v ? { versao: escapar(v.versao) } : null;
  };
  return {
    dados_p1: () => ({ com_resumo: fmt.num(m.revistas.com_resumo), colecao: fmt.num(m.revistas.colecao), por_ano: fmt.num(m.amostra_pares.por_ano) }),
    ficha_filtros_v: () => ({
      total: fmt.num(Object.values(m.filtros).reduce((a, b) => a + b, 0)),
      ...Object.fromEntries(['length', 'glued', 'language', 'duplicate', 'notice'].map((k) => [k, fmt.num(m.filtros[k] ?? 0)])),
    }),
    ficha_resumos_v: () => ({ total: fmt.num(d.resumos.total), pt: fmt.num(soma('pt')), en: fmt.num(soma('en')), es: fmt.num(soma('es')) }),
    ficha_pares_v: () => ({ n: fmt.num(p.artigos), sorteados: fmt.num(m.amostra_pares.sorteados) }),
    aj_tamanho: () => {
      const tm = m.tamanho;
      return {
        en0: fmt.num(tm.en['2022'], 1), en1: fmt.num(tm.en[ultimoCompleto], 1),
        pt0: fmt.num(tm.pt['2022'], 1), pt1: fmt.num(tm.pt[ultimoCompleto], 1), ano: ultimoCompleto,
      };
    },
    marc_p2: () => {
      const c = m.concordancia;
      if (c.pt.amostra !== c.en.amostra) return null;
      return {
        total: fmt.num(m.rotuladas.pt + m.rotuladas.en), pt: fmt.num(m.rotuladas.pt), en: fmt.num(m.rotuladas.en), amostra: fmt.num(c.pt.amostra),
        acordo_pt: pct0(c.pt.acordo), kappa_pt: fmt.num(c.pt.kappa, 2), acordo_en: pct0(c.en.acordo), kappa_en: fmt.num(c.en.kappa, 2),
        dec_pt: pct0(c.pt.acordo_decididas), dec_en: pct0(c.en.acordo_decididas),
      };
    },
    marc_h1: () => {
      const antes = ['en', 'pt'].flatMap((l) => Object.entries(d.estilo[l] || {}).filter(([ano]) => Number(ano) < 2023).map(([, n]) => n));
      const anosAntes = Object.keys(d.estilo.en || {}).map(Number).filter((a) => a < 2023);
      return {
        min: fmt.num(Math.min(...antes)), max: fmt.num(Math.max(...antes)),
        ini: Math.min(...anosAntes), fim: Math.max(...anosAntes), ano: ultimoCompleto,
        en: fmt.num(d.estilo.en[ultimoCompleto]), pt: fmt.num(d.estilo.pt[ultimoCompleto]),
      };
    },
    marc_lista: () => ({ pt: fmt.num(m.marcadoras.pt), en: fmt.num(m.marcadoras.en) }),
    h3_p: () => {
      const { pt, en } = m.h3;
      const pMax = Math.max(pt.p, en.p);
      return {
        pt_sim: fmt.num(pt.traduzem), pt_n: fmt.num(pt.marcadoras), pt_pct: pct0(pt.traduzem / pt.marcadoras),
        pt_cpct: pct0(pt.controles_traduzem / pt.controles), en_n: fmt.num(en.marcadoras),
        en_pct: pct0(en.traduzem / en.marcadoras), en_cpct: pct0(en.controles_traduzem / en.controles),
        p: pMax < 0.001 ? `< ${fmt.num(0.001, 3)}` : `= ${fmt.num(pMax, 3)}`,
      };
    },
    // O tamanho das listas de marcadoras da estimativa mínima no último ano completo, por metade.
    min_conjuntos: () => {
      const [enA, enB] = d.minimo.en[ultimoCompleto].marcadoras;
      const [ptA, ptB] = d.minimo.pt[ultimoCompleto].marcadoras;
      return { ano: ultimoCompleto, en_a: fmt.num(enA), en_b: fmt.num(enB), pt_a: fmt.num(ptA), pt_b: fmt.num(ptB) };
    },
    par_p2: () => ({
      en: num1(p.en_sobe), pt: num1(p.pt_sobe), dif: num1(p.dif), a: num1(p.ic[0]), b: num1(p.ic[1]),
      placebo: num1(p.placebo), pa: num1(p.placebo_ic[0]), pb: num1(p.placebo_ic[1]),
      en24: num1(p.em2024.en_sobe), pt24: num1(p.em2024.pt_sobe), d24: num1(p.em2024.dif), a24: num1(p.em2024.ic[0]), b24: num1(p.em2024.ic[1]),
    }),
    exp_p2: () => {
      const a = m.experimento_amostra;
      const porArea = new Set(Object.values(a).map((x) => x.por_area));
      if (porArea.size !== 1 || porArea.has(null)) return null;
      return {
        por_area: fmt.num(a['polish-pt'].por_area), max_en: fmt.num(a['polish-en'].max_por_revista),
        max_pt: fmt.num(a['polish-pt'].max_por_revista), max_tr: fmt.num(a['translate-pt-en'].max_por_revista),
      };
    },
    exp_chatgpt_v: () => comVersao('chatgpt'),
    exp_gemini_v: () => comVersao('gemini'),
    exp_claude_v: () => comVersao('claude'),
    exp_amostra_v: () => ({ textos: fmt.num(d.experimento.textos), modelos: fmt.num(d.experimento.modelos), tarefas: fmt.num(d.experimento.tarefas) }),
    exp_datas_v: () => (versoes.length ? datasExperimento(versoes) : null),
    exp_prompt: () => d.experimento.pedido[lingua] || null,
    lim_5: () => ({ textos: fmt.num(d.experimento.textos) }),
  };
}

function preencherTextos(d) {
  const vars = variaveis(d);
  for (const no of document.querySelectorAll('[data-num]')) {
    const chave = no.dataset.num;
    let v = null;
    try {
      v = vars[chave]?.();
    } catch (erro) {
      console.warn(`IAês: inicio.json sem os números de ${chave}`, erro);
    }
    if (typeof v === 'string') no.textContent = v;
    else if (v) no.innerHTML = t(chave, v);
  }
}

// Quem chega por um link com âncora (#estimativa-minima, da página inicial) não deve ver o alvo
// escorregar quando os números chegam e o texto muda de tamanho; se a pessoa já mexeu, nada muda.
let mexeu = false;
for (const evento of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
  addEventListener(evento, () => { mexeu = true; }, { once: true, passive: true });
}
function manterAncora() {
  if (mexeu || !location.hash) return;
  let alvo = null;
  try { alvo = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* âncora inválida */ }
  alvo?.scrollIntoView({ behavior: 'instant', block: 'start' });
}

if (caixaResumos) {
  const altura = () => Math.round((caixaResumos.clientWidth * 160) / (estreito.matches ? 358 : 760));
  const caixaMinimo = document.querySelector('.caixa-minimo');
  Promise.all([
    carregarEm(caixaResumos, 'inicio.json', { altura: altura() }).then((d) => {
      mostrarResumos(d);
      preencherTextos(d);
    }),
    carregarEm(caixaMinimo, 'inicio.json', { altura: 250, erroTitulo: t('erro_titulo_parte') }).then((d) => mostrarMinimo(caixaMinimo, d)),
  ]).then(manterAncora);
  // Se o arquivo não chegar, os textos ficam na versão sem número (já no HTML).
  dados('inicio.json').catch(() => {});
}

// ---------- Artigo em PDF: link só quando o build achou o PDF (o rodapé sabe) ----------
const pdf = document.querySelector('.rodape a[href$="artigo.pdf"]');
const linhaArtigo = document.querySelector('.repro-artigo .repro-indisponivel');
if (pdf && linhaArtigo) {
  linhaArtigo.replaceWith(el('a', { class: 'linha-link repro-linha', href: pdf.getAttribute('href') },
    el('svg', { class: 'ic', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d: 'M6 3h8l4 4v14H6zM14 3v4h4' })),
    el('span', { class: 'repro-texto' },
      el('span', { class: 'linha-titulo', text: t('rep_artigo') }),
      el('span', { class: 'repro-desc', text: t('rep_artigo_d') })),
    el('svg', { class: 'ic ic-p repro-seta', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }))));
}
