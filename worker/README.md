# Worker Cloudflare — Fábrica de Prospectos

Proxy gratis (free tier) entre la página de GitHub Pages y GitHub Actions + KV para estados de prospectos.

## Endpoints

| Método | Ruta | Qué hace |
|--------|------|----------|
| `POST` | `/buscar` | Body `{ "query": "peluquerías en CABA" }` → `workflow_dispatch` |
| `GET`  | `/resenas?id=` | Preview público de una ficha de Maps (`ChIJ…` o `0x…:0x…`). Lo usa «Crear web de ejemplo» para leer reseñas reales. Hay que volver a desplegar el Worker para que exista en producción. |
| `GET`  | `/estado?run_id=` | Estado / progreso del run (o el último si no hay `run_id`) |
| `GET`  | `/estado-prospecto?key=` | Estado de un prospecto (`pendiente` / `contactado` / `no_interesa`) |
| `POST` | `/estado-prospecto` | Body `{ "key", "status" }` → guarda en KV `ESTADOS` |
| `OPTIONS` | `/*` | CORS preflight (origen Pages) |

## Pasos manuales (una sola vez)

### 1. Cuenta Cloudflare
1. Creá cuenta gratis en https://dash.cloudflare.com/sign-up
2. Entrá al dashboard → **Workers & Pages**

### 2. Token de GitHub (fine-grained)
1. GitHub → Settings → Developer settings → **Personal access tokens** → Fine-grained tokens → Generate
2. Resource owner: `paginadeprueba-collab` (o tu user)
3. Repository access: **Only select** → `maps-prospectos`
4. Permissions:
   - **Actions**: Read and write
   - **Contents**: Read-only (alcanza para leer el workflow)
   - **Metadata**: Read-only (obligatorio)
5. Generate → **copiá el token** (solo se muestra una vez)

### 3. Instalar Wrangler y loguearte
```bash
cd worker
npm install
npx wrangler login
```
Se abre el browser para autorizar Cloudflare.

### 4. Crear el KV namespace
```bash
npx wrangler kv namespace create ESTADOS
```
Copiá el `id` que imprime y pegalo en `wrangler.toml` en:
```toml
[[kv_namespaces]]
binding = "ESTADOS"
id = "pegá_el_id_acá"
```

### 5. Cargar el secret GH_TOKEN
```bash
npx wrangler secret put GH_TOKEN
# pegá el fine-grained token cuando lo pida
```

### 6. Deploy
```bash
npx wrangler deploy
```
Te da una URL tipo `https://maps-prospectos.<subdomain>.workers.dev`.

### 7. Conectar la página
En `docs/index.html`, buscá:
```js
const WORKER_URL = "";
```
y poné:
```js
const WORKER_URL = "https://maps-prospectos.<subdomain>.workers.dev";
```
Commit + push de `docs/` (o el mismo flujo de Pages).

### 8. Probar
```bash
curl -X POST https://maps-prospectos.<subdomain>.workers.dev/buscar \
  -H 'Content-Type: application/json' \
  -d '{"query":"odontólogos en Morón"}'
curl 'https://maps-prospectos.<subdomain>.workers.dev/estado'
```

## Notas free tier
- Workers: 100k requests/día gratis.
- KV: 100k reads / 1k writes / día en free (más que suficiente para este uso).
- No hace falta dominio propio: alcanza `*.workers.dev`.

## Fallback
Si `WORKER_URL` queda vacío, la página abre un **issue** `Buscar: …` con label `busqueda` (mismo workflow).
