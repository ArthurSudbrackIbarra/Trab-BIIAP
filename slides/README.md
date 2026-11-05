# Slides do vídeo

Apresentação de apoio para o vídeo de até 5 minutos pedido na disciplina. É um arquivo HTML único,
`index.html`, com o visual do IAês: fundo papel, fonte Figtree e as cores do site para excesso,
português e inglês. Assim, no vídeo, os slides e o site parecem uma peça só. São 15 slides em
português: a capa, 10 de conteúdo, 3 que levam às demos no site e as referências.

## Abrir

Sirva a raiz do repositório, porque o deck usa as fontes de `site/public/fontes/`:

```bash
python3 -m http.server 8765
```

e abra `http://localhost:8765/slides/`. Também funciona com dois cliques em `index.html`, mas aí a
janela do apresentador pode ser bloqueada pelo navegador. O número do slide fica na URL (`#7` abre o
sétimo).

## Teclas

| Tecla | O que faz |
|---|---|
| Seta direita, espaço, Page Down | avança |
| Seta esquerda, Page Up | volta |
| P | abre a janela do apresentador |
| N | mostra a fala embaixo da tela, para ensaiar |
| F | tela cheia |
| E | edita o texto dos slides (salva só neste navegador) |
| ? | lista as teclas |

## A janela do apresentador

A tecla P abre uma segunda janela (permita pop-ups se o navegador pedir). Ela mostra:

- **Fale:** o que dizer naquele slide, palavra por palavra, em linguagem simples.
- **No site:** nos slides de demo, cada clique no IAês e em que frase da fala fazê-lo, com o link da
  página já pronta.
- **Entenda antes de gravar:** o que cada conceito quer dizer, os números por trás e o que responder
  se alguém perguntar. Não é para falar.
- Um relógio de 5 minutos, que começa no primeiro avanço e avisa quando um slide passa do tempo
  previsto, e o título do próximo slide.

As setas e o espaço nessa janela também passam os slides, então dá para deixá-la na frente e gravar
a outra. O botão "Roteiro inteiro" abre todas as falas numa página só, que dá para imprimir.

A fala prevista soma 4 minutos e 32 segundos, com cerca de 650 palavras. O resto fica para as trocas
entre os slides e o site. O tempo de cada slide está em `data-tempo` no `index.html`.

## As demos

Os slides 5, 11 e 13 têm fundo escuro e o título "Agora no site". O endereço no alto do quadro é um
link para a página do IAês já no estado certo:

| Slide | Página | Abre em |
|---|---|---|
| 5 | Palavras no tempo | `pt/palavras/?p=destacando.pt,highlighting.en` |
| 11 | Máquina do tempo | `pt/maquina-do-tempo/?resumo=en-018&modelo=chatgpt` |
| 13 | Raio-X do seu texto | `pt/raio-x/` (clique em "Exemplo de 2025") |

Os links apontam para o site local, `http://localhost:8000/`, que sobe com

```bash
python3 -I site/build.py
```

```bash
python3 -m http.server 8000 -d site/dist
```

Depois que o repositório ficar público e o GitHub Pages estiver ligado, escolha "GitHub Pages" na
janela do apresentador, e os links passam a abrir o site publicado.

## Gravar

1. Suba o site local e sirva o deck, como acima.
2. Abra o deck numa janela e o site em outra aba da mesma janela, para o vídeo pegar as duas.
3. Tecle F para tela cheia e P para a janela do apresentador. Deixe a do apresentador fora da área
   gravada.
4. Ensaie uma vez com o relógio. Se passar de 5 minutos, encurte primeiro a demo do Raio-X
   (slide 13) e depois a do Palavras no tempo (slide 5).

## De onde vêm os números

Os gráficos são desenhados no próprio HTML a partir de números escritos no script, cada bloco com a
sua fonte: `analysis/report.json` (palavras de estilo por ano e estimativa mínima),
`analysis/pairs/report.md` (H2), `analysis/crosslang/report.md` (H3),
`analysis/experiment/report.md` (experimento) e `site/public/dados/palavras/pt/d.json` (a curva de
*destacando*). Se a análise mudar, atualize esses números à mão.
