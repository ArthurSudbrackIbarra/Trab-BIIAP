// IAês · base comum a todas as telas: textos, números, dados, estado no endereço e estados de falha.
// Sem dependências. Toda tela importa daqui; nada aqui desenha gráfico.

const html = document.documentElement;

/** Idioma da interface: 'pt' ou 'en'. */
export const lingua = html.dataset.lingua === 'en' ? 'en' : 'pt';
/** Caminho relativo até a raiz do site, terminando em '/' (ou '' na página inicial). */
export const raiz = html.dataset.raiz || '';
/** Id da página: inicio, palavras, mapa, areas, ptxen, experimento, raiox, jogo, metodo, 404. */
export const pagina = html.dataset.pagina;
export const LINGUAS = ['pt', 'en'];
export const ANOS = Array.from({ length: 12 }, (_, i) => 2015 + i);
/** Áreas do SciELO, na ordem alfabética do português. O nome vem de t(`area_${slug}`). */
export const AREAS = ['agrarias', 'biologicas', 'saude', 'exatas', 'humanas', 'sociais', 'engenharias', 'linguistica'];

const textos = JSON.parse(document.getElementById('textos')?.textContent || '{}');

/** Texto da interface. `vars` troca {nome} no texto. Chave ausente aparece entre colchetes. */
export function t(chave, vars) {
  let texto = textos[chave];
  if (texto === undefined) {
    console.warn(`IAês: texto ausente: ${chave}`);
    return `[${chave}]`;
  }
  if (vars) texto = texto.replace(/\{(\w+)\}/g, (m, nome) => (nome in vars ? vars[nome] : m));
  return texto;
}

export const nomeArea = (slug) => (slug && slug !== 'todas' ? t(`area_${slug}`) : t('area_todas'));
export const siglaLingua = (l) => t(`sigla_${l}`);

// ---------- Números ----------
const locale = lingua === 'pt' ? 'pt-BR' : 'en';
const cacheFmt = new Map();
function nf(min, max) {
  const chave = `${min}-${max}`;
  if (!cacheFmt.has(chave)) {
    cacheFmt.set(chave, new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max }));
  }
  return cacheFmt.get(chave);
}
const menos = (texto) => texto.replace('-', '−');

/** Formatação no padrão do idioma da página. Frações entram de 0 a 1. Contagens saem exatas. */
export const fmt = {
  /** Inteiro ou decimal: 12.408 (pt) ou 12,408 (en). */
  num: (n, casas = 0) => menos(nf(casas, casas).format(n)),
  /** Fração como porcentagem: 0.0061 → "0,61%". */
  pct: (fracao, casas = 2) => menos(nf(casas, casas).format(fracao * 100)) + '%',
  /** Porcentagem já em pontos (17.3 → "17,3%"). */
  pctPontos: (valor, casas = 1) => menos(nf(casas, casas).format(valor)) + '%',
  /** Diferença de duas frações, em pontos percentuais com sinal: "+0,59 p.p.". */
  pp: (diferenca, casas = 2) => {
    const v = diferenca * 100;
    const texto = nf(casas, casas).format(Math.abs(v));
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${texto} ${t('unidade_pp')}`;
  },
  /** Razão observado/esperado: "30,5×". Uma casa até 100, nenhuma acima. */
  razao: (r) => (r == null || !isFinite(r) ? t('sem_dado') : `${nf(r >= 100 ? 0 : 1, r >= 100 ? 0 : 1).format(r)}×`),
  /** Escolhe as casas pela grandeza (eixos e dicas): 0,02% / 0,61% / 12,4%. */
  pctAuto: (fracao) => {
    const v = Math.abs(fracao * 100);
    const casas = v === 0 ? 0 : v < 0.1 ? 3 : v < 10 ? 2 : 1;
    return menos(nf(0, casas).format(fracao * 100)) + '%';
  },
  /** Tamanho de arquivo: "1,8 MB". */
  mb: (bytes) => `${nf(1, 1).format(bytes / 1048576)} MB`,
};

// ---------- DOM ----------
/**
 * Cria um elemento. attrs: { class, text, html, dataset:{}, style:{}, on:{evento:fn}, ...atributos }.
 * Filhos: nós ou textos; null/false são ignorados.
 */
export function el(tag, attrs = {}, ...filhos) {
  const svg = ['svg', 'g', 'path', 'line', 'rect', 'circle', 'text', 'polyline', 'polygon', 'defs', 'pattern', 'clipPath', 'title', 'tspan'].includes(tag);
  const no = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs || {})) {
    if (valor == null || valor === false) continue;
    if (chave === 'class') no.setAttribute('class', valor);
    else if (chave === 'text') no.textContent = valor;
    else if (chave === 'html') no.innerHTML = valor;
    else if (chave === 'dataset') Object.assign(no.dataset, valor);
    else if (chave === 'style' && typeof valor === 'object') Object.assign(no.style, valor);
    else if (chave === 'on') for (const [ev, fn] of Object.entries(valor)) no.addEventListener(ev, fn);
    else no.setAttribute(chave, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return no;
}

/** Ícone de traço do design (grade 24). Nomes em ICONES. */
export const ICONES = {
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  tabela: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  grafico: 'M4 19V5M4 19h16M7 15l4-4 3 3 5-6',
  busca: 'M11 18a7 7 0 1 0 0-14a7 7 0 1 0 0 14M20 20l-4-4',
  fechar: 'M6 6l12 12M18 6L6 18',
  seta: 'M5 12h14M13 6l6 6-6 6',
  seta_esq: 'M19 12H5M11 6l-6 6 6 6',
  abaixo: 'M6 9l6 6 6-6',
  acima: 'M6 15l6-6 6 6',
  recarregar: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  sem_rede: 'M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M16.8 11.2A10 10 0 0 1 19 12.9M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18',
  info: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 11v6M12 7.5v.5',
  play: 'M7 5l12 7-12 7z',
  pausa: 'M8 5v14M16 5v14',
  dado: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  mais: 'M12 5v14M5 12h14',
  sortear: 'M3 7h3c4 0 6 10 10 10h5M18 14l3 3-3 3M3 17h3c1.6 0 2.8-1 3.8-2.6M14 7h7M18 4l3 3-3 3',
  externo: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};
export function icone(nome, classe = 'ic ic-p') {
  return el('svg', { class: classe, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, el('path', { d: ICONES[nome] }));
}

/** Mensagem curta no pé da tela, para ações como "Link copiado". Some sozinha. */
export function avisoRapido(texto) {
  const no = el('div', { class: 'toast', role: 'status', text: texto });
  document.body.append(no);
  setTimeout(() => no.remove(), 2200);
}

// ---------- Dados ----------
const cache = new Map();
const LENTO_MS = 8000;

/**
 * Baixa site/public/dados/<caminho> uma vez por página e devolve o JSON.
 * opcoes.progresso(feito, total): chamado durante o download (para a barra de "carregamento lento").
 * total é 0 quando não se sabe o tamanho (servidor que comprime, como o GitHub Pages).
 * Falha com um Error que traz .arquivo e .status (número HTTP, 'rede' ou 'json': arquivo com defeito).
 */
export function dados(caminho, opcoes = {}) {
  if (cache.has(caminho)) return cache.get(caminho);
  const promessa = baixar(caminho, opcoes).catch((erro) => {
    cache.delete(caminho);
    throw erro;
  });
  cache.set(caminho, promessa);
  return promessa;
}

async function baixar(caminho, { progresso } = {}) {
  const url = `${raiz}dados/${caminho}`;
  const falha = (status) => Object.assign(new Error(typeof status === 'number' ? `erro ${status}` : status), { arquivo: `dados/${caminho}`, status });
  let resposta;
  try {
    resposta = await fetch(url);
  } catch (e) {
    throw falha('rede');
  }
  if (!resposta.ok) throw falha(resposta.status);
  // Com compressão, Content-Length é o tamanho comprimido e o leitor conta bytes já descomprimidos.
  const total = resposta.headers.get('content-encoding') ? 0 : Number(resposta.headers.get('content-length')) || 0;
  let texto;
  try {
    if (!progresso || !resposta.body) {
      texto = await resposta.text();
    } else {
      const leitor = resposta.body.getReader();
      const partes = [];
      let feito = 0;
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        partes.push(value);
        feito += value.length;
        progresso(feito, total);
      }
      const bytes = new Uint8Array(feito);
      let pos = 0;
      for (const parte of partes) { bytes.set(parte, pos); pos += parte.length; }
      texto = new TextDecoder().decode(bytes);
    }
  } catch (e) {
    throw falha('rede');
  }
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw falha('json');
  }
}

/** O erro de dados() em palavras, para a linha de detalhe: "sem conexão", "erro 404", "arquivo com defeito". */
export function descreverErro(erro) {
  if (erro?.status === 'rede') return t('erro_rede');
  if (erro?.status === 'json') return t('erro_json');
  return t('erro_http', { status: erro?.status ?? '?' });
}

/**
 * Chama `tentar` uma vez quando a conexão volta ou quando alguém clica em "Tentar agora" na faixa
 * de sem internet (evento 'iaes:tentar' de cabecalho.js), o que vier primeiro.
 */
export function esperarConexao(tentar) {
  const uma = () => {
    window.removeEventListener('online', uma);
    window.removeEventListener('iaes:tentar', uma);
    tentar();
  };
  window.addEventListener('online', uma);
  window.addEventListener('iaes:tentar', uma);
}

/**
 * Carrega dados para uma região da tela, com os estados do design:
 * esqueleto enquanto chega, barra de progresso depois de 8 s, erro com "Tentar de novo" se falhar
 * (só nessa região; o resto da página continua). Sem rede, espera a conexão (ou o "Tentar agora"
 * da faixa de sem internet) e tenta sozinho.
 *
 *   const d = await carregarEm(caixa, 'palavras/pt/indice.json', { altura: 320 });
 *
 * Devolve o JSON; a função de desenho é de quem chamou (o conteúdo da caixa é trocado por ela).
 * opcoes.altura: altura do esqueleto em px. opcoes.semEsqueleto: mantém o conteúdo atual a 40%
 * (troca de filtro) em vez do esqueleto.
 * opcoes.erroTitulo e opcoes.erroTexto: o que o erro diz no lugar de "Não foi possível carregar os
 * dados deste gráfico." e "Os outros gráficos da página não foram afetados.". Numa região que não
 * é gráfico, t('erro_titulo_parte'); quando o arquivo alimenta a tela toda, t('erro_texto_tela').
 */
export function carregarEm(caixa, caminho, opcoes = {}) {
  let tentativa = 0;
  return new Promise((resolve) => {
    const tentar = () => {
      tentativa += 1;
      let timer;
      let barra;
      if (opcoes.semEsqueleto) caixa.classList.add('esmaecido');
      else caixa.replaceChildren(esqueleto(opcoes.altura || 320));
      const progresso = (feito, total) => {
        if (!barra) return;
        // Sem o total (arquivo comprimido), a barra fica indefinida e o texto diz só quanto chegou.
        barra.classList.toggle('lento-barra-indefinida', !total);
        barra.querySelector('span').style.width = total ? `${Math.min(100, (100 * feito) / total)}%` : '';
        barra.nextElementSibling.textContent = total
          ? t('lento_progresso', { feito: fmt.mb(feito), total: fmt.mb(total) })
          : t('lento_progresso_sem_total', { feito: fmt.mb(feito) });
      };
      timer = setTimeout(() => {
        if (opcoes.semEsqueleto) return;
        barra = el('div', { class: 'lento-barra' }, el('span', { style: { width: '0%' } }));
        caixa.append(el('div', { class: 'lento', role: 'status' }, barra, el('p', { text: t('carregando') }), el('p', { class: 't-legenda', text: t('lento_texto') })));
      }, LENTO_MS);
      dados(caminho, { progresso }).then((json) => {
        clearTimeout(timer);
        caixa.classList.remove('esmaecido');
        caixa.querySelector('.lento')?.remove();
        resolve(json);
      }, (erro) => {
        clearTimeout(timer);
        caixa.classList.remove('esmaecido');
        if (erro.status === 'rede' && !navigator.onLine) {
          caixa.replaceChildren(el('div', { class: 'estado-vazio' }, el('p', { text: t('offline_titulo') }), el('p', { class: 't-p', text: t('offline_texto') })));
          esperarConexao(tentar);
          return;
        }
        caixa.replaceChildren(estadoErro({
          arquivo: erro.arquivo, erro: descreverErro(erro), tentativa, tentar, titulo: opcoes.erroTitulo, texto: opcoes.erroTexto,
        }));
      });
    };
    tentar();
  });
}

/** Esqueleto de carregamento: cinza chapado que pulsa (parado com "reduzir movimento"). */
export function esqueleto(altura = 320) {
  return el('div', { class: 'esq', style: { height: `${altura}px`, width: '100%' }, role: 'status', 'aria-label': t('carregando') });
}

/**
 * Bloco de erro do design: o que houve, o que fazer e, para quem quiser avisar, o arquivo.
 * erro: o texto do detalhe (descreverErro(erro) para os erros de dados()). Sem url_codigo em
 * comum.json, o link "Avisar no GitHub" não aparece.
 */
export function estadoErro({ arquivo, erro, tentativa = 1, tentar, titulo, texto }) {
  return el('div', { class: 'estado-erro', role: 'alert' },
    el('p', { class: 't-h3', text: titulo || t('erro_titulo') }),
    el('p', { class: 't-p', text: texto || t('erro_texto') }),
    el('div', { class: 'estado-erro-acoes' },
      tentar && el('button', { class: 'btn', type: 'button', on: { click: tentar } }, icone('recarregar', 'ic'), t('erro_tentar')),
      tentativa > 1 && t('url_codigo') && el('a', { class: 't-p', href: `${t('url_codigo')}/issues`, text: t('erro_avisar') })),
    tentativa > 1 && arquivo && el('p', { class: 'estado-erro-detalhe', text: t('erro_detalhe', { arquivo, erro, tentativa }) }));
}

// ---------- Estado no endereço ----------
/** Parâmetros da URL como objeto simples. */
export function lerUrl() {
  return Object.fromEntries(new URLSearchParams(location.search));
}

/**
 * Grava o estado da tela na URL sem recarregar (replaceState). Valores null, '' ou iguais ao
 * padrão (opcional) saem do endereço. Mantém o #palavra=... do painel.
 */
export function gravarUrl(params, padrao = {}) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor == null || valor === '' || String(valor) === String(padrao[chave] ?? '')) continue;
    busca.set(chave, valor);
  }
  const texto = busca.toString().replace(/%2C/gi, ',');
  history.replaceState(history.state, '', `${location.pathname}${texto ? `?${texto}` : ''}${location.hash}`);
}

/** Botão "Copiar link": copia o endereço atual (com o estado da tela). */
export function botaoCopiarLink(classe = 'btn') {
  return el('button', {
    class: classe, type: 'button',
    on: { click: () => copiarTexto(location.href).then(() => avisoRapido(t('link_copiado'))) },
  }, icone('link', 'ic'), t('copiar_link'));
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = el('textarea', { style: { position: 'fixed', opacity: '0' } });
    area.value = texto;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

/** Texto pronto para entrar em HTML (o que veio do endereço, antes de ir para avisoLink). */
export const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Aviso de link com problema (estado de falha do design): o que o link pedia e não existe, o que a tela
 * mostra no lugar, e "Copiar o link corrigido". `mensagem` pode ter <b>; o que veio do endereço
 * passa por escapar().
 */
export function avisoLink(mensagem) {
  const aviso = el('div', { class: 'aviso aviso-link', role: 'status' },
    icone('link', 'ic'),
    el('div', { class: 'aviso-corpo' },
      el('p', { html: mensagem }),
      el('div', { class: 'aviso-acoes' },
        el('button', { class: 'btn btn-p', type: 'button', on: { click: () => copiarTexto(location.href).then(() => avisoRapido(t('link_copiado'))) } }, icone('link'), t('aviso_copiar_corrigido')),
        el('button', { class: 'btn btn-p btn-fantasma', type: 'button', on: { click: () => aviso.remove() } }, t('aviso_fechar')))));
  return aviso;
}

// ---------- Palavras como dado ----------
/** "crucial.pt" → { palavra: 'crucial', lingua: 'pt' }; null se o formato não servir. */
export function lerChave(chave) {
  const m = /^(.+)\.(pt|en)$/.exec(String(chave || '').trim().toLowerCase());
  return m ? { palavra: m[1], lingua: m[2] } : null;
}
export const chave = (palavra, l) => `${palavra}.${l}`;

/** Inicial normalizada de uma palavra: o nome do arquivo de dados onde ela está (a-z). */
export function inicial(palavra) {
  const c = palavra.normalize('NFD').replace(/[̀-ͯ]/g, '')[0] || '_';
  return /[a-z]/.test(c) ? c : '_';
}

/**
 * Palavra clicável que abre o painel da palavra (js/lib/painel.js escuta os cliques).
 * Fica como botão de texto, com a classe .w e a cor de texto normal.
 */
export function palavraBotao(palavra, l, extra = {}) {
  return el('button', { type: 'button', class: `w palavra-botao ${extra.class || ''}`, dataset: { palavra: chave(palavra, l) }, lang: l === 'en' ? 'en' : 'pt-BR' }, extra.texto || palavra);
}

/** Prefere menos movimento? Então tudo é corte seco. */
export const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Largura atual em uma das três faixas do design. */
export const faixa = () => (innerWidth >= 1200 ? 'desktop' : innerWidth >= 600 ? 'tablet' : 'celular');

// ---------- Acréscimos para as telas (Palavras no tempo e componentes) ----------
/** Endereço de cada tela a partir da raiz, por idioma (o mesmo de site/build.py ROUTES). */
export const ROTAS = {
  inicio: { en: '', pt: 'pt/' },
  palavras: { en: 'words/', pt: 'pt/palavras/' },
  mapa: { en: 'map/', pt: 'pt/mapa/' },
  areas: { en: 'fields/', pt: 'pt/areas/' },
  ptxen: { en: 'pt-en/', pt: 'pt/pt-en/' },
  experimento: { en: 'time-machine/', pt: 'pt/maquina-do-tempo/' },
  raiox: { en: 'x-ray/', pt: 'pt/raio-x/' },
  jogo: { en: 'game/', pt: 'pt/jogo/' },
  metodo: { en: 'method/', pt: 'pt/metodo/' },
};
/** Link relativo para outra tela no idioma da página: rota('palavras') + '?p=crucial.pt'. */
export const rota = (id) => `${raiz}${ROTAS[id][lingua]}` || './';

/** Número ordinal: 14º (pt) ou 14th (en). */
const regraOrdinal = lingua === 'en' ? new Intl.PluralRules('en', { type: 'ordinal' }) : null;
const SUFIXO_EN = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
export function ordinal(n) {
  return lingua === 'en' ? `${fmt.num(n)}${SUFIXO_EN[regraOrdinal.select(n)]}` : `${fmt.num(n)}º`;
}
