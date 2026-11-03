# IAês, o site

Site estático que acompanha o artigo: uma página por ferramenta, em inglês (o padrão, na raiz) e em
português (em `/pt/`), com os dados pré-calculados. Não chama modelo de IA nenhum, não usa cookies
e não faz requisição a terceiros (fontes e dados vêm do próprio site).

O design foi feito no Claude Design a partir da spec em `docs/app-spec.md`. Os dados seguem
`site/DADOS.md`.

## Gerar e ver

```
python3 -I scripts/build_site_data.py all      # dados: site/public/dados/ (precisa de data/interim/)
python3 -I site/build.py                       # páginas: site/dist/
python3 -m http.server 8000 -d site/dist       # http://localhost:8000/
```

Sem dependências: Python 3 (biblioteca padrão) para gerar, JavaScript puro (módulos ES) no
navegador. `site/dist/` é gerado e fica fora do git. Para publicar no GitHub Pages num subcaminho,
`python3 -I site/build.py --base /<repositorio>/` (só as páginas 404 usam endereço absoluto; o resto
é relativo).

A publicação é feita pelo GitHub Actions: `.github/workflows/pages.yml` gera o site com o caminho
do Pages em `--base` e o publica a cada push em `main` que mexa em `site/` (ou à mão, em Actions).
Funciona com o repositório público e com Settings > Pages > Source em "GitHub Actions".

## Estrutura

```
site/
  build.py              gera as páginas: base comum + corpo de cada tela, nas duas línguas
  DADOS.md              contrato dos arquivos de dados
  src/pages/<id>.html   corpo (dentro de <main>) de cada tela, com {{t:chave}}, {{rota:id}}, {{raiz}}
  src/i18n/comum.json   textos de todas as telas: cabeçalho, rodapé, estados, painel, áreas
  src/i18n/<id>.json    textos de uma tela: {"pt": {...}, "en": {...}}, com as mesmas chaves
  public/css/iaes.css   tokens e componentes do design (o CSS do Claude Design; não editar)
  public/css/site.css   layout global, cabeçalho, rodapé, estados e as regras de celular
  public/css/pages/<id>.css   estilos de uma tela (carregado só nela, se existir)
  public/js/lib/        código comum (ver abaixo)
  public/js/pages/<id>.js     código de uma tela (carregado só nela, se existir)
  public/fontes/        Figtree (OFL)
  public/dados/         JSON gerado por scripts/build_site_data.py
```

Ids das telas e endereços, em inglês e em português: `inicio` (`/`, `/pt/`), `palavras` (`/words/`,
`/pt/palavras/`), `mapa` (`/map/`, `/pt/mapa/`), `areas` (`/fields/`, `/pt/areas/`), `ptxen`
(`/pt-en/`, `/pt/pt-en/`), `experimento` (`/time-machine/`, `/pt/maquina-do-tempo/`), `raiox`
(`/x-ray/`, `/pt/raio-x/`), `jogo` (`/game/`, `/pt/jogo/`), `metodo` (`/method/`, `/pt/metodo/`) e
`404` (`/404.html`, `/pt/404.html`). As rotas ficam em `ROUTES` (`build.py`) e `ROTAS`
(`public/js/lib/base.js`), que precisam ser iguais. O GitHub Pages só serve o `404.html` da raiz;
para um endereço em `/pt/`, ele passa para `/pt/404.html`.

Cada página tem `<html data-lingua data-pagina data-raiz>`, o cabeçalho, `<main id="conteudo">`
com o corpo da tela, o rodapé e um `<script type="application/json" id="textos">` com os textos
da tela já no idioma da página (comum + tela), que o JavaScript lê com `t()`.

## Código comum (`public/js/lib/`)

- `base.js`: `lingua`, `raiz`, `pagina`, `t(chave, vars)`, `fmt` (números no padrão do idioma:
  `num`, `pct`, `pctAuto`, `pp`, `razao`, `mb`), `el()` (cria elementos), `icone()` (nomes em
  `ICONES`, entre eles `sortear` e `externo`), `dados(caminho)` e `carregarEm(caixa, caminho)`
  (download com esqueleto, barra de lentidão, erro com "Tentar de novo" só naquela região e espera
  pela conexão; `erroTitulo` e `erroTexto` trocam o texto do erro numa região que não é gráfico,
  com `t('erro_titulo_parte')`, ou quando o arquivo alimenta a tela toda, com
  `t('erro_texto_tela')`), `estadoErro()`, `descreverErro()` (o detalhe do erro de `dados()` no
  idioma da página), `esperarConexao()` (tenta de novo quando a conexão volta ou no "Tentar
  agora"), `esqueleto()`, `lerUrl()` e `gravarUrl()` (estado da tela no endereço),
  `botaoCopiarLink()`, `avisoLink()` (link com problema) e `escapar()` (o que veio do endereço,
  antes de entrar no aviso), `lerChave()` e `chave()` (`crucial.pt`), `inicial()`,
  `palavraBotao()` (palavra que abre o painel), `AREAS`, `ANOS`, `nomeArea()`, `faixa()`,
  `semMovimento()`.
- `cabecalho.js`: carregado em toda página. Menu do celular em tela cheia (Esc fecha), lista
  Explorar no tablet, troca de idioma levando `?…` e `#…`, faixa de "sem internet" (o "Tentar
  agora" dispara no `window` o evento `iaes:tentar`), e o painel da palavra: qualquer elemento
  com `data-palavra="crucial.pt"` abre o painel ao ser clicado, e `#palavra=crucial.pt` no
  endereço também.
- `palavras.js`: acesso aos dados de palavras: `indice(lingua)`, `buscar(texto, linguas, limite)`,
  `serie(palavra, lingua)`, `serieArea(palavra, lingua, area)`, `ficha(palavra, lingua)`,
  `padrao()`, e as contas sobre uma série: `medidas()`, `rara(s, item)` (palavra sem classe em
  que nenhum ano chega a `MINIMO_RESUMOS`, 10 resumos, o mínimo da análise), `poucos(s)` (nenhum
  ano chega a `POUCOS_RESUMOS`, 20: a linha aparece, com o aviso `t('poucos_resumos')`) e
  `faixaResumos(s)`.
- `grafico.js`: escalas e marcas de eixo (`escalaLinear`, `escalaLog`, `marcasBonitas`), e
  `linhaTempo(caixa, opcoes)`, o gráfico de linha do tempo do design (observado, esperado,
  excesso, marco do ChatGPT, 2026 parcial, dica, tabela). De 2023 em diante o esperado é um traço
  por ano, sem ligar um ano ao outro, porque cada ano tem o próprio recorte de revistas;
  `t('nota_esperado')` diz isso no pé do gráfico.
- `dica.js`: a dica (tooltip) que abre igual com mouse, foco e toque; no celular vira cartão fixo
  abaixo do gráfico. Esc fecha a dica aberta e para aí (não fecha o painel em volta).
- `tabela.js`: `tabela(colunas, linhas)` e o botão "Ver como tabela" (classe fixa
  `.botao-tabela`). No celular, a tabela mais larga que a caixa ganha a linha
  `t('tabela_deslize')` no pé.
- `filtros.js`: segmentos (`.seg`), interruptor, seletor de área e o filtro "Resumos em". Com
  `nome`, o seletor de área lista outros valores (anos, por exemplo).
- `busca.js`: busca de palavras com autocompletar (combobox ARIA).
- `painel.js`: o painel da palavra (gaveta de 440 px no desktop, folha no celular). Um
  `#palavra=` fora do formato `palavra.pt` ou `palavra.en` sai do endereço e vira o aviso de link
  com problema.

Cada arquivo começa com um comentário que descreve a API. Uma tela usa estes módulos e não os
altera; o que faltar numa tela fica no `js/pages/<id>.js` dela.

## Regras

- Nenhum número inventado: todo valor vem de `public/dados/` ou é calculado a partir dele. Textos
  com número usam `{nome}` e `t(chave, {nome: fmt.num(x)})`.
- Cor só por token de `iaes.css` (`var(--pt)`, `var(--excesso)`...). Gramática: cinza é o esperado
  e o antes, laranja é o excesso, azul-petróleo (`--pt`) e índigo (`--en`) são as línguas, verde e
  vinho só na Máquina do tempo. Texto só em `--tinta`, `--tinta-2` e `--tinta-3`.
- Os resets de `iaes.css` têm o peso de uma classe mais um elemento: `.iaes p{margin:0}` (também
  h1 a h4, ul, ol, dl, dd, figure, blockquote, pre), `.iaes ul{padding:0}` e
  `.iaes button{font:inherit;color:inherit}` (também input, textarea, select). Uma regra de uma
  classe só perde para eles, então margem ou padding nesses elementos, e cor ou fonte num
  `<button>`, levam o prefixo `.iaes` (`.iaes .minha-lista{padding:6px}`).
- A palavra analisada vai em negrito (`.w`); números que se comparam usam `.num`/`.dado`. Sem
  itálico. Títulos em caixa normal.
- Fora da interface (seção 10 do guia): rótulo pequeno em caixa alta sobre título, fileira de
  cartões iguais, degradê, brilho, etiqueta em pílula, bolinha de status, raio acima de 4 px em
  botões e campos, números redondos de mentira, numeração 01/02/03 sem sequência, travessão.
- Textos: diretos, curtos, sem travessão (— ou –), sem jargão de IA ("crucial", "aprofundar",
  "destacar", "robusto", "abrangente" como enfeite) e sem frases de efeito. Português do Brasil e
  inglês completos; números no padrão de cada idioma (`Intl.NumberFormat`).
- Acessibilidade: contraste AA, foco visível, tudo pelo teclado, `lang="en"` em texto inglês,
  alvos de 44 px no celular, resumo em texto de cada gráfico e "Ver como tabela".
- O gráfico principal de cada ferramenta cabe na primeira dobra de 1440 × 900.
- Larguras: desktop ≥ 1200 px, tablet 600 a 1199 (gráficos lado a lado empilham), celular < 600.
