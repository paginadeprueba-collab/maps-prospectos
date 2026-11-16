/* Empaqueta los datos del prospecto en el hash (#…), para que no viajen al servidor.
   Otros grupos (salud, gastronomía, etc.) usan el mismo codec.
   "1." = JSON en base64url. "2." = gzip + base64url, solo si queda más corto. */
(function (root) {
  function bytesToB64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function b64urlToBytes(s) {
    let t = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    const bin = atob(t);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function gzipBytes(bytes) {
    const cs = new CompressionStream("gzip");
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Response(stream).arrayBuffer().then((buf) => new Uint8Array(buf));
  }

  function gunzipBytes(bytes) {
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then((buf) => new Uint8Array(buf));
  }

  async function pack(obj) {
    const json = JSON.stringify(obj);
    const raw = new TextEncoder().encode(json);
    const plain = "1." + bytesToB64url(raw);
    // El caso común (sin texto de reseñas) queda en claro: abre en cualquier celular.
    // Gzip solo cuando el link ya es largo.
    if (typeof CompressionStream === "undefined" || plain.length < 700) return plain;
    try {
      const gz = await gzipBytes(raw);
      const packed = "2." + bytesToB64url(gz);
      return packed.length + 12 < plain.length ? packed : plain;
    } catch (e) {
      return plain;
    }
  }

  async function unpack(hash) {
    let h = String(hash || "");
    if (h.charAt(0) === "#") h = h.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* ya venía decodificado */ }
    const dot = h.indexOf(".");
    if (dot < 1) throw new Error("hash");
    const ver = h.slice(0, dot);
    const bytes = b64urlToBytes(h.slice(dot + 1));
    let json;
    if (ver === "1") json = new TextDecoder().decode(bytes);
    else if (ver === "2") json = new TextDecoder().decode(await gunzipBytes(bytes));
    else throw new Error("version");
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") throw new Error("json");
    return data;
  }

  root.EjemploCodec = { pack: pack, unpack: unpack };
})(typeof window !== "undefined" ? window : globalThis);
