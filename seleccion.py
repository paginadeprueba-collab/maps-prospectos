#!/usr/bin/env python3
"""Saca el rubro y los barrios de las consultas, para recordar lo ya buscado."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from expandir import BARRIOS_CABA
from variantes import norm

_BARRIO_POR_NORM = {norm(b): b for b in BARRIOS_CABA}


def _split_en(query: str) -> tuple[str, str] | None:
    q = query.strip()
    m = re.search(r"\s+en\s+", q, flags=re.I)
    if not m:
        return None
    rubro = q[: m.start()].strip()
    zona = q[m.end() :].strip()
    if not rubro or not zona:
        return None
    return rubro, zona


def _lugar(zona: str) -> tuple[str | None, str | None]:
    z = re.sub(r",\s*caba\s*$", "", zona.strip(), flags=re.I).strip()
    z = re.sub(r"\s+", " ", z)
    if not z:
        return None, None
    barrio = _BARRIO_POR_NORM.get(norm(z))
    if barrio:
        return barrio, None
    return None, z


def parse_queries(lines: list[str]) -> dict:
    """Devuelve {rubro, barrios, lugares} sin inventar barrios."""
    rubros: list[str] = []
    barrios: list[str] = []
    lugares: list[str] = []
    vistos_b: set[str] = set()
    vistos_l: set[str] = set()
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = _split_en(line)
        if not parts:
            rubros.append(line)
            continue
        rubro, zona = parts
        rubros.append(rubro)
        barrio, lugar = _lugar(zona)
        if barrio:
            key = norm(barrio)
            if key not in vistos_b:
                vistos_b.add(key)
                barrios.append(barrio)
        elif lugar:
            key = norm(lugar)
            if key not in vistos_l:
                vistos_l.add(key)
                lugares.append(lugar)
    rubro_final = ""
    if rubros:
        # El que más se repite. Si empatan, queda el que apareció primero.
        counts: dict[str, int] = {}
        for r in rubros:
            k = norm(r)
            counts[k] = counts.get(k, 0) + 1
        mejor_n = max(counts.values())
        for r in rubros:
            if counts[norm(r)] == mejor_n:
                rubro_final = r.strip()
                break
    return {"rubro": rubro_final, "barrios": barrios, "lugares": lugares}


def main() -> int:
    ap = argparse.ArgumentParser(description="Extraer rubro y barrios de queries")
    ap.add_argument("entrada")
    ap.add_argument("salida")
    args = ap.parse_args()
    lines = Path(args.entrada).read_text(encoding="utf-8").splitlines()
    data = parse_queries(lines)
    Path(args.salida).write_text(json.dumps(data, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Selección: rubro={data['rubro']!r} barrios={len(data['barrios'])} lugares={len(data['lugares'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
