"""Build the IAês site: one HTML page per tool and language, from the templates in site/src/.

    python3 -I site/build.py [--base /Trab-BIIAP/]

Writes site/dist/ (git ignores it): the pages, then a copy of site/public/ (CSS, fonts, scripts and
the data from scripts/build_site_data.py). Standard library only. Links between pages are relative,
so the site works under any path; only the 404 pages, which GitHub Pages serves at whatever
address was asked for, use the absolute --base. English is the default language, at the root;
Portuguese lives under pt/.

Templates are plain HTML with three kinds of placeholders:

    {{t:key}}        a string from site/src/i18n/comum.json or <page>.json, in the page's language
    {{rota:page}}    relative link to another page in the same language (rota:raiz is the site root)
    {{raiz}}         relative path to the site root, ending in "/" ("" on the home page)

Strings are trusted HTML (they may hold <b> or links) and may hold {{rota:...}} and {{raiz}}.
"""

import argparse
import json
import re
import shutil
from pathlib import Path

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
SRC = SITE / "src"
PUBLIC = SITE / "public"
DIST = SITE / "dist"
PAPER = ROOT / "Artigo" / "build" / "artigo.pdf"
LANGS = ("en", "pt")
HTML_LANG = {"pt": "pt-BR", "en": "en"}
# Page id -> path in each language (the same as ROTAS in public/js/lib/base.js). Order is the menu's.
ROUTES = {
    "inicio": {"en": "", "pt": "pt/"},
    "palavras": {"en": "words/", "pt": "pt/palavras/"},
    "mapa": {"en": "map/", "pt": "pt/mapa/"},
    "areas": {"en": "fields/", "pt": "pt/areas/"},
    "ptxen": {"en": "pt-en/", "pt": "pt/pt-en/"},
    "experimento": {"en": "time-machine/", "pt": "pt/maquina-do-tempo/"},
    "raiox": {"en": "x-ray/", "pt": "pt/raio-x/"},
    "jogo": {"en": "game/", "pt": "pt/jogo/"},
    "metodo": {"en": "method/", "pt": "pt/metodo/"},
}
NOT_FOUND = {"en": "404.html", "pt": "pt/404.html"}
# Menu groups, separated by a rule on the desktop. "Explorar" collapses into a list on tablets.
GROUPS = (("inicio",), ("palavras", "mapa", "areas", "ptxen"), ("experimento", "raiox", "jogo"),
          ("metodo",))
EXPLORE = GROUPS[1]
MOBILE_GROUPS = (("menu_explorar", ("inicio", *EXPLORE)), ("menu_experimentar", GROUPS[2]),
                 ("menu_sobre", GROUPS[3]))
PLACEHOLDER = re.compile(r"\{\{(t:[\w.-]+|rota:[\w-]+|raiz)\}\}")
ICONS = {
    "globo": "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
    "menu": "M4 7h16M4 12h16M4 17h16",
    "fechar": "M6 6l12 12M18 6L6 18",
    "abaixo": "M6 9l6 6 6-6",
    "pdf": "M6 3h8l4 4v14H6zM14 3v4h4",
    "codigo": "M8 8l-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14",
    "info": "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 11v6M12 7.5v.5",
}


def icon(name, small=True):
    size = " ic-p" if small else ""
    return (f'<svg class="ic{size}" viewBox="0 0 24 24" aria-hidden="true">'
            f'<path d="{ICONS[name]}"></path></svg>')


def load_strings(page):
    """The page's strings merged over the shared ones, per language."""
    shared = json.loads((SRC / "i18n" / "comum.json").read_text(encoding="utf-8"))
    path = SRC / "i18n" / f"{page}.json"
    own = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"pt": {}, "en": {}}
    clash = (set(own["pt"]) | set(own["en"])) & (set(shared["pt"]) | set(shared["en"]))
    clash -= {"titulo", "titulo_pagina", "descricao"}
    if clash:
        raise SystemExit(f"{page}: keys {sorted(clash)} shadow comum.json")
    strings = {lang: {**shared[lang], **own[lang]} for lang in LANGS}
    for key in set(strings["pt"]) ^ set(strings["en"]):
        raise SystemExit(f"{page}: key {key!r} is missing in one language")
    return strings


def relative(source, target):
    """Relative link from the page at `source` (a directory path such as 'en/words/') to `target`."""
    depth = source.count("/")
    return "../" * depth + target if (depth or target) else "./"


def render(text, strings, lang, path, root):
    def replace(match):
        key = match.group(1)
        if key == "raiz":
            return root
        kind, name = key.split(":")
        if kind == "rota":
            target = "" if name == "raiz" else ROUTES[name][lang]
            return root + target if root.startswith("/") else relative(path, target)
        if name not in strings:
            raise SystemExit(f"{path or 'index'}: no string {name!r}")
        return render(strings[name], strings, lang, path, root)
    return PLACEHOLDER.sub(replace, text)


def header(page, lang):
    """The header: desktop menu in groups, the Explorar list for tablets and the phone menu."""
    def link(target, css="nav-link"):
        current = ' aria-current="page"' if target == page else ""
        return f'<a class="{css}" href="{{{{rota:{target}}}}}"{current}>{{{{t:menu_{target}}}}}</a>'

    groups = []
    for index, group in enumerate(GROUPS):
        rule = '<span class="cab-regua" aria-hidden="true"></span>' if index else ""
        css = ' class="cab-explorar-itens"' if group == EXPLORE else ""
        items = "".join(f"<li>{link(target)}</li>" for target in group)
        groups.append(f"{rule}<ul{css}>{items}</ul>")
    current = ' aria-current="page"' if page in EXPLORE else ""
    explore = "".join(
        f'<a href="{{{{rota:{target}}}}}"{" aria-current=" + chr(34) + "page" + chr(34) if target == page else ""}>'
        f'<span class="cab-lista-titulo">{{{{t:menu_{target}}}}}</span>'
        f'<span class="t-legenda">{{{{t:menu_desc_{target}}}}}</span></a>' for target in EXPLORE)
    mobile = []
    for title, group in MOBILE_GROUPS:
        items = "".join(
            f'<a href="{{{{rota:{target}}}}}"{" aria-current=" + chr(34) + "page" + chr(34) if target == page else ""}>'
            f'<span class="cab-celular-item"><span class="cab-celular-titulo">{{{{t:menu_longo_{target}}}}}</span>'
            f'<span class="t-legenda">{{{{t:menu_desc_{target}}}}}</span></span>'
            f'{"<span class=" + chr(34) + "t-legenda cab-aqui" + chr(34) + ">{{t:menu_aqui}}</span>" if target == page else ""}</a>'
            for target in group)
        mobile.append(f'<div class="cab-celular-grupo"><p class="t-rotulo">{{{{t:{title}}}}}</p>{items}</div>')
    other = "en" if lang == "pt" else "pt"
    target = ROUTES[page][other] if page in ROUTES else NOT_FOUND[other]
    switch = []
    for code in LANGS:
        if code == lang:
            switch.append(f'<a aria-current="true" lang="{HTML_LANG[code]}" href="#">{code.upper()}</a>')
        else:
            switch.append(f'<a class="cab-trocar" lang="{HTML_LANG[code]}" hreflang="{HTML_LANG[code]}" '
                          f'href="{{{{raiz}}}}{target}">{code.upper()}</a>')
    return f"""<header class="cab">
<div class="pagina cab-barra">
<a class="marca" href="{{{{rota:inicio}}}}" aria-label="{{{{t:marca_rotulo}}}}">IA<em>ês</em></a>
<nav class="cab-nav" aria-label="{{{{t:menu_rotulo}}}}">
{groups[0]}
<div class="cab-explorar">
<button class="nav-link" type="button" aria-expanded="false" aria-controls="cab-lista"{current}>{{{{t:menu_explorar}}}}{icon("abaixo")}</button>
<div class="cartao cab-lista" id="cab-lista" hidden>{explore}</div>
</div>
{''.join(groups[1:])}
</nav>
<div class="lingua-site" role="group" aria-label="{{{{t:idioma_rotulo}}}}">{icon("globo")}<span class="cab-site-em">{{{{t:idioma_site_em}}}}</span>{'<span aria-hidden="true" class="cab-barra-lingua">|</span>'.join(switch)}</div>
<button class="btn btn-fantasma cab-menu" type="button" aria-expanded="false" aria-controls="menu-celular"><span class="cab-menu-abrir">{icon("menu", False)}{{{{t:menu_abrir}}}}</span><span class="cab-menu-fechar">{icon("fechar", False)}{{{{t:menu_fechar}}}}</span></button>
</div>
<nav class="cab-celular" id="menu-celular" aria-label="{{{{t:menu_rotulo}}}}" hidden>{''.join(mobile)}</nav>
</header>"""


def footer(paper, code):
    """The footer. Without a code link (url_codigo empty in comum.json), "Código no GitHub" is left out."""
    article = (f'<a href="{{{{raiz}}}}artigo.pdf">{icon("pdf")}{{{{t:rodape_artigo}}}}</a>' if paper
               else f'<span class="rodape-indisponivel">{icon("pdf")}{{{{t:rodape_artigo_breve}}}}</span>')
    code_link = f'<li><a href="{{{{t:url_codigo}}}}">{icon("codigo")}{{{{t:rodape_codigo}}}}</a></li>' if code else ""
    return f"""<footer class="rodape">
<div class="pagina rodape-dentro">
<div class="rodape-colunas">
<div class="rodape-col"><a class="marca" href="{{{{rota:inicio}}}}" aria-label="{{{{t:marca_rotulo}}}}">IA<em>ês</em></a><p class="t-p">{{{{t:subtitulo}}}}</p></div>
<div class="rodape-col"><p class="t-rotulo">{{{{t:rodape_dados}}}}</p><p class="t-p">{{{{t:rodape_dados_texto}}}}</p></div>
<div class="rodape-col"><p class="t-rotulo">{{{{t:rodape_links}}}}</p><ul class="t-p rodape-links">
<li>{article}</li>
{code_link}
<li><a href="{{{{rota:metodo}}}}">{icon("info")}{{{{t:menu_metodo}}}}</a></li>
</ul></div>
<div class="rodape-col"><p class="t-rotulo">{{{{t:rodape_privacidade}}}}</p><p class="t-p">{{{{t:rodape_privacidade_texto}}}}</p></div>
</div>
<div class="rodape-base t-legenda"><p>{{{{t:rodape_creditos}}}}</p></div>
</div>
</footer>"""


def page_html(page, lang, path, root, meta, paper):
    strings = load_strings(page)[lang]
    strings["parcial_mes"] = strings[f"mes_{meta['parcial']['mes']}"]
    strings["parcial_ano"] = str(meta["parcial"]["ano"])
    body = (SRC / "pages" / f"{page}.html").read_text(encoding="utf-8")
    title = strings.get("titulo_pagina") or strings["titulo"]
    head_title = "IAês" if page == "inicio" else f"{title} · IAês"
    def address(code):
        return ROUTES[page][code] if page in ROUTES else NOT_FOUND[code]
    alternates = "".join(
        f'<link rel="alternate" hreflang="{hreflang}" href="{{{{raiz}}}}{address(code)}">'
        for hreflang, code in ((HTML_LANG["en"], "en"), (HTML_LANG["pt"], "pt"), ("x-default", "en")))
    script = (SITE / "public" / "js" / "pages" / f"{page}.js").exists()
    styles = (SITE / "public" / "css" / "pages" / f"{page}.css").exists()
    # Resolved here and put in after rendering, so the page's scripts get finished strings.
    texts = json.dumps({key: render(value, strings, lang, path, root) for key, value in strings.items()},
                       ensure_ascii=False).replace("</", "<\\/")
    html = f"""<!doctype html>
<html lang="{HTML_LANG[lang]}" data-lingua="{lang}" data-pagina="{page}" data-raiz="{{{{raiz}}}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{head_title}</title>
<meta name="description" content="{{{{t:descricao}}}}">
<link rel="preload" href="{{{{raiz}}}}fontes/figtree/figtree-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{{{{raiz}}}}fontes/figtree/figtree-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="{{{{raiz}}}}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{{{{raiz}}}}fontes/figtree.css">
<link rel="stylesheet" href="{{{{raiz}}}}css/iaes.css">
<link rel="stylesheet" href="{{{{raiz}}}}css/site.css">
{f'<link rel="stylesheet" href="{{{{raiz}}}}css/pages/{page}.css">' if styles else ""}
{alternates}
<script type="application/json" id="textos">@@TEXTOS@@</script>
<script type="module" src="{{{{raiz}}}}js/lib/cabecalho.js"></script>
{f'<script type="module" src="{{{{raiz}}}}js/pages/{page}.js"></script>' if script else ""}
</head>
<body class="iaes">
<a class="pular" href="#conteudo">{{{{t:pular_conteudo}}}}</a>
{header(page, lang)}
<main id="conteudo" class="conteudo-{page}">
{body}
</main>
{footer(paper, bool(strings["url_codigo"]))}
</body>
</html>
"""
    return render(html, strings, lang, path, root).replace("@@TEXTOS@@", texts)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", default="/", help="absolute path of the site root, for the 404 pages")
    parser.add_argument("--out", type=Path, default=DIST, help="output folder (default site/dist)")
    args = parser.parse_args()
    out_root = args.out.resolve()
    base = args.base if args.base.endswith("/") else args.base + "/"
    meta_path = PUBLIC / "dados" / "meta.json"
    if not meta_path.exists():
        raise SystemExit("site/public/dados/meta.json is missing: run python3 -I scripts/build_site_data.py")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if out_root.exists():
        shutil.rmtree(out_root)
    shutil.copytree(PUBLIC, out_root)
    paper = PAPER.exists()
    if paper:
        shutil.copy2(PAPER, out_root / "artigo.pdf")
    count = 0
    for page, paths in ROUTES.items():
        for lang in LANGS:
            path = paths[lang]
            root = "../" * path.count("/")
            out = out_root / path / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(page_html(page, lang, path, root, meta, paper), encoding="utf-8")
            count += 1
    for lang in LANGS:
        (out_root / NOT_FOUND[lang]).write_text(page_html("404", lang, NOT_FOUND[lang], base, meta, paper),
                                           encoding="utf-8")
        count += 1
    print(f"wrote {count} pages to {out_root}")


if __name__ == "__main__":
    main()
