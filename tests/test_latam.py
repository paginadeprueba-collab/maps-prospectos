#!/usr/bin/env python3
"""Pruebas del modo «Provincias y Latinoamérica»: zonas, país, teléfonos, variantes y workflow.
Correr: python3 tests/test_latam.py"""
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

import paises  # noqa: E402
from filtrar import clean_phone, excluir_como_tienda, telefono_y_whatsapp, whatsapp_link  # noqa: E402
from resumen import build_json_payload, load_seleccion  # noqa: E402
from seleccion import parse_queries  # noqa: E402
from variantes import CATALOGO, expand_query_variants, variants_for_rubro  # noqa: E402

ZONAS = json.loads((ROOT / "docs" / "zonas-latam.json").read_text(encoding="utf-8"))
P = {p["id"]: p for p in ZONAS["paises"]}


class ZonasTest(unittest.TestCase):
    def test_argentina_tiene_23_provincias_sin_caba(self):
        regiones = [r["nombre"] for r in P["AR"]["regiones"]]
        self.assertEqual(len(regiones), 23)
        self.assertEqual(len(set(regiones)), 23)
        for r in regiones:
            self.assertNotIn("autónoma", r.lower())
            self.assertNotEqual(r.upper(), "CABA")
        self.assertIn("Tierra del Fuego", regiones)
        self.assertIn("Santiago del Estero", regiones)

    def test_paises_de_latinoamerica(self):
        esperados = {"AR", "UY", "CL", "PY", "BO", "PE", "EC", "CO", "VE", "MX", "CR", "PA", "GT", "HN", "SV", "NI", "DO", "PR", "CU"}
        self.assertTrue(esperados <= set(P), esperados - set(P))
        self.assertGreaterEqual(len(P), 19)

    def test_codigos_de_pais(self):
        codigos = {"AR": "54", "UY": "598", "CL": "56", "PY": "595", "BO": "591", "PE": "51", "EC": "593", "CO": "57",
                   "VE": "58", "MX": "52", "CR": "506", "PA": "507", "GT": "502", "HN": "504", "SV": "503", "NI": "505",
                   "DO": "1", "PR": "1", "CU": "53"}
        for iso, cod in codigos.items():
            self.assertEqual(P[iso]["codigo_tel"], cod, iso)

    def test_estructura_valida(self):
        for p in ZONAS["paises"]:
            self.assertTrue(p["nombre"] and p["id"] and p["codigo_tel"].isdigit(), p)
            self.assertTrue(p["largo_nacional"] and all(isinstance(x, int) for x in p["largo_nacional"]), p["id"])
            self.assertTrue(p["regiones"], p["id"])
            nombres = [r["nombre"] for r in p["regiones"]]
            self.assertEqual(len(nombres), len(set(nombres)), p["id"])
            for r in p["regiones"]:
                self.assertTrue(r["ciudades"], (p["id"], r["nombre"]))
                self.assertEqual(len(r["ciudades"]), len(set(r["ciudades"])), (p["id"], r["nombre"]))
                for c in r["ciudades"]:
                    self.assertTrue(c.strip() == c and c, (p["id"], r["nombre"], c))
                    self.assertFalse(any(ch in c for ch in ";|,\n"), c)

    def test_ciudades_conocidas(self):
        def ciudades(iso):
            return {c for r in P[iso]["regiones"] for c in r["ciudades"]}
        self.assertIn("Rosario", ciudades("AR"))
        self.assertIn("Montevideo", ciudades("UY"))
        self.assertIn("Guadalajara", ciudades("MX"))
        self.assertIn("Medellín", ciudades("CO"))
        self.assertIn("La Habana", ciudades("CU"))

    def test_barrios_validos(self):
        total = 0
        for p in ZONAS["paises"]:
            for r in p["regiones"]:
                for c, bs in (r.get("barrios") or {}).items():
                    self.assertIn(c, r["ciudades"], (p["id"], r["nombre"], c))
                    claves = [paises.norm(b) for b in bs] if hasattr(paises, "norm") else [b.lower() for b in bs]
                    self.assertEqual(len(claves), len(set(claves)), (p["id"], c))
                    for b in bs:
                        self.assertTrue(b and b.strip() == b, (p["id"], c, b))
                        self.assertFalse(any(ch in b for ch in ";|,\n"), b)
                    total += len(bs)
        self.assertGreaterEqual(total, 1200)

    def test_consulta_con_barrio_es_del_pais(self):
        # El workflow detecta el país por el final de la consulta: con barrio sigue siendo Uruguay.
        self.assertEqual(paises.pais_de_texto("plomeros en Pocitos, Montevideo, Uruguay")["id"], "UY")
        self.assertEqual(paises.pais_de_texto("plomeros en Zona 10, Ciudad de Guatemala, Guatemala")["id"], "GT")

    def test_brasil_fuera(self):
        # Carlos: "Brasil aún no".
        self.assertNotIn("BR", P)
        self.assertIsNone(paises.pais_por_nombre("Brasil"))


class PaisTest(unittest.TestCase):
    def test_pais_desde_la_direccion(self):
        self.assertEqual(paises.pais_de_texto("Av. 18 de Julio 1234, 11100 Montevideo, Departamento de Montevideo, Uruguay")["id"], "UY")
        self.assertEqual(paises.pais_de_texto("Esmeralda 961, C1007 Cdad. Autónoma de Buenos Aires, Argentina")["id"], "AR")
        self.assertEqual(paises.pais_de_texto("Calle 5, San Juan, 00907, Puerto Rico")["id"], "PR")
        self.assertEqual(paises.pais_de_texto("Insurgentes 10, CDMX, Mexico")["id"], "MX")

    def test_no_confunde_calles_con_paises(self):
        self.assertIsNone(paises.pais_de_texto("Uruguay 1234, Rosario"))
        self.assertIsNone(paises.pais_de_texto("Calle 1"))
        self.assertIsNone(paises.pais_de_texto(""))


class TelefonoTest(unittest.TestCase):
    def test_argentina_area_11_igual_que_antes(self):
        self.assertEqual(clean_phone("+54 11 4444-5555"), "1144445555")
        self.assertEqual(whatsapp_link("1144445555"), "https://wa.me/5491144445555")
        self.assertEqual(telefono_y_whatsapp("011 15 4444-5555", paises.AR), ("1144445555", "https://wa.me/5491144445555"))
        self.assertEqual(telefono_y_whatsapp("+54 11 4444-5555", None), ("1144445555", "https://wa.me/5491144445555"))

    def test_argentina_provincias(self):
        self.assertEqual(telefono_y_whatsapp("0351 412-3456", paises.AR), ("3514123456", "https://wa.me/5493514123456"))
        self.assertEqual(telefono_y_whatsapp("+54 9 341 555-1234", paises.AR)[1], "https://wa.me/5493415551234")
        self.assertEqual(telefono_y_whatsapp("12345", paises.AR)[1], "")

    def test_argentina_celulares_con_15(self):
        AR = paises.AR
        self.assertEqual(telefono_y_whatsapp("0351 15-412-3456", AR), ("3514123456", "https://wa.me/5493514123456"))
        self.assertEqual(telefono_y_whatsapp("(03541) 15-123456", AR), ("3541123456", "https://wa.me/5493541123456"))
        self.assertEqual(telefono_y_whatsapp("+54 351 15 412 3456", AR)[1], "https://wa.me/5493514123456")
        self.assertEqual(telefono_y_whatsapp("+54 9 11 7096-5656", AR), ("1170965656", "https://wa.me/5491170965656"))
        caba = "Maza 317, C1206 Cdad. Autónoma de Buenos Aires, Argentina"
        self.assertEqual(telefono_y_whatsapp("15 4444-5555", AR, caba), ("1144445555", "https://wa.me/5491144445555"))
        # Sin área y fuera de CABA no se adivina el área.
        self.assertEqual(telefono_y_whatsapp("15 4444-5555", AR, "Calle 1, La Plata, Buenos Aires, Argentina")[1], "")

    def test_otros_paises(self):
        casos = [
            ("UY", "099 123 456", "+59899123456"),
            ("UY", "2901 2345", "+59829012345"),
            ("CL", "9 8765 4321", "+56987654321"),
            ("PY", "0981 123456", "+595981123456"),
            ("BO", "7123 4567", "+59171234567"),
            ("PE", "987 654 321", "+51987654321"),
            ("EC", "099 123 4567", "+593991234567"),
            ("CO", "300 1234567", "+573001234567"),
            ("VE", "0412-1234567", "+584121234567"),
            ("MX", "55 1234 5678", "+525512345678"),
            ("CR", "8888 1234", "+50688881234"),
            ("PA", "6123-4567", "+50761234567"),
            ("GT", "5123 4567", "+50251234567"),
            ("HN", "9123-4567", "+50491234567"),
            ("SV", "7123 4567", "+50371234567"),
            ("NI", "8123 4567", "+50581234567"),
            ("DO", "(809) 555-1234", "+18095551234"),
            ("PR", "(787) 555-1234", "+17875551234"),
            ("CU", "5 123 4567", "+5351234567"),
        ]
        for iso, raw, tel in casos:
            with self.subTest(iso=iso, raw=raw):
                self.assertEqual(telefono_y_whatsapp(raw, P[iso]), (tel, "https://wa.me/" + tel[1:]))

    def test_internacional_con_mas_queda_igual(self):
        self.assertEqual(telefono_y_whatsapp("+598 99 123 456", P["UY"]), ("+59899123456", "https://wa.me/59899123456"))
        self.assertEqual(telefono_y_whatsapp("+52 1 55 1234 5678", P["MX"])[1], "https://wa.me/525512345678")
        # Un número uruguayo con + en un negocio argentino no se convierte en 549…
        self.assertEqual(telefono_y_whatsapp("+598 99 123 456", paises.AR), ("+59899123456", "https://wa.me/59899123456"))

    def test_con_codigo_sin_mas(self):
        self.assertEqual(telefono_y_whatsapp("598 99 123 456", P["UY"])[0], "+59899123456")

    def test_largo_raro_sin_whatsapp(self):
        tel, wa = telefono_y_whatsapp("123", P["UY"])
        self.assertEqual(wa, "")


class VariantesYSeleccionTest(unittest.TestCase):
    def test_sinonimos_latam_solo_fuera_de_argentina(self):
        uy = expand_query_variants("plomeros en Montevideo, Uruguay")
        self.assertIn("fontanero en Montevideo, Uruguay", uy)
        self.assertNotIn("gasista plomero en Montevideo, Uruguay", uy)
        caba = expand_query_variants("plomeros en Palermo, CABA")
        self.assertEqual(caba, ["plomeros en Palermo, CABA", "plomero en Palermo, CABA", "plomería en Palermo, CABA", "gasista plomero en Palermo, CABA"])
        prov = expand_query_variants("plomeros en Rosario, Santa Fe, Argentina")
        self.assertNotIn("fontanero en Rosario, Santa Fe, Argentina", prov)
        mx = expand_query_variants("dentistas en Guadalajara, Jalisco, México")
        self.assertIn("consultorio dental en Guadalajara, Jalisco, México", mx)

    def test_latam_es_lista_valida(self):
        n = 0
        ids = {p["id"] for p in ZONAS["paises"] if p["id"] != "AR"}
        for g in CATALOGO["grupos"]:
            for it in g["items"]:
                if "latam" in it:
                    n += 1
                    self.assertTrue(it["latam"] and all(isinstance(x, str) and x.strip() for x in it["latam"]), it["nombre"])
                    # Evitar términos que en Maps tiran locales de venta cuando el rubro es un oficio.
                    if it["nombre"] == "plomeros":
                        bajos = " ".join(it["latam"]).lower()
                        self.assertNotIn("plomería", bajos)
                        self.assertNotIn("fontanería", bajos)
                        self.assertNotIn("gasfitería", bajos)
                if "latam_pais" in it:
                    self.assertIsInstance(it["latam_pais"], dict, it["nombre"])
                    self.assertTrue(it["latam_pais"], it["nombre"])
                    for k, vals in it["latam_pais"].items():
                        self.assertIn(k, ids, f"{it['nombre']} país {k}")
                        self.assertTrue(vals and all(isinstance(x, str) and x.strip() for x in vals), f"{it['nombre']} {k}")
        self.assertGreaterEqual(n, 20)

    def test_plomero_chile_busca_gasfiter_no_la_tienda(self):
        cl = expand_query_variants("plomeros en Providencia, Santiago, Chile")
        self.assertIn("gásfiter en Providencia, Santiago, Chile", cl)
        self.assertIn("plomero en Providencia, Santiago, Chile", cl)
        self.assertIn("fontanero en Providencia, Santiago, Chile", cl)
        self.assertTrue(all("plomería" not in q and "fontanería" not in q and "gasfitería" not in q for q in cl))
        pe = expand_query_variants("plomeros en Lima, Lima, Perú")
        self.assertIn("gasfitero en Lima, Lima, Perú", pe)
        ec = expand_query_variants("plomeros en Quito, Pichincha, Ecuador")
        self.assertIn("gasfitero en Quito, Pichincha, Ecuador", ec)
        self.assertIn("plomero en Quito, Pichincha, Ecuador", ec)
        # Argentina no cambia: sigue con plomería y gasista plomero.
        caba = expand_query_variants("plomeros en Palermo, CABA")
        self.assertEqual(
            caba,
            [
                "plomeros en Palermo, CABA",
                "plomero en Palermo, CABA",
                "plomería en Palermo, CABA",
                "gasista plomero en Palermo, CABA",
            ],
        )

    def test_sinonimos_locales_de_otros_oficios(self):
        self.assertIn("corredora de propiedades en Las Condes, Santiago, Chile",
                      expand_query_variants("inmobiliarias en Las Condes, Santiago, Chile"))
        self.assertIn("escribano en Montevideo, Uruguay",
                      expand_query_variants("escribanos en Montevideo, Uruguay"))
        self.assertNotIn("notario en Montevideo, Uruguay",
                         expand_query_variants("escribanos en Montevideo, Uruguay"))
        self.assertIn("notario en Ciudad de México, CDMX, México",
                      expand_query_variants("escribanos en Ciudad de México, CDMX, México"))
        self.assertIn("kinesiólogo en Ñuñoa, Santiago, Chile",
                      expand_query_variants("kinesiólogos en Ñuñoa, Santiago, Chile"))
        self.assertIn("fisioterapeuta en Guadalajara, Jalisco, México",
                      expand_query_variants("kinesiólogos en Guadalajara, Jalisco, México"))
        self.assertIn("destapacaños en Guadalajara, Jalisco, México",
                      expand_query_variants("destapaciones en Guadalajara, Jalisco, México"))
        self.assertIn("destape de alcantarillado en Santiago, Chile",
                      expand_query_variants("destapaciones en Santiago, Chile"))
        self.assertIn("gomería en Montevideo, Uruguay",
                      expand_query_variants("gomerías en Montevideo, Uruguay"))
        self.assertIn("llantera en Guadalajara, Jalisco, México",
                      expand_query_variants("gomerías en Guadalajara, Jalisco, México"))
        self.assertIn("jardín infantil en Santiago, Chile",
                      expand_query_variants("jardines de infantes en Santiago, Chile"))
        # El término original del rubro siempre va primero.
        self.assertEqual(variants_for_rubro("plomeros", latam=True, pais="CL")[0], "plomeros")

    def test_seleccion_guarda_el_pais(self):
        sel = parse_queries(["plomeros en Montevideo, Uruguay", "plomeros en Salto, Uruguay"])
        self.assertEqual(sel["pais"], "Uruguay")
        self.assertEqual(sel["lugares"], ["Montevideo, Uruguay", "Salto, Uruguay"])
        self.assertNotIn("pais", parse_queries(["plomeros en Palermo, CABA"]))

    def test_resumen_lleva_el_pais(self):
        sel = load_seleccion(json.dumps({"rubro": "plomeros", "lugares": ["Rosario, Santa Fe, Argentina"], "pais": "Argentina"}))
        data = build_json_payload([{"nombre": "A", "pais": "Argentina"}], "q", 1, "20261123-000000", "x", seleccion=sel)
        self.assertEqual(data["pais"], "Argentina")
        self.assertEqual(data["prospects"][0]["pais"], "Argentina")
        sin = build_json_payload([{"nombre": "A"}], "q", 1, "20261123-000000", "x", seleccion={"rubro": "x"})
        self.assertNotIn("pais", sin)
        self.assertNotIn("pais", sin["prospects"][0])


class FiltrarTest(unittest.TestCase):
    def test_filtrar_usa_el_pais_de_la_direccion_y_de_la_busqueda(self):
        filas = [
            {"title": "Fontanería UY", "phone": "099 123 456", "address": "Av. Italia 1, 11300 Montevideo, Uruguay", "place_id": "a"},
            {"title": "Plomería AR", "phone": "+54 11 4444-5555", "address": "Maza 317, C1206 Cdad. Autónoma de Buenos Aires, Argentina", "place_id": "b"},
            {"title": "Sin dirección", "phone": "099 765 432", "address": "", "place_id": "c"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            src, dst, sel = Path(tmp) / "raw.csv", Path(tmp) / "limpio.csv", Path(tmp) / "seleccion.json"
            sel.write_text(json.dumps({"rubro": "plomeros", "pais": "Uruguay"}), encoding="utf-8")
            with src.open("w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=["title", "phone", "website", "review_rating", "review_count", "link", "address", "category", "place_id"])
                w.writeheader()
                for x in filas:
                    w.writerow({**x, "website": "", "review_rating": "4.8", "review_count": "30", "link": "", "category": "Plomero"})
            subprocess.check_call([sys.executable, str(ROOT / "filtrar.py"), str(src), str(dst), "--seleccion", str(sel)], cwd=ROOT,
                                  stdout=subprocess.DEVNULL)
            with dst.open(encoding="utf-8") as f:
                rows = {r["nombre"]: r for r in csv.DictReader(f)}
        self.assertEqual(rows["Fontanería UY"]["whatsapp"], "https://wa.me/59899123456")
        self.assertEqual(rows["Fontanería UY"]["pais"], "Uruguay")
        self.assertEqual(rows["Plomería AR"]["whatsapp"], "https://wa.me/5491144445555")
        self.assertEqual(rows["Plomería AR"]["telefono"], "1144445555")
        self.assertEqual(rows["Plomería AR"]["pais"], "Argentina")
        self.assertEqual(rows["Sin dirección"]["pais"], "Uruguay")
        self.assertEqual(rows["Sin dirección"]["whatsapp"], "https://wa.me/59899765432")


    def test_saca_ferreterias_si_el_rubro_es_un_oficio(self):
        filas = [
            {"title": "Fontanero Sur", "category": "Fontanero", "place_id": "a"},
            {"title": "Centro Ferretero", "category": "Ferretería", "place_id": "b"},
            {"title": "Ferretools", "category": "Tienda de herramientas", "place_id": "c"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            src, dst, sel = Path(tmp) / "raw.csv", Path(tmp) / "limpio.csv", Path(tmp) / "seleccion.json"
            sel.write_text(json.dumps({"rubro": "plomeros", "pais": "Chile"}), encoding="utf-8")
            with src.open("w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=["title", "phone", "website", "review_rating", "review_count", "link", "address", "category", "place_id"])
                w.writeheader()
                for x in filas:
                    w.writerow({**x, "phone": "+56912345678", "website": "", "review_rating": "4.5", "review_count": "30", "link": "", "address": "Santiago, Chile"})
            subprocess.check_call([sys.executable, str(ROOT / "filtrar.py"), str(src), str(dst), "--seleccion", str(sel)], cwd=ROOT,
                                  stdout=subprocess.DEVNULL)
            with dst.open(encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
        self.assertEqual([r["nombre"] for r in rows], ["Fontanero Sur"])

    def test_no_saca_ferreterias_si_el_rubro_es_ferreterias(self):
        self.assertFalse(excluir_como_tienda("ferreterías", "Ferretería"))
        self.assertTrue(excluir_como_tienda("plomeros", "Ferretería"))
        self.assertTrue(excluir_como_tienda("electricistas", "Tienda de material eléctrico"))
        self.assertTrue(excluir_como_tienda("pintores", "Pinturería"))
        self.assertFalse(excluir_como_tienda("plomeros", "Fontanero"))
        self.assertFalse(excluir_como_tienda("plomeros", "Instalador de gas"))
        self.assertFalse(excluir_como_tienda("", "Ferretería"))

    def test_filtro_sobre_la_busqueda_real_de_santiago(self):
        path = ROOT / "docs" / "data" / "20261123-165537_plomeros-18-barrios-santiago-chile.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        kept, dropped = [], []
        for p in data["prospects"]:
            (dropped if excluir_como_tienda("plomeros", p.get("categoria") or "") else kept).append(p)
        self.assertGreaterEqual(len(dropped), 40)
        self.assertTrue(any("Fontanero" == p.get("categoria") for p in kept))
        self.assertFalse(any("ferret" in (p.get("categoria") or "").lower() for p in kept))
        self.assertTrue(any("Ferretería" == p.get("categoria") for p in dropped))


class WorkflowTest(unittest.TestCase):

    def test_workflow_pasa_la_seleccion_a_filtrar(self):
        yml = (ROOT / ".github" / "workflows" / "buscar.yml").read_text(encoding="utf-8")
        i_sel = yml.index("> seleccion.json\n          python3 filtrar.py")
        self.assertGreater(i_sel, 0)
        self.assertIn("--seleccion seleccion.json", yml)


if __name__ == "__main__":
    unittest.main(verbosity=1)
