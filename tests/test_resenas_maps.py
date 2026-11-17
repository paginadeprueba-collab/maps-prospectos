"""Parser de reseñas y el completado de JSON ya guardados, sin red."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import resenas_maps
from resumen import build_json_payload


def _review(nombre: str, texto: str, estrellas: float):
    autor = [None] * 5
    autor[4] = [None] * 6
    autor[4][5] = [nombre]
    bloque = [None] * 16
    bloque[0] = [estrellas]
    bloque[15] = [[texto]]
    return [[None, autor, bloque]]


class ParserTests(unittest.TestCase):
    def test_ficha_id_chij(self):
        link = (
            "https://www.google.com/maps/place/X/data=!4m7!3m6!"
            "1s0x95bcb554f7c932b1:0x2761c8cf1b03ac03!19sChIJsTLJ91S1vJURA6wDG8_IYSc"
        )
        self.assertEqual(resenas_maps.ficha_id(link), "ChIJsTLJ91S1vJURA6wDG8_IYSc")

    def test_parse_prefiere_4_y_5_y_recorta(self):
        lista = [
            _review("Ana", "Vinieron al toque y dejaron todo prolijo.", 5),
            _review("Luis", "Más o menos, tardaron.", 3),
            _review("Mora", "Trabajo largo. " + ("palabra " * 40), 4),
            _review("", "Sin nombre no entra.", 5),
        ]
        arbol = [None] * 7
        arbol[6] = [None] * 176
        arbol[6][175] = [None] * 10
        arbol[6][175][9] = [[lista]]
        parsed = resenas_maps.parse_preview(")]}'\n" + json.dumps(arbol))
        self.assertEqual([r["nombre"] for r in parsed], ["Ana", "Mora", "Luis"])
        self.assertEqual(parsed[0]["estrellas"], 5)
        self.assertLessEqual(len(parsed[1]["texto"]), 161)
        self.assertTrue(parsed[1]["texto"].endswith("…"))
        self.assertNotIn("Sin nombre", " ".join(r["texto"] for r in parsed))

    def test_json_de_busqueda_guarda_el_campo(self):
        rows = [{
            "nombre": "Taller",
            "reseñas": "12",
            "rating": "5",
            "telefono": "1133334444",
            "whatsapp": "",
            "link_maps": "https://maps.example/x",
            "direccion": "Calle 1",
            "categoria": "Plomero",
            "horarios": "",
            "reseñas_texto": [{"nombre": "Ana", "texto": "Muy bien.", "estrellas": 5}],
        }]
        payload = build_json_payload(rows, "plomeros", 1, "20261117-000000", "plomeros")
        p = payload["prospects"][0]
        self.assertEqual(p["nombre"], "Taller")
        self.assertEqual(p["reseñas_texto"][0]["nombre"], "Ana")
        self.assertEqual(p["direccion"], "Calle 1")

    def test_completar_no_borra_datos(self):
        original = leer = resenas_maps.leer_resenas

        def falso(link, timeout=8):
            if "falla" in link:
                raise TimeoutError("maps")
            if "vacio" in link:
                return []
            return [{"nombre": "Ana", "texto": "Prolijo.", "estrellas": 5}]

        resenas_maps.leer_resenas = falso
        try:
            with TemporaryDirectory() as tmp:
                path = Path(tmp)
                doc = {
                    "id": "x",
                    "query": "plomeros",
                    "prospects": [
                        {"nombre": "Con link", "link_maps": "https://maps/ok", "telefono": "11"},
                        {"nombre": "Falla", "link_maps": "https://maps/falla", "rating": "5"},
                        {"nombre": "Ya", "link_maps": "https://maps/ya", "reseñas_texto": [
                            {"nombre": "Luis", "texto": "Antes.", "estrellas": 4}
                        ]},
                    ],
                }
                (path / "busca.json").write_text(json.dumps(doc), encoding="utf-8")
                (path / "estado.json").write_text('{"status":"idle"}\n', encoding="utf-8")
                resenas_maps.completar_directorio(path, workers=1)
                out = json.loads((path / "busca.json").read_text(encoding="utf-8"))
                by = {p["nombre"]: p for p in out["prospects"]}
                self.assertEqual(by["Con link"]["telefono"], "11")
                self.assertEqual(by["Con link"]["reseñas_texto"][0]["nombre"], "Ana")
                self.assertNotIn("reseñas_texto", by["Falla"])
                self.assertEqual(by["Ya"]["reseñas_texto"][0]["texto"], "Antes.")
                self.assertEqual(out["query"], "plomeros")
                self.assertEqual((path / "estado.json").read_text(encoding="utf-8"), '{"status":"idle"}\n')
        finally:
            resenas_maps.leer_resenas = original


if __name__ == "__main__":
    unittest.main()
