// IAês · acesso aos dados de palavras (site/public/dados/palavras/, contrato em site/DADOS.md).
//
// Tudo devolve Promise e baixa cada arquivo uma vez por página (cache de base.js dados()).
//
//   indice(lingua) → { lingua, anos, palavras: Item[], get(palavra) → Item | undefined }
//       Item = { palavra, lingua, chave: 'crucial.pt', n2025, classe, posicao }
//       classe: 'estilo' | 'conteudo' | 'sem-classe' | null; posicao: lugar no excesso de 2025 ou null.
//       Ordem do arquivo: mais resumos em 2025 primeiro.
//   buscar(texto, linguas = ['pt', 'en'], limite = 8) → Item[]
//       Sem acento e sem caixa. A palavra exata vem primeiro, depois as que começam pelo texto e
//       por fim as que o contêm; em cada grupo, mais resumos em 2025 primeiro.
//   serie(palavra, lingua) → Serie | null   (null: a palavra não está nos dados)
//       Serie = { palavra, lingua, chave, n[12], obs[12], esp[6] (2021 a 2026), par, contexto?, experimento? }
//       Baixa só o arquivo da inicial da palavra.
//   serieArea(palavra, lingua, area) → { palavra, lingua, chave, area, n, obs, esp } | null
//       area 'todas' (ou vazia) devolve serie(). null: poucos resumos da área para medir.
//   ficha(palavra, lingua) → { ...Item, ...Serie, ausente: bool, rara: bool, poucos: bool }
//       Tudo o que se sabe da palavra (índice e série juntos), para o painel da palavra.
//       ausente = fora dos dados; nesse caso só palavra, lingua e chave vêm preenchidos.
//       Se o arquivo da letra trouxer classe e posicao, o índice não é baixado.
//   padrao() → { padrao: ['underscore.en', ...], sugestoes: [...] }
//
// Contas sobre uma série (sem download):
//   medidas(s) → { base, obs2025, esp2025, razao, dif } (base = média de 2021 e 2022; frações de 0 a 1)
//   rara(s, item) → true quando nenhum ano chega a MINIMO_RESUMOS (10, o mínimo da análise) e a
//       palavra não tem classe. item: a linha do índice ou a ficha; palavra com classe teve excesso
//       e foi medida, então nunca é rara. Sem item, vale só a contagem.
//   poucos(s) → true quando nenhum ano chega a POUCOS_RESUMOS (20): a linha oscila (o painel avisa)
//   faixaResumos(s) → [menor, maior] número de resumos num ano
//   relativa(s) → { obs, esp } divididos pela base de 2021-22 (2021-22 = 1)
//   normalizar(texto) → sem acento, minúsculo, sem espaços nas pontas
//   I2025 (posição de 2025 nos arrays por ano), I_ESP (posição de 2021: esp[k] é do ano 2021 + k)
import { dados, inicial, chave as fazerChave, ANOS } from './base.js';

export const I2025 = ANOS.indexOf(2025);
export const I_ESP = ANOS.indexOf(2021);
/** Abaixo disto, em todo ano, a palavra sem classe é "rara": pouco para medir (MIN_COUNT de scripts/excess.py). */
export const MINIMO_RESUMOS = 10;
/** Abaixo disto, em todo ano, a linha ainda aparece, com o aviso de que oscila. */
export const POUCOS_RESUMOS = 20;

export const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const indices = new Map();
/** Índice de busca de uma língua. */
export function indice(lingua) {
  if (!indices.has(lingua)) {
    const promessa = dados(`palavras/${lingua}/indice.json`).then((bruto) => {
      const palavras = bruto.palavras.map(([palavra, n2025, classe, posicao]) => ({
        palavra, lingua, chave: fazerChave(palavra, lingua), n2025, classe, posicao, normal: normalizar(palavra),
      }));
      const mapa = new Map(palavras.map((item) => [item.palavra, item]));
      return { lingua, anos: bruto.anos, palavras, get: (palavra) => mapa.get(String(palavra).toLowerCase()) };
    });
    promessa.catch(() => indices.delete(lingua));
    indices.set(lingua, promessa);
  }
  return indices.get(lingua);
}

/** Autocompletar: exata, depois começa com, depois contém; cada grupo por resumos em 2025. */
export async function buscar(texto, linguas = ['pt', 'en'], limite = 8) {
  const alvo = normalizar(texto);
  if (!alvo) return [];
  const listas = await Promise.all(linguas.map((l) => indice(l)));
  const exatas = [];
  const comeco = [];
  const meio = [];
  for (const ind of listas) {
    for (const item of ind.palavras) {
      if (item.normal === alvo) exatas.push(item);
      else if (item.normal.startsWith(alvo)) comeco.push(item);
      else if (alvo.length >= 3 && item.normal.includes(alvo)) meio.push(item);
    }
  }
  const ordem = (a, b) => b.n2025 - a.n2025 || a.palavra.localeCompare(b.palavra);
  return [...exatas.sort(ordem), ...comeco.sort(ordem), ...meio.sort(ordem)].slice(0, limite)
    .map(({ normal, ...item }) => item);
}

/** Série de uma palavra; null se ela não está nos dados. */
export async function serie(palavra, lingua) {
  const p = String(palavra).toLowerCase();
  const arquivo = await dados(`palavras/${lingua}/${inicial(p)}.json`);
  const s = Object.hasOwn(arquivo, p) ? arquivo[p] : null;
  return s ? { palavra: p, lingua, chave: fazerChave(p, lingua), ...s } : null;
}

/** Série de uma palavra numa área; 'todas' é a série do conjunto. */
export async function serieArea(palavra, lingua, area) {
  if (!area || area === 'todas') return serie(palavra, lingua);
  const p = String(palavra).toLowerCase();
  const arquivo = await dados(`palavras/${lingua}/areas/${inicial(p)}.json`);
  const s = Object.hasOwn(arquivo, p) && Object.hasOwn(arquivo[p], area) ? arquivo[p][area] : null;
  return s ? { palavra: p, lingua, chave: fazerChave(p, lingua), area, ...s } : null;
}

// Os arquivos de letra trazem classe e posição? Sabido depois do primeiro; até lá, o índice vem junto.
let classeNaLetra = false;

/** Índice e série juntos; `ausente` quando a palavra não está nos dados. */
export async function ficha(palavra, lingua) {
  const p = String(palavra).toLowerCase();
  const pedidoIndice = classeNaLetra ? null : indice(lingua);
  pedidoIndice?.catch(() => {});
  const s = await serie(p, lingua);
  const ausente = { palavra: p, lingua, chave: fazerChave(p, lingua), ausente: true, rara: false, poucos: false };
  if (!s) return ausente;
  classeNaLetra = 'classe' in s && 'posicao' in s;
  let resto = {};
  if (!classeNaLetra) {
    const item = (await (pedidoIndice || indice(lingua))).get(p);
    if (!item) return ausente;
    const { normal, ...doIndice } = item;
    resto = doIndice;
  }
  const f = { n2025: s.n?.[I2025] ?? null, ...resto, ...s, ausente: false };
  f.rara = rara(f, f);
  f.poucos = !f.rara && poucos(f);
  return f;
}

/** As palavras com que Palavras no tempo abre e as sugestões. */
export const padrao = () => dados('palavras/padrao.json');

// ---------- Contas ----------
const media = (a, b) => (a == null || b == null ? null : (a + b) / 2);

/** Números de 2025 de uma série: base 2021-22, observado, esperado, razão e diferença. */
export function medidas(s) {
  if (!s) return null;
  // A base no recorte de 2025, o mesmo do esperado e da razão (sem ele, a média observada).
  const base = s.base ?? media(s.obs[I_ESP], s.obs[I_ESP + 1]);
  const obs2025 = s.obs[I2025];
  const esp2025 = s.esp ? s.esp[I2025 - I_ESP] : null;
  const ok = obs2025 != null && esp2025 != null && esp2025 > 0;
  return { base, obs2025, esp2025, razao: ok ? obs2025 / esp2025 : null, dif: ok ? obs2025 - esp2025 : null };
}

/** Menor e maior número de resumos com a palavra num ano. */
export function faixaResumos(s) {
  const ns = (s?.n || []).filter((v) => v != null);
  return ns.length ? [Math.min(...ns), Math.max(...ns)] : [0, 0];
}

/** Rara: sem classe e nenhum ano com MINIMO_RESUMOS resumos (item: linha do índice ou ficha). */
export const rara = (s, item) => !s || !s.n || (item?.classe == null && faixaResumos(s)[1] < MINIMO_RESUMOS);

/** Poucos resumos: nenhum ano com POUCOS_RESUMOS; a linha aparece, mas oscila. */
export const poucos = (s) => Boolean(s?.n) && faixaResumos(s)[1] < POUCOS_RESUMOS;

/** A série na escala relativa: cada valor dividido pela média de 2021 e 2022 (2021-22 = 1). */
export function relativa(s) {
  const base = media(s.obs[I_ESP], s.obs[I_ESP + 1]);
  const div = (v) => (v == null || !base ? null : v / base);
  return { obs: s.obs.map(div), esp: s.esp ? s.esp.map(div) : null };
}
