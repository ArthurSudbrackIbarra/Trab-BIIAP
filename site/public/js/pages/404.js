// IAês · página que não existe. Mostra o endereço pedido e, se um endereço do site for parecido,
// sugere esse. O GitHub Pages serve só o 404 da raiz, em inglês; para um endereço da versão em
// português, esta página passa para o 404 em português e devolve o endereço pedido à barra do navegador.
import { lingua, raiz, t, el } from '../lib/base.js';

const CHAVE = 'iaes-404';
const base = raiz.startsWith('/') ? raiz : '/';
const proprio = /\/404\.html$/.test(location.pathname);
let pedido = location.pathname + location.search + location.hash;

if (proprio) {
  pedido = '';
  try {
    pedido = sessionStorage.getItem(CHAVE) || '';
    sessionStorage.removeItem(CHAVE);
  } catch { /* sem armazenamento: a página só não mostra o endereço */ }
  if (pedido.startsWith('/') && !pedido.startsWith('//')) history.replaceState(history.state, '', pedido);
  else pedido = '';
}

const caminho = (endereco) => {
  const so = endereco.split(/[?#]/)[0];
  return so.startsWith(base) ? so.slice(base.length) : so.replace(/^\//, '');
};

if (lingua === 'en' && !proprio && caminho(pedido).startsWith('pt/')) {
  try { sessionStorage.setItem(CHAVE, pedido); } catch { /* segue sem o endereço */ }
  location.replace(`${base}pt/404.html`);
} else {
  mostrar();
}

function mostrar() {
  if (!pedido) return;
  let legivel = pedido;
  try { legivel = decodeURI(pedido); } catch { /* fica como veio */ }
  const caixa = document.querySelector('.nao-existe-pedido');
  caixa.querySelector('.nao-existe-endereco').textContent = legivel;
  caixa.hidden = false;

  // Sugestão: a ferramenta cujo endereço fica a até 3 letras de distância do pedido.
  const alvo = caminho(pedido).replace(/index\.html$/, '').replace(/\/+$/, '').toLowerCase();
  if (!alvo) return;
  let melhor = null;
  for (const link of document.querySelectorAll('.nao-existe-lista a')) {
    const rota = caminho(link.getAttribute('href')).replace(/\/+$/, '');
    if (!rota) continue;
    const d = distancia(alvo, rota);
    if (d <= 3 && (!melhor || d < melhor.d)) melhor = { d, link };
  }
  if (!melhor) return;
  const resto = pedido.slice(pedido.split(/[?#]/)[0].length);
  const [antes, depois = ''] = t('sugestao').split('{link}');
  const sugestao = document.querySelector('.nao-existe-sugestao');
  sugestao.replaceChildren(antes, el('a', { href: melhor.link.getAttribute('href') + resto, text: melhor.link.textContent }), depois);
  sugestao.hidden = false;
}

function distancia(a, b) {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const linha = [i];
    for (let j = 1; j <= b.length; j += 1) {
      linha[j] = Math.min(anterior[j] + 1, linha[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = linha;
  }
  return anterior[b.length];
}
