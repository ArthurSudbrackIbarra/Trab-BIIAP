# IAês: especificação do app web

Documento para o Claude Design projetar as telas. Com as telas prontas, o Claude Code implementa o
app.

Versão 1, 30 de outubro de 2026. Todos os números, palavras e textos de exemplo deste documento são
inventados: servem para o layout e serão trocados pelos resultados reais da análise.

## 1. Contexto

O IAês acompanha um artigo científico sobre as marcas que os chatbots de IA deixaram na escrita da
ciência brasileira. A análise conta, ano a ano, quantos resumos do SciELO Brasil usam cada palavra,
de 2015 a 2026, antes e depois do lançamento do ChatGPT em 30 de novembro de 2022. Quase todo artigo
do SciELO tem um resumo em português e um abstract em inglês, e o estudo compara as duas línguas.
Algumas palavras passaram a aparecer muito mais do que a tendência anterior previa. Kobak e colegas
chamaram isso de excesso de vocabulário ao estudar o PubMed, e o método aqui é o mesmo.

O app deixa qualquer pessoa explorar essas palavras, comparar áreas e línguas, testar o próprio
texto e ver modelos de IA reescrevendo resumos antigos.

### Quem usa

Pesquisadores e estudantes de pós-graduação no Brasil, os professores que vão avaliar o trabalho e
curiosos em geral. O app também aparece num vídeo de 5 minutos (gravação de tela em 1920×1080) e em
capturas de tela no artigo.

### O que a pessoa deve entender ao sair

- O vocabulário dos resumos brasileiros mudou depois do ChatGPT, e dá para medir quanto.
- A mudança é maior nos abstracts em inglês do que nos resumos em português.
- Quando um modelo de IA reescreve um texto, ele insere palavras específicas. O app mostra quais.
- Contar palavras descreve milhares de textos, mas não prova nada sobre um texto isolado. O IAês não
  é um detector de IA.

## 2. Tom e direção visual

- Referências: jornalismo de dados editorial, como The Pudding, NYT Upshot, Our World in Data e a
  editoria visual do Financial Times. O tom é sério e claro, com espaço para curiosidade.
- Em cada tela, o gráfico é o protagonista. O texto diz o que olhar e fica curto.
- Sem robôs, cérebros brilhantes, circuitos, galáxias, estrelas ou outras metáforas de ficção
  científica. Sem emojis e sem ilustração cartunizada. Os gráficos são gráficos comuns, bem
  rotulados.
- Uma gramática de cores vale para o app inteiro:
  - cinza para o esperado, a linha de base e o "antes";
  - uma cor de destaque quente (algo como laranja-avermelhado) para o excesso e as marcas de IA;
  - duas cores fixas para as línguas dos resumos, uma para PT e outra para EN, diferentes da cor de
    destaque (evitar o verde e o amarelo da bandeira);
  - verde e vermelho, ou um par acessível equivalente, só na Máquina do tempo, para texto inserido
    e removido.
- Paletas seguras para daltonismo. A informação nunca depende só da cor: rótulos, padrões e formas
  acompanham.
- Tipografia: uma serifa para títulos e textos de leitura e uma sem serifa para a interface e os
  números, com algarismos tabulares em gráficos e tabelas. As palavras analisadas aparecem sempre
  com o mesmo tratamento (por exemplo, itálico), para o leitor reconhecer de longe que aquilo é um
  dado.
- Modo claro por padrão. Modo escuro é opcional.

## 3. Navegação e elementos globais

### Telas

| Tela | Rótulo no menu | Prioridade |
|---|---|---|
| Início | Início | P1 |
| Palavras no tempo | Palavras | P1 |
| Mapa de palavras | Mapa | P1 |
| Áreas do conhecimento | Áreas | P1 |
| O mesmo artigo em duas línguas | PT × EN | P1 |
| Máquina do tempo | Experimento | P1 |
| Raio-X do seu texto | Raio-X | P1 |
| Antes ou depois? | Jogo | P2 |
| Método | Método | P1 |

A tela P2 entra depois das outras. Se o menu ficar cheio, Palavras, Mapa, Áreas e PT × EN podem ir
para um grupo "Explorar".

### Cabeçalho e rodapé

- Cabeçalho: a marca IAês (só tipografia, sem ícone), o menu e o seletor de idioma da interface,
  PT | EN.
- Rodapé: fonte dos dados (SciELO Brasil, licença CC BY), links para o artigo em PDF, o código no
  GitHub e a página Método, a frase "Este site não usa cookies nem registra visitas" e os créditos
  (autor, PUCRS, disciplina).

### Duas coisas chamadas "idioma"

O app tem dois controles de língua que não podem ser confundidos. O do cabeçalho troca o idioma da
interface. Dentro das ferramentas, o controle "Resumos em: Português | Inglês" escolhe quais resumos
entram no gráfico. O design precisa deixar a diferença óbvia, com rótulos e posições distintos.

### Componentes compartilhados

- Painel da palavra: abre ao clicar numa palavra em qualquer tela (seção 4.10).
- Filtros padrão: "Resumos em" (Português | Inglês), "Área" (Todas ou uma das 8) e, quando fizer
  sentido, período.
- Marca do ChatGPT: todo gráfico com eixo de tempo tem uma linha vertical rotulada "ChatGPT,
  30/11/2022".
- Ano parcial: os dados de 2026 vão até [mês]. O ponto de 2026 aparece vazado, ligado por linha
  tracejada e com o rótulo "parcial".
- Tooltip compacto, com a palavra, os números e uma frase de leitura.
- Botão "Copiar link": a URL guarda as palavras e os filtros escolhidos.
- "Ver como tabela" em cada gráfico, para acessibilidade e para quem quer os números.
- Estados de carregamento (esqueleto do gráfico), vazio e erro ("Não foi possível carregar os dados.
  Recarregue a página.").

## 4. Telas

### 4.1 Início

Em meio minuto, a pessoa vê o achado principal e escolhe por onde seguir. Pode ser uma página
rolável; as ferramentas ficam em páginas próprias.

De cima para baixo:

1. Título "IAês" e subtítulo: "O que mudou no vocabulário da ciência brasileira depois do ChatGPT".
2. Gráfico de abertura: duas ou três palavras-marcadoras de 2015 a 2026 (por exemplo, *delve* nos
   abstracts em inglês e *notavelmente* nos resumos em português), com a linha do ChatGPT e a área
   de excesso pintada. As linhas podem se desenhar uma vez ao carregar, sem repetir.
3. Texto de abertura, com duas ou três frases. Sugestão: "Desde o fim de 2022, algumas palavras
   aparecem nos resumos científicos brasileiros bem mais do que a tendência previa. Contamos as
   palavras de 180 mil artigos do SciELO Brasil, em português e em inglês, para medir essa
   mudança."
4. Números principais, em três ou quatro cartões, cada um com o link "como chegamos aqui" para a
   página Método. Exemplos: "180 mil artigos de 2015 a 2026"; "312 palavras com excesso"; "pelo
   menos 17% dos abstracts em inglês de 2025 passaram por um LLM"; "no inglês, a marca é 2,4 vezes
   maior que no português".
5. Cartões das ferramentas, um por tela, com título, uma linha de descrição e uma miniatura do
   gráfico.
6. Aviso curto: "O IAês mede tendências em milhares de textos. Ele não diz se um texto específico
   foi escrito com IA." Com links para o Raio-X e para o Método.

### 4.2 Palavras no tempo

Mostra, palavra por palavra, quanto o uso real se afastou do que a tendência anterior previa.

Controles, numa barra acima do gráfico:

- Busca com autocompletar. Cada sugestão mostra a palavra, a língua e em quantos resumos ela
  aparece.
- As palavras escolhidas viram chips coloridos, até cinco, com um X para remover. O chip leva a
  língua junto, então "crucial · PT" e "crucial · EN" podem ficar lado a lado no mesmo gráfico.
- Em português, as formas de uma palavra são agrupadas: *destacar* reúne destaca, destacam e
  destacou. A sugestão e o painel da palavra listam as formas reunidas.
- Área: Todas ou uma das 8.
- Escala: "% dos resumos" ou "relativa (2021-22 = 1)".
- Interruptor "Mostrar o esperado", ligado por padrão.

O gráfico:

- Eixo X com os anos de 2015 a 2026. Eixo Y com a porcentagem de resumos que contêm a palavra.
- Linha observada, sólida e com pontos, na cor do chip.
- Linha esperada, tracejada e mais clara: a tendência de 2021-22 projetada de 2023 em diante.
- A partir de 2023, a área entre as duas linhas recebe a cor de excesso, em transparência.
- Tooltip, por exemplo: "*crucial* · PT · 2025: 2,1% dos resumos. Esperado: 0,9%. Excesso de 1,2
  ponto percentual, 2,3 vezes o esperado."

Abaixo do gráfico:

- Tabela das palavras escolhidas, com língua, % em 2021-22, % em 2025, esperado para 2025, razão
  entre observado e esperado, diferença em pontos percentuais e posição no ranking de excesso.
- Bloco "Em contexto", com duas colunas, 2019 e 2025. Cada uma traz três frases reais com a palavra
  realçada, a revista, o ano e o link "ver artigo".
- Sugestões clicáveis: *delve*, *underscore*, *showcase*, *crucial*, *notavelmente*, *abrangente*.

Estados:

- A tela abre com três palavras já escolhidas, para nunca começar vazia.
- Palavra rara: "*xyz* aparece em menos de 20 resumos por ano. É pouco para medir."
- Palavra ausente: "Nenhum resumo usa *xyz*."

### 4.3 Mapa de palavras

Todas as palavras de uma vez, para achar as que mais cresceram além do esperado.

É um gráfico de dispersão comum. O desafio de design é a leitura: eixos claros, rótulos que não se
atropelam e um jeito fácil de achar uma palavra.

O gráfico:

- Cada ponto é uma palavra, e são de 5 a 20 mil pontos por língua.
- Eixo X: frequência em 2021-22, em escala logarítmica, de "mais rara" a "mais comum".
- Eixo Y: razão entre observado e esperado em 2024-25, também em escala logarítmica. Uma linha
  horizontal em 1 indica "como esperado".
- Uma linha de corte marca o excesso significativo. Os pontos acima dela ficam na cor de destaque;
  os de baixo, em cinza claro.
- As 20 palavras com maior excesso ganham rótulo.
- A forma do ponto mostra a classe que o autor atribuiu às palavras do topo: estilo (verbos,
  adjetivos, advérbios) ou conteúdo (substantivos, termos técnicos). Palavras sem classe ficam
  neutras. Exemplo de conteúdo: *artificial* cresceu porque mais artigos tratam de IA, não porque a
  IA escreveu esses textos.

Controles:

- Resumos em: Português | Inglês | Lado a lado.
- Área: Todas ou uma das 8.
- Busca "Achar palavra": o ponto ganha rótulo e um anel de destaque.
- Rótulos: Top 20 | Nenhum.
- Zoom por arrasto, com o botão "Ver o mapa inteiro".

Ao lado do gráfico fica a lista "Maiores excessos", ordenável por razão ou por diferença, com uma
barra pequena em cada linha. Passar o mouse num item da lista realça o ponto, e o contrário também.
Clicar abre o painel da palavra.

No modo lado a lado, aparecem dois gráficos iguais, PT à esquerda e EN à direita, com os mesmos
eixos. Passar o mouse numa palavra realça a tradução no outro gráfico. Os pares vêm de uma lista
feita pelo autor, como *crucial* e *crucial*, *notavelmente* e *notably*, *destacar* e *highlight*.

No celular, a lista vem primeiro. O gráfico fica abaixo, só com os cinco primeiros rótulos.

### 4.4 Áreas do conhecimento

Em que áreas a mudança chegou primeiro, e com que força?

O gráfico principal é um mapa de calor:

- Linhas com as 8 áreas do SciELO, ordenadas pelo valor do último ano completo: Ciências Agrárias;
  Ciências Biológicas; Ciências da Saúde; Ciências Exatas e da Terra; Ciências Humanas; Ciências
  Sociais Aplicadas; Engenharias; Linguística, Letras e Artes.
- Colunas com os anos de 2015 a 2026.
- A cor da célula mostra o índice de marcas: o uso médio das palavras-marcadoras em relação a
  2021-22, em que 1 significa "igual a 2021-22". A escala é sequencial, neutra perto de 1 e na cor
  de destaque nos valores altos.
- Um seletor troca a métrica para "estimativa mínima de resumos que passaram por IA (%)".
- Resumos em: Português | Inglês.
- Células com poucos resumos ficam hachuradas, com o tooltip "poucos resumos neste ano".

O botão "Reproduzir" preenche as colunas ano a ano, de 2015 a 2026, com o ano em letras grandes ao
lado. Dá para pausar e arrastar uma régua. É o efeito de contágio: depois de 2023, as células vão
acendendo.

Ao lado do mapa, barras horizontais ordenam as áreas no ano escolhido e mostram a variação em
relação ao ano anterior.

Clicar numa célula abre um cartão com a área, o ano, o número de resumos, o valor do índice, as
cinco palavras de maior excesso naquela área (clicáveis) e uma linha pequena do índice da área ao
longo dos anos, com PT e EN juntos.

### 4.5 O mesmo artigo em duas línguas

Compara o resumo e o abstract de um mesmo artigo para ver em qual língua a IA deixa mais marca.

Primeira parte, a visão geral:

- Dois gráficos de dispersão lado a lado, 2019 e 2025. Cada ponto é um artigo. Eixo X: marcas no
  resumo em português; eixo Y: marcas no abstract em inglês, os dois em palavras-marcadoras a cada
  100 palavras. Uma diagonal indica "mesma marca nas duas línguas".
- Como são milhares de pontos, a densidade aparece com hexágonos ou transparência. Em 2025, a nuvem
  sobe acima da diagonal.
- O painel da direita tem um seletor de ano, para comparar 2019 com qualquer outro.
- Abaixo, uma linha do tempo pequena: "% dos artigos em que o inglês tem mais marcas que o
  português", de 2015 a 2026.

Segunda parte, explorar pares:

- Lista de artigos com filtros de ano e de área, a opção "maior diferença primeiro" e o botão
  "Sortear um artigo".
- Na visão do par, o título fica no topo e o texto em duas colunas, "Resumo (PT)" e "Abstract
  (EN)". As palavras-marcadoras aparecem realçadas nas duas colunas, com a mesma escala de
  intensidade. Cada coluna mostra a contagem de marcas, e um link leva ao artigo no SciELO.
- Passar o mouse numa palavra realçada mostra o excesso dela.

### 4.6 Máquina do tempo

Esta é a tela do experimento. Pegamos resumos publicados antes do ChatGPT e pedimos a modelos de
IA que melhorassem a escrita. A tela responde a duas perguntas: o que eles mudam, e se
as palavras que eles inserem são as mesmas que cresceram no SciELO.

Primeira parte, um resumo:

- Seletores: o resumo (lista com busca, ou "Outro resumo" para sortear), o modelo em abas (Gemini,
  ChatGPT e Claude; a aba fica desativada se aquele modelo não tiver resultado) e a língua, PT | EN.
- Duas colunas, "Original (2019)" e "Reescrito pelo [modelo]". Como alternativa, uma coluna só, com
  as diferenças marcadas no próprio texto.
- Palavras inseridas com fundo verde, removidas riscadas em vermelho. Uma palavra inserida que
  também é marcadora no SciELO ganha um contorno extra na cor de destaque.
- Contadores, por exemplo: "34 palavras inseridas, 6 delas marcadoras. 21 removidas."
- Interruptor "Mostrar só as marcadoras".
- Bloco recolhível "Como pedimos": o prompt exato, o nome e a versão do modelo, a data e as
  configurações.

Segunda parte, o que cada modelo insere:

- Barras horizontais com as 15 palavras que o modelo escolhido mais insere, medidas em quantas
  vezes a palavra aparece mais no texto reescrito do que no original.
- Visão "comparar modelos": três colunas pequenas, uma por modelo, para ver se cada um tem o próprio
  sotaque.

Terceira parte, a prova cruzada:

- Um gráfico de dispersão em que cada ponto é uma palavra. Eixo X: excesso no SciELO real em
  2024-25. Eixo Y: quanto os modelos inserem a palavra no experimento.
- O quadrante de cima à direita, rotulado "cresceu no SciELO e a IA insere", ganha destaque. Este
  gráfico também vai para o artigo.

### 4.7 Raio-X do seu texto

A pessoa vê o próprio texto do jeito que o estudo vê os resumos, e entende por que isso não funciona
como detector.

Entrada:

- Caixa de texto grande: "Cole um resumo em português ou inglês."
- Botões "Analisar", "Limpar", "Exemplo de 2019" e "Exemplo de 2025".
- A língua é detectada sozinha, e a pessoa pode trocar (PT | EN).
- Junto da caixa: "Seu texto fica no seu navegador. Nada é enviado."
- Abaixo de 50 palavras, o app avisa que o texto é curto demais para a conta fazer sentido.

Resultado:

- O texto reaparece com as palavras-marcadoras realçadas. A intensidade acompanha o excesso, com
  legenda de "cresceu pouco" a "cresceu muito". O tooltip traz uma linha do tempo pequena da
  palavra, e o clique abre o painel da palavra.
- Uma linha resume: "7 palavras-marcadoras em 182 palavras (3,8 a cada 100)."
- A comparação honesta: dois histogramas sobrepostos da mesma medida, "resumos de 2019" em cinza e
  "resumos de 2025" na cor de destaque, com uma linha vertical "seu texto". As duas distribuições se
  sobrepõem bastante, e o gráfico precisa deixar isso visível.

O bloco "Isto não é um detector de IA" fica sempre visível depois da análise:

- Texto: "Contar palavras mostra tendências em milhares de textos, mas não prova nada sobre um texto
  isolado. Muita gente já escrevia assim antes do ChatGPT, e detectores de IA erram mais com quem
  escreve em segunda língua."
- Botão "Ver resumos de 2019 com marca parecida", que abre três cartões com resumos anteriores ao
  ChatGPT de pontuação igual ou maior que a do texto colado, já realçados.

### 4.8 Antes ou depois? (P2)

Um jogo curto para provar um ponto: um texto sozinho diz pouco.

A rodada:

- Antes de começar, a pessoa escolhe resumos em PT, em EN ou misturados.
- Um contador mostra o progresso ("3 de 10").
- No centro, um cartão com um resumo real, sem título, revista nem ano, porque o título costuma
  entregar o tema e a época.
- Dois botões grandes: "Antes do ChatGPT (até 2021)" e "Depois (2024 em diante)". Atalhos: seta
  para a esquerda e seta para a direita.
- Os resumos vêm de 2019 a 2021 e de 2024 e 2025, metade de cada período. Ficam de fora os que
  entregam a data pelo tema, como os de COVID-19.

A revelação mostra se a pessoa acertou, o ano, o título, a revista e o link, com as
palavras-marcadoras realçadas e uma pista de uma linha ("3 palavras-marcadoras neste resumo" ou
"nenhuma palavra-marcadora").

No fim: "Você acertou 6 de 10. Uma regra que só conta palavras-marcadoras acertaria 7 nesta mesma
rodada." Botões "Jogar de novo" e "Ver como medimos". O placar fica só no navegador.

### 4.9 Método

Uma página de leitura, com estes blocos:

- Os dados: fonte, período, filtros (por exemplo, artigos com resumo em PT e em EN e com pelo menos
  um autor de instituição brasileira) e quantos artigos entram por ano.
- Como medimos o excesso: um diagrama com a linha observada, a tendência esperada e a diferença
  entre elas, mais duas frases de explicação. A página conta por que 2021-22 é a base e por que 2023
  fica de fora, como ano de transição.
- O experimento da Máquina do tempo: modelos, prompt, amostra e datas.
- Os limites. O estudo mede uma associação no tempo, não uma causa. Tradutores automáticos e
  revisores de texto também mudam o vocabulário, e temas da moda mudam as palavras usadas. O ano de
  2026 está incompleto. E o app não detecta IA em um texto isolado.
- Reprodutibilidade: links para o código, para os dados processados em CSV e para o artigo.
- Como citar, com BibTeX para copiar.
- O uso de IA neste projeto, com a mesma declaração do artigo.
- Créditos.

### 4.10 Painel da palavra

Uma gaveta à direita (no celular, sobe de baixo e ocupa a tela) que abre ao clicar numa palavra em
qualquer tela.

- No topo: a palavra, a língua, a classe (estilo ou conteúdo) e, em português, as formas agrupadas.
- Uma linha do tempo pequena com o observado e o esperado, e um botão para ver a palavra
  equivalente na outra língua.
- Os números: % em 2021-22, % em 2025, esperado, razão e diferença.
- "No experimento": quantas vezes cada modelo inseriu a palavra, quando houver dado.
- "Em contexto": duas frases de 2019 e duas de 2025.
- Botão "Abrir em Palavras no tempo".

## 5. Dados de exemplo para os mockups

Valores inventados, só para o layout.

| Palavra | Língua | Classe | % 2021-22 | % 2025 | Esperado 2025 | Razão |
|---|---|---|---|---|---|---|
| delve | EN | estilo | 0,02 | 0,61 | 0,02 | 30,5 |
| underscore | EN | estilo | 0,31 | 1,48 | 0,33 | 4,5 |
| showcase | EN | estilo | 0,10 | 0,44 | 0,11 | 4,0 |
| notably | EN | estilo | 0,41 | 1,12 | 0,43 | 2,6 |
| crucial | EN | estilo | 1,62 | 3,38 | 1,70 | 2,0 |
| patients | EN | conteúdo | 9,80 | 9,60 | 9,90 | 1,0 |
| notavelmente | PT | estilo | 0,02 | 0,16 | 0,02 | 8,0 |
| crucial | PT | estilo | 0,82 | 2,08 | 0,86 | 2,4 |
| abrangente | PT | estilo | 0,61 | 1,31 | 0,63 | 2,1 |
| robusto | PT | estilo | 0,42 | 0,83 | 0,43 | 1,9 |
| destacar | PT | estilo | 3,20 | 4,90 | 3,31 | 1,5 |
| artificial | PT | conteúdo | 0,30 | 0,95 | 0,40 | 2,4 |

Índice de marcas em 2025 por área (1 = igual a 2021-22):

| Área | Abstracts (EN) | Resumos (PT) |
|---|---|---|
| Engenharias | 2,3 | 1,6 |
| Ciências Exatas e da Terra | 2,1 | 1,5 |
| Ciências da Saúde | 1,9 | 1,4 |
| Ciências Agrárias | 1,8 | 1,4 |
| Ciências Biológicas | 1,7 | 1,3 |
| Ciências Sociais Aplicadas | 1,5 | 1,3 |
| Ciências Humanas | 1,3 | 1,2 |
| Linguística, Letras e Artes | 1,2 | 1,1 |

Textos fictícios para o Raio-X, a Máquina do tempo e a tela PT × EN.

Original em português, no estilo de 2019:

> Este estudo avaliou a qualidade da água em 42 poços rurais de Santa Maria (RS) entre 2017 e 2018.
> Coletamos amostras mensais e medimos nitrato, coliformes e turbidez. Em 31 poços, ao menos uma
> amostra passou do limite da Portaria do Ministério da Saúde. A contaminação foi maior nos meses de
> chuva e nos poços a menos de 50 metros de criações de animais. Os resultados indicam a necessidade
> de monitorar os poços com frequência e de orientar os moradores sobre como protegê-los.

O mesmo texto reescrito, imitando de propósito o estilo de um LLM:

> Este estudo aprofunda a avaliação da qualidade da água em 42 poços rurais de Santa Maria (RS),
> entre 2017 e 2018. Por meio de coletas mensais, foram analisados parâmetros cruciais como nitrato,
> coliformes e turbidez. Notavelmente, 31 poços apresentaram ao menos uma amostra acima do limite
> estabelecido pela Portaria do Ministério da Saúde. A contaminação mostrou-se mais acentuada nos
> meses chuvosos e em poços situados a menos de 50 metros de criações de animais. Esses achados
> destacam a importância crucial de um monitoramento contínuo e abrangente, bem como de iniciativas
> robustas de orientação aos moradores.

Abstract em inglês do mesmo artigo, com mais marcas que o resumo em português:

> This study delves into the water quality of 42 rural wells in Santa Maria, Brazil, between 2017
> and 2018. Monthly samples were analyzed for nitrate, coliforms and turbidity. Notably, 31 wells
> had at least one sample above the national limit. Contamination was higher in rainy months and in
> wells less than 50 meters from livestock, underscoring the crucial need for continuous monitoring.

## 6. Restrições técnicas que afetam o design

- O site é estático e fica no GitHub Pages. Tudo vem pré-calculado; nada é gerado na hora.
- O app não chama modelos de IA. A Máquina do tempo mostra resultados prontos, e o Raio-X compara o
  texto com uma lista de palavras dentro do navegador. Não desenhar botões como "reescrever meu
  texto com IA".
- O Mapa de palavras tem milhares de pontos e será desenhado em canvas. As outras telas têm de
  dezenas a centenas de elementos.
- Telas-alvo: desktop de 1440 px (a principal, usada no vídeo e nas capturas), tablet de 768 e
  celular de 390. No celular os gráficos simplificam, com menos rótulos e listas antes dos
  gráficos.
- O gráfico principal de cada ferramenta precisa caber na primeira dobra em 1440×900, por causa da
  gravação do vídeo.
- Acessibilidade: contraste AA, navegação por teclado e foco visível.
- Interface em português por padrão, com versão completa em inglês. Em inglês, o subtítulo pode ser
  "The AI accent in Brazilian science".
- Sem cookies e sem analytics. O texto colado no Raio-X e o placar do jogo não saem do navegador.

## 7. Fora do escopo

Bingo de palavras, resumo satírico, simulador da porcentagem de textos com IA, mapa por estado,
contas de usuário, coleta de respostas de visitantes e reescrita ao vivo com IA.

## 8. O que o Claude Design deve entregar

- Cada tela da seção 4 em desktop (1440) e celular (390).
- Os estados principais: vazio, carregando, tooltip aberto, painel da palavra aberto, resultado do
  Raio-X e revelação do jogo.
- Uma folha de componentes: cabeçalho, menu, filtros, chips de palavra, tooltip, painel da palavra,
  cartões, botões e tabela.
- Tokens: cores com nomes semânticos (base, excesso, pt, en, inserido, removido e a escala de
  realce), escala tipográfica e espaçamentos.
- Um guia curto de estilo dos gráficos: eixos, grades, anotações, legendas e tooltip.
