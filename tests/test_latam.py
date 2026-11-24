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
from filtrar import (  # noqa: E402
    clean_phone,
    es_oficio_buscado,
    excluir_como_ajeno,
    aplica_filtro_ciudad,
    ciudades_buscadas,
    excluir_como_tienda,
    fuera_de_la_zona,
    coords_de_fila,
    km_entre,
    puntos_en_zona,
    fuera_de_zona_fila,
    fuera_de_las_ciudades,
    pasa_umbral_o_oficio,
    provincias_buscadas,
    telefono_y_whatsapp,
    whatsapp_link,
)
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

    def test_catamarca_tiene_las_cabeceras_departamentales(self):
        cat = next(r for r in P["AR"]["regiones"] if r["nombre"] == "Catamarca")
        cabeceras = {
            "San Fernando del Valle de Catamarca",
            "San Isidro",
            "San José",
            "Belén",
            "Andalgalá",
            "Tinogasta",
            "Santa María",
            "Recreo",
            "Chumbicha",
            "La Merced",
            "La Puerta",
            "Saujil",
            "Ancasti",
            "El Alto",
            "Antofagasta de la Sierra",
            "Bañado de Ovanta",
        }
        self.assertTrue(cabeceras.issubset(set(cat["ciudades"])), set(cat["ciudades"]))
        self.assertGreaterEqual(len(cat["ciudades"]), 16)
        self.assertEqual(len(cat["ciudades"]), len(set(cat["ciudades"])))

    def test_provincias_argentinas_completas(self):
        # Mínimos: una ciudad por departamento/partido (TDF excluye Antártida e Islas).
        minimos = {
            "Buenos Aires": 135, "Catamarca": 16, "Chaco": 25, "Chubut": 15,
            "Córdoba": 26, "Corrientes": 25, "Entre Ríos": 17, "Formosa": 9,
            "Jujuy": 16, "La Pampa": 22, "La Rioja": 18, "Mendoza": 18,
            "Misiones": 17, "Neuquén": 16, "Río Negro": 13, "Salta": 23,
            "San Juan": 19, "San Luis": 9, "Santa Cruz": 7, "Santa Fe": 19,
            "Santiago del Estero": 27, "Tierra del Fuego": 3, "Tucumán": 17,
        }
        hay = {r["nombre"]: r["ciudades"] for r in P["AR"]["regiones"]}
        self.assertEqual(set(hay), set(minimos))
        for prov, n in minimos.items():
            self.assertGreaterEqual(len(hay[prov]), n, prov)
        known = {
            "Buenos Aires": ["Carhué", "Adrogué", "San Justo", "Ramos Mejía", "Monte Grande", "Caseros", "Burzaco", "La Plata", "Mar del Plata"],
            "Catamarca": ["La Puerta", "Recreo", "Antofagasta de la Sierra", "Bañado de Ovanta"],
            "Córdoba": ["Cosquín", "San Agustín", "Jesús María", "Laboulaye", "Salsacate", "Córdoba"],
            "Misiones": ["Campo Grande", "Puerto Esperanza", "Alba Posse", "Concepción de la Sierra", "Posadas"],
            "Mendoza": ["Villa Nueva", "Villa Tulumaya", "Chacras de Coria"],
            "Salta": ["Joaquín V. González"],
            "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
        }
        for prov, names in known.items():
            have = set(hay[prov])
            missing = [n for n in names if n not in have]
            self.assertFalse(missing, (prov, missing))
        # CABA no se mezcla en este modo
        for r in P["AR"]["regiones"]:
            self.assertFalse(any(c.startswith("CABA") or "comuna" in c.lower() for c in r["ciudades"]), r["nombre"])

    def test_tandas_en_la_ui(self):
        html = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
        self.assertIn("function maxLugaresPorTanda(", html)
        self.assertIn("function guardarColaTanda(", html)
        self.assertIn('id="btnLatSiguienteTanda"', html)
        self.assertIn('id="btnCabaSiguienteTanda"', html)
        self.assertIn("Siguiente tanda", html)
        self.assertIn('zonas-latam.json?v=20261124b', html)

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
        self.assertEqual(caba, [
                "plomeros en Palermo, CABA",
                "plomero en Palermo, CABA",
                "gasista plomero en Palermo, CABA",
                "gasista en Palermo, CABA",
                "fontanero en Palermo, CABA",
                "destapaciones en Palermo, CABA",
            ])
        prov = expand_query_variants("plomeros en Rosario, Santa Fe, Argentina")
        self.assertIn("fontanero en Rosario, Santa Fe, Argentina", prov)
        self.assertIn("gasista en Rosario, Santa Fe, Argentina", prov)
        self.assertIn("destapaciones en Rosario, Santa Fe, Argentina", prov)
        self.assertTrue(all("plomería" not in q for q in prov))
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
        # Argentina: plomero y gasista plomero, sin "plomería" (trae ferreterías).
        caba = expand_query_variants("plomeros en Palermo, CABA")
        self.assertEqual(
            caba,
            [
                "plomeros en Palermo, CABA",
                "plomero en Palermo, CABA",
                "gasista plomero en Palermo, CABA",
                "gasista en Palermo, CABA",
                "fontanero en Palermo, CABA",
                "destapaciones en Palermo, CABA",
            ],
        )
        self.assertTrue(all("plomería" not in q for q in caba))

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
        self.assertTrue(excluir_como_tienda("plomeros", "Proveedor de materiales de construcción"))
        self.assertTrue(excluir_como_tienda("plomeros", "Comercio", "Corralón Rada Tilly SRL"))
        self.assertTrue(excluir_como_tienda("plomeros", "", "Servimat - Todo para la construcción"))
        self.assertFalse(excluir_como_tienda("ferreterías", "Proveedor de materiales de construcción"))
        self.assertTrue(excluir_como_tienda("plomeros", "Proveedor de equipos de calefacción", "Técnicas Térmicas"))
        self.assertTrue(excluir_como_tienda("plomeros", "Tienda de calefacción"))
        self.assertTrue(excluir_como_tienda("plomeros", "Proveedor de equipos eléctricos", "Pymet"))
        self.assertTrue(excluir_como_tienda("plomeros", "Mercado de materiales de construcción", "Laboulaye Sanitarios"))
        self.assertTrue(excluir_como_tienda("plomeros", "Comercio", "Laboulaye Sanitarios"))
        self.assertFalse(excluir_como_tienda("plomeros", "Instalador de gas", "RV INSTALACIONES SANITARIAS"))
        self.assertFalse(excluir_como_tienda("plomeros", "Mantenimiento de propiedades", "Montador gasista Sanitarista domiciliario"))

    def test_saca_oficios_ajenos_y_fuera_de_provincia(self):
        self.assertTrue(excluir_como_ajeno("plomeros", "Gasolinera", "YPF TECKA"))
        self.assertTrue(excluir_como_ajeno("plomeros", "Cerrajero", "Cerrajeria Mendieta"))
        self.assertTrue(excluir_como_ajeno("plomeros", "Abogado especialista en derecho de extranjería", "Trelew Chubut."))
        self.assertFalse(excluir_como_ajeno("plomeros", "Fontanero", "Servicios Destapaciones Antonio"))
        self.assertFalse(excluir_como_ajeno("plomeros", "Instalador de gas", "Gasista Matriculado Garay"))
        self.assertFalse(excluir_como_ajeno("cerrajeros", "Cerrajero", "Cerrajeria Mendieta"))
        self.assertTrue(es_oficio_buscado("plomeros", "Fontanero", "X"))
        self.assertTrue(es_oficio_buscado("plomeros", "Comercio", "Beto Gasista"))
        # Si el usuario pide un mínimo, se respeta también en oficios.
        self.assertFalse(pasa_umbral_o_oficio(4.3, 9, 4.0, 20, "and", True))
        self.assertFalse(pasa_umbral_o_oficio(4.3, 9, 4.0, 20, "and", False))
        self.assertFalse(pasa_umbral_o_oficio(5.0, 0, 4.0, 5, "and", True))
        self.assertFalse(pasa_umbral_o_oficio(4.3, 3, 4.0, 5, "and", True))
        self.assertTrue(pasa_umbral_o_oficio(4.3, 5, 4.0, 5, "and", True))
        # Mínimo 0: oficios de pueblo no se caen por cero reseñas ni por un rating flojo con pocas opiniones.
        self.assertTrue(pasa_umbral_o_oficio(None, 0, 4.0, 0, "and", True))
        self.assertTrue(pasa_umbral_o_oficio(3.0, 8, 4.0, 0, "and", True))
        # Con 10 o más reseñas, un rating claramente bajo sí se descarta.
        self.assertFalse(pasa_umbral_o_oficio(3.0, 15, 4.0, 0, "and", True))
        self.assertTrue(pasa_umbral_o_oficio(4.2, 15, 4.0, 0, "and", True))
        chubut = provincias_buscadas(["Comodoro Rivadavia, Chubut, Argentina", "Trelew, Chubut, Argentina"])
        self.assertEqual(chubut, {"chubut"})
        self.assertTrue(fuera_de_la_zona("Gral. Lamadrid 646, B1672 Villa Lynch, Provincia de Buenos Aires, Argentina", chubut))
        self.assertFalse(fuera_de_la_zona("C. 508, U9002 Comodoro Rivadavia, Chubut, Argentina", chubut))
        self.assertTrue(fuera_de_la_zona("", chubut))
        self.assertTrue(fuera_de_la_zona('{"borough":"","street":"","city":"","state":""}', chubut))
        self.assertTrue(excluir_como_ajeno("plomeros", "Comercio", "WIMER - Electrodomésticos"))
        self.assertTrue(excluir_como_ajeno("plomeros", "", "Servimar Empresa Metalurgica"))
        self.assertFalse(excluir_como_ajeno("plomeros", "Comercio", "Beto Gasista"))

    def test_saca_cabañas_y_calefaccion_si_buscas_plomeros(self):
        # Tierra del Fuego 11:42: entraban negocios que no son el oficio.
        self.assertTrue(excluir_como_ajeno("plomeros", "Casa rural", "Cabañas La Querencia"))
        self.assertTrue(excluir_como_ajeno("plomeros", "Empresa de calefacción", "Poliser SRL"))
        self.assertTrue(excluir_como_ajeno("plomeros", "Oficinas de empresa", "Central de Calefaccion"))
        self.assertFalse(excluir_como_ajeno("plomeros", "Instalador de gas", "Gasista urgencias 24 hs"))
        self.assertFalse(excluir_como_ajeno("plomeros", "Fontanero", "Destapes de cloacas Rg"))
        self.assertFalse(excluir_como_ajeno("plomeros", "Empresa de construcción", "Gasista matriculado plomeria y herreria"))


    def test_plomeria_en_el_nombre_es_el_oficio(self):
        # "plomería" no contiene "plomero"; si no está en las claves, se descartaba como ajeno.
        self.assertTrue(es_oficio_buscado("plomeros", "", "Servicio de Plomeria y Electricidad del Valle"))
        self.assertFalse(excluir_como_ajeno("plomeros", "", "Servicio de Plomeria y Electricidad del Valle"))
        self.assertTrue(es_oficio_buscado("plomeros", "Servicios de diseño", "Gali instalaciones. Plomería gas y cloacas"))
        self.assertFalse(excluir_como_ajeno("plomeros", "Servicios de diseño", "Gali instalaciones. Plomería gas y cloacas"))
        # Un comercio sigue fuera.
        self.assertTrue(excluir_como_ajeno("plomeros", "Comercio", "La Casa del Instalador SRL"))

    def test_sin_direccion_usa_coordenadas_de_la_zona(self):
        vacia = '{"borough":"","street":"","city":"","postal_code":"","state":"","country":""}'
        provincias = {"catamarca"}
        ciudades = ["San Fernando del Valle de Catamarca", "Santa María"]
        # Puntos con dirección en la capital (referencia).
        refs = [(-28.469, -65.779), (-28.47, -65.78)]
        # ConstruGas: en la capital, pero Maps no mandó dirección.
        self.assertFalse(
            fuera_de_zona_fila(vacia, provincias, ciudades, True, (-28.464534, -65.775160), refs)
        )
        # Plomero ya: en Tucumán (~180 km), no hay que colarlo.
        self.assertTrue(
            fuera_de_zona_fila(vacia, provincias, ciudades, True, (-26.832859, -65.251696), refs)
        )
        # Sin coords seguimos descartando, como antes.
        self.assertTrue(fuera_de_zona_fila(vacia, provincias, ciudades, True, None, refs))
        self.assertTrue(fuera_de_la_zona("", provincias))


    def test_filtro_ciudad_saca_capital_si_no_se_pidio(self):

        lugares = [
            "Río Cuarto, Córdoba, Argentina",
            "Villa Carlos Paz, Córdoba, Argentina",
            "Villa Allende, Córdoba, Argentina",
            "La Falda, Córdoba, Argentina",
        ]
        ciudades = ciudades_buscadas(lugares)
        self.assertEqual(ciudades, ["Río Cuarto", "Villa Carlos Paz", "Villa Allende", "La Falda"])
        self.assertTrue(aplica_filtro_ciudad(lugares))
        # Capital de Córdoba, no estaba en la lista.
        self.assertTrue(fuera_de_las_ciudades(
            "Obispo Salguero 500, X5003 Córdoba, Argentina", ciudades, True
        ))
        self.assertTrue(fuera_de_las_ciudades("X5000 Córdoba, Argentina", ciudades, True))
        self.assertTrue(fuera_de_las_ciudades(
            "Caseros 700, X5000AHM X5000AHM, Córdoba, Argentina", ciudades, True
        ))
        # Ciudad pedida.
        self.assertFalse(fuera_de_las_ciudades(
            "Av. San Martín 100, Villa Carlos Paz, Córdoba, Argentina", ciudades, True
        ))
        # Villa Allende escrito en la calle y Córdoba como ciudad.
        self.assertFalse(fuera_de_las_ciudades(
            "Mz 55 casa 10 barrio Arturo capdevila Villa Allende, X5012 Córdoba, Argentina",
            ciudades,
            True,
        ))
        # Otro pueblo de la misma provincia, no pedido.
        self.assertTrue(fuera_de_las_ciudades(
            "Juana Azurduy 180, Anisacate, Córdoba, Argentina", ciudades, True
        ))
        # San Francisco no debe tragar San Francisco del Chañar.
        solo_sf = ciudades_buscadas(["San Francisco, Córdoba, Argentina"])
        self.assertTrue(fuera_de_las_ciudades(
            "Calle 1, San Francisco del Chañar, Córdoba, Argentina", solo_sf, True
        ))
        # Maps a veces escribe «Gral.» o se come una letra («Río» → «R o»).
        self.assertFalse(fuera_de_las_ciudades(
            "Ruta 5 km 82, X5194 Villa Gral. Belgrano, Córdoba, Argentina",
            ciudades_buscadas(["Villa General Belgrano, Córdoba, Argentina"]),
            True,
        ))
        self.assertFalse(fuera_de_las_ciudades(
            "P R Nolasko 288, R o Cuarto, Cordoba, Argentina",
            ciudades_buscadas(["Río Cuarto, Córdoba, Argentina"]),
            True,
        ))
        # Una capital mal escrita no se cuela como ciudad pedida.
        self.assertTrue(fuera_de_las_ciudades(
            "Calle 10 38, C rdoba, Cordoba, Argentina",
            ciudades_buscadas(["Río Cuarto, Córdoba, Argentina"]),
            True,
        ))
        # Barrios de Santiago: no se filtra por el primer tramo.
        stgo = ["Providencia, Santiago, Chile", "Vitacura, Santiago, Chile"]
        self.assertFalse(aplica_filtro_ciudad(stgo))
        self.assertFalse(fuera_de_las_ciudades(
            "Av. Apoquindo 100, Santiago, Chile", ciudades_buscadas(stgo), False
        ))
        # Tienda que se colaba como mercado de materiales.
        self.assertTrue(excluir_como_tienda("plomeros", "Mercado de materiales de construcción", "Laboulaye Sanitarios"))

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

    def test_workflow_reaplica_estado_si_el_push_choca(self):
        yml = (ROOT / ".github" / "workflows" / "buscar.yml").read_text(encoding="utf-8")
        self.assertNotIn('git pull --rebase origin "${{ github.ref_name }}" || true', yml)
        self.assertIn("/tmp/estado-in-progress.json", yml)
        self.assertIn('git push origin "HEAD:${{ github.ref_name }}"', yml)
        self.assertIn("git reset --hard", yml)


if __name__ == "__main__":
    unittest.main(verbosity=1)
