#!/usr/bin/env python3
"""Genera resumen markdown (mobile) y/o JSON para GitHub Pages."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Argentina sin DST desde 2009 → UTC-3 fijo (evita depender de tzdata en runners)
TZ = timezone(timedelta(hours=-3))


def slugify(text: str, max_len: int = 40) -> str:
    t = text.lower().strip()
    t = (
        t.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )
    t = re.sub(r"[^a-z0-9]+", "-", t)
    t = t.strip("-")[:max_len].strip("-")
    return t or "busqueda"


def load_limpio(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def count_raw(path: Path) -> int:
    if not path.is_file():
        return 0
    with path.open(encoding="utf-8-sig", newline="") as f:
        return sum(1 for _ in csv.DictReader(f))


def build_markdown(rows: list[dict], n_raw: int, query: str, max_items: int = 100) -> str:
    lines: list[str] = []
    lines.append("## Resultado")
    lines.append("")
    lines.append(
        f"Busqueda: **{query or '(sin query)'}**. "
        f"El scraper trajo **{n_raw}** resultados crudos. "
        f"Quedaron **{len(rows)}** prospectos limpios (sin web + filtro de reseñas)."
    )
    lines.append("")
    if not rows:
        lines.append("_No hubo prospectos que pasen el filtro. Probá bajar el mínimo de reseñas o ampliar la zona._")
        lines.append("")
        return "\n".join(lines)

    show = rows[:max_items]
    if len(rows) > max_items:
        lines.append(f"_Mostrando los primeros {max_items} de {len(rows)}. El CSV completo está en el artifact._")
        lines.append("")

    for i, r in enumerate(show, 1):
        nombre = (r.get("nombre") or "Sin nombre").replace("\n", " ").strip()
        rating = r.get("rating") or "—"
        reseñas = r.get("reseñas") or "0"
        cat = (r.get("categoria") or "").strip()
        dire = (r.get("direccion") or "").strip()
        maps = (r.get("link_maps") or "").strip()
        wa = (r.get("whatsapp") or "").strip()
        tel = (r.get("telefono") or "").strip()
        horas = (r.get("horarios") or "").strip()

        lines.append(f"### {i}. {nombre}")
        meta = f"⭐ {rating} ({reseñas} reseñas)"
        if cat:
            meta += f" · {cat}"
        lines.append(meta)
        if dire:
            lines.append(dire)
        if horas:
            lines.append(f"Horario: {horas}")
        parts = []
        if maps:
            parts.append(f"[📍 Ver en Maps]({maps})")
        if wa:
            parts.append(f"[💬 WhatsApp]({wa})")
        elif tel:
            parts.append(f"Tel: {tel}")
        if parts:
            lines.append(" · ".join(parts))
        lines.append("")

    return "\n".join(lines)


def load_seleccion(raw: str) -> dict:
    """JSON en texto o ruta a un archivo. Vacío si no hay nada usable."""
    text = (raw or "").strip()
    if not text:
        return {}
    if not text.startswith("{"):
        path = Path(text)
        if path.is_file():
            text = path.read_text(encoding="utf-8").strip()
        else:
            return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    rubro = str(data.get("rubro") or "").strip()
    barrios = [str(b).strip() for b in (data.get("barrios") or []) if str(b).strip()]
    lugares = [str(b).strip() for b in (data.get("lugares") or []) if str(b).strip()]
    return {"rubro": rubro, "barrios": barrios, "lugares": lugares}


def build_json_payload(
    rows: list[dict],
    query: str,
    n_raw: int,
    timestamp: str,
    slug: str,
    seleccion: dict | None = None,
) -> dict:
    sel = seleccion or {}
    return {
        "id": f"{timestamp}_{slug}",
        "query": query,
        "date": timestamp,
        "date_label": datetime.now(TZ).strftime("%Y-%m-%d %H:%M (America/Buenos_Aires)"),
        "n_raw": n_raw,
        "n_limpio": len(rows),
        "rubro": sel.get("rubro") or "",
        "barrios": list(sel.get("barrios") or []),
        "lugares": list(sel.get("lugares") or []),
        "prospects": [
            {
                "nombre": r.get("nombre") or "",
                "reseñas": r.get("reseñas") or "",
                "rating": r.get("rating") or "",
                "telefono": r.get("telefono") or "",
                "whatsapp": r.get("whatsapp") or "",
                "link_maps": r.get("link_maps") or "",
                "direccion": r.get("direccion") or "",
                "categoria": r.get("categoria") or "",
                "horarios": r.get("horarios") or "",
            }
            for r in rows
        ],
    }


def update_index(index_path: Path, entry: dict) -> None:
    items: list[dict] = []
    if index_path.is_file():
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict) and isinstance(data.get("searches"), list):
                items = data["searches"]
        except json.JSONDecodeError:
            items = []
    # Remove same id if re-run
    items = [x for x in items if x.get("id") != entry["id"]]
    items.insert(
        0,
        {
            "id": entry["id"],
            "query": entry["query"],
            "date": entry["date"],
            "date_label": entry.get("date_label", ""),
            "n_raw": entry.get("n_raw", 0),
            "n_limpio": entry.get("n_limpio", 0),
            "rubro": entry.get("rubro") or "",
            "barrios": list(entry.get("barrios") or []),
            "lugares": list(entry.get("lugares") or []),
            "file": f"{entry['id']}.json",
        },
    )
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps({"searches": items}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limpio", required=True)
    ap.add_argument("--raw", default="")
    ap.add_argument("--query", default="")
    ap.add_argument("--md-out", default="")
    ap.add_argument("--json-dir", default="")
    ap.add_argument("--max-items", type=int, default=100)
    ap.add_argument("--seleccion", default="", help="JSON o archivo con rubro y barrios")
    args = ap.parse_args()

    limpio = Path(args.limpio)
    rows = load_limpio(limpio)
    n_raw = count_raw(Path(args.raw)) if args.raw else 0
    query = args.query.strip() or "(sin query)"

    md = build_markdown(rows, n_raw, query, max_items=args.max_items)
    if args.md_out:
        Path(args.md_out).write_text(md, encoding="utf-8")
    else:
        print(md)

    # Also append to GITHUB_STEP_SUMMARY if present
    import os

    gss = os.environ.get("GITHUB_STEP_SUMMARY")
    if gss:
        with open(gss, "a", encoding="utf-8") as f:
            f.write(md)
            if not md.endswith("\n"):
                f.write("\n")

    if args.json_dir:
        now = datetime.now(TZ)
        ts = now.strftime("%Y%m%d-%H%M%S")
        slug = slugify(query)
        payload = build_json_payload(
            rows, query, n_raw, ts, slug, seleccion=load_seleccion(args.seleccion)
        )
        data_dir = Path(args.json_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        out_file = data_dir / f"{payload['id']}.json"
        out_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        update_index(data_dir / "index.json", payload)
        print(f"JSON: {out_file}", file=sys.stderr)
        print(f"Index: {data_dir / 'index.json'}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
