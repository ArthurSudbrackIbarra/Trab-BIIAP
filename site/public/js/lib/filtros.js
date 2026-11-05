// IAês · controles de filtro do design: segmentos, interruptor, seletor de área
// e o filtro "Resumos em". Todos devolvem o elemento pronto, com .valor e .definir(v), e chamam
// aoMudar(valor) só quando a pessoa muda (definir() não chama).
//
//   segmentos({ rotulo, opcoes, valor, aoMudar, rotuloVisivel = true, classe })
//     opcoes: [{ valor, texto, chave?: 'pt'|'en'|'par', desativada?, titulo? }]
//     <div class="filtro" role="group" aria-label=rotulo> com .seg e botões com aria-pressed.
//     chave mostra o traço da língua antes do texto ('par' = os dois traços, "Lado a lado").
//   interruptor({ texto, ligado, aoMudar })
//     <button class="interruptor" role="switch" aria-checked>. O texto diz o que acontece ao ligar.
//   seletorArea({ valor = 'todas', aoMudar, rotulo = t('area'), areas = AREAS, comTodas = true,
//                 desativadas = [], rotuloVisivel = true, nome = nomeArea })
//     Botão .entrada com lista própria (role=listbox): setas, Home, End, Enter, Esc e a primeira
//     letra escolhem. desativadas: slugs que aparecem mas não podem ser escolhidos.
//     nome(valor) → texto de cada opção: com areas: ['2019', '2025'], comTodas: false e
//     nome: String, o mesmo seletor lista anos. definir(v) com valor fora da lista volta à primeira.
//   filtroResumos({ valor = 'pt', aoMudar, ladoALado = false })
//     "Resumos em: Português | Inglês [| Lado a lado]", com o traço da cor de cada língua.
//
// No celular (abaixo de 600 px), .filtro-empilha põe o rótulo acima e os segmentos na largura toda
// (regra em site.css); todos os controles daqui já saem com essa classe.
import { el, icone, t, AREAS, nomeArea } from './base.js';

let contador = 0;

function chaveLingua(chave) {
  if (!chave) return null;
  if (chave === 'par') return el('span', { class: 'chave-par', 'aria-hidden': 'true' }, el('span', { class: 'chave chave-pt' }), el('span', { class: 'chave chave-en' }));
  return el('span', { class: `chave chave-${chave}`, 'aria-hidden': 'true' });
}

export function segmentos({ rotulo, opcoes, valor, aoMudar, rotuloVisivel = true, classe = '' }) {
  const caixa = el('div', { class: `filtro filtro-empilha ${classe}`.trim(), role: 'group', 'aria-label': rotulo });
  const seg = el('div', { class: 'seg' });
  const botoes = opcoes.map((o) => el('button', {
    type: 'button', 'aria-pressed': String(o.valor === valor), disabled: o.desativada || null, title: o.titulo || null,
    dataset: { valor: String(o.valor) },
    on: {
      click: () => {
        if (caixa.valor === o.valor) return;
        caixa.definir(o.valor);
        aoMudar?.(o.valor);
      },
    },
  }, chaveLingua(o.chave), o.texto));
  seg.append(...botoes);
  if (rotuloVisivel && rotulo) caixa.append(el('span', { class: 'filtro-rotulo', 'aria-hidden': 'true', text: rotulo }));
  caixa.append(seg);
  caixa.valor = valor;
  caixa.definir = (v) => {
    caixa.valor = v;
    botoes.forEach((b, i) => b.setAttribute('aria-pressed', String(opcoes[i].valor === v)));
  };
  return caixa;
}

export function interruptor({ texto, ligado = false, aoMudar }) {
  const botao = el('button', { class: 'interruptor', type: 'button', role: 'switch', 'aria-checked': String(Boolean(ligado)) },
    el('span', { class: 'trilho', 'aria-hidden': 'true' }), texto);
  botao.valor = Boolean(ligado);
  botao.definir = (v) => {
    botao.valor = Boolean(v);
    botao.setAttribute('aria-checked', String(botao.valor));
  };
  botao.addEventListener('click', () => {
    botao.definir(!botao.valor);
    aoMudar?.(botao.valor);
  });
  return botao;
}

export function seletorArea({
  valor = 'todas', aoMudar, rotulo = t('area'), areas = AREAS, comTodas = true, desativadas = [], rotuloVisivel = true, nome = nomeArea,
} = {}) {
  const id = `area-${++contador}`;
  const valores = [...(comTodas ? ['todas'] : []), ...areas];
  const caixa = el('div', { class: 'filtro filtro-empilha seletor' });
  const rotuloEl = el('span', { class: rotuloVisivel ? 'filtro-rotulo' : 'sr', id: `${id}-rot`, text: rotulo });
  const texto = el('span', { class: 'seletor-texto' });
  const botao = el('button', {
    type: 'button', class: 'entrada seletor-botao', id: `${id}-botao`,
    'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-labelledby': `${id}-rot ${id}-botao`,
  }, texto, icone('abaixo'));
  const lista = el('ul', { class: 'cartao seletor-lista', role: 'listbox', id: `${id}-lista`, tabindex: '-1', 'aria-labelledby': `${id}-rot`, hidden: true });
  const itens = valores.map((v) => el('li', {
    role: 'option', id: `${id}-${v}`, class: 'seletor-opcao', dataset: { valor: v },
    'aria-selected': 'false', 'aria-disabled': desativadas.includes(v) ? 'true' : null,
  }, el('span', { class: 'seletor-marca', 'aria-hidden': 'true' }), nome(v)));
  lista.append(...itens);
  const envolve = el('div', { class: 'seletor-envolve' }, botao, lista);
  caixa.append(rotuloEl, envolve);

  let destaque = 0;
  caixa.valor = valor;

  function marcar() {
    texto.textContent = nome(caixa.valor);
    itens.forEach((li) => {
      const sel = li.dataset.valor === caixa.valor;
      li.setAttribute('aria-selected', String(sel));
      li.querySelector('.seletor-marca').replaceChildren(sel ? el('svg', { class: 'ic ic-p', viewBox: '0 0 24 24' }, el('path', { d: 'M5 12.5l4.5 4.5L19 7.5' })) : '');
    });
  }
  function realcar(i) {
    destaque = (i + itens.length) % itens.length;
    itens.forEach((li, k) => li.classList.toggle('seletor-ativa', k === destaque));
    lista.setAttribute('aria-activedescendant', itens[destaque].id);
    itens[destaque].scrollIntoView?.({ block: 'nearest' });
  }
  function abrir() {
    lista.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    realcar(Math.max(0, valores.indexOf(caixa.valor)));
    lista.focus();
    document.addEventListener('pointerdown', fora, true);
  }
  function fechar(devolverFoco = true) {
    lista.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', fora, true);
    if (devolverFoco) botao.focus();
  }
  function fora(evento) {
    if (!envolve.contains(evento.target)) fechar(false);
  }
  function escolher(i) {
    const v = valores[i];
    if (desativadas.includes(v)) return;
    fechar();
    if (v === caixa.valor) return;
    caixa.valor = v;
    marcar();
    aoMudar?.(v);
  }

  botao.addEventListener('click', () => (lista.hidden ? abrir() : fechar()));
  botao.addEventListener('keydown', (evento) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(evento.key)) {
      evento.preventDefault();
      abrir();
    }
  });
  lista.addEventListener('keydown', (evento) => {
    const k = evento.key;
    if (k === 'ArrowDown') realcar(destaque + 1);
    else if (k === 'ArrowUp') realcar(destaque - 1);
    else if (k === 'Home') realcar(0);
    else if (k === 'End') realcar(itens.length - 1);
    else if (k === 'Enter' || k === ' ') escolher(destaque);
    else if (k === 'Escape') fechar();
    else if (k === 'Tab') { fechar(false); return; }
    else if (k.length === 1 && /\S/.test(k)) {
      const letra = k.toLocaleLowerCase();
      const n = itens.length;
      for (let d = 1; d <= n; d += 1) {
        const li = itens[(destaque + d) % n];
        if (li.textContent.toLocaleLowerCase().normalize('NFD').startsWith(letra)) { realcar((destaque + d) % n); break; }
      }
    } else return;
    evento.preventDefault();
  });
  lista.addEventListener('click', (evento) => {
    const li = evento.target.closest('[role=option]');
    if (li) escolher(itens.indexOf(li));
  });
  lista.addEventListener('pointermove', (evento) => {
    const li = evento.target.closest('[role=option]');
    if (li) realcar(itens.indexOf(li));
  });

  caixa.definir = (v) => {
    caixa.valor = valores.includes(v) ? v : valores[0];
    marcar();
  };
  marcar();
  return caixa;
}

export function filtroResumos({ valor = 'pt', aoMudar, ladoALado = false } = {}) {
  const opcoes = [
    { valor: 'pt', texto: t('lingua_pt'), chave: 'pt' },
    { valor: 'en', texto: t('lingua_en'), chave: 'en' },
  ];
  if (ladoALado) opcoes.push({ valor: 'lado', texto: t('lado_a_lado'), chave: 'par' });
  return segmentos({ rotulo: t('resumos_em'), opcoes, valor, aoMudar });
}
