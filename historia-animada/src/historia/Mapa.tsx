// El mapa de la plantilla : satélite de la NASA con territorios de color plano que se rellenan o se extienden,
// chinchetas, flechas de ejércitos y rutas, y la fecha arriba a la izquierda. Los datos los prepara
// herramientas/preparar_mapa.py en public/mapas/<nombre>/ (satelite.jpg + mapa.json). En el tema D («Libro») el mismo
// mapa se pinta como un atlas viejo, sin satélite.
import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Img, staticFile } from "remotion";
import { clamp, CURVA, lerp } from "../motor/anim";
import { DefsTerra, mezcla, Texto, tono } from "./forma";
import { H, Tema, W } from "./tema";
// módulo JS compartido con comprobar.mjs
import { cajaTerritorio } from "./cajaTerritorio.mjs";

export type MapaDatos = {
  nombre: string; ancho: number; alto: number; zona: [number, number, number, number]; merc: [number, number, number, number];
  tierra: string; lagos?: string; capas: Record<string, { d: string; centro: [number, number] | null; nombre: string }>;
};

const CACHE = new Map<string, MapaDatos>();
export const useMapa = (nombre: string): MapaDatos | null => {
  const [datos, setDatos] = useState<MapaDatos | null>(CACHE.get(nombre) ?? null);
  const [espera] = useState(() => (CACHE.has(nombre) ? null : delayRender(`mapa ${nombre}`, { timeoutInMilliseconds: 60000 })));
  useEffect(() => {
    if (datos) return;
    fetch(staticFile(`mapas/${nombre}/mapa.json`))
      .then((r) => r.json())
      .then((j: MapaDatos) => { CACHE.set(nombre, j); setDatos(j); if (espera !== null) continueRender(espera); })
      .catch((e) => cancelRender(e));
  }, [datos, espera, nombre]);
  return datos;
};

const R = 6378137;
/** lon/lat → píxel de la imagen del mapa (Mercator, como el satélite). */
export const aPixel = (m: MapaDatos, lon: number, lat: number): [number, number] => {
  const x = R * (lon * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
  const [x0, y0, x1, y1] = m.merc;
  return [((x - x0) / (x1 - x0)) * m.ancho, ((y1 - y) / (y1 - y0)) * m.alto];
};

/** La cámara del mapa: mirando a lon/lat, con «grados» de longitud de lado a lado de la pantalla. */
export type CamMapa = { lon: number; lat: number; grados: number };
const camAPx = (m: MapaDatos, c: CamMapa) => {
  const [cx, cy] = aPixel(m, c.lon, c.lat);
  const pxPorGrado = m.ancho / (m.zona[2] - m.zona[0]);
  return { cx, cy, z: W / (c.grados * pxPorGrado) };
};

export type CapaMapa = { id: string; color: string; f: number; modo?: "aparece" | "crece" | "dibuja"; etiqueta?: string; fe?: number; op?: number;
  /** El país con cara (la referencia): «feliz», «malo», «enfado», «susto» o «muerto» (ojos en X). fc: 0→1, cuándo sale. */
  cara?: string; fc?: number; caraPos?: [number, number];
  /** El territorio se rompe en trozos de colores que se separan (un reino que se desintegra). 0→1. */
  rompe?: number };
/** Oscurecer todo menos una zona (un territorio o un círculo): el foco del plano. f: 0→1. */
export type FocoMapa = { capa?: string; lon?: number; lat?: number; radio?: number; f: number };
/** Comparar tamaños : la silueta de un territorio copiada N veces, numerada, en los puntos que se den. */
export type CopiasMapa = { capa: string; puntos: [number, number][]; f: number; color?: string; escala?: number };
/** Un barco (drakar, galeón…) que navega por una ruta curva dejando estela. f: 0→1, lo navegado. */
export type BarcoMapa = { de: [number, number]; a: [number, number]; f: number; color?: string; curva?: number; vela?: string; flota?: number };
export type PinMapa = { lon: number; lat: number; nombre?: string; f: number; aro?: boolean; izquierda?: boolean };
export type FlechaMapa = { de: [number, number]; a: [number, number]; f: number; color?: string; curva?: number; puntos?: boolean; grueso?: number };
export type IconoMapa = { lon: number; lat: number; f: number; nodo: React.ReactNode; tam?: number };
/** Un ejército que marcha por una ruta de puntos (la referencia: la tropa con su estandarte). f: 0→1, lo andado. */
export type EjercitoMapa = { de: [number, number]; a: [number, number]; f: number; color?: string; curva?: number; banderas?: number };
/** Un asedio: un corro de soldados (y tiendas) que se va llenando alrededor de un sitio. */
export type AsedioMapa = { lon: number; lat: number; f: number; color?: string };
/** Un fuego con su columna de humo (una ciudad que arde, iglesias quemadas). */
export type FuegoMapa = { lon: number; lat: number; f: number; tam?: number };

type Props = {
  tema: Tema; mapa: string; cam: CamMapa; hasta?: CamMapa; u?: number; // u: 0..1, cuánto ha viajado la cámara
  capas?: CapaMapa[]; pins?: PinMapa[]; flechas?: FlechaMapa[]; iconos?: IconoMapa[]; fecha?: string; frame: number;
  ejercitos?: EjercitoMapa[]; asedios?: AsedioMapa[]; fuegos?: FuegoMapa[];
  foco?: FocoMapa; copias?: CopiasMapa[]; barcos?: BarcoMapa[];
  /** Lo que tiene que verse entero y centrado al empezar (ini) y al acabar (fin) el plano: puntos lon/lat o
   *  territorios. La cámara del plan se abre y se recoloca lo justo para que quepa (ver encuadrar). */
  importa?: { ini: Importa[]; fin: Importa[] };
  /** La franja de pantalla libre (sin la mascota): de x0 a x1. */
  libre?: { x0: number; x1: number };
};
export type Importa = { lon: number; lat: number } | { capa: string };

// la caja (en píxeles del mapa) de cada territorio, sacada de su trazado una sola vez
const CAJAS = new Map<string, [number, number, number, number]>();
const cajaCapa = (m: MapaDatos, nombre: string, id: string) => {
  const k = `${nombre}:${id}`;
  if (!CAJAS.has(k)) {
    const d = m.capas[id]?.d;
    if (!d) return null;
    const c = cajaTerritorio(d, m.ancho);
    if (!c) return null;
    CAJAS.set(k, c as [number, number, number, number]);
  }
  return CAJAS.get(k)!;
};

/** Encuadrar (12-11-2026: «aquí no está centrado, cuidado con eso»: en la Armada de 1588 Inglaterra salía
 *  cortada arriba y España fuera). Dada la cámara del plan y lo que importa, se aleja lo justo para que todo quepa en
 *  la franja libre (con margen, y por debajo de la cajita de la fecha) y lo centra ahí. Si ya cabe, no la toca. */
const encuadrar = (m: MapaDatos, nombre: string, c: { cx: number; cy: number; z: number }, lista: Importa[], libre: { x0: number; x1: number }) => {
  if (!lista.length) return c;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of lista) {
    const b = "capa" in q ? cajaCapa(m, nombre, q.capa) : (() => { const [x, y] = aPixel(m, q.lon, q.lat); return [x, y, x, y] as [number, number, number, number]; })();
    if (!b) continue;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  if (!isFinite(x0)) return c;
  const MX = 70, ARRIBA = 120, ABAJO = 70; // margen a los lados; arriba, la fecha y los nombres de las chinchetas
  const L = libre.x0 + MX, R = libre.x1 - MX, T = ARRIBA, B = H - ABAJO;
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const zFit = Math.min(c.z, (R - L) / bw, (B - T) / bh);
  // el mapa no deja alejarse más de esto (si no, se vería su borde): si lo que importa no cabe ni así, se centra
  // igual y comprobar.mjs avisa de que hace falta un mapa más grande
  const zMin = Math.max(W / m.ancho, H / m.alto);
  const z = Math.max(zFit, zMin);
  // el centro: dentro de lo que deja ver todo, y lo más cerca posible del centro de lo que importa en la franja libre
  const cxMin = x1 - (R - W / 2) / z, cxMax = x0 + (W / 2 - L) / z;
  const cyMin = y1 - (B - H / 2) / z, cyMax = y0 + (H / 2 - T) / z;
  const centroX0 = (x0 + x1) / 2 - ((L + R) / 2 - W / 2) / z;
  const centroY0 = (y0 + y1) / 2 - ((T + B) / 2 - H / 2) / z;
  if (zFit < zMin) return { z, cx: centroX0, cy: centroY0 };
  const cabe = c.z === z && c.cx >= cxMin && c.cx <= cxMax && c.cy >= cyMin && c.cy <= cyMax;
  if (cabe) return c;
  const centroX = (x0 + x1) / 2 - ((L + R) / 2 - W / 2) / z; // lo que importa, en el centro de la franja libre
  const centroY = (y0 + y1) / 2 - ((T + B) / 2 - H / 2) / z;
  return { z, cx: Math.min(cxMax, Math.max(cxMin, centroX)), cy: Math.min(cyMax, Math.max(cyMin, centroY)) };
};

/** Un soldadito de mapa (unos 60 px de alto en pantalla, los pies en 0,0): cabeza redonda, casco, túnica del color
 *  del ejército y lanza. Las piernas van y vienen si «anda». mira = 1 a la derecha, -1 a la izquierda. */
const Soldadito: React.FC<{ tema: Tema; frame: number; anda: boolean; color: string; mira: number; fase: number; bandera?: boolean }> = ({ tema, frame, anda, color, mira, fase, bandera }) => {
  const t = tema.tinta;
  const paso = anda ? Math.sin(frame * 0.5 + fase) * 8 : 0;
  const bote = anda ? Math.abs(Math.cos(frame * 0.5 + fase)) * -2.5 : 0;
  const ola = Math.sin(frame * 0.25 + fase);
  return (
    <g transform={`scale(${mira}, 1)`}>
      <ellipse cx={0} cy={1} rx={11} ry={3.5} fill="#000" opacity={0.35} />
      <g transform={`translate(0, ${bote})`}>
        <path d={`M -2 -20 L ${-4 + paso} 0 M 2 -20 L ${4 - paso} 0`} stroke={t} strokeWidth={3.2} strokeLinecap="round" />
        {bandera ? (
          <g>
            <path d="M 8 -26 L 8 -78" stroke="#6b4425" strokeWidth={3.2} strokeLinecap="round" />
            <path d={`M 8 -77 Q 20 ${-80 + ola * 3} 32 -77 L 32 ${-59 + ola * 2} Q 20 ${-62 + ola * 3} 8 -59 Z`} fill={color} stroke={t} strokeWidth={2} strokeLinejoin="round" />
          </g>
        ) : (
          <g>
            <path d="M 8 -14 L 13 -66" stroke="#6b4425" strokeWidth={2.8} strokeLinecap="round" />
            <path d="M 13 -74 L 10 -64 L 16 -64 Z" fill="#c9ced6" stroke={t} strokeWidth={1.5} strokeLinejoin="round" />
          </g>
        )}
        <path d="M -8 -36 L 8 -36 L 9 -18 L -9 -18 Z" fill={tono(color, -0.2)} stroke={t} strokeWidth={2} strokeLinejoin="round" />
        <path d={`M 4 -32 L ${bandera ? 8 : 9} -24`} stroke={t} strokeWidth={3} strokeLinecap="round" />
        <circle cx={0} cy={-44} r={9} fill={tema.piel} stroke={t} strokeWidth={2} />
        <path d="M -9.5 -45 A 9.5 9.5 0 0 1 9.5 -45 Z" fill="#9aa1ab" stroke={t} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={3.5} cy={-42} r={1.6} fill={t} />
      </g>
    </g>
  );
};

/** Punto y dirección de una ruta curva (cuadrática) de A a B, como las flechas. */
const rutaCurva = (x1: number, y1: number, x2: number, y2: number, cu: number) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const qx = (x1 + x2) / 2 - (dy / L) * L * cu, qy = (y1 + y2) / 2 + (dx / L) * L * cu;
  const en = (t: number) => ({
    x: (1 - t) ** 2 * x1 + 2 * (1 - t) * t * qx + t * t * x2,
    y: (1 - t) ** 2 * y1 + 2 * (1 - t) * t * qy + t * t * y2,
    dx: 2 * (1 - t) * (qx - x1) + 2 * t * (x2 - qx),
  });
  return { en, L };
};

const pop = (f: number) => (f <= 0 ? 0 : CURVA.llega(clamp(f)));


/** La cara de un país: dos ojos y una boca grandes en el centro del territorio (tamaño fijo en pantalla). */
const CaraPais: React.FC<{ tema: Tema; cara: string; frame: number }> = ({ tema, cara, frame }) => {
  const t = tema.tinta, b = "#ffffff";
  const parpadeo = cara !== "muerto" && frame % 96 < 4;
  const ojo = (x: number) => {
    if (cara === "muerto") return <path key={x} d={`M ${x - 16} -16 L ${x + 16} 16 M ${x + 16} -16 L ${x - 16} 16`} stroke={t} strokeWidth={9} strokeLinecap="round" />;
    if (parpadeo) return <path key={x} d={`M ${x - 18} 0 L ${x + 18} 0`} stroke={t} strokeWidth={8} strokeLinecap="round" />;
    const r = cara === "susto" ? 24 : 20;
    return <g key={x}><ellipse cx={x} cy={0} rx={r} ry={r * 1.15} fill={b} stroke={t} strokeWidth={6} /><circle cx={x + (cara === "malo" ? 4 : 0)} cy={cara === "susto" ? -2 : 3} r={cara === "susto" ? 6 : 9} fill={t} /></g>;
  };
  const cejas = cara === "enfado" || cara === "malo"
    ? <path d="M -70 -46 L -24 -28 M 70 -46 L 24 -28" stroke={t} strokeWidth={9} strokeLinecap="round" /> : null;
  const boca = cara === "feliz" ? <path d="M -40 44 Q 0 86 40 44" fill="none" stroke={t} strokeWidth={9} strokeLinecap="round" />
    : cara === "malo" ? <g><path d="M -58 40 Q 0 104 58 40 Z" fill={t} />{[-36, -12, 12, 36].map((x) => <path key={x} d={`M ${x - 9} ${46 + Math.abs(x) * -0.12} L ${x} ${66} L ${x + 9} ${46 + Math.abs(x) * -0.12} Z`} fill={b} />)}</g>
    : cara === "enfado" ? <path d="M -36 66 Q 0 40 36 66" fill="none" stroke={t} strokeWidth={9} strokeLinecap="round" />
    : cara === "susto" ? <ellipse cx={0} cy={58} rx={18} ry={24} fill={t} />
    : cara === "muerto" ? <path d="M -34 60 Q -17 48 0 60 Q 17 72 34 60" fill="none" stroke={t} strokeWidth={8} strokeLinecap="round" />
    : <path d="M -30 54 L 30 54" stroke={t} strokeWidth={8} strokeLinecap="round" />;
  return <g>{cejas}{ojo(-44)}{ojo(44)}{boca}</g>;
};

/** Barco de mapa (unos 70 px): casco, vela con rayas y remos; se balancea. */
const BarquitoMapa: React.FC<{ tema: Tema; frame: number; color: string; vela: string; mira: number; fase: number }> = ({ tema, frame, color, vela, mira, fase }) => {
  const t = tema.tinta, bal = Math.sin(frame * 0.12 + fase) * 4;
  return (
    <g transform={`scale(${mira}, 1) rotate(${bal})`}>
      <path d="M -46 -6 Q -40 14 0 14 Q 40 14 50 -12 L 56 -22 L 44 -8 L -40 -8 L -52 -24 Z" fill={color} stroke={t} strokeWidth={3} strokeLinejoin="round" />
      {[-26, -10, 6, 22].map((x) => <circle key={x} cx={x} cy={-2} r={4.5} fill="#e8b74a" stroke={t} strokeWidth={1.5} />)}
      <path d="M 0 -8 L 0 -70" stroke={t} strokeWidth={3.5} />
      <path d="M -26 -64 L 26 -64 L 22 -20 L -22 -20 Z" fill={vela} stroke={t} strokeWidth={3} strokeLinejoin="round" />
      {[-12, 0, 12].map((x) => <path key={x} d={`M ${x} -63 L ${x * 0.85} -21`} stroke="#c8322b" strokeWidth={5} opacity={0.85} />)}
    </g>
  );
};

export const Mapa: React.FC<Props> = ({ tema, mapa, cam, hasta, u = 0, capas = [], pins = [], flechas = [], iconos = [], fecha, frame, ejercitos = [], asedios = [], fuegos = [], foco, copias = [], barcos = [], importa, libre = { x0: 0, x1: W } }) => {
  const m = useMapa(mapa);
  if (!m) return <AbsoluteFill style={{ background: "#16325c" }} />;
  const a = encuadrar(m, mapa, camAPx(m, cam), importa?.ini ?? [], libre);
  const b = encuadrar(m, mapa, hasta ? camAPx(m, hasta) : camAPx(m, cam), importa?.fin ?? [], libre);
  // la cámara arranca ya y frena al llegar (con «suave» tardaba en moverse y el plano parecía quieto)
  const k = CURVA.rapida(clamp(u));
  // la cámara viaja en escala logarítmica (el zoom se nota parejo) y flota un poco
  const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), k)) * (1 + Math.sin(frame * 0.01) * 0.004);
  const cx = lerp(a.cx, b.cx, k) + Math.sin(frame * 0.013) * 3 / z;
  const cy = lerp(a.cy, b.cy, k) + Math.cos(frame * 0.011) * 2 / z;
  // nunca enseña el borde de la imagen: zoom mínimo y centro dentro
  const zz = Math.max(z, W / m.ancho, H / m.alto);
  const mx = W / 2 / zz, my = H / 2 / zz;
  const ccx = Math.min(m.ancho - mx, Math.max(mx, cx)), ccy = Math.min(m.alto - my, Math.max(my, cy));
  const tx = W / 2 - ccx * zz, ty = H / 2 - ccy * zz;
  const s = 1 / zz; // para que chinchetas, flechas y letras tengan tamaño fijo en pantalla
  const atlas = tema.mapa === "atlas";
  const mar = "#a9bdb4", papel = "#ecdfbd";
  const capaFill = (c: string) => (atlas ? mezcla(c, papel, 0.25) : c);

  return (
    <AbsoluteFill style={{ background: atlas ? mar : "#0f2b57", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: m.ancho, height: m.alto, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${zz})` }}>
        {!atlas && <Img src={staticFile(`mapas/${mapa}/satelite.jpg`)} style={{ width: m.ancho, height: m.alto, filter: tema.mapaFiltro, display: "block" }} />}
        {/* el mar del satélite es casi negro lejos de la costa: en la referencia es azul vivo. Velo azul en «screen» solo sobre el mar */}
        {!atlas && (
          <svg width={m.ancho} height={m.alto} viewBox={`0 0 ${m.ancho} ${m.alto}`} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "screen" }}>
            <path d={`M 0 0 H ${m.ancho} V ${m.alto} H 0 Z ${m.tierra}`} fillRule="evenodd" fill="#2a6fc4" opacity={tema.dibujo === "papel" ? 0.3 : 0.5} />
          </svg>
        )}
        <svg width={m.ancho} height={m.alto} viewBox={`0 0 ${m.ancho} ${m.alto}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <DefsTerra tema={tema} />
          <defs>
            <clipPath id={`tierra-${mapa}`}><path d={m.tierra} /></clipPath>
            {capas.filter((c) => c.modo === "crece").map((c) => {
              const ce = m.capas[c.id]?.centro ?? [m.ancho / 2, m.alto / 2];
              return <mask key={c.id} id={`crece-${c.id}`} maskUnits="userSpaceOnUse" x={-m.ancho} y={-m.alto} width={m.ancho * 3} height={m.alto * 3}><circle cx={ce[0]} cy={ce[1]} r={Math.max(m.ancho, m.alto) * 0.7 * CURVA.suave(clamp(c.f))} fill="#fff" /></mask>;
            })}
          </defs>
          {!atlas && m.lagos && <path d={m.lagos} fill="#2f74c4" opacity={0.9} />}
          {atlas && (
            <g>
              {/* líneas del agua alrededor de la costa, como en los atlas grabados */}
              {[22, 14, 7].map((w, i) => <path key={i} d={m.tierra} fill="none" stroke={tema.tinta} strokeWidth={w * s} opacity={0.08 + i * 0.05} />)}
              <path d={m.tierra} fill={papel} stroke={tema.tinta} strokeWidth={1.8 * s} />
            </g>
          )}
          <g clipPath={`url(#tierra-${mapa})`}>
            {capas.map((c) => {
              const d = m.capas[c.id]?.d;
              if (!d || c.f <= 0 || (c.rompe ?? 0) > 0) return null;
              const modo = c.modo ?? "aparece";
              const op = (c.op ?? tema.capaOpacidad) * (modo === "aparece" ? clamp(c.f * 1.6) : 1);
              // El territorio puede ser varias provincias juntas: el borde se pinta primero (el doble de ancho) y el relleno
              // opaco encima, y la transparencia va al grupo; así solo queda el borde de fuera, sin las rayas de dentro.
              const oscuroBorde = tema.dibujo === "cabezon" || atlas;
              return (
                <g key={c.id} mask={modo === "crece" ? `url(#crece-${c.id})` : undefined} opacity={op}>
                  {tema.capaBorde > 0 && (
                    <path d={d} fill="none" stroke={oscuroBorde ? tema.capaBordeColor : tono(c.color, 0.35)} strokeWidth={tema.capaBorde * 2 * s} strokeLinejoin="round"
                      pathLength={modo === "dibuja" ? 1 : undefined} strokeDasharray={modo === "dibuja" ? `${clamp(c.f / 0.6)} 1` : undefined} />
                  )}
                  <path d={d} fill={capaFill(c.color)} opacity={modo === "dibuja" ? clamp((c.f - 0.6) / 0.4) : 1} />
                </g>
              );
            })}
          </g>
          {/* territorios que se rompen en trozos (la referencia: Kiev se parte en reinos de colores con rayas blancas) */}
          {capas.filter((c) => (c.rompe ?? 0) > 0 && c.f > 0 && m.capas[c.id]?.d).map((c) => {
            const d = m.capas[c.id].d, ce = c.caraPos ? aPixel(m, c.caraPos[0], c.caraPos[1]) : m.capas[c.id].centro ?? [m.ancho / 2, m.alto / 2];
            const N = 5, R0 = Math.max(m.ancho, m.alto) * 2, k0 = clamp(c.rompe!);
            const sep = CURVA.llega(k0) * 12 * s, tiembla = k0 < 0.35 ? Math.sin(frame * 2.1) * 5 * s * (1 - k0 / 0.35) : 0;
            const tonos = ["#e8c25a", "#8fbf6a", "#d9785a", "#7fa8d9", "#b98ad0"];
            const angs = Array.from({ length: N }, (_, k) => (k / N) * Math.PI * 2 + 0.5 + Math.sin(k * 2.3) * 0.25);
            const cid = `rompe-${mapa}-${c.id}`;
            return (
              <g key={`r${c.id}`} transform={`translate(${tiembla}, 0)`}>
                <clipPath id={cid}><path d={d} /></clipPath>
                {angs.map((a0, k) => {
                  const a1 = angs[(k + 1) % N] + (k === N - 1 ? Math.PI * 2 : 0), am = (a0 + a1) / 2;
                  const wid = `${cid}-${k}`;
                  const col = mezcla(c.color, tonos[k % tonos.length], clamp(k0 * 2));
                  return (
                    <g key={k} transform={`translate(${Math.cos(am) * sep}, ${Math.sin(am) * sep})`}>
                      <clipPath id={wid}><path d={`M ${ce[0]} ${ce[1]} L ${ce[0] + Math.cos(a0) * R0} ${ce[1] + Math.sin(a0) * R0} L ${ce[0] + Math.cos(am) * R0 * 1.4} ${ce[1] + Math.sin(am) * R0 * 1.4} L ${ce[0] + Math.cos(a1) * R0} ${ce[1] + Math.sin(a1) * R0} Z`} /></clipPath>
                      <g clipPath={`url(#${wid})`}><path d={d} fill={col} opacity={0.88} /></g>
                    </g>
                  );
                })}
                {/* las rayas blancas entre los trozos, recortadas al territorio */}
                <g clipPath={`url(#${cid})`} opacity={clamp(k0 * 3)}>
                  {angs.map((a, k) => <path key={k} d={`M ${ce[0]} ${ce[1]} L ${ce[0] + Math.cos(a) * R0} ${ce[1] + Math.sin(a) * R0}`} stroke="#ffffff" strokeWidth={7 * s} strokeLinecap="round" />)}
                </g>
              </g>
            );
          })}
          {/* el foco: todo oscuro menos la zona de la que se habla */}
          {foco && foco.f > 0 && (() => {
            const fid = `foco-${mapa}`;
            const hueco = foco.capa && m.capas[foco.capa]?.d ? <path d={m.capas[foco.capa].d} fill="#000" />
              : foco.lon !== undefined ? (() => { const [x, y] = aPixel(m, foco.lon!, foco.lat ?? 0); return <circle cx={x} cy={y} r={(foco.radio ?? 260) * s} fill="#000" />; })() : null;
            return (
              <g>
                <mask id={fid} maskUnits="userSpaceOnUse" x={-m.ancho} y={-m.alto} width={m.ancho * 3} height={m.alto * 3}>
                  <rect x={-m.ancho} y={-m.alto} width={m.ancho * 3} height={m.alto * 3} fill="#fff" />{hueco}
                </mask>
                <rect x={-m.ancho} y={-m.alto} width={m.ancho * 3} height={m.alto * 3} fill="#0a0f1c" opacity={0.68 * CURVA.suave(clamp(foco.f))} mask={`url(#${fid})`} />
              </g>
            );
          })()}
          {/* comparar tamaños: la silueta de un país, copiada y numerada */}
          {copias.map((cp, i) => {
            const cap = m.capas[cp.capa];
            if (!cap?.d || cp.f <= 0) return null;
            const ce = cap.centro ?? [0, 0];
            const col = cp.color ?? "#e8b830";
            return (
              <g key={`cp${i}`}>
                {cp.puntos.map((pt, k) => {
                  const q = clamp((cp.f - k / cp.puntos.length * 0.8) * 4);
                  if (q <= 0) return null;
                  const [x, y] = aPixel(m, pt[0], pt[1]);
                  const e = (cp.escala ?? 1) * pop(q);
                  return (
                    <g key={k}>
                      <g transform={`translate(${x}, ${y}) scale(${e}) translate(${-ce[0]}, ${-ce[1]})`}>
                        <path d={cap.d} fill={col} stroke={tema.tinta} strokeWidth={4 * s / Math.max(0.2, e)} strokeLinejoin="round" opacity={0.92} />
                      </g>
                      <g transform={`translate(${x}, ${y}) scale(${s * pop(q)})`}><Texto tema={tema} x={0} y={18} t={String(k + 1)} tam={58} gorda color="#ffffff" borde="rgba(20,20,20,0.8)" /></g>
                    </g>
                  );
                })}
              </g>
            );
          })}
          {/* barcos que navegan dejando estela */}
          {barcos.map((bc, i) => {
            if (bc.f <= 0) return null;
            const [x1, y1] = aPixel(m, bc.de[0], bc.de[1]);
            const [x2, y2] = aPixel(m, bc.a[0], bc.a[1]);
            const r = rutaCurva(x1, y1, x2, y2, bc.curva ?? 0.12);
            const t = CURVA.suave(clamp(bc.f));
            const cab = r.en(t);
            const mira = cab.dx >= 0 ? 1 : -1;
            const nPts = Math.max(8, Math.round((r.L / s) / 18));
            const pts = Array.from({ length: nPts + 1 }, (_, k) => k / nPts).filter((q) => q <= t);
            const flota = ([[0, 0], [-60, -26], [-62, 30], [-120, 4]] as [number, number][]).slice(0, Math.max(1, Math.min(4, bc.flota ?? 1)));
            return (
              <g key={`bc${i}`}>
                {pts.map((q, k) => { const pp = r.en(q); return <path key={k} d={`M ${pp.x - 7 * s} ${pp.y} L ${pp.x + 7 * s} ${pp.y}`} stroke="#ffffff" strokeWidth={4 * s} strokeLinecap="round" opacity={0.75} />; })}
                <g transform={`translate(${cab.x}, ${cab.y}) scale(${s * pop(bc.f * 6)})`}>
                  {flota.slice().sort((a, b) => a[1] - b[1]).map(([fx, fy], k) => (
                    <g key={k} transform={`translate(${fx * mira}, ${fy})`}><BarquitoMapa tema={tema} frame={frame} color={bc.color ?? "#7a5230"} vela={bc.vela ?? "#f4efe3"} mira={mira} fase={k * 1.7 + i} /></g>
                  ))}
                </g>
              </g>
            );
          })}
          {flechas.map((fl, i) => {
            if (fl.f <= 0) return null;
            const [x1, y1] = aPixel(m, fl.de[0], fl.de[1]);
            const [x2, y2] = aPixel(m, fl.a[0], fl.a[1]);
            const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
            const cu = fl.curva ?? 0.25;
            const qx = (x1 + x2) / 2 - (dy / L) * L * cu, qy = (y1 + y2) / 2 + (dx / L) * L * cu;
            const t = CURVA.rapida(clamp(fl.f));
            // punto y dirección al final del tramo dibujado (curva cuadrática)
            const px = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * qx + t * t * x2, py = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * qy + t * t * y2;
            const tdx = 2 * (1 - t) * (qx - x1) + 2 * t * (x2 - qx), tdy = 2 * (1 - t) * (qy - y1) + 2 * t * (y2 - qy);
            const ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
            const col = fl.color ?? (atlas ? tema.acento : "#ffffff");
            const gr = (fl.grueso ?? (tema.dibujo === "cabezon" ? 14 : 10)) * s;
            return (
              <g key={i}>
                <path d={`M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`} fill="none" stroke={tema.dibujo === "cabezon" ? tema.tinta : "rgba(0,0,0,0.25)"} strokeWidth={gr + (tema.dibujo === "cabezon" ? 8 : 4) * s} pathLength={1} strokeDasharray={`${t} 1`} strokeLinecap="round" />
                <path d={`M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`} fill="none" stroke={col} strokeWidth={gr} pathLength={1} strokeDasharray={fl.puntos ? `0.012 0.012` : `${t} 1`} strokeLinecap="round" opacity={fl.puntos ? clamp(t * 3) : 1} />
                <g transform={`translate(${px}, ${py}) rotate(${ang}) scale(${s})`}>
                  <path d="M -6 -22 L 30 0 L -6 22 Z" fill={col} stroke={tema.dibujo === "cabezon" ? tema.tinta : "rgba(0,0,0,0.3)"} strokeWidth={tema.dibujo === "cabezon" ? 5 : 2} strokeLinejoin="round" />
                </g>
              </g>
            );
          })}
          {fuegos.map((fu, i) => {
            if (fu.f <= 0) return null;
            const [x, y] = aPixel(m, fu.lon, fu.lat);
            const p = pop(fu.f) * (fu.tam ?? 1) * 1.35;
            return (
              <g key={`fu${i}`} transform={`translate(${x}, ${y}) scale(${s * p})`}>
                {/* humo: bocanadas grises que suben y se van con el viento */}
                {[0, 1, 2, 3, 4, 5].map((k) => {
                  const q = ((frame * 0.9 + k * 13 + i * 7) % 78) / 78;
                  return <circle key={k} cx={q * 38 + Math.sin(frame * 0.05 + k) * 5} cy={-34 - q * 140} r={11 + q * 26} fill={k % 2 ? "#44474b" : "#5a5e63"} opacity={(1 - q) * 0.78 * clamp(fu.f * 2)} />;
                })}
                {[[-14, 0.8, 0], [0, 1.15, 1.7], [14, 0.9, 3.1]].map(([dx, k, fase], j) => {
                  const lm = 1 + Math.sin(frame * 0.45 + fase + i) * 0.16;
                  return (
                    <g key={`l${j}`} transform={`translate(${dx}, 0) scale(${k}, ${k * lm})`}>
                      <path d="M 0 0 C -14 -4 -14 -22 -4 -34 C -2 -24 6 -26 4 -40 C 14 -30 16 -8 0 0 Z" fill="#e8501f" stroke="#6b2a10" strokeWidth={2} strokeLinejoin="round" />
                      <path d="M 0 -2 C -7 -4 -7 -14 -2 -20 C 0 -14 4 -15 3 -24 C 8 -16 8 -6 0 -2 Z" fill="#f7c33a" />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {asedios.map((as, i) => {
            if (as.f <= 0) return null;
            const [x, y] = aPixel(m, as.lon, as.lat);
            const col = as.color ?? "#c8322b";
            const N = 12, R0 = 78;
            const puestos = Array.from({ length: N }, (_, k) => {
              const ang = (k / N) * Math.PI * 2 + 0.2;
              return { k, sx: Math.cos(ang) * R0, sy: Math.sin(ang) * R0 * 0.62 };
            }).sort((a, b) => a.sy - b.sy);
            return (
              <g key={`as${i}`} transform={`translate(${x}, ${y}) scale(${s})`}>
                <ellipse cx={0} cy={0} rx={R0 + 6} ry={(R0 + 6) * 0.62} fill="none" stroke={col} strokeWidth={3} strokeDasharray="6 8" opacity={clamp(as.f * 3) * 0.8} />
                {[[-112, -26], [108, -18], [0, -84]].map(([tx, ty], j) => {
                  const pt = pop((as.f - j * 0.12) * 3);
                  if (pt <= 0) return null;
                  return (
                    <g key={`t${j}`} transform={`translate(${tx}, ${ty}) scale(${pt})`}>
                      <path d="M -20 0 L 0 -30 L 20 0 Z" fill="#efe3c6" stroke={tema.tinta} strokeWidth={2} strokeLinejoin="round" />
                      <path d="M 0 -30 L 0 0" stroke={tema.tinta} strokeWidth={1.5} />
                      <path d="M 0 -30 L 0 -42 L 12 -38 L 0 -34" fill={col} stroke={tema.tinta} strokeWidth={1.2} />
                    </g>
                  );
                })}
                {puestos.map(({ k, sx, sy }) => {
                  const q = clamp((as.f - k / N * 0.85) * 6);
                  if (q <= 0) return null;
                  return (
                    <g key={`s${k}`} transform={`translate(${sx}, ${sy - (1 - q) * 20}) scale(${0.62 * pop(q)})`} opacity={q}>
                      <Soldadito tema={tema} frame={frame} anda={false} color={col} mira={sx > 0 ? -1 : 1} fase={k} bandera={k === 3} />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {ejercitos.map((ej, i) => {
            if (ej.f <= 0) return null;
            const [x1, y1] = aPixel(m, ej.de[0], ej.de[1]);
            const [x2, y2] = aPixel(m, ej.a[0], ej.a[1]);
            const r = rutaCurva(x1, y1, x2, y2, ej.curva ?? 0.15);
            const t = clamp(ej.f);
            const col = ej.color ?? "#c8322b";
            const anda = ej.f > 0 && ej.f < 1;
            // la ruta de puntos, dibujada hasta donde ha llegado la tropa (un punto cada ~22 px de pantalla)
            const nPts = Math.max(8, Math.round((r.L / s) / 22));
            const pts = Array.from({ length: nPts + 1 }, (_, k) => k / nPts).filter((q) => q <= t);
            const cab = r.en(t);
            const mira = cab.dx >= 0 ? 1 : -1;
            const formacion: [number, number, boolean][] = [[0, 0, false], [-24, -10, true], [-26, 12, false], [-50, -2, false], [-52, 20, false]];
            const nb = Math.max(1, Math.min(2, ej.banderas ?? 1));
            return (
              <g key={`ej${i}`}>
                {pts.map((q, k) => { const pp = r.en(q); return <circle key={k} cx={pp.x} cy={pp.y} r={4.5 * s} fill="#ffffff" stroke="rgba(0,0,0,0.35)" strokeWidth={1.5 * s} />; })}
                <g transform={`translate(${cab.x}, ${cab.y}) scale(${s * pop(ej.f * 6)})`}>
                  {formacion.slice().sort((a, b) => a[1] - b[1]).map(([fx, fy, b], k) => (
                    <g key={k} transform={`translate(${fx * mira}, ${fy})`}>
                      <Soldadito tema={tema} frame={frame} anda={anda} color={col} mira={mira} fase={k * 1.3} bandera={b || (nb > 1 && k === 4)} />
                    </g>
                  ))}
                </g>
              </g>
            );
          })}
          {capas.filter((c) => c.etiqueta && (c.fe ?? c.f) > 0.3).map((c) => {
            const ce = m.capas[c.id]?.centro;
            if (!ce) return null;
            const p = pop(((c.fe ?? c.f) - 0.3) / 0.4);
            return (
              <g key={`e${c.id}`} transform={`translate(${ce[0]}, ${ce[1]}) scale(${s * p})`}>
                <Texto tema={tema} x={0} y={12} t={c.etiqueta!} tam={tema.dibujo === "cabezon" ? 54 : 50} gorda={tema.dibujo === "cabezon"}
                  color={atlas ? tema.oscuro : tema.claro} borde={atlas ? undefined : "rgba(20,20,20,0.7)"} />
              </g>
            );
          })}
          {capas.filter((c) => c.cara && c.f > 0 && (c.fc ?? c.f) > 0).map((c) => {
            const ce = c.caraPos ? aPixel(m, c.caraPos[0], c.caraPos[1]) : m.capas[c.id]?.centro;
            if (!ce) return null;
            const p = pop(((c.fc ?? c.f)) * 1.4);
            return <g key={`c${c.id}`} transform={`translate(${ce[0]}, ${ce[1] - (c.etiqueta ? 100 : 0) * s}) scale(${s * p * 0.8})`}><CaraPais tema={tema} cara={c.cara!} frame={frame} /></g>;
          })}
          {iconos.map((ic, i) => {
            if (ic.f <= 0) return null;
            const [x, y] = aPixel(m, ic.lon, ic.lat);
            const p = pop(ic.f);
            return <g key={`i${i}`} transform={`translate(${x}, ${y - (1 - clamp(ic.f * 2)) * 40 * s}) scale(${s * p * (ic.tam ?? 0.7)})`}>{ic.nodo}</g>;
          })}
          {pins.map((pn, i) => {
            if (pn.f <= 0) return null;
            const [x, y] = aPixel(m, pn.lon, pn.lat);
            const p = pop(pn.f);
            const caida = (1 - clamp(pn.f * 2.5)) * 60;
            return (
              <g key={`p${i}`} transform={`translate(${x}, ${y}) scale(${s})`}>
                <ellipse cx={0} cy={0} rx={10 * p} ry={4 * p} fill="#000" opacity={0.35} />
                {pn.aro && [0, 1].map((k) => { const q = ((frame + k * 22) % 44) / 44; return <circle key={k} cx={0} cy={0} r={18 + q * 46} fill="none" stroke={tema.pin} strokeWidth={5 * (1 - q)} opacity={clamp(pn.f * 2) * (1 - q)} />; })}
                <g transform={`translate(0, ${-caida}) scale(${p})`}>
                  <path d="M 0 0 C -4 -10 -16 -20 -16 -32 A 16 16 0 1 1 16 -32 C 16 -20 4 -10 0 0 Z" fill={tema.pin} stroke={tema.dibujo === "cabezon" ? tema.tinta : "rgba(60,40,0,0.6)"} strokeWidth={tema.dibujo === "cabezon" ? 5 : 2} />
                  <circle cx={0} cy={-32} r={6} fill={atlas ? tema.claro : "#5a4100"} />
                </g>
                {pn.nombre && (
                  <Texto tema={tema} x={pn.izquierda ? -24 : 24} y={-22} t={pn.nombre} tam={42} ancla={pn.izquierda ? "end" : "start"} op={clamp((pn.f - 0.25) * 3)}
                    color={atlas ? tema.oscuro : tema.pin} borde={atlas ? undefined : "rgba(20,20,20,0.75)"} />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {fecha && <Fecha tema={tema} texto={fecha} />}
    </AbsoluteFill>
  );
};

/** El año arriba a la izquierda (en la referencia, una cajita gris semitransparente con letra pequeña). */
export const Fecha: React.FC<{ tema: Tema; texto: string }> = ({ tema, texto }) => {
  const atlas = tema.mapa === "atlas";
  const ancho = 44 + texto.length * 24;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      <g transform="translate(40, 34)">
        <rect x={0} y={0} width={ancho} height={60} rx={tema.dibujo === "cabezon" ? 10 : 6}
          fill={atlas ? "#efe2c4" : tema.dibujo === "cabezon" ? "#26201c" : "rgba(40,40,40,0.55)"} stroke={atlas ? tema.tinta : "none"} strokeWidth={2} />
        <Texto tema={tema} x={ancho / 2} y={42} t={texto} tam={38} gorda={tema.dibujo === "cabezon"} color={atlas ? tema.oscuro : "#ffffff"} />
      </g>
    </svg>
  );
};
