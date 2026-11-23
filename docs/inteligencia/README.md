# Inteligencia comercial IMPULSA

Página: `docs/inteligencia/` → https://paginadeprueba-collab.github.io/maps-prospectos/inteligencia/ (botón **Inteligencia** en el menú de la Fábrica).

Sin IA, sin tokens, sin servicios pagos. Todo se calcula en el navegador con los datos ya guardados.

## Archivos
- `core.js`: clasificación, registro de contactos y estadísticas (lo usan la Fábrica y esta página; se testea con `node tests/test_inteligencia.mjs`).
- `panel.js`, `index.html`, `styles.css`: Panel de inteligencia.
- `../../worker/d1/inteligencia.sql`: tablas para sincronizar en el futuro. **Preparado, no aplicado.**

## Datos (misma base que hoy)
- Prospectos: `localStorage` `impulsa_resultados_v1` → `r.comercial` (el CRM existente). Campos nuevos, todos opcionales:
  `fecha_contacto` (primer contacto), `ultimo_contacto`, `servicio_ofrecido`, `resultado`, `motivo_rechazo`, `objeciones[]`,
  `proximo_seguimiento`, `propuesta_id`, `propuesta_nombre`, `tipo_empresa`, `reunion`.
- Cada contacto se agrega a `r.comercial.historial` con fecha ISO y los mismos campos.
- Propuestas / argumentos: `localStorage` `impulsa_propuestas_v1` (`[{id, nombre, descripcion, creada, activa}]`). El nombre también queda guardado en cada contacto, así se ve aunque se importe en otro dispositivo.
- Los 11 estados viejos siguen funcionando. Registros viejos sin campos nuevos se cuentan con sus estados.

## Cargar un contacto
Fábrica → IMPULSA → ficha del prospecto → **Registrar contacto**: canal, servicio, propuesta (o crear una), tipo de empresa, resultado, motivo de rechazo, objeciones, reunión, próximo seguimiento y estado.

## Clasificación (lista fija)
No necesita · No reconoce el problema · Ya tiene una solución · No tiene presupuesto · No confía · No responde · Interesado · Solicita presupuesto · Contrató.

## Cómo se cuenta
- Contacto: tiene fecha de contacto, contacto/mensaje en el historial o estado desde «Primer contacto».
- Positiva: interesado / solicita presupuesto / contrató (registros viejos: estado interesado, reunión pendiente, negociación o ganado).
- Reunión: casilla «reunión», canal Reunión o estado reunión pendiente / negociación.
- Venta: contrató o cliente ganado. Rechazo: los 5 motivos negativos o cliente perdido. «No responde» va aparte.

## Reglas de honestidad
- Solo cantidades reales; cada % muestra «x de n».
- Grupo con menos de 10 contactos: «datos insuficientes», sin %, fuera de rankings y recomendaciones.
- Ningún texto dice que un rubro es rentable ni da probabilidades.
- «Sin web» es un atributo del negocio (dimensión aparte), nunca intención de compra.

## Pasar datos entre celu y PC
Exportar JSON en IMPULSA y luego Importar en el otro equipo. En esta página, «Ver un archivo exportado» solo muestra el archivo, no guarda nada.
