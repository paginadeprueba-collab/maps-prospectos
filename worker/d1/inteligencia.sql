-- IMPULSA — Inteligencia comercial: esquema D1 para sincronizar en el futuro.
-- PREPARADO, NO APLICADO NI DESPLEGADO. Complementa worker/d1/impulsa_comercial.sql.
-- Hoy todo vive en localStorage (impulsa_resultados_v1 → r.comercial, impulsa_propuestas_v1)
-- y se pasa entre dispositivos con Exportar/Importar JSON.
-- Para activarlo hay que aplicar primero impulsa_comercial.sql y luego este archivo, y sumar
-- endpoints con autenticación en el Worker (nada de eso está hecho).

-- Propuestas / argumentos comerciales (experimentos A/B).
CREATE TABLE IF NOT EXISTS propuesta (
  id TEXT PRIMARY KEY,               -- slug, igual que en impulsa_propuestas_v1
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa INTEGER NOT NULL DEFAULT 1,
  creada TEXT NOT NULL
);

-- Último estado comercial resumido del prospecto (lo que hoy está en r.comercial).
CREATE TABLE IF NOT EXISTS prospecto_inteligencia (
  key TEXT PRIMARY KEY REFERENCES prospecto_comercial(key),
  rubro TEXT,                        -- categoría de Google Maps
  tipo_empresa TEXT,                 -- profesional | comercio | servicio_domicilio | pyme | cadena | otro
  sitio_web TEXT,                    -- con_web | sin_web | sin_dato (dato del negocio, NO intención de compra)
  fecha_contacto TEXT,               -- primer contacto (ISO)
  ultimo_contacto TEXT,
  servicio_ofrecido TEXT,
  propuesta_id TEXT REFERENCES propuesta(id),
  resultado TEXT CHECK (resultado IS NULL OR resultado IN ('no_necesita','no_reconoce_problema','ya_tiene_solucion','sin_presupuesto','no_confia','no_responde','interesado','solicita_presupuesto','contrato')),
  motivo_rechazo TEXT,
  objeciones_json TEXT,              -- lista de textos
  reunion INTEGER NOT NULL DEFAULT 0,
  proximo_seguimiento TEXT,          -- fecha YYYY-MM-DD
  actualizado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_int_rubro ON prospecto_inteligencia(rubro);
CREATE INDEX IF NOT EXISTS idx_int_prop ON prospecto_inteligencia(propuesta_id);
CREATE INDEX IF NOT EXISTS idx_int_seg ON prospecto_inteligencia(proximo_seguimiento);

-- Columnas nuevas de cada interacción (las de base están en comercial_historial).
CREATE TABLE IF NOT EXISTS historial_inteligencia (
  historial_id INTEGER PRIMARY KEY REFERENCES comercial_historial(id),
  resultado TEXT,
  motivo_rechazo TEXT,
  objeciones_json TEXT,
  servicio_ofrecido TEXT,
  propuesta_id TEXT,
  propuesta_nombre TEXT,
  tipo_empresa TEXT,
  reunion INTEGER NOT NULL DEFAULT 0,
  estado_anterior TEXT,
  estado_nuevo TEXT
);
