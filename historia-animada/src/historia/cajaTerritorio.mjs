// La caja (x0, y0, x1, y1, en píxeles del mapa) de un territorio, sin sus islas lejanas (12-11-2026: Portugal llevaba
// las Azores y Castilla las Canarias, y la cámara se alejaba para enseñarlas). Se parte del trozo más grande y se le van
// sumando los que están pegados o muy cerca (a menos de un 4 % del ancho del mapa); lo demás se ignora.
// Lo usan Mapa.tsx (encuadrar) y comprobar.mjs.
export function cajaTerritorio(d, anchoMapa) {
  const trozos = String(d).split(/(?=M)/).map((s) => {
    const n = s.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    return [x0, y0, x1, y1];
  }).filter((b) => isFinite(b[0]));
  if (!trozos.length) return null;
  trozos.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]));
  const g = 0.04 * anchoMapa;
  let caja = [...trozos[0]];
  const usado = new Set([0]);
  for (let cambio = true; cambio;) {
    cambio = false;
    trozos.forEach((b, i) => {
      if (usado.has(i)) return;
      const cerca = b[0] <= caja[2] + g && b[2] >= caja[0] - g && b[1] <= caja[3] + g && b[3] >= caja[1] - g;
      if (cerca) { usado.add(i); caja = [Math.min(caja[0], b[0]), Math.min(caja[1], b[1]), Math.max(caja[2], b[2]), Math.max(caja[3], b[3])]; cambio = true; }
    });
  }
  return caja;
}
