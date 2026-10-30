# Experimento da Máquina do tempo

Pegamos resumos publicados entre 2019 e 2021, antes do ChatGPT, e pedimos ao ChatGPT, ao Gemini e
ao Claude o que muita gente pede hoje: melhorar a escrita ou traduzir para o inglês. Depois
comparamos as palavras que cada modelo insere com as palavras que cresceram no SciELO.

## As três tarefas

| Pasta | Pedido | Resumos |
|---|---|---|
| `batches/polish-pt/` | melhorar a escrita em português | 80, em 8 lotes |
| `batches/polish-en/` | melhorar a escrita em inglês | 80, em 8 lotes |
| `batches/translate-pt-en/` | traduzir do português para o inglês | 80, em 8 lotes |

Cada lote é um arquivo `.txt` com as instruções e 10 resumos, sorteados de forma equilibrada entre
as 8 áreas do SciELO. Os três modelos recebem exatamente os mesmos arquivos. O pedido é o que um
pesquisador faria; a única exigência extra é que a resposta venha num bloco de código com formato
fixo, para o script conseguir ler. Os textos dos pedidos estão em `prompts/`.

Os lotes de tradução só aparecem quando a coleta da amostra do SciELO terminar, porque eles usam o
abstract em inglês escrito pelos próprios autores como comparação.

## ChatGPT e Gemini: a parte manual

Siga a ordem polish-pt, polish-en, translate-pt-en. Para cada lote:

1. Abra um chat novo. No ChatGPT, use o chat temporário, que não usa memória nem personalização.
   No Gemini, abra um chat novo e use sempre o mesmo modelo.
2. Cole o conteúdo inteiro do arquivo do lote e envie. Se preferir, anexe o arquivo e escreva
   "Siga as instruções do arquivo."
3. Quando a resposta terminar, clique no botão de copiar do bloco de código.
4. Cole num arquivo de texto dentro de `inbox/chatgpt/` ou `inbox/gemini/`. Pode ser um arquivo
   por lote ou um arquivo só, com uma resposta embaixo da outra. O nome do arquivo não importa.
5. A primeira linha de cada arquivo diz qual modelo aparecia na tela, por exemplo
   `# modelo: GPT-5.2`. Se o modelo mudar no meio do caminho (o ChatGPT gratuito troca de modelo
   quando o limite acaba), comece outro arquivo com o novo nome.

Para não estragar a comparação:

- Um chat novo para cada lote. Respostas anteriores no mesmo chat influenciam o estilo das
  próximas.
- Não peça ajustes e não edite as respostas.
- Se a resposta vier cortada, escreva "continue" e cole a continuação logo abaixo, no mesmo arquivo.
- Se o ChatGPT avisar que o modelo principal chegou ao limite, pare e retome mais tarde, para não
  misturar modelos dentro de uma tarefa.

## Claude: automático

Na raiz do projeto:

```bash
python3 -I scripts/experiment.py claude
```

O script manda cada lote pendente para o `claude -p`, pelo seu plano Max, sem chave de API. Ele
roda numa pasta vazia, com um prompt de sistema de uma linha e sem ferramentas, para que o
CLAUDE.md deste projeto não chegue às respostas. Cada lote leva cerca de um minuto.

## Conferir e repescar

```bash
python3 -I scripts/experiment.py ingest
```

O comando lê tudo o que está em `inbox/` e mostra uma tabela por modelo e tarefa. Para cada resumo,
ele confere se voltou, se está na língua certa, se não ficou igual ao original, se não encolheu nem
cresceu demais e se não traz comentários. Os resumos que faltaram ou voltaram com defeito viram
lotes de repescagem em `batches/retry/<modelo>/`, que você manda do mesmo jeito. As respostas
conferidas ficam em `results/<modelo>.jsonl`, e a tabela, em `results/status.md`.

## O que fica registrado

`prompts/` guarda os pedidos exatos, `items/` os resumos sorteados e de onde vieram, `inbox/` as
respostas como chegaram e `results/` as respostas lidas e conferidas. Tudo vai para o git, para o
experimento poder ser refeito e descrito no artigo.
