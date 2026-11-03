// IAês · a dica (tooltip) dos gráficos: abre igual com mouse, foco e toque.
// No desktop e no tablet flutua dentro da caixa do gráfico, ao lado do ponto, sem cobri-lo.
// No celular vira um cartão fixo logo abaixo do gráfico, com botão de fechar (design: m-palavras).
//
//   const dica = criarDica(caixa, { fixaNoCelular: true, topo: 38 });
//   dica.mostrar(conteudoDica({...}), { x: 210, y: 80, topo });   // px dentro da caixa; topo fixo opcional
//   dica.esconder();  dica.destruir();  dica.aberta  // boolean
//
//   caixa: elemento com position:relative (o .plot do gráfico). A dica flutuante entra nele (e volta
//   a entrar se quem chamou trocar o conteúdo da caixa); o cartão do celular entra logo depois dele.
//   opcoes.fixaNoCelular (true): no celular, cartão fixo em vez de dica flutuante.
//   opcoes.topo: altura fixa (px) do topo da dica; sem ela, a dica acompanha o y do ponto.
//   opcoes.aoFechar({ devolverFoco: true }): chamado quando a pessoa fecha o cartão do celular. O
//     botão de fechar some com o foco: quem chamou devolve o foco ao elemento que abriu a dica.
//   opcoes.aoEsc(): chamado quando a pessoa fecha a dica com Esc.
//   Esc fecha a dica aberta, venha ela do mouse, do foco ou do toque, e para aí: o mesmo Esc não
//   fecha o painel da palavra (ou outra camada) em volta. Com a dica já fechada, o Esc segue.
//
//   conteudoDica({ chave, palavra, sub, valor, extra, leitura, lingua }) → DocumentFragment
//     chave: 'pt' | 'en' | 'base' (traço na cor da série) ou null; palavra: texto em negrito;
//     sub: "PT · 2025"; valor: o número principal ("2,1% dos resumos"); extra: linha abaixo
//     ("Esperado: 0,9%"); leitura: a frase de leitura. Qualquer campo pode faltar.
//     Para várias séries, `linhas: [{ chave, texto, valor }]` lista uma linha por série.
import { el, icone, t, faixa } from './base.js';

export function conteudoDica({ chave, palavra, sub, valor, extra, leitura, linhas, lingua } = {}) {
  const frag = document.createDocumentFragment();
  if (palavra || sub) {
    frag.append(el('div', { class: 'dica-topo' },
      chave && el('span', { class: `chave chave-${chave}` }),
      el('span', {},
        palavra && el('span', { class: 'w dica-palavra', lang: lingua === 'en' ? 'en' : lingua === 'pt' ? 'pt-BR' : null, text: palavra }),
        palavra && sub ? ' · ' : '', sub || '')));
  }
  if (valor) frag.append(el('p', { class: 'dica-valor', text: valor }));
  if (extra) frag.append(el('p', { class: 'num', text: extra }));
  if (linhas?.length) {
    frag.append(el('div', { class: 'dica-linhas' }, linhas.map((l) => el('p', { class: 'dica-linha' },
      l.chave && el('span', { class: `chave chave-${l.chave}` }),
      el('span', { class: 'dica-linha-texto', text: l.texto }),
      el('span', { class: 'num dica-linha-valor', text: l.valor })))));
  }
  if (leitura) frag.append(el('p', { class: 'dica-leitura', text: leitura }));
  return frag;
}

export function criarDica(caixa, opcoes = {}) {
  const { fixaNoCelular = true } = opcoes;
  let flutuante = null;
  let cartao = null;
  let aberta = false;

  const celular = () => fixaNoCelular && faixa() === 'celular';

  // Esc na fase de captura do document: fecha a dica antes que o painel em volta veja a tecla. A
  // dica de uma parte inerte da página (sob o menu do celular ou o painel) deixa a tecla passar.
  function teclaEsc(evento) {
    if (evento.key !== 'Escape' || !aberta || caixa.closest('[inert]')) return;
    evento.stopPropagation();
    esconder();
    opcoes.aoEsc?.();
  }

  function esconder() {
    aberta = false;
    document.removeEventListener('keydown', teclaEsc, true);
    if (flutuante) {
      flutuante.classList.remove('dica-visivel');
      flutuante.hidden = true;
    }
    if (cartao) cartao.hidden = true;
  }

  function mostrar(conteudo, pos = {}) {
    aberta = true;
    document.addEventListener('keydown', teclaEsc, true);
    if (celular()) {
      if (flutuante) flutuante.hidden = true;
      if (!cartao) {
        cartao = el('div', { class: 'cartao dica-fixa', role: 'status' });
        caixa.after(cartao);
      }
      const fechar = el('button', {
        class: 'btn btn-fantasma btn-icone btn-p dica-fechar', type: 'button', 'aria-label': t('dica_fechar'),
        on: { click: () => { esconder(); opcoes.aoFechar?.({ devolverFoco: true }); } },
      }, icone('fechar'));
      const corpo = el('div', { class: 'dica-fixa-corpo' }, conteudo);
      cartao.replaceChildren(fechar, corpo);
      cartao.hidden = false;
      return;
    }
    if (cartao) cartao.hidden = true;
    if (!flutuante) flutuante = el('div', { class: 'dica', role: 'tooltip', hidden: true });
    // O gráfico troca o conteúdo da caixa ao se redesenhar: a dica volta para dentro dela.
    if (flutuante.parentNode !== caixa) caixa.append(flutuante);
    flutuante.replaceChildren(conteudo);
    flutuante.hidden = false;
    // Ao lado do ponto, de preferência à esquerda, sem cobri-lo. Pode passar da caixa do
    // gráfico (o painel vizinho fica embaixo), mas não da janela.
    const largura = flutuante.offsetWidth;
    const altura = flutuante.offsetHeight;
    const caixaL = caixa.clientWidth;
    const caixaA = caixa.clientHeight;
    const r = caixa.getBoundingClientRect();
    const minimo = 8 - r.left;
    const maximo = document.documentElement.clientWidth - 8 - r.left;
    const folga = 18;
    const x = pos.x ?? caixaL / 2;
    const cabeEsq = x - largura - folga >= Math.max(0, minimo);
    const cabeDir = x + folga + largura <= Math.min(caixaL, maximo);
    let esquerda;
    if (cabeEsq) esquerda = x - largura - folga;
    else if (cabeDir) esquerda = x + folga;
    else if (x - largura - folga >= minimo) esquerda = x - largura - folga;
    else if (x + folga + largura <= maximo) esquerda = x + folga;
    else esquerda = Math.max(minimo, Math.min(x - largura / 2, maximo - largura));
    let topo = opcoes.topo ?? pos.topo ?? ((pos.y ?? 0) - altura / 2);
    topo = Math.max(0, Math.min(topo, Math.max(0, caixaA - altura)));
    flutuante.style.left = `${esquerda}px`;
    flutuante.style.top = `${topo}px`;
    requestAnimationFrame(() => flutuante && flutuante.classList.add('dica-visivel'));
  }

  function destruir() {
    flutuante?.remove();
    cartao?.remove();
    flutuante = cartao = null;
    aberta = false;
    document.removeEventListener('keydown', teclaEsc, true);
  }

  return { mostrar, esconder, destruir, get aberta() { return aberta; } };
}
