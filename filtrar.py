#!/usr/bin/env python3
"""Filtra CSV del scraper gosom/google-maps-scraper: sin website + buenas reseñas."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
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
    "pais",
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
    if len(digits) == 11 and digits.startswith("9") and digits[1] in "123":
        digits = digits[1:]  # +54 9 <área> <número>: el 9 es de celular, no del área
    if len(digits) == 12 and digits.startswith("11") and digits[2:4] == "15":
        digits = digits[:2] + digits[4:]
    elif len(digits) == 12 and digits[0] in "23":
        digits = sacar_15_provincia(digits)
    return digits


def sacar_15_provincia(digits: str) -> str:
    """Celular de provincia escrito con 15: área de 3 o 4 dígitos + 15 + número (12 dígitos).
    Ej. 0351 15-412-3456 → 3514123456; 3541 15-123456 → 3541123456."""
    if len(digits) != 12:
        return digits
    if digits[3:5] == "15":
        return digits[:3] + digits[5:]
    if digits[4:6] == "15":
        return digits[:4] + digits[6:]
    return digits


def whatsapp_link(phone_digits: str) -> str:
    """Argentina: 10 dígitos (área + número) → wa.me/549…; el área 11 sale igual que antes."""
    from paises import whatsapp_ar

    return whatsapp_ar(phone_digits)


def telefono_y_whatsapp(raw: str, pais: dict | None, direccion: str = "") -> tuple[str, str]:
    """(telefono, whatsapp) según el país del negocio.
    Argentina: igual que siempre (10 dígitos sin 0/15 y wa.me/549…).
    Otros países, o un número escrito con + de otro país: +<código><número>."""
    from paises import es_argentina, normalizar_intl

    texto = str(raw or "").strip()
    if es_argentina(pais):
        digits = re.sub(r"\D", "", texto)
        if texto.startswith("+") and not digits.startswith("54"):
            # Ya viene en formato internacional de otro país: queda como está.
            return normalizar_intl(texto, {"id": "XX", "codigo_tel": "", "largo_nacional": []})
        phone = clean_phone(texto)
        if len(phone) == 10 and phone.startswith("15") and re.search(r"aut[oó]noma de buenos aires|\bcaba\b", direccion or "", re.I):
            phone = "11" + phone[2:]  # celular porteño escrito sin el 11 (15-xxxx-xxxx)
        return phone, whatsapp_link(phone)
    return normalizar_intl(texto, pais)


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



def pasa_umbral(rating, reviews, min_rating: float, min_reviews: int, modo: str = "and") -> bool:
    """True si cumple el umbral. El 'sin website' se aplica aparte y siempre."""
    ok_rating = rating is not None and rating >= min_rating
    ok_reviews = reviews is not None and reviews >= min_reviews
    if modo == "and":
        return ok_rating and ok_reviews
    return ok_rating or ok_reviews


def pasa_umbral_o_oficio(rating, reviews, min_rating: float, min_reviews: int, modo: str, es_oficio: bool) -> bool:
    """Si es claramente el oficio buscado, no exigimos el mínimo de reseñas (pueblos chicos).
    Si tiene reseñas, el rating igual tiene que llegar al mínimo."""
    if not es_oficio:
        return pasa_umbral(rating, reviews, min_rating, min_reviews, modo)
    n = reviews if reviews is not None else 0
    if n <= 0:
        return True
    r = rating if rating is not None else 0.0
    return r >= min_rating



def _norm_txt(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.lower().strip())


# Rubros que SON un local de venta: no se les saca la categoría tienda.
RUBROS_COMERCIO = {
    "ferreterias",
    "kioscos",
    "panaderias",
    "farmacias",
    "dieteticas",
    "florerias",
    "gomerias",
    "librerias",
    "heladerias",
    "rotiserias",
    "pet shops",
    "carnicerias",
    "verdulerias",
    "opticas",
}

# Categorías de Maps que son un local de venta, no el oficio (plomero, electricista, etc.).
CATEGORIAS_TIENDA = (
    "ferreteria",
    "hardware store",
    "tienda de herramientas",
    "tienda de materiales para la construccion",
    "tienda de materiales de construccion",
    "tienda de articulos para el hogar",
    "tienda de articulos de fontaneria",
    "tienda de equipos de banos",
    "tienda de pinturas",
    "pintureria",
    "centro comercial",
    "shopping center",
    "shopping mall",
    "proveedor de tuberias",
    "proveedor de repuestos",
    "building materials store",
    "home improvement store",
    "home goods store",
    "plumbing supply",
    "houseware store",
    "tienda de material electrico",
    "tienda de articulos de electricidad",
    "supermercado",
    "supermarket",
    "almacen de materiales",
    "deposito de materiales",
    "casa de electricos",
    "casa de electricidad",
    "proveedor de materiales de construccion",
    "proveedor de materiales",
    "tienda de material sanitario",
    "establecimiento de venta de madera",
    "tienda de electricidad",
    "empresa de suministros industriales",
    "corralon",
    "lumber store",
    "lumber yard",
)


def es_rubro_comercio(rubro: str) -> bool:
    k = _norm_txt(rubro)
    if not k:
        return False
    if k in RUBROS_COMERCIO:
        return True
    for c in RUBROS_COMERCIO:
        if k == c or k.startswith(c + " ") or c.startswith(k):
            return True
    return False


def categoria_de_tienda(categoria: str) -> bool:
    c = _norm_txt(categoria)
    if not c:
        return False
    for t in CATEGORIAS_TIENDA:
        if c == t or t in c:
            return True
    if c.startswith("tienda de ") or c.startswith("tienda "):
        return True
    return False


# Palabras en el nombre que delatan un local de venta (corralón, etc.).
NOMBRE_TIENDA = (
    "corralon",
    "ferreteria",
    "ferreterias",
    "todo para la construccion",
    "materiales de construccion",
    "pintureria",
)


def nombre_de_tienda(nombre: str) -> bool:
    n = _norm_txt(nombre)
    if not n:
        return False
    return any(tok in n for tok in NOMBRE_TIENDA)


def excluir_como_tienda(rubro: str, categoria: str, nombre: str = "") -> bool:
    """True si el rubro es un oficio/servicio y Maps o el nombre apuntan a un local de venta."""
    if not rubro or es_rubro_comercio(rubro):
        return False
    return categoria_de_tienda(categoria) or nombre_de_tienda(nombre)


# Categorías que no son el oficio buscado (ni un local de venta ya cubierto).
CATEGORIAS_AJENAS = (
    "gasolinera",
    "gas station",
    "estacion de servicio",
    "estacion de inspeccion de vehiculos",
    "abogado",
    "lawyer",
    "attorney",
    "hospital",
    "parque local",
    "ayuntamiento",
    "club deportivo",
    "lavanderia",
    "alojamiento",
    "lugar de interes historico",
    "comunidad para jubilados",
    "oficina de la administracion",
    "compania del gas",
    "compania suministradora de agua",
    "baños publicos",
    "banos publicos",
)


def categoria_ajena(categoria: str) -> bool:
    c = _norm_txt(categoria)
    if not c:
        return False
    for tok in CATEGORIAS_AJENAS:
        if c == tok or tok in c:
            return True
    return False


# Si coinciden, no exigimos 20 reseñas (en pueblos chicos casi nadie las tiene).
OFICIO_POR_RUBRO = {
    "plomeros": ("fontanero", "plomero", "gasista", "instalador de gas", "plumber", "destapacion", "destapaciones"),
    "gasistas": ("gasista", "instalador de gas", "plomero", "fontanero"),
    "electricistas": ("electricista", "electrician", "instalador electrico"),
    "cerrajeros": ("cerrajero", "locksmith"),
    "pintores": ("pintor", "painter"),
    "albaniles": ("albanil", "mason"),
}


def _claves_rubro(rubro: str) -> tuple[str, ...]:
    k = _norm_txt(rubro)
    if k in OFICIO_POR_RUBRO:
        return OFICIO_POR_RUBRO[k]
    for base, toks in OFICIO_POR_RUBRO.items():
        if k == base or k.startswith(base) or base.startswith(k.rstrip("s")):
            return toks
    return ()


def es_oficio_buscado(rubro: str, categoria: str = "", nombre: str = "") -> bool:
    """True si la categoría o el nombre coinciden con el oficio del rubro."""
    toks = _claves_rubro(rubro)
    if not toks:
        return False
    blob = _norm_txt(f"{categoria} {nombre}")
    if not blob:
        return False
    return any(tok in blob for tok in toks)


def excluir_como_ajeno(rubro: str, categoria: str, nombre: str = "") -> bool:
    """Saca rubros que no tienen nada que ver (YPF, abogados, cerrajeros si buscás plomeros)."""
    if not rubro or es_rubro_comercio(rubro):
        return False
    if es_oficio_buscado(rubro, categoria, nombre):
        return False
    if categoria_ajena(categoria):
        return True
    n = _norm_txt(nombre)
    if any(tok in n for tok in ("electrodomesticos", "lubricentro", "metalurgica")):
        return True
    c = _norm_txt(categoria)
    if c in {"", "comercio"}:
        return True
    ajenos_oficio = {
        "cerrajero": "cerrajeros",
        "locksmith": "cerrajeros",
        "electricista": "electricistas",
        "abogado": "abogados",
    }
    c = _norm_txt(categoria)
    rk = _norm_txt(rubro)
    for tok, rub in ajenos_oficio.items():
        if tok in c and rk != rub and not rk.startswith(rub.rstrip("s")):
            return True
    return False


PROVINCIAS_AR = (
    "buenos aires",
    "ciudad autonoma de buenos aires",
    "capital federal",
    "catamarca",
    "chaco",
    "chubut",
    "cordoba",
    "corrientes",
    "entre rios",
    "formosa",
    "jujuy",
    "la pampa",
    "la rioja",
    "mendoza",
    "misiones",
    "neuquen",
    "rio negro",
    "salta",
    "san juan",
    "san luis",
    "santa cruz",
    "santa fe",
    "santiago del estero",
    "tierra del fuego",
    "tucuman",
)


def _provincias_en(texto: str) -> set[str]:
    n = _norm_txt(texto)
    if not n:
        return set()
    found: set[str] = set()
    if (
        ", caba" in n
        or n.endswith(" caba")
        or n.endswith(",caba")
        or "cdad. autonoma" in n
        or "cdad autonoma" in n
        or "ciudad autonoma de buenos aires" in n
        or "capital federal" in n
    ):
        found.add("ciudad autonoma de buenos aires")
    for p in sorted(PROVINCIAS_AR, key=len, reverse=True):
        if p in n:
            found.add(p)
    return found


def provincias_buscadas(lugares: list | None) -> set[str]:
    out: set[str] = set()
    for l in lugares or []:
        out |= _provincias_en(str(l))
    return out


def direccion_util(direccion: str) -> str:
    """Texto usable de la dirección. Si Maps mandó un JSON vacío, queda en blanco."""
    s = (direccion or "").strip()
    if not s:
        return ""
    if s.startswith("{") and s.endswith("}"):
        try:
            data = json.loads(s)
        except json.JSONDecodeError:
            return s
        if isinstance(data, dict):
            parts = [str(data.get(k) or "").strip() for k in ("street", "borough", "city", "state", "postal_code", "country")]
            s = ", ".join(p for p in parts if p)
    return s


def fuera_de_la_zona(direccion: str, provincias: set[str]) -> bool:
    """True si la dirección es de otra provincia, o no hay dirección cuando la búsqueda es provincial."""
    if not provincias:
        return False
    s = direccion_util(direccion)
    if not s:
        return True
    en_dir = _provincias_en(s)
    if not en_dir:
        return False
    return en_dir.isdisjoint(provincias)


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
    ap.add_argument(
        "--seleccion",
        default="",
        help="seleccion.json de la búsqueda (usa su 'pais' si la dirección no lo dice; default Argentina)",
    )
    ap.add_argument("--min-rating", type=float, default=4.0)
    ap.add_argument("--min-reviews", type=int, default=20)
    ap.add_argument(
        "--modo",
        choices=("and", "or"),
        default="and",
        help="and = rating Y reseñas (default); or = rating O reseñas",
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

    from paises import AR, pais_de_texto, pais_por_nombre

    pais_default = AR
    rubro_sel = ""
    lugares_sel: list[str] = []
    if args.seleccion and Path(args.seleccion).is_file():
        try:
            sel = json.loads(Path(args.seleccion).read_text(encoding="utf-8") or "{}")
            pais_default = pais_por_nombre(str((sel or {}).get("pais") or "")) or AR
            rubro_sel = str((sel or {}).get("rubro") or "").strip()
            lugares_sel = list((sel or {}).get("lugares") or [])
        except (json.JSONDecodeError, AttributeError):
            pais_default = AR
    provincias_sel = provincias_buscadas(lugares_sel)

    total = len(rows)
    sin_web = []
    n_tienda = 0
    n_ajeno = 0
    n_fuera = 0
    for row in deduped:
        if not website_empty(row):
            continue
        categoria = _get(row, "category", "categoria", "Category")
        nombre = _get(row, "title", "name", "nombre", "Title")
        direccion = _get(row, "address", "complete_address", "direccion", "Address")
        if excluir_como_tienda(rubro_sel, categoria, nombre):
            n_tienda += 1
            continue
        if excluir_como_ajeno(rubro_sel, categoria, nombre):
            n_ajeno += 1
            continue
        if fuera_de_la_zona(direccion, provincias_sel):
            n_fuera += 1
            continue
        rating = parse_float(_get(row, "review_rating", "rating", "Review Rating"))
        reviews = parse_int(_get(row, "review_count", "reviews", "Review Count"))
        es_oficio = es_oficio_buscado(rubro_sel, categoria, nombre)
        if not pasa_umbral_o_oficio(rating, reviews, args.min_rating, args.min_reviews, args.modo, es_oficio):
            continue
        sin_web.append((row, rating, reviews))

    def sort_key(item):
        row, rating, reviews = item
        # Más reseñas primero (40, 50+ arriba); a igual cantidad, mejor rating.
        return (
            reviews if reviews is not None else -1,
            rating if rating is not None else -1.0,
        )

    sin_web.sort(key=sort_key, reverse=True)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        writer.writeheader()
        for row, rating, reviews in sin_web:
            direccion = _get(row, "address", "complete_address", "direccion", "Address")
            pais = pais_de_texto(direccion) or pais_default
            phone, wa = telefono_y_whatsapp(_get(row, "phone", "Phone", "telefono"), pais, direccion)
            writer.writerow(
                {
                    "nombre": _get(row, "title", "name", "nombre", "Title"),
                    "reseñas": "" if reviews is None else str(reviews),
                    "rating": "" if rating is None else str(rating),
                    "telefono": phone,
                    "whatsapp": wa,
                    "link_maps": _get(row, "link", "url", "maps_url", "Link"),
                    "direccion": direccion,
                    "categoria": _get(row, "category", "categoria", "Category"),
                    "horarios": format_open_hours(_get(row, "open_hours", "horarios", "Open Hours")),
                    "pais": pais["nombre"],
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
    if n_tienda:
        print(f"Tiendas sacadas (rubro de servicio): {n_tienda}")
    if n_ajeno:
        print(f"Otros rubros sacados (no son el oficio): {n_ajeno}")
    if n_fuera:
        print(f"Fuera de la zona buscada: {n_fuera}")
    print(f"Escrito: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
