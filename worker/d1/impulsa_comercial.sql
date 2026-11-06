-- IMPULSA — Esquema D1 para CRM comercial (diagnósticos, propuestas, historial).
-- PREPARADO, NO APLICADO NI DESPLEGADO. Hoy el módulo guarda todo en localStorage
-- (impulsa_resultados_v1 → r.comercial) y sincroniza Android/PC con Exportar/Importar JSON.
-- Para activarlo: crear la base D1, enlazarla en el Worker investigador y agregar endpoints
-- GET/PUT /comercial/:key con autenticación (no exponer claves en el frontend).
CREATE TABLE IF NOT EXISTS prospecto_comercial (
  key TEXT PRIMARY KEY,              -- link de Google Maps normalizado (misma clave que el frontend)
  nombre TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  proxima_accion TEXT,
  proxima_fecha TEXT,
  verificacion_json TEXT,            -- verificación manual (Ads Library, Instagram, reseñas…)
  doc_json TEXT,                     -- documento editable vigente
  actualizado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comercial_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL REFERENCES prospecto_comercial(key),
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,                -- contacto | mensaje | estado | diagnostico_generado | diagnostico_pdf | propuesta_pdf | verificacion
  canal TEXT, detalle TEXT, mensaje TEXT, observaciones TEXT, proxima_accion TEXT, proxima_fecha TEXT
);
CREATE INDEX IF NOT EXISTS idx_hist_key ON comercial_historial(key, fecha);
CREATE TABLE IF NOT EXISTS comercial_documento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL REFERENCES prospecto_comercial(key),
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,                -- diagnostico | propuesta
  version INTEGER NOT NULL,
  nivel TEXT,                        -- preliminar | concluyente
  total REAL,                        -- NULL = a definir
  servicios_json TEXT,
  snapshot_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_doc_key ON comercial_documento(key, fecha);
