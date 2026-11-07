"""Genera la base de la propuesta comercial a partir de la plantilla FINAL aprobada.

Entrada: propuesta-nunez-testimonio-actualizado.pdf (plantilla final, 12 páginas), ruta como 1er argumento.
Salida:  plantilla-base.pdf  -> misma plantilla con SOLO los textos variables quitados
                                (fondos, degradados, gráficos, imágenes y enlaces intactos).
         plantilla-slots.json -> posición, fuente, tamaño, color y ancho de cada texto variable,
                                que docs/propuesta-pdf.js vuelve a escribir con los datos del negocio.
Uso: python3 construir_plantilla.py RUTA/propuesta-nunez-testimonio-actualizado.pdf   (requiere pymupdf)
El conector de GitHub solo admite texto, por eso los binarios se guardan en base64 (*.b64):
    base64 -w0 plantilla-base.pdf > plantilla-base.pdf.b64   (ídem Inter-Regular.ttf y Cormorant-LightItalic.ttf)
"""
import json
from pathlib import Path
import pymupdf

D = Path(__file__).parent
import sys
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else D / "plantilla-final-referencia.pdf"

# (página 1-based, id del slot, inicio exacto de cada línea original que forma el slot, ancho máx)
SLOTS = [
    (1, "p1_estrategia", ["ESTRATEGIA PARA SU CONSULTORIO"], 330),
    (1, "p1_nombre_1", ["Odontología Integral"], 600),
    (1, "p1_nombre_2", ["Dr. Núñez"], 600),
    (2, "p2_rating", ["5,0"], 300),
    (2, "p2_rating_txt", ["estrellas en Google Maps"], 300),
    (2, "p2_resenas", ["74"], 250),
    (2, "p2_resenas_txt", ["reseñas", "de pacientes"], 250),
    (2, "p2_obs1", ["Su consultorio cuenta", "reseñas de pacientes en", "de confianza para"], 640),
    (2, "p2_obs2", ["En la ficha analizada", "verificar una agenda", "de atención."], 640),
    (2, "p2_oportunidad", ["La oportunidad es unir", "sencillo para solicitar"], 590),
    (3, "p3_sub", ["Su reputación en Google", "para atraer nuevos"], 620),
    (3, "p3_paso3", ["Solicitar turno"], 180),
    (3, "p3_texto", ["Sus 5,0 estrellas", "permite acompañar", "tratamientos, profesionales", "solicitar turno."], 630),
    (4, "p4_seccion", ["03 — EXPERIENCIA DEL PACIENTE"], 260),
    (4, "p4_titulo", ["Facilitar el turno,"], 640),
    (4, "p4_s1", ["Una persona encuentra"], 520),
    (4, "p4_s2", ["En su web, conoce"], 520),
    (4, "p4_s4", ["Su equipo revisa"], 520),
    (4, "p4_247", ["La confirmación queda"], 420),
    (5, "p5_texto", ["La presencia web está", "consultorio, una página", "medios de contacto"], 600),
    (6, "p6_texto", ["Los turnos online forman", "Incorporar una agenda", "horario y envíen"], 600),
    (7, "p7_texto", ["Las empresas consultadas", "ingresos. La publicidad", "visibilidad a los"], 600),
    (8, "p8_s2", ["Creamos la web", "consultorio."], 560),
    (11, "p11_titulo", ["para su consultorio."], 640),
    (11, "p11_intro", ["Proponemos integrar", "personas conozcan", "implementación incluye", "durante 24 meses."], 640),
    (11, "p11_web", ["Web profesional adaptada", "autorizadas; mapa"], 640),
    (11, "p11_agenda", ["Agenda de solicitudes 24/7", "consultorio. Configuración"], 640),
    (11, "p11_acomp", ["Acompañamiento semanal durante", "actualización de datos."], 640),
    (11, "p11_total", ["$400.000"], 300),
    (11, "p11_etapas", ["Dos etapas de $200.000"], 300),
    (12, "p12_t2", ["Cuéntenos sobre su consultorio"], 560),
    (12, "p12_s4", ["$200.000 para iniciar", "los entregables y dados"], 580),
]
HEADER = "ODONTOLOGÍA INTEGRAL DR. NÚÑEZ"


def lineas(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            sp = l["spans"]
            txt = "".join(s["text"] for s in sp)
            s0 = sp[0]
            out.append({"text": txt, "bbox": l["bbox"], "origin": s0["origin"], "size": s0["size"],
                        "font": "italic" if "Cormorant" in s0["font"] else "sans", "color": "#%06x" % s0["color"]})
    return out


def main():
    doc = pymupdf.open(SRC)
    H = doc[0].rect.height
    slots = []
    for pno in range(len(doc)):
        page = doc[pno]
        ls = lineas(page)
        quitar = []
        # Nombre del negocio al pie (todas las páginas)
        for l in ls:
            if l["text"] == HEADER and l["origin"][1] > 900:
                quitar.append(l["bbox"])
                slots.append({"page": pno, "id": "pie", "x": l["origin"][0], "y": H - l["origin"][1], "size": l["size"],
                              "font": l["font"], "color": l["color"], "width": 400, "leading": l["size"] * 1.2, "lines": 1})
        for (p, sid, starts, width) in SLOTS:
            if p - 1 != pno:
                continue
            found = []
            for st in starts:
                m = [l for l in ls if l["text"].startswith(st) and l not in found]
                assert m, (sid, st)
                found.append(m[0])
            for l in found:
                quitar.append(l["bbox"])
            f0 = found[0]
            lead = (found[1]["origin"][1] - f0["origin"][1]) if len(found) > 1 else f0["size"] * 1.25
            slots.append({"page": pno, "id": sid, "x": f0["origin"][0], "y": H - f0["origin"][1], "size": f0["size"],
                          "font": f0["font"], "color": f0["color"], "width": width, "leading": lead, "lines": len(found)})
        for r in quitar:
            page.add_redact_annot(pymupdf.Rect(r) + (-1, -1, 1, 1), fill=False)
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
    doc.save(D / "plantilla-base.pdf", garbage=4, deflate=True)
    (D / "plantilla-slots.json").write_text(json.dumps({"ancho": doc[0].rect.width, "alto": H, "slots": slots}, ensure_ascii=False, indent=1))
    print(len(slots), "slots")


if __name__ == "__main__":
    main()
