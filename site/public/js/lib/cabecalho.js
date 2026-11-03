// IAês · comportamento global de toda página: menu do celular, lista Explorar no tablet, troca do
// idioma do site levando o estado da tela, faixa de "sem internet" e o painel da palavra.
//
// "Tentar agora", na faixa de sem internet, dispara no window o evento 'iaes:tentar': as regiões
// que esperam a conexão (carregarEm e esperarConexao de base.js) tentam de novo na hora.
import { el, icone, t, pagina, avisoRapido, esperarConexao } from './base.js';

const cab = document.querySelector('.cab');

// Menu do celular, em tela cheia (site.css): o resto da página fica inerte e parado embaixo dele.
// Esc fecha e devolve o foco ao botão; passar para a largura de tablet também fecha.
const botaoMenu = cab?.querySelector('.cab-menu');
const menuCelular = document.getElementById('menu-celular');
let inertesMenu = [];
let rolagem = 0;
function abrirMenu() {
  botaoMenu.setAttribute('aria-expanded', 'true');
  menuCelular.hidden = false;
  rolagem = scrollY;
  scrollTo(0, 0);
  document.documentElement.classList.add('menu-aberto');
  inertesMenu = [...document.body.children].filter((n) => n !== cab && !n.inert && n.tagName !== 'SCRIPT');
  inertesMenu.forEach((n) => { n.inert = true; });
}
function fecharMenu() {
  botaoMenu.setAttribute('aria-expanded', 'false');
  menuCelular.hidden = true;
  document.documentElement.classList.remove('menu-aberto');
  inertesMenu.forEach((n) => { n.inert = false; });
  inertesMenu = [];
  scrollTo(0, rolagem);
}
const menuAberto = () => botaoMenu?.getAttribute('aria-expanded') === 'true';
botaoMenu?.addEventListener('click', () => (menuAberto() ? fecharMenu() : abrirMenu()));
matchMedia('(min-width: 600px)').addEventListener('change', (evento) => {
  if (evento.matches && menuAberto()) fecharMenu();
});

// Explorar, no tablet: abre uma lista com uma linha de descrição; Esc, clique fora e o foco saindo
// da lista fecham.
const explorar = cab?.querySelector('.cab-explorar');
const botaoExplorar = explorar?.querySelector(':scope > button');
const lista = document.getElementById('cab-lista');
function fecharLista() {
  botaoExplorar?.setAttribute('aria-expanded', 'false');
  if (lista) lista.hidden = true;
}
botaoExplorar?.addEventListener('click', (evento) => {
  evento.stopPropagation();
  const aberto = botaoExplorar.getAttribute('aria-expanded') === 'true';
  botaoExplorar.setAttribute('aria-expanded', String(!aberto));
  lista.hidden = aberto;
});
explorar?.addEventListener('focusout', (evento) => {
  if (lista && !lista.hidden && !explorar.contains(evento.relatedTarget)) fecharLista();
});
document.addEventListener('click', (evento) => {
  if (lista && !lista.hidden && !lista.contains(evento.target)) fecharLista();
});
document.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Escape') return;
  if (lista && !lista.hidden) {
    fecharLista();
    botaoExplorar.focus();
  } else if (menuAberto()) {
    fecharMenu();
    botaoMenu.focus();
  }
});

// PT | EN leva ao endereço equivalente com os mesmos parâmetros e o mesmo painel aberto.
for (const link of document.querySelectorAll('.cab-trocar')) {
  link.addEventListener('click', () => {
    const destino = new URL(link.getAttribute('href'), location.href);
    destino.search = location.search;
    destino.hash = location.hash;
    link.href = destino.href;
  });
}
for (const atual of document.querySelectorAll('.lingua-site a[aria-current="true"]')) {
  atual.addEventListener('click', (evento) => evento.preventDefault());
}

// Sem internet: faixa abaixo do cabeçalho, que some quando a conexão volta.
let faixa;
function tentarAgora() {
  window.dispatchEvent(new Event('iaes:tentar'));
  if (navigator.onLine) esconderOffline();
  else avisoRapido(t('offline_ainda'));
}
function mostrarOffline() {
  if (faixa) return;
  faixa = el('div', { class: 'offline', role: 'status' },
    el('div', { class: 'pagina' },
      icone('sem_rede', 'ic'),
      el('p', {}, el('strong', { text: t('offline_titulo') }), ' ', t('offline_texto')),
      el('button', { class: 'btn btn-p', type: 'button', on: { click: tentarAgora } }, t('offline_tentar'))));
  cab.after(faixa);
}
function esconderOffline() {
  faixa?.remove();
  faixa = null;
}
window.addEventListener('offline', mostrarOffline);
window.addEventListener('online', esconderOffline);
if (!navigator.onLine) mostrarOffline();

// O painel da palavra existe em toda tela com dados: carrega só quando alguém clica numa palavra
// ou quando o endereço já chega com #palavra=... Se o módulo não chegar (sem conexão), o próximo
// clique tenta de novo; o endereço com #palavra= tenta quando a conexão voltar (ou no "Tentar agora").
if (!['404', 'metodo'].includes(pagina)) {
  let painel;
  const carregarPainel = () => (painel ||= import('./painel.js').catch((erro) => {
    painel = null;
    throw erro;
  }));
  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-palavra]');
    if (!alvo) return;
    evento.preventDefault();
    carregarPainel().then((m) => m.abrirPainel(alvo.dataset.palavra, alvo), () => avisoRapido(t('painel_sem_rede')));
  });
  const doEndereco = () => {
    if (!/^#palavra=/.test(location.hash)) return;
    carregarPainel().then((m) => m.doEndereco(), () => esperarConexao(doEndereco));
  };
  window.addEventListener('hashchange', doEndereco);
  doEndereco();
}
