// Ancla el plan a la voz: cada plano, gesto, efecto y rótulo dice «en» con una palabra o frase de la voz (o un
// número de segundos) y aquí se convierte en segundos. Lo usan el render (Video.tsx) y el comprobador (comprobar.mjs).
// Las palabras se comparan sin tildes, sin mayúsculas y sin signos. Cada plano busca desde donde empezó el anterior;
// cada gesto, efecto o rótulo, desde donde empieza su plano.

export const normalizar = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Busca la frase en las palabras desde «desde»; devuelve el índice de su primera palabra o -1. */
export const buscar = (palabras, frase, desde = 0) => {
  const objetivo = normalizar(frase);
  if (!objetivo.length) return -1;
  const norm = palabras.map((w) => normalizar(w.p).join(" "));
  for (let i = Math.max(0, desde); i <= norm.length - objetivo.length; i++) {
    let ok = true;
    for (let k = 0; k < objetivo.length; k++) if (norm[i + k] !== objetivo[k]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
};

const COLA = 1.5; // segundos de imagen después de la última palabra (el plan puede pedir más con «cola»)

/** plan + tiempos → plan con segundos (ini/fin de cada plano; t de cada cosa) y la lista de avisos. */
export function resolverPlan(plan, tiempos) {
  const palabras = tiempos.palabras ?? [];
  const avisos = [];
  const duracion = (tiempos.duracion ?? (palabras.length ? palabras[palabras.length - 1].fin : 10)) + (plan.cola ?? COLA);
  let cursor = 0; // índice de palabra desde el que se busca el siguiente plano
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
  planos.forEach((p, i) => {
    if (p.fin - p.ini < 0.4) avisos.push(`AVISO plano ${i + 1} («${p.en}»): dura ${(p.fin - p.ini).toFixed(2)} s; ¿dos planos en la misma palabra?`);
    if (p.fin - p.ini > 6 && p.inserto) avisos.push(`NOTA plano ${i + 1} («${p.en}»): inserto de ${(p.fin - p.ini).toFixed(1)} s; pártelo con un plano de alguien reaccionando (los de muñecos los corta el motor solo)`);
  });
  // gestos, efectos y rótulos dentro de su plano
  const enPlano = (p, cosa, que) => {
    if (cosa.en === undefined) return p.ini;
    if (typeof cosa.en === "number") return p.ini + cosa.en;
    const i = buscar(palabras, cosa.en, p.idx);
    const t = i >= 0 ? palabras[i].ini : NaN;
    if (i < 0 || t > p.fin + 0.01) {
      avisos.push(`AVISO plano ${p.n + 1}: ${que} en «${cosa.en}», que no está dentro del plano`);
      return p.ini;
    }
    return t;
  };
  for (const p of planos) {
    p.actores = (p.actores ?? []).map((a) => ({ ...a, acciones: (a.acciones ?? []).map((ac) => ({ ...ac, t: enPlano(p, ac, `${a.q}: ${ac.hace ?? "cara"}`) })) }));
    p.delante = (p.delante ?? []).map((a) => ({ ...a, acciones: [] }));
    p.efectos = (p.efectos ?? []).map((e) => ({ ...e, t: enPlano(p, e, `efecto ${e.hace}`) }));
    p.rotulos = (p.rotulos ?? []).map((r) => ({ ...r, t: enPlano(p, r, `rótulo «${r.texto}»`) }));
    if (p.inserto) {
      const ins = { ...p.inserto };
      for (const k of ["piezas", "impactos", "notas", "puntos", "rutas"]) if (ins[k]) ins[k] = ins[k].map((x) => ({ ...x, t: enPlano(p, x, `inserto ${k}`) }));
      p.inserto = ins;
    }
  }
  // cortes automáticos (26-10-2026, «más dinámico»): un plano de muñecos de más de 3,4 s se parte en una pausa de la
  // voz y la segunda mitad cambia de encuadre. Gestos, efectos y rótulos van en segundos, así que siguen en su sitio.
  const MAX = 3.4;
  const otro = { medio: "primer", primer: "medio", detalle: "medio", general: "medio" };
  const partir = (pl, prof = 0) => {
    const dur = pl.fin - pl.ini;
    if (dur <= MAX || prof > 3 || pl.inserto || pl.cortar === false || pl.decorado === "cielo" || !(pl.actores ?? []).length) return [pl];
    const cand = palabras.filter((w) => w.ini > pl.ini + 1.2 && w.ini < pl.fin - 1.2);
    if (!cand.length) return [pl];
    const medio = (pl.ini + pl.fin) / 2;
    const nota = (w, i) => Math.abs(w.ini - medio) - (/[.,;:?!…]$/.test(palabras[palabras.indexOf(w) - 1]?.p ?? "") ? 1.2 : 0);
    const w = cand.reduce((m, x) => (nota(x) < nota(m) ? x : m));
    const tipo = pl.cam?.tipo ?? "medio";
    const enSegunda = (a) => (a.acciones ?? []).some((ac) => ac.t >= w.ini);
    const quien = pl.actores.find(enSegunda)?.q ?? pl.cam?.a ?? pl.actores[0].q;
    const a = { ...pl, fin: w.ini };
    const b = { ...pl, ini: w.ini, en: w.ini, idx: palabras.indexOf(w), corteAuto: true, cam: { tipo: otro[tipo] ?? "medio", a: tipo === "general" ? quien : pl.cam?.a ?? quien, ...(pl.cam?.angulo ? { angulo: pl.cam.angulo } : {}) } };
    return [...partir(a, prof + 1), ...partir(b, prof + 1)];
  };
  const cortados = planos.flatMap((pl) => partir(pl));
  cortados.forEach((pl, i) => { pl.n = i; });
  planos.length = 0;
  planos.push(...cortados);

  // música: cada pieza desde su ancla
  const musica = (plan.musica ?? []).map((m) => {
    let t = 0;
    if (typeof m.desde === "number") t = m.desde;
    else if (m.desde) { const i = buscar(palabras, m.desde, 0); if (i < 0) avisos.push(`AVISO música: no encuentro «${m.desde}»`); else t = palabras[i].ini; }
    return { ...m, t };
  });
  return { ...plan, planos, musica, duracion, avisos, palabras };
}
