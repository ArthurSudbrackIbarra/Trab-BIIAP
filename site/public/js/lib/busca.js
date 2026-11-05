// IAês · busca de palavras com autocompletar (padrão ARIA combobox com listbox).
//
//   const busca = criarBusca({ aoEscolher(item) {...}, linguas: ['pt', 'en'] });
//   caixa.append(busca.elemento);
//
//   opcoes:
//     aoEscolher(item): item = { palavra, lingua, chave, n2025, classe, posicao } (palavras.js).
//     linguas (['pt', 'en']), limite (8): onde buscar e quantas sugestões mostrar.
//     rotulo (t('busca_rotulo')), placeholder (o mesmo rótulo), rotuloVisivel (false: só leitor de tela).
//     escolhida(item) → true marca a sugestão como "já no gráfico" e impede escolher de novo.
//     vazio(texto) → Node: o que mostrar abaixo de "Nenhum resumo usa xyz." (ex.: sugestões).
//   Devolve { elemento, entrada, limpar(), focar(), fechar(), desativar(sim, placeholder) }.
//
// Cada sugestão traz a palavra, a língua (traço na cor e sigla), os resumos de 2025 e uma linha com
// a classe e a posição no excesso, ou "pouco usada". Setas, Enter, Esc; Tab fecha a lista.
import { el, icone, t, fmt, ordinal, siglaLingua } from './base.js';
import { buscar, indice, MINIMO_RESUMOS } from './palavras.js';

let contador = 0;

function linhaDois(item) {
  if (item.n2025 < MINIMO_RESUMOS) return t('busca_pouca', { minimo: MINIMO_RESUMOS });
  const partes = [];
  if (item.classe) partes.push(t(`busca_classe_${item.classe.replace('-', '_')}`));
  if (item.posicao) partes.push(t('busca_posicao', { posicao: ordinal(item.posicao) }));
  return partes.join(' · ');
}

export function criarBusca(opcoes = {}) {
  const {
    aoEscolher, linguas = ['pt', 'en'], limite = 8, rotulo = t('busca_rotulo'), placeholder,
    rotuloVisivel = false, escolhida, vazio,
  } = opcoes;
  const id = `busca-${++contador}`;
  const entrada = el('input', {
    id, type: 'text', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': `${id}-lista`,
    'aria-autocomplete': 'list', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
    placeholder: placeholder || rotulo, 'aria-describedby': `${id}-ajuda`,
  });
  const lista = el('ul', { class: 'cartao busca-lista', role: 'listbox', id: `${id}-lista`, 'aria-label': rotulo, hidden: true });
  const aviso = el('div', { class: 'cartao busca-aviso', hidden: true });
  const vivo = el('p', { class: 'sr', 'aria-live': 'polite' });
  const caixaEntrada = el('div', { class: 'entrada busca-entrada' }, icone('busca', 'ic ic-p busca-icone'), entrada);
  const elemento = el('div', { class: 'busca' },
    el('label', { class: rotuloVisivel ? 'campo-rotulo' : 'sr', for: id, text: rotulo }),
    caixaEntrada, lista, aviso, vivo,
    el('p', { class: 'sr', id: `${id}-ajuda`, text: t('busca_ajuda') }));

  let itens = [];
  let ativo = -1;
  let pedido = 0;
  let espera = null;

  function fechar() {
    lista.hidden = true;
    aviso.hidden = true;
    entrada.setAttribute('aria-expanded', 'false');
    entrada.removeAttribute('aria-activedescendant');
    ativo = -1;
  }

  function realcar(i) {
    const opcoesEl = [...lista.children];
    if (!opcoesEl.length) return;
    ativo = (i + opcoesEl.length) % opcoesEl.length;
    opcoesEl.forEach((li, k) => li.setAttribute('aria-selected', String(k === ativo)));
    entrada.setAttribute('aria-activedescendant', opcoesEl[ativo].id);
    opcoesEl[ativo].scrollIntoView?.({ block: 'nearest' });
  }

  function escolher(i) {
    const item = itens[i];
    if (!item || escolhida?.(item)) return;
    fechar();
    entrada.value = '';
    aoEscolher?.(item);
  }

  // Filhos null ou false (um `vazio` que não devolve nada) ficam de fora: replaceChildren os
  // escreveria como texto.
  function mostrarAviso(...filhos) {
    lista.hidden = true;
    aviso.replaceChildren(...filhos.filter((filho) => filho != null && filho !== false));
    aviso.hidden = false;
    entrada.setAttribute('aria-expanded', 'false');
  }

  function desenhar(texto) {
    if (!itens.length) {
      const msg = el('p', { class: 'busca-aviso-titulo' }, t('busca_nenhum_antes'), el('span', { class: 'w', text: texto.trim() }), t('busca_nenhum_depois'));
      mostrarAviso(msg, vazio?.(texto));
      vivo.textContent = `${t('busca_nenhum_antes')}${texto.trim()}${t('busca_nenhum_depois')}`;
      return;
    }
    aviso.hidden = true;
    lista.replaceChildren(...itens.map((item, i) => {
      const ja = escolhida?.(item);
      return el('li', {
        role: 'option', id: `${id}-o${i}`, class: 'busca-opcao', 'aria-selected': 'false', 'aria-disabled': ja ? 'true' : null,
        dataset: { i },
      },
      el('span', { class: 'busca-opcao-linha' },
        el('span', { class: 'w', lang: item.lingua === 'en' ? 'en' : 'pt-BR', text: item.palavra }),
        el('span', { class: 'etq' }, el('span', { class: `chave chave-${item.lingua}` }), siglaLingua(item.lingua)),
        el('span', { class: 'busca-opcao-n t-legenda num', text: item.n2025 === 1 ? t('busca_n_1') : t('busca_n', { n: fmt.num(item.n2025) }) })),
      el('span', { class: 't-legenda', text: ja ? t('busca_ja') : linhaDois(item) }));
    }));
    lista.hidden = false;
    entrada.setAttribute('aria-expanded', 'true');
    ativo = -1;
    entrada.removeAttribute('aria-activedescendant');
    vivo.textContent = t('busca_resultados', { n: itens.length });
  }

  async function atualizar() {
    const texto = entrada.value;
    const meu = ++pedido;
    if (!texto.trim()) { itens = []; fechar(); return; }
    let resultado;
    try {
      resultado = await buscar(texto, linguas, limite);
    } catch {
      if (meu !== pedido) return;
      mostrarAviso(el('p', { class: 'busca-aviso-titulo', text: t('busca_erro') }),
        el('button', { class: 'btn btn-p', type: 'button', on: { click: () => { atualizar(); entrada.focus(); } } }, icone('recarregar', 'ic ic-p'), t('erro_tentar')));
      return;
    }
    if (meu !== pedido) return;
    itens = resultado;
    desenhar(texto);
  }

  entrada.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(atualizar, 90);
  });
  entrada.addEventListener('focus', () => {
    // Começa a baixar os índices na primeira vez que alguém vai digitar.
    linguas.forEach((l) => indice(l).catch(() => {}));
    if (entrada.value.trim()) atualizar();
  });
  entrada.addEventListener('keydown', (evento) => {
    const k = evento.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      evento.preventDefault();
      if (lista.hidden && itens.length) { lista.hidden = false; entrada.setAttribute('aria-expanded', 'true'); }
      realcar(ativo + (k === 'ArrowDown' ? 1 : -1) + (ativo < 0 && k === 'ArrowUp' ? 1 : 0));
    } else if (k === 'Enter') {
      evento.preventDefault();
      if (!lista.hidden && itens.length) escolher(ativo >= 0 ? ativo : itens.findIndex((it) => !escolhida?.(it)));
    } else if (k === 'Escape') {
      if (!lista.hidden || !aviso.hidden) fechar();
      else entrada.value = '';
    } else if (k === 'Tab') {
      fechar();
    }
  });
  // A caixa toda (44 px no celular, com o ícone) leva ao campo, não só a linha do texto.
  caixaEntrada.addEventListener('mousedown', (evento) => {
    if (evento.target === entrada || entrada.disabled) return;
    evento.preventDefault();
    entrada.focus();
  });
  lista.addEventListener('pointerdown', (evento) => evento.preventDefault());
  lista.addEventListener('click', (evento) => {
    const li = evento.target.closest('[role=option]');
    if (li) escolher(Number(li.dataset.i));
  });
  document.addEventListener('pointerdown', (evento) => {
    if (!elemento.contains(evento.target)) fechar();
  });

  return {
    elemento, entrada, fechar,
    limpar() { entrada.value = ''; itens = []; fechar(); },
    focar() { entrada.focus(); },
    desativar(sim, texto) {
      entrada.disabled = Boolean(sim);
      caixaEntrada.classList.toggle('entrada-desativada', Boolean(sim));
      entrada.placeholder = sim && texto ? texto : (placeholder || rotulo);
      if (sim) fechar();
    },
    definirPlaceholder(texto) { entrada.placeholder = texto; },
  };
}
