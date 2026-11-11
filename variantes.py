#!/usr/bin/env python3
"""Expande el rubro de cada query a sinónimos/variantes para cubrir más resultados.

La lista vive en docs/rubros.json (la misma que muestra la página).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.lower().strip())


def catalogo_path() -> Path:
    return Path(__file__).resolve().parent / "docs" / "rubros.json"


def cargar_catalogo() -> dict:
    path = catalogo_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("grupos"), list):
        raise SystemExit(f"ERROR: catálogo inválido {path}")
    return data


def _armar_variantes(data: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for grupo in data["grupos"]:
        for item in grupo.get("items") or []:
            variantes = [str(v).strip() for v in (item.get("variantes") or []) if str(v).strip()]
            claves = [str(item.get("nombre") or "").strip()]
            claves += [str(a).strip() for a in (item.get("alias") or []) if str(a).strip()]
            for clave in claves:
                if clave:
                    out[norm(clave)] = list(variantes)
    return out


CATALOGO = cargar_catalogo()
VARIANTES: dict[str, list[str]] = _armar_variantes(CATALOGO)


def variants_for_rubro(rubro: str) -> list[str]:
    r = rubro.strip()
    if not r:
        return []
    key = norm(r)
    # match exact or startswith / contained
    if key in VARIANTES:
        out = list(VARIANTES[key])
    else:
        out = None
        for k, vals in VARIANTES.items():
            if key == k or key.startswith(k) or k.startswith(key) or key in k or k in key:
                out = list(vals)
                break
        if out is None:
            out = [r]
    # always include original first
    seen: set[str] = set()
    final: list[str] = []
    for v in [r] + out:
        v = v.strip()
        if not v:
            continue
        nk = norm(v)
        if nk in seen:
            continue
        seen.add(nk)
        final.append(v)
    return final


def split_rubro_zona(query: str) -> tuple[str, str] | None:
    q = query.strip()
    m = re.search(r"\s+en\s+", q, flags=re.I)
    if not m:
        return None
    rubro = q[: m.start()].strip()
    zona = q[m.end() :].strip()
    if not rubro or not zona:
        return None
    return rubro, zona


def expand_query_variants(query: str) -> list[str]:
    parts = split_rubro_zona(query)
    if not parts:
        # sin "en": expandir el texto entero como rubro
        return variants_for_rubro(query) or ([query] if query.strip() else [])
    rubro, zona = parts
    return [f"{v} en {zona}" for v in variants_for_rubro(rubro)]


def expand_lines(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for q in expand_query_variants(line):
            if q not in seen:
                seen.add(q)
                out.append(q)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Expandir variantes de rubro")
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--no-variants", action="store_true")
    args = ap.parse_args()
    raw = Path(args.input).read_text(encoding="utf-8").splitlines()
    if args.no_variants:
        queries = [l.strip() for l in raw if l.strip() and not l.strip().startswith("#")]
    else:
        queries = expand_lines(raw)
    Path(args.output).write_text(
        "\n".join(queries) + ("\n" if queries else ""), encoding="utf-8"
    )
    print(f"Variantes: {len([l for l in raw if l.strip()])} → {len(queries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
