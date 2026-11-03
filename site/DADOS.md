# Dados do site

Contrato entre `scripts/build_site_data.py` (que escreve) e as telas (que leem). Tudo fica em
`site/public/dados/`, é JSON compacto em UTF-8 e vai para o git. Nenhum número do site é escrito à
mão: ou vem destes arquivos, ou é calculado no navegador a partir deles.

Convenções:

- Língua dos resumos: `pt` ou `en`. Anos: 2015 a 2026, sempre na ordem; arrays "por ano" têm 12
  posições (índice 0 = 2015). 2026 é parcial (`meta.json`).
- Parcelas são frações de 0 a 1 (0,61% = `0.0061`), com 7 casas. `null` quando não há dado.
- Áreas pelo slug: `agrarias`, `biologicas`, `saude`, `exatas`, `humanas`, `sociais`, `engenharias`,
  `linguistica` (o nome vem de `t('area_<slug>')`). `todas` = sem filtro.
- Classe de uma palavra: `estilo`, `conteudo`, `sem-classe` (rótulo "ambiguous" da análise) ou
  `null` (a palavra nunca foi rotulada: não é palavra com excesso). Rótulo do autor vale sobre o do
  Claude.
- Chave de uma palavra na interface: `palavra.lingua` (`crucial.pt`).
- Revista: o título do SciELO. Link de um artigo: `https://doi.org/<doi>`.

## Como cada número é medido

**Recorte de cada ano (o mesmo da análise).** Para o ano Y, entram as revistas com pelo menos 5
resumos utilizáveis na língua em 2021, em 2022 e em Y (o painel balanceado de
`scripts/excess.py`); para 2021 e 2022, as revistas com 5 ou mais nos dois anos. A parcela de
resumos com a palavra é padronizada pelos decis de tamanho dos resumos de 2021-22 desse recorte e
suavizada como em Kobak et al., `(a+1)/(b+1)`. Com isso, `obs` e `esp` de 2023 a 2026 são
exatamente o `p` e o `q` de `analysis/excess-fixed/excess-words.csv`, para qualquer palavra.

**Esperado.** `esp` de Y ≥ 2023 = parcela de 2022 + (Y − 2022) × max(parcela 2022 − parcela 2021,
0), as duas medidas no recorte de Y. Em 2021 e 2022, `esp` = `obs` (a linha tracejada começa nos
pontos observados). Razão = obs / esp; diferença = obs − esp (em pontos percentuais na tela). O
esperado de cada ano usa as revistas daquele ano, por isso a tela o desenha como um degrau por ano,
e não como uma reta só.

**Palavras-marcadoras.** As palavras de estilo com excesso em 2024, 2025 ou 2026, em qualquer das
duas bases (o conjunto do teste H3 e do experimento: 349 em português, 437 em inglês), cada uma
com a maior razão que teve.

**Nível de realce.** Sai da maior razão da marcadora de 2024 a 2026, arredondada a duas casas: 1
abaixo de 1,5; 2 abaixo de 2,5; 3 abaixo de 5; 4 com 5 ou mais. O nível é o mesmo em
`marcadoras.json` e no campo `nivel` de `palavras/<lingua>/<inicial>.json`, e a tela usa um desses
dois em vez de recalcular (o painel, por exemplo, não usa a razão de 2025). Palavra que não é
marcadora não tem nível e vai só em negrito (`.w`).

**Marcas num texto** (Raio-X, PT × EN, Jogo, histogramas). O navegador e o Python contam igual:

- palavras do texto = ocorrências de `/[\p{L}]+(?:['-][\p{L}]+)*/gu` (todas as palavras);
- marcas = ocorrências de `/[a-zà-öø-ÿ]{4,}/g` em `texto.normalize("NFC").toLowerCase()` que são
  chave de `marcadoras.json` na língua (a regra de palavras da análise: quatro letras ou mais; hífen
  e número separam palavras). Confira com `Object.hasOwn` ou com um `Set`: `in` acharia
  `constructor` e outras propriedades herdadas;
- `por100` = 100 × marcas / palavras, arredondado para cima a partir da metade, com duas casas:
  `Math.floor((20000 * marcas + palavras) / (2 * palavras)) / 100` (0 sem palavras). Com essa conta
  em inteiros, o navegador chega ao mesmo número que os arquivos.

Em Python, a regra é `score()` de `scripts/site_data/pares.py`. Ela foi conferida contra os mesmos
regex rodando no Node nos 18.704 resumos de `pares/` e do jogo: palavras, marcas e `por100` iguais
em todos.

## Arquivos

### `meta.json`

```json
{"parcial": {"ano": 2026, "mes": 10}, "gerado": "2026-10-31"}
```

`mes` é o último mês de 2026 com pelo menos 100 resumos. O `build.py` usa para escrever "2026 vai
até outubro" no rodapé.

### `palavras/<lingua>/indice.json`: busca

```json
{"anos": [2015, ..., 2026],
 "palavras": [["como", 4442, null, null], ["crucial", 610, "estilo", 14], ...]}
```

Uma linha por palavra com pelo menos 20 resumos somando os 12 anos, em ordem decrescente de
resumos em 2025 (empate em ordem alfabética): `[palavra, resumos em 2025, classe, posição no
ranking de excesso de 2025 ou null]`. Também entram, com 1 resumo ou mais, as palavras para as
quais outras telas levam (as de alguma tabela de excesso, as marcadoras e as do experimento), mesmo
abaixo de 20: `standalone`, por exemplo, tem excesso em 2025 com 10 resumos. A posição é a ordem
pela diferença entre as palavras com excesso de 2025 (base fixa). Uma
palavra fora do índice é "ausente" ("Nenhum resumo usa xyz"); uma palavra sem classe e sem nenhum
ano com 10 resumos (`MINIMO_RESUMOS`) é "rara"; uma palavra com classe, ou com 10 a 19 resumos no
seu melhor ano, mantém a linha, com a nota "poucos resumos".

### `palavras/<lingua>/<inicial>.json`: séries, contexto e experimento

`<inicial>` é a primeira letra sem acento (`a` a `z`; `_` para o resto), como `inicial()` de
`base.js`. Mesmas palavras do índice. Os 27 arquivos sempre existem (`{}` quando nenhuma palavra
começa pela letra).

```json
{"crucial": {
   "n":   [120, 131, ...],          // resumos com a palavra, por ano (no recorte do ano)
   "obs": [0.0081, ...],            // parcela observada, por ano
   "esp": [0.0082, 0.0086, ...],    // 2021 a 2026 (6 posições): esperado
   "base": 0.0036,                  // parcela de 2021-22 no recorte de 2025
   "par": "crucial.en",             // marcadora da outra língua (teste H3), ou null
   "nivel": 4,                      // nível de realce, só nas marcadoras
   "contexto": {"2019": [{"antes": "O controle da umidade é ", "palavra": "crucial",
                          "depois": " na secagem dos grãos.", "revista": "...", "ano": 2019,
                          "doi": "10.1590/..."}],
                "2025": [...]},     // até 3 frases por ano; só para as palavras que têm
   "experimento": {"chatgpt": {"polish-pt": 9}, "gemini": {...}, "claude": {...}}
}}
```

- `contexto` existe para as palavras de alguma tabela de excesso
  (`analysis/excess-*/excess-words.csv`), as marcadoras, as palavras de `padrao.json` e as do
  experimento, sempre com as chaves `"2019"` e `"2025"` (lista vazia quando nenhuma frase serve).
  Frases de resumos utilizáveis da língua de 2019 e de 2025, no máximo uma por revista, sorteadas
  de forma fixa (hash da palavra e do DOI), com 40 a 280 caracteres, começando por maiúscula e
  terminando em ponto; o rótulo de seção de resumo estruturado ("Objetivo:") sai da frase.
  `antes + palavra + depois` é a frase inteira e `palavra` é a primeira ocorrência, como aparece
  no texto. É texto do resumo: entra na página como texto (`textContent`), nunca como HTML.
- `experimento`: quantos textos a mais (ou a menos) contêm a palavra depois da reescrita, por
  modelo e tarefa (o `shift` de `analysis/experiment/report.json`, que só existe quando a palavra
  aparece em pelo menos 4 dos 80 textos antes ou depois). Ausente quando não há dado.
- `base`: a média das parcelas de 2021 e 2022 no recorte de 2025, o nível de onde partem o
  esperado e a razão de 2025 (é a "parcela em 2021-22" do Mapa). `obs` de 2021 e 2022 vem do
  recorte desses dois anos, com outro conjunto de revistas, e pode ser bem diferente:
  `effectively` tem 0,96% em `obs` de 2021-22, 0,63% em `base` e 0,59% de esperado em 2025. Ao
  lado do esperado ou da razão de 2025, use `base`. `null` quando não há recorte de 2025.
- `nivel`: o nível de realce da marcadora, de 1 a 4 (ver "Nível de realce"). Só existe nas
  marcadoras.
- `par`: a marcadora da outra língua para a qual aponta a tradução que o Claude deu à palavra
  no teste H3. É a regra única de pares do site, usada também em `mapa/pares.json`, e sai de
  `counterpart()` em `scripts/site_data/comum.py`. Um termo de uma tradução aponta para as
  marcadoras da outra língua que têm aquela grafia ou aquela forma de dicionário, como em
  `scripts/crosslang.py compare`. As traduções são lidas na ordem do Claude (a primeira é o
  sentido principal), e vale o primeiro termo que aponta para alguma marcadora; entre as
  marcadoras desse termo, fica a que está em mais resumos em 2025 (empate em ordem alfabética).
  Assim `aprofunda` ("deepen, explore, delve into") dá `explores.en`, `abrangente`
  ("comprehensive, broad, wide-ranging") dá `comprehensive.en`, e `destaca` e `destacando` dão
  `highlight.en`. A ligação pode vir de uma só palavra de um sentido com várias: `effectively`
  ("efetivamente, eficazmente, na prática") dá `práticas.pt`. Só para marcadoras e seus controles,
  e só com a palavra no índice da outra língua; `null` nos outros casos, inclusive quando a
  tradução não aponta para marcadora nenhuma (o caso das marcadoras só do português).

### `palavras/<lingua>/areas/<inicial>.json`: séries por área

```json
{"crucial": {"saude": {"n": [...], "obs": [...], "esp": [...], "base": 0.0029},
             "engenharias": {...}}}
```

O mesmo cálculo com o recorte de cada ano restrito às revistas da área (`base` vem do recorte de
2025 da área). Só entram área e palavra
com pelo menos 20 resumos somando os anos (uma palavra sem área nenhuma fica fora do arquivo); sem
a área, a tela diz que há poucos resumos para medir. Ano sem revista da área no recorte tem `null`
nas três séries. Algumas áreas têm poucas revistas no painel de uma língua (em português, Ciências
Biológicas e Ciências Exatas e da Terra têm poucas centenas de palavras).

### `palavras/padrao.json`

```json
{"padrao": ["underscore.en", "examines.en", "crucial.pt"],
 "sugestoes": ["insights.en", "incluíram.pt", ...]}
```

As três palavras com que Palavras no tempo abre e seis sugestões. Regra: as palavras com excesso
em 2025 (base fixa) de classe estilo, com pelo menos 100 resumos em 2025 em inglês e 50 em
português (para a linha ficar legível), em ordem decrescente de razão, pulando a palavra cuja
forma de dicionário (`analysis/crosslang/lemmas-<lingua>.csv`) já entrou (underscore e
underscores não abrem juntas). `padrao` = as duas primeiras do inglês e a primeira do português;
`sugestoes` = as três seguintes de cada língua, alternando inglês e português.

### `mapa/<lingua>-<area>.json`: Mapa de palavras

`<area>` é um slug ou `todas`.

```json
{"ano": 2025, "resumos": 8144, "revistas": 143,
 "pontos": [["underscore", 0.0005545, 20.695, 0.0107717, 113, "estilo", 1, 0.0113186], ...]}
```

Cada ponto: `[palavra, parcela em 2021-22, razão em 2025, diferença em 2025, resumos em 2025,
classe, excesso, parcela em 2025]`, para toda palavra com pelo menos 10 resumos em 2025 no recorte
(as palavras que a análise testa), em ordem decrescente de razão. Tudo é medido no recorte de 2025:
a parcela em 2021-22 é a média das parcelas de 2021 e 2022 desse recorte, razão e diferença são
`obs / esp` e `obs − esp`, e a razão vem com 3 casas. `excesso` = 1 se a palavra é uma das palavras
com excesso de 2025 da análise (base fixa, espalhada por revistas). Nos arquivos de área, as medidas
são da área e `excesso` continua sendo o do conjunto. O corte do gráfico é o limiar de Kobak et al.:
razão `2^(−log10(p)/4)`, com p a parcela em 2025 (o oitavo campo, que existe para isso). `resumos`
e `revistas` são os resumos de 2025 e as revistas do recorte. Uma área sem revista no recorte tem
`resumos` 0 e `pontos` vazio; em português, algumas áreas têm poucos resumos em 2025 (Exatas e
Biológicas ficam abaixo de 20) e quase nenhum ponto, e a tela deve dizer isso.

### `mapa/pares.json`

```json
{"pt": {"aprofunda": "delves", ...}, "en": {"delves": "aprofunda", ...}}
```

Para o modo lado a lado: a marcadora da outra língua que traduz cada marcadora, pela mesma regra
do `par` das palavras (ver acima), e por isso o Mapa e o painel da palavra mostram sempre o mesmo
par (`aprofunda` e `explores`, `abrangente` e `comprehensive`). Entra toda marcadora cuja tradução
acerta alguma marcadora da outra língua no teste H3: as chaves são as palavras de `pairs` em
`analysis/crosslang/report.json`. Algumas chaves e valores não aparecem no mapa de 2025, por terem
menos de 10 resumos naquele ano (`articula` fica com `articulating`, que está fora do mapa em
inglês).

### `areas.json`: Áreas do conhecimento

```json
{"anos": [2015, ..., 2026], "areas": ["agrarias", ...],
 "indice":  {"pt": {"saude": [0.9177, ...]}, "en": {...}},
 "parcela": {"pt": {"saude": [0.3548819, ...]}, "en": {...}},
 "resumos": {"pt": {"saude": [1683, ...]}, "en": {...}},
 "minimo":  {"pt": {"saude": [null, ..., 0.1255141, 0.1848838]}, "en": {...}},
 "minimo_ep": {"pt": {...}, "en": {...}},
 "top": {"pt": {"saude": {"2023": [...], "2024": [...], "2025": [["crucial", 8.98], ...],
                          "2026": [...]}}, "en": {...}},
 "todas": {"indice": {"pt": [...], "en": [...]}, "parcela": {...}, "resumos": {...},
           "minimo": {...}, "minimo_ep": {...}},
 "marcadoras": {"pt": 75, "en": 137},
 "minimo_sem_marcadoras": {"pt": [2023, 2024], "en": []}}
```

- `parcela`: parcela dos resumos com ao menos uma palavra-marcadora, no recorte do ano restrito à
  área, padronizada pelos decis de tamanho de 2021-22 desse recorte como em `excess.marker_gap`
  (sem a suavização das palavras). As marcadoras do índice são as de 2025 escolhidas por validação
  cruzada (`crossfit_markers` de `analysis/report.json`): cada resumo é conferido com o conjunto
  escolhido na outra metade do corpus, como na estimativa mínima. `indice` = parcela do ano /
  média da parcela de 2021 e 2022 no mesmo recorte (1 = igual a 2021-22), com 4 casas; em 2021 e
  2022 o recorte é o mesmo, e os dois índices têm média 1.
- `resumos`: resumos do ano no recorte da área (o mesmo número que o Mapa e as séries usam). Sem
  revista da área no recorte, `resumos` é 0 e `parcela` e `indice` são `null`.
- `minimo`: estimativa mínima da parcela de resumos que passaram por um LLM (validação cruzada),
  de `analysis/report.json` (`areas`, e `bound` em `todas`), só de 2023 em diante e só com 200
  resumos ou mais; `minimo_ep` é o erro padrão. Pode ser negativa. É `null` também, em toda área e
  em `todas`, nos anos de `minimo_sem_marcadoras`.
- `minimo_sem_marcadoras`: por língua, os anos em que nenhuma das duas metades do corpus achou
  mais de uma marcadora. Com uma palavra só, ou nenhuma, a conta mede aquela palavra e não o uso de
  LLM (em português, 2023 e 2024, com `autores` e `destacando`), então não há estimativa. Nesses
  anos a célula não tem "poucos resumos": a tela diz que não há estimativa.
- `todas`: as mesmas medidas com todas as revistas do recorte, como arrays por ano.
- `top`: para cada ano de 2023 a 2026 (lista vazia quando não há), até 5 palavras com excesso
  naquele ano (base fixa, de qualquer classe) com maior razão dentro da área, `[palavra, razão]`
  com 2 casas; só entram palavras com razão acima de 1 e em pelo menos 5 resumos da área no ano.
  A classe vem do índice de palavras, se a tela quiser mostrar.
- `marcadoras`: quantas palavras diferentes há nos dois conjuntos de 2025 (um resumo é conferido
  só com o conjunto da outra metade).
- Células com menos de 100 resumos aparecem hachuradas.

### `pares/<ano>.json` e `pares/textos-<ano>.json`: PT × EN

```json
{"ano": 2025,
 "artigos": [{"id": "S0100-...", "doi": "10.1590/...", "titulo": "...", "titulo_en": "...",
              "revista": "...", "areas": ["saude"], "lingua": "pt",
              "pt": {"palavras": 182, "marcas": 4, "por100": 2.2},
              "en": {"palavras": 165, "marcas": 7, "por100": 4.24}}]}
```

```json
{"S0100-...": {"pt": "Texto do resumo...", "en": "Abstract text..."}}
```

Os artigos da amostra do ArticleMeta com resumo utilizável nas duas línguas
(`data/interim/pairs.jsonl.gz`, 9.312 artigos, de 695 a 865 por ano), em ordem de `id`. `id` é o
código SciELO (PID). `lingua` é a língua em que o artigo foi escrito (`pt`, `en` e, em poucos, `es`,
`fr`, `it` ou `de`). `titulo` é o título nessa língua (sem ele, o português ou o inglês) e
`titulo_en`, o título em inglês, `null` quando o artigo não tem. `pt` e `en` são a contagem de
"Marcas num texto" de cada resumo. Os textos ficam num arquivo à parte, baixado só quando alguém
abre um par.

Os títulos passam por `clean_title()` de `scripts/site_data/comum.py`, a mesma limpeza dos
títulos do jogo, do Raio-X e da Máquina do tempo. Sai a marcação HTML e sai a marca de nota de
rodapé colada no fim ("Brasil1", "Benth.1", "hospital*", "1999 TO 20191"). Um título em
maiúsculas vira caixa de frase. Conta como tal o que tem três quartos das palavras em maiúsculas,
ou três palavras longas seguidas, como o título principal antes de um subtítulo ou de um nome de
espécie em minúsculas ("PROBIOTIC POTENTIAL OF Bacillus cereus AGAINST Vibrio spp."). A letra
acentuada que um conversor deixou minúscula no meio de uma palavra em maiúsculas (ESPAçADOR) não
impede. Palavras com minúscula ficam como estão, e as que o resumo na mesma língua sempre escreve
com maiúscula no meio da frase voltam com ela (Brasil, SUS, Maceió). Sem resumo naquela língua (um
título em espanhol, por exemplo), o nome próprio fica em minúscula.

Tamanho: cada `pares/<ano>.json` tem de 320 a 385 KB; cada `textos-<ano>.json`, de 1,8 a 2,1 MB.

### `pares/linha.json`

```json
{"anos": [...], "artigos": [865, ...], "en_maior": [0.31, ...], "pt_maior": [0.28, ...],
 "media_pt": [1.2, ...], "media_en": [1.5, ...],
 "areas": {"saude": {"artigos": [...], "en_maior": [...], "pt_maior": [...],
                     "media_pt": [...], "media_en": [...]}, ...}}
```

Por ano: artigos, parcela em que o `por100` do inglês é maior que o do português (e o contrário; a
diferença para 1 são os empates), e as médias de `por100` (três casas). Tudo sai dos `por100` de
`pares/<ano>.json`, então a tela pode refazer a conta com o arquivo do ano. `areas` repete as
mesmas séries só com os artigos de cada área (um artigo de revista com duas áreas entra nas duas).

As duas listas de marcadoras são diferentes (349 palavras em português, 437 em inglês), então o
nível de `por100` de uma língua não se compara com o da outra; o que se compara é como cada uma
muda de um ano para outro. O teste H2 do artigo (`analysis/pairs/report.md`) usa outra medida: a
parcela de resumos com ao menos uma marcadora dos conjuntos da estimativa mínima.

### `experimento/<tarefa>.json`: Máquina do tempo

`<tarefa>`: `polish-pt`, `polish-en` ou `translate-pt-en`. Cada arquivo tem 430 a 500 KB.

```json
{"tarefa": "polish-en", "lingua": "en", "lingua_original": "en",
 "modelos": [{"id": "chatgpt", "nome": "ChatGPT", "versao": "GPT-6", "id_modelo": "GPT-6",
              "plano": {"pt": "conta gratuita, chat temporário", "en": "free account, temporary chat"},
              "datas": ["2026-10-31"], "prompt": "Improve the writing of ...",
              "como": {"pt": "O autor colou cada lote ...", "en": "The author pasted ..."}}],
 "itens": [{"id": "en-001", "titulo": "Association between ...", "doi": "10.1590/...",
            "revista": "...", "area": "saude", "ano": 2021, "original": "...", "autores": null,
            "saidas": {"chatgpt": "...", "gemini": "...", "claude": "..."}}],
 "insere": {"chatgpt": [["findings", 21, 1], ["these", 21, 1], ...]},
 "resumo": {"chatgpt": {"textos": 80, "antes": 8.1375, "depois": 13.25, "mudanca": 5.1125,
                        "ic": [4.5375, 5.6875], "inseridas": 92, "inseridas_marcadoras": 40,
                        "removidas": 46, "removidas_marcadoras": 1, "p": 4.16e-08}},
 "marcadoras": ["achieved", ...]}
```

- `lingua`: língua das saídas e das marcadoras; `lingua_original`: língua dos resumos enviados
  (`pt` na tradução).
- `modelos`: sempre na ordem chatgpt, gemini, claude. `id_modelo` é o modelo anotado no cabeçalho
  das respostas (`experiment/inbox/<modelo>/`), sem a nota entre parênteses, e `versao` é o nome
  que as telas mostram: o mesmo, salvo quando o cabeçalho traz o identificador da API, que vira o
  nome do produto (`claude-sonnet-5-5` vira "Claude Sonnet 5.5"). `datas` são os dias das rodadas.
  `inicio.json` repete `versao` e `datas` para o Método. `plano` (linha
  "Acesso" de "Como pedimos") e `como` (linha "Configurações") vêm nas duas línguas do site:
  `m.plano[lingua]`. `prompt` é o pedido exato do primeiro lote da tarefa, igual para os três
  modelos; nos outros lotes muda só o nome do lote e o identificador do exemplo.
- `itens`: os 80 resumos, publicados de 2019 a 2021, na ordem dos identificadores. `original` é o
  texto exatamente como foi enviado (com títulos de seção como "Objective:"). `titulo` é o título
  do Crossref nas tarefas de melhorar e o título na língua do artigo (ArticleMeta) na tradução,
  limpo como os títulos de `pares/` (com o resumo enviado para devolver as maiúsculas dos nomes);
  um título com codificação quebrada vira `null` (mostre revista e ano). `saidas.<modelo>` é `null`
  quando o modelo não respondeu; hoje os três
  responderam aos 240 pedidos.
- `autores`: na tarefa de traduzir, o abstract em inglês que os autores publicaram (a referência
  humana); `null` nas outras.
- `insere`: as palavras que cada modelo mais insere, `[palavra, textos a mais, marcadora 0/1]`: a
  lista `added` de `analysis/experiment/report.json`, na mesma ordem, cortada em 15. Só entra
  palavra que aparece em pelo menos 4 dos 80 textos a mais depois da reescrita (na tradução,
  contra a tradução dos autores), o limiar da análise. Por isso o Claude tem 13 palavras em
  polish-en e 12 em translate-pt-en: a tela mostra o tamanho da lista, não "15".
- `resumo`: de `analysis/experiment/report.json`. `antes` e `depois` são marcadoras distintas por
  texto (na tradução, `antes` é a tradução dos autores); `mudanca` e `ic`, a média e o intervalo
  de bootstrap de 95%; `inseridas` e `removidas`, quantas palavras o modelo insere e remove pelo
  limiar acima, e quantas delas são marcadoras; `p`, o teste de Fisher unilateral (marcadoras mais
  comuns entre as inseridas que entre as removidas).
- `marcadoras`: a lista de marcadoras da língua das saídas (as mesmas de `marcadoras.json`), para
  realçar no texto as palavras inseridas que são marcadoras sem baixar outro arquivo. A análise
  ignora comandos LaTeX (`\text`, `\mathrm`): o Gemini escreveu notação química em LaTeX em
  alguns textos.

### `experimento/prova.json`: a prova cruzada

```json
{"pt": [["examina", 2.6573, 0.014103, 1.333, {"chatgpt": 0, "gemini": 3, "claude": 1}, 1], ...],
 "en": [...]}
```

Cada ponto: `[palavra, razão em 2025, diferença em 2025, inserção média, inserção por modelo,
marcadora 0/1]`.

- Razão e diferença: `obs / esp` e `obs − esp` no recorte de 2025, como no resto do site (para as
  palavras com excesso em 2025, iguais a `analysis/excess-fixed/excess-words.csv`).
- Inserção: quantos dos 80 textos da tarefa `polish-<lingua>` têm a palavra a mais depois de o
  modelo melhorar a escrita; pode ser zero ou negativa (o modelo tira a palavra), então o eixo Y
  não pode ser logarítmico. A média é dos três modelos. O valor é recalculado dos textos com a
  regra da análise, e por isso existe para os três modelos mesmo onde o `shift` da análise falta.
- Entram as palavras que a análise mede na tarefa (em pelo menos 4 textos antes ou depois, para
  algum modelo) e que têm pelo menos 10 resumos em 2025 no recorte: cerca de 550 em português e
  620 em inglês. `marcadora` = 1 se a palavra é marcadora da língua.

### `marcadoras.json`: Raio-X

```json
{"pt": {"aprofunda": [11.96, 4, "estilo"], ...}, "en": {...},
 "hist": {"pt": {"n2019": 812, "n2025": 706,
                 "ordenados": {"2019": [0.0, 0.41, ...], "2025": [...]}},
          "en": {...}},
 "exemplos": {"pt": {"2019": {"texto": "...", "titulo": "...", "revista": "...", "ano": 2019,
                              "doi": "...", "areas": ["sociais"], "por100": 4.38},
                     "2025": {...}}, "en": {...}},
 "parecidos": {"pt": [{"por100": 19.54, "texto": "...", "titulo": "...", "revista": "...",
                       "ano": 2019, "doi": "...", "areas": ["humanas"]}], "en": [...]}}
```

- Marcadora: `[razão, nível de realce 1 a 4, classe]`, em ordem alfabética. A razão tem duas casas;
  o nível segue "Nível de realce" e é o mesmo do campo `nivel` de `palavras/`. As chaves de `pt` e
  `en` são a lista que conta marcas em todo o site.
- `hist`: `ordenados` traz o `por100` de cada resumo da amostra PT × EN de 2019 e de 2025, em
  ordem crescente, e `n2019` e `n2025` são os totais. A tela monta o histograma com eles, nas
  faixas que quiser, e diz exatamente que parcela dos resumos marca tanto quanto o texto colado ou
  mais.
- `exemplos`: um resumo real de 2019 com `por100` típico (o mais perto da mediana de 2019) e um de
  2025 com `por100` alto (o mais perto do percentil 90 de 2025), ambos com 120 a 250 palavras e sem
  tema que date o texto (COVID-19, pandemia, ChatGPT, IA generativa). `titulo` é o título na língua
  do resumo.
- `parecidos`: os 30 resumos de 2019 a 2021 com mais marcas a cada 100 palavras, do maior para o
  menor, entre os que têm 80 palavras ou mais (para que um texto curto com duas marcas não encabece
  a lista). Servem para mostrar que um texto anterior ao ChatGPT pode ter tanta marca quanto o seu:
  a tela escolhe os de `por100` igual ou maior que o do texto colado.

Tamanho: 112 KB.

### `jogo.json`: Antes ou depois?

```json
{"limiar": {"pt": 6.165, "en": 4.3},
 "regra": {"pt": {"acertos": 20, "total": 40}, "en": {"acertos": 26, "total": 40}},
 "resumos": [{"id": "S0080-...", "lingua": "en", "texto": "...", "ano": 2021, "periodo": "antes",
              "titulo": "...", "revista": "...", "doi": "...", "areas": ["saude"],
              "marcas": ["associated", "indicated", "associated"], "palavras": 170,
              "por100": 1.76}]}
```

- Por língua, 20 resumos de 2019 a 2021 (`antes`) e 20 de 2024 e 2025 (`depois`), sorteados com
  semente fixa na amostra PT × EN, cada um com 80 a 260 palavras. Fica de fora o artigo em que algum
  dos dois resumos ou dos títulos fala de COVID, coronavírus, SARS-CoV, pandemia, lockdown,
  isolamento ou distanciamento social, ChatGPT, GPT, LLM, modelo de linguagem ou IA generativa, ou
  cita um ano de 2020 em diante. Nenhum artigo aparece nas duas línguas.
- `id` é o código SciELO do artigo. `titulo` é o título na língua do resumo. O DOI e o `id` às vezes
  trazem o ano, então só aparecem na revelação.
- `marcas`: as marcadoras do texto, uma por ocorrência, na ordem de leitura (`marcas.length` é a
  contagem de "Marcas num texto").
- `limiar`: a regra "só conta marcadoras" diz "depois" quando `por100` é maior que o limiar, a
  mediana de `por100` entre os 40 resumos do jogo daquela língua (três casas).
- `regra`: quantos dos 40 resumos de cada língua essa regra acerta no conjunto inteiro, para
  informação (a tela calcula a regra na rodada que a pessoa jogou).
- A ordem de `resumos` é embaralhada; a tela sorteia as rodadas.

Tamanho: 127 KB.

### `inicio.json`: Início e números do Método

```json
{"destaques": ["underscore.en", "crucial.pt"],
 "series": {"underscore.en": {"n": [...], "obs": [...], "esp": [...], "base": 0.0005545},
            "crucial.pt": {...}},
 "minimo": {"en": {"2023": {...},
                   "2024": {"gap": 0.1119289, "ep": 0.0078724, "placebo": -0.0175714,
                            "marcadoras": [23, 16]}, ...},
            "pt": {...}},
 "estilo": {"en": {"2018": 3, ..., "2026": 150}, "pt": {...}},
 "palavras_excesso": {"en": {"2023": 15, "2024": 59, "2025": 300, "2026": 340}, "pt": {...}},
 "resumos": {"total": 204937, "pt": {"2015": 8296, ...}, "en": {...}, "es": {...}},
 "pares": {"artigos": 9312, "en_sobe": 0.1754, "pt_sobe": 0.1488, "dif": 0.0266,
           "ic": [-0.0179, 0.0736], "p": 0.1245, "placebo": 0.0238, "placebo_ic": [-0.0155, 0.0627],
           "em2024": {"en_sobe": 0.0864, "pt_sobe": 0.018, "dif": 0.0684, "ic": [0.0078, 0.1277],
                      "p": 0.013}},
 "experimento": {"textos": 80, "modelos": 3, "tarefas": 3,
                 "versoes": [{"id": "chatgpt", "nome": "ChatGPT", "versao": "GPT-6",
                              "datas": ["2026-10-31"]}, ...],
                 "pedido": {"pt": "Melhore a escrita dos resumos científicos abaixo ...",
                            "en": "Improve the writing of the scientific abstracts below ..."}},
 "amostras": {"experimento": {"pt": {"tarefa": "polish-pt", "id": "pt-038", "modelo": "chatgpt",
                                     "segmentos": [
                                       ["=", "Dentre"],
                                       ["-", "esses recursos, seguramente, o mais importante foi"],
                                       ["+", "eles,"], ["+m", "destaca-se"],
                                       ["=", "a adoção dos receptores digitais."]]},
                              "en": {...}},
              "raiox": {"pt": {"doi": "10.1590/...", "revista": "Ciência & Saúde Coletiva",
                               "ano": 2025,
                               "segmentos": [["A Medicina Nuclear ", null], ["desempenha", 3],
                                             [" um importante ", null], ...]},
                        "en": {...}}},
 "metodo": {"revistas": {"colecao": 427, "no_crossref": 358, "com_resumo": 357},
            "filtros": {"ok": 204937, "length": 2861, "glued": 2829, "language": 2187,
                        "duplicate": 1340, "notice": 98},
            "marcadoras": {"pt": 349, "en": 437}, "rotuladas": {"pt": 731, "en": 951},
            "concordancia": {"pt": {"amostra": 100, "acordo": 0.72, "kappa": 0.4959,
                                    "decididas": 78, "acordo_decididas": 0.9231}, "en": {...}},
            "amostra_pares": {"por_ano": 1300, "anos": 12, "sorteados": 15600,
                              "utilizaveis": 9312},
            "tamanho": {"pt": {"2015": 78.5, ..., "2026": 92.7}, "en": {...}},
            "h3": {"pt": {"marcadoras": 349, "traduzem": 252, "controles": 349,
                          "controles_traduzem": 154, "p": 3.2e-14}, "en": {...}},
            "experimento_amostra": {"polish-pt": {"revistas": 50, "max_por_revista": 7,
                                                  "areas": 8, "por_area": 10}, ...}}}
```

- `destaques`: uma palavra em inglês e uma em português, nessa ordem, para o gráfico de abertura:
  a primeira de cada língua em `palavras/padrao.json`. Sem esse arquivo, o script escolhe entre as
  palavras de estilo com excesso em 2025 (base fixa) e 30 resumos ou mais naquele ano a de maior
  razão cuja linha se lê de relance (todo ano antes de 2023 abaixo da metade de 2025, alta a cada
  ano de 2022 a 2025, e 2026 não abaixo de 2024). Por isso `inicio` roda depois de `palavras`.
  `series` tem o formato das séries de palavras (`n` e `obs` com 12 anos, `esp` de 2021 a 2026, e
  `base`).
- `minimo`: a estimativa mínima com validação cruzada (`bound.<lingua>.<ano>.crossfit` de
  `analysis/report.json`), de 2023 a 2026: `gap` é a fração de resumos, `ep` o erro padrão,
  `placebo` a mesma conta com as mesmas marcadoras de 2015-16 para 2017 a 2020 (deve dar perto de
  zero) e `marcadoras` o tamanho do conjunto escolhido em cada metade do corpus. `null` quando
  nenhuma metade achou marcadora. Quando nenhuma metade achou mais de uma (`marcadoras` com máximo
  1: português em 2023 e 2024), não há estimativa, pela regra de `minimo_sem_marcadoras` de
  `areas.json`. O número continua no arquivo, igual ao da análise, mas a tela escreve "sem
  estimativa", e não o número nem "perto de zero": em 2023 ele dá 1,8% ± 0,8, mais que o do inglês,
  só porque `autores` subiu.
- `estilo`: palavras de estilo com excesso por ano, base móvel (H1), de 2018 a 2026
  (`style_counts`).
- `palavras_excesso`: todas as palavras com excesso espalhadas por revistas, de qualquer classe,
  base fixa em 2021-22, de 2023 a 2026 (`analysis/excess-fixed/excess-words.csv`).
- `resumos`: resumos utilizáveis por língua e ano, os mesmos de `analysis/coverage.md`. `total`
  conta todas as línguas, espanhol (`es`) incluído; para "em português e em inglês", some `pt` e
  `en`.
- `pares`: o teste H2 nos mesmos artigos (`analysis/pairs/report.json`, grupo `all`). `en_sobe` e
  `pt_sobe` são as altas, de 2021-22 para 2025-26 somados, da parcela de abstracts em inglês e de
  resumos em português com marcadora; `dif` é quanto o inglês subiu a mais, com o intervalo de
  bootstrap (`ic`) e o p unilateral; `placebo` e `placebo_ic`, a mesma diferença de 2015-16 para
  2019 em diante. Como `dif` é do tamanho do placebo (0,0266 contra 0,0238) e o intervalo inclui
  zero, em 2025-26 os dados não mostram marca maior no inglês.
  `em2024` é o único ano em que o inglês subiu mais (as marcadoras de 2025 aplicadas a 2024). Não
  escreva que a marca é "N vezes maior" no inglês: os dados não dizem isso.
- `experimento`: textos por tarefa e modelo, quantos modelos e quantas tarefas. `versoes` traz
  `versao` e `datas` de cada modelo, iguais aos de `experimento/<tarefa>.json`, para o Método e a
  Máquina do tempo mostrarem o mesmo. `pedido` é o primeiro parágrafo do pedido de melhorar a
  escrita em cada língua, exatamente como foi enviado; o resto do pedido só fixa o formato da
  resposta.
- `amostras`: as miniaturas da Máquina do tempo e do Raio-X no Início, feitas de texto real.
  - `experimento.<lingua>`: uma frase que um modelo reescreveu ao melhorar um resumo daquela
    língua (`experimento/polish-<lingua>.json`). É a mais curta, de 8 a 22 palavras, que muda de 1 a
    3 trechos da frase original mais parecida e insere uma marcadora; empate pelo resumo e depois
    pela ordem dos modelos. `segmentos` são trechos `[op, texto]`, de palavras separadas por
    espaço: `=` ficou, `-` saiu, `+` entrou e `+m` entrou e é marcadora (classes `rem`, `ins` e
    `ins ins-marca`). A tela junta os trechos com um espaço, usando `textContent`. `id` e `modelo`
    abrem o mesmo resumo na Máquina do tempo (`?resumo=pt-038&modelo=chatgpt`).
  - `raiox.<lingua>`: a primeira frase do exemplo de 2025 de `marcadoras.json`, em trechos
    `[texto, nível]`: `nível` é o de realce da marcadora (classe `mk-<nível>`) e `null` no resto. Os
    trechos juntos, sem nada entre eles, refazem a frase. `doi`, `revista` e `ano` são do resumo.
- `metodo`: os números com que o Método descreve os dados.
  - `revistas`: revistas da coleção SciELO Brasil, as que têm artigo no Crossref e as que têm
    resumo utilizável (`analysis/coverage.md`).
  - `filtros`: artigos do Crossref por situação depois da limpeza (`scripts/excess.py prepare`):
    `ok` (utilizável), `length` (fora de 250 a 4.000 caracteres), `glued` (outro resumo ou
    palavras-chave grudados), `language` (língua incerta), `duplicate` (DOI ou texto repetido) e
    `notice` (errata, retratação ou adendo). Situação sem nenhum artigo não aparece.
  - `marcadoras`: tamanho da lista de marcadoras de cada língua. `rotuladas`: palavras com excesso
    que o Claude rotulou, por língua (`analysis/labels/claude-<lingua>.csv`).
  - `concordancia`: a amostra cega que o autor rotulou (`analysis/report.json`, `agreement`):
    `amostra` palavras, `acordo` e `kappa` com o Claude, e `acordo_decididas`, o acordo nas
    `decididas`, as palavras em que o Claude escolheu estilo ou conteúdo.
  - `amostra_pares`: artigos sorteados por ano no ArticleMeta, em quantos anos, o total sorteado e
    quantos ficaram com resumo e abstract utilizáveis.
  - `tamanho`: média de palavras diferentes por resumo utilizável, por língua e ano, contando como a
    análise conta (palavras de quatro letras ou mais), uma casa decimal. É a medida dos decis do
    ajuste de tamanho.
  - `h3`: o teste entre as línguas (`analysis/crosslang/report.json`): das `marcadoras`, quantas
    `traduzem` numa marcadora da outra língua, e o mesmo para os `controles`; `p` é o teste
    exato de Fisher, unilateral.
  - `experimento_amostra`: por tarefa, de quantas revistas vêm os 80 resumos, o máximo de uma só
    revista, as áreas e os resumos por área (`null` se as áreas tivessem números diferentes). O
    limite de dois por revista vale só para `polish-en`.

Os números são conferidos por `python3 -I scripts/build_site_data.py check`, que compara este
arquivo com `analysis/report.json`, `analysis/pairs/report.json`, as tabelas de excesso,
`analysis/coverage.md`, `analysis/experiment/report.json`, `analysis/crosslang/report.json`, as
planilhas de rótulos, a amostra do ArticleMeta, o corpus e `experiment/`. As miniaturas são
conferidas contra os arquivos de onde saem: os trechos refazem as frases e os `+m` são marcadoras.
