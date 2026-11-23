# Fábrica de Prospectos (GitHub Actions + Pages + Worker opcional)

Buscá negocios en Google Maps **sin gastar tokens ni APIs pagas**.  
El scraper corre en GitHub Actions (gratis). La página vive en GitHub Pages.  
Opcional: un **Cloudflare Worker** (free tier) para disparar búsquedas y guardar “contactado / no interesa” sin tocar la UI de GitHub.

Scraper: [`gosom/google-maps-scraper`](https://github.com/gosom/google-maps-scraper).  
Filtro local: solo **sin website**, rating ≥ 4.0 **y** un mínimo de reseñas (por defecto 20, configurable), WhatsApp si el tel es área **11**, dedupe.

## Sitio

https://paginadeprueba-collab.github.io/maps-prospectos/

Pages: Settings → Pages → branch `main` / folder `/docs`.

## Cómo buscar (fácil)

1. Abrí la página.
2. Escribí `peluquerías en CABA` (o tocá un chip de zona) → **Buscar**.
3. **Con Worker configurado:** se lanza solo y ves una barra de progreso.
4. **Sin Worker:** se abre un issue de GitHub → tocá *Submit / Crear* (logueado).
5. En minutos: tarjetas con **Maps** + **WhatsApp** (mensaje prearmado editable).

También: [Run workflow](https://github.com/paginadeprueba-collab/maps-prospectos/actions/workflows/buscar.yml).

## Setup una sola vez

1. Creá el label **`busqueda`** en el repo (Issues → Labels). Sirve para el fallback por issue.
2. (Opcional pero recomendado) Deploy del Worker — pasos exactos en [`worker/README.md`](worker/README.md).

## Workflow paralelo (rápido)

1. **preparar** — `expandir.py` → matrix JSON; `estado.json` = in_progress; comenta el issue si aplica.
2. **scrape** — hasta **20** jobs a la vez (si hay más, esperan turno), cada uno Docker `gosom/google-maps-scraper`  
   `-lang es`, profundidad **4** (rápida) o **10** (profunda; el tope documentado del scraper), `DISABLE_TELEMETRY=1`.
3. **unir** — junta `raw-*`, `filtrar.py` (dedupe), `resumen.py` → `docs/data/*.json`, limpia estado, artifact `prospectos`, cierra issue.

Zonas: CABA → 48 barrios; Zona Norte/Oeste/Sur → partidos; GBA → todos. Zona chica no se parte.

## Worker Cloudflare (opcional)

Código listo en `worker/` (**no deployeado** desde este repo hasta que configures secretos).

Resumen de pasos manuales:

1. Cuenta Cloudflare gratis.
2. Fine-grained PAT de GitHub con **Actions: write** + **Contents: read** solo en `maps-prospectos`.
3. `cd worker && npm i && npx wrangler login`
4. `npx wrangler kv namespace create ESTADOS` → pegar `id` en `wrangler.toml`
5. `npx wrangler secret put GH_TOKEN`
6. `npx wrangler deploy` → copiar URL `*.workers.dev`
7. En `docs/index.html` setear `const WORKER_URL = "https://…workers.dev"`

Detalle completo: **[worker/README.md](worker/README.md)**.

## CSV limpio

`nombre`, `reseñas`, `rating`, `telefono`, `whatsapp`, `link_maps`, `direccion`, `categoria`, `horarios`, `pais`

WhatsApp (Argentina): `https://wa.me/549` + 10 dígitos (área + número; el área 11 sale igual que antes, y ahora también las provincias).
Otros países: `telefono` = `+<código><número>` y `https://wa.me/<código><número>`. Un número que ya viene con `+` queda como está.
Si el largo no cierra para ese país, no se arma WhatsApp. No se inventan datos.

## Provincias y Latinoamérica

Tercer modo del buscador (además de **CABA por barrios** y **Otro lugar**):

1. Elegís el rubro (el mismo de siempre), el **país**, la **provincia/estado** y marcás ciudades (como los barrios). Si falta una, la escribís y tocás **Agregar**. Máximo 40 ciudades por búsqueda.
2. Arma una consulta por ciudad: `rubro en Ciudad, Provincia, País` (sin repetir si la ciudad se llama como la provincia). Se mandan como lista explícita, sin expandir.
3. Datos: `docs/zonas-latam.json` (Argentina: 23 provincias sin CABA; 18 países más; código telefónico y largo del número de cada país). Lógica del navegador: `docs/latam.js`. En Python: `paises.py`.
4. El país se guarda en el historial (`pais` en `index.json`/búsqueda y en cada prospecto) y el Panel de Inteligencia tiene la dimensión **País** (misma regla: menos de 10 contactos = datos insuficientes).
5. Sinónimos: en `docs/rubros.json`, el campo opcional `latam` (ej. fontanero, dentista, bufete) reemplaza a `variantes` solo cuando la búsqueda es de otro país. En Argentina se usan las variantes de siempre.

6. Países: Argentina más 18 de habla hispana (Uruguay, Chile, Paraguay, Bolivia, Perú, Ecuador, Colombia, Venezuela, México, Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica, Panamá, Cuba, República Dominicana, Puerto Rico). Brasil no está (decisión de Carlos). España no está.
7. WhatsApp en Argentina: arma link con cualquier número de provincia, incluso escrito con `15` (`0351 15-412-3456` → `5493514123456`, `11 15-…` → `5411…`). Un `15-xxxx-xxxx` suelto solo se completa con `11` si la dirección es de CABA. Las búsquedas viejas sin link de WhatsApp lo arman al abrirse (`FabricaLatam.waDesdeTelefono`).
8. Web de ejemplo fuera de CABA: la zona sale de la dirección («Rosario», «Montevideo», «Villa Lynch») en vez de «tu zona».
9. Meta Ads: el link a la Biblioteca de anuncios usa el país del prospecto (el Worker trae `country=AR`; se corrige en el navegador).
10. Barrios / zonas (como CABA): las ciudades grandes traen sus barrios, comunas, distritos, colonias o zonas con el nombre local (`barrios: {ciudad: [...]}` en cada región de `zonas-latam.json`; 1304 barrios en 66 ciudades, 847 ciudades en total). Al elegir la provincia, la ciudad con barrios aparece como «Montevideo ›» y abre su panel con «Todos los barrios» / «Limpiar» y «Toda la ciudad». Consulta: `rubro en Barrio, Ciudad, País`. Lo ya buscado se marca con «ya». Hasta 120 lugares por búsqueda; si (lugares × variantes del rubro) pasa de 200 avisa que conviene dividir. Los datos se generan con `latam-work/gen_barrios.py` (fuera del repo, en la compu compartida).

Pruebas: `python3 tests/test_latam.py`, `node tests/test_latam.mjs` y `node tests/test_latam_flujo.mjs` (prospecto de Uruguay por investigar, diagnóstico, propuesta, PDF, mensajes y Inteligencia).

## Privacidad

No subas contraseñas al repo. El Worker usa un secret de Wrangler, no del git.
