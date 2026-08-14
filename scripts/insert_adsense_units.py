#!/usr/bin/env python3
"""Inserta y verifica unidades AdSense en los artículos compatibles.

El repositorio contiene varias generaciones de plantillas. La estructura actual
no usa elementos <section>; por eso este script adapta la regla solicitada de
forma conservadora:

* TOC: un único bloque dentro del artículo con clase `toc` o `toc-box`.
* Secciones: encabezados <h2> del artículo (sin contar el <h2> del TOC).
* FAQ: un único bloque o encabezado dentro del artículo con `id="faq"`.

Los artículos sin esas tres referencias inequívocas se omiten y se informan.
El script no modifica el contenido existente: solo inserta bloques en límites
de elementos de bloque. Es idempotente y no tiene dependencias externas.
"""

from __future__ import annotations

import argparse
import html
import math
import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

ADSENSE_URL = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
ADSENSE_URL_RE = re.compile(re.escape(ADSENSE_URL), re.IGNORECASE)
ADSENSE_INS_RE = re.compile(
    r'<ins\b[^>]*\bclass\s*=\s*(["\'])[^"\']*\badsbygoogle\b[^"\']*\1',
    re.IGNORECASE | re.DOTALL,
)
AD_MARKER = "<!-- FERRETERIAUKRA -->"
VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

LOADER_BLOCK = """<!-- Google AdSense Auto Ads -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7032484018692343"
     crossorigin="anonymous"></script>"""

AD_BLOCK = """<!-- FERRETERIAUKRA -->
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-7032484018692343"
     data-ad-slot="1137373683"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>"""


@dataclass
class Element:
    tag: str
    attrs: dict[str, str]
    parent: "Element | None"
    start: int
    start_end: int
    end_start: int | None = None
    end: int | None = None
    children: list["Element"] = field(default_factory=list)

    def attr(self, name: str) -> str:
        return self.attrs.get(name, "")

    def contains(self, other: "Element") -> bool:
        return (
            self.end is not None
            and other.end is not None
            and self.start <= other.start
            and other.end <= self.end
        )


class SourceHTMLParser(HTMLParser):
    """HTMLParser que conserva posiciones absolutas de los elementos."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_offsets = [0]
        self.elements: list[Element] = []
        self.stack: list[Element] = []
        self.errors: list[str] = []
        for match in re.finditer("\n", source):
            self.line_offsets.append(match.end())
        self.feed(source)
        self.close()
        if self.stack:
            tags = ", ".join(element.tag for element in self.stack)
            self.errors.append(f"etiquetas sin cerrar: {tags}")

    def absolute_offset(self) -> int:
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        tag = tag.lower()
        start = self.absolute_offset()
        raw_tag = self.get_starttag_text()
        element = Element(
            tag=tag,
            attrs={key.lower(): value or "" for key, value in attrs},
            parent=self.stack[-1] if self.stack else None,
            start=start,
            start_end=start + len(raw_tag),
        )
        if element.parent:
            element.parent.children.append(element)
        self.elements.append(element)
        if tag in VOID_ELEMENTS:
            element.end_start = element.start_end
            element.end = element.start_end
        else:
            self.stack.append(element)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)
        if self.stack and self.stack[-1].tag == tag.lower():
            element = self.stack.pop()
            element.end_start = element.start_end
            element.end = element.start_end

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        start = self.absolute_offset()
        end = self.source.find(">", start)
        if end < 0:
            self.errors.append(f"cierre <{tag}> incompleto en offset {start}")
            return

        matching_indexes = [
            index for index, element in enumerate(self.stack) if element.tag == tag
        ]
        if not matching_indexes:
            self.errors.append(f"cierre </{tag}> inesperado en offset {start}")
            return

        index = matching_indexes[-1]
        if index != len(self.stack) - 1:
            nested = ", ".join(element.tag for element in self.stack[index + 1 :])
            self.errors.append(
                f"cierre </{tag}> fuera de orden en offset {start}; abiertos: {nested}"
            )

        element = self.stack[index]
        element.end_start = start
        element.end = end + 1
        del self.stack[index:]


def element_text(source: str, element: Element) -> str:
    if element.end_start is None:
        return ""
    content = source[element.start_end : element.end_start]
    content = re.sub(
        r"<(?:script|style)\b.*?</(?:script|style)\s*>",
        " ",
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    content = re.sub(r"<[^>]*>", " ", content)
    return " ".join(html.unescape(content).split())


def is_inside(element: Element, root: Element) -> bool:
    return (
        root.end is not None
        and element.end is not None
        and root.start < element.start
        and element.end <= root.end
    )


def class_tokens(element: Element) -> set[str]:
    return set(element.attr("class").lower().split())


@dataclass
class ArticleStructure:
    toc: Element
    headings: list[Element]
    faq: Element


@dataclass
class Analysis:
    parser: SourceHTMLParser
    structure: ArticleStructure | None
    reason: str | None


def analyze_article(source: str) -> Analysis:
    parser = SourceHTMLParser(source)
    if parser.errors:
        return Analysis(parser, None, "; ".join(parser.errors))

    articles = [
        element
        for element in parser.elements
        if element.tag == "article" and element.end is not None
    ]
    mains = [
        element
        for element in parser.elements
        if element.tag == "main" and element.end is not None
    ]
    if not articles and not mains:
        return Analysis(parser, None, "no tiene un bloque <article> o <main> balanceado")
    root = articles[0] if articles else mains[0]

    descendants = [
        element for element in parser.elements if is_inside(element, root)
    ]
    toc_candidates = [
        element
        for element in descendants
        if class_tokens(element).intersection({"toc", "toc-box"})
    ]
    # Si una plantilla anida elementos con clase de TOC, conservar solo el exterior.
    toc_candidates = [
        element
        for element in toc_candidates
        if not any(
            candidate is not element and candidate.contains(element)
            for candidate in toc_candidates
        )
    ]
    if len(toc_candidates) != 1:
        return Analysis(
            parser,
            None,
            f"TOC inequívoco no disponible (encontrados: {len(toc_candidates)})",
        )
    toc = toc_candidates[0]

    headings = [
        element
        for element in descendants
        if element.tag == "h2" and not toc.contains(element)
    ]
    if not headings:
        return Analysis(parser, None, "no tiene encabezados <h2> de sección")

    faq_candidates = [
        element
        for element in descendants
        if element.attr("id").strip().lower() == "faq"
    ]
    if len(faq_candidates) != 1:
        return Analysis(
            parser,
            None,
            f'bloque id="faq" inequívoco no disponible (encontrados: {len(faq_candidates)})',
        )
    faq = faq_candidates[0]

    faq_heading_candidates = [
        heading
        for heading in headings
        if re.search(
            r"preguntas\s+frecuentes|\bfaq\b",
            element_text(source, heading),
            re.IGNORECASE,
        )
    ]
    if len(faq_heading_candidates) != 1:
        return Analysis(
            parser,
            None,
            "el encabezado de preguntas frecuentes no es inequívoco",
        )
    faq_heading = faq_heading_candidates[0]
    if faq is not faq_heading and not faq.contains(faq_heading):
        return Analysis(
            parser,
            None,
            'el bloque id="faq" no contiene el encabezado de preguntas frecuentes',
        )

    return Analysis(parser, ArticleStructure(toc, headings, faq), None)


def indentation_at(source: str, offset: int) -> tuple[int, str]:
    line_start = source.rfind("\n", 0, offset) + 1
    prefix = source[line_start:offset]
    if prefix.strip():
        raise ValueError(f"la etiqueta en offset {offset} no comienza en un límite de línea")
    return line_start, prefix


def indent_block(block: str, indentation: str) -> str:
    return "\n".join(indentation + line if line else line for line in block.splitlines())


def insertion_before(source: str, element: Element, block: str) -> tuple[int, str]:
    line_start, indentation = indentation_at(source, element.start)
    return line_start, indent_block(block, indentation) + "\n\n"


def insertion_after(source: str, element: Element, block: str) -> tuple[int, str]:
    if element.end is None:
        raise ValueError(f"el elemento <{element.tag}> no tiene cierre")
    _, indentation = indentation_at(source, element.start)
    return element.end, "\n\n" + indent_block(block, indentation)


def apply_insertions(source: str, insertions: Iterable[tuple[int, str]]) -> str:
    result = source
    ordered = sorted(insertions, key=lambda insertion: insertion[0], reverse=True)
    offsets = [offset for offset, _ in ordered]
    if len(offsets) != len(set(offsets)):
        raise ValueError("dos inserciones intentan usar el mismo límite de bloque")
    for offset, content in ordered:
        result = result[:offset] + content + result[offset:]
    return result


def loader_insertion(source: str) -> tuple[int, str]:
    match = re.search(r"^[ \t]*</head\s*>", source, re.IGNORECASE | re.MULTILINE)
    if not match:
        raise ValueError("no se encontró </head> en un límite de línea")
    indentation = re.match(r"[ \t]*", match.group(0)).group(0)
    return match.start(), indent_block(LOADER_BLOCK, indentation) + "\n\n"


def index_ad_insertion(source: str) -> tuple[int, str]:
    pattern = re.compile(
        r'^[ \t]*<section\b(?=[^>]*\bid\s*=\s*(["\'])articulos\1)[^>]*>',
        re.IGNORECASE | re.MULTILINE,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise ValueError(
            f'index.html: se esperó un <section id="articulos">; encontrados: {len(matches)}'
        )
    match = matches[0]
    indentation = re.match(r"[ \t]*", match.group(0)).group(0)
    return match.start(), indent_block(AD_BLOCK, indentation) + "\n\n"


@dataclass
class RunReport:
    published: int = 0
    compatible: list[str] = field(default_factory=list)
    incompatible: list[tuple[str, str]] = field(default_factory=list)
    stubs: list[str] = field(default_factory=list)
    changed_html: list[str] = field(default_factory=list)
    inserted_ads: int = 0
    inserted_loaders: int = 0


def process(root: Path, apply: bool) -> RunReport:
    report = RunReport()
    blog_dir = root / "blog"
    paths = sorted(blog_dir.glob("*.html"))

    for path in paths:
        relative = path.relative_to(root).as_posix()
        if path.stat().st_size <= 2:
            report.stubs.append(relative)
            continue
        report.published += 1
        source = path.read_text(encoding="utf-8")
        loader_count = len(ADSENSE_URL_RE.findall(source))
        ins_count = len(ADSENSE_INS_RE.findall(source))
        marker_count = source.count(AD_MARKER)

        analysis = analyze_article(source)
        if analysis.structure is None:
            report.incompatible.append((relative, analysis.reason or "estructura incompatible"))
        else:
            report.compatible.append(relative)

        insertions: list[tuple[int, str]] = []
        if loader_count == 0:
            insertions.append(loader_insertion(source))
            report.inserted_loaders += 1
        elif loader_count != 1:
            raise ValueError(f"{relative}: adsbygoogle.js aparece {loader_count} veces")

        if analysis.structure is not None:
            if ins_count == 0 and marker_count == 0:
                structure = analysis.structure
                middle_index = math.ceil(len(structure.headings) / 2) - 1
                insertions.extend(
                    [
                        insertion_after(source, structure.toc, AD_BLOCK),
                        insertion_before(
                            source, structure.headings[middle_index], AD_BLOCK
                        ),
                        insertion_before(source, structure.faq, AD_BLOCK),
                    ]
                )
                report.inserted_ads += 3
            elif ins_count == 3 and marker_count == 3:
                pass  # El archivo ya fue procesado correctamente.
            else:
                raise ValueError(
                    f"{relative}: estado parcial de anuncios "
                    f"({ins_count} <ins>, {marker_count} marcadores)"
                )
        elif ins_count or marker_count:
            raise ValueError(
                f"{relative}: estructura incompatible con anuncios preexistentes"
            )

        if insertions:
            updated = apply_insertions(source, insertions)
            report.changed_html.append(relative)
            if apply:
                path.write_text(updated, encoding="utf-8")

    index_path = root / "index.html"
    index_source = index_path.read_text(encoding="utf-8")
    index_loader_count = len(ADSENSE_URL_RE.findall(index_source))
    index_ins_count = len(ADSENSE_INS_RE.findall(index_source))
    index_marker_count = index_source.count(AD_MARKER)
    if index_loader_count != 1:
        raise ValueError(
            f"index.html: adsbygoogle.js aparece {index_loader_count} veces"
        )
    if index_ins_count == 0 and index_marker_count == 0:
        updated = apply_insertions(index_source, [index_ad_insertion(index_source)])
        report.changed_html.append("index.html")
        report.inserted_ads += 1
        if apply:
            index_path.write_text(updated, encoding="utf-8")
    elif index_ins_count == 1 and index_marker_count == 1:
        pass
    else:
        raise ValueError(
            "index.html: estado parcial de anuncios "
            f"({index_ins_count} <ins>, {index_marker_count} marcadores)"
        )

    return report


def verify(root: Path, compatible_paths: set[str]) -> list[str]:
    errors: list[str] = []
    for path in sorted((root / "blog").glob("*.html")):
        relative = path.relative_to(root).as_posix()
        if path.stat().st_size <= 2:
            continue
        source = path.read_text(encoding="utf-8")
        loader_count = len(ADSENSE_URL_RE.findall(source))
        ins_count = len(ADSENSE_INS_RE.findall(source))
        marker_count = source.count(AD_MARKER)
        expected_ads = 3 if relative in compatible_paths else 0
        if loader_count != 1:
            errors.append(f"{relative}: {loader_count} cargadores (esperado: 1)")
        if ins_count != expected_ads:
            errors.append(
                f"{relative}: {ins_count} unidades <ins> (esperado: {expected_ads})"
            )
        if marker_count != expected_ads:
            errors.append(
                f"{relative}: {marker_count} marcadores (esperado: {expected_ads})"
            )
        parser = SourceHTMLParser(source)
        if parser.errors:
            errors.append(f"{relative}: {'; '.join(parser.errors)}")

    index_source = (root / "index.html").read_text(encoding="utf-8")
    if len(ADSENSE_URL_RE.findall(index_source)) != 1:
        errors.append("index.html: el cargador adsbygoogle.js no aparece una sola vez")
    if len(ADSENSE_INS_RE.findall(index_source)) != 1:
        errors.append("index.html: no contiene exactamente una unidad <ins>")
    if index_source.count(AD_MARKER) != 1:
        errors.append("index.html: no contiene exactamente un marcador de anuncio")
    index_parser = SourceHTMLParser(index_source)
    if index_parser.errors:
        errors.append(f"index.html: {'; '.join(index_parser.errors)}")
    return errors


def print_report(report: RunReport, mode: str) -> None:
    print(f"Modo: {mode}")
    print(f"Artículos publicados (>2 bytes): {report.published}")
    print(f"Artículos compatibles: {len(report.compatible)}")
    print(f"Artículos con estructura incompatible: {len(report.incompatible)}")
    print(f"Stubs omitidos: {len(report.stubs)}")
    print(f"Archivos HTML a modificar/modificados: {len(report.changed_html)}")
    print(f"Cargadores a insertar/insertados: {report.inserted_loaders}")
    print(f"Anuncios a insertar/insertados: {report.inserted_ads}")

    if report.stubs:
        print("\nStubs omitidos:")
        for path in report.stubs:
            print(f"- {path}")

    if report.incompatible:
        print("\nArtículos omitidos por estructura:")
        for path, reason in report.incompatible:
            print(f"- {path}: {reason}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="raíz del repositorio",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="escribe los cambios; sin esta opción solo hace una simulación",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        report = process(args.root.resolve(), apply=args.apply)
        print_report(report, "aplicar" if args.apply else "simulación")
        if args.apply:
            errors = verify(args.root.resolve(), set(report.compatible))
            if errors:
                print("\nErrores de verificación:", file=sys.stderr)
                for error in errors:
                    print(f"- {error}", file=sys.stderr)
                return 1
            print("\nVerificación completada sin errores.")
        return 0
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
