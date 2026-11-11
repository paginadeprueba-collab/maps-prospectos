#!/usr/bin/env python3
"""Filtra CSV del scraper gosom/google-maps-scraper: sin website + buenas reseñas."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path


OUT_FIELDS = [
    "nombre",
    "reseñas",
    "rating",
    "telefono",
    "whatsapp",
    "link_maps",
    "direccion",
    "categoria",
    "horarios",
]

# Días como los escribe el scraper (Maps en español).
_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
_DIA_CORTO = {
    "lunes": "lun",
    "martes": "mar",
    "miércoles": "mié",
    "jueves": "jue",
    "viernes": "vie",
    "sábado": "sáb",
    "domingo": "dom",
}


def _get(row: dict, *keys: str) -> str:
    for k in keys:
        if k in row and row[k] is not None:
            v = str(row[k]).strip()
            if v:
                return v
    return ""


def parse_float(val: str) -> float | None:
    if not val:
        return None
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return None


def parse_int(val: str) -> int | None:
    if not val:
        return None
    digits = re.sub(r"[^\d]", "", val)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def clean_phone(raw: str) -> str:
    """Devuelve solo dígitos, normalizando prefijos AR comunes. Vacío si no hay."""
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("54") and len(digits) > 10:
        digits = digits[2:]
    if digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 12 and digits.startswith("11") and digits[2:4] == "15":
        digits = digits[:2] + digits[4:]
    return digits


def whatsapp_link(phone_digits: str) -> str:
    """Solo AMBA móvil/fijo con área 11 (10 dígitos: 11 + 8)."""
    if len(phone_digits) == 10 and phone_digits.startswith("11"):
        return f"https://wa.me/549{phone_digits}"
    return ""


def format_open_hours(raw: str) -> str:
    """Pasa el JSON de horarios del scraper a una línea corta. Vacío si no hay."""
    text = (raw or "").replace("\u202f", " ").replace("\xa0", " ").strip()
    if not text or text in ("{}", "[]", "null", "None"):
        return ""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return ""
    if not isinstance(data, dict):
        return ""
    por_dia: dict[str, str] = {}
    for clave, valor in data.items():
        dia = str(clave or "").strip().lower()
        if isinstance(valor, list):
            horas = ", ".join(str(x).strip() for x in valor if str(x).strip())
        else:
            horas = str(valor or "").strip()
        if dia and horas:
            por_dia[dia] = horas
    if not por_dia:
        return ""

    def es_cerrado(horas: str) -> bool:
        return horas.strip().lower() in ("cerrado", "closed", "cerrado permanentemente")

    seq = [(dia, por_dia[dia]) for dia in _DIAS if dia in por_dia and not es_cerrado(por_dia[dia])]
    if not seq:
        # El scraper dijo el horario y todos los días figuran cerrados.
        if all(es_cerrado(v) for v in por_dia.values()):
            return "Cerrado"
        return ""
    grupos: list[tuple[list[str], str]] = []
    for dia, horas in seq:
        if grupos and grupos[-1][1] == horas:
            grupos[-1][0].append(dia)
        else:
            grupos.append(([dia], horas))
    partes: list[str] = []
    for dias, horas in grupos:
        if len(dias) == 1:
            etiqueta = _DIA_CORTO.get(dias[0], dias[0][:3])
        else:
            etiqueta = f"{_DIA_CORTO.get(dias[0], dias[0][:3])} a {_DIA_CORTO.get(dias[-1], dias[-1][:3])}"
        partes.append(f"{etiqueta} {horas}")
    return " · ".join(partes)[:300]


def website_empty(row: dict) -> bool:
    w = _get(row, "website", "Website", "web", "site")
    if not w:
        return True
    low = w.lower()
    if low in ("n/a", "na", "none", "-", "null", "undefined"):
        return True
    return False


def dedupe_key(row: dict) -> str:
    """Clave estable: place_id, si no link, si no nombre+dirección."""
    pid = _get(row, "place_id", "placeId", "Place ID")
    if pid:
        return f"pid:{pid}"
    link = _get(row, "link", "url", "maps_url", "Link")
    if link:
        # Normalizar query params variables
        base = link.split("?")[0].rstrip("/")
        return f"link:{base}"
    nombre = _get(row, "title", "name", "nombre", "Title").lower()
    dire = _get(row, "address", "complete_address", "direccion", "Address").lower()
    return f"nd:{nombre}|{dire}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Filtrar prospectos sin website")
    ap.add_argument("input_csv", help="CSV crudo del scraper")
    ap.add_argument("output_csv", help="CSV limpio de salida")
    ap.add_argument("--min-rating", type=float, default=4.0)
    ap.add_argument("--min-reviews", type=int, default=10)
    ap.add_argument(
        "--modo",
        choices=("and", "or"),
        default="or",
        help="and = rating Y reseñas; or = rating O reseñas (default)",
    )
    args = ap.parse_args()

    in_path = Path(args.input_csv)
    out_path = Path(args.output_csv)
    if not in_path.is_file():
        print(f"ERROR: no existe {in_path}", file=sys.stderr)
        return 1

    with in_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print("ERROR: CSV sin encabezados", file=sys.stderr)
            return 1
        rows = list(reader)
        cols = list(reader.fieldnames)

    # Dedupe crudo por place_id/link (antes del filtro)
    seen: set[str] = set()
    deduped: list[dict] = []
    for row in rows:
        key = dedupe_key(row)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    n_dupes = len(rows) - len(deduped)

    total = len(rows)
    sin_web = []
    for row in deduped:
        if not website_empty(row):
            continue
        rating = parse_float(_get(row, "review_rating", "rating", "Review Rating"))
        reviews = parse_int(_get(row, "review_count", "reviews", "Review Count"))
        ok_rating = rating is not None and rating >= args.min_rating
        ok_reviews = reviews is not None and reviews >= args.min_reviews
        if args.modo == "and":
            if not (ok_rating and ok_reviews):
                continue
        else:
            if not (ok_rating or ok_reviews):
                continue
        sin_web.append((row, rating, reviews))

    def sort_key(item):
        row, rating, reviews = item
        return (
            rating if rating is not None else -1.0,
            reviews if reviews is not None else -1,
        )

    sin_web.sort(key=sort_key, reverse=True)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        writer.writeheader()
        for row, rating, reviews in sin_web:
            phone = clean_phone(_get(row, "phone", "Phone", "telefono"))
            writer.writerow(
                {
                    "nombre": _get(row, "title", "name", "nombre", "Title"),
                    "reseñas": "" if reviews is None else str(reviews),
                    "rating": "" if rating is None else str(rating),
                    "telefono": phone,
                    "whatsapp": whatsapp_link(phone),
                    "link_maps": _get(row, "link", "url", "maps_url", "Link"),
                    "direccion": _get(row, "address", "complete_address", "direccion", "Address"),
                    "categoria": _get(row, "category", "categoria", "Category"),
                    "horarios": format_open_hours(_get(row, "open_hours", "horarios", "Open Hours")),
                }
            )

    print(f"Columnas CSV origen: {cols}")
    print(f"Filas crudas: {total}")
    print(f"Duplicados removidos: {n_dupes}")
    print(f"Únicas: {len(deduped)}")
    print(f"Sin website: {sum(1 for r in deduped if website_empty(r))}")
    print(
        f"Tras filtro (sin web + rating>={args.min_rating} {args.modo} reseñas>={args.min_reviews}): {len(sin_web)}"
    )
    print(f"Escrito: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
