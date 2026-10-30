# Rótulos das palavras em excesso

Como em Kobak et al. (2025), cada palavra em excesso é de estilo ou de conteúdo. O Claude (Opus
5.5, via `claude -p`, com o prompt de `prompt.txt`) rotulou todas as palavras de
`words-<língua>.txt`, em ordem alfabética e sem saber o ano, e gravou os rótulos em
`claude-<língua>.csv`. Para medir o quanto dá para confiar neles, você rotula uma amostra aleatória
de 100 palavras por língua sem ver os rótulos do Claude.

## O que fazer

1. Abra `author-pt.csv` e `author-en.csv`. Não abra os arquivos `claude-*.csv` antes de terminar.
2. Na coluna `label`, escreva `s` (estilo), `c` (conteúdo) ou `a` (ambígua). Também valem
   `style`, `content` e `ambiguous`, ou `estilo`, `conteúdo` e `ambígua`.
3. A coluna `note` é opcional.
4. Rode `python3 -I scripts/excess.py report`. O relatório (`analysis/report.md`) mostra a
   concordância entre você e o Claude (kappa de Cohen) e usa o seu rótulo no lugar do dele nas
   palavras que você rotulou.

## Critério

- **Conteúdo:** a palavra nomeia algo de que um estudo trata: um tema, um objeto de estudo, um
  método ou uma tecnologia, uma doença, um organismo, um lugar, uma população ou uma área. Exemplos:
  covid, pandemia, vacina, solo, migrantes, algoritmo, chatgpt.
- **Estilo:** a palavra não diz nada sobre o assunto do estudo e caberia num resumo de qualquer área.
  Quase sempre é verbo, adjetivo, advérbio, conectivo ou substantivo genérico da escrita acadêmica.
  Exemplos: destaca, aprofunda, crucial, abrangente, ademais, delves, underscores, notably,
  insights.
- **Ambígua:** pode ser das duas classes, ou não dá para decidir sem contexto.

Julgue cada palavra sozinha. A lista não mostra em que ano a palavra cresceu, de propósito: assim o
rótulo não depende da hipótese.
