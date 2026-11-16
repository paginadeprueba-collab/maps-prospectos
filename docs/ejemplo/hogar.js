/* Grupo "Mantenimiento del hogar" para la web de ejemplo (sin IA, solo plantilla).
   Para sumar otro grupo (salud, gastronomía, belleza, comercio, profesionales):
   crear docs/ejemplo/<grupo>.js con rubros del mismo formato, registrarlo en
   EjemploGrupos y copiar hogar.html cambiando el grupo que lee.
   El hash lo arma EjemploCodec, igual para todos. */
(function (root) {
  const RUBROS = [
    {
      id: "plo",
      nombre: "Plomero",
      icon: "pipe",
      color: "#2f6bff",
      alias: ["plomeros", "plomero", "plomería", "plomeria", "fontanero", "fontanería", "fontaneria", "servicio de plomeria", "servicio de plomería"],
      titulo: ["Tu casa,", "sin pérdidas."],
      lead: "Plomería a domicilio en {zona}. Destapes, cañerías y arreglos prolijos.",
      serviciosTitulo: "Plomería para el día a día",
      serviciosLead: "Lo que suele pedir un hogar: pérdidas, destapes y sanitarios, en {zona}.",
      confianza: ["A domicilio", "Se mira antes de romper", "Turno a coordinar"],
      servicios: [
        { ic: "pipe", tag: "Agua", h: "Pérdidas", p: "Canillas, flexibles y caños que gotean.", l: ["Canillas", "Flexibles", "Bajo mesada", "Llaves de paso"] },
        { ic: "drop", tag: "Desagües", h: "Destapes", p: "Cocina, baño y lavadero. Con máquina si hace falta.", l: ["Inodoro", "Cocina", "Lavadero", "Pluvial"] },
        { ic: "wrench", tag: "Sanitarios", h: "Griferías y artefactos", p: "Cambio de grifería, inodoro, bidet o vanitory.", l: ["Grifería", "Inodoro", "Bidet", "Vanitory"] },
        { ic: "home", tag: "Cañerías", h: "Agua fría y caliente", p: "Tramos nuevos y empalmes, de a poco y prolijo.", l: ["Agua fría", "Agua caliente", "Bajadas", "Empalmes"] }
      ],
      calc: [
        { n: "Pérdidas", d: "Canillas y caños", j: [["Arreglo de fuga", 35000], ["Cambio de flexible", 22000], ["Llave de paso", 28000]] },
        { n: "Destapes", d: "Desagües", j: [["Destape de cocina", 40000], ["Destape de inodoro", 38000], ["Destape con máquina", 55000]] },
        { n: "Sanitarios", d: "Artefactos", j: [["Cambio de grifería", 30000], ["Instalación de inodoro", 70000], ["Cambio de vanitory", 85000]] },
        { n: "Cañerías", d: "Tramos", j: [["Cambio de tramo corto", 80000], ["Bajada de agua", 90000], ["Pérdida oculta", 45000]] }
      ]
    },
    {
      id: "gas",
      nombre: "Gasista",
      icon: "flame",
      color: "#e07a2f",
      alias: ["gasistas", "gasista", "gasista matriculado", "instalador de gas", "instalación de gas", "instalacion de gas", "servicio de instalación de gas", "servicio de instalacion de gas"],
      titulo: ["Gas seguro,", "en tu casa."],
      lead: "Instalación y arreglos de gas en {zona}. Artefactos, fugas y revisión.",
      serviciosTitulo: "Gas en la casa",
      serviciosLead: "Cocina, calefón y la instalación, con visita en {zona}.",
      confianza: ["A domicilio", "Se revisa antes de encender", "Turno a coordinar"],
      servicios: [
        { ic: "flame", tag: "Seguridad", h: "Fugas", p: "Se busca el escape y se deja la instalación cerrada y firme.", l: ["Fuga", "Prueba", "Uniones", "Llave de paso"] },
        { ic: "home", tag: "Artefactos", h: "Cocina y calefón", p: "Instalación y recambio de cocina, calefón o estufa.", l: ["Cocina", "Calefón", "Estufa", "Termotanque"] },
        { ic: "wrench", tag: "Piezas", h: "Reguladores", p: "Regulador, flexible y conexiones que ya no ajustan.", l: ["Regulador", "Flexible", "Conexión", "Válvula"] },
        { ic: "gauge", tag: "Mantenimiento", h: "Puesta a punto", p: "Limpieza de quemadores y control de la instalación.", l: ["Quemadores", "Calefón", "Control", "Visita"] }
      ],
      calc: [
        { n: "Fugas", d: "Instalación", j: [["Reparación de fuga", 48000], ["Revisión de instalación", 42000], ["Prueba de hermeticidad", 38000]] },
        { n: "Artefactos", d: "Colocación", j: [["Instalación de calefón", 90000], ["Instalación de cocina", 60000], ["Instalación de estufa", 55000]] },
        { n: "Reguladores", d: "Piezas", j: [["Cambio de regulador", 35000], ["Flexible de gas", 28000], ["Llave de paso", 32000]] },
        { n: "Mantenimiento", d: "Puesta a punto", j: [["Service de calefón", 40000], ["Limpieza de quemadores", 25000], ["Control de la instalación", 36000]] }
      ]
    },
    {
      id: "ele",
      nombre: "Electricista",
      icon: "bolt",
      color: "#b8860b",
      alias: ["electricistas", "electricista", "electricista matriculado", "instalaciones eléctricas", "instalaciones electricas"],
      titulo: ["Luz,", "sin cortes."],
      lead: "Electricidad a domicilio en {zona}. Tomas, tableros y cortocircuitos.",
      serviciosTitulo: "Electricidad de la casa",
      serviciosLead: "Lo urgente y lo de todos los días, en {zona}.",
      confianza: ["A domicilio", "Se corta la luz antes de tocar", "Turno a coordinar"],
      servicios: [
        { ic: "bolt", tag: "Urgencias", h: "Cortocircuitos", p: "Cuando salta la térmica o se queda un ambiente sin luz.", l: ["Térmica", "Cables", "Disyuntor", "Diagnóstico"] },
        { ic: "wrench", tag: "Puntos", h: "Tomas y llaves", p: "Cambio y agregado de tomas, teclas y pulsadores.", l: ["Tomas", "Llaves", "Pulsadores", "USB"] },
        { ic: "gauge", tag: "Tablero", h: "Térmicas y disyuntor", p: "Tablero ordenado, con térmicas que correspondan.", l: ["Tablero", "Térmica", "Disyuntor", "Puesta a tierra"] },
        { ic: "home", tag: "Luces", h: "Iluminación", p: "Artefactos, cintas y luces de patio o balcón.", l: ["Artefactos", "LED", "Exterior", "Embellecedores"] }
      ],
      calc: [
        { n: "Urgencias", d: "Cuando no hay luz", j: [["Cortocircuito", 42000], ["Tablero que salta", 38000], ["Ambiente sin luz", 35000]] },
        { n: "Tomas y llaves", d: "Puntos", j: [["Cambio de toma", 18000], ["Cambio de llave", 18000], ["Toma nueva", 32000]] },
        { n: "Tablero", d: "Protecciones", j: [["Cambio de térmica", 28000], ["Disyuntor", 45000], ["Instalación de tablero", 95000]] },
        { n: "Iluminación", d: "Luces", j: [["Colocación de artefacto", 25000], ["Tira LED", 30000], ["Luz de exterior", 35000]] }
      ]
    },
    {
      id: "cer",
      nombre: "Cerrajero",
      icon: "key",
      color: "#3e5c76",
      alias: ["cerrajeros", "cerrajero", "cerrajería", "cerrajeria", "cerrajeros 24 horas"],
      titulo: ["Tu puerta,", "bien cerrada."],
      lead: "Cerrajería a domicilio en {zona}. Aperturas, cerraduras y copias.",
      serviciosTitulo: "Cerrajería del hogar",
      serviciosLead: "Puertas, cerraduras y llaves, en {zona}.",
      confianza: ["A domicilio", "Se explica el trabajo antes", "Turno a coordinar"],
      servicios: [
        { ic: "key", tag: "Puertas", h: "Aperturas", p: "Puerta cerrada de más, sin hacerla pedazos si se puede.", l: ["Puerta", "Cerradura", "Tambor", "Pasador"] },
        { ic: "wrench", tag: "Cambio", h: "Cerraduras", p: "Cerradura nueva o cilindro, en la puerta que ya tenés.", l: ["Cerradura", "Cilindro", "Seguridad", "Marco"] },
        { ic: "home", tag: "Copias", h: "Llaves", p: "Copias y juegos para la familia.", l: ["Copia", "Juego", "Codificada", "Doble paleta"] },
        { ic: "bars", tag: "Refuerzo", h: "Pasadores", p: "Cerrojo, pasador y marco que ya no afirma.", l: ["Cerrojo", "Pasador", "Marco", "Mirilla"] }
      ],
      calc: [
        { n: "Aperturas", d: "Puerta cerrada", j: [["Apertura de puerta", 35000], ["Apertura sin rotura", 45000], ["Puerta trabada", 40000]] },
        { n: "Cerraduras", d: "Cambio", j: [["Cambio de cerradura", 55000], ["Cerradura de seguridad", 90000], ["Cilindro", 48000]] },
        { n: "Llaves", d: "Copias", j: [["Copia de llave", 8000], ["Juego de llaves", 15000], ["Llave codificada", 25000]] },
        { n: "Refuerzos", d: "Puerta", j: [["Pasador", 30000], ["Cerrojo", 38000], ["Marco reforzado", 70000]] }
      ]
    },
    {
      id: "pin",
      nombre: "Pintor",
      icon: "roller",
      color: "#7c4dff",
      alias: ["pintores", "pintor", "pintor de obras", "pintura de interiores", "pintura"],
      titulo: ["Paredes nuevas,", "sin obra eterna."],
      lead: "Pintura de interiores y frentes en {zona}. Enduido, color y aberturas.",
      serviciosTitulo: "Pintura de la casa",
      serviciosLead: "Ambientes, frentes y detalles, en {zona}.",
      confianza: ["Se protege el piso", "El color se confirma antes", "Turno a coordinar"],
      servicios: [
        { ic: "roller", tag: "Interiores", h: "Ambientes", p: "Paredes y techos de dormitorio, living o cocina.", l: ["Paredes", "Techos", "Zócalos", "Color"] },
        { ic: "home", tag: "Exterior", h: "Frentes y balcones", p: "Frente, balcón y rejas que miran a la calle.", l: ["Frente", "Balcón", "Rejas", "Muros"] },
        { ic: "brick", tag: "Base", h: "Enduido y humedad", p: "Se prepara la pared antes de pintar, si hace falta.", l: ["Enduido", "Lijado", "Manchas", "Fisuras"] },
        { ic: "wrench", tag: "Detalles", h: "Aberturas", p: "Puertas, ventanas y marcos en esmalte.", l: ["Puertas", "Ventanas", "Marcos", "Zócalos"] }
      ],
      calc: [
        { n: "Interiores", d: "Ambientes", j: [["Ambiente chico", 80000], ["Ambiente mediano", 140000], ["Techo", 60000]] },
        { n: "Exteriores", d: "Calle", j: [["Frente", 180000], ["Balcón", 90000], ["Reja", 45000]] },
        { n: "Preparación", d: "Antes de pintar", j: [["Enduido", 35000], ["Lijado", 25000], ["Tratamiento de mancha", 70000]] },
        { n: "Aberturas", d: "Esmalte", j: [["Puerta", 30000], ["Ventana", 25000], ["Zócalos", 20000]] }
      ]
    },
    {
      id: "alb",
      nombre: "Albañil",
      icon: "brick",
      color: "#c46a2b",
      alias: ["albañiles", "albañil", "albañilería", "albanileria"],
      titulo: ["Arreglos firmes,", "en tu casa."],
      lead: "Albañilería en {zona}. Humedad, revoques, cerámicos y muros.",
      serviciosTitulo: "Albañilería chica",
      serviciosLead: "Arreglos de la casa, sin convertir el living en una obra, en {zona}.",
      confianza: ["Se tapa y se limpia", "El alcance se acuerda antes", "Turno a coordinar"],
      servicios: [
        { ic: "drop", tag: "Humedad", h: "Manchas y revoques", p: "Paños flojos, salitre y el revoque que se viene.", l: ["Manchas", "Revoque", "Salitre", "Grietas"] },
        { ic: "brick", tag: "Muros", h: "Paredes", p: "Cierres, baches y arreglos de mampostería.", l: ["Grietas", "Vanos", "Baches", "Ladrillo"] },
        { ic: "home", tag: "Pisos", h: "Cerámicos", p: "Baño, cocina y el cerámico que saltó.", l: ["Piso", "Revestimiento", "Pastina", "Zócalo"] },
        { ic: "wrench", tag: "Detalles", h: "Terminaciones", p: "Canto, umbral y lo que queda a la vista.", l: ["Umbral", "Cantos", "Bacha", "Mesada"] }
      ],
      calc: [
        { n: "Humedad", d: "Paredes", j: [["Paño chico", 50000], ["Revoque de ejemplo (m²)", 22000], ["Grieta", 30000]] },
        { n: "Muros", d: "Mampostería", j: [["Cierre de vano", 70000], ["Bache en muro", 28000], ["Paño mediano", 80000]] },
        { n: "Cerámicos", d: "Pisos", j: [["Piso de baño", 120000], ["Revestimiento", 90000], ["Zócalo cerámico", 35000]] },
        { n: "Terminaciones", d: "Detalles", j: [["Umbral", 25000], ["Cantos", 20000], ["Arreglo de mesada", 40000]] }
      ]
    },
    {
      id: "tec",
      nombre: "Techista",
      icon: "roof",
      color: "#2a6f7f",
      alias: ["techistas", "techista", "reparación de techos", "reparacion de techos", "techos"],
      titulo: ["El techo,", "sin goteras."],
      lead: "Techos en {zona}. Filtraciones, membrana, canaletas y chapas.",
      serviciosTitulo: "Techos y filtraciones",
      serviciosLead: "Cuando llueve adentro, se mira el techo. Atención en {zona}.",
      confianza: ["Se sube a mirar", "El arreglo se marca antes", "Turno a coordinar"],
      servicios: [
        { ic: "drop", tag: "Lluvia", h: "Filtraciones", p: "La mancha del cielorraso, seguida hasta el techo.", l: ["Cielorraso", "Encuentro", "Grieta", "Ventilación"] },
        { ic: "roof", tag: "Cubierta", h: "Membrana", p: "Paños gastados, burbujas y bacheos.", l: ["Membrana", "Bacheo", "Junta", "Media caña"] },
        { ic: "wrench", tag: "Desagüe", h: "Canaletas", p: "Canaleta tapada, embudo y tramo flojo.", l: ["Limpieza", "Tramo", "Embudo", "Bajada"] },
        { ic: "home", tag: "Cubierta", h: "Chapa y teja", p: "Chapa suelta, teja movida y cenefa.", l: ["Chapa", "Teja", "Cenefa", "Cumbrera"] }
      ],
      calc: [
        { n: "Filtraciones", d: "Cuando llueve", j: [["Filtración puntual", 45000], ["Encuentro de pared", 55000], ["Salida de ventilación", 40000]] },
        { n: "Membrana", d: "Cubierta", j: [["Paño chico", 80000], ["Techo de un ambiente", 150000], ["Bacheo", 50000]] },
        { n: "Canaletas", d: "Desagüe", j: [["Limpieza", 25000], ["Cambio de tramo", 45000], ["Embudo", 30000]] },
        { n: "Chapa y teja", d: "Cubierta", j: [["Chapa suelta", 35000], ["Teja", 40000], ["Cenefa", 38000]] }
      ]
    },
    {
      id: "air",
      nombre: "Aire acondicionado",
      icon: "ac",
      color: "#1493a8",
      alias: ["aire acondicionado", "instalación aire acondicionado", "instalacion aire acondicionado", "técnico aire acondicionado", "tecnico aire acondicionado", "técnico de aire acondicionado", "tecnico de aire acondicionado"],
      titulo: ["Frío y calor,", "cuando hace falta."],
      lead: "Aire acondicionado en {zona}. Instalación, service y mudanza del equipo.",
      serviciosTitulo: "Aire acondicionado",
      serviciosLead: "Split y service, en {zona}.",
      confianza: ["Se revisa el equipo", "El lugar del split se acuerda", "Turno a coordinar"],
      servicios: [
        { ic: "ac", tag: "Colocación", h: "Instalación", p: "Split nuevo, con la perforación y el desagüe.", l: ["Split", "Soporte", "Caño", "Desagüe"] },
        { ic: "snow", tag: "Mantenimiento", h: "Service", p: "Limpieza, filtros y la carga si corresponde.", l: ["Filtros", "Limpieza", "Gas", "Control"] },
        { ic: "wrench", tag: "Mudanza", h: "Desinstalación", p: "Bajar el equipo y dejar la pared presentable.", l: ["Descolgar", "Tapar", "Traslado", "Reinstalación"] },
        { ic: "gauge", tag: "Visita", h: "Diagnóstico", p: "No enfría, gotea o hace ruido: se mira primero.", l: ["No enfría", "Goteo", "Ruido", "Tablero"] }
      ],
      calc: [
        { n: "Instalación", d: "Equipo nuevo", j: [["Split chico", 90000], ["Split mediano", 120000], ["Consola", 150000]] },
        { n: "Service", d: "Mantenimiento", j: [["Limpieza de filtros", 25000], ["Service completo", 45000], ["Carga de gas", 60000]] },
        { n: "Mudanza", d: "Mover el equipo", j: [["Descolgar equipo", 35000], ["Mudanza de split", 80000], ["Tapar el agujero", 20000]] },
        { n: "Visita", d: "Para saber qué pasa", j: [["Diagnóstico", 20000], ["Segunda visita", 15000], ["Visita del día", 35000]] }
      ]
    },
    {
      id: "her",
      nombre: "Herrero",
      icon: "bars",
      color: "#6d543e",
      alias: ["herreros", "herrero", "herrería", "herreria", "rejas"],
      titulo: ["Rejas y portones,", "a medida."],
      lead: "Herrería en {zona}. Rejas, portones, barandas y soldadura.",
      serviciosTitulo: "Herrería de la casa",
      serviciosLead: "Rejas, portones y arreglos, en {zona}.",
      confianza: ["Se mide en el lugar", "El diseño se confirma", "Turno a coordinar"],
      servicios: [
        { ic: "bars", tag: "Seguridad", h: "Rejas", p: "Ventanas, balcones y la puerta de reja.", l: ["Ventana", "Balcón", "Puerta", "Fijo"] },
        { ic: "home", tag: "Ingreso", h: "Portones", p: "Corredizo o batiente, a la medida del frente.", l: ["Corredizo", "Batiente", "Motor", "Marco"] },
        { ic: "wrench", tag: "Arreglos", h: "Soldadura", p: "Bisagra, reja floja y el pedazo que se saltó.", l: ["Soldadura", "Bisagra", "Reja", "Marco"] },
        { ic: "flame", tag: "A medida", h: "Barandas", p: "Escalera, balcón y parrilla.", l: ["Baranda", "Escalera", "Parrilla", "Pérgola"] }
      ],
      calc: [
        { n: "Rejas", d: "Aberturas", j: [["Reja de ventana", 70000], ["Reja de balcón", 140000], ["Puerta reja", 120000]] },
        { n: "Portones", d: "Frente", j: [["Portón batiente", 180000], ["Portón corredizo", 250000], ["Automatización", 150000]] },
        { n: "Reparación", d: "Soldadura", j: [["Soldadura", 30000], ["Bisagra", 25000], ["Reja floja", 40000]] },
        { n: "A medida", d: "Otros hierros", j: [["Baranda", 120000], ["Parrilla", 90000], ["Pérgola simple", 200000]] }
      ]
    },
    {
      id: "car",
      nombre: "Carpintero",
      icon: "saw",
      color: "#9a6232",
      alias: ["carpinteros", "carpintero", "carpintería", "carpinteria", "muebles a medida"],
      titulo: ["Madera a medida,", "en tu casa."],
      lead: "Carpintería en {zona}. Muebles, placards, puertas y arreglos.",
      serviciosTitulo: "Carpintería",
      serviciosLead: "Muebles y puertas a la medida del ambiente, en {zona}.",
      confianza: ["Se mide en el lugar", "La madera se elige antes", "Turno a coordinar"],
      servicios: [
        { ic: "saw", tag: "Muebles", h: "A medida", p: "Estantes, bajo mesada y la mesa que falta.", l: ["Estante", "Bajo mesada", "Mesa", "Biblioteca"] },
        { ic: "home", tag: "Guardado", h: "Placards", p: "Frentes corredizos e interiores.", l: ["Corredizo", "Interior", "Zapatero", "Cajones"] },
        { ic: "wrench", tag: "Puertas", h: "Puertas y marcos", p: "Puerta que roza, marco nuevo o a medida.", l: ["Puerta", "Marco", "Bisagra", "Cierre"] },
        { ic: "roller", tag: "Arreglos", h: "Reparaciones", p: "Cajón, estante vencido y la tapa que se soltó.", l: ["Cajón", "Estante", "Tapa", "Bisagra"] }
      ],
      calc: [
        { n: "Muebles", d: "A medida", j: [["Estante", 60000], ["Bajo mesada", 150000], ["Mesa", 90000]] },
        { n: "Placards", d: "Guardado", j: [["Frente corredizo", 180000], ["Interior", 120000], ["Zapatero", 70000]] },
        { n: "Puertas", d: "Madera", j: [["Puerta de paso", 80000], ["Marco", 50000], ["Ajuste de puerta", 25000]] },
        { n: "Reparación", d: "Arreglos", j: [["Cajón", 20000], ["Bisagra", 18000], ["Estante vencido", 30000]] }
      ]
    },
    {
      id: "fum",
      nombre: "Fumigación",
      icon: "bug",
      color: "#2e8b57",
      alias: ["fumigadores", "fumigador", "fumigación", "fumigacion", "control de plagas"],
      titulo: ["Tu casa,", "sin plagas."],
      lead: "Control de plagas en {zona}. Cucarachas, hormigas, alacranes y roedores.",
      serviciosTitulo: "Fumigación del hogar",
      serviciosLead: "Visita en {zona}, con el producto según la plaga.",
      confianza: ["Se dice qué se va a usar", "Indicaciones después de la visita", "Turno a coordinar"],
      servicios: [
        { ic: "bug", tag: "Insectos", h: "Cucarachas", p: "Cocina, baño y los rincones por donde entran.", l: ["Cocina", "Baño", "Bajomesada", "Rejillas"] },
        { ic: "home", tag: "Jardín", h: "Hormigas y alacranes", p: "Patio, jardín y el interior si ya entraron.", l: ["Hormigas", "Alacranes", "Patio", "Interior"] },
        { ic: "bars", tag: "Control", h: "Roedores", p: "Se buscan accesos y se deja un control.", l: ["Accesos", "Cebado", "Seguimiento", "Sellado"] },
        { ic: "leaf", tag: "Después", h: "Prevención", p: "Una vuelta de control para que no vuelva.", l: ["Control", "Sellado", "Plan", "Consejo"] }
      ],
      calc: [
        { n: "Cucarachas", d: "Interior", j: [["Depto de 1 ambiente", 28000], ["Depto de 2 o 3", 40000], ["Local", 55000]] },
        { n: "Insectos", d: "Otras plagas", j: [["Hormigas", 30000], ["Alacranes", 45000], ["Pulgas", 40000]] },
        { n: "Roedores", d: "Control", j: [["Control", 50000], ["Cebado", 35000], ["Seguimiento", 25000]] },
        { n: "Prevención", d: "Para que no vuelva", j: [["Visita de control", 22000], ["Sellado de accesos", 30000], ["Plan trimestral", 70000]] }
      ]
    },
    {
      id: "jar",
      nombre: "Jardinero",
      icon: "leaf",
      color: "#3c8c45",
      alias: ["jardineros", "jardinero", "jardinería", "jardineria", "paisajismo"],
      titulo: ["El verde,", "en orden."],
      lead: "Jardinería en {zona}. Césped, poda, limpieza y riego.",
      serviciosTitulo: "Jardín y patio",
      serviciosLead: "Corte, poda y la limpieza de después, en {zona}.",
      confianza: ["Se lleva los restos", "El trabajo se acuerda antes", "Turno a coordinar"],
      servicios: [
        { ic: "leaf", tag: "Césped", h: "Corte", p: "Pasto, bordes y lo que tapa el camino.", l: ["Corte", "Bordes", "Malezas", "Recolección"] },
        { ic: "home", tag: "Plantas", h: "Poda", p: "Arbustos, setos y el árbol chico del patio.", l: ["Arbusto", "Seto", "Árbol", "Forma"] },
        { ic: "wrench", tag: "Orden", h: "Limpieza", p: "Hojas, macetas y el terreno que se vino arriba.", l: ["Hojas", "Macetas", "Terreno", "Restos"] },
        { ic: "drop", tag: "Agua", h: "Riego", p: "Canilla de jardín, aspersor y la manguera que no llega.", l: ["Canilla", "Aspersor", "Manguera", "Revisión"] }
      ],
      calc: [
        { n: "Césped", d: "Corte", j: [["Jardín chico", 25000], ["Jardín mediano", 40000], ["Bordes", 15000]] },
        { n: "Poda", d: "Plantas", j: [["Arbusto", 20000], ["Seto", 35000], ["Árbol chico", 45000]] },
        { n: "Limpieza", d: "Restos", j: [["Hojas y restos", 30000], ["Terreno", 50000], ["Macetas", 18000]] },
        { n: "Riego", d: "Agua", j: [["Revisión", 25000], ["Aspersor", 20000], ["Canilla de jardín", 28000]] }
      ]
    },
    {
      id: "tap",
      nombre: "Tapicero",
      icon: "sofa",
      color: "#8e4a6a",
      alias: ["tapiceros", "tapicero", "tapicería", "tapiceria", "tapizado de sillones"],
      titulo: ["Tus sillones,", "como nuevos."],
      lead: "Tapicería en {zona}. Sillones, sillas y cabeceras.",
      serviciosTitulo: "Tapizado",
      serviciosLead: "Se retapiza lo que ya tenés, en {zona}.",
      confianza: ["La tela se elige antes", "Se puede ver el sillón", "Turno a coordinar"],
      servicios: [
        { ic: "sofa", tag: "Living", h: "Sillones", p: "De uno, dos o tres cuerpos, con la tela que elijas.", l: ["1 cuerpo", "2 cuerpos", "3 cuerpos", "Esquinero"] },
        { ic: "home", tag: "Comedor", h: "Sillas", p: "Sillas sueltas o el juego completo.", l: ["Silla", "Juego", "Escritorio", "Banqueta"] },
        { ic: "wrench", tag: "Arreglos", h: "Detalles", p: "Apoya brazos, almohadones y un resorte.", l: ["Apoya brazos", "Almohadón", "Resorte", "Costura"] },
        { ic: "roller", tag: "Dormitorio", h: "Cabeceras", p: "Cabecera tapizada y banqueta de pie de cama.", l: ["Cabecera", "Banqueta", "Panel", "Pana"] }
      ],
      calc: [
        { n: "Sillones", d: "Living", j: [["1 cuerpo", 80000], ["2 cuerpos", 120000], ["3 cuerpos", 160000]] },
        { n: "Sillas", d: "Comedor", j: [["Silla", 18000], ["Juego de 4", 65000], ["Silla de escritorio", 35000]] },
        { n: "Detalles", d: "Arreglos", j: [["Apoya brazos", 25000], ["Almohadones", 20000], ["Resorte", 30000]] },
        { n: "Cabeceras", d: "Dormitorio", j: [["Cabecera simple", 45000], ["Cabecera tapizada", 70000], ["Banqueta", 40000]] }
      ]
    }
  ];

  const porId = {};
  RUBROS.forEach((r) => { porId[r.id] = r; });

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function matchTexto(texto) {
    const n = norm(texto);
    if (!n) return null;
    const padded = " " + n + " ";
    let best = null;
    let bestLen = 0;
    let bestPos = 99999;
    for (let i = 0; i < RUBROS.length; i++) {
      const rubro = RUBROS[i];
      const alias = rubro.alias || [];
      for (let j = 0; j < alias.length; j++) {
        const a = norm(alias[j]);
        if (!a) continue;
        const pos = padded.indexOf(" " + a + " ");
        if (pos < 0) continue;
        if (a.length > bestLen || (a.length === bestLen && pos < bestPos)) {
          best = rubro;
          bestLen = a.length;
          bestPos = pos;
        }
      }
    }
    return best;
  }

  function menciona(texto, rubro) {
    const padded = " " + norm(texto) + " ";
    const alias = (rubro && rubro.alias) || [];
    for (let i = 0; i < alias.length; i++) {
      const a = norm(alias[i]);
      if (a.length >= 5 && padded.indexOf(" " + a + " ") >= 0) return true;
    }
    return false;
  }

  function resolver(prospect, ctx) {
    const p = prospect || {};
    const c = ctx || {};
    const byCat = matchTexto(p.categoria);
    const bySearch = matchTexto(c.rubro);
    if (byCat && bySearch && byCat.id !== bySearch.id) {
      const nameCat = menciona(p.nombre, byCat);
      const nameSearch = menciona(p.nombre, bySearch);
      if (nameSearch && !nameCat) return bySearch;
      if (nameCat && !nameSearch) return byCat;
      if (nameSearch && nameCat) return bySearch;
      return byCat;
    }
    return byCat || bySearch || null;
  }

  function limpiarDir(s) {
    return String(s || "")
      .replace(/,?\s*Argentina\s*$/i, "")
      .replace(/Cdad\.\s*Aut[oó]noma de Buenos Aires/ig, "CABA")
      .replace(/Ciudad Aut[oó]noma de Buenos Aires/ig, "CABA")
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .replace(/,\s*$/, "")
      .trim();
  }

  function direccionUtil(s) {
    const t = String(s || "").trim();
    if (!t || t === "{}" || t.charAt(0) === "{" || t.charAt(0) === "[") return "";
    return limpiarDir(t).slice(0, 160);
  }

  function buscarBarrio(direccion, lista) {
    const n = norm(direccion);
    if (!n) return "";
    const padded = " " + n + " ";
    const orden = (lista || []).slice().sort((a, b) => norm(b).length - norm(a).length);
    for (let i = 0; i < orden.length; i++) {
      const nb = norm(orden[i]);
      if (nb && padded.indexOf(" " + nb + " ") >= 0) return orden[i];
    }
    return "";
  }

  function normTel(d) {
    let x = String(d || "").replace(/\D/g, "");
    if (x.indexOf("00") === 0) x = x.slice(2);
    if (x.indexOf("549") === 0 && x.length > 10) x = x.slice(3);
    else if (x.indexOf("54") === 0 && x.length > 10) x = x.slice(2);
    if (x.charAt(0) === "0") x = x.slice(1);
    if (x.length === 12 && x.indexOf("11") === 0 && x.slice(2, 4) === "15") x = x.slice(0, 2) + x.slice(4);
    return x;
  }

  function telefonos(p) {
    const tel = normTel(p.telefono);
    const m = String(p.whatsapp || "").match(/wa\.me\/(\d+)/);
    const wa = m ? normTel(m[1]) : "";
    const mostrar = tel || wa;
    const waOk = String(p.whatsapp || "").indexOf("wa.me") >= 0 && !!(wa || tel);
    return { mostrar: mostrar, wa: waOk ? (wa || tel) : "" };
  }

  function coords(link) {
    const m = String(link || "").match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const y = Math.round(parseFloat(m[1]) * 1e5) / 1e5;
    const x = Math.round(parseFloat(m[2]) * 1e5) / 1e5;
    if (!isFinite(y) || !isFinite(x) || y < -90 || y > 90 || x < -180 || x > 180) return null;
    return { y: y, x: x };
  }

  function reseñasDe(p) {
    const raw = p.reseñas_texto || p.resenas_texto || p.reviews;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length && out.length < 4; i++) {
      const item = raw[i];
      if (!item || typeof item !== "object") continue;
      const texto = String(item.texto || item.t || item.text || item.comentario || "").trim();
      if (!texto) continue;
      const nombre = String(item.nombre || item.n || item.autor || item.author || "").trim();
      out.push([nombre.slice(0, 40), texto.slice(0, 180)]);
    }
    return out;
  }

  function payload(prospect, ctx) {
    const rubro = resolver(prospect, ctx || {});
    if (!rubro) return null;
    const p = prospect || {};
    const c = ctx || {};
    const dir = direccionUtil(p.direccion);
    const barrio = buscarBarrio(dir, c.barriosConocidos || []);
    const tel = telefonos(p);
    const xy = coords(p.link_maps);
    const o = { k: rubro.id };
    const nombre = String(p.nombre || "").trim().slice(0, 140);
    if (nombre) o.n = nombre;
    if (dir) o.a = dir;
    if (barrio) o.b = barrio.slice(0, 40);
    if (tel.mostrar) o.p = tel.mostrar;
    if (tel.wa) o.w = tel.wa === tel.mostrar ? 1 : tel.wa;
    const horas = String(p.horarios || "").trim().slice(0, 140);
    if (horas) o.h = horas;
    const rating = parseFloat(String(p.rating || "").replace(",", "."));
    if (isFinite(rating) && rating > 0) o.s = Math.round(rating * 10) / 10;
    const cant = parseInt(String(p.reseñas != null ? p.reseñas : p.resenas || "").replace(/[^\d]/g, ""), 10);
    if (isFinite(cant) && cant > 0) o.v = cant;
    if (xy) { o.y = xy.y; o.x = xy.x; }
    const revs = reseñasDe(p);
    if (revs.length) o.e = revs;
    return o;
  }

  root.EjemploGrupos = root.EjemploGrupos || {};
  root.EjemploGrupos.hogar = {
    id: "hogar",
    titulo: "Mantenimiento del hogar",
    pagina: "ejemplo/hogar.html",
    rubros: RUBROS,
    porId: function (id) { return porId[id] || null; },
    resolver: resolver,
    payload: payload
  };
})(typeof window !== "undefined" ? window : globalThis);
