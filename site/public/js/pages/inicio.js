// IAês · Início: o gráfico de abertura (duas palavras, um painel cada), o texto com o total de
// resumos, os números principais e as miniaturas e amostras das ferramentas.
// Dados: inicio.json (destaques, séries, números e amostras) e, para a miniatura das Áreas, areas.json.
// Nada aqui é escrito à mão: os valores vêm desses arquivos (site/DADOS.md).
import {
  el, t, fmt, rota, carregarEm, dados, palavraBotao, siglaLingua, lerChave, semMovimento, icone, lingua,
} from '../lib/base.js';
import { linhaTempo } from '../lib/grafico.js';
import { botaoTabela } from '../lib/tabela.js';
import { medidas } from '../lib/palavras.js';

const $ = (id) => document.getElementById(id);
const celular = matchMedia('(max-width: 599px)');
const ANO = '2025';              // último ano completo: o dos números e da razão
const paineis = [];
let mostrandoTabela = false;

// ---------- Gráfico de abertura ----------
function criarPainel(chave, s) {
  const { palavra, lingua: l } = lerChave(chave);
  const serie = { palavra, lingua: l, n: s.n, obs: s.obs, esp: s.esp };
  const m = medidas(serie);
  const corpo = el('div', { class: 'ini-corpo' });
  const fig = el('figure', { class: 'ini-painel' },
    el('figcaption', { class: 'ini-painel-cabeca' },
      el('div', { class: 'ini-painel-nome' },
        el('p', { class: 't-h3 ini-painel-titulo' },
          palavraBotao(palavra, l),
          el('span', { class: 'ini-so-largo' }, ` · ${t(`leg_${l}`)}`)),
        el('span', { class: 'etq ini-so-celular' }, el('span', { class: `chave chave-${l}` }), `${siglaLingua(l)} · ${t(`unidade_${l}`)}`),
        el('p', { class: 't-legenda ini-so-largo', text: t(`usam_${l}`) })),
      m?.razao != null && el('p', { class: 'ini-razao' },
        el('span', { class: 't-numero', text: fmt.razao(m.razao) }),
        el('span', { class: 't-legenda', text: t('razao_rotulo') }))),
    corpo);
  const p = { chave, palavra, lingua: l, fig, corpo, grafico: null, rotulo: null, tabela: null, animado: false };
  paineis.push(p);
  return p;
}

function desenharGrafico(p, s) {
  p.grafico = linhaTempo(p.corpo, {
    series: [{ palavra: p.palavra, lingua: p.lingua, n: s.n, obs: s.obs, esp: s.esp }],
    animar: true,
    colunasTabela: ['resumos', 'esperado', 'razao'],
    titulo: `${p.palavra} (${siglaLingua(p.lingua)})`,
  });
  // "excesso" escrito dentro do véu, no desktop. O gráfico se redesenha ao mudar de largura;
  // o rótulo acompanha lendo a posição dos pontos e da linha esperada já desenhados.
  p.rotulo = el('span', { class: 'ini-rot-excesso', 'aria-hidden': 'true', text: t('leg_excesso') });
  p.corpo.append(p.rotulo);
  const plot = p.grafico.elemento.querySelector('.lt-plot');
  new MutationObserver(() => posicionarExcesso(p)).observe(plot, { childList: true });
  posicionarExcesso(p);
  if (!semMovimento()) p.rotulo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 1100, fill: 'both' });
}

function posicionarExcesso(p) {
  const plot = p.grafico.elemento.querySelector('.lt-plot');
  const pontos = plot.querySelectorAll('.lt-pontos circle');
  const esperado = plot.querySelector('.lt-esperado');
  const numeros = (esperado?.getAttribute('d').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  // 12 pontos (2015 a 2026) e 6 do esperado (2021 a 2026); 2024 é o 10º ponto e o 4º esperado.
  const ok = !mostrandoTabela && !celular.matches && plot.clientWidth >= 400 && pontos.length === 12 && numeros.length === 12;
  p.rotulo.hidden = !ok;
  if (!ok) return;
  const x = Number(pontos[9].getAttribute('cx'));
  const yObs = Number(pontos[9].getAttribute('cy'));
  const yEsp = numeros[7];
  if (yEsp - yObs < 28) { p.rotulo.hidden = true; return; }
  p.rotulo.style.left = `${x + 8}px`;
  p.rotulo.style.top = `${(yObs + yEsp) / 2 + 10}px`;
}

function trocarTabela(p) {
  p.grafico.elemento.hidden = mostrandoTabela;
  p.tabela?.remove();
  p.tabela = null;
  if (mostrandoTabela) {
    p.tabela = el('div', { class: 'ini-tabela' }, p.grafico.tabela());
    p.corpo.append(p.tabela);
  }
  posicionarExcesso(p);
}

function desenharAbertura(d) {
  const caixa = $('ini-paineis');
  const validos = (d.destaques || []).filter((c) => lerChave(c) && d.series?.[c]);
  paineis.length = 0;
  caixa.replaceChildren(...validos.map((c) => criarPainel(c, d.series[c]).fig));
  validos.forEach((c, i) => desenharGrafico(paineis[i], d.series[c]));

  const comparar = $('ini-comparar');
  if (validos.length) comparar.href = `${rota('palavras')}?p=${validos.join(',')}`;
  if (!$('ini-acoes').querySelector('.botao-tabela')) {
    const botao = botaoTabela({
      aoMudar: (v) => { mostrandoTabela = v; paineis.forEach(trocarTabela); },
    });
    $('ini-acoes').append(botao.botao);
  }
}

// ---------- Texto de abertura ----------
const soma = (porAno) => Object.values(porAno || {}).reduce((a, b) => a + (b || 0), 0);

function desenharTexto(d) {
  const n = soma(d.resumos?.pt) + soma(d.resumos?.en);
  if (n > 0) $('ini-abertura-texto').innerHTML = t('abertura', { n: fmt.num(n) });
}

// ---------- Os números ----------
const pontos1 = (fracao) => fmt.num(fracao * 100, 1);
const unidadePontos = (fracao) => {
  const v = Math.abs(fracao * 100);
  return t((lingua === 'en' ? v === 1 : v < 2) ? 'ponto' : 'pontos');
};

function linkMetodo(ancora, sr) {
  return el('a', { class: 'link-acao', href: `${rota('metodo')}#${ancora}` },
    t('como_chegamos'), el('span', { class: 'sr', text: t(sr) }));
}

function linha(valor, texto, ancora, sr) {
  return el('div', { class: 'ini-linha' },
    el('dt', { class: 'dado' }, valor),
    el('dd', { class: 'ini-linha-texto' }, texto),
    el('dd', { class: 'ini-linha-link' }, linkMetodo(ancora, sr)));
}

function desenharNumeros(d) {
  const caixa = $('ini-numeros-dados');
  const partes = [];

  // O número grande: a estimativa mínima (validação cruzada) dos abstracts em inglês de 2025.
  const en = d.minimo?.en?.[ANO];
  const pt = d.minimo?.pt?.[ANO];
  if (en?.gap != null) {
    partes.push(el('div', { class: 'ini-destaque' },
      el('p', { class: 'ini-grande' }, fmt.pct(en.gap, 1)),
      el('p', { class: 'ini-destaque-texto', text: t('piso_texto') }),
      pt?.gap != null && el('p', { class: 'ini-destaque-pt', text: t('piso_pt', { pt: fmt.pct(pt.gap, 1) }) }),
      el('a', { class: 'link-acao', href: `${rota('metodo')}#estimativa-minima` },
        t('como_chegamos'), el('span', { class: 'sr', text: t('sr_piso') }), icone('seta'))));
  }

  const linhas = [];
  // Palavras de estilo com excesso em 2025 (regra móvel, H1), nas duas línguas.
  const estEn = d.estilo?.en?.[ANO];
  const estPt = d.estilo?.pt?.[ANO];
  if (estEn != null && estPt != null) {
    const antes = ['en', 'pt'].flatMap((l) => Object.entries(d.estilo[l]).filter(([ano]) => Number(ano) <= 2022));
    const ini = Math.min(...antes.map(([ano]) => Number(ano)));
    const max = Math.max(...antes.map(([, v]) => v));
    linhas.push(linha(fmt.num(estEn + estPt),
      t('estilo_texto', { en: fmt.num(estEn), pt: fmt.num(estPt), ini, max: fmt.num(max) }), 'marcadoras', 'sr_estilo'));
  }

  // H2: quanto a parcela com marcadora subiu em cada língua, nos mesmos artigos.
  const par = d.pares;
  if (par?.en_sobe != null && par?.pt_sobe != null) {
    const valor = el('span', { class: 'ini-par', role: 'img', 'aria-label': t('pares_rotulo', { en: pontos1(par.en_sobe), pt: pontos1(par.pt_sobe) }) },
      ...[['en', par.en_sobe], ['pt', par.pt_sobe]].map(([l, v]) => el('span', { class: 'ini-par-linha', 'aria-hidden': 'true' },
        el('span', { class: `chave chave-${l}` }), el('span', { class: 'ini-par-sigla', text: siglaLingua(l) }), pontos1(v))));
    const frases = [t('pares_texto')];
    if (par.dif != null && par.placebo != null) {
      const vars = { dif: pontos1(par.dif), unidade: unidadePontos(par.dif), placebo: pontos1(par.placebo) };
      frases.push(t(par.ic?.[0] <= 0 ? 'pares_acaso' : 'pares_dif', vars));
    }
    const a24 = par.em2024;
    if (a24?.ic?.[0] > 0 && a24.en_sobe > a24.pt_sobe) frases.push(t('pares_2024', { en: pontos1(a24.en_sobe), pt: pontos1(a24.pt_sobe) }));
    linhas.push(linha(valor, frases.join(' '), 'mesmo-artigo', 'sr_pares'));
  }

  // Resumos analisados: português e inglês (o espanhol fica de fora da análise).
  const rPt = soma(d.resumos?.pt);
  const rEn = soma(d.resumos?.en);
  if (rPt + rEn > 0) {
    const anos = Object.keys(d.resumos.pt).map(Number);
    linhas.push(linha(fmt.num(rPt + rEn), t('resumos_texto', {
      ini: Math.min(...anos), fim: Math.max(...anos), pt: fmt.num(rPt), en: fmt.num(rEn), pares: fmt.num(d.pares?.artigos ?? 0),
    }), 'dados', 'sr_resumos'));
  }
  if (linhas.length) partes.push(el('dl', { class: 'ini-lista' }, linhas));
  caixa.replaceChildren(...partes);
}

// ---------- Miniaturas das ferramentas ----------
const SVG = (viewBox, ...filhos) => el('svg', { viewBox, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, ...filhos);
const r1 = (n) => Math.round(n * 10) / 10;
const caminho = (pts) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L')}`;
const circulos = (pts, r) => pts.map(([x, y]) => `M${r1(x - r)} ${r1(y)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`).join(' ');

// Uma linha de palavra (2015 a 2025) com o esperado e o véu, na escala da própria série.
function miniLinha(s, l) {
  const vals = [...s.obs.slice(0, 11), ...s.esp.slice(0, 5)].filter((v) => v != null);
  const max = Math.max(...vals) * 1.08 || 1;
  const X = (i) => 4 + (92 * i) / 11;
  const Y = (v) => 96 - (90 * v) / max;
  const P = s.obs.slice(0, 11).map((v, i) => (v == null ? null : [X(i), Y(v)]));
  const E = s.esp.slice(0, 5).map((v, k) => (v == null ? null : [X(k + 6), Y(v)]));
  const filhos = [el('path', { d: 'M0 99.5 H100', class: 'mini-eixo' })];
  if (P.slice(8).every(Boolean) && E.slice(2).every(Boolean)) {
    filhos.push(el('path', { d: `${caminho([...P.slice(8), ...E.slice(2).reverse()])} Z`, class: 'mini-veu' }));
  }
  if (E.every(Boolean)) filhos.push(el('path', { d: caminho(E), class: 'mini-esp' }));
  if (P.every(Boolean)) filhos.push(el('path', { d: caminho(P), class: 'mini-obs', style: `stroke:var(--${l})` }));
  return SVG('0 0 100 100', ...filhos);
}

function miniPalavras(d) {
  const caixa = document.querySelector('[data-mini="palavras"]');
  const chaves = (d.destaques || []).filter((c) => lerChave(c) && d.series?.[c]);
  if (!caixa || !chaves.length) return;
  caixa.replaceChildren(el('span', { class: 'ini-mini-linhas', style: `--n:${chaves.length}` },
    chaves.map((c) => miniLinha(d.series[c], lerChave(c).lingua))));
}

// Áreas: o índice dos abstracts em inglês por área (linhas) e ano (colunas), nas faixas do calor.
const FAIXAS = [1.1, 1.3, 1.5, 1.7, 1.9, 2.1];
const faixaCalor = (v) => FAIXAS.findIndex((f) => v < f) === -1 ? 6 : FAIXAS.findIndex((f) => v < f);

function miniAreas(a) {
  const caixa = document.querySelector('[data-mini="areas"]');
  if (!caixa) return;
  const l = 'en';
  const areas = a ? [...a.areas].sort((x, y) => (a.indice[l][y]?.[10] ?? 0) - (a.indice[l][x]?.[10] ?? 0)) : Array(8).fill(null);
  const celulas = [];
  for (const area of areas) {
    for (let i = 0; i < 12; i += 1) {
      const v = area && a.indice[l][area]?.[i];
      const n = area ? a.resumos[l][area]?.[i] : 0;
      // Célula com menos de 100 resumos fica neutra (a tela das Áreas a mostra hachurada).
      const cor = v == null || n < 100 ? 'var(--sutil)' : `var(--calor-${faixaCalor(v)})`;
      celulas.push(el('span', { style: `background:${cor}` }));
    }
  }
  caixa.replaceChildren(el('span', { class: 'ini-mini-calor' }, celulas));
}

// Mapa e PT × EN: desenhos esquemáticos, sem números (os dados dessas telas são grandes demais
// para a página inicial). Pontos sorteados com semente fixa, para o desenho não mudar.
function sorteio(semente) {
  let s = semente;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function miniMapa() {
  const caixa = document.querySelector('[data-mini="mapa"]');
  if (!caixa) return;
  if (celular.matches) {
    const cinza = [[13.5, 37.5], [23.5, 41.5], [31.5, 35.5], [41.5, 39.5], [51.5, 36.5], [59.5, 42.5]];
    const acima = [[18.5, 14], [34.5, 20], [48.5, 24], [60.5, 18]];
    caixa.replaceChildren(el('svg', { viewBox: '0 0 72 56', 'aria-hidden': 'true', focusable: 'false' },
      el('path', { d: 'M4 52.5 H68', class: 'mini-eixo' }),
      el('path', { d: circulos(cinza, 1.6), class: 'mini-cinza' }),
      el('path', { d: circulos(acima, 1.8), class: 'mini-acima' })));
    return;
  }
  const rnd = sorteio(21);
  const cinza = [];
  const acima = [];
  for (let i = 0; i < 150; i += 1) {
    const x = 6 + rnd() * 248;
    const y = 70 + (rnd() + rnd() + rnd() - 1.5) * (18 + (260 - x) * 0.06);
    if (y < 46) acima.push([x, y]);
    else if (y < 104) cinza.push([x, y]);
  }
  acima.push([40, 12], [88, 22], [150, 30], [205, 38]);
  caixa.replaceChildren(el('svg', { viewBox: '0 0 260 108', 'aria-hidden': 'true', focusable: 'false' },
    el('path', { d: 'M0 70 H260', class: 'mini-eixo' }),
    el('path', { d: 'M0 46 H260', class: 'mini-corte' }),
    el('path', { d: circulos(cinza, 1.8), class: 'mini-cinza' }),
    el('path', { d: circulos(acima, 2.4), class: 'mini-acima' })));
}

function miniPtEn() {
  const caixa = document.querySelector('[data-mini="ptxen"]');
  if (!caixa) return;
  if (celular.matches) {
    caixa.replaceChildren(el('svg', { viewBox: '0 0 72 56', 'aria-hidden': 'true', focusable: 'false' },
      el('path', { d: 'M8 48 L64 8', class: 'mini-diagonal' }),
      el('path', { d: circulos([[17, 22], [25, 14], [33, 22]], 3), class: 'mini-en' }),
      el('path', { d: circulos([[43, 38], [52, 34]], 3), class: 'mini-pt' })));
    return;
  }
  const rnd = sorteio(7);
  const en = [];
  const pt = [];
  for (let i = 0; i < 70; i += 1) {
    const b = 10 + rnd() * 70;
    const x = 4 + b + (rnd() - 0.5) * 22;
    const y = 104 - (b + (rnd() - 0.5) * 26) * 0.9;
    (y < 104 - (x - 4) * (100 / 112) ? en : pt).push([x, y]);
  }
  caixa.replaceChildren(el('svg', { viewBox: '0 0 120 108', 'aria-hidden': 'true', focusable: 'false' },
    el('path', { d: 'M4 104 L116 4', class: 'mini-diagonal' }),
    el('path', { d: circulos(en, 2.6), class: 'mini-en' }),
    el('path', { d: circulos(pt, 2.6), class: 'mini-pt' })));
}

function miniaturasFixas() {
  miniMapa();
  miniPtEn();
}

// Amostras de texto real (inicio.json amostras): uma frase que um modelo reescreveu, com o que saiu
// riscado e o que entrou marcado, e a primeira frase do exemplo do Raio-X com as marcadoras.
const CLASSE_TRECHO = { '-': 'rem', '+': 'ins', '+m': 'ins ins-marca' };

function desenharAmostras(d) {
  const exp = d.amostras?.experimento?.[lingua];
  const caixaExp = document.querySelector('[data-amostra="experimento"]');
  if (exp && caixaExp) {
    caixaExp.replaceChildren(...exp.segmentos.flatMap(([op, texto], i) => [
      ...(i ? [' '] : []),
      CLASSE_TRECHO[op] ? el('span', { class: CLASSE_TRECHO[op], text: texto }) : texto,
    ]));
    // O cartão abre o mesmo resumo, com o mesmo modelo, na Máquina do tempo.
    caixaExp.closest('a').href = `${rota('experimento')}?${new URLSearchParams({ resumo: exp.id, modelo: exp.modelo })}`;
  }
  const rx = d.amostras?.raiox?.[lingua];
  const caixaRx = document.querySelector('[data-amostra="raiox"]');
  if (rx && caixaRx) {
    caixaRx.replaceChildren(...rx.segmentos.map(([texto, nivel]) => (nivel ? el('span', { class: `mk mk-${nivel}`, text: texto }) : texto)));
  }
}

// ---------- Início ----------
const altura = () => (celular.matches ? 620 : 400);
carregarEm($('ini-paineis'), 'inicio.json', { altura: altura() }).then((d) => {
  desenharAbertura(d);
  desenharTexto(d);
  miniPalavras(d);
  desenharAmostras(d);
});
carregarEm($('ini-numeros-dados'), 'inicio.json', { altura: 360, erroTitulo: t('erro_titulo_parte') }).then(desenharNumeros);

miniaturasFixas();
miniAreas(null);
// Até inicio.json chegar (ou se falhar), a miniatura de Palavras no tempo mostra só o eixo.
document.querySelector('[data-mini="palavras"]')?.replaceChildren(SVG('0 0 100 100', el('path', { d: 'M0 99.5 H100', class: 'mini-eixo' })));
celular.addEventListener('change', () => {
  miniaturasFixas();
  paineis.forEach(posicionarExcesso);
});

// A miniatura das Áreas (areas.json, 14 KB) baixa depois do gráfico de abertura. Se falhar, a
// grade fica neutra: o link para a tela continua.
dados('inicio.json').catch(() => {}).finally(() => dados('areas.json').then(miniAreas, () => {}));
