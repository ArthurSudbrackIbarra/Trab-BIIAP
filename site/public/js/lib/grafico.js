// IAês · escalas, marcas de eixo e o gráfico de linha do tempo do design (fund-graficos,
// comp-dados, d-palavras). SVG desenhado na largura real da caixa (redesenha ao redimensionar),
// rótulos em HTML por cima. Cor só por token.
//
// ---------- Escalas ----------
//   escalaLinear([d0, d1], [r0, r1]) → f(v) em px; f.inverso(px); f.dominio; f.faixa
//   escalaLog([d0, d1], [r0, r1])    → o mesmo em log10 (d0 e d1 > 0)
//   marcasBonitas(min, max, quantas = 5) → marcas em passos de 1, 2, 2,5 ou 5 × 10^k, da primeira
//       ≤ min à última ≥ max, com no máximo `quantas` intervalos (5 → de 4 a 6 marcas; 2 → 3 marcas).
//       O array traz .passo e .casas (casas decimais que o passo pede).
//
// ---------- Linha do tempo ----------
//   const g = linhaTempo(caixa, opcoes);   g.atualizar(novasOpcoes); g.destruir();
//   g.dadosTabela() → { colunas, linhas, legenda } (para tabela.js); g.tabela() → elemento pronto
//   g.elemento (a <div class="lt"> criada dentro da caixa)
//
//   Anos de 2015 a 2026 no X (ANOS de base.js); o último é parcial (ponto vazado, ligação
//   pontilhada, a palavra "parcial" e véu do excesso pela metade).
//
//   Esperado: a reta de 2021 a 2022 e, de 2023 em diante, um traço por ano, de meio ano antes a
//   meio ano depois, sem ligar um ano ao outro: o esperado de cada ano usa as revistas daquele ano
//   (DADOS.md, "Recorte de cada ano"), então os anos não formam uma reta. O véu do excesso fica
//   entre a linha observada e esses degraus. O caminho .lt-esperado traz os seis pontos de 2021 a
//   2026 (os de 2023 em diante só como M, sem traço); os degraus ficam em .lt-esperado-ano.
//   O texto que explica isso ao leitor é t('nota_esperado'), para o pé do gráfico.
//
//   opcoes:
//     series: [{ palavra, lingua: 'pt'|'en', obs: [12], esp: [6] | null, n: [12]?, cor?, chave? }]
//        obs e esp em frações de 0 a 1 (como nos dados); esp vai de 2021 a 2026. null = sem dado.
//        cor: padrão var(--pt) ou var(--en) pela língua; chave: a classe da chave de linha
//        ('pt', 'en', 'base'), padrão a língua. Várias séries dividem o mesmo eixo.
//     escala: 'pct' (padrão) | 'relativa' (cada série dividida pela média de 2021 e 2022; 1 = 2021-22)
//     esperado: true. Mostra a linha esperada e o véu do excesso (de 2023 em diante).
//     veu: true. Véu do excesso de cada série com esperado; false tira o véu e deixa as linhas
//        (útil com duas séries, em que os véus se sobrepõem), ou uma lista de índices de série.
//     altura: altura do gráfico em px (padrão 330; 240 no modo compacto).
//     compacto: 'auto' (padrão: celular abaixo de 600 px) | true | false. Três marcas no Y, anos a
//        cada três, rótulo "ChatGPT" curto, pontos menores.
//     animar: false. A linha observada se desenha uma vez em 1.200 ms (corte seco com
//        prefers-reduced-motion).
//     rotuloDireto: true. Valor escrito acima do ponto do último ano completo (2025).
//     rotuloParcial: true. A palavra "parcial" ao lado do ponto de 2026.
//     marco: true. Linha do ChatGPT (30/11/2022) com rótulo.
//     anel: 'var(--papel)'. Cor do anel dos pontos (use var(--superficie) sobre cartão ou painel).
//     raio: raio dos pontos em px (padrão 4,5; 4 no compacto).
//     formatoY(v, marcas) → texto do eixo Y (v já na escala escolhida).
//     formatoValor(v, serie) → texto de um valor (dica, rótulo direto, tabela). v na escala.
//     dica(info) → Node | null: conteúdo próprio para a dica (info abaixo). Padrão: a frase do design.
//     resumo: texto (ou função(info) → texto) para leitor de tela; padrão: uma frase com 2021-22,
//        2025 e o esperado da primeira série.
//     titulo: nome do gráfico para leitor de tela e legenda da tabela (padrão: palavras e línguas).
//     colunasTabela: quais colunas a tabela traz além de Ano e Observado, entre 'resumos',
//        'esperado', 'diferenca' e 'razao' (padrão: todas as que existirem).
//
//   info (dica e resumo): { i, ano, parcial, escala, series: [{ serie, valor, bruto, esperado,
//     esperadoBruto, n, razao, dif }] } com valor/esperado na escala do gráfico e bruto/esperadoBruto
//     em fração; razao = obs/esp e dif = obs − esp (frações), null antes de 2023 ou sem esperado.
//
//   Ajudas exportadas, para dicas e textos próprios das telas:
//     formatoEixo(escala) → (v, marcas) → texto do eixo Y ('pct': "0,5%"; 'relativa': "2×")
//     fraseExcesso(obs, esp) → "Excesso de 1,35 ponto percentual, 5,7 vezes o esperado." (frações)
//     unidadePontos(dif) → "ponto percentual" ou "pontos percentuais", conforme o valor e o idioma
//
//   Teclado: o gráfico é uma parada de Tab; setas, Home e End trocam o ano e abrem a dica. Esc
//   fecha a dica e deixa o anel do ponto, que mostra o foco; com a dica fechada, o Esc segue (no
//   painel da palavra, fecha o painel).
//   Mouse: a dica acha o ano mais próximo. Toque: no celular a dica vira cartão abaixo do gráfico;
//   fechar o cartão devolve o foco ao ano.
import { el, t, fmt, ANOS, faixa, semMovimento, siglaLingua } from './base.js';
import { criarDica, conteudoDica } from './dica.js';
import { tabela as montarTabela } from './tabela.js';

// ---------- Escalas e marcas ----------
export function escalaLinear([d0, d1], [r0, r1]) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = (v) => r0 + (v - d0) * k;
  f.inverso = (px) => (k === 0 ? d0 : d0 + (px - r0) / k);
  f.dominio = [d0, d1];
  f.faixa = [r0, r1];
  return f;
}

export function escalaLog([d0, d1], [r0, r1]) {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  const lin = escalaLinear([l0, l1], [r0, r1]);
  const f = (v) => lin(Math.log10(v));
  f.inverso = (px) => 10 ** lin.inverso(px);
  f.dominio = [d0, d1];
  f.faixa = [r0, r1];
  return f;
}

const PASSOS = [1, 2, 2.5, 5];
function casasDe(passo) {
  for (let c = 0; c < 12; c += 1) {
    if (Math.abs(Math.round(passo * 10 ** c) - passo * 10 ** c) < 1e-9 * 10 ** c) return c;
  }
  return 12;
}

export function marcasBonitas(min, max, quantas = 5) {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (hi === lo) hi = lo === 0 ? 1 : lo + Math.abs(lo);
  const bruto = (hi - lo) / quantas;
  let exp = Math.floor(Math.log10(bruto)) - 1;
  for (;;) {
    for (const base of PASSOS) {
      const passo = base * 10 ** exp;
      const ini = Math.floor(lo / passo + 1e-9) * passo;
      const intervalos = Math.ceil((hi - ini) / passo - 1e-9);
      if (intervalos <= quantas) {
        const casas = casasDe(passo);
        const marcas = Array.from({ length: intervalos + 1 }, (_, k) => Number((ini + k * passo).toFixed(casas)));
        return Object.assign(marcas, { passo, casas });
      }
    }
    exp += 1;
  }
}

// ---------- Linha do tempo ----------
const ULTIMO = ANOS.length - 1;          // 2026, parcial
const I_COMPLETO = ULTIMO - 1;           // 2025, último ano completo
const I_2021 = ANOS.indexOf(2021);
const I_2023 = ANOS.indexOf(2023);
const I_2022 = ANOS.indexOf(2022);
const FRACAO_CHATGPT = 333 / 365;        // 30/11 dentro de 2022
let contador = 0;

const nfCasas = new Map();
function numero(v, casas) {
  const loc = document.documentElement.dataset.lingua === 'en' ? 'en' : 'pt-BR';
  const k = `${loc}${casas}`;
  if (!nfCasas.has(k)) nfCasas.set(k, new Intl.NumberFormat(loc, { minimumFractionDigits: 0, maximumFractionDigits: casas }));
  return nfCasas.get(k).format(v).replace('-', '−');
}

/** Texto de um eixo Y em porcentagem (frações) ou em vezes (escala relativa). */
export function formatoEixo(escala) {
  return (v, marcas) => (escala === 'relativa'
    ? `${numero(v, marcas.casas)}×`
    : `${numero(v * 100, Math.max(0, marcas.casas - 2))}%`);
}

/** "ponto percentual" ou "pontos percentuais" para uma diferença em frações. */
export function unidadePontos(dif) {
  const v = Math.abs(dif * 100);
  return document.documentElement.dataset.lingua === 'en'
    ? t(v === 1 ? 'unidade_ponto' : 'unidade_pontos')
    : t(v < 2 ? 'unidade_ponto' : 'unidade_pontos');
}

/** A frase de leitura de um ano com esperado: excesso em pontos e em vezes, ou abaixo. */
export function fraseExcesso(obs, esp) {
  if (obs == null || esp == null || !(esp > 0)) return '';
  const dif = obs - esp;
  const pontos = numero(Math.abs(dif * 100), 2);
  if (dif > 0) return t('dica_excesso', { dif: pontos, unidade: unidadePontos(dif), razao: numero(obs / esp, 1) });
  return t('dica_abaixo', { dif: pontos, unidade: unidadePontos(dif) });
}

const PADRAO = {
  series: [], escala: 'pct', esperado: true, veu: true, altura: null, compacto: 'auto', animar: false,
  rotuloDireto: true, rotuloParcial: true, marco: true, anel: 'var(--papel)', raio: null,
  formatoY: null, formatoValor: null, dica: null, resumo: null, titulo: null, colunasTabela: null,
};

export function linhaTempo(caixa, opcoesIniciais = {}) {
  const id = `lt${++contador}`;
  let op = { ...PADRAO, ...opcoesIniciais };
  let geo = null;
  let ativo = null;          // ano marcado (cruz e anel), com ou sem a dica aberta (índice)
  let foco = I_COMPLETO;     // ano que recebe o Tab
  let dispensado = null;     // ano cuja dica o Esc fechou: o mouse parado nele não a reabre
  let ignorarFoco = false;   // o foco volta ao ano sem reabrir a dica
  let animou = false;
  let larguraDesenhada = 0;
  let destruido = false;

  const plot = el('div', { class: 'plot lt-plot' });
  const resumo = el('p', { class: 'sr' });
  const raiz = el('div', { class: 'lt' }, plot, resumo);
  caixa.append(raiz);

  const dica = criarDica(plot, {
    // O cartão do celular fechou com o foco nele: o foco volta ao ano, com o anel.
    aoFechar: ({ devolverFoco } = {}) => {
      const botao = ativo != null && geo?.botoes?.[ativo];
      if (!devolverFoco || !botao) { limparFoco(); return; }
      foco = ativo;
      geo.botoes.forEach((b, k) => b.setAttribute('tabindex', k === foco ? '0' : '-1'));
      ignorarFoco = true;
      botao.focus();
      ignorarFoco = false;
    },
    // Com o foco num ano, o anel fica (é o indicador de foco); com o mouse, a marca some.
    aoEsc: () => {
      if (plot.contains(document.activeElement)) return;
      dispensado = ativo;
      limparFoco();
    },
  });

  const compacto = () => (op.compacto === 'auto' ? faixa() === 'celular' : Boolean(op.compacto));
  const corDe = (s) => s.cor || (s.lingua === 'en' ? 'var(--en)' : 'var(--pt)');
  const chaveDe = (s) => s.chave || s.lingua || 'base';

  // Valores na escala escolhida.
  function valores(s) {
    if (op.escala !== 'relativa') return { obs: s.obs, esp: s.esp || null };
    const a = s.obs[I_2021];
    const b = s.obs[I_2022];
    const base = a == null || b == null ? null : (a + b) / 2;
    const div = (v) => (v == null || !base ? null : v / base);
    return { obs: s.obs.map(div), esp: s.esp ? s.esp.map(div) : null };
  }

  const formatoValor = (v, s) => {
    if (v == null) return t('sem_dado');
    if (op.formatoValor) return op.formatoValor(v, s);
    return op.escala === 'relativa' ? `${numero(v, v < 10 ? 2 : 1)}×` : fmt.pctAuto(v);
  };

  function infoAno(i) {
    return {
      i, ano: ANOS[i], parcial: i === ULTIMO, escala: op.escala,
      series: op.series.map((s, k) => {
        const v = geo.vals[k];
        const kEsp = i - I_2021;
        const temEsp = s.esp && kEsp >= 0 && i >= I_2023;
        const bruto = s.obs[i];
        const esperadoBruto = temEsp ? s.esp[kEsp] : null;
        return {
          serie: s, valor: v.obs[i], bruto,
          esperado: temEsp ? v.esp[kEsp] : null, esperadoBruto,
          n: s.n ? s.n[i] : null,
          razao: bruto != null && esperadoBruto > 0 ? bruto / esperadoBruto : null,
          dif: bruto != null && esperadoBruto != null ? bruto - esperadoBruto : null,
        };
      }),
    };
  }

  // Frase de um ano (leitor de tela e dica sem visual).
  function textoAno(info) {
    return info.series.map((x) => {
      const partes = [`${x.serie.palavra}, ${siglaLingua(x.serie.lingua)}, ${info.ano}${info.parcial ? ` (${t('parcial')})` : ''}: ${valorComUnidade(x)}`];
      if (op.esperado && x.esperado != null) partes.push(t('dica_esperado', { valor: formatoValor(x.esperado, x.serie) }));
      if (op.esperado && x.esperadoBruto != null) partes.push(fraseExcesso(x.bruto, x.esperadoBruto));
      else if (x.n != null) partes.push(textoN(x.n, x.serie.lingua));
      const frase = partes.filter(Boolean).join('. ').replace(/\.\./g, '.');
      return /[.!?]$/.test(frase) ? frase : `${frase}.`;
    }).join(' ');
  }

  function valorComUnidade(x) {
    const v = formatoValor(x.valor, x.serie);
    return op.escala === 'relativa' ? t('dica_valor_rel', { valor: v }) : t(`dica_valor_${x.serie.lingua}`, { valor: v });
  }
  const textoN = (n, l) => (n === 1 ? t(`dica_n_1_${l}`) : t(`dica_n_${l}`, { n: fmt.num(n) }));

  function conteudoPadrao(info) {
    const sub = info.parcial ? t('parcial_ate') : String(info.ano);
    if (info.series.length === 1) {
      const x = info.series[0];
      const s = x.serie;
      let extra = null;
      let leitura = null;
      if (op.esperado && x.esperado != null) {
        extra = t('dica_esperado', { valor: formatoValor(x.esperado, s) });
        leitura = fraseExcesso(x.bruto, x.esperadoBruto);
      } else if (x.n != null) {
        extra = textoN(x.n, s.lingua);
        if (op.esperado && s.esp && (info.i === I_2021 || info.i === I_2022)) leitura = t('dica_base');
      }
      return conteudoDica({
        chave: chaveDe(s), palavra: s.palavra, lingua: s.lingua,
        sub: `${siglaLingua(s.lingua)} · ${sub}`,
        valor: x.valor == null ? t('sem_dado') : valorComUnidade(x), extra, leitura,
      });
    }
    return conteudoDica({
      sub,
      linhas: info.series.map((x) => ({
        chave: chaveDe(x.serie),
        texto: `${x.serie.palavra} · ${siglaLingua(x.serie.lingua)}`,
        valor: formatoValor(x.valor, x.serie) + (op.esperado && x.esperado != null ? ` (${t('dica_esperado', { valor: formatoValor(x.esperado, x.serie) })})` : ''),
      })),
    });
  }

  function tituloPadrao() {
    return op.titulo || op.series.map((s) => `${s.palavra} (${siglaLingua(s.lingua)})`).join(', ');
  }

  function resumoPadrao() {
    const s = op.series[0];
    if (!s) return '';
    const a = s.obs[I_2021];
    const b = s.obs[I_2022];
    const base = a == null || b == null ? null : (a + b) / 2;
    const obs = s.obs[I_COMPLETO];
    const esp = s.esp ? s.esp[I_COMPLETO - I_2021] : null;
    return t('grafico_resumo', {
      palavra: s.palavra, resumos: t(`resumos_${s.lingua}`),
      base: base == null ? t('sem_dado') : fmt.pctAuto(base),
      obs: obs == null ? t('sem_dado') : fmt.pctAuto(obs),
      esp: esp == null ? t('sem_dado') : fmt.pctAuto(esp),
    }) + (op.series.length > 1 ? ` ${t('grafico_resumo_mais', { n: op.series.length - 1 })}` : '');
  }

  // ---------- Desenho ----------
  function desenhar() {
    if (destruido) return;
    const W = Math.max(200, Math.round(plot.clientWidth || caixa.clientWidth || 360));
    larguraDesenhada = W;
    const comp = compacto();
    const H = op.altura || (comp ? 240 : 330);
    const L = comp ? 40 : 46;
    const R = op.rotuloParcial ? 44 : 14;
    const T = op.marco ? 30 : 14;
    const B = 34;
    const pw = W - L - R;
    const ph = H - T - B;
    const passo = pw / ANOS.length;
    const X = (i) => L + passo * (i + 0.5);
    const raio = op.raio ?? (comp ? 4 : 4.5);

    const vals = op.series.map(valores);
    let max = 0;
    for (const v of vals) {
      for (const x of v.obs) if (x != null && x > max) max = x;
      if (op.esperado && v.esp) for (const x of v.esp) if (x != null && x > max) max = x;
    }
    if (op.escala === 'relativa') max = Math.max(max, 1);
    if (!(max > 0)) max = op.escala === 'relativa' ? 1 : 0.01;
    const marcas = marcasBonitas(0, max, comp ? 2 : 5);
    const y0 = marcas[0];
    const y1 = marcas[marcas.length - 1];
    const Y = escalaLinear([y0, y1], [T + ph, T]);
    geo = { W, H, L, R, T, B, pw, ph, passo, X, Y, vals, marcas, raio, comp };

    const r1 = (n) => Math.round(n * 10) / 10;
    const pt = (x, y) => `${r1(x)} ${r1(y)}`;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });

    // Grade horizontal e linha do zero.
    const grade = marcas.filter((m) => m !== y0).map((m) => `M${L} ${r1(Y(m))} H${W - R}`).join(' ');
    svg.append(el('path', { d: grade, class: 'lt-grade' }));
    if (op.escala === 'relativa') svg.append(el('path', { d: `M${L} ${r1(Y(1))} H${W - R}`, class: 'lt-um' }));
    svg.append(el('path', { d: `M${L} ${r1(Y(y0))} H${W - R}`, class: 'lt-eixo' }));

    // Véu do excesso, recortado acima do esperado. O esperado de cada ano vale de meio ano antes a
    // meio ano depois (degraus): cada ano tem o próprio recorte de revistas.
    if (op.esperado && op.veu !== false) {
      op.series.forEach((s, k) => {
        const v = vals[k];
        if (!v.esp || (Array.isArray(op.veu) && !op.veu.includes(k))) return;
        const E = (i) => v.esp[i - I_2021];
        const idx = [I_2023, I_2023 + 1, I_COMPLETO, ULTIMO];
        if (idx.some((i) => v.obs[i] == null || E(i) == null)) return;
        const degraus = (de, ate) => {
          const pts = [];
          for (let i = de; i <= ate; i += 1) {
            pts.push(pt(i === de ? X(i) : X(i) - passo / 2, Y(E(i))), pt(i === ate ? X(i) : X(i) + passo / 2, Y(E(i))));
          }
          return pts;
        };
        const clipId = `${id}-c${k}`;
        const topo = T - 10;
        const regiao = `M${degraus(I_2023, ULTIMO).join(' L')} L${r1(X(ULTIMO))} ${topo} L${r1(X(I_2023))} ${topo} Z`;
        svg.append(el('defs', {}, el('clipPath', { id: clipId }, el('path', { d: regiao }))));
        // Da linha observada até o pé do gráfico; o recorte deixa só o que fica acima dos degraus
        // (com o fundo nos degraus, os anos em que o observado fica abaixo deixavam um fio no recorte).
        const area = (de, ate) => {
          const ida = [];
          for (let i = de; i <= ate; i += 1) ida.push(pt(X(i), Y(v.obs[i])));
          return `M${ida.join(' L')} L${pt(X(ate), T + ph)} L${pt(X(de), T + ph)} Z`;
        };
        svg.append(el('path', { d: area(I_2023, I_COMPLETO), class: 'lt-veu', 'clip-path': `url(#${clipId})` }));
        svg.append(el('path', { d: area(I_COMPLETO, ULTIMO), class: 'lt-veu lt-veu-parcial', 'clip-path': `url(#${clipId})` }));
      });
    }

    // Marco do ChatGPT.
    const xChat = X(I_2022) - passo / 2 + passo * FRACAO_CHATGPT;
    if (op.marco) svg.append(el('path', { d: `M${r1(xChat)} ${T - 8} V${r1(T + ph)}`, class: 'lt-marco' }));

    // Esperado: a reta de 2021 a 2022 (um recorte só) e um degrau por ano de 2023 em diante, sem
    // ligar os anos. O caminho .lt-esperado guarda os seis pontos; de 2023 em diante só como M.
    if (op.esperado) {
      op.series.forEach((s, k) => {
        const v = vals[k];
        if (!v.esp) return;
        const reta = caminho(v.esp.slice(0, 2).map((e, j) => (e == null ? null : pt(X(I_2021 + j), Y(e)))));
        const pontos = v.esp.slice(2).map((e, j) => (e == null ? '' : ` M${pt(X(I_2023 + j), Y(e))}`)).join('');
        svg.append(el('path', { d: `${reta}${pontos}`, class: 'lt-esperado' }));
        const degraus = v.esp.slice(2).map((e, j) => {
          const i = I_2023 + j;
          return e == null ? '' : ` M${pt(X(i) - passo / 2, Y(e))} H${r1(i === ULTIMO ? X(i) : X(i) + passo / 2)}`;
        }).join('').trim();
        if (degraus) svg.append(el('path', { d: degraus, class: 'lt-esperado lt-esperado-ano' }));
      });
    }

    // Observado: linha cheia até 2025, pontilhada até 2026, pontos com anel.
    const linhas = [];
    op.series.forEach((s, k) => {
      const v = vals[k];
      const cor = corDe(s);
      const pts = v.obs.map((o, i) => (o == null || i > I_COMPLETO ? null : pt(X(i), Y(o))));
      const linha = el('path', { d: caminho(pts), class: 'lt-obs', style: `stroke:${cor}` });
      svg.append(linha);
      linhas.push(linha);
      if (v.obs[I_COMPLETO] != null && v.obs[ULTIMO] != null) {
        svg.append(el('path', { d: `M${pt(X(I_COMPLETO), Y(v.obs[I_COMPLETO]))} L${pt(X(ULTIMO), Y(v.obs[ULTIMO]))}`, class: 'lt-parcial', style: `stroke:${cor}` }));
      }
    });
    const grupoPontos = el('g', { class: 'lt-pontos' });
    op.series.forEach((s, k) => {
      const v = vals[k];
      const cor = corDe(s);
      v.obs.forEach((o, i) => {
        if (o == null) return;
        const vazado = i === ULTIMO;
        grupoPontos.append(el('circle', {
          cx: r1(X(i)), cy: r1(Y(o)), r: raio, class: vazado ? 'lt-ponto lt-ponto-parcial' : 'lt-ponto',
          style: vazado ? `fill:${op.anel};stroke:${cor}` : `fill:${cor};stroke:${op.anel}`,
        }));
      });
    });
    svg.append(grupoPontos);
    const grupoFoco = el('g', { class: 'lt-foco' });
    svg.append(grupoFoco);

    // Rótulos em HTML.
    const rotulos = [];
    const pc = (x, y) => ({ left: `${x}px`, top: `${y}px` });
    marcas.forEach((m) => rotulos.push(el('span', { class: 'plot-rot rot-y', style: pc(L, Y(m)), text: (op.formatoY || formatoEixo(op.escala))(m, marcas) })));
    const cadaAno = !comp && passo >= 40;
    ANOS.forEach((ano, i) => {
      if (cadaAno || i % 3 === 0) rotulos.push(el('span', { class: 'plot-rot rot-x', style: pc(X(i), T + ph), text: String(ano) }));
    });
    let rotMarco = null;
    if (op.marco) {
      rotMarco = el('span', { class: 'plot-rot rot-marco', style: pc(xChat, 0), text: t(comp ? 'marco_chatgpt_curto' : 'marco_chatgpt') });
      rotulos.push(rotMarco);
    }
    const rotParciais = [];
    if (op.rotuloParcial) {
      // Um rótulo só: o do ponto de 2026 mais alto.
      let melhor = null;
      vals.forEach((v) => { if (v.obs[ULTIMO] != null && (melhor == null || v.obs[ULTIMO] > melhor)) melhor = v.obs[ULTIMO]; });
      if (melhor != null) {
        const r = el('span', { class: 'plot-rot rot-parcial', style: pc(X(ULTIMO), Y(melhor)), text: t('parcial') });
        rotulos.push(r);
        rotParciais.push(r);
      }
    }
    if (op.rotuloDireto) {
      const ys = [];
      vals.forEach((v, k) => {
        const o = v.obs[I_COMPLETO];
        if (o == null) return;
        let y = Y(o);
        const abaixo = ys.some((outro) => Math.abs(outro - y) < 18);
        ys.push(y);
        // Anos apertados (celular) com 2026 acima de 2025, ou quase: o rótulo em cima cairia na
        // ligação pontilhada; vai para a esquerda do ponto.
        const parcial = v.obs[ULTIMO];
        const esquerda = !abaixo && passo < 40 && parcial != null && Y(parcial) < y + 18;
        rotulos.push(el('span', {
          class: `plot-rot rot-direto${abaixo ? ' rot-direto-abaixo' : ''}${esquerda ? ' rot-direto-esq' : ''}`,
          style: pc(X(I_COMPLETO), y), text: formatoValor(o, op.series[k]),
        }));
      });
    }

    // Anos para teclado, mouse e toque: uma parada de Tab, setas trocam o ano.
    const anos = el('div', { class: 'lt-anos', role: 'group', 'aria-label': t('grafico_anos', { titulo: tituloPadrao() }) });
    anos.style.left = `${L}px`;
    anos.style.top = `${T}px`;
    anos.style.width = `${pw}px`;
    anos.style.height = `${ph}px`;
    const botoes = ANOS.map((ano, i) => el('button', {
      type: 'button', class: 'lt-ano', tabindex: i === foco ? '0' : '-1',
      style: { left: `${passo * i}px`, width: `${passo}px` },
      'aria-label': textoAno(infoAno(i)),
      dataset: { i },
    }));
    anos.append(...botoes);
    geo.botoes = botoes;

    plot.replaceChildren(svg, ...rotulos, anos);
    plot.style.height = `${H}px`;

    // O rótulo do marco não pode sair da caixa: tenta o curto, depois vira para a esquerda.
    if (rotMarco) {
      const caber = () => xChat + 6 + rotMarco.offsetWidth <= W;
      if (!caber() && !comp) rotMarco.textContent = t('marco_chatgpt_curto');
      if (!caber()) rotMarco.classList.add('rot-marco-esq');
    }

    // Leitor de tela.
    const textoResumo = typeof op.resumo === 'function' ? op.resumo(infoAno(I_COMPLETO)) : (op.resumo || resumoPadrao());
    resumo.textContent = textoResumo;

    // Desenho de uma vez.
    if (op.animar && !animou && !semMovimento()) {
      animou = true;
      for (const linha of linhas) {
        const comprimento = linha.getTotalLength?.() || 0;
        if (!comprimento) continue;
        linha.style.strokeDasharray = `${comprimento}`;
        linha.animate([{ strokeDashoffset: comprimento }, { strokeDashoffset: 0 }], { duration: 1200, easing: 'ease-in-out', fill: 'both' })
          .finished.then(() => { linha.style.strokeDasharray = ''; }).catch(() => {});
      }
      // Cada nó aparece até a opacidade do próprio CSS e não a segura depois (fill 'backwards'): o
      // véu de 2026 fica pela metade, como sem animação.
      const surgir = (n, duration, delay) => n.animate([{ opacity: 0 }, { opacity: getComputedStyle(n).opacity }], { duration, delay, fill: 'backwards' });
      svg.querySelectorAll('.lt-veu, .lt-parcial, .lt-esperado').forEach((n) => surgir(n, 400, 900));
      grupoPontos.querySelectorAll('circle').forEach((c) => {
        const i = Math.round((Number(c.getAttribute('cx')) - L) / passo - 0.5);
        surgir(c, 200, (1200 * i) / ANOS.length);
      });
      rotulos.filter((r) => r.classList.contains('rot-direto') || r.classList.contains('rot-parcial'))
        .forEach((r) => surgir(r, 300, 1100));
    } else {
      animou = true;
    }

    if (ativo != null) mostrarAno(ativo, false, dica.aberta);
  }

  function caminho(pts) {
    let d = '';
    let dentro = false;
    for (const p of pts) {
      if (p == null) { dentro = false; continue; }
      d += `${dentro ? ' L' : ' M'}${p}`;
      dentro = true;
    }
    return d.trim() || 'M0 0';
  }

  // ---------- Dica e foco ----------
  // Marca o ano (cruz e anel) e abre a dica; comDica false só marca (redesenho depois do Esc).
  function mostrarAno(i, moverFoco = false, comDica = true) {
    if (!geo) return;
    ativo = i;
    dispensado = null;
    const { X, Y, T, ph, vals } = geo;
    const g = plot.querySelector('.lt-foco');
    g.replaceChildren(el('path', { d: `M${Math.round(X(i) * 10) / 10} ${T} V${T + ph}`, class: 'lt-cruz' }));
    let yMin = Infinity;
    op.series.forEach((s, k) => {
      const o = vals[k].obs[i];
      if (o == null) return;
      const y = Y(o);
      yMin = Math.min(yMin, y);
      g.append(el('circle', { cx: X(i), cy: y, r: 9.5, class: 'lt-foco-anel' }));
      g.append(el('circle', { cx: X(i), cy: y, r: 7.5, class: 'lt-foco-ponto', style: `fill:${i === ULTIMO ? op.anel : corDe(s)};stroke:${i === ULTIMO ? corDe(s) : op.anel}` }));
    });
    if (comDica) {
      const info = infoAno(i);
      const conteudo = (op.dica && op.dica(info)) || conteudoPadrao(info);
      dica.mostrar(conteudo, { x: X(i), y: Number.isFinite(yMin) ? yMin : T + ph / 2, topo: T + 8 });
    }
    if (moverFoco) {
      foco = i;
      geo.botoes.forEach((b, k) => b.setAttribute('tabindex', k === i ? '0' : '-1'));
      geo.botoes[i].focus();
    }
  }

  function limparFoco() {
    ativo = null;
    plot.querySelector('.lt-foco')?.replaceChildren();
  }

  function esconder() {
    limparFoco();
    dica.esconder();
  }

  // Eventos (delegados na caixa do gráfico, que não é redesenhada).
  let mouseDentro = false;
  plot.addEventListener('pointermove', (evento) => {
    if (!geo || evento.pointerType === 'touch') return;
    const caixaAnos = plot.querySelector('.lt-anos');
    if (!caixaAnos) return;
    const r = caixaAnos.getBoundingClientRect();
    const x = evento.clientX - r.left;
    const y = evento.clientY - r.top;
    if (x < -geo.passo / 2 || x > r.width + geo.passo / 2 || y < -geo.T || y > r.height + 8) {
      if (mouseDentro && !plot.contains(document.activeElement)) esconder();
      mouseDentro = false;
      dispensado = null;
      return;
    }
    mouseDentro = true;
    const i = Math.max(0, Math.min(ANOS.length - 1, Math.floor(x / geo.passo)));
    if (i !== ativo && i !== dispensado) mostrarAno(i);
  });
  plot.addEventListener('pointerleave', (evento) => {
    if (evento.pointerType === 'touch') return;
    mouseDentro = false;
    dispensado = null;
    if (!plot.contains(document.activeElement)) esconder();
  });
  plot.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.lt-ano');
    if (botao) mostrarAno(Number(botao.dataset.i));
  });
  plot.addEventListener('focusin', (evento) => {
    const botao = evento.target.closest('.lt-ano');
    if (botao && !ignorarFoco) mostrarAno(Number(botao.dataset.i));
  });
  plot.addEventListener('focusout', (evento) => {
    if (plot.contains(evento.relatedTarget)) return;
    // No celular o cartão fica até a pessoa fechá-lo; fechado, a marca sai com o foco.
    if (faixa() === 'celular' ? !dica.aberta : !mouseDentro) esconder();
  });
  // Esc é da dica (dica.js): fecha a dica e deixa o anel; com ela fechada, a tecla segue adiante.
  plot.addEventListener('keydown', (evento) => {
    const botao = evento.target.closest('.lt-ano');
    if (!botao) return;
    const i = Number(botao.dataset.i);
    const destino = { ArrowLeft: i - 1, ArrowRight: i + 1, ArrowDown: i - 1, ArrowUp: i + 1, Home: 0, End: ANOS.length - 1 }[evento.key];
    if (destino == null) return;
    evento.preventDefault();
    mostrarAno(Math.max(0, Math.min(ANOS.length - 1, destino)), true);
  });

  const observador = new ResizeObserver(() => {
    const W = Math.round(plot.clientWidth);
    if (W && Math.abs(W - larguraDesenhada) > 1) requestAnimationFrame(desenhar);
  });
  observador.observe(raiz);
  desenhar();

  // ---------- Tabela ----------
  // Números da tabela com casas fixas, para a coluna alinhar: 0,045% / 0,40% / 12,40%.
  const formatoTabela = (v, s) => {
    if (v == null) return t('sem_dado');
    if (op.formatoValor) return op.formatoValor(v, s);
    if (op.escala === 'relativa') return `${fmt.num(v, 2)}×`;
    return fmt.pct(v, Math.abs(v) < 0.001 && v !== 0 ? 3 : 2);
  };

  function dadosTabela() {
    const um = op.series.length === 1;
    const quer = (c) => !op.colunasTabela || op.colunasTabela.includes(c);
    const colunas = [{ rotulo: t('tabela_ano') }];
    for (const s of op.series) {
      const sufixo = um ? '' : ` · ${s.palavra} ${siglaLingua(s.lingua)}`;
      if (s.n && quer('resumos')) colunas.push({ rotulo: t('tabela_resumos') + sufixo, num: true });
      colunas.push({ rotulo: t('tabela_observado') + sufixo, num: true });
      if (op.esperado && s.esp) {
        if (quer('esperado')) colunas.push({ rotulo: t('tabela_esperado') + sufixo, num: true });
        if (um && quer('diferenca')) colunas.push({ rotulo: t('tabela_diferenca'), num: true });
        if (um && quer('razao')) colunas.push({ rotulo: t('tabela_razao'), num: true });
      }
    }
    const linhas = ANOS.map((ano, i) => {
      const info = infoAno(i);
      const linha = [i === ULTIMO
        ? el('span', {}, String(ano), ' ', el('span', { class: 'etq-nota', text: t('parcial') }))
        : String(ano)];
      info.series.forEach((x) => {
        if (x.serie.n && quer('resumos')) linha.push(x.n == null ? '' : fmt.num(x.n));
        linha.push(x.valor == null ? t('sem_dado') : formatoTabela(x.valor, x.serie));
        if (op.esperado && x.serie.esp) {
          const kEsp = i - I_2021;
          const esp = kEsp >= 0 ? geo.vals[op.series.indexOf(x.serie)].esp[kEsp] : null;
          if (quer('esperado')) linha.push(esp == null ? '' : formatoTabela(esp, x.serie));
          if (um && quer('diferenca')) linha.push(x.dif == null ? '' : fmt.pp(x.dif));
          if (um && quer('razao')) linha.push(x.razao == null ? '' : { conteudo: fmt.razao(x.razao), forte: true });
        }
      });
      return linha;
    });
    return { colunas, linhas, legenda: t('tabela_legenda', { titulo: tituloPadrao(), inicio: ANOS[0], fim: ANOS[ULTIMO] }) };
  }

  return {
    elemento: raiz,
    atualizar(novas = {}) {
      op = { ...op, ...novas };
      desenhar();
    },
    destruir() {
      destruido = true;
      observador.disconnect();
      dica.destruir();
      raiz.remove();
    },
    dadosTabela,
    tabela(opcoes = {}) {
      const d = dadosTabela();
      return montarTabela(d.colunas, d.linhas, { legenda: d.legenda, ...opcoes });
    },
    mostrarAno: (i) => mostrarAno(i),
    esconderDica: esconder,
  };
}
