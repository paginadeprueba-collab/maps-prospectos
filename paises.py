#!/usr/bin/env python3
"""Países de Latinoamérica (docs/zonas-latam.json): detectar el país de una
dirección o consulta y normalizar teléfonos/WhatsApp con el código correcto.

Argentina conserva su lógica de siempre (filtrar.clean_phone + 549…)."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_ZONAS = _ROOT / "docs" / "zonas-latam.json"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def cargar() -> list[dict]:
    data = json.loads(_ZONAS.read_text(encoding="utf-8"))
    return list(data.get("paises") or [])


PAISES: list[dict] = cargar()
_POR_NOMBRE: dict[str, dict] = {}
for _p in PAISES:
    for _n in [_p["nombre"], _p["id"]] + list(_p.get("alias") or []):
        _POR_NOMBRE[_norm(_n)] = _p
AR = _POR_NOMBRE["argentina"]


def pais_por_nombre(nombre: str) -> dict | None:
    """'Uruguay', 'UY', 'Mexico'… → dict del país. None si no lo conoce."""
    return _POR_NOMBRE.get(_norm(nombre)) if nombre else None


def pais_de_texto(texto: str) -> dict | None:
    """País al final de una dirección o zona ('…, Montevideo, Uruguay').
    Mira las últimas partes separadas por coma (sin códigos postales)."""
    partes = [p for p in str(texto or "").split(",") if p.strip()]
    while partes and not re.sub(r"[\d\s-]+", "", partes[-1]):
        partes.pop()  # código postal suelto al final
    if not partes:
        return None
    limpio = re.sub(r"\d+", " ", partes[-1])
    p = pais_por_nombre(limpio)
    if p and _norm(limpio) != _norm(p["id"]):  # 'AR' suelto no alcanza
        return p
    return None


def es_argentina(p: dict | None) -> bool:
    return p is None or p.get("id") == "AR"


def whatsapp_ar(phone_digits: str) -> str:
    """Argentina: número nacional de 10 dígitos (área + abonado) → wa.me/549…
    Antes solo se aceptaba el área 11; ahora cualquier área (provincias), también con 15.
    '9' + 10 dígitos (formato móvil internacional sin 54) también es móvil."""
    d = phone_digits or ""
    if len(d) == 11 and d.startswith("9") and d[1] in "123":
        d = d[1:]
    if len(d) == 12 and d.startswith("11") and d[2:4] == "15":
        d = d[:2] + d[4:]
    elif len(d) == 12 and d[0] in "23":
        from filtrar import sacar_15_provincia

        d = sacar_15_provincia(d)
    # Áreas argentinas: 11 o empiezan con 2/3 (un "15…" sin área no alcanza).
    if len(d) == 10 and (d.startswith("11") or d[0] in "23"):
        return f"https://wa.me/549{d}"
    return ""


def normalizar_intl(raw: str, pais: dict) -> tuple[str, str]:
    """Teléfono de un país no argentino → ('+<cód><nacional>', 'https://wa.me/<cód><nacional>').
    Si no se puede armar con seguridad, devuelve los dígitos y sin WhatsApp."""
    texto = str(raw or "").strip()
    digits = re.sub(r"\D", "", texto)
    if not digits:
        return "", ""
    intl = texto.startswith("+") or digits.startswith("00")
    if digits.startswith("00"):
        digits = digits[2:]
    cod = str(pais.get("codigo_tel") or "")
    largos = [int(x) for x in (pais.get("largo_nacional") or [])]
    if intl:
        if pais.get("id") == "MX" and digits.startswith("521") and len(digits) == 13:
            digits = "52" + digits[3:]  # formato viejo de celulares mexicanos
        if 8 <= len(digits) <= 15:
            return "+" + digits, "https://wa.me/" + digits
        return digits, ""
    nacional = digits.lstrip("0")
    if len(nacional) not in largos and cod and digits.startswith(cod) and len(digits) - len(cod) in largos:
        nacional = digits[len(cod):]  # vino con el código de país pero sin '+'
    if len(nacional) in largos:
        return "+" + cod + nacional, "https://wa.me/" + cod + nacional
    return digits, ""
