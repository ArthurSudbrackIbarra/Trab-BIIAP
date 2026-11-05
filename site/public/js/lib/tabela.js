// IAês · tabelas e o botão "Ver como tabela".
//
//   tabela(colunas, linhas, opcoes) → elemento .tabela-caixa com a <table>
//     colunas: [{ rotulo, num, curto, classe }]
//       rotulo: texto ou nó do cabeçalho; num: true alinha à direita com algarismos tabulares;
//       curto: rótulo usado no celular (abaixo de 600 px), se houver.
//     linhas: [[celula, ...]], célula = texto | número | Node | { conteudo, classe, forte, lang }
//       (forte: peso 600, como a coluna de razão). null ou undefined vira célula vazia.
//     opcoes.legenda: <caption> só para leitor de tela (diga o que a tabela mostra).
//     opcoes.minLargura: largura mínima em px; a caixa rola na horizontal abaixo disso.
//     opcoes.cabecalhoLinha (true): a primeira célula de cada linha é <th scope="row">.
//     opcoes.classe: classe extra na caixa.
//     No celular, se a tabela passar da largura da caixa, uma linha no pé dela diz que dá para
//     deslizar (t('tabela_deslize'), .tabela-deslize); ela some quando a tabela cabe.
//
//   botaoTabela({ grafico, lugar, criar, aoMudar, classe, mostrando }) → { botao, mostrando, alternar(v), atualizar() }
//     O botão troca o gráfico pela tabela e volta ("Ver como tabela" / "Ver o gráfico"). O rótulo
//     já diz o que o clique faz, então o botão não leva aria-pressed; para achá-lo, a classe fixa
//     .botao-tabela. grafico: o elemento (ou lista) que some quando a tabela aparece; lugar: onde a
//     tabela entra (padrão: logo depois do primeiro elemento de `grafico`); criar(): devolve a
//     tabela (chamado a cada troca e a cada atualizar(), para refletir os filtros). Sem `criar`,
//     o botão só avisa aoMudar(mostrando) e quem chamou faz a troca. classe: 'btn btn-p' (padrão).
import { el, icone, t, faixa } from './base.js';

// Uma observação de tamanho para todas as tabelas: mostra ou tira o aviso de deslizar.
const observador = typeof ResizeObserver === 'function'
  ? new ResizeObserver((entradas) => entradas.forEach(({ target }) => avisoDeslize(target)))
  : null;

function avisoDeslize(caixa) {
  if (!caixa.isConnected) { observador?.unobserve(caixa); return; }
  const sobra = faixa() === 'celular' && caixa.scrollWidth > caixa.clientWidth + 1;
  const aviso = caixa.querySelector(':scope > .tabela-deslize');
  if (sobra && !aviso) caixa.append(el('p', { class: 't-legenda tabela-deslize', text: t('tabela_deslize') }));
  else if (!sobra) aviso?.remove();
}

function celula(tag, valor, coluna, extra = {}) {
  const classes = [coluna?.num ? 'n' : '', coluna?.classe || ''];
  let conteudo = valor;
  const attrs = { ...extra };
  if (valor && typeof valor === 'object' && !(valor instanceof Node)) {
    conteudo = valor.conteudo;
    if (valor.classe) classes.push(valor.classe);
    if (valor.forte) classes.push('tabela-forte');
    if (valor.lang) attrs.lang = valor.lang;
  }
  const no = el(tag, { ...attrs, class: classes.filter(Boolean).join(' ') || null });
  if (conteudo instanceof Node) no.append(conteudo);
  else if (conteudo != null) no.textContent = String(conteudo);
  return no;
}

export function tabela(colunas, linhas, opcoes = {}) {
  const { legenda, minLargura, cabecalhoLinha = true, classe } = opcoes;
  const cabeca = el('tr', {}, colunas.map((c) => {
    const rotulo = c.curto
      ? [el('span', { class: 'tabela-longo' }, c.rotulo), el('span', { class: 'tabela-curto', 'aria-hidden': 'true' }, c.curto)]
      : c.rotulo;
    return el('th', { scope: 'col', class: [c.num ? 'n' : '', c.classe || ''].filter(Boolean).join(' ') || null }, rotulo);
  }));
  const corpo = linhas.map((linha) => el('tr', {}, linha.map((valor, i) => (
    i === 0 && cabecalhoLinha ? celula('th', valor, colunas[i], { scope: 'row' }) : celula('td', valor, colunas[i])))));
  const tab = el('table', { class: 'tabela', style: minLargura ? { minWidth: `${minLargura}px` } : null },
    legenda && el('caption', { class: 'sr', text: legenda }),
    el('thead', {}, cabeca),
    el('tbody', {}, corpo));
  const caixa = el('div', { class: `tabela-caixa ${classe || ''}`.trim() }, tab);
  observador?.observe(caixa);
  return caixa;
}

export function botaoTabela({ grafico, lugar, criar, aoMudar, classe = 'btn btn-p', mostrando = false } = {}) {
  const graficos = () => [grafico].flat().filter(Boolean);
  let atual = null;
  const botao = el('button', { class: `${classe} botao-tabela`, type: 'button' });
  const estado = { mostrando: false };

  function desenharBotao() {
    botao.replaceChildren(icone(estado.mostrando ? 'grafico' : 'tabela', 'ic ic-p'), t(estado.mostrando ? 'ver_grafico' : 'ver_tabela'));
  }

  function atualizar() {
    if (!criar) return;
    atual?.remove();
    atual = null;
    if (!estado.mostrando) return;
    atual = criar();
    if (!atual) return;
    const destino = lugar || graficos()[0];
    if (lugar) lugar.append(atual);
    else destino?.after(atual);
  }

  function alternar(valor = !estado.mostrando) {
    estado.mostrando = Boolean(valor);
    if (criar) for (const g of graficos()) g.hidden = estado.mostrando;
    desenharBotao();
    atualizar();
    aoMudar?.(estado.mostrando);
  }

  botao.addEventListener('click', () => alternar());
  desenharBotao();
  if (mostrando) alternar(true);
  return {
    botao, alternar, atualizar,
    get mostrando() { return estado.mostrando; },
  };
}
