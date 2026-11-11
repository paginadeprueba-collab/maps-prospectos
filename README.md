# Fábrica de Prospectos (GitHub Actions + Pages + Worker opcional)

Buscá negocios en Google Maps **sin gastar tokens ni APIs pagas**.  
El scraper corre en GitHub Actions (gratis). La página vive en GitHub Pages.  
Opcional: un **Cloudflare Worker** (free tier) para disparar búsquedas y guardar “contactado / no interesa” sin tocar la UI de GitHub.

Scraper: [`gosom/google-maps-scraper`](https://github.com/gosom/google-maps-scraper).  
Filtro local: solo **sin website**, buenas reseñas, WhatsApp si el tel es área **11**, dedupe.

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

`nombre`, `reseñas`, `rating`, `telefono`, `whatsapp`, `link_maps`, `direccion`, `categoria`

WhatsApp: `https://wa.me/549` + 10 dígitos área 11. No se inventan datos.

## Privacidad

No subas contraseñas al repo. El Worker usa un secret de Wrangler, no del git.
