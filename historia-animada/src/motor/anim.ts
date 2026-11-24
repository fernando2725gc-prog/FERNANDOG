// Herramientas de animación: claves con rebote al llegar, ruido estable, temblores y oscilaciones amortiguadas.
import { Easing } from "remotion";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Curvas: «llega» pasa un poco y vuelve (el rebote de cut-out del original); «suave» entra y sale despacio.
export const CURVA = {
  llega: Easing.out(Easing.back(1.7)),
  suave: Easing.inOut(Easing.cubic),
  rapida: Easing.out(Easing.cubic),
  cae: Easing.in(Easing.quad),
  lineal: (t: number) => t,
};
export type Curva = keyof typeof CURVA;

/** Una clave: desde el fotograma f, en d fotogramas, los valores de v. */
export type Clave<T> = { f: number; d?: number; c?: Curva; v: Partial<T> };

/** Valor de cada campo en el fotograma: recorre las claves en orden y va del valor anterior al de la clave. */
export function animar<T extends Record<string, number>>(frame: number, base: T, claves: Clave<T>[]): T {
  const out = { ...base };
  const orden = [...claves].sort((a, b) => a.f - b.f);
  for (const k of Object.keys(base) as (keyof T)[]) {
    let previo = base[k] as number;
    let valor = previo;
    for (const cl of orden) {
      const destino = cl.v[k];
      if (destino === undefined) continue;
      if (frame < cl.f) break;
      const d = cl.d ?? 7;
      const t = clamp((frame - cl.f) / d);
      valor = lerp(previo, destino as number, CURVA[cl.c ?? "llega"](t));
      previo = destino as number;
    }
    (out[k] as number) = valor;
  }
  return out;
}

/** Estado discreto (cara, boca…) según el último cambio que ya ha llegado. */
export function estado<T>(frame: number, inicial: T, cambios: [number, T][]): T {
  let e = inicial;
  for (const [f, v] of cambios) if (frame >= f) e = v;
  return e;
}

// Ruido estable (el mismo en cada render): seno de semillas.
export const azar = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const ruido = (t: number, semilla = 0) => {
  const i = Math.floor(t);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return lerp(azar(i + semilla * 57), azar(i + 1 + semilla * 57), s) * 2 - 1;
};

/** Oscilación amortiguada que empieza en el fotograma f0 (flechas clavadas, escudo golpeado, muelles). */
export const muelle = (frame: number, f0: number, amp: number, frec = 0.55, amort = 0.12) => {
  if (frame < f0) return 0;
  const t = frame - f0;
  return amp * Math.sin(t * frec) * Math.exp(-t * amort);
};

/** Temblor de cámara: suma de golpes [fotograma, fuerza] que se apagan en unos 10 fotogramas. */
export const temblor = (frame: number, golpes: [number, number][]) => {
  let x = 0, y = 0, r = 0;
  for (const [f0, fuerza] of golpes) {
    if (frame < f0) continue;
    const t = frame - f0;
    const a = fuerza * Math.exp(-t * 0.28);
    if (a < 0.05) continue;
    x += ruido(frame * 0.9, f0) * a;
    y += ruido(frame * 0.9, f0 + 3) * a;
    r += ruido(frame * 0.7, f0 + 7) * a * 0.04;
  }
  return { x, y, r };
};

/** La pose de ahora y la de dos fotogramas antes (para el movimiento secundario del muñeco). */
export function animar2<T extends Record<string, number>>(frame: number, base: T, claves: Clave<T>[]): [T, T] {
  return [animar(frame, base, claves), animar(frame - 2, base, claves)];
}

/** Cámara viva: flota un poco aunque el plano esté quieto, como una cámara de dibujos con grúa. */
export const vivo = <T extends { x: number; y: number; z: number }>(cam: T, frame: number, amp = 1): T => ({
  ...cam,
  x: cam.x + ruido(frame * 0.018, 1) * 7 * amp,
  y: cam.y + ruido(frame * 0.016, 2) * 5 * amp,
  z: cam.z * (1 + ruido(frame * 0.012, 3) * 0.008 * amp),
});
