# Investigador Comercial IMPULSA

Segundo módulo de Fábrica de Prospectos. **No reemplaza ni duplica el buscador de Google Maps**: toma los prospectos que Fábrica ya publicó en `docs/data/*.json` y los investiga uno por uno.

## Cómo se usa (Android o PC)

1. Abrí la página de Fábrica y tocá **IMPULSA** (arriba a la derecha) → `#/impulsa`.
2. Elegí una búsqueda de Fábrica, tocá **Elegir próximos 10** (o marcá a mano) y **Investigar seleccionados**.
3. Los que se analizaron hace menos de 7 días se omiten, salvo que marques **Forzar**.
4. **Oportunidades** ordena por puntaje; tocá un negocio para ver la **Ficha** con evidencias.
5. Los resultados quedan en el `localStorage` de ese dispositivo. Para pasarlos entre celular y PC: **Exportar JSON** / **Importar JSON**. También hay **Exportar CSV**.

## Worker

`POST /investigar` con `{ "prospectos": [ { key, nombre, website?, telefono, whatsapp, link_maps, rating, reseñas, categoria, direccion } ] }` (máximo 10 por pedido, procesados en serie).

- `worker/src/investigar.js`: fetch del sitio con timeout (8 s), máximo 3 redirects re-validados, límite 1,5 MB, guard SSRF (solo http/https; bloquea localhost, `.local`, `.internal`, IPs privadas/link-local/metadata, IPv6 locales, IPs ofuscadas, credenciales en URL y puertos raros). Workers no permite resolver DNS, por eso el bloqueo es por literal.
- `worker/src/scoring.js`: puntaje IMPULSA 0-100 + confianza.
- Secreto opcional `IMPULSA_TOKEN` (`wrangler secret put IMPULSA_TOKEN`): si existe, se exige el header `X-Impulsa-Token`. Si se activa, hay que sumar ese header en `docs/impulsa.js` (no se puede guardar un secreto en una página pública, así que sirve solo para uso privado). Además, `/investigar` rechaza orígenes del navegador que no sean el de GitHub Pages.
- No usa APIs pagas ni nuevos secretos obligatorios. Sin cambios en `wrangler.toml`.

## Cada dato

```json
{ "valor": ..., "fuente": "url o origen", "fecha": "ISO 8601", "tipo": "comprobado | estimado | no_disponible | hipotesis" }
```

- Sin sitio web → `website`, `calidad_web`, `agenda` = `no_disponible`.
- **Instagram, Facebook y Meta Ads Library no se scrapean** (condiciones de uso). Seguidores, publicaciones y anuncios = `no_disponible` (nunca 0). La ficha trae el link público de Meta Ads Library para revisarlo a mano.
- Redes encontradas en el sitio = `estimado` (no se verificó el perfil).
- WhatsApp generado desde el teléfono = `estimado` (no se verificó que exista la cuenta).
- Agenda: proveedor de turnos embebido (Calendly, Booksy, Doctoralia, AgendaPro, etc.) = `comprobado`; palabras como "reservá" / "sacá turno" = `hipotesis`. "book" suelto **no** cuenta (falso positivo en "facebook"). No se envían formularios ni se reserva nada.
- Calidad web: status, HTTPS, meta viewport, tamaño del HTML, tiempo de un fetch, title/meta description. **No mide LCP ni usabilidad móvil real.**

## Puntuación IMPULSA

| Componente | Máx | Qué mira |
|---|---|---|
| Reputación | 30 | rating y volumen de reseñas (Maps) |
| Actividad | 15 | teléfono, WhatsApp, reseñas |
| Presencia digital | 20 | redes, emails y sitio detectados |
| Calidad web | 15 | solo si hay web; si no hay, no se puntúa y los otros 85 se reescalan a 100 |
| Oportunidades | 20 | servicios concretos (agenda en una web sin turnos, mejoras técnicas, redes, formulario), atenuados según tracción |

**Nunca se suman puntos por no tener web.** "Sitio web" figura como servicio recomendado, sin puntos.

Bandas: **85-100** excelente · **70-84** alta · **50-69** media · **<50** baja. La confianza es el % de datos conocidos (IG/FB/Ads cuentan siempre como desconocidos).

## Procedencia del código

| Origen | Licencia | Qué se adaptó | Qué NO se copió |
|---|---|---|---|
| [mrsudo404/leadhunter](https://github.com/mrsudo404/leadhunter) | MIT | `extract_socials_from_html` → `extractSocials`, `extract_emails_from_html` → `extractEmails`, `extract_snippet_from_html` → `extractSnippet`, partes de `check_website_quality` → `calidadWeb` (portado de Python a JS y reescrito) | `scrape_google_maps`, `calculate_lead_score` (suma puntos por no tener web) |
| [anthonyonazure/maps-lead-gen](https://github.com/anthonyonazure/maps-lead-gen) (archivado) | MIT declarada en el README, sin archivo LICENSE | heurísticas de `checkWebsite` → `detectForms`, `detectBooking` (con fix del falso positivo "book") | buscador de Maps, scoring que premia no tener web |
| [sirlifehacker/lead-gen-hacker](https://github.com/sirlifehacker/lead-gen-hacker) | sin licencia | **nada** | todo |

### Licencia de mrsudo404/leadhunter (se conserva por usar código adaptado)

```
MIT License

Copyright (c) 2026 MRSUDO404 (waqaskhan.com.pk)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Pendiente / límites

- Para que funcione en producción hay que **desplegar el Worker** (`wrangler deploy` desde `worker/`). Este PR no despliega nada.
- Los prospectos de Fábrica hoy no traen `website` (el filtro busca negocios sin web), así que en la mayoría el análisis web queda `no_disponible`. En la ficha se puede cargar una web conocida y **Re-investigar**.
- Resultados guardados por dispositivo; la sincronización es por export/import JSON.
