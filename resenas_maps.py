"""Lee hasta 4 reseñas reales del preview público de Google Maps.

Misma lectura que EjemploResenas.parse (docs/ejemplo/resenas.js): ficha place_id,
preview/place, nombre + texto recortado + estrellas. Si falla, devuelve lista vacía.
No inventa reseñas.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

TOPE = 160
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
_CHIJ = re.compile(r"19s(ChIJ[A-Za-z0-9_-]+)|(ChIJ[A-Za-z0-9_-]{16,})")
_HEX = re.compile(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)", re.I)
_PREVIEW = re.compile(r'href="(/maps/preview/place\?[^"]+)"')


def ficha_id(link: str) -> str:
    s = str(link or "")
    ch = _CHIJ.search(s)
    if ch:
        return ch.group(1) or ch.group(2) or ""
    hx = _HEX.search(s)
    return hx.group(1) if hx else ""


def recortar(texto: str) -> str:
    s = re.sub(r"\s+", " ", str(texto or "")).strip()
    if len(s) <= TOPE:
        return s
    cut = s[:TOPE]
    sp = cut.rfind(" ")
    base = cut[:sp] if sp > 80 else cut
    return re.sub(r"[.,;: ]+$", "", base) + "…"


def _en(node, idx: tuple[int, ...]):
    for k in idx:
        if not isinstance(node, list) or k < 0 or k >= len(node):
            return None
        node = node[k]
    return node


def _redondear(n: float) -> int:
    return int(n + 0.5) if n >= 0 else int(n - 0.5)


def parse_preview(raw: str) -> list[dict]:
    text = re.sub(r"^\)\]\}'\s*", "", str(raw or ""))
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    lista = _en(data, (6, 175, 9, 0, 0))
    if not isinstance(lista, list):
        return []
    out: list[dict] = []
    for item in lista:
        el = item[0] if isinstance(item, list) and item and isinstance(item[0], list) else item
        nombre = _en(el, (1, 4, 5, 0)) or _en(el, (1, 4, 4)) or _en(el, (0, 1))
        texto = _en(el, (2, 15, 0, 0)) or _en(el, (2, 15, 0))
        estrellas = _en(el, (2, 0, 0))
        if not isinstance(estrellas, (int, float)):
            estrellas = _en(el, (2, 0))
        if not isinstance(nombre, str) or not isinstance(texto, str):
            continue
        nombre = re.sub(r"\s+", " ", nombre).strip()
        texto = re.sub(r"\s+", " ", texto).strip()
        if not nombre or not texto:
            continue
        if not isinstance(estrellas, (int, float)) or estrellas < 1 or estrellas > 5:
            estrellas_n = 0
        else:
            estrellas_n = _redondear(float(estrellas))
        out.append(
            {
                "nombre": nombre[:40],
                "texto": recortar(texto),
                "estrellas": estrellas_n,
            }
        )
    altas = [r for r in out if r["estrellas"] >= 4]
    bajas = [r for r in out if r["estrellas"] < 4]
    return (altas + bajas)[:4]


def _fetch(url: str, timeout: float) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def leer_resenas(link: str, timeout: float = 8) -> list[dict]:
    """Hasta 4 reseñas reales. [] si la ficha cargó y no hay texto.

    Si Maps no responde, lanza URLError o TimeoutError para poder reintentar después.
    """
    place = ficha_id(link)
    if not place:
        return []
    page = _fetch(
        "https://www.google.com/maps/place/?q=place_id:"
        + urllib.parse.quote(place)
        + "&hl=es",
        timeout,
    )
    encontrado = _PREVIEW.search(page)
    if not encontrado:
        return []
    prev = "https://www.google.com" + html.unescape(encontrado.group(1))
    cuerpo = _fetch(prev, timeout)
    return parse_preview(cuerpo)


def completar_resenas(rows: list[dict], timeout: float = 8, workers: int = 3) -> int:
    """Completa reseñas_texto en cada fila que tenga link de Maps. Devuelve cuántas quedaron con texto."""
    flag = os.environ.get("RESENAS_MAPS", "1").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return 0
    pendientes = [r for r in rows if (r.get("link_maps") or "").strip() and not r.get("reseñas_texto")]

    def una(row: dict) -> tuple[dict, list[dict]]:
        try:
            return row, leer_resenas(row.get("link_maps") or "", timeout=timeout)
        except Exception as exc:  # noqa: BLE001 — una ficha no puede frenar el resto
            print(f"reseñas: {row.get('nombre')}: {exc}", file=sys.stderr)
            return row, []

    con_texto = 0
    if not pendientes:
        return 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futuros = [pool.submit(una, row) for row in pendientes]
        for fut in as_completed(futuros):
            row, revs = fut.result()
            if revs:
                row["reseñas_texto"] = revs
                con_texto += 1
                print(
                    f"reseñas: {row.get('nombre') or '?'} · {len(revs)}",
                    file=sys.stderr,
                )
    print(f"reseñas guardadas: {con_texto} de {len(pendientes)}", file=sys.stderr)
    return con_texto


_SALTAR = {"index.json", "estado.json", "combos.json"}


def completar_directorio(data_dir: Path, timeout: float = 8, workers: int = 3) -> dict:
    """Agrega reseñas_texto a los JSON ya guardados. No borra otros campos."""
    from pathlib import Path as _Path

    data_dir = _Path(data_dir)
    archivos = 0
    actualizados = 0
    fallos = 0
    for path in sorted(data_dir.glob("*.json")):
        if path.name in _SALTAR:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        prospects = data.get("prospects") if isinstance(data, dict) else None
        if not isinstance(prospects, list):
            continue
        pendientes = [
            p for p in prospects
            if isinstance(p, dict)
            and (p.get("link_maps") or "").strip()
            and "reseñas_texto" not in p
        ]
        if not pendientes:
            continue

        def una(row: dict) -> tuple[dict, bool, list]:
            try:
                revs = leer_resenas(row.get("link_maps") or "", timeout=timeout)
                return row, True, revs
            except Exception as exc:  # noqa: BLE001
                print(f"reseñas: {row.get('nombre')}: {exc}", file=sys.stderr)
                return row, False, []

        cambio = False
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            for fut in as_completed([pool.submit(una, p) for p in pendientes]):
                row, ok, revs = fut.result()
                if not ok:
                    fallos += 1
                    continue
                row["reseñas_texto"] = revs
                cambio = True
                if revs:
                    actualizados += 1
                    print(f"reseñas: {path.name} · {row.get('nombre') or '?'} · {len(revs)}", file=sys.stderr)
        if cambio:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            archivos += 1
    print(
        f"completar: {actualizados} negocios con texto en {archivos} archivos ({fallos} fallos)",
        file=sys.stderr,
    )
    return {"negocios": actualizados, "archivos": archivos, "fallos": fallos}


def main() -> int:
    import argparse
    from pathlib import Path as _Path

    ap = argparse.ArgumentParser(description="Completa reseñas en JSON ya guardados")
    ap.add_argument("--json-dir", required=True)
    args = ap.parse_args()
    completar_directorio(_Path(args.json_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
