// Comprueba un plan de la plantilla antes de renderizar: anclas que no están en la voz, planos muy cortos o largos,
// tipos de plano, mapas y territorios que no existen, trajes, cosas, decorados e imágenes que faltan, y el reparto de
// planos comparado con la referencia.   node comprobar.mjs <id>   (public/videos/<id>/)
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolverTerra } from "./src/historia/resolverTerra.mjs";
import { cajaTerritorio } from "./src/historia/cajaTerritorio.mjs";

const id = process.argv[2];
if (!id) { console.error("Uso: node comprobar.mjs <id>"); process.exit(2); }
const plan = JSON.parse(readFileSync(`public/videos/${id}/plan.json`, "utf8"));
const tiempos = JSON.parse(readFileSync(`public/videos/${id}/voz.tiempos.json`, "utf8"));
const r = resolverTerra(plan, tiempos);
const lista = (archivo, re) => [...readFileSync(archivo, "utf8").matchAll(re)].map((m) => m[1]);
const trajes = lista("src/historia/Persona.tsx", /^\s{2}(\w+): \{ forma/gm).concat(["guia"]);
const cosas = JSON.parse(readFileSync("src/historia/cosas.tsx", "utf8").match(/export const COSAS = (\[[^\]]*\])/)[1]);
const decorados = JSON.parse(readFileSync("src/historia/decorados.tsx", "utf8").match(/export const DECORADOS = (\[[^\]]*\])/)[1]);
const gestos = JSON.parse(readFileSync("src/plan/gestos.ts", "utf8").match(/export const GESTOS = (\[[\s\S]*?\]) as const/)[1].replace(/\/\/.*$/gm, "").replace(/,\s*\]/, "]"));
const TIPOS = ["mapa", "narrador", "escena", "archivo", "papel", "capitulo", "portada"];
// dónde cae en pantalla un punto del mapa en el segundo t (la misma cuenta que src/historia/Mapa.tsx)
const R = 6378137;
const aPx = (m, lon, lat) => {
  const x = R * (lon * Math.PI) / 180, y = R * Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
  const [x0, y0, x1, y1] = m.merc;
  return [((x - x0) / (x1 - x0)) * m.ancho, ((y1 - y) / (y1 - y0)) * m.alto];
};
const enPantalla = (m, p, punto, t) => {
  const cam = (c) => { const [cx, cy] = aPx(m, c.lon, c.lat); return { cx, cy, z: 1920 / (c.grados * (m.ancho / (m.zona[2] - m.zona[0]))) }; };
  const a = cam(p.cam), b = cam(p.hasta ?? p.cam);
  const u = Math.min(1, Math.max(0, (t - p.ini) / Math.max(0.01, p.fin - p.ini))), k = 1 - (1 - u) ** 3;
  const z = Math.max(Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * k), 1920 / m.ancho, 1080 / m.alto);
  const mx = 960 / z, my = 540 / z;
  const cx = Math.min(m.ancho - mx, Math.max(mx, a.cx + (b.cx - a.cx) * k)), cy = Math.min(m.alto - my, Math.max(my, a.cy + (b.cy - a.cy) * k));
  return [(punto[0] - cx) * z + 960, (punto[1] - cy) * z + 540];
};
// el satélite de cada mapa, en pequeño (1/8), para saber si un punto cae en el agua
const PASO = 4;
const satelites = {};
const enAgua = (nombre, px, py) => {
  if (!(nombre in satelites)) {
    try {
      const m = JSON.parse(readFileSync(`public/mapas/${nombre}/mapa.json`, "utf8"));
      const w = Math.floor(m.ancho / PASO), h = Math.floor(m.alto / PASO);
      const buf = execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-i", `public/mapas/${nombre}/satelite.jpg`, "-vf", `scale=${w}:${h}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: w * h * 3 + 1024 });
      satelites[nombre] = { w, h, buf };
    } catch { satelites[nombre] = null; }
  }
  const s = satelites[nombre];
  if (!s) return false;
  // agua = azul claramente por encima del rojo en casi todo el entorno (los 3×3 píxeles pequeños = 24×24 del satélite: todos agua; así no salta en islas pequeñas como Malta)
  let agua = 0, total = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = Math.round(px / PASO) + dx, y = Math.round(py / PASO) + dy;
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    const i = (y * s.w + x) * 3, [R_, G, B] = [s.buf[i], s.buf[i + 1], s.buf[i + 2]];
    total++;
    if (B > R_ + 30 && B >= G) agua++;
  }
  return total > 0 && agua === total;
};
const avisos = [...r.avisos];
const mapas = {};
const cuenta = Object.fromEntries(TIPOS.map((t) => [t, 0]));
r.planos.forEach((p, i) => {
  const n = `plano ${i + 1} («${p.en}», ${p.tipo})`;
  const dur = p.fin - p.ini;
  if (!TIPOS.includes(p.tipo)) { avisos.push(`AVISO ${n}: el tipo «${p.tipo}» no existe (${TIPOS.join(", ")})`); return; }
  cuenta[p.tipo] += dur;
  if (p.tipo === "mapa") {
    const f = `public/mapas/${p.mapa}/mapa.json`;
    if (!existsSync(f)) avisos.push(`AVISO ${n}: falta el mapa «${p.mapa}» (herramientas/preparar_mapa.py --nombre ${p.mapa} …)`);
    else {
      mapas[p.mapa] ??= JSON.parse(readFileSync(f, "utf8"));
      for (const c of p.capas ?? []) if (!mapas[p.mapa].capas[c.id]) avisos.push(`AVISO ${n}: el mapa «${p.mapa}» no tiene el territorio «${c.id}» (tiene: ${Object.keys(mapas[p.mapa].capas).join(", ")})`);
    }
    if (!p.cam) avisos.push(`AVISO ${n}: falta «cam» (lon, lat, grados)`);
    // ¿la mascota tapa una chincheta o el nombre de un territorio? (09-11-2026: tapaba Cuba y Aragón)
    if (p.cam && mapas[p.mapa] && p.guia !== false) {
      const izq = p.guia?.lado === "izquierda";
      const tapa = ([x, y]) => y > 380 && (izq ? x < 470 : x > 1450);
      const cosas = [...(p.pins ?? []).map((c) => ({ que: `la chincheta «${c.nombre ?? ""}»`, t: c.t, punto: aPx(mapas[p.mapa], c.lon, c.lat) })),
        ...(p.capas ?? []).filter((c) => c.etiqueta && mapas[p.mapa].capas[c.id]?.centro).map((c) => ({ que: `el nombre «${c.etiqueta}»`, t: c.t, punto: mapas[p.mapa].capas[c.id].centro }))];
      for (const c of cosas) if ([c.t + 0.3, p.fin - 0.1].some((t) => tapa(enPantalla(mapas[p.mapa], p, c.punto, t)))) avisos.push(`AVISO ${n}: la mascota tapa ${c.que}: pon "guia": {"lado": "${izq ? "derecha" : "izquierda"}"}, "guia": false o mueve la cámara`);
    }
    // ¿una chincheta en el mar? (11-11-2026: «territorios en Canadá» caía en el golfo de San Lorenzo). Se mira el color
    // del satélite alrededor del punto; con «"mar": true» en la chincheta se da por buena (un naufragio, una batalla naval)
    if (mapas[p.mapa]) for (const c of p.pins ?? []) {
      if (c.mar) continue;
      const [px, py] = aPx(mapas[p.mapa], c.lon, c.lat);
      if (enAgua(p.mapa, px, py)) avisos.push(`AVISO ${n}: la chincheta «${c.nombre ?? ""}» (${c.lon}, ${c.lat}) cae en el agua: corrige lon/lat (o "mar": true si es en el mar, un lago o una isla tan pequeña que el satélite no la ve)`);
    }
    // un mapa que solo sitúa (sin territorios, una chincheta o ninguna) durante mucho rato: la voz suele hablar de
    // territorios que no se ven («desde 1099» sin los reinos cruzados)
    if (!(p.capas ?? []).length && (p.pins ?? []).length <= 1 && !(p.flechas ?? []).length && !(p.ejercitos ?? []).length && dur > 4)
      avisos.push(`NOTA ${n}: mapa de ${dur.toFixed(1)} s con ${(p.pins ?? []).length} chincheta y ningún territorio ni flecha; si la voz habla de un reino, un imperio o una zona, píntalo (capas)`);
    // ¿cabe lo que se cuenta en este mapa? (12-11-2026: la Armada de 1588 no cabía en europa-1588 y salía cortada).
    // El motor encuadra solo (Mapa.tsx), pero no puede alejarse más de lo que deja el mapa sin enseñar su borde
    if (mapas[p.mapa]) {
      const m = mapas[p.mapa];
      const pts = [...(p.pins ?? []), ...(p.iconos ?? []), ...(p.asedios ?? []), ...(p.fuegos ?? [])].map((c) => aPx(m, Number(c.lon), Number(c.lat)))
        .concat([...(p.flechas ?? []), ...(p.ejercitos ?? [])].flatMap((c) => [c.de, c.a].map((q) => aPx(m, q[0], q[1]))));
      for (const c of (p.capas ?? []).filter((c) => c.etiqueta || c.en !== 0)) {
        const b = m.capas[c.id]?.d ? cajaTerritorio(m.capas[c.id].d, m.ancho) : null;
        if (b) pts.push([b[0], b[1]], [b[2], b[3]]);
      }
      if (pts.length) {
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        const ancho = p.guia === false ? 1920 - 140 : 1920 - 480 - 140, alto = 1080 - 190;
        const zFit = Math.min(ancho / Math.max(1, Math.max(...xs) - Math.min(...xs)), alto / Math.max(1, Math.max(...ys) - Math.min(...ys)));
        const zMin = Math.max(1920 / m.ancho, 1080 / m.alto);
        if (zFit < zMin * 0.98) avisos.push(`AVISO ${n}: lo que se cuenta no cabe en el mapa «${p.mapa}» (se cortaría): prepara uno más grande (preparar_mapa.py con una --zona más ancha) o quita lo que sobra`);
      }
    }
        for (const c of p.iconos ?? []) if (!cosas.includes(c.cosa)) avisos.push(`AVISO ${n}: la cosa «${c.cosa}» no existe`);
  }
  if (p.tipo === "narrador" || p.tipo === "papel") {
    if (!(p.cosas ?? []).length) avisos.push(`NOTA ${n}: no salta nada al lado del narrador; en la referencia siempre aparece algo (una palabra, una tarjeta, un icono)`);
    for (const c of p.cosas ?? []) {
      if (c.cosa && !cosas.includes(c.cosa)) avisos.push(`AVISO ${n}: la cosa «${c.cosa}» no existe (${cosas.join(", ")})`);
      if (c.imagen && !existsSync(`public/videos/${id}/${c.imagen}`)) avisos.push(`AVISO ${n}: falta la imagen public/videos/${id}/${c.imagen}`);
    }
  }
  if (p.tipo === "escena") {
    if (p.decorado && !decorados.includes(p.decorado)) avisos.push(`AVISO ${n}: el decorado «${p.decorado}» no existe (${decorados.join(", ")})`);
    if (p.barco && !cosas.includes(p.barco)) avisos.push(`AVISO ${n}: el barco «${p.barco}» no está en las cosas (galera, carabela…)`);
    for (const a of p.actores ?? []) {
      if (a.traje && !trajes.includes(a.traje)) avisos.push(`AVISO ${n}: el traje «${a.traje}» no existe (${trajes.join(", ")})`);
      if (a.montado && (a.x < 280 || a.x > 1640)) avisos.push(`AVISO ${n}: ${a.q} va a caballo en x ${a.x}: el caballo se sale de la pantalla (x entre 280 y 1640)`);
      for (const k of ["lleva", "llevaI"]) if (a[k] && !cosas.includes(a[k])) avisos.push(`AVISO ${n}: «${a.q}» lleva «${a[k]}», que no existe`);
      for (const ac of a.acciones ?? []) if (ac.hace && !gestos.includes(ac.hace)) avisos.push(`AVISO ${n}: el gesto «${ac.hace}» no existe`);
    }
    const bocs = p.bocadillos ?? [];
    bocs.forEach((b, k) => {
      if (!(p.actores ?? []).some((a) => a.q === b.a)) avisos.push(`AVISO ${n}: el bocadillo es de «${b.a}», que no está en la escena`);
      const palabras = String(b.texto ?? "").split(/\s+/).filter(Boolean).length;
      if (palabras > 9) avisos.push(`NOTA ${n}: bocadillo de ${palabras} palabras («${b.texto}»); en la referencia son de 3-8 palabras, con gracia`);
      // se escribe a ~1 letra por fotograma: tiene que quedar entero 1,5 s como poco antes de que lo tape el siguiente o acabe el plano
      const hasta = Number(b.hasta ?? (bocs[k + 1]?.t ?? p.fin));
      const leer = hasta - b.t - String(b.texto ?? "").length * 0.9 / 30;
      if (leer < 1.5) avisos.push(`AVISO ${n}: el bocadillo «${b.texto}» solo se lee entero ${Math.max(0, leer).toFixed(1)} s (mínimo 1,5): adelántalo, acórtalo o retrasa el siguiente`);
    });
    // un paisaje o una tormenta sin nadie está bien ("paisaje": true); si no, seguramente falta alguien
    if (!(p.actores ?? []).length && !p.paisaje && !p.multitud) avisos.push(`NOTA ${n}: escena sin muñecos (si es un paisaje, una tormenta o una flota, pon "paisaje": true)`);
  }
  // un plano gris solo con una frase que se escribe se queda «en medio de la nada» (las dos pruebas a ciegas)
  if ((p.tipo === "narrador" || p.tipo === "papel") && !(p.cosas ?? []).some((c) => c.cosa || c.tarjeta !== undefined || c.imagen || c.cifra || c.pais))
    avisos.push(`NOTA ${n}: plano gris solo con texto; añade una tarjeta, un icono, una cifra o un cuadro que se vea`);
  for (const c of p.cosas ?? []) if (c.pais) {
    const [m, capa] = String(c.pais).split(":");
    const ruta = `public/mapas/${m}/mapa.json`;
    if (!existsSync(ruta)) avisos.push(`AVISO ${n}: el país «${c.pais}» usa el mapa «${m}», que no existe`);
    else if (!JSON.parse(readFileSync(ruta, "utf8")).capas?.[capa]) avisos.push(`AVISO ${n}: el mapa «${m}» no tiene el territorio «${capa}»`);
  }
  if (p.tipo === "portada" && p.imagen && !existsSync(`public/videos/${id}/${p.imagen}`)) avisos.push(`AVISO ${n}: falta la imagen public/videos/${id}/${p.imagen}`);
  if (p.tipo === "archivo" && !existsSync(`public/videos/${id}/${p.imagen}`)) avisos.push(`AVISO ${n}: falta la imagen public/videos/${id}/${p.imagen}`);
  for (const ac of p.guia?.acciones ?? []) if (ac.hace && !gestos.includes(ac.hace)) avisos.push(`AVISO ${n}: el gesto de la guía «${ac.hace}» no existe`);
  if (dur > 9 && p.tipo !== "escena" && p.tipo !== "capitulo") avisos.push(`NOTA ${n}: ${dur.toFixed(1)} s; la referencia cambia de plano cada ~5 s (pártelo)`);
});
for (const m of r.musica) if (!existsSync(`public/musica/${m.pista}`)) avisos.push(`AVISO música: falta public/musica/${m.pista}`);
// ritmo (09-11-2026, «¿se puede mejorar el pacing?»): en la referencia aparece algo nuevo cada 1-2 s y en el gancho se
// corta cada 3-4 s. Huecos de más de 2,5 s sin nada nuevo (plano, cosa, chincheta, territorio, bocadillo, rótulo, gesto pedido).
const eventos = r.planos.flatMap((p) => [p.ini, ...["capas", "pins", "flechas", "iconos", "cosas", "bocadillos", "rotulos", "ejercitos", "asedios", "fuegos", "cambios"].flatMap((k) => (p[k] ?? []).map((x) => x.t)),
  ...(p.actores ?? []).flatMap((a) => a.acciones.map((ac) => ac.t)), ...(p.guia?.acciones ?? []).map((ac) => ac.t),
  // la portada se mueve sola: el título salta y la frase de debajo se escribe
  ...(p.tipo === "portada" ? [p.ini + 0.2, p.ini + 0.8, p.ini + 1.6, p.ini + 2.4] : [])]).sort((a, b) => a - b);
const huecos = [];
for (let i = 1; i < eventos.length; i++) if (eventos[i] - eventos[i - 1] > 2.5) huecos.push(`${eventos[i - 1].toFixed(1)}-${eventos[i].toFixed(1)} s`);
if (huecos.length) avisos.push(`NOTA ritmo: ${huecos.length} tramos de más de 2,5 s sin que aparezca nada nuevo: ${huecos.slice(0, 12).join(", ")}${huecos.length > 12 ? "…" : ""}`);
// el gancho acaba en la primera tarjeta de capítulo (o a los 90 s si no hay ninguna)
const finGancho = Math.min(90, r.planos.find((p) => p.tipo === "capitulo")?.ini ?? 90);
const gancho = r.planos.filter((p) => p.ini < finGancho && p.tipo !== "escena" && p.tipo !== "capitulo" && p.fin - p.ini > 5);
if (gancho.length) avisos.push(`NOTA ritmo: en el gancho (hasta el primer capítulo) se corta cada 3-4 s; planos largos: ${gancho.map((p) => `${p.n + 1} (${(p.fin - p.ini).toFixed(1)} s)`).join(", ")}`);
const total = r.planos.reduce((a, p) => a + (p.fin - p.ini), 0);
const reparto = Object.fromEntries(Object.entries(cuenta).map(([k, v]) => [k, `${Math.round((v / total) * 100)} %`]));
const media = total / Math.max(1, r.planos.length);
// un número de brocha encima del rótulo que se escribe (los dos arriba en el centro) no se lee
r.planos.forEach((p) => {
  const tit = (p.rotulos ?? []).filter((x) => x.tipo === "titular");
  for (const b of (p.rotulos ?? []).filter((x) => x.tipo !== "titular" && x.tipo !== "fecha"))
    for (const t of tit) {
      const bx = Number(b.x ?? 960), by = Number(b.y ?? 140), tx = Number(t.x ?? 960), ty = Number(t.y ?? 150);
      const anchoT = String(t.texto).length * Number(t.tam ?? 64) * 0.5;
      if (Math.abs(by - ty) < 110 && Math.abs(bx - tx) < anchoT / 2 + 120) avisos.push(`AVISO plano ${p.n + 1}: «${b.texto}» cae encima del rótulo «${t.texto}»; muévelo (x, y)`);
    }
});
if (media > 7) avisos.push(`NOTA un plano cada ${media.toFixed(1)} s de media; la referencia va a uno cada ~5 s`);
console.log(JSON.stringify({ ok: !avisos.some((a) => a.startsWith("AVISO")), planos: r.planos.length, segundos: Number(r.duracion.toFixed(1)),
  segundos_por_plano: Number(media.toFixed(1)), reparto, referencia: { mapa: "28 %", narrador: "26 %", escena: "36 %", archivo: "6 %", papel: "~8 %", capitulo: "4 %" }, avisos }, null, 2));
if (avisos.some((a) => a.startsWith("AVISO"))) process.exit(1);
