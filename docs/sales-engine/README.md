# IMPULSA Sales Engine V1

Módulo independiente de la Fábrica de Prospectos. Recibe los datos de un potencial cliente y arma el diagnóstico comercial, la estrategia y las herramientas para cerrar la venta.

- **URL (cuando se publique):** https://paginadeprueba-collab.github.io/maps-prospectos/sales-engine/
- HTML, CSS y JavaScript puro. Sin frameworks, sin dependencias externas, sin IA y sin consumo de tokens.
- No toca ningún archivo existente del repo (buscador, Fábrica de Sitios, plantillas, Workers, PDF).

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Interfaz con 6 secciones: Nuevo análisis, Diagnósticos, Prospectos, Estrategias, Biblioteca comercial y Configuración. |
| `engine.js` | Motor: lee el mensaje, detecta faltantes, aplica las reglas y genera los textos. Funciona en el navegador (`window.SalesEngine`) y en Node. |
| `styles.css` | Diseño claro, adaptable a celulares, más los estilos del informe imprimible. |
| `data/services.json` | Catálogo y precios iniciales. |
| `data/industries.json` | 10 rubros, cada uno con problemas, preguntas, indicadores y soluciones. |
| `data/rules.json` | Reglas de diagnóstico de las 5 áreas y preguntas del modo guiado. |
| `data/objections.json` | Objeciones frecuentes y sus respuestas. |

`engine.js` lleva una copia embebida de los JSON para que el módulo funcione también abierto como archivo local. Si editás un JSON, actualizá esa copia: el test `tests/test_sales_engine.mjs` avisa si quedaron distintas.

## Cómo se usa

1. **Nuevo análisis.** Pegá el mensaje que llega por WhatsApp desde el formulario de diagnóstico (`NOMBRE: …`, `¿TENÉS PÁGINA WEB?: …`) y tocá **Leer mensaje**. También podés importar un JSON o cargar los datos a mano. El sistema avisa qué datos faltan.
2. Tocá **Generar diagnóstico**. Se guarda solo en el navegador.
3. **Modo guiado.** Respondé las preguntas pendientes: consultas, ventas, ticket, margen, inversión, seguimiento, capacidad, competencia, objetivos y las preguntas propias del rubro. Solo aparecen las que no tienen respuesta, y la pregunta de inversión aparece únicamente si el prospecto paga publicidad.
4. **Diagnósticos** muestra el resumen, el diagnóstico, los problemas con su evidencia, impacto, solución, acciones e indicadores, y las 3 prioridades. Debajo está el historial.
5. **Estrategias** muestra el plan, los servicios, el presupuesto y los argumentos, más el mensaje de WhatsApp (con botones Copiar y Abrir en WhatsApp), las objeciones, el guion de llamada, el seguimiento y el próximo paso.
6. **Informe PDF** abre la impresión del navegador. Elegí "Guardar como PDF".
7. En **Configuración** se editan los precios y la firma de los mensajes, y se exporta o importa la copia completa en JSON. Importar una copia suma datos y nunca borra nada.

## Reglas del motor

- Cada hallazgo se marca como **Hecho declarado** (lo dijo el cliente), **Dato verificado** (lo comprobaste vos y lo tildaste en "Lo verifiqué yo"), **Hipótesis** (a confirmar) o **Información faltante**.
- No inventa estadísticas, competidores ni resultados. Los cálculos de conversión y de costo por venta salen solo de números que dio el cliente.
- Solo recomienda servicios que resuelven un problema detectado:
  - Nada de web si ya tiene una que funciona.
  - Nada de empleado virtual si ya usa atención automática.
  - Nada de Meta Ads si está saturado.
- La inversión en publicidad la define el cliente, se paga aparte a Meta y nunca se suma a los honorarios.
- Los gráficos aparecen solo cuando hay datos suficientes (70 % o más de los datos básicos completos).

## Pruebas

```
node tests/test_sales_engine.mjs
```
