/**
 * IMPULSA Sales Engine V1 — motor de diagnóstico comercial.
 * JavaScript puro, sin dependencias y sin IA: todo sale de reglas (data/*.json).
 *
 * API pública (window.SalesEngine en el navegador, module.exports en Node):
 *   cargarDatos(base)               -> Promise<datos>  (fetch de data/*.json, con respaldo embebido)
 *   datosEmbebidos()                -> datos de respaldo (sirve abriendo el archivo con file://)
 *   perfilVacio()                   -> perfil con todos los campos en null
 *   parsearMensaje(texto, datos)    -> { perfil, reconocidos, extras }
 *   detectarIndustria(rubro, datos) -> id de industria o null
 *   faltantes(perfil, datos)        -> { base:[...], guiado:[...] }
 *   preguntasGuiadas(perfil, datos) -> preguntas pendientes (no repite las respondidas)
 *   diagnosticar(perfil, datos, config) -> diagnóstico completo con los 13 entregables
 *   configPorDefecto(datos)         -> precios y firma editables
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SalesEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Copia embebida de data/*.json (se regenera con el test). No editar a mano. */
  var FALLBACK = /*FALLBACK_START*/{"services":{"moneda":"ARS","notaInversion":"La inversión en publicidad se paga directo a Meta, la define el cliente y no está incluida en los honorarios de gestión.","servicios":[{"id":"web","nombre":"Desarrollo web","tipo":"unico","precio":350000,"detalle":"Sitio profesional adaptado a celulares, con servicios, trabajos, reseñas y botón directo a WhatsApp. Incluye 2 años de mantenimiento.","plazo":"2 a 3 semanas"},{"id":"meta_ads","nombre":"Gestión de Meta Ads","tipo":"mensual","precioPrimerMes":80000,"precioMensual":50000,"detalle":"Armado y gestión de campañas en Facebook e Instagram con destino a WhatsApp o a la web, con reporte mensual.","plazo":"primera campaña en 1 semana"},{"id":"empleado_virtual","nombre":"Empleado virtual","tipo":"mensual","precioMensual":90000,"detalle":"Atiende WhatsApp al instante, responde preguntas frecuentes, toma datos, agenda y hace seguimiento a quien no contestó.","plazo":"2 semanas"}]},"industries":{"industrias":[{"id":"salud","nombre":"Salud y medicina","palabras":["salud","medic","odont","dentist","clinica","consultorio","kinesio","psicolog","nutricion","estetica","veterinar","fonoaudio","oftalm","pediatr","laboratorio"],"unidad":"turnos","unidadSing":"turno","problemas":["Turnos que se pierden por no responder a tiempo","Ausencias sin aviso que dejan huecos en la agenda","Pacientes que preguntan precios u obras sociales y no vuelven","Poca confianza online por falta de reseñas o información clara"],"preguntas":["¿Cuántos turnos libres te quedan por semana?","¿Qué porcentaje de pacientes falta sin avisar?","¿Trabajás con obras sociales o solo particular?"],"indicadores":["Turnos agendados por mes","Tasa de ausentismo","Tiempo de respuesta a consultas","Reseñas nuevas por mes"],"soluciones":["Recordatorio automático de turnos por WhatsApp","Respuestas inmediatas a preguntas frecuentes (precios, obras sociales, horarios)","Web con especialidades, profesionales y reseñas"],"argumento":"En salud la confianza decide: el paciente elige a quien responde rápido y se ve serio online."},{"id":"inmobiliaria","nombre":"Inmobiliarias","palabras":["inmobil","propiedad","bienes raices","alquiler","corredor","martillero","desarrollo inmobiliario"],"unidad":"operaciones","unidadSing":"operación","problemas":["Consultas de portales que se enfrían por demora en responder","Pocas captaciones de propiedades propias","Seguimiento desordenado de interesados","Dependencia de portales pagos"],"preguntas":["¿Cuántas propiedades tenés en cartera hoy?","¿De dónde vienen la mayoría de las consultas (portales, redes, carteles)?","¿Cuánto tarda en promedio una operación?"],"indicadores":["Consultas por propiedad","Visitas concretadas","Captaciones nuevas por mes","Operaciones cerradas"],"soluciones":["Respuesta automática con ficha de la propiedad y agenda de visitas","Campañas para captar propietarios que quieren vender o alquilar","Web propia con buscador de propiedades"],"argumento":"En inmobiliarias gana quien responde primero y hace seguimiento hasta la visita."},{"id":"servicios_profesionales","nombre":"Servicios profesionales","palabras":["abogad","contador","contable","estudio","consultor","arquitect","escriban","asesor","seguro","marketing","diseñ","disen","fotograf","ingenier"],"unidad":"clientes nuevos","unidadSing":"servicio","problemas":["Clientes que llegan solo por recomendación","Dificultad para mostrar experiencia y casos","Consultas que piden precio y no avanzan","Tiempo perdido en reuniones con gente que no califica"],"preguntas":["¿Qué tipo de cliente te deja más margen?","¿Cobrás por hora, por proyecto o abono?","¿Cuántas reuniones necesitás para cerrar un cliente?"],"indicadores":["Consultas calificadas por mes","Reuniones agendadas","Propuestas enviadas vs. aceptadas","Clientes con abono"],"soluciones":["Web con servicios, casos y forma de trabajo","Formulario o asistente que filtra consultas antes de la reunión","Seguimiento de propuestas enviadas"],"argumento":"Un profesional vende confianza: mostrar experiencia y responder ordenado lo diferencia."},{"id":"hogar","nombre":"Plomeros, gasistas y electricistas","palabras":["plomer","gasist","electricist","electric","gas","cloac","destap","calefac","aire acondicionado","refrigeracion","mantenimiento","albañil","albanil","pintor","cerrajer","techista","hogar"],"unidad":"trabajos","unidadSing":"trabajo","problemas":["Consultas que llegan cuando estás trabajando y no podés responder","Gente que pide presupuesto por WhatsApp y desaparece","Dependencia del boca en boca","Clientes que no encuentran tu trabajo ni reseñas en Google"],"preguntas":["¿Hacés urgencias o solo trabajos programados?","¿Qué zona cubrís?","¿Qué trabajos te dejan más ganancia?"],"indicadores":["Pedidos de presupuesto por mes","Presupuestos aceptados","Tiempo de respuesta","Reseñas en Google"],"soluciones":["Web con calculadora de presupuesto que manda la consulta al WhatsApp","Perfil de Google Maps completo con fotos de trabajos","Respuesta automática mientras estás en una obra"],"argumento":"El que tiene una urgencia llama al primero que aparece y responde; estar visible y contestar rápido es clave."},{"id":"comercio","nombre":"Comercios","palabras":["comercio","tienda","local","negocio de ropa","ropa","indumentaria","kiosco","almacen","ferreteria","libreria","jugueteria","optica","perfumeria","bazar","regaleria","venta"],"unidad":"ventas","unidadSing":"venta","problemas":["Dependencia del paso de gente por el local","Preguntas de precio y stock que consumen tiempo","Clientes que compran una vez y no vuelven","Poca venta online o por WhatsApp"],"preguntas":["¿Vendés solo en el local o también por WhatsApp o envío?","¿Tenés base de clientes con contacto?","¿Qué productos te dejan más margen?"],"indicadores":["Ventas por canal","Clientes que vuelven a comprar","Consultas por WhatsApp","Ticket promedio"],"soluciones":["Catálogo online con pedido por WhatsApp","Respuestas automáticas de precio, stock y horarios","Campañas para clientes de la zona"],"argumento":"Un comercio que vende también por WhatsApp no depende solo de quien pasa por la puerta."},{"id":"gastronomia","nombre":"Gastronomía","palabras":["restaurant","resto","bar","cafe","cafeteria","pizzeria","rotiseria","comida","delivery","heladeria","panaderia","pasteleria","catering","hamburgues","parrilla","gastronom","cocina"],"unidad":"pedidos o reservas","unidadSing":"pedido","problemas":["Pedidos y reservas que se pierden en horas pico","Dependencia de apps de delivery con comisiones altas","Mesas vacías en días flojos","Menú desactualizado online"],"preguntas":["¿Qué porcentaje de tus pedidos entra por apps de delivery?","¿Qué días y horarios son los más flojos?","¿Tomás reservas? ¿Por dónde?"],"indicadores":["Pedidos directos por semana","Reservas por semana","Ventas en días flojos","Pedidos por app vs. directos"],"soluciones":["Menú online con pedido directo por WhatsApp","Respuesta automática de pedidos y reservas","Promociones dirigidas a la zona en días flojos"],"argumento":"Cada pedido directo es un pedido sin comisión de app."},{"id":"industria","nombre":"Industria","palabras":["industri","fabrica","fabricacion","metalurg","taller","manufactur","produccion","mayorista","distribuid","imprenta","carpinter","herreri","plastico","textil"],"unidad":"pedidos","unidadSing":"pedido","problemas":["Pocas consultas de clientes nuevos fuera de la cartera actual","Catálogo técnico difícil de mostrar","Cotizaciones que tardan y se pierden","Seguimiento comercial informal"],"preguntas":["¿Vendés a empresas, a revendedores o a consumidor final?","¿Cuánto tardás en enviar una cotización?","¿Quién se ocupa hoy de vender?"],"indicadores":["Pedidos de cotización por mes","Cotizaciones aceptadas","Tiempo de cotización","Clientes nuevos por trimestre"],"soluciones":["Web institucional con catálogo y pedido de cotización","Toma automática de datos para cotizar","Seguimiento de cotizaciones enviadas"],"argumento":"Una industria que responde cotizaciones rápido y ordenado gana clientes que hoy ni la conocen."},{"id":"educacion","nombre":"Educación","palabras":["educa","escuela","colegio","instituto","academia","curso","clases","profesor","idioma","ingles","jardin","capacitacion","apoyo escolar","musica","danza","gimnasio","yoga","entrenamiento"],"unidad":"inscripciones","unidadSing":"inscripción","problemas":["Consultas que no terminan en inscripción","Picos de demanda en fechas puntuales y meses flojos","Bajas de alumnos sin aviso","Información de cursos y precios dispersa"],"preguntas":["¿Cuándo son tus picos de inscripción?","¿Cuántos alumnos activos tenés?","¿Cuántos se dan de baja por mes?"],"indicadores":["Consultas por curso","Inscripciones por mes","Bajas por mes","Alumnos activos"],"soluciones":["Web con cursos, horarios y precios claros","Respuesta automática con información y link de inscripción","Campañas antes de cada período de inscripción"],"argumento":"La inscripción se decide rápido: quien responde con info clara en el momento se queda con el alumno."},{"id":"transporte","nombre":"Transporte","palabras":["transport","flete","mudanza","logistic","envio","remis","taxi","traslado","combi","cadeteria","mensajeria","camion","grua","auxilio"],"unidad":"viajes o envíos","unidadSing":"viaje","problemas":["Cotizaciones por WhatsApp que llevan mucho tiempo","Viajes de vuelta vacíos o días sin trabajo","Dependencia de pocos clientes grandes","Poca visibilidad para clientes nuevos"],"preguntas":["¿Trabajás con empresas, particulares o ambos?","¿Qué zonas cubrís?","¿Cuántos vehículos tenés disponibles?"],"indicadores":["Pedidos de cotización por semana","Viajes concretados","Ocupación de la flota","Clientes recurrentes"],"soluciones":["Cotizador simple en la web que manda los datos por WhatsApp","Toma automática de origen, destino y fecha","Perfil de Google Maps y campañas por zona"],"argumento":"En transporte el cliente compara rápido: quien cotiza primero y claro suele ganar el viaje."},{"id":"tecnologia","nombre":"Tecnología","palabras":["tecnolog","software","informatic","sistemas","desarrollo web","app","computacion","reparacion de celular","celulares","soporte tecnico","redes","seguridad electronica","camaras","domotica"],"unidad":"proyectos","unidadSing":"proyecto","problemas":["Dificultad para explicar el servicio a clientes no técnicos","Ciclos de venta largos","Consultas poco calificadas","Falta de casos visibles"],"preguntas":["¿Vendés proyectos, abonos o ambos?","¿Cuál es tu cliente ideal?","¿Cuánto dura en promedio tu ciclo de venta?"],"indicadores":["Consultas calificadas","Demos o reuniones por mes","Propuestas aceptadas","Ingresos recurrentes"],"soluciones":["Web con casos y beneficios en lenguaje simple","Asistente que califica la consulta antes de la reunión","Seguimiento de propuestas y demos"],"argumento":"En tecnología vende quien explica simple y muestra resultados concretos."}]},"rules":{"areas":{"captacion":"Captación de clientes","presencia":"Presencia digital","conversion":"Conversión de consultas","seguimiento":"Organización comercial y seguimiento","medicion":"Medición y optimización"},"objetivoAreas":{"clientes":["captacion","presencia"],"seguimiento":["seguimiento","conversion"],"imagen":["presencia"],"automatizar":["conversion","seguimiento"]},"reglas":[{"id":"sin_web","area":"presencia","tipo":"hecho","prioridad":"alta","condicion":{"campo":"web","es":"no"},"problema":"No tiene sitio web","corto":"no tenés una web donde la gente vea tus trabajos y te consulte","evidencia":"Declaró: {web}.","impacto":"Quien busca el servicio en Google y no encuentra una web propia sigue de largo con otra opción. Esas consultas perdidas no quedan registradas en ningún lado.","solucion":"Sitio web profesional con servicios, trabajos, reseñas y botón directo a WhatsApp.","servicio":"web","acciones":["Definir servicios principales y zona","Juntar fotos de trabajos y reseñas","Publicar la web con botón de WhatsApp","Vincular la web al perfil de Google"],"indicadores":["Consultas que llegan desde la web por mes","Clics al botón de WhatsApp","Visitas mensuales"],"oportunidad":"Tener una vidriera propia que trabaje las 24 horas y mande las consultas directo al WhatsApp.","argumento":"La web muestra tus trabajos y reseñas aunque estés ocupado, y la consulta te llega directo al WhatsApp."},{"id":"web_sin_resultados","area":"presencia","tipo":"hecho","prioridad":"alta","condicion":{"campo":"web","es":"sin_resultados"},"problema":"Tiene web pero no le genera consultas","corto":"tu web hoy no te está trayendo consultas","evidencia":"Declaró: {web}.","impacto":"Se mantiene un sitio que no aporta clientes. Hay que revisar la causa antes de proponer: puede ser el diseño, la velocidad, que no se encuentre o que no invite a consultar.","solucion":"Rehacer la web pensada para que consulten: mensaje claro, reseñas, precios orientativos o calculadora y WhatsApp siempre visible.","servicio":"web","acciones":["Revisar la web actual en el celular (velocidad, textos, botones)","Definir el llamado a la acción principal","Rehacer o ajustar la web","Medir clics a WhatsApp desde el primer día"],"indicadores":["Consultas desde la web por mes","Clics a WhatsApp","Tiempo de carga en celular"],"oportunidad":"Convertir un gasto que hoy no rinde en un canal que genere consultas.","argumento":"No se trata de tener web, sino de que la web te haga consultar. Eso es lo que cambiamos."},{"id":"sin_maps","area":"presencia","tipo":"hecho","prioridad":"alta","condicion":{"campo":"maps","es":"no"},"problema":"No tiene perfil en Google Maps","corto":"no aparecés en Google Maps cuando te buscan por la zona","evidencia":"Declaró: {maps}.","impacto":"Las búsquedas del tipo \"cerca de mí\" muestran negocios con perfil en Maps. Sin perfil, el negocio no figura en esas búsquedas.","solucion":"Crear y verificar el perfil de Google Empresa con fotos, horarios, zona de cobertura y link a WhatsApp o a la web.","servicio":null,"acciones":["Crear el perfil de Google Empresa","Completar rubro, zona, horarios y fotos","Pedir reseñas a clientes recientes"],"indicadores":["Vistas del perfil","Llamadas y clics desde Maps","Reseñas nuevas por mes"],"oportunidad":"Aparecer en las búsquedas locales, donde la gente busca para contratar ya.","argumento":"Si no estás en Maps, en las búsquedas de tu zona aparece otro."},{"id":"maps_no_sabe","area":"presencia","tipo":"hipotesis","prioridad":"media","condicion":{"campo":"maps","es":"no_sabe"},"problema":"No sabe si tiene perfil en Google Maps","corto":"no tenés claro si tu perfil de Google Maps está bien armado","evidencia":"Respondió: {maps}.","impacto":"Puede existir un perfil creado por otra persona, sin control, con datos viejos o reseñas sin responder. Hay que verificarlo.","solucion":"Buscar el negocio en Maps, reclamar el perfil si existe y actualizarlo.","servicio":null,"acciones":["Buscar el negocio en Google Maps","Reclamar o crear el perfil","Actualizar datos y fotos"],"indicadores":["Perfil verificado (sí/no)","Reseñas respondidas"],"oportunidad":"Tomar el control de cómo te ven en Google.","argumento":"Lo primero es saber qué ve un cliente cuando te busca; lo revisamos juntos."},{"id":"solo_recomendacion","area":"captacion","tipo":"hecho","prioridad":"alta","condicion":{"all":[{"campo":"canales","soloEntre":["recomendacion","local"]},{"not":{"campo":"capacidad","es":"saturado"}}]},"problema":"Depende del boca en boca","corto":"hoy dependés casi todo de recomendaciones","evidencia":"Los clientes le llegan por: {canales}.","impacto":"El volumen de trabajo depende de que otros lo recomienden. No hay forma de subirlo cuando hace falta, por ejemplo en meses flojos.","solucion":"Sumar un canal de captación propio y medible: campañas de Meta Ads con destino a WhatsApp o a la web.","servicio":"meta_ads","acciones":["Definir zona y servicio a promocionar","Armar anuncios con fotos reales","Arrancar con una inversión chica que elija el cliente","Medir consultas por semana"],"indicadores":["Consultas por campaña","Costo por consulta","Ventas que vienen de anuncios"],"oportunidad":"Tener un canal que se puede prender o subir cuando hace falta más trabajo.","argumento":"La recomendación es valiosa, pero no la controlás. Con campañas decidís cuándo querés más consultas."},{"id":"sin_publicidad_quiere_clientes","area":"captacion","tipo":"hecho","prioridad":"media","condicion":{"all":[{"campo":"publicidad","es":"no"},{"campo":"objetivo","es":"clientes"},{"not":{"campo":"capacidad","es":"saturado"}},{"not":{"campo":"canales","soloEntre":["recomendacion","local"]}}]},"problema":"Quiere más clientes pero no invierte en captación","corto":"querés más clientes pero hoy no tenés un canal pago que los traiga","evidencia":"Declaró: {publicidad}. Objetivo: {objetivo}.","impacto":"El crecimiento queda atado a los canales actuales, sin una forma directa de sumar consultas.","solucion":"Campañas de Meta Ads segmentadas por zona, con un monto de inversión que define el cliente.","servicio":"meta_ads","acciones":["Elegir el servicio con mejor margen para promocionar","Armar campaña de prueba","Revisar resultados cada semana"],"indicadores":["Consultas por campaña","Costo por consulta"],"oportunidad":"Sumar consultas nuevas de la zona de forma medible.","argumento":"Arrancás con un monto chico, medís y decidís con números si conviene seguir."},{"id":"paga_sin_web","area":"captacion","tipo":"hecho","prioridad":"alta","condicion":{"all":[{"campo":"publicidad","en":["meta","google","ambas"]},{"campo":"web","en":["no","sin_resultados"]}]},"problema":"Paga publicidad sin una web que convierta","corto":"estás pagando publicidad sin una web que convierta esas visitas","evidencia":"Declaró: {publicidad}. {web}.","impacto":"Parte de la inversión en anuncios puede perderse si la persona no encuentra dónde ver más información o consultar fácil.","solucion":"Web enfocada en consultas como destino de los anuncios.","servicio":"web","acciones":["Crear una página de destino para los anuncios","Agregar WhatsApp y formulario corto","Medir consultas por anuncio"],"indicadores":["Consultas por anuncio","Costo por consulta antes y después"],"oportunidad":"Sacarle más provecho a la plata que ya invertís en publicidad.","argumento":"Ya estás invirtiendo; con un buen destino, la misma inversión puede rendir más."},{"id":"ads_sin_medicion","area":"medicion","tipo":"faltante","prioridad":"media","condicion":{"all":[{"campo":"publicidad","en":["meta","google","ambas"]},{"campo":"inversionAds","vacio":true}]},"problema":"Invierte en publicidad sin datos de inversión ni resultados","corto":"no tenemos claro cuánto invertís en publicidad y qué te devuelve","evidencia":"Declaró: {publicidad}. No informó cuánto invierte por mes.","impacto":"Sin estos datos no se puede saber si la publicidad deja ganancia.","solucion":"Registrar inversión mensual, consultas generadas y ventas para decidir si seguir, ajustar o pausar.","servicio":null,"acciones":["Pedir el gasto mensual en la plataforma","Contar consultas que vienen de anuncios","Cruzar con ventas cerradas"],"indicadores":["Inversión mensual","Costo por consulta","Costo por venta"],"oportunidad":"Decidir la publicidad con números y no a ojo.","argumento":"Antes de invertir más, conviene saber cuánto te cuesta hoy cada cliente."},{"id":"costo_venta_alto","area":"medicion","tipo":"hecho","prioridad":"alta","condicion":{"campo":"costoSobreGanancia","mayor":1},"problema":"La publicidad cuesta más de lo que deja cada venta","corto":"hoy cada venta por publicidad te cuesta más de lo que te deja","evidencia":"Inversión {inversionAds} ÷ {ventasMes} ventas = {costoVenta} por venta. Ganancia estimada por venta: {gananciaVenta} (ticket {ticket} × margen {margen}). Cálculo hecho con los datos que dio el cliente.","impacto":"Con estos números la publicidad pierde plata en cada venta.","solucion":"Revisar segmentación, anuncios y destino de la campaña; medir costo por consulta y por venta cada semana.","servicio":"meta_ads","acciones":["Auditar campañas actuales","Ajustar segmentación y anuncios","Medir costo por venta semanal"],"indicadores":["Costo por venta","Ganancia por venta","Ventas desde anuncios"],"oportunidad":"Bajar el costo de cada cliente nuevo.","argumento":"Los números que me pasaste muestran que hay margen para mejorar la campaña."},{"id":"atencion_manual","area":"conversion","tipo":"hecho","prioridad":"media","condicion":{"all":[{"campo":"automatica","es":"no"},{"any":[{"campo":"objetivo","en":["seguimiento","automatizar"]},{"campo":"consultasMes","mayorIgual":60},{"campo":"capacidad","es":"saturado"}]}]},"problema":"Atiende todas las consultas a mano","corto":"respondés todas las consultas a mano y algunas quedan esperando","evidencia":"Declaró: {automatica}.","impacto":"Cuando la respuesta tarda, la persona consulta a otro. Además consume horas que podrían ir al trabajo en sí.","solucion":"Empleado virtual en WhatsApp que responde al instante lo frecuente, toma datos y deriva lo importante.","servicio":"empleado_virtual","acciones":["Listar las preguntas más frecuentes","Configurar respuestas y toma de datos","Definir cuándo se deriva a una persona"],"indicadores":["Tiempo de primera respuesta","Consultas atendidas fuera de horario","Horas ahorradas por semana"],"oportunidad":"Responder siempre al instante sin estar pegado al teléfono.","argumento":"Respondés al instante aunque estés trabajando, y vos te ocupás solo de lo que importa."},{"id":"interes_automatizar","area":"conversion","tipo":"hecho","prioridad":"media","condicion":{"campo":"automatica","es":"interes"},"problema":"Le interesa automatizar la atención","corto":"te interesa automatizar la atención por WhatsApp","evidencia":"Declaró: {automatica}.","impacto":"Hay disposición a cambiar la forma de atender; conviene definir qué tareas automatizar primero.","solucion":"Empleado virtual que responde, toma datos y agenda.","servicio":"empleado_virtual","acciones":["Relevar tareas repetitivas","Configurar el empleado virtual","Probar 2 semanas y ajustar"],"indicadores":["Tiempo de primera respuesta","Consultas resueltas sin intervención"],"oportunidad":"Ganar tiempo y ordenar la atención.","argumento":"Ya viste que te puede servir; lo dejamos andando a tu medida."},{"id":"baja_conversion","area":"conversion","tipo":"hecho","prioridad":"alta","condicion":{"all":[{"campo":"tasaConversion","menor":20},{"campo":"consultasMes","mayorIgual":5}]},"problema":"Se cierran pocas consultas","corto":"de cada 5 consultas, menos de 1 termina en venta","evidencia":"{ventasMes} ventas sobre {consultasMes} consultas por mes ({tasaConversion}%), según lo que declaró.","impacto":"La mayoría de las consultas no se convierte. Ahí hay ventas posibles sin gastar más en publicidad.","solucion":"Responder más rápido, mandar un presupuesto claro y hacer seguimiento a quien no contestó.","servicio":"empleado_virtual","acciones":["Medir tiempo de respuesta","Armar presupuesto modelo","Seguimiento a las 24 y 72 horas"],"indicadores":["Tasa de conversión de consultas","Tiempo de respuesta","Presupuestos con seguimiento"],"oportunidad":"Vender más con las mismas consultas que ya llegan.","argumento":"Antes de traer más gente, conviene cerrar más de la que ya te escribe."},{"id":"sin_seguimiento","area":"seguimiento","tipo":"hecho","prioridad":"alta","condicion":{"campo":"seguimiento","es":"no"},"problema":"No hace seguimiento de consultas ni presupuestos","corto":"no hay seguimiento a quien consultó y no respondió","evidencia":"Declaró: {seguimiento}.","impacto":"Presupuestos enviados que nadie vuelve a tocar quedan perdidos aunque el cliente estuviera interesado.","solucion":"Seguimiento automático por WhatsApp a quien pidió presupuesto y no respondió.","servicio":"empleado_virtual","acciones":["Registrar cada consulta","Mensaje automático a las 24 y 72 horas","Lista semanal de pendientes"],"indicadores":["Presupuestos con seguimiento","Ventas recuperadas por seguimiento"],"oportunidad":"Recuperar ventas que hoy se pierden por olvido.","argumento":"Muchas veces el cliente no dijo que no: solo nadie le volvió a escribir."},{"id":"seguimiento_manual_volumen","area":"seguimiento","tipo":"hipotesis","prioridad":"media","condicion":{"all":[{"campo":"seguimiento","es":"manual"},{"campo":"consultasMes","mayorIgual":40}]},"problema":"Seguimiento manual con mucho volumen","corto":"con tantas consultas, el seguimiento a mano se hace difícil de sostener","evidencia":"Seguimiento manual con {consultasMes} consultas por mes (declarado).","impacto":"Es probable que algunas consultas queden sin seguimiento. A confirmar con el cliente.","solucion":"Automatizar recordatorios y seguimiento.","servicio":"empleado_virtual","acciones":["Confirmar cuántas consultas quedan sin seguimiento","Automatizar recordatorios"],"indicadores":["Consultas sin seguimiento","Tiempo dedicado por semana"],"oportunidad":"Liberar tiempo sin perder ventas.","argumento":"Lo que hoy hacés a mano lo puede sostener un sistema, todos los días."},{"id":"pide_orden","area":"seguimiento","tipo":"hecho","prioridad":"alta","condicion":{"all":[{"campo":"objetivo","es":"seguimiento"},{"campo":"seguimiento","vacio":true}]},"problema":"Necesita ordenar consultas y seguimiento","corto":"querés ordenar las consultas y el seguimiento","evidencia":"Objetivo declarado: {objetivo}.","impacto":"El propio cliente identifica desorden en la atención; suele traducirse en respuestas tardías y ventas que se escapan.","solucion":"Registro de consultas y seguimiento automático por WhatsApp.","servicio":"empleado_virtual","acciones":["Relevar cómo entran hoy las consultas","Unificar en WhatsApp con etiquetas","Seguimiento automático"],"indicadores":["Consultas registradas","Consultas sin responder","Tiempo de respuesta"],"oportunidad":"Tener todas las consultas a la vista y ninguna olvidada.","argumento":"Me dijiste que querés ordenar la atención; ese es justo el punto de partida."},{"id":"capacidad_saturada","area":"conversion","tipo":"hecho","prioridad":"media","condicion":{"campo":"capacidad","es":"saturado"},"problema":"Capacidad operativa al límite","corto":"hoy estás con la capacidad al límite","evidencia":"Declaró: {capacidad}.","impacto":"Traer más consultas ahora puede empeorar la atención y los tiempos de entrega.","solucion":"Ordenar y automatizar antes de invertir en captación; priorizar los trabajos de mayor ganancia.","servicio":"empleado_virtual","acciones":["Automatizar respuestas y filtros","Definir trabajos prioritarios","Revisar precios"],"indicadores":["Horas por semana en atención","Ticket promedio"],"oportunidad":"Ganar más con la misma capacidad, eligiendo mejor los trabajos.","argumento":"No te propongo más volumen: te propongo trabajar mejor con lo que ya tenés."},{"id":"imagen_con_web","area":"presencia","tipo":"hipotesis","prioridad":"media","condicion":{"all":[{"campo":"objetivo","es":"imagen"},{"campo":"web","es":"si"}]},"problema":"Quiere mejorar su imagen online","corto":"querés que tu imagen online esté a la altura de tu trabajo","evidencia":"Objetivo declarado: {objetivo}. Tiene web.","impacto":"Hay que revisar la web, el perfil de Google y las reseñas para saber qué ajustar. No se recomienda rehacer nada sin verlo antes.","solucion":"Revisión de web, perfil de Google y reseñas, con una lista concreta de mejoras.","servicio":null,"acciones":["Revisar web actual","Revisar perfil de Google y reseñas","Proponer mejoras puntuales"],"indicadores":["Reseñas nuevas","Consultas desde web y Maps"],"oportunidad":"Que la imagen online refleje la calidad del trabajo.","argumento":"Primero miramos lo que ya tenés y después decidimos qué vale la pena cambiar."},{"id":"sin_datos_consultas","area":"medicion","tipo":"faltante","prioridad":"media","condicion":{"campo":"consultasMes","vacio":true},"problema":"No hay datos de consultas mensuales","corto":"no sabemos cuántas consultas te llegan por mes","evidencia":"El dato no fue informado.","impacto":"Sin este dato no se puede medir la conversión ni comparar antes y después.","solucion":"Registrar cuántas consultas entran por semana y por qué canal.","servicio":null,"acciones":["Preguntarlo en la llamada","Registrar consultas por canal durante 2 semanas"],"indicadores":["Consultas por semana","Consultas por canal"],"oportunidad":"Tener una base para medir resultados.","argumento":"Con un dato simple como cuántas consultas te llegan, después podés ver si lo que hacemos funciona."},{"id":"sin_datos_ticket","area":"medicion","tipo":"faltante","prioridad":"baja","condicion":{"campo":"ticket","vacio":true},"problema":"Falta el ticket promedio","corto":"no sabemos cuánto vale en promedio cada venta","evidencia":"El dato no fue informado.","impacto":"Sin el ticket no se puede estimar cuántas ventas hacen falta para recuperar la inversión.","solucion":"Consultar el valor promedio de cada venta o trabajo.","servicio":null,"acciones":["Preguntarlo en la llamada"],"indicadores":["Ticket promedio"],"oportunidad":"Poder calcular el retorno de cada servicio.","argumento":"Con tu ticket promedio te muestro en cuántas ventas recuperás la inversión."}],"preguntas":[{"campo":"rubro","tipo":"texto","base":true,"pregunta":"¿A qué se dedica el negocio?"},{"campo":"zona","tipo":"texto","base":true,"pregunta":"¿En qué zona trabaja?"},{"campo":"web","tipo":"opcion","base":true,"pregunta":"¿Tiene página web?","opciones":{"si":"Sí","no":"No","sin_resultados":"Tiene pero no le trae clientes"}},{"campo":"maps","tipo":"opcion","base":true,"pregunta":"¿Tiene perfil en Google Maps?","opciones":{"si":"Sí","no":"No","no_sabe":"No sabe"}},{"campo":"publicidad","tipo":"opcion","base":true,"pregunta":"¿Paga publicidad en internet?","opciones":{"meta":"Sí, en Meta","google":"Sí, en Google","ambas":"En Meta y Google","no":"No"}},{"campo":"automatica","tipo":"opcion","base":true,"pregunta":"¿Usa atención automática o asistentes virtuales?","opciones":{"si":"Sí","no":"No","interes":"Le interesa"}},{"campo":"canales","tipo":"multi","base":true,"pregunta":"¿Cómo le llegan hoy los clientes?","opciones":{"recomendacion":"Recomendación","redes":"Redes sociales","google":"Google","publicidad":"Publicidad","local":"Local físico"}},{"campo":"objetivo","tipo":"opcion","base":true,"pregunta":"¿Qué quiere mejorar primero?","opciones":{"clientes":"Conseguir más clientes","seguimiento":"Ordenar consultas y seguimiento","imagen":"Mejorar la imagen online","automatizar":"Automatizar tareas"}},{"campo":"consultasMes","tipo":"numero","pregunta":"¿Cuántas consultas recibís por mes, más o menos?"},{"campo":"ventasMes","tipo":"numero","pregunta":"¿Cuántas de esas consultas se convierten en {unidad} por mes?"},{"campo":"ticket","tipo":"numero","pregunta":"¿Cuánto vale en promedio cada {unidadSing}? (en pesos)"},{"campo":"margen","tipo":"numero","pregunta":"¿Qué margen te queda, aproximadamente? (en %)"},{"campo":"inversionAds","tipo":"numero","pregunta":"¿Cuánto le pagás por mes a Meta o Google en publicidad?","condicion":{"campo":"publicidad","en":["meta","google","ambas"]}},{"campo":"seguimiento","tipo":"opcion","pregunta":"¿Hacés seguimiento a quien consultó y no compró?","opciones":{"no":"No","manual":"Sí, a mano","sistema":"Sí, con un sistema o CRM"}},{"campo":"capacidad","tipo":"opcion","pregunta":"¿Podrías atender más {unidad} con lo que tenés hoy?","opciones":{"sobra":"Sí, bastantes más","justa":"Algunos más, estoy justo","saturado":"No, estoy saturado"}},{"campo":"competencia","tipo":"texto","pregunta":"¿Quiénes son tus principales competidores en la zona? (los que conozcas)"},{"campo":"objetivoDetalle","tipo":"texto","pregunta":"¿Qué resultado concreto te gustaría lograr en los próximos 3 meses?"}]},"objections":{"objeciones":[{"id":"caro","objecion":"Es caro / no tengo presupuesto ahora","aplica":["general"],"respuesta":"Te entiendo. Por eso arrancamos solo por lo que más te urge, {servicioPrincipal}, sin sumar cosas que no necesitás. La idea es que lo recuperes con pocos {unidad} nuevos."},{"id":"recomendacion","objecion":"Ya trabajo con recomendaciones, no me hace falta","aplica":["web","meta_ads"],"respuesta":"Buenísimo que te recomienden, es la mejor señal. Lo que proponemos es que quien te recomienda tenga dónde mandar a la gente, y que no dependas solo de eso en los meses flojos."},{"id":"lo_pienso","objecion":"Lo pienso y te aviso","aplica":["general"],"respuesta":"Dale, sin problema. ¿Hay algo puntual que te genere duda? Si querés te paso un ejemplo concreto para tu rubro así lo decidís con más información."},{"id":"ya_tengo_web","objecion":"Ya tengo web / ya tuve una y no sirvió","aplica":["web"],"respuesta":"Tiene sentido la duda. La diferencia está en que la web esté hecha para que te consulten: WhatsApp a mano, tus trabajos, reseñas y precios orientativos. Y el mantenimiento por 2 años ya está incluido."},{"id":"publicidad_no_sirve","objecion":"Probé publicidad y no funcionó","aplica":["meta_ads"],"respuesta":"Pasa seguido cuando la campaña no tiene un destino claro o no se mide. Acá arrancamos con un monto que elegís vos, medimos consultas reales y ajustamos cada semana."},{"id":"inversion_ads","objecion":"¿Cuánto tengo que poner en publicidad?","aplica":["meta_ads"],"respuesta":"Eso lo decidís vos y se lo pagás directo a Meta; no está incluido en nuestro honorario. Podemos arrancar con un monto chico, medir y después decidir si conviene subirlo."},{"id":"robot","objecion":"No quiero que me atienda un robot","aplica":["empleado_virtual"],"respuesta":"Lo entiendo. El empleado virtual responde lo básico al instante (horarios, precios orientativos, datos) y te pasa la conversación cuando hace falta que respondas vos. Nadie queda sin respuesta."},{"id":"no_tengo_tiempo","objecion":"No tengo tiempo para ocuparme de esto","aplica":["general"],"respuesta":"Justamente, de eso nos encargamos nosotros. De tu lado necesitamos una charla corta y algunas fotos; el resto lo armamos y te lo mostramos antes de publicar."},{"id":"mucho_trabajo","objecion":"Ya tengo mucho trabajo","aplica":["meta_ads","empleado_virtual"],"respuesta":"Genial. Entonces el foco no es traer más volumen sino ordenar: responder rápido, filtrar y quedarte con los trabajos que más te convienen."}]}}/*FALLBACK_END*/;

  /* ---------- utilidades ---------- */
  function sinAcentos(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function clave(s) { return sinAcentos(s).toLowerCase().replace(/[¿?¡!*_]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function vacio(v) { return v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'number' && isNaN(v)); }
  function pesos(n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function primerNombre(s) { return String(s || '').trim().split(/\s+/)[0] || ''; }
  function listaY(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; }

  /** Convierte "$1.500.000", "150 mil", "1,5M", "30%" o "entre 20 y 30" en número. */
  function numero(v) {
    if (typeof v === 'number') return isNaN(v) ? null : v;
    var s = clave(v);
    if (!s) return null;
    var m = s.match(/\d[\d.,]*/);
    if (!m) return null;
    var t = m[0].replace(/[.,]$/, '');
    if (t.indexOf('.') >= 0 && t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    else if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, '');
    else t = t.replace(',', '.');
    var n = parseFloat(t);
    if (isNaN(n)) return null;
    var resto = s.slice(m.index + m[0].length);
    if (/^\s*(m\b|millon)/.test(resto)) n *= 1e6;
    else if (/^\s*(mil\b|k\b)/.test(resto)) n *= 1e3;
    return n;
  }

  /* ---------- datos ---------- */
  function datosEmbebidos() { return clonar(FALLBACK); }

  function cargarDatos(base) {
    base = base || 'data/';
    var nombres = ['services', 'industries', 'rules', 'objections'];
    if (typeof fetch !== 'function') return Promise.resolve(datosEmbebidos());
    return Promise.all(nombres.map(function (n) {
      return fetch(base + n + '.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(n); return r.json(); });
    })).then(function (r) {
      return { services: r[0], industries: r[1], rules: r[2], objections: r[3], origen: 'json' };
    }).catch(function () { var d = datosEmbebidos(); d.origen = 'embebido'; return d; });
  }

  function configPorDefecto(datos) {
    var s = {};
    datos.services.servicios.forEach(function (x) { s[x.id] = { precio: x.precio || 0, precioPrimerMes: x.precioPrimerMes || 0, precioMensual: x.precioMensual || 0 }; });
    return { precios: s, vendedor: 'Carlos', empresa: 'IMPULSA', whatsappEmpresa: '' };
  }

  function servicio(datos, id) { return datos.services.servicios.filter(function (s) { return s.id === id; })[0]; }
  function industria(datos, id) { return datos.industries.industrias.filter(function (i) { return i.id === id; })[0] || null; }

  /* ---------- perfil ---------- */
  var CAMPOS = ['negocio', 'contacto', 'whatsapp', 'rubro', 'industria', 'zona', 'web', 'maps', 'publicidad', 'automatica', 'canales',
    'objetivo', 'consultasMes', 'ventasMes', 'ticket', 'margen', 'inversionAds', 'seguimiento', 'capacidad', 'competencia', 'objetivoDetalle', 'notas'];
  var NUMERICOS = ['consultasMes', 'ventasMes', 'ticket', 'margen', 'inversionAds'];

  function perfilVacio() {
    var p = {};
    CAMPOS.forEach(function (c) { p[c] = null; });
    p.canales = [];
    p.verificado = {};          // campos que Carlos comprobó por su cuenta (ej. web, maps)
    p.respuestasRubro = {};     // respuestas a preguntas propias del rubro
    return p;
  }

  /* Etiquetas reconocidas (formulario de diagnóstico IMPULSA + variantes genéricas). El orden importa. */
  var ETIQUETAS = [
    [/nombre del negocio|nombre comercial|^negocio$|^empresa$|razon social/, 'negocio'],
    [/inversion|gasto en publicidad|presupuesto (de|en|para) publicidad/, 'inversionAds'],
    [/ticket|valor promedio|precio promedio/, 'ticket'],
    [/margen/, 'margen'],
    [/consultas (por mes|mensuales|al mes)|^consultas$/, 'consultasMes'],
    [/ventas (por mes|mensuales|al mes)|^ventas$|cierres/, 'ventasMes'],
    [/^nombre|^contacto|responsable/, 'contacto'],
    [/whats|telefono|celular|^tel\b/, 'whatsapp'],
    [/tipo de negocio|^rubro|actividad|^industria/, 'rubro'],
    [/^zona|ciudad|localidad|ubicacion|barrio/, 'zona'],
    [/google maps|perfil en google|^maps/, 'maps'],
    [/pagina web|sitio web|^web|^sitio/, 'web'],
    [/publicidad|anuncios/, 'publicidad'],
    [/atencion automatica|asistente|automatica/, 'automatica'],
    [/como te llegan|como le llegan|fuentes|canales|de donde vienen/, 'canales'],
    [/mejorar primero|objetivo|que te gustaria/, 'objetivo'],
    [/seguimiento/, 'seguimiento'],
    [/capacidad/, 'capacidad'],
    [/competencia|competidores/, 'competencia'],
    [/notas|comentarios|observaciones/, 'notas']
  ];

  function campoDeEtiqueta(etq) {
    var k = clave(etq);
    for (var i = 0; i < ETIQUETAS.length; i++) if (ETIQUETAS[i][0].test(k)) return ETIQUETAS[i][1];
    return null;
  }

  /** Lleva una respuesta libre al valor interno del campo. Devuelve null si no se entiende. */
  function normalizar(campo, valor) {
    var raw = String(valor == null ? '' : valor).trim();
    var k = clave(raw);
    if (!k || /^[-—–.]+$/.test(raw)) return campo === 'canales' ? [] : null;
    switch (campo) {
      case 'web':
        if (/no (me )?trae|sin resultado|no sirve|no funciona|pero/.test(k)) return 'sin_resultados';
        if (/^no\b/.test(k)) return 'no';
        if (/^si\b|tengo/.test(k)) return 'si';
        return null;
      case 'maps':
        if (/no se|ni idea|no estoy seguro/.test(k)) return 'no_sabe';
        if (/^no\b/.test(k)) return 'no';
        if (/^si\b/.test(k)) return 'si';
        return null;
      case 'publicidad':
        var meta = /meta|facebook|instagram/.test(k), goo = /google/.test(k);
        if (meta && goo) return 'ambas';
        if (meta) return 'meta';
        if (goo) return 'google';
        if (/^no\b|nunca/.test(k)) return 'no';
        if (/^si\b/.test(k)) return 'meta';
        return null;
      case 'automatica':
        if (/interes|quisiera|me gustaria/.test(k)) return 'interes';
        if (/^no\b/.test(k)) return 'no';
        if (/^si\b/.test(k)) return 'si';
        return null;
      case 'canales':
        var out = [];
        k.split(/,|;|\/|\by\b/).forEach(function (t) {
          t = t.trim();
          if (/recomend|boca/.test(t)) out.push('recomendacion');
          else if (/redes|instagram|facebook|tiktok/.test(t)) out.push('redes');
          else if (/google|maps/.test(t)) out.push('google');
          else if (/publicidad|anuncio|ads/.test(t)) out.push('publicidad');
          else if (/local|vidriera|pasan/.test(t)) out.push('local');
        });
        return uniq(out);
      case 'objetivo':
        if (/cliente|vender|ventas/.test(k)) return 'clientes';
        if (/orden|seguimiento/.test(k)) return 'seguimiento';
        if (/imagen/.test(k)) return 'imagen';
        if (/automat/.test(k)) return 'automatizar';
        return null;
      case 'seguimiento':
        if (/crm|sistema|planilla|automat/.test(k)) return 'sistema';
        if (/^no\b|nunca/.test(k)) return 'no';
        if (/^si\b|mano|a veces/.test(k)) return 'manual';
        return null;
      case 'capacidad':
        if (/saturad|no doy abasto|^no\b|lleno/.test(k)) return 'saturado';
        if (/justo|algun/.test(k)) return 'justa';
        if (/^si\b|bastante|sobra|mucho/.test(k)) return 'sobra';
        return null;
      default:
        if (NUMERICOS.indexOf(campo) >= 0) return numero(raw);
        return raw;
    }
  }

  /**
   * Lee el mensaje que llega por WhatsApp desde el formulario de diagnóstico
   * ("NOMBRE: …", "¿TENÉS PÁGINA WEB?: …") o cualquier texto con líneas "Campo: valor".
   */
  function parsearMensaje(texto, datos) {
    var perfil = perfilVacio(), reconocidos = [], extras = {};
    String(texto || '').split(/\r?\n/).forEach(function (linea) {
      var l = linea.trim();
      if (!l) return;
      l = l.replace(/^\[[^\]]{4,30}\]\s*[^:]{1,40}:\s*(?=.*:)/, '');                 // [22/11 10:30] Juan: …
      l = l.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}[^-]{0,6}-\s*[^:]{1,40}:\s*(?=.*:)/, '');
      l = l.replace(/[*_~]/g, '').replace(/^[•\-–]\s*/, '');
      var i = l.indexOf(':');
      if (i < 1 || i > 80) return;
      var etq = l.slice(0, i), val = l.slice(i + 1).trim();
      var campo = campoDeEtiqueta(etq);
      if (!campo) { if (val) extras[etq.trim()] = val; return; }
      var n = normalizar(campo, val);
      if (vacio(n)) return;
      perfil[campo] = n;
      reconocidos.push(campo);
    });
    if (perfil.rubro && datos) perfil.industria = detectarIndustria(perfil.rubro, datos);
    var ex = Object.keys(extras);
    if (ex.length) perfil.notas = ex.map(function (e) { return e + ': ' + extras[e]; }).join('\n');
    return { perfil: perfil, reconocidos: uniq(reconocidos), extras: extras };
  }

  /** Une un perfil parcial con otro, sin pisar datos con vacíos. */
  function combinar(base, nuevo) {
    var p = clonar(base || perfilVacio());
    Object.keys(nuevo || {}).forEach(function (c) {
      if (c === 'verificado' || c === 'respuestasRubro') { p[c] = Object.assign({}, p[c] || {}, nuevo[c] || {}); return; }
      if (!vacio(nuevo[c])) p[c] = clonar(nuevo[c]);
    });
    return p;
  }

  /** Elige la industria cuyo término coincide de forma más específica (el más largo). */
  function detectarIndustria(rubro, datos) {
    var k = ' ' + clave(rubro) + ' ', mejor = null, largo = 0;
    datos.industries.industrias.forEach(function (ind) {
      ind.palabras.forEach(function (w) {
        var wk = clave(w);
        if (k.indexOf(wk) >= 0 && wk.length > largo) { largo = wk.length; mejor = ind.id; }
      });
    });
    return mejor;
  }

  /* ---------- textos legibles ---------- */
  var TXT = {
    web: { si: 'Tiene página web', no: 'No tiene página web', sin_resultados: 'Tiene web pero no le trae clientes' },
    maps: { si: 'Tiene perfil en Google Maps', no: 'No tiene perfil en Google Maps', no_sabe: 'No sabe si tiene perfil en Google Maps' },
    publicidad: { meta: 'Paga publicidad en Meta', google: 'Paga publicidad en Google', ambas: 'Paga publicidad en Meta y Google', no: 'No paga publicidad' },
    automatica: { si: 'Usa atención automática', no: 'No usa atención automática', interes: 'Le interesa la atención automática' },
    canales: { recomendacion: 'recomendación', redes: 'redes sociales', google: 'Google', publicidad: 'publicidad', local: 'local físico' },
    objetivo: { clientes: 'conseguir más clientes', seguimiento: 'ordenar consultas y seguimiento', imagen: 'mejorar su imagen online', automatizar: 'automatizar tareas' },
    seguimiento: { no: 'No hace seguimiento', manual: 'Hace seguimiento a mano', sistema: 'Usa un sistema o CRM' },
    capacidad: { sobra: 'Puede atender bastante más', justa: 'Está justo de capacidad', saturado: 'Está saturado' }
  };
  var DINERO = ['ticket', 'inversionAds', 'costoVenta', 'gananciaVenta'];

  function mostrar(campo, v) {
    if (vacio(v)) return '—';
    if (Array.isArray(v)) return v.map(function (x) { return (TXT[campo] && TXT[campo][x]) || x; }).join(', ');
    if (TXT[campo] && TXT[campo][v]) return TXT[campo][v];
    if (DINERO.indexOf(campo) >= 0) return pesos(v);
    if (campo === 'margen') return v + '%';
    if (campo === 'tasaConversion') return String(Math.round(v * 10) / 10);
    return String(v);
  }

  function rellenar(tpl, ctx) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, c) { return c in ctx ? (typeof ctx[c] === 'string' && !(TXT[c]) ? ctx[c] : mostrar(c, ctx[c])) : '{' + c + '}'; });
  }

  /* ---------- faltantes y modo guiado ---------- */
  var BASE_LABELS = { contacto: 'Nombre de contacto', rubro: 'Rubro', zona: 'Zona', web: 'Página web', maps: 'Google Maps', publicidad: 'Publicidad', automatica: 'Atención automática', canales: 'Cómo llegan los clientes', objetivo: 'Qué quiere mejorar' };

  function faltantes(perfil, datos) {
    var t = terminos(perfil, datos);
    var base = Object.keys(BASE_LABELS).filter(function (c) { return vacio(perfil[c]); }).map(function (c) { return { campo: c, etiqueta: BASE_LABELS[c] }; });
    var guiado = datos.rules.preguntas.filter(function (q) { return !q.base && vacio(perfil[q.campo]) && evaluar(q.condicion, perfil); })
      .map(function (q) { return { campo: q.campo, etiqueta: rellenar(q.pregunta, t) }; });
    return { base: base, guiado: guiado };
  }

  function terminos(perfil, datos) {
    var ind = industria(datos, perfil.industria);
    return { unidad: ind ? ind.unidad : 'ventas', unidadSing: ind ? ind.unidadSing : 'venta' };
  }

  /** Preguntas pendientes, adaptadas al rubro. Nunca devuelve una ya respondida. */
  function preguntasGuiadas(perfil, datos) {
    var t = terminos(perfil, datos);
    var out = datos.rules.preguntas.filter(function (q) { return vacio(perfil[q.campo]) && evaluar(q.condicion, perfil); })
      .map(function (q) { var c = clonar(q); c.pregunta = rellenar(q.pregunta, t); return c; });
    var ind = industria(datos, perfil.industria);
    if (ind) ind.preguntas.forEach(function (txt, i) {
      var id = ind.id + '_' + i;
      if (vacio((perfil.respuestasRubro || {})[id])) out.push({ campo: 'rubro:' + id, tipo: 'texto', pregunta: txt, rubro: true });
    });
    return out;
  }

  /* ---------- motor de reglas ---------- */
  function evaluar(c, p) {
    if (!c) return true;
    if (c.all) return c.all.every(function (x) { return evaluar(x, p); });
    if (c.any) return c.any.some(function (x) { return evaluar(x, p); });
    if (c.not) return !evaluar(c.not, p);
    var v = p[c.campo];
    if ('es' in c) return v === c.es;
    if ('en' in c) return c.en.indexOf(v) >= 0;
    if ('incluye' in c) return Array.isArray(v) && v.indexOf(c.incluye) >= 0;
    if ('soloEntre' in c) return Array.isArray(v) && v.length > 0 && v.every(function (x) { return c.soloEntre.indexOf(x) >= 0; });
    if ('vacio' in c) return vacio(v) === c.vacio;
    if (typeof v !== 'number' || isNaN(v)) return false;
    if ('menor' in c) return v < c.menor;
    if ('mayor' in c) return v > c.mayor;
    if ('mayorIgual' in c) return v >= c.mayorIgual;
    return false;
  }

  function camposDe(c, out) {
    out = out || [];
    if (!c) return out;
    ['all', 'any'].forEach(function (k) { if (c[k]) c[k].forEach(function (x) { camposDe(x, out); }); });
    if (c.not) camposDe(c.not, out);
    if (c.campo) out.push(c.campo);
    return uniq(out);
  }

  /** Datos derivados SOLO de lo declarado (nunca se inventan). */
  function contexto(p) {
    var ctx = clonar(p);
    if (p.consultasMes > 0 && p.ventasMes != null) ctx.tasaConversion = Math.round(p.ventasMes / p.consultasMes * 1000) / 10;
    if (p.inversionAds > 0 && p.ventasMes > 0) ctx.costoVenta = p.inversionAds / p.ventasMes;
    if (p.ticket > 0 && p.margen > 0) ctx.gananciaVenta = p.ticket * p.margen / 100;
    if (ctx.costoVenta && ctx.gananciaVenta) ctx.costoSobreGanancia = ctx.costoVenta / ctx.gananciaVenta;
    return ctx;
  }

  var PESO = { alta: 3, media: 2, baja: 1 };
  var DERIVADOS = { tasaConversion: ['ventasMes', 'consultasMes'], costoSobreGanancia: ['inversionAds', 'ventasMes', 'ticket', 'margen'] };

  function etiquetaFuente(regla, perfil) {
    if (regla.tipo === 'hipotesis') return 'hipotesis';
    if (regla.tipo === 'faltante') return 'faltante';
    var campos = [];
    camposDe(regla.condicion).forEach(function (c) { campos = campos.concat(DERIVADOS[c] || [c]); });
    campos = campos.filter(function (c) { return !vacio(perfil[c]); });
    var ver = perfil.verificado || {};
    return campos.length && campos.every(function (c) { return ver[c]; }) ? 'verificado' : 'declarado';
  }

  function excluirServicio(id, p) {
    if (id === 'web' && p.web === 'si') return true;
    if (id === 'empleado_virtual' && p.automatica === 'si') return true;
    if (id === 'meta_ads' && p.capacidad === 'saturado') return true;
    return false;
  }

  /* ---------- diagnóstico completo ---------- */
  function diagnosticar(perfilIn, datos, config) {
    config = config || configPorDefecto(datos);
    var p = combinar(perfilVacio(), perfilIn);
    if (!p.industria && p.rubro) p.industria = detectarIndustria(p.rubro, datos);
    var ctx = contexto(p), ind = industria(datos, p.industria), t = terminos(p, datos);
    var focos = (datos.rules.objetivoAreas || {})[p.objetivo] || [];

    var hallazgos = datos.rules.reglas.filter(function (r) { return evaluar(r.condicion, ctx); }).map(function (r) {
      var servicioId = r.servicio && !excluirServicio(r.servicio, p) ? r.servicio : null;
      var h = {
        id: r.id, area: r.area, areaNombre: datos.rules.areas[r.area], prioridad: r.prioridad, fuente: etiquetaFuente(r, p),
        problema: r.problema, corto: r.corto, evidencia: rellenar(r.evidencia, ctx), impacto: r.impacto, solucion: r.solucion,
        servicio: servicioId, acciones: r.acciones.slice(), indicadores: r.indicadores.slice(), oportunidad: r.oportunidad, argumento: r.argumento,
        enFoco: focos.indexOf(r.area) >= 0
      };
      h.puntaje = PESO[r.prioridad] * 10 + (h.enFoco ? 5 : 0) + (h.fuente === 'faltante' ? -20 : 0) + (h.fuente === 'hipotesis' ? -3 : 0);
      return h;
    }).sort(function (a, b) { return b.puntaje - a.puntaje; });

    var reales = hallazgos.filter(function (h) { return h.fuente !== 'faltante'; });
    var prioridades = reales.slice(0, 3);
    var falt = faltantes(p, datos);

    /* Servicios: solo los que resuelven un problema detectado. */
    var ids = uniq(reales.filter(function (h) { return h.servicio; }).map(function (h) { return h.servicio; }));
    var orden = ['web', 'empleado_virtual', 'meta_ads'];
    ids.sort(function (a, b) { return orden.indexOf(a) - orden.indexOf(b); });
    var servicios = ids.map(function (id) {
      var s = servicio(datos, id), pr = (config.precios || {})[id] || {};
      return {
        id: id, nombre: s.nombre, tipo: s.tipo, detalle: s.detalle, plazo: s.plazo,
        precio: pr.precio != null ? pr.precio : s.precio, precioPrimerMes: pr.precioPrimerMes != null ? pr.precioPrimerMes : s.precioPrimerMes,
        precioMensual: pr.precioMensual != null ? pr.precioMensual : s.precioMensual,
        motivos: reales.filter(function (h) { return h.servicio === id; }).map(function (h) { return h.problema; })
      };
    });
    var principal = prioridades.filter(function (h) { return h.servicio; })[0];
    var servicioPrincipal = principal ? servicios.filter(function (s) { return s.id === principal.servicio; })[0] : servicios[0];

    var presupuesto = calcularPresupuesto(servicios, datos);

    /* Puntaje por área: solo si hay datos suficientes (para no graficar sin base). */
    var completitud = Math.round((Object.keys(BASE_LABELS).length - falt.base.length) / Object.keys(BASE_LABELS).length * 100);
    var areas = Object.keys(datos.rules.areas).map(function (a) {
      var pen = reales.filter(function (h) { return h.area === a; }).reduce(function (s, h) { return s + { alta: 40, media: 25, baja: 10 }[h.prioridad]; }, 0);
      return { id: a, nombre: datos.rules.areas[a], puntaje: Math.max(0, 100 - pen), problemas: reales.filter(function (h) { return h.area === a; }).length };
    });

    var d = {
      fecha: new Date().toISOString(), perfil: p, industria: ind ? { id: ind.id, nombre: ind.nombre } : null, terminos: t,
      hallazgos: hallazgos, prioridades: prioridades, faltantes: falt, servicios: servicios, servicioPrincipal: servicioPrincipal || null,
      presupuesto: presupuesto, areas: areas, completitud: completitud, mostrarGrafico: completitud >= 70 && reales.length > 0,
      embudo: ctx.tasaConversion != null ? { consultas: p.consultasMes, ventas: p.ventasMes, tasa: ctx.tasaConversion } : null
    };
    d.plan = armarPlan(d, p);
    d.textos = armarTextos(d, p, ind, datos, config);
    return d;
  }

  function calcularPresupuesto(servicios, datos) {
    var unico = 0, primerMes = 0, siguientes = 0, items = [];
    servicios.forEach(function (s) {
      if (s.tipo === 'unico') { unico += s.precio; items.push({ nombre: s.nombre, detalle: 'Pago único', monto: s.precio }); }
      else {
        var pm = s.precioPrimerMes || s.precioMensual, sm = s.precioMensual;
        primerMes += pm; siguientes += sm;
        items.push({ nombre: s.nombre, detalle: pm !== sm ? pesos(pm) + ' el primer mes, después ' + pesos(sm) + ' por mes' : pesos(sm) + ' por mes', monto: pm });
      }
    });
    var tieneAds = servicios.some(function (s) { return s.id === 'meta_ads'; });
    return {
      items: items, pagoUnico: unico, mensualPrimerMes: primerMes, mensualSiguientes: siguientes, totalPrimerMes: unico + primerMes,
      notaInversion: tieneAds ? datos.services.notaInversion : null
    };
  }

  function armarPlan(d, p) {
    var tiene = function (id) { return d.servicios.some(function (s) { return s.id === id; }); };
    var pasos = [{ cuando: 'Semana 1', que: 'Relevamiento: confirmar datos, juntar fotos, reseñas y accesos.' }];
    if (p.maps === 'no' || p.maps === 'no_sabe') pasos.push({ cuando: 'Semana 1', que: p.maps === 'no' ? 'Crear y verificar el perfil de Google Maps.' : 'Revisar y reclamar el perfil de Google Maps.' });
    if (tiene('web')) pasos.push({ cuando: 'Semanas 1 a 3', que: 'Sitio web con servicios, trabajos, reseñas y WhatsApp. Revisión con el cliente antes de publicar.' });
    if (tiene('empleado_virtual')) pasos.push({ cuando: tiene('web') ? 'Semanas 2 a 4' : 'Semanas 1 a 2', que: 'Empleado virtual en WhatsApp: respuestas frecuentes, toma de datos y seguimiento.' });
    if (tiene('meta_ads')) pasos.push({ cuando: tiene('web') ? 'Desde la semana 4' : 'Desde la semana 2', que: 'Campaña de Meta Ads por zona' + (tiene('web') ? ', con la web ya online como destino' : '') + '. Inversión definida por el cliente.' });
    var ind = uniq([].concat.apply([], d.prioridades.map(function (h) { return h.indicadores.slice(0, 2); }))).slice(0, 4);
    pasos.push({ cuando: 'Mes 2', que: 'Medición y ajustes' + (ind.length ? ': ' + ind.join(', ').toLowerCase() + '.' : '.') });
    return pasos;
  }

  /* ---------- textos de venta (naturales, cortos, personalizados) ---------- */
  function armarTextos(d, p, ind, datos, config) {
    var nombre = primerNombre(p.contacto) || '';
    var negocio = p.negocio || (p.contacto ? 'tu negocio' : 'el negocio');
    var quien = p.negocio || p.contacto || 'El negocio';
    var vendedor = config.vendedor || 'Carlos', empresa = config.empresa || 'IMPULSA';
    var sp = d.servicioPrincipal, t = d.terminos;
    var hola = 'Hola' + (nombre ? ' ' + nombre : '') + ', ¿cómo estás?';

    /* 1. Resumen */
    var r = [quien + (p.rubro ? ' se dedica a ' + p.rubro.toLowerCase() : '') + (p.zona ? ', en ' + p.zona : '') + '.'];
    if (p.canales.length) r.push('Hoy los clientes le llegan por ' + listaY(mostrar('canales', p.canales).split(', ')) + '.');
    var est = ['web', 'maps', 'publicidad', 'automatica'].filter(function (c) { return !vacio(p[c]); }).map(function (c) { var m = mostrar(c, p[c]); return m.charAt(0).toLowerCase() + m.slice(1); });
    if (est.length) r.push(est.join(', ').replace(/^./, function (x) { return x.toUpperCase(); }) + '.');
    if (p.consultasMes != null) r.push('Declara unas ' + p.consultasMes + ' consultas por mes' + (p.ventasMes != null ? ' y ' + p.ventasMes + ' ' + t.unidad + ' cerrados' : '') + '.');
    if (p.objetivo) r.push('Lo primero que quiere mejorar: ' + mostrar('objetivo', p.objetivo) + '.');
    if (p.objetivoDetalle) r.push('Meta a 3 meses: ' + p.objetivoDetalle + '.');

    /* 2. Diagnóstico */
    var reales = d.hallazgos.filter(function (h) { return h.fuente !== 'faltante'; });
    var altas = reales.filter(function (h) { return h.prioridad === 'alta'; }).length;
    var diag;
    if (!reales.length) diag = 'Con los datos actuales no aparecen problemas claros. Antes de recomendar algo conviene completar la información faltante.';
    else {
      diag = 'Encontramos ' + reales.length + (reales.length === 1 ? ' punto' : ' puntos') + ' para trabajar' + (altas ? ', ' + altas + ' de prioridad alta' : '') + '. ';
      diag += 'El más importante: ' + reales[0].problema.toLowerCase() + '. ';
      var porArea = d.areas.filter(function (a) { return a.problemas; }).map(function (a) { return a.nombre.toLowerCase(); });
      if (porArea.length) diag += 'Las áreas a mejorar son ' + listaY(porArea) + '.';
      if (ind) diag += ' ' + ind.argumento;
    }
    if (d.faltantes.base.length + d.faltantes.guiado.length) diag += ' Falta confirmar: ' + d.faltantes.base.concat(d.faltantes.guiado.slice(0, 3)).map(function (f) { return f.etiqueta.replace(/[¿?]/g, '').toLowerCase(); }).join('; ') + '.';

    /* 3. Problemas y oportunidades */
    var oportunidades = reales.map(function (h) { return { problema: h.problema, oportunidad: h.oportunidad }; });

    /* 8. Argumentos */
    var argumentos = uniq(d.prioridades.map(function (h) { return h.argumento; }).concat(ind ? [ind.argumento] : []));
    if (d.servicios.some(function (s) { return s.id === 'web'; })) argumentos.push('La web incluye 2 años de mantenimiento: no tenés que preocuparte por actualizarla.');

    /* 9. WhatsApp inicial */
    var bullets = d.prioridades.map(function (h) { return '• ' + h.corto.replace(/^./, function (x) { return x.toUpperCase(); }) + '.'; });
    var wa = [hola + ' Soy ' + vendedor + ', de ' + empresa + '.', 'Gracias por completar el diagnóstico. Lo revisé y te cuento lo principal que vi' + (p.negocio ? ' en ' + p.negocio : '') + ':', ''];
    if (bullets.length) wa = wa.concat(bullets, ['']);
    if (sp) wa.push('Lo primero que haría es arrancar con ' + sp.nombre.toLowerCase() + ', que ataca justo eso.');
    wa.push('¿Te parece si lo charlamos 15 minutos por llamada? ¿Te queda mejor hoy o mañana?');

    /* 10. Objeciones */
    var ids = d.servicios.map(function (s) { return s.id; }).concat(['general']);
    var objeciones = datos.objections.objeciones.filter(function (o) { return o.aplica.some(function (a) { return ids.indexOf(a) >= 0; }); }).map(function (o) {
      return { objecion: o.objecion, respuesta: rellenar(o.respuesta, { servicioPrincipal: sp ? sp.nombre.toLowerCase() : 'lo más urgente', unidad: t.unidad }) };
    });

    /* 11. Guion de llamada */
    var pend = preguntasGuiadas(p, datos).filter(function (q) { return !q.base; }).slice(0, 5).map(function (q) { return q.pregunta; });
    var guion = [
      { paso: 'Apertura', texto: hola + ' Te llamo por el diagnóstico que completaste. Son 15 minutos, ¿te viene bien ahora?' },
      { paso: 'Confirmar', texto: 'Me contaste que ' + (est.length ? est.join(', ') : 'querés mejorar tu negocio') + (p.objetivo ? ' y que lo primero es ' + mostrar('objetivo', p.objetivo) : '') + '. ¿Sigue siendo así?' }
    ];
    if (pend.length) guion.push({ paso: 'Preguntas', texto: pend.join(' / ') });
    if (d.prioridades.length) guion.push({ paso: 'Diagnóstico', texto: 'Lo que veo es esto: ' + d.prioridades.map(function (h) { return h.corto; }).join('; ') + '.' });
    if (d.servicios.length) guion.push({ paso: 'Propuesta', texto: 'Te propongo ' + listaY(d.servicios.map(function (s) { return s.nombre.toLowerCase(); })) + '. El primer mes queda en ' + pesos(d.presupuesto.totalPrimerMes) + (d.presupuesto.mensualSiguientes ? ' y después ' + pesos(d.presupuesto.mensualSiguientes) + ' por mes' : '') + '.' + (d.presupuesto.notaInversion ? ' La inversión en publicidad la definís vos y va aparte.' : '') });
    if (objeciones[0]) guion.push({ paso: 'Si duda', texto: objeciones[0].respuesta });
    guion.push({ paso: 'Cierre', texto: d.servicios.length ? '¿Arrancamos esta semana? Te paso la propuesta por escrito y coordinamos el relevamiento.' : '¿Te parece si completamos estos datos y te mando una propuesta concreta?' });

    /* 12. Seguimiento */
    var seg = hola + ' ¿Pudiste ver lo que te mandé?' + (d.prioridades[0] ? ' Lo más importante es que ' + d.prioridades[0].corto + '.' : '') +
      (sp ? ' Si querés, arrancamos por ' + sp.nombre.toLowerCase() + ' y en ' + (sp.plazo || 'pocas semanas') + ' lo tenés andando.' : '') + ' Avisame y lo vemos.';

    /* 13. Próximo paso */
    var faltan = d.faltantes.base.length + d.faltantes.guiado.length;
    var prox;
    if (d.faltantes.base.length >= 3) prox = 'Llamada corta para completar datos básicos (' + d.faltantes.base.map(function (f) { return f.etiqueta.toLowerCase(); }).join(', ') + ') antes de proponer.';
    else if (!d.servicios.length) prox = 'Completar el modo guiado; con lo declarado no corresponde recomendar un servicio todavía.';
    else prox = 'Mandar el WhatsApp inicial hoy, agendar una llamada de 15 minutos y cerrar ' + sp.nombre.toLowerCase() + ' como primer paso' + (faltan ? ' (en la llamada, completar los datos que faltan)' : '') + '.';

    return {
      resumen: r.join(' '), diagnostico: diag, oportunidades: oportunidades, argumentos: argumentos,
      whatsapp: wa.join('\n'), objeciones: objeciones, guion: guion, seguimiento: seg, proximoPaso: prox
    };
  }

  return {
    version: '1.0.0', cargarDatos: cargarDatos, datosEmbebidos: datosEmbebidos, configPorDefecto: configPorDefecto,
    perfilVacio: perfilVacio, parsearMensaje: parsearMensaje, normalizar: normalizar, combinar: combinar, numero: numero,
    detectarIndustria: detectarIndustria, faltantes: faltantes, preguntasGuiadas: preguntasGuiadas, evaluar: evaluar,
    diagnosticar: diagnosticar, mostrar: mostrar, pesos: pesos, TXT: TXT, CAMPOS: CAMPOS, NUMERICOS: NUMERICOS
  };
});
