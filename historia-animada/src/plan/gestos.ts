// Gestos con nombre: lo que un actor «hace» en una palabra de la voz. Cada gesto es una pequeña coreografía de
// claves (con anticipación y rebote al llegar) más, si toca, un cambio de cara y un sonido. Copiados de lo que hacen
// los muñecos de la referencia (y probados en la prueba v2 del 26-10-2026).
import { FPS } from "../estilo";
import { animar, clamp, CURVA, Clave, lerp } from "../motor/anim";
import { Boca, Ojos, POSE, Pose } from "../motor/Caballero";

export type Accion = {
  t: number; // segundos (los pone el resolvedor)
  hace?: string;
  ojos?: Ojos; boca?: Boca; cejas?: "nada" | "enfado" | "pena" | "picaro";
  pose?: Partial<Pose>; // claves sueltas, por si ningún gesto sirve
  a?: number; // destino en x (camina, entra, sale)
  desde?: number; // origen en x (entra)
  d?: number; // duración en segundos (camina, piensa…)
  lado?: number; // −1 izquierda, 1 derecha (mira, cae, señala)
};

export type ActorPlan = {
  q: string;
  disfraz?: string;
  colores?: Record<string, string>;
  x: number;
  s?: number;
  y?: number; // si no, el suelo del decorado
  mira?: number;
  pose?: string | Partial<Pose>;
  ojos?: Ojos; boca?: Boca; cejas?: "nada" | "enfado" | "pena" | "picaro";
  visera?: number;
  lleva?: { D?: string; I?: string };
  mojado?: boolean;
  acciones: Accion[];
};

/** Poses de partida con nombre. */
export const POSES: Record<string, Partial<Pose>> = {
  reposo: {},
  piensa: { bd: 30, cd: -165, cabeza: 4 },
  jarras: { bi: 62, ci: -96, bd: 62, cd: -96, cabeza: -5, aplasta: -0.03 },
  brazos_cruzados: { bi: 30, ci: -128, bd: 30, cd: -128 },
  arma_alta: { bd: 150, cd: 40 },
  guardia: { bd: 40, cd: -60, bi: 40, ci: -100 },
  agachado: { agacha: 26, cabezaY: 6 },
  orgulloso: { cabeza: -6, cabezaY: -5, aplasta: -0.05, bi: 30, bd: 30, ci: -20, cd: -20 },
  triste: { cabeza: 8, cabezaY: 10, bi: 6, bd: 6, ci: 0, cd: 0, aplasta: 0.03 },
  sujeta: { bd: 40, cd: -110 }, // lo que lleva en la derecha, delante del pecho
  escudo_delante: { bi: 38, ci: -102 }, // el escudo de la izquierda, delante del cuerpo
};

export const GESTOS = [
  "reposo", "piensa", "senala", "celebra", "jarras", "encoge", "saca_pecho", "susto", "se_mira", "toc_peto",
  "sube_visera", "baja_visera", "se_tapa", "lanza", "saluda", "niega", "asiente", "traga", "mira_arriba",
  "mira_camara", "mira", "ataca", "bloquea", "rie", "enfada", "agacha", "levanta", "cae", "camina", "entra",
  "sale", "golpeado", "triste", "orgulloso", "sujeta", "quita_sombrero",
  // los que pone el motor solo (también se pueden pedir): golpe de cabeza en una palabra fuerte, ademán con la mano
  // libre, cambio de peso y respingo cuando a otro le pasa algo cerca
  "enfasis", "ademan", "peso", "respinga",
] as const;

/** Gestos que parten de como está el muñeco en ese momento (no de su pose de partida) y vuelven ahí. */
const RELATIVOS = new Set(["enfasis", "ademan", "peso", "respinga"]);
function relativos(ac: Accion, f0: number, cur: Pose): { k: Clave<Pose>[]; ev: Evento[] } {
  const L = ac.lado ?? 1;
  switch (ac.hace) {
    case "enfasis":
      return { k: [
        { f: f0 - 2, d: 3, c: "rapida", v: { cabezaY: cur.cabezaY + 6, cabeza: cur.cabeza + 3 * L, tronco: cur.tronco + 2.5 * L } },
        { f: f0 + 2, d: 7, v: { cabezaY: cur.cabezaY, cabeza: cur.cabeza, tronco: cur.tronco } },
      ], ev: [] };
    case "ademan": {
      const v1: Partial<Pose> = L > 0 ? { bd: 58, cd: -55 } : { bi: 58, ci: -55 };
      const v0: Partial<Pose> = L > 0 ? { bd: cur.bd, cd: cur.cd } : { bi: cur.bi, ci: cur.ci };
      return { k: [{ f: f0 - 3, d: 5, v: v1 }, { f: f0 + 4, d: 4, c: "rapida", v: L > 0 ? { cd: -35 } : { ci: -35 } }, { f: f0 + 14, d: 8, c: "suave", v: v0 }], ev: [] };
    }
    case "peso":
      return { k: [{ f: f0, d: 10, c: "suave", v: { tronco: cur.tronco + 3 * L, pieI: cur.pieI + (L > 0 ? 6 : -4), pieD: cur.pieD + (L > 0 ? -4 : 6), mira: cur.mira + 0.08 * L } }], ev: [] };
    case "respinga":
      return { k: [
        { f: f0, d: 3, c: "rapida", v: { salto: 10, cabezaY: cur.cabezaY - 6, aplasta: -0.04, mira: L * 0.4 } },
        { f: f0 + 3, d: 6, c: "cae", v: { salto: 0, aplasta: 0, cabezaY: cur.cabezaY } },
      ], ev: [] };
    default: return { k: [], ev: [] };
  }
}

export type Evento = { f: number; k: string; v?: number }; // sonidos que salen solos de un gesto

const R = (k: Clave<Pose>[]) => k;

/** Las claves de un gesto que empieza en el fotograma f0. */
function claves(ac: Accion, f0: number, base: Pose): { k: Clave<Pose>[]; ev: Evento[] } {
  const ev: Evento[] = [];
  const L = ac.lado ?? 1;
  switch (ac.hace) {
    case "reposo": return { k: R([{ f: f0, d: 8, v: { bi: 10, ci: -10, bd: 10, cd: -10, cabeza: 0, cabezaY: 0, agacha: 0, tronco: 0, aplasta: 0, ojoX: 0, ojoY: 0 } }]), ev };
    case "piensa": return { k: R([{ f: f0, d: 9, v: { bd: 30, cd: -165, cabeza: 5, ojoX: -0.5, ojoY: -0.4 } }]), ev };
    case "senala": ev.push({ f: f0, k: "lanzar", v: 0.22 }); return { k: R([{ f: f0 - 3, d: 3, c: "rapida", v: L > 0 ? { bd: 20, cd: -30 } : { bi: 20, ci: -30 } }, { f: f0, d: 6, v: L > 0 ? { bd: 92, cd: -4, tronco: 3, ojoX: 0.8 } : { bi: 92, ci: -4, tronco: -3, ojoX: -0.8 } }]), ev };
    case "celebra":
      ev.push({ f: f0 + 3, k: "brillo", v: 0.4 }, { f: f0, k: "lanzar", v: 0.25 });
      return { k: R([{ f: f0 - 3, d: 3, c: "rapida", v: { agacha: 12, aplasta: 0.04 } }, { f: f0, d: 5, v: { agacha: 0, salto: 34, bi: 160, ci: 20, bd: 160, cd: 20, aplasta: -0.06 } }, { f: f0 + 6, d: 6, c: "cae", v: { salto: 0, aplasta: 0.05 } }, { f: f0 + 12, d: 6, v: { aplasta: 0 } }]), ev };
    case "jarras": return { k: R([{ f: f0, d: 9, v: { bi: 62, ci: -96, bd: 62, cd: -96, cabeza: -5, aplasta: -0.03 } }]), ev };
    case "encoge": return { k: R([{ f: f0, d: 6, v: { bi: 50, ci: 60, bd: 50, cd: 60, cabezaY: 8, cabeza: 6 } }, { f: f0 + 22, d: 8, v: { bi: 10, ci: -10, bd: 10, cd: -10, cabezaY: 0, cabeza: 0 } }]), ev };
    case "saca_pecho":
      ev.push({ f: f0 + 2, k: "brillo", v: 0.5 });
      return { k: R([{ f: f0 - 4, d: 4, c: "rapida", v: { agacha: 8, aplasta: 0.03 } }, { f: f0, d: 9, v: { agacha: 0, cabeza: -6, cabezaY: -5, aplasta: -0.05, bi: 30, bd: 30, ci: -20, cd: -20, mira: 0 } }]), ev };
    case "susto":
      ev.push({ f: f0, k: "lanzar", v: 0.25 });
      return { k: R([{ f: f0, d: 3, c: "rapida", v: { salto: 44, bi: 70, bd: 80, ci: 30, cd: 30, aplasta: -0.06, ojoX: 1 * L } }, { f: f0 + 4, d: 6, c: "cae", v: { salto: 0, aplasta: 0.08 } }, { f: f0 + 10, d: 7, v: { aplasta: 0, bi: 10, bd: 10, ci: -10, cd: -10 } }]), ev };
    case "se_mira": return { k: R([{ f: f0, d: 8, v: { mira: 0.1, ojoX: 0, ojoY: 1, cabeza: 8, cabezaY: 8 } }]), ev };
    case "toc_peto":
      ev.push({ f: f0 + 5, k: "armadura", v: 0.6 }, { f: f0 + 11, k: "armadura", v: 0.6 });
      return { k: R([{ f: f0, d: 6, v: { bd: 30, cd: -120 } }, { f: f0 + 5, d: 3, c: "rapida", v: { cd: -105 } }, { f: f0 + 8, d: 3, c: "rapida", v: { cd: -122 } }, { f: f0 + 11, d: 3, c: "rapida", v: { cd: -105 } }, { f: f0 + 14, d: 3, c: "rapida", v: { cd: -122 } }]), ev };
    case "sube_visera":
      ev.push({ f: f0, k: "armadura", v: 0.5 });
      return { k: R([{ f: f0 - 8, d: 7, v: { bi: 150, ci: 100 } }, { f: f0, d: 7, c: "rapida", v: { visera: 1, bi: 168, ci: 78, cabeza: -4 } }, { f: f0 + 9, d: 8, v: { bi: base.bi, ci: base.ci } }]), ev };
    case "baja_visera":
      ev.push({ f: f0, k: "armadura", v: 0.7 });
      return { k: R([{ f: f0 - 6, d: 6, v: { bi: 160, ci: 70 } }, { f: f0, d: 4, c: "rapida", v: { visera: 0, bi: 140, ci: 80 } }, { f: f0 + 6, d: 8, v: { bi: base.bi, ci: base.ci } }]), ev };
    case "se_tapa":
      return { k: R([{ f: f0 - 3, d: 3, c: "rapida", v: { agacha: 14, bd: 5 } }, { f: f0, d: 7, v: { agacha: 22, bd: 130, cd: 100, bi: 35, ci: -30, cabezaY: 8, mira: -0.2, ojoX: 0.8, ojoY: -0.6 } }]), ev };
    case "lanza":
      ev.push({ f: f0, k: "lanzar", v: 0.7 });
      return { k: R([{ f: f0 - 10, d: 7, v: { bd: 8, cd: -16, tronco: 4, agacha: 8 } }, { f: f0 - 2, d: 4, c: "rapida", v: { bd: 176, cd: 16, tronco: -6, agacha: 0 } }, { f: f0 + 4, d: 8, v: { bd: 150, cd: 30 } }, { f: f0 + 14, d: 9, v: { bd: 10, cd: -10, tronco: 0 } }]), ev };
    case "saluda": ev.push({ f: f0, k: "lanzar", v: 0.2 }); return { k: R([{ f: f0, d: 6, v: { bd: 160, cd: 30 } }, ...[0, 1, 2].flatMap((i) => [{ f: f0 + 6 + i * 8, d: 4, v: { cd: 55 } }, { f: f0 + 10 + i * 8, d: 4, v: { cd: 20 } }]), { f: f0 + 34, d: 8, v: { bd: 10, cd: -10 } }]), ev };
    case "niega": return { k: R([0, 1, 2].flatMap((i) => [{ f: f0 + i * 8, d: 4, v: { cabeza: -9, mira: base.mira - 0.2 } }, { f: f0 + 4 + i * 8, d: 4, v: { cabeza: 9, mira: base.mira + 0.2 } }]).concat([{ f: f0 + 24, d: 5, v: { cabeza: 0, mira: base.mira } }])), ev };
    case "asiente": return { k: R([0, 1].flatMap((i) => [{ f: f0 + i * 8, d: 4, v: { cabezaY: 8, cabeza: 3 } }, { f: f0 + 4 + i * 8, d: 4, v: { cabezaY: -2, cabeza: 0 } }]).concat([{ f: f0 + 16, d: 4, v: { cabezaY: 0, cabeza: 0 } }])), ev };
    case "traga":
      ev.push({ f: f0, k: "trago", v: 0.7 });
      return { k: R([{ f: f0, d: 4, c: "rapida", v: { cabezaY: 9, aplasta: 0.04 } }, { f: f0 + 4, d: 8, v: { cabezaY: 0, aplasta: 0 } }]), ev };
    case "mira_arriba": return { k: R([{ f: f0, d: 7, v: { cabeza: -7, cabezaY: -6, ojoY: -1, ojoX: 0.15 } }]), ev };
    case "mira_camara": return { k: R([{ f: f0, d: 7, v: { mira: 0, ojoX: 0, ojoY: 0, cabeza: -2, cabezaY: 0 } }]), ev };
    case "mira": return { k: R([{ f: f0, d: 6, v: { mira: 0.45 * L, ojoX: 0.8 * L, ojoY: 0 } }]), ev };
    case "ataca":
      ev.push({ f: f0, k: "lanzar", v: 0.6 });
      return { k: R([{ f: f0 - 8, d: 7, v: { bd: 150, cd: 60, tronco: -6, agacha: 6 } }, { f: f0, d: 4, c: "rapida", v: { bd: 40, cd: -20, tronco: 8, agacha: 0 } }, { f: f0 + 10, d: 9, v: { bd: 30, cd: -40, tronco: 0 } }]), ev };
    case "bloquea": return { k: R([{ f: f0, d: 5, c: "rapida", v: { bi: 70, ci: -80, agacha: 10, cabezaY: 6 } }]), ev };
    case "rie": return { k: R([0, 1, 2, 3].flatMap((i) => [{ f: f0 + i * 6, d: 3, v: { aplasta: 0.03, cabeza: -3 } }, { f: f0 + 3 + i * 6, d: 3, v: { aplasta: -0.02, cabeza: 2 } }]).concat([{ f: f0 + 24, d: 5, v: { aplasta: 0, cabeza: 0 } }])), ev };
    case "enfada": return { k: R([{ f: f0, d: 5, v: { tronco: 4 * L, cabeza: 4, bi: 20, bd: 20, ci: -60, cd: -60 } }]), ev };
    case "agacha": return { k: R([{ f: f0, d: 7, v: { agacha: 26, cabezaY: 6 } }]), ev };
    case "levanta": return { k: R([{ f: f0, d: 7, v: { agacha: 0, cabezaY: 0 } }]), ev };
    case "golpeado": return { k: R([{ f: f0, d: 3, c: "rapida", v: { cabezaY: 22, aplasta: 0.06, cabeza: -6 } }, { f: f0 + 4, d: 9, v: { cabezaY: base.cabezaY, aplasta: 0, cabeza: 0 } }]), ev };
    case "triste": return { k: R([{ f: f0, d: 10, c: "suave", v: POSES.triste }]), ev };
    case "orgulloso": return { k: R([{ f: f0, d: 9, v: POSES.orgulloso }]), ev };
    case "sujeta": return { k: R([{ f: f0, d: 9, v: POSES.sujeta }]), ev };
    // se quita el sombrero o la corona (Terra: lo dibuja en la mano derecha desde f0 + 8) y lo baja delante del pecho
    case "quita_sombrero": ev.push({ f: f0 + 6, k: "lanzar", v: 0.2 }); return { k: R([{ f: f0, d: 7, v: { bd: 168, cd: 20, cabeza: 4 } }, { f: f0 + 10, d: 9, v: { bd: 55, cd: -60, cabeza: 0 } }]), ev };
    case "cae":
      ev.push({ f: f0 + 9, k: "caida_barro", v: 0.8 });
      return { k: R([{ f: f0, d: 4, v: { bi: 40, bd: 50, ci: 30, cd: 30 } }]), ev };
    default: return { k: [], ev };
  }
}

const SUSTO_OJOS: Record<string, Ojos> = { susto: "susto", celebra: "felices", saca_pecho: "felices", orgulloso: "felices", rie: "felices", golpeado: "apretados", se_tapa: "susto", cae: "aturdido", triste: "entornados", enfada: "normal" };
const SUSTO_BOCA: Record<string, Boca> = { susto: "abierta", celebra: "abierta", rie: "abierta", golpeado: "dientes", se_tapa: "dientes", saca_pecho: "sonrisa", triste: "triste" };

export type Estado = {
  pose: Pose; previa: Pose; ojos?: Ojos; boca?: Boca; cejas?: "nada" | "enfado" | "pena" | "picaro";
  x: number; rot: number; sudor?: number; lanzadoD?: number; // fotograma en que soltó lo de la mano derecha
};

/** Cómo está un actor en el fotograma f (contado desde el principio del vídeo). */
export function estadoActor(a: ActorPlan, f: number): Estado {
  const pBase = typeof a.pose === "string" ? POSES[a.pose] ?? {} : a.pose ?? {};
  const base: Pose = { ...POSE, mira: a.mira ?? POSE.mira, visera: a.visera ?? 0, ...pBase };
  const todas: Clave<Pose>[] = [];
  let ojos = a.ojos, boca = a.boca, cejas = a.cejas;
  let x = a.x, rot = 0, sudor: number | undefined, lanzadoD: number | undefined;
  const orden = [...a.acciones].sort((p, q) => p.t - q.t);
  for (const ac of orden) {
    const f0 = Math.round(ac.t * FPS);
    if (ac.hace && RELATIVOS.has(ac.hace)) todas.push(...relativos(ac, f0, animar(f0 - 3, base, todas)).k);
    else if (ac.hace) todas.push(...claves(ac, f0, base).k);
    if (ac.pose) todas.push({ f: f0, d: 7, v: ac.pose });
    if (f >= f0) {
      if (ac.hace && SUSTO_OJOS[ac.hace]) ojos = SUSTO_OJOS[ac.hace];
      if (ac.hace && SUSTO_BOCA[ac.hace]) boca = SUSTO_BOCA[ac.hace];
      if (ac.hace === "golpeado" && f > f0 + 14) { ojos = a.ojos; boca = a.boca; }
      if (ac.hace === "respinga") ojos = f < f0 + 14 ? "susto" : ojos;
      if (ac.ojos) ojos = ac.ojos;
      if (ac.boca) boca = ac.boca;
      if (ac.cejas) cejas = ac.cejas;
      if (ac.hace === "traga") sudor = clamp((f - f0) / 30);
      if (ac.hace === "lanza") lanzadoD = f0;
    }
    // desplazamientos
    if (ac.hace === "camina" || ac.hace === "entra" || ac.hace === "sale") {
      const desde = ac.hace === "entra" ? ac.desde ?? x - 800 : x;
      const hasta = ac.hace === "sale" ? ac.a ?? x + 900 : ac.a ?? a.x;
      const dur = Math.round((ac.d ?? Math.abs(hasta - desde) / 260) * FPS);
      if (ac.hace === "entra" && f < f0) x = desde;
      if (f >= f0) x = lerp(desde, hasta, CURVA.suave(clamp((f - f0) / Math.max(1, dur))));
      if (f >= f0 && f < f0 + dur) {
        const g = f - f0, dir = Math.sign(hasta - desde) || 1;
        todas.push({ f: f0, d: 1, c: "lineal", v: { mira: 0.5 * dir } });
        (todas as Clave<Pose>[]).push({ f: f - 1, d: 1, c: "lineal", v: { alzaI: Math.max(0, Math.sin(g * 0.45)) * 22, alzaD: Math.max(0, -Math.sin(g * 0.45)) * 22, salto: Math.abs(Math.sin(g * 0.45)) * 6, tronco: dir * 3 } });
      } else if (f >= f0 + dur) {
        todas.push({ f: f0 + dur, d: 5, v: { alzaI: 0, alzaD: 0, salto: 0, tronco: 0 } });
      }
    }
    if (ac.hace === "cae" && f >= f0) rot = (ac.lado ?? 1) * 84 * CURVA.cae(clamp((f - f0 - 4) / 9));
  }
  const pose = animar(f, base, todas);
  const previa = animar(f - 2, base, todas);
  return { pose, previa, ojos, boca, cejas, x, rot, sudor, lanzadoD };
}

/** Sonidos que salen solos de los gestos de un actor (en fotogramas del vídeo). */
export function eventosActor(a: ActorPlan): Evento[] {
  const pBase = typeof a.pose === "string" ? POSES[a.pose] ?? {} : a.pose ?? {};
  const base: Pose = { ...POSE, ...pBase };
  return a.acciones.flatMap((ac) => (ac.hace ? claves(ac, Math.round(ac.t * FPS), base).ev : []));
}
