#!/usr/bin/env python3
"""Pruebas del buscador: rubros, horarios y la marca de lo ya elegido."""
from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from filtrar import format_open_hours, pasa_umbral  # noqa: E402
from seleccion import parse_queries  # noqa: E402
from variantes import CATALOGO, norm, variants_for_rubro  # noqa: E402

ANTERIORES = [
    "abogados",
    "odontólogos",
    "cirugía estética",
    "clínicas estéticas",
    "inmobiliarias",
    "contadores",
    "arquitectos",
    "veterinarias",
    "psicólogos",
    "plomeros",
    "electricistas",
    "cerrajeros",
    "gasistas",
    "mudanzas",
    "fumigadores",
    "aire acondicionado",
    "mecánicos",
    "peluquerías",
    "barberías",
    "uñas",
    "gimnasios",
    "panaderías",
    "kioscos",
    "ferreterías",
    "restaurantes",
]


def _items():
    out = []
    for grupo in CATALOGO["grupos"]:
        out.extend(grupo["items"])
    return out


class RubrosTest(unittest.TestCase):
    def test_siguen_los_25_de_antes(self):
        nombres = {norm(it["nombre"]) for it in _items()}
        for nombre in ANTERIORES:
            self.assertIn(norm(nombre), nombres)

    def test_hay_45_rubros_nuevos(self):
        self.assertEqual(len(_items()), 95)
        self.assertEqual(len(_items()) - len(ANTERIORES), 70)

    def test_abogados_sigue_buscando_estudio_juridico(self):
        variantes = variants_for_rubro("abogados")
        self.assertIn("estudio jurídico", variantes)
        self.assertIn("abogado laboral", variantes)
        self.assertEqual(variantes[0], "abogados")

    def test_dentistas_sigue_siendo_alias(self):
        variantes = variants_for_rubro("dentistas")
        self.assertIn("dentista", variantes)
        self.assertIn("odontólogos", variantes)

    def test_cada_rubro_se_encuentra_a_si_mismo(self):
        for it in _items():
            got = variants_for_rubro(it["nombre"])
            self.assertGreaterEqual(len(got), 2, it["nombre"])
            self.assertEqual(norm(got[0]), norm(it["nombre"]))

    def test_spa_no_se_confunde_con_otro(self):
        got = [norm(v) for v in variants_for_rubro("spa")]
        self.assertIn("spa", got)
        self.assertNotIn("psicologos", got)
        self.assertNotIn("psicólogo", got)


class HorariosTest(unittest.TestCase):
    def test_arma_la_linea_con_el_json_de_maps(self):
        raw = (
            '{"domingo":["Cerrado"],"jueves":["9 a.m.–7 p.m."],'
            '"lunes":["9 a.m.–7 p.m."],"martes":["9 a.m.–7 p.m."],'
            '"miércoles":["9 a.m.–7 p.m."],"sábado":["Cerrado"],'
            '"viernes":["9 a.m.–7 p.m."]}'
        )
        self.assertEqual(format_open_hours(raw), "lun a vie 9 a.m.–7 p.m.")

    def test_vacio_si_no_hay(self):
        self.assertEqual(format_open_hours(""), "")
        self.assertEqual(format_open_hours("{}"), "")
        self.assertEqual(format_open_hours("no-es-json"), "")

    def test_filtrar_guarda_el_horario(self):
        raw = (
            '{"lunes":["9 a.m.–7 p.m."],"martes":["9 a.m.–7 p.m."],'
            '"miércoles":["9 a.m.–7 p.m."],"jueves":["9 a.m.–7 p.m."],'
            '"viernes":["9 a.m.–7 p.m."],"sábado":["Cerrado"],"domingo":["Cerrado"]}'
        )
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "raw.csv"
            dst = Path(tmp) / "limpio.csv"
            with src.open("w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(
                    f,
                    fieldnames=[
                        "title",
                        "phone",
                        "website",
                        "review_rating",
                        "review_count",
                        "link",
                        "address",
                        "category",
                        "open_hours",
                        "place_id",
                    ],
                )
                w.writeheader()
                w.writerow(
                    {
                        "title": "Estudio Sin Web",
                        "phone": "+54 11 4444-5555",
                        "website": "",
                        "review_rating": "4.8",
                        "review_count": "25",
                        "link": "https://maps.example/a",
                        "address": "Calle 1",
                        "category": "Abogado",
                        "open_hours": raw,
                        "place_id": "p1",
                    }
                )
                w.writerow(
                    {
                        "title": "Estudio Con Web",
                        "phone": "+54 11 4444-6666",
                        "website": "https://ejemplo.com",
                        "review_rating": "5",
                        "review_count": "40",
                        "link": "https://maps.example/b",
                        "address": "Calle 2",
                        "category": "Abogado",
                        "open_hours": raw,
                        "place_id": "p2",
                    }
                )
            subprocess.check_call(
                [sys.executable, str(ROOT / "filtrar.py"), str(src), str(dst)],
                cwd=ROOT,
            )
            with dst.open(encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["nombre"], "Estudio Sin Web")
        self.assertEqual(rows[0]["horarios"], "lun a vie 9 a.m.–7 p.m.")
        self.assertTrue(rows[0]["whatsapp"].startswith("https://wa.me/54911"))


class SeleccionTest(unittest.TestCase):
    def test_separa_rubro_y_barrio(self):
        data = parse_queries(
            [
                "abogados en Palermo, CABA",
                "abogados en Villa Ortúzar, CABA",
                "abogados en Morón",
            ]
        )
        self.assertEqual(norm(data["rubro"]), "abogados")
        self.assertEqual(data["barrios"], ["Palermo", "Villa Ortúzar"])
        self.assertEqual(data["lugares"], ["Morón"])

    def test_combos_recuperados_tienen_palermo(self):
        path = ROOT / "docs" / "data" / "combos.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        combos = data["combos"]
        palermo = [
            c
            for c in combos
            if c.get("id") == "20261105-225050_abogados-1-barrio-caba"
        ]
        self.assertEqual(len(palermo), 1)
        self.assertEqual(palermo[0]["barrios"], ["Palermo"])
        self.assertEqual(palermo[0]["n_limpio"], 15)
        self.assertEqual(norm(palermo[0]["rubro"]), "abogados")
        # No se pierde ninguna sesión ya publicada: las que tienen barrios
        # recuperados apuntan a un id que existe en el índice.
        indice = json.loads((ROOT / "docs" / "data" / "index.json").read_text(encoding="utf-8"))
        ids = {s["id"] for s in indice["searches"]}
        for c in combos:
            if c.get("id"):
                self.assertIn(c["id"], ids)


class FiltroResenasTest(unittest.TestCase):
    def test_umbral_and_exige_rating_y_resenas(self):
        # Causa del problema: con modo "or", un 5.0 y 1 reseña pasaba.
        self.assertFalse(pasa_umbral(5.0, 1, 4.0, 20, "and"))
        self.assertFalse(pasa_umbral(5.0, 10, 4.0, 20, "and"))
        self.assertTrue(pasa_umbral(4.8, 20, 4.0, 20, "and"))
        self.assertTrue(pasa_umbral(4.5, 50, 4.0, 20, "and"))
        self.assertFalse(pasa_umbral(3.5, 40, 4.0, 20, "and"))
        self.assertFalse(pasa_umbral(4.8, None, 4.0, 20, "and"))
        self.assertTrue(pasa_umbral(4.8, 12, 4.0, 10, "and"))
        self.assertFalse(pasa_umbral(4.8, 9, 4.0, 10, "and"))

    def _run(self, rows, extra_args=None):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "raw.csv"
            dst = Path(tmp) / "limpio.csv"
            fields = [
                "title", "phone", "website", "review_rating", "review_count",
                "link", "address", "category", "place_id",
            ]
            with src.open("w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=fields)
                w.writeheader()
                for i, row in enumerate(rows):
                    w.writerow({
                        "title": row["title"],
                        "phone": "+54 11 4444-0000",
                        "website": row.get("website", ""),
                        "review_rating": row["rating"],
                        "review_count": row["reviews"],
                        "link": f"https://maps.example/{i}",
                        "address": "Calle 1",
                        "category": "Rubro",
                        "place_id": f"p{i}",
                    })
            cmd = [sys.executable, str(ROOT / "filtrar.py"), str(src), str(dst)]
            if extra_args:
                cmd.extend(extra_args)
            subprocess.check_call(cmd, cwd=ROOT)
            with dst.open(encoding="utf-8") as f:
                return list(csv.DictReader(f))

    def test_default_saca_al_de_1_resena_y_al_que_tiene_web(self):
        out = self._run([
            {"title": "Uno", "rating": "5.0", "reviews": "1"},
            {"title": "Con Web", "rating": "5.0", "reviews": "80", "website": "https://ejemplo.com"},
            {"title": "Diez", "rating": "4.9", "reviews": "10"},
            {"title": "Cincuenta", "rating": "4.6", "reviews": "50"},
            {"title": "Cuarenta", "rating": "4.8", "reviews": "40"},
            {"title": "Veinte", "rating": "4.7", "reviews": "20"},
        ])
        nombres = [r["nombre"] for r in out]
        self.assertEqual(nombres, ["Cincuenta", "Cuarenta", "Veinte"])
        self.assertNotIn("Uno", nombres)
        self.assertNotIn("Diez", nombres)
        self.assertNotIn("Con Web", nombres)

    def test_minimo_10_deja_pasar_al_de_10(self):
        out = self._run(
            [
                {"title": "Uno", "rating": "5.0", "reviews": "1"},
                {"title": "Diez", "rating": "4.9", "reviews": "10"},
                {"title": "Cincuenta", "rating": "4.6", "reviews": "50"},
            ],
            extra_args=["--min-reviews", "10", "--modo", "and"],
        )
        self.assertEqual([r["nombre"] for r in out], ["Cincuenta", "Diez"])

    def test_fabrica_tiene_selector_de_resenas_con_default_cinco(self):
        html = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
        yml = (ROOT / ".github" / "workflows" / "buscar.yml").read_text(encoding="utf-8")
        self.assertIn('id="minResenasBox"', html)
        self.assertIn('id="minResenasFiltro"', html)
        self.assertIn("min_resenas: minResenas", html)
        self.assertIn('<option value="0">', html)
        self.assertIn('<option value="3">', html)
        self.assertIn('<option value="5" selected>', html)
        self.assertIn('<option value="10">', html)
        self.assertIn('<option value="20">', html)
        self.assertIn('<option value="30">', html)
        self.assertNotIn('<option value="20" selected>', html)
        self.assertIn('<option value="reviews" selected>', html)
        self.assertIn("n >= 0", html)
        self.assertIn('minResenasDe("minResenasBox", 5)', html)
        self.assertIn('--modo and', yml)
        self.assertIn('default: "5"', yml)




if __name__ == "__main__":
    unittest.main()
