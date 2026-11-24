// Ancla el plan a la voz (como src/plan/resolver.mjs del kit, pero sin cortes automáticos:
// en la referencia un plano dura ~5 s y los diálogos, 15-35 s). Cada plano dice «en» con una palabra o frase de la voz (o un
// número de segundos); y dentro del plano, todo lo que lleva «en» (capas, chinchetas, flechas, iconos, cosas del
// narrador, bocadillos, rótulos, gestos) se pasa a segundos buscando desde donde empieza su plano.
// Lo usan el render (VideoTerra.tsx) y el comprobador (comprobar-terra.mjs).
import { buscar } from "../plan/resolver.mjs";

const COLA = 1.5; // segundos de imagen después de la última palabra (comprobar_video.py admite ±2 s sobre la voz)

// Nada de planos que arrancan vacíos (11-11-2026: la ficha «Antes y después» en blanco, el desierto sin nada):
// el plano corta en su frase, pero lo primero que salta suele ir en una palabra 1-3 s después. Si lo primero llega más
// de ARRANQUE s tarde, se adelanta al corte (solo eso; lo demás sigue en su palabra). Una escena con muñecos ya
// arranca llena. «"arranque": false» en el plano lo deja como está.
const ARRANQUE = 0.5;
const VISIBLES = ["capas", "pins", "flechas", "iconos", "cosas", "ejercitos", "asedios", "fuegos"];
function arrancarLleno(p) {
  if (p.arranque === false || p.tipo === "capitulo" || p.tipo === "archivo" || p.tipo === "portada") return;
  if (p.tipo === "escena" && (p.actores ?? []).length) return;
  const items = VISIBLES.flatMap((k) => (Array.isArray(p[k]) ? p[k] : []));
  if (!items.length) return;
  const primero = Math.min(...items.map((x) => x.t));
  if (primero - p.ini <= ARRANQUE) return;
  const nuevo = p.ini + 0.12;
  for (const x of items) if (Math.abs(x.t - primero) < 0.05) {
    x.t = nuevo;
    if (typeof x.tachar_t === "number" && x.tachar_t < nuevo + 0.6) x.tachar_t = nuevo + 0.6;
  }
}

export function resolverTerra(plan, tiempos) {
  const palabras = tiempos.palabras ?? [];
  const avisos = [];
  const duracion = (tiempos.duracion ?? (palabras.length ? palabras[palabras.length - 1].fin : 10)) + (plan.cola ?? COLA);
  let cursor = 0;
  const planos = [];
  (plan.planos ?? []).forEach((pl, n) => {
    let ini, idx = cursor;
    if (n === 0 && (pl.en === undefined || pl.en === 0)) { ini = 0; idx = 0; }
    else if (typeof pl.en === "number") { ini = pl.en; idx = palabras.findIndex((w) => w.ini >= ini - 0.05); if (idx < 0) idx = cursor; }
    else {
      idx = buscar(palabras, pl.en ?? "", cursor);
      if (idx < 0) { avisos.push(`AVISO plano ${n + 1}: no encuentro «${pl.en}» en la voz (después de la palabra ${cursor})`); idx = cursor; }
      ini = palabras[idx]?.ini ?? 0;
      if (pl.antes) ini = Math.max(0, ini - pl.antes);
    }
    cursor = idx;
    planos.push({ ...pl, n, ini, idx });
  });
  planos.forEach((p, i) => { p.fin = i + 1 < planos.length ? planos[i + 1].ini : duracion; });

  const enPlano = (p, cosa, que) => {
    if (cosa.en === undefined) return p.ini;
    if (typeof cosa.en === "number") return p.ini + cosa.en;
    const i = buscar(palabras, cosa.en, p.idx);
    const t = i >= 0 ? palabras[i].ini : NaN;
    if (i < 0 || t > p.fin + 0.01) { avisos.push(`AVISO plano ${p.n + 1} (${p.tipo}): ${que} en «${cosa.en}», que no está dentro del plano`); return p.ini; }
    return t;
  };
  const LISTAS = ["capas", "pins", "flechas", "iconos", "cosas", "bocadillos", "rotulos", "ejercitos", "asedios", "fuegos", "cambios", "copias", "barcos"];
  let ne = 0; // número de escena (para que dos escenas seguidas no repitan toma de cámara)
  for (const p of planos) {
    if (p.tipo === "escena") p.ne = ne++;
    for (const k of LISTAS) if (Array.isArray(p[k])) p[k] = p[k].map((x) => ({ ...x, t: enPlano(p, x, `${k}`), ...(x.tachar_en !== undefined ? { tachar_t: enPlano(p, { en: x.tachar_en }, `${k}: tachar`) } : {}), ...(x.cara_en !== undefined ? { tc: enPlano(p, { en: x.cara_en }, `${k}: cara`) } : {}), ...(x.rompe_en !== undefined ? { tr: enPlano(p, { en: x.rompe_en }, `${k}: rompe`) } : {}) }));
    if (p.foco && typeof p.foco === "object") p.foco = { ...p.foco, t: enPlano(p, p.foco, "foco") };
    if (Array.isArray(p.actores)) p.actores = p.actores.map((a) => ({ ...a, acciones: (a.acciones ?? []).map((ac) => ({ ...ac, t: enPlano(p, ac, `${a.q}: ${ac.hace ?? "cara"}`) })) }));
    if (p.guia && typeof p.guia === "object") p.guia = { ...p.guia, acciones: (p.guia.acciones ?? []).map((ac) => ({ ...ac, t: enPlano(p, ac, `guía: ${ac.hace ?? "cara"}`) })) };
    arrancarLleno(p);
    const dur = p.fin - p.ini;
    if (dur < 0.6) avisos.push(`AVISO plano ${p.n + 1} («${p.en}»): dura ${dur.toFixed(2)} s; ¿dos planos en la misma palabra?`);
    if (dur > 12 && p.tipo !== "escena") avisos.push(`NOTA plano ${p.n + 1} («${p.en}», ${p.tipo}): ${dur.toFixed(1)} s; la referencia cambia de plano cada ~5 s`);
    if (dur > 40) avisos.push(`NOTA plano ${p.n + 1} («${p.en}»): ${dur.toFixed(1)} s seguidos; parte la escena en dos planos (otro encuadre o el narrador)`);
  }
  const musica = (plan.musica ?? []).map((m) => {
    let t = 0;
    if (typeof m.desde === "number") t = m.desde;
    else if (m.desde) { const i = buscar(palabras, m.desde, 0); if (i < 0) avisos.push(`AVISO música: no encuentro «${m.desde}»`); else t = palabras[i].ini; }
    return { ...m, t };
  });
  return { ...plan, planos, musica, duracion, avisos, palabras };
}
