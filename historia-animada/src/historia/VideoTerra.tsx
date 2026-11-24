// La composición «Video» de la plantilla : lee public/videos/<id>/plan.json y voz.tiempos.json, ancla
// cada cosa a la voz (resolverTerra.mjs) y pinta plano a plano. Seis tipos de plano: mapa, narrador, escena, archivo,
// papel y capitulo (ver mi-oficina/estilos/terra-explica/MONTAR.md). La música y los efectos se apartan cuando habla
// la voz. Lección de render: la voz NO va en el render (se pega con ffmpeg en sonido.mjs, en su segundo exacto).
import React from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, getRemotionEnvironment, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { POSE, Pose } from "../motor/Caballero";
import { clamp, CURVA } from "../motor/anim";
import { estadoActor } from "../plan/gestos";
import { ALTO_LOMO, Caballo, Cosa } from "./cosas";
import { Forma, Texto } from "./forma";
import { CamMapa, Fecha, Importa, Mapa } from "./Mapa";
import { GUIA, Persona, TRAJES, Traje } from "./Persona";
import { Decorado, DecoradoDelante, SUELO_DE } from "./decorados";
import { Multitud } from "./Multitud";
import { ALTO_MAX, GENTE, PERSONA, REAL } from "./medidas";
import CAJAS from "./cajas-cosas.json";
import { Pais } from "./Pais";
import { BOC_TAM, Bocadillo, FondoNarrador, Papel, SVGTerra, Tarjeta } from "./escenario";
import { cargarLetras, FPS, H, Tema, TEMA_CANAL, TEMAS, Variante, W } from "./tema";
// módulo JS compartido con comprobar-terra.mjs
import { resolverTerra } from "./resolverTerra.mjs";

export const COLORES: Record<string, string> = {
  naranja: "#f08a24", rojo: "#d8322a", azul: "#3c7fd0", verde: "#2fa35a", morado: "#8e57c9", amarillo: "#f2c230",
  rosa: "#e0679b", turquesa: "#20a8a0", marron: "#9a6a3c", gris: "#8a8f96", granate: "#8e1f2b", celeste: "#6fb7e8",
};
const color = (c?: string) => (c ? COLORES[c] ?? c : COLORES.naranja);

type Palabra = { p: string; ini: number; fin: number };
type Accion = { t: number; hace?: string; ojos?: string; boca?: string; pose?: Partial<Pose>; a?: number; desde?: number; d?: number; lado?: number };
type Actor = { q: string; traje?: string; x: number; y?: number; s?: number; mira?: number; pose?: string | Partial<Pose>; ojos?: string; boca?: string; sentado?: boolean; lleva?: string; llevaI?: string; montado?: boolean | string; colores?: Partial<Traje>; acciones: Accion[] };
type Guia = { no?: boolean; lado?: "derecha" | "izquierda"; pose?: string | Partial<Pose>; ojos?: string; lleva?: string; acciones?: Accion[] };
type Item = { t: number; en?: string | number; [k: string]: unknown };
export type PlanoT = {
  n: number; ne?: number; ini: number; fin: number; en: string | number; tipo: "mapa" | "narrador" | "escena" | "archivo" | "papel" | "capitulo" | "portada";
  // mapa
  mapa?: string; encuadre?: boolean; cam?: CamMapa; hasta?: CamMapa; fecha?: string; capas?: Item[]; pins?: Item[]; flechas?: Item[]; iconos?: Item[]; ejercitos?: Item[]; asedios?: Item[]; fuegos?: Item[];
  foco?: Item; copias?: Item[]; barcos?: Item[];
  // narrador / papel
  cosas?: Item[]; titulo?: string; guia?: Guia | false;
  // escena
  decorado?: string; estilo?: string; cupula?: boolean; toma?: string; estandartes?: string; barco?: string; tormenta?: boolean; humo?: boolean; piramide?: boolean; noche?: boolean; atardecer?: boolean; actores?: Actor[]; bocadillos?: Item[]; zoom?: number;
  // archivo
  imagen?: string; pie?: string; modo?: "pantalla" | "tarjeta"; subtitulo?: string; // portada: imagen, titulo y subtitulo
  camara?: "general"; cambios?: Item[]; sinPapel?: boolean;
  multitud?: { n?: number; x0?: number; x1?: number; y?: number; color?: string; agita?: boolean; antorchas?: boolean; lanzas?: boolean };
  // capitulo
  numero?: number;
  rotulos?: Item[];
};
export type PlanT = { id: string; estilo?: Variante; capitulos?: string[]; planos: PlanoT[]; musica: { t: number; pista: string; volumen?: number }[]; duracion: number; avisos: string[]; palabras: Palabra[] };

type Props = { id: string; pista?: "todo" | "voz" | "fondo"; plan?: PlanT };

export const calcularVideoTerra: CalculateMetadataFunction<Props> = async ({ props }) => {
  const leer = async (n: string) => (await fetch(staticFile(`videos/${props.id}/${n}`))).json();
  const plan = await leer("plan.json");
  const tiempos = await leer("voz.tiempos.json");
  const r: PlanT = resolverTerra({ ...plan, id: plan.id ?? props.id }, tiempos); // sin «id» en el plan, el nombre de la carpeta
  r.avisos.forEach((a) => console.warn(a));
  return { durationInFrames: Math.ceil(r.duracion * FPS), props: { ...props, plan: r } };
};

const s = (v: number) => Math.round(v * FPS);
const CABALLO_ESCALA = 1.35; // el caballo, en proporción a los muñecos de cabeza grande (si no, parece un poni)
const aparece = (fAbs: number, t: number, d = 8) => clamp((fAbs - s(t)) / d); // 8 fotogramas: el «pop» de la referencia es rápido
const pose = (p?: string | Partial<Pose>): Pose => ({ ...POSE, ...(typeof p === "object" ? p : {}) });
const ojosDe = (o?: string) => (["normal", "felices", "cerrados", "susto", "entornados", "enfado"].includes(o ?? "") ? (o as "normal") : o === "apretados" ? "cerrados" : "normal");
const bocaDe = (b?: string) => (["nada", "linea", "sonrisa", "o", "abierta", "triste"].includes(b ?? "") ? (b as "linea") : b === "susto" ? "o" : "linea");
const trajeDe = (t?: string): Traje => TRAJES[t ?? "guia"] ?? GUIA;

/** ¿Está hablando la voz en este fotograma? (para la boca de la mascota). */
const hablaEn = (palabras: Palabra[], fAbs: number) => {
  const t = fAbs / FPS;
  let lo = 0, hi = palabras.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (palabras[m].fin + 0.05 < t) lo = m + 1;
    else if (palabras[m].ini - 0.05 > t) hi = m - 1;
    else return true;
  }
  return false;
};

/** La mascota (la guía de la plantilla): habla con la voz y hace los gestos que le pida el plano. */
/** Gestos que la mascota hace sola mientras habla (como el narrador de la referencia, que nunca está quieto): un golpe de cabeza
 *  o un ademán con la mano libre cada ~2,4 s en una palabra larga, lejos de los gestos que pide el plan. */
const gestosSolos = (palabras: Palabra[], ini: number, fin: number, pedidas: Accion[], lado: number): Accion[] => {
  const fuera: Accion[] = [];
  let ultimo = ini - 1;
  let k = 0;
  for (const w of palabras) {
    if (w.ini < ini + 0.5 || w.ini > fin - 0.6) continue;
    if (w.p.replace(/[^\p{L}\d]/gu, "").length < 5) continue;
    if (w.ini - ultimo < 2.4) continue;
    if (pedidas.some((a) => Math.abs(a.t - w.ini) < 1.3)) continue;
    fuera.push({ t: w.ini, hace: k++ % 2 ? "ademan" : "enfasis", lado });
    ultimo = w.ini;
  }
  return fuera;
};

const LaGuia: React.FC<{ tema: Tema; g: Guia; fAbs: number; palabras: Palabra[]; x: number; y: number; sc: number; mira: number; poseBase: Partial<Pose>; manoMapa?: "D" | "I"; rollo?: boolean; tramo?: [number, number] }> = ({ tema, g, fAbs, palabras, x, y, sc, mira, poseBase, manoMapa = "D", rollo = false, tramo }) => {
  // el mapa enrollado solo en los planos de mapa (en el gris, con los gestos, le atravesaba la cabeza); el plan puede pedir otra cosa con «lleva»
  const objeto = g.lleva ?? (rollo ? "mapa_enrollado" : undefined);
  const pedidas = (g.acciones ?? []) as Accion[];
  const solas = tramo ? gestosSolos(palabras, tramo[0], tramo[1], pedidas, mira < 0 ? -1 : 1) : [];
  const e = estadoActor({ q: "guia", x: 0, mira, pose: typeof g.pose === "object" ? { ...poseBase, ...g.pose } : poseBase, acciones: [...pedidas, ...solas] as never }, fAbs);
  return (
    <g transform={`translate(${x}, ${y}) scale(${sc})`}>
      <Persona tema={tema} traje={GUIA} frame={fAbs} semilla={3} habla={hablaEn(palabras, fAbs)} ojos={ojosDe(e.ojos ?? g.ojos)} pose={e.pose}
        lleva={objeto && manoMapa === "D" ? <Cosa id={objeto} tema={tema} f={fAbs} /> : undefined}
        llevaI={objeto && manoMapa === "I" ? <Cosa id={objeto} tema={tema} f={fAbs} /> : undefined} />
    </g>
  );
};

/** Lo que salta al lado del narrador (o sobre el papel): palabras, cifras, tarjetas, iconos e imágenes. */
const Cosas: React.FC<{ tema: Tema; items: Item[]; fAbs: number; id: string; zona: { x0: number; x1: number; yTexto: number; yVisual: number; yPalabra?: number } }> = ({ tema, items, fAbs, id, zona }) => {
  const textos = items.filter((c) => c.palabra || c.frase);
  const cifras = items.filter((c) => c.cifra);
  const visuales = items.filter((c) => c.tarjeta !== undefined || c.cosa || c.imagen || c.pais);
  const cx = (zona.x0 + zona.x1) / 2;
  // con pocas cosas, más grandes y al centro (el revisor: «1898 en medio de la nada», «el retrato ocupa un sexto»)
  const pocas = items.length <= 2;
  const gr = pocas ? 1.3 : 1;
  // la fila de tarjetas, iconos y cuadros: cada uno con su ancho y, si no caben, todos un poco más pequeños (antes,
  // con cuatro, la tarjeta tapaba el cañón y el tren)
  const anchoDe = (c: Item) => c.imagen ? Number(c.ancho ?? 380 * gr) + 20
    : c.pais ? 320 * Number(c.escala ?? 1)
    : c.tarjeta !== undefined ? Number(c.ancho ?? (zona.yVisual < 700 ? 280 : 330) * (visuales.length <= 2 ? 1.2 : 1))
    : 240 * Number(c.escala ?? 1.2 * gr) / 1.2 * (!zona.yPalabra && visuales.length <= 2 && visuales.every((v) => v.cosa && v.tarjeta === undefined && !v.imagen && !v.pais) ? 1.75 : 1);
  const HUECO = 40;
  const totalV = visuales.reduce((a, c) => a + anchoDe(c), 0) + HUECO * Math.max(0, visuales.length - 1);
  const kV = Math.min(1, (zona.x1 - zona.x0 + 140) / Math.max(1, totalV));
  const xsV: number[] = [];
  visuales.reduce((acc, c) => { const w = anchoDe(c) * kV; xsV.push(acc + w / 2); return acc + w + HUECO * kV; }, cx - (totalV * kV) / 2);
  // «tachar»: una cruz roja de rotulador encima («No tenía campos ni minas»). true = a los 0,6 s de salir; un número =
  // a esos segundos; «tachar_en»: en esa palabra de la voz
  const tachado = (c: Item, x: number, y: number, L: number) => {
    if (c.tachar === undefined && c.tachar_en === undefined) return null;
    const t0 = typeof c.tachar_t === "number" ? c.tachar_t : c.t + (typeof c.tachar === "number" ? c.tachar : 0.6);
    const k = clamp((fAbs - s(t0)) / 12);
    if (k <= 0) return null;
    const a = CURVA.rapida(clamp(k * 2)), b = CURVA.rapida(clamp(k * 2 - 1));
    return (
      <g stroke={tema.acento} strokeWidth={22} strokeLinecap="round" opacity={0.92}>
        <line x1={x - L} y1={y - L} x2={x - L + 2 * L * a} y2={y - L + 2 * L * a} />
        {b > 0 && <line x1={x + L} y1={y - L} x2={x + L - 2 * L * b} y2={y - L + 2 * L * b} />}
      </g>
    );
  };
  return (
    <>
      {textos.map((c, i) => {
        const f = aparece(fAbs, c.t);
        if (f <= 0) return null;
        const t = String(c.palabra ?? c.frase);
        const escrito = Math.round(t.length * clamp((fAbs - s(c.t)) / Math.max(6, t.length * 1.2)));
        const tx = Number(c.x ?? cx), ty = Number(c.y ?? (zona.yPalabra ?? zona.yTexto) + i * 92), tam = Number(c.tam ?? (c.palabra ? 78 : 62) * gr);
        // «estilo» (la referencia escribe cada palabra según lo que significa): subraya, tiembla, agua (azul que gotea), fuego
        const est = String(c.estilo ?? "");
        const anchoT = t.length * tam * 0.48;
        const lleno = escrito >= t.length;
        const col = est === "agua" ? "#2f74c4" : est === "fuego" ? (Math.floor(fAbs / 3) % 2 ? "#e2531f" : "#f08a24") : c.rojo ? tema.acento : tema.oscuro;
        const dx = est === "tiembla" ? Math.sin(fAbs * 1.9) * 3 : 0, dy = est === "tiembla" ? Math.cos(fAbs * 2.3) * 2 : 0;
        const k2 = lleno ? clamp((fAbs - s(c.t) - Math.max(6, t.length * 1.2)) / 10) : 0;
        return (
          <g key={`t${i}`} transform={`translate(${dx}, ${dy})`}>
            <Texto tema={tema} x={tx} y={ty} t={t.slice(0, escrito)} tam={tam} color={col} />
            {est === "subraya" && k2 > 0 && <path d={`M ${tx - anchoT / 2} ${ty + 14} q ${anchoT / 2} 10 ${anchoT * k2} -4`} stroke={tema.acento} strokeWidth={7} fill="none" strokeLinecap="round" />}
            {est === "agua" && k2 > 0 && [0.2, 0.5, 0.8].map((q, j) => {
              const ciclo = ((fAbs + j * 11) % 34) / 34;
              return <path key={j} d={`M ${tx - anchoT / 2 + anchoT * q} ${ty + 6 + ciclo * 46} q -6 10 0 14 q 6 -4 0 -14 z`} fill="#2f74c4" opacity={1 - ciclo} />;
            })}
          </g>
        );
      })}
      {cifras.map((c, i) => {
        const p = CURVA.llega(aparece(fAbs, c.t));
        if (p <= 0) return null;
        return (
          <g key={`c${i}`} transform={`translate(${Number(c.x ?? cx)}, ${Number(c.y ?? (pocas ? 560 : zona.yTexto + 210 + textos.length * 40))}) scale(${p * (c.tam ? 1 : gr)})`}>
            {c.icono ? <g transform="translate(-170, -50) scale(0.6)"><Cosa id={String(c.icono)} tema={tema} /></g> : null}
            <Texto tema={tema} x={c.icono ? 30 : 0} y={0} t={String(c.cifra)} tam={Number(c.tam ?? 190)} gorda color={c.negro ? tema.oscuro : tema.acento} />
            {c.sub ? <Texto tema={tema} x={c.icono ? 30 : 0} y={64} t={String(c.sub)} tam={44} color={tema.oscuro} /> : null}
          </g>
        );
      })}
      {visuales.map((c, i) => {
        const f = aparece(fAbs, c.t);
        const x = Number(c.x ?? (visuales.length === 1 ? cx : xsV[i]));
        const y = Number(c.y ?? zona.yVisual);
        const giro = Number(c.giro ?? (i % 2 ? 3 : -3));
        const k = c.x !== undefined ? 1 : kV;
        const encoge = (el: React.ReactNode) => (k < 1 ? <g key={`k${i}`} transform={`translate(${x}, ${y}) scale(${k}) translate(${-x}, ${-y})`}>{el}</g> : el);
        if (c.imagen) {
          if (f <= 0) return null;
          const p = CURVA.llega(f);
          const ancho = Number(c.ancho ?? 380 * gr), alto = Number(c.alto ?? 460 * gr);
          return encoge(
            <g key={`v${i}`} transform={`translate(${x}, ${y}) rotate(${giro * 0.4}) scale(${p})`} filter="url(#t-sombra)">
              <rect x={-ancho / 2 - 10} y={-alto / 2 - 10} width={ancho + 20} height={alto + 20} rx={14} fill="#fbf8f1" />
              <image href={staticFile(`videos/${id}/${c.imagen}`)} x={-ancho / 2} y={-alto / 2} width={ancho} height={alto} preserveAspectRatio="xMidYMid slice" />
              {c.pie ? <Texto tema={tema} x={0} y={alto / 2 + 52} t={String(c.pie)} tam={34} color={tema.oscuro} /> : null}
            </g>
          );
        }
        if (c.pais) {
          // el país como personaje (la referencia: Holanda con ojos y piernas, empapada): «mapa:capa»
          if (f <= 0) return null;
          const [mapa, capa] = String(c.pais).split(":");
          return encoge(
            <g key={`v${i}`} transform={`translate(${x}, ${y + 190 * Number(c.escala ?? 1)}) scale(${CURVA.llega(f) * Number(c.escala ?? 1)})`}>
              <Pais tema={tema} mapa={mapa} capa={capa} color={c.color ? color(c.color as string) : undefined} frame={fAbs} habla={Boolean(c.habla)} pose={(c.pose as "triste") ?? "normal"} mira={c.mira as number | undefined} />
              {c.pie ? <Texto tema={tema} x={0} y={52} t={String(c.pie)} tam={40} color={tema.oscuro} /> : null}
            </g>,
          );
        }
        if (c.tarjeta !== undefined) {
          return encoge(
            <g key={`v${i}`}>
              <Tarjeta tema={tema} x={x} y={y} ancho={Number(c.ancho ?? (zona.yVisual < 700 ? 280 : 330) * (visuales.length <= 2 ? 1.2 : 1))} alto={Number(c.alto ?? (zona.yVisual < 700 ? 250 : 290) * (visuales.length <= 2 ? 1.2 : 1))} f={f} texto={c.tarjeta ? String(c.tarjeta) : undefined} giro={giro}>
                {c.cosa ? <g transform={`translate(0, ${c.tarjeta ? -36 : 0}) scale(${Number(c.escala ?? 0.9)})`}><Cosa id={String(c.cosa)} tema={tema} f={fAbs} /></g> : null}
              </Tarjeta>
              {tachado(c, x, y, (zona.yVisual < 700 ? 100 : 120) * (visuales.length <= 2 ? 1.2 : 1))}
            </g>
          );
        }
        if (f <= 0) return null;
        // en el gris, uno o dos iconos sueltos (sin tarjeta) se veían diminutos («una espada y un fuego en medio de la
        // nada», 11-11-2026): más grandes y con el pie fuera de la escala
        const solos = !zona.yPalabra && visuales.length <= 2 && visuales.every((v) => v.cosa && v.tarjeta === undefined && !v.imagen && !v.pais);
        const esc = Number(c.escala ?? 1.2 * gr) * (solos ? 1.75 : 1);
        return encoge(<g key={`v${i}`}><g transform={`translate(${x}, ${y - (solos ? 40 : 0)}) scale(${CURVA.llega(f) * esc})`}><Cosa id={String(c.cosa)} tema={tema} f={fAbs} /></g>{c.pie ? <Texto tema={tema} x={x} y={y - (solos ? 40 : 0) + 110 * esc} t={String(c.pie)} tam={solos ? 50 : 40} color={tema.oscuro} op={clamp(f)} /> : null}{tachado(c, x, y, 95 * esc)}</g>);
      })}
    </>
  );
};

/** Rótulos que van encima de cualquier plano: la fecha arriba a la izquierda y palabras sueltas a mano. */
const Rotulos: React.FC<{ tema: Tema; rotulos: Item[]; fAbs: number; claro: boolean }> = ({ tema, rotulos, fAbs, claro }) => (
  <>
    {rotulos.filter((r) => r.tipo === "fecha" && fAbs >= s(r.t)).slice(-1).map((r, i) => <Fecha key={`f${i}`} tema={tema} texto={String(r.texto)} />)}
    <SVGTerra tema={tema}>
      {rotulos.filter((r) => r.tipo !== "fecha").map((r, i) => {
        if (r.tipo === "titular") {
          // un rótulo nuevo sustituye al anterior del mismo plano
          const siguiente = rotulos.find((q) => q.tipo === "titular" && q.t > r.t && fAbs >= s(q.t));
          if (siguiente) return null;
          // el rótulo de la referencia: una frase que se escribe letra a letra, a mano, blanca con borde (oscura sobre el gris)
          const t = String(r.texto);
          const k = clamp((fAbs - s(r.t)) / Math.max(6, t.length * 0.7));
          if (k <= 0) return null;
          return <Texto key={i} tema={tema} x={Number(r.x ?? 960)} y={Number(r.y ?? 150)} t={t.slice(0, Math.max(1, Math.round(t.length * k)))} tam={Number(r.tam ?? 64)}
            color={claro ? "#ffffff" : tema.oscuro} borde={claro ? "rgba(20,20,20,0.75)" : undefined} />;
        }
        const p = CURVA.llega(aparece(fAbs, r.t));
        if (p <= 0) return null;
        return (
          <g key={i} transform={`translate(${Number(r.x ?? 960)}, ${Number(r.y ?? 140)}) scale(${p})`}>
            <Texto tema={tema} x={0} y={0} t={String(r.texto)} tam={Number(r.tam ?? 70)} gorda={Boolean(r.gorda)} color={r.rojo ? tema.acento : claro ? tema.claro : tema.oscuro} borde={claro ? "rgba(20,20,20,0.7)" : undefined} />
          </g>
        );
      })}
    </SVGTerra>
  </>
);

/** La tarjeta de capítulo: un pergamino que se desenrolla sobre marrón oscuro con un círculo por capítulo. */
const Capitulo: React.FC<{ tema: Tema; n: number; total: number; titulo: string; f: number; anios?: (string | undefined)[]; iconos?: (string | undefined)[]; fAbs?: number }> = ({ tema, n, total, titulo, f, anios = [], iconos = [], fAbs = 0 }) => {
  const abre = CURVA.suave(clamp(f / 16));
  const ancho = 1500 * abre;
  const filas = total > 8 ? 2 : 1;
  const porFila = Math.ceil(total / filas);
  return (
    <AbsoluteFill style={{ background: "#382d23" }}>
      <SVGTerra tema={tema}>
        <g transform="translate(960, 470)">
          <rect x={-ancho / 2} y={-250} width={ancho} height={500} fill="#efe1bf" />
          <rect x={-ancho / 2} y={-250} width={ancho} height={500} fill="none" stroke="#b89a64" strokeWidth={6} />
          {[-1, 1].map((l) => <g key={l}><Forma tema={tema} fill="#a87a45" x={l * ancho / 2 - 22} y={-280} w={44} h={560} esq={22} /></g>)}
          {abre > 0.92 && Array.from({ length: total }).map((_, i) => {
            const fila = Math.floor(i / porFila), col = i % porFila;
            const enFila = fila === filas - 1 ? total - porFila * (filas - 1) : porFila;
            const sep = Math.min(iconos.some(Boolean) ? 215 : 150, 1250 / Math.max(1, enFila - 1 || 1));
            const x = (col - (enFila - 1) / 2) * sep, y = filas === 1 ? -30 : -110 + fila * 160;
            const actual = i + 1 === n, hecho = i + 1 < n;
            const p = CURVA.llega(clamp((f - 16 - i * 1.5) / 8));
            return (
              <g key={i} transform={`translate(${x}, ${y - (iconos[i] ? 20 : 0)}) scale(${p * (iconos[i] ? 1.3 : 1)})`}>
                {col < enFila - 1 && <path d={`M ${iconos[i] ? 60 : 44} 0 L ${sep / (iconos[i] ? 1.3 : 1) - (iconos[i] ? 60 : 44)} 0`} stroke="#8a6a3c" strokeWidth={5} strokeDasharray="10 9" />}
                <circle r={iconos[i] ? (actual ? 62 : 54) : actual ? 50 : 40} fill={actual ? "#f08a24" : hecho ? "#c9a570" : "#e6d3a8"} stroke="#6b4a26" strokeWidth={5} />
                {iconos[i] ? (
                  <g>
                    <g transform={`scale(${actual ? 0.62 : 0.52})`}><Cosa id={iconos[i]!} tema={tema} f={fAbs} /></g>
                    {anios[i] && <g transform="translate(0, 84)">
                      <rect x={-46} y={-24} width={92} height={36} rx={6} fill="#efe1bf" stroke="#6b4a26" strokeWidth={4} />
                      <Texto tema={tema} x={0} y={4} t={anios[i]!} tam={26 * Math.min(1, 5 / Math.max(5, anios[i]!.length))} gorda color="#5a3d1e" />
                    </g>}
                  </g>
                ) : (() => {
                  // antes de Cristo: el año grande y «a. C.» pequeño debajo (si no, no cabe en el círculo)
                  const ac = anios[i]?.match(/^(\d+)\s*a\.?\s*C\.?$/i);
                  const col = actual ? "#ffffff" : "#5a3d1e";
                  if (ac) return (<>
                    <Texto tema={tema} x={0} y={2} t={ac[1]} tam={(actual ? 30 : 24) * Math.min(1, 4 / Math.max(4, ac[1].length))} gorda color={col} />
                    <Texto tema={tema} x={0} y={actual ? 26 : 22} t="a. C." tam={actual ? 17 : 14} color={col} />
                  </>);
                  return <Texto tema={tema} x={0} y={anios[i] ? 10 : 14} t={anios[i] ?? String(i + 1)} tam={anios[i] ? (actual ? 30 : 24) * Math.min(1, 4.5 / Math.max(4, anios[i]!.length)) : actual ? 44 : 34} gorda color={col} />;
                })()}
              </g>
            );
          })}
        </g>
        {f > 24 && <Texto tema={tema} x={960} y={880} t={n === 0 ? (titulo || "El camino entero") : `Capítulo ${n}: ${titulo}`} tam={72} color="#f4e7c8" op={clamp((f - 24) / 10)} />}
      </SVGTerra>
    </AbsoluteFill>
  );
};

/** La cámara de una escena (11-11-2026; «siempre es el mismo plano de cámara» y después «quiero cambios de
 *  cámara» y «cuidado porque se cortan bocadillos»).
 *  - Una escena se parte en TOMAS de ~3,5 s que cortan al empezar una palabra; cada toma es distinta de la anterior:
 *    general, plano medio del grupo, primer plano de cada muñeco (uno y luego otro), paneo, se acerca, se aleja.
 *  - Cuando alguien habla en un bocadillo, la toma es suya (primer plano) o, la vez siguiente, el general con los dos
 *    (plano y contraplano).
 *  - Ningún bocadillo se sale: si en esa toma se cortaría, la cámara se recoloca o se acerca menos.
 *  El plan puede fijar una sola toma para toda la escena con «"toma"» o dejar la de antes con «"camara": "general"». */
const TOMA_S = 3.5;
type Cam = { z: number; ox: number; oy: number; dx: number };
type Caja = { x: number; y: number; w: number; h: number };
const cajaBocadillo = (b: Item, a: Actor | undefined, ax: number, suelo: number) => {
  const sc = a?.s ?? 1;
  const conSombrero = a?.traje && TRAJES[a.traje]?.sombrero && TRAJES[a.traje]?.sombrero !== "ninguno";
  const cabeza = (a?.y ?? suelo) - sc * ((a?.sentado || a?.montado ? 300 : 385) + (conSombrero ? 55 : 0) + (a?.montado ? ALTO_LOMO * CABALLO_ESCALA - 86 : 0));
  const ancho = Number(b.ancho ?? 560);
  const x = Math.max(30, Math.min(W - ancho - 30, ax - ancho / 2 + Number(b.dx ?? 0)));
  const lineas = Math.ceil((String(b.texto).length * BOC_TAM * 0.5) / (ancho - 70));
  const alto = lineas * BOC_TAM * 1.2 + 44;
  const y = Math.max(30, cabeza - alto - 90 + Number(b.dy ?? 0));
  return { x, y, w: ancho, h: alto, ax, cabeza };
};
/** Mueve el centro (o baja el zoom) hasta que todas las cajas quepan en pantalla con margen. */
const encuadrar = (c: Cam, cajas: Caja[]): Cam => {
  const M = 18;
  if (!cajas.length) return c;
  const xMin = Math.min(...cajas.map((k) => k.x)), xMax = Math.max(...cajas.map((k) => k.x + k.w));
  const yMin = Math.min(...cajas.map((k) => k.y));
  const cabe = (q: Cam) => {
    const izq = q.ox * (1 - q.z) + xMin * q.z + q.dx, der = q.ox * (1 - q.z) + xMax * q.z + q.dx, arriba = q.oy * (1 - q.z) + yMin * q.z;
    const dentro = q.oy >= 0 && q.oy <= H && q.ox >= 0 && q.ox <= W && Math.abs(q.dx) <= (q.z - 1) * Math.min(q.ox, W - q.ox) + 0.01;
    return dentro && izq >= M - 0.5 && der <= W - M + 0.5 && arriba >= M - 0.5;
  };
  // del zoom pedido hacia 1, en 12 pasos: el primero en el que, recolocando el centro, cabe todo
  for (let paso = 0; paso <= 12; paso++) {
    const z = 1 + (c.z - 1) * (1 - paso / 12);
    if (z <= 1.0001) break;
    let { ox, oy, dx } = c;
    const oyMax = (M - yMin * z) / (1 - z); // y' = oy·(1 − z) + y·z ≥ M
    if (oy > oyMax) oy = oyMax;
    oy = Math.max(0, Math.min(H, oy));
    // x' = ox·(1 − z) + x·z + dx: subir ox mueve la imagen a la izquierda
    const izq = ox * (1 - z) + xMin * z + dx, der = ox * (1 - z) + xMax * z + dx;
    if (izq < M) ox -= (M - izq) / (z - 1);
    else if (der > W - M) ox += (der - (W - M)) / (z - 1);
    ox = Math.max(0, Math.min(W, ox));
    dx = Math.sign(dx) * Math.min(Math.abs(dx), (z - 1) * Math.min(ox, W - ox));
    const q = { z, ox, oy, dx };
    if (cabe(q)) return q;
  }
  return { z: 1, ox: 960, oy: 540, dx: 0 };
};
const camaraEscena = (p: PlanoT, act: { x: number; y: number; s: number; q: string }[], burbujas: (Item & { hasta: number })[], cajas: Caja[], fAbs: number, u: number, palabras: Palabra[]): Cam => {
  if (p.camara === "general") return { z: (p.zoom ?? 1) * (1 + 0.035 * CURVA.suave(u)), ox: 960, oy: 648, dx: 0 };
  const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const gx = act.length ? lim(act.reduce((a, b) => a + b.x, 0) / act.length, 420, 1500) : 960;
  const gy = act.length ? lim(act.reduce((a, b) => a + b.y - 220 * b.s, 0) / act.length, 420, 820) : 640;
  const cerca = (a: { x: number; y: number; s: number }, k: number): Cam => ({ z: 1.5 + 0.06 * k, ox: lim(a.x, 300, 1620), oy: lim(a.y - 250 * a.s, 340, 840), dx: 0 });
  const t = fAbs / FPS;
  // plano y contraplano en los bocadillos (con dos o más muñecos)
  if (act.length >= 2) {
    const activas = burbujas.map((b, i) => ({ b, i })).filter(({ b }) => fAbs >= s(b.t) && fAbs < s(b.hasta));
    const ult = activas[activas.length - 1];
    if (ult) {
      const a = act.find((x) => x.q === ult.b.a);
      const k = clamp((t - ult.b.t) / Math.max(1, ult.b.hasta - ult.b.t));
      if (a && ult.i % 2 === 0) return encuadrar(cerca(a, k), cajas);
      if (a) return encuadrar({ z: 1.08 + 0.04 * k, ox: gx, oy: gy, dx: 0 }, cajas);
    }
  }
  // las tomas de la escena: cortes cada ~3,5 s en el arranque de una palabra
  const cortes = [p.ini];
  if (!p.toma) for (const w of palabras) {
    if (w.ini <= p.ini || w.ini >= p.fin - 1.8) continue;
    if (w.ini - cortes[cortes.length - 1] >= TOMA_S) cortes.push(w.ini);
  }
  let n = 0;
  while (n + 1 < cortes.length && t >= cortes[n + 1]) n++;
  const fin = n + 1 < cortes.length ? cortes[n + 1] : p.fin;
  const su = CURVA.suave(clamp((t - cortes[n]) / Math.max(0.5, fin - cortes[n])));
  const base = p.ne ?? p.n;
  const lista: string[] = act.length >= 2 ? ["general", "medio", "cerca0", "paneo", "cerca1", "acerca", "aleja"]
    : act.length === 1 ? ["general", "cerca0", "paneo", "medio", "aleja", "acerca"]
    : ["acerca", "paneo", "aleja", "general"];
  const toma = p.toma ?? (p.zoom && p.zoom > 1 && n === 0 ? "medio" : lista[(base * 3 + n) % lista.length]);
  let c: Cam;
  switch (toma) {
    case "aleja": c = { z: 1.26 - 0.2 * su, ox: gx, oy: gy, dx: 0 }; break;
    case "paneo": { const d = 105 * ((base + n) % 2 ? 1 : -1); c = { z: 1.15, ox: 960, oy: 600, dx: d - 2 * d * su }; break; }
    case "medio": c = { z: (p.zoom && p.zoom > 1 ? p.zoom : 1.32) + 0.04 * su, ox: gx, oy: gy, dx: 0 }; break;
    case "general": c = { z: 1 + 0.04 * su, ox: 960, oy: 648, dx: 0 }; break;
    case "cerca0": case "cerca1": {
      const orden = [...act].sort((a, b) => a.x - b.x);
      const a = orden[toma === "cerca0" ? 0 : orden.length - 1];
      c = a ? cerca(a, su) : { z: 1 + 0.17 * su, ox: gx, oy: gy, dx: 0 };
      break;
    }
    default: c = { z: 1 + 0.17 * su, ox: gx, oy: gy, dx: 0 }; // acerca
  }
  return encuadrar(c, cajas);
};

const PlanoTerra: React.FC<{ p: PlanoT; plan: PlanT; tema: Tema }> = ({ p, plan, tema }) => {
  const fAbs = useCurrentFrame() + s(p.ini);
  const fRel = fAbs - s(p.ini);
  const dur = Math.max(1, s(p.fin) - s(p.ini));
  const u = fRel / dur;
  const rot = p.rotulos ?? [];
  const guia: Guia | null = p.guia === false || (p.guia && (p.guia as Guia).no) ? null : ((p.guia as Guia) ?? {});

  if (p.tipo === "capitulo") {
    // «año|título» o «año|título|icono» (el icono, una cosa de cosas.tsx: barco, corona, castillo…)
    const caps = (plan.capitulos ?? []).map((c) => { const q = c.split("|").map((x) => x.trim()); return q.length >= 3 ? { anio: q[0], titulo: q[1], icono: q[2] } : q.length === 2 ? { anio: q[0], titulo: q[1], icono: undefined } : { anio: undefined, titulo: c, icono: undefined }; });
    const num = p.numero ?? 1; // 0 = el camino entero (en el gancho), sin capítulo actual
    return <Capitulo tema={tema} n={num} total={caps.length || Math.max(num, 10)} titulo={p.titulo ?? (num ? caps[num - 1]?.titulo : "") ?? ""} f={fRel} anios={caps.map((c) => c.anio)} iconos={caps.map((c) => c.icono)} fAbs={fAbs} />;
  }

  if (p.tipo === "portada") {
    const img = p.imagen ? staticFile(`videos/${plan.id}/${p.imagen}`) : null;
    const zz = 1.06 + 0.07 * CURVA.suave(u);
    const pt = CURVA.llega(clamp((fRel - 4) / 14));
    const sub = String(p.subtitulo ?? "");
    const ks = clamp((fRel - 22) / Math.max(8, sub.length * 0.8));
    return (
      <AbsoluteFill style={{ background: "#1a1410", overflow: "hidden" }}>
        {img && <Img src={img} style={{ width: W, height: H, objectFit: "cover", transform: `scale(${zz})` }} />}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.6) 100%)" }} />
        <SVGTerra tema={tema}>
          {/* el título en una o dos líneas («La historia ENTERA|del Imperio español») */}
          {String(p.titulo ?? "").split("|").map((linea, i, todas) => (
            <g key={i} transform={`translate(960, ${500 - (todas.length - 1) * 70 + i * 140}) scale(${pt})`}>
              <Texto tema={tema} x={0} y={0} t={linea.trim()} tam={124} gorda color="#ffffff" borde="rgba(15,12,10,0.85)" />
            </g>
          ))}
          {sub && ks > 0 && <Texto tema={tema} x={960} y={500 + String(p.titulo ?? "").split("|").length * 70 + 40} t={sub.slice(0, Math.max(1, Math.round(sub.length * ks)))} tam={58} color="#ffffff" borde="rgba(15,12,10,0.8)" />}
        </SVGTerra>
        <Rotulos tema={tema} rotulos={rot} fAbs={fAbs} claro />
      </AbsoluteFill>
    );
  }

  if (p.tipo === "mapa") {
    const derecha = (guia?.lado ?? "derecha") === "derecha";
    // lo que tiene que verse entero y centrado (Mapa.tsx, encuadrar): los territorios que se pintan en este plano o
    // llevan nombre (los que vienen pintados del plano anterior, sin nombre, son fondo), las chinchetas, los iconos y
    // las puntas de flechas y ejércitos; al empezar, lo que sale en la primera mitad del plano
    const cosasMapa: { t: number; q: Importa }[] = [
      ...(p.capas ?? []).filter((c) => c.etiqueta || c.en !== 0).map((c) => ({ t: c.t, q: { capa: String(c.id) } })),
      ...[...(p.pins ?? []), ...(p.iconos ?? []), ...(p.asedios ?? []), ...(p.fuegos ?? [])].map((c) => ({ t: c.t, q: { lon: Number(c.lon), lat: Number(c.lat) } })),
      ...[...(p.flechas ?? []), ...(p.ejercitos ?? []), ...(p.barcos ?? [])].flatMap((c) => [c.de, c.a].map((pt) => ({ t: c.t, q: { lon: (pt as number[])[0], lat: (pt as number[])[1] } }))),
    ];
    const importa = { ini: cosasMapa.filter((c) => c.t <= p.ini + 0.5 * (p.fin - p.ini)).map((c) => c.q), fin: cosasMapa.map((c) => c.q) };
    const libre = !guia ? { x0: 0, x1: W } : derecha ? { x0: 0, x1: 1440 } : { x0: 480, x1: W };
    return (
      <AbsoluteFill>
        <Mapa tema={tema} mapa={p.mapa ?? ""} frame={fAbs} cam={p.cam ?? { lon: 0, lat: 30, grados: 60 }} hasta={p.hasta} u={u} importa={p.encuadre === false ? undefined : importa} libre={libre}
          fecha={p.fecha}
          capas={(p.capas ?? []).map((c) => ({ id: String(c.id), color: color(c.color as string), modo: (c.modo as "crece") ?? "aparece", etiqueta: c.etiqueta as string | undefined, op: c.op as number | undefined,
            f: aparece(fAbs, c.t, c.modo === "crece" ? 36 : c.modo === "dibuja" ? 30 : 12),
            cara: c.cara as string | undefined, caraPos: c.cara_lugar as [number, number] | undefined, fc: c.cara ? aparece(fAbs, Number(c.tc ?? c.t), 10) : undefined,
            rompe: c.tr !== undefined ? clamp((fAbs - s(Number(c.tr))) / 30) : undefined }))}
          foco={p.foco ? { capa: p.foco.capa as string | undefined, lon: p.foco.lon as number | undefined, lat: p.foco.lat as number | undefined, radio: p.foco.radio as number | undefined, f: clamp((fAbs - s(p.foco.t)) / 18) } : undefined}
          copias={(p.copias ?? []).map((c) => ({ capa: String(c.capa), puntos: c.puntos as [number, number][], f: clamp((fAbs - s(c.t)) / s(Number(c.d ?? 2))), color: c.color ? color(c.color as string) : undefined, escala: c.escala as number | undefined }))}
          barcos={(p.barcos ?? []).map((c) => ({ de: c.de as [number, number], a: c.a as [number, number], f: clamp((fAbs - s(c.t)) / s(Number(c.d ?? 3))), color: c.color ? color(c.color as string) : undefined, vela: c.vela ? color(c.vela as string) : undefined, curva: c.curva as number | undefined, flota: c.flota as number | undefined }))}
          pins={(p.pins ?? []).map((c) => ({ lon: Number(c.lon), lat: Number(c.lat), nombre: c.nombre as string | undefined, f: aparece(fAbs, c.t, 14), aro: Boolean(c.aro), izquierda: Boolean(c.izquierda) }))}
          flechas={(p.flechas ?? []).map((c) => ({ de: c.de as [number, number], a: c.a as [number, number], f: aparece(fAbs, c.t, 24), color: c.color ? color(c.color as string) : undefined, curva: c.curva as number | undefined, puntos: Boolean(c.puntos) }))}
          iconos={(p.iconos ?? []).map((c) => ({ lon: Number(c.lon), lat: Number(c.lat), f: aparece(fAbs, c.t, 12), nodo: <Cosa id={String(c.cosa)} tema={tema} f={fAbs} />, tam: c.tam as number | undefined }))}
          ejercitos={(p.ejercitos ?? []).map((c) => ({ de: c.de as [number, number], a: c.a as [number, number], f: clamp((fAbs - s(c.t)) / s(Number(c.d ?? 2.5))), color: c.color ? color(c.color as string) : undefined, curva: c.curva as number | undefined, banderas: c.banderas as number | undefined }))}
          asedios={(p.asedios ?? []).map((c) => ({ lon: Number(c.lon), lat: Number(c.lat), f: clamp((fAbs - s(c.t)) / s(Number(c.d ?? 2))), color: c.color ? color(c.color as string) : undefined }))}
          fuegos={(p.fuegos ?? []).map((c) => ({ lon: Number(c.lon), lat: Number(c.lat), f: aparece(fAbs, c.t, 12), tam: c.tam as number | undefined }))}
        />
        {guia && (
          <SVGTerra tema={tema}>
            <LaGuia tema={tema} g={guia} fAbs={fAbs} palabras={plan.palabras} tramo={[p.ini, p.fin]} x={derecha ? 1660 : 260} y={1150} sc={2.05} mira={derecha ? -0.45 : 0.45}
              poseBase={derecha ? { bi: 14, ci: -24, bd: 18, cd: -40 } : { bd: 14, cd: -24, bi: 18, ci: -40 }} manoMapa={derecha ? "D" : "I"} rollo />
          </SVGTerra>
        )}
        <Rotulos tema={tema} rotulos={rot} fAbs={fAbs} claro />
      </AbsoluteFill>
    );
  }

  if (p.tipo === "narrador" || p.tipo === "papel") {
    const papel = p.tipo === "papel";
    return (
      <AbsoluteFill>
        <FondoNarrador tema={tema} />
        <SVGTerra tema={tema}>
          {papel && (
            <g filter="url(#t-sombra)">
              <rect x={guia ? 700 : 260} y={90} width={guia ? 1120 : 1400} height={900} rx={10} fill="#f3e6c6" />
              <rect x={guia ? 700 : 260} y={90} width={guia ? 1120 : 1400} height={900} rx={10} fill="none" stroke="#c9ad7a" strokeWidth={4} />
            </g>
          )}
          {papel && p.titulo && <Texto tema={tema} x={guia ? 1260 : 960} y={200} t={p.titulo} tam={86} color={tema.oscuro} />}
          {guia && <LaGuia tema={tema} g={guia} fAbs={fAbs} palabras={plan.palabras} tramo={[p.ini, p.fin]} x={430} y={990} sc={1.62} mira={0.4} poseBase={{ bd: 14, cd: -24, bi: 14, ci: -30 }} manoMapa="I" />}
          <Cosas tema={tema} items={p.cosas ?? []} fAbs={fAbs} id={plan.id} zona={papel ? { x0: guia ? 760 : 320, x1: guia ? 1760 : 1600, yTexto: 280, yVisual: 660, yPalabra: 345 } : { x0: 780, x1: 1720, yTexto: 210, yVisual: 730 }} />
        </SVGTerra>
        <Rotulos tema={tema} rotulos={rot} fAbs={fAbs} claro={false} />
        <Papel tema={tema} />
      </AbsoluteFill>
    );
  }

  if (p.tipo === "archivo") {
    const img = staticFile(`videos/${plan.id}/${p.imagen}`);
    if (p.modo === "tarjeta") {
      const pp = CURVA.llega(clamp(fRel / 12));
      const conActor = (p.actores ?? []).length > 0;
      return (
        <AbsoluteFill>
          <FondoNarrador tema={tema} />
          <SVGTerra tema={tema}>
            {guia && <LaGuia tema={tema} g={guia} fAbs={fAbs} palabras={plan.palabras} tramo={[p.ini, p.fin]} x={430} y={990} sc={1.62} mira={0.4} poseBase={{ bd: 60, cd: -20, bi: 14, ci: -30 }} manoMapa="I" />}
            <g transform={`translate(${conActor ? 1060 : 1220}, 500) scale(${pp})`} filter="url(#t-sombra)">
              <rect x={-300} y={-370} width={600} height={740} rx={16} fill="#fbf8f1" />
              <image href={img} x={-284} y={-354} width={568} height={708} preserveAspectRatio="xMidYMid slice" />
            </g>
            {conActor && (() => {
              const a = (p.actores ?? [])[0];
              const e = estadoActor({ q: a.q, x: 1650, mira: a.mira ?? -0.4, pose: typeof a.pose === "object" ? a.pose : undefined, acciones: a.acciones as never }, fAbs);
              const ent = CURVA.llega(clamp((fRel - 6) / 12));
              return (
                <g transform={`translate(${e.x + (1 - ent) * 300}, 1000) scale(${(a.s ?? 1) * 1.3})`}>
                  <Persona tema={tema} traje={{ ...trajeDe(a.traje), ...(a.colores ?? {}) }} frame={fAbs} semilla={a.q.length * 7} pose={e.pose} ojos={ojosDe(e.ojos ?? a.ojos)} boca={bocaDe(e.boca ?? a.boca)} />
                </g>
              );
            })()}
            {p.pie && <Texto tema={tema} x={conActor ? 1060 : 1220} y={960} t={p.pie} tam={40} color={tema.oscuro} op={clamp((fRel - 10) / 10)} />}
          </SVGTerra>
          <Rotulos tema={tema} rotulos={rot} fAbs={fAbs} claro={false} />
        </AbsoluteFill>
      );
    }
    // a pantalla completa, con zoom lento (Ken Burns); el sentido cambia de un plano a otro
    const z = 1.04 + 0.08 * CURVA.suave(u);
    const dx = (p.n % 2 ? 1 : -1) * 30 * u;
    return (
      <AbsoluteFill style={{ background: "#111", overflow: "hidden" }}>
        <Img src={img} style={{ width: W, height: H, objectFit: "cover", transform: `translateX(${dx}px) scale(${z})` }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(0,0,0,0.45) 100%)" }} />
        {p.pie && <SVGTerra tema={tema}><Texto tema={tema} x={960} y={1010} t={p.pie} tam={44} color="#ffffff" borde="rgba(0,0,0,0.6)" op={clamp((fRel - 8) / 10)} /></SVGTerra>}
        <Rotulos tema={tema} rotulos={rot} fAbs={fAbs} claro />
      </AbsoluteFill>
    );
  }

  // escena
  const deco = p.decorado ?? "sala_trono";
  const suelo = SUELO_DE[deco] ?? 1000;
  // el tamaño de la gente en este decorado (medidas.ts: una puerta mide 1,25 personas, un piso 1,35…)
  const gente = GENTE[deco] ?? 1;
  const actores = (p.actores ?? []).map((a) => ({ ...a, s: (a.s ?? 1) * gente }));
  const burbujas: (Item & { hasta: number })[] = (p.bocadillos ?? []).map((b, i, arr) => ({ ...b, hasta: Number(b.hasta ?? (arr[i + 1]?.t ?? p.fin)) }));
  const habla = (q: string) => burbujas.some((b) => b.a === q && fAbs >= s(b.t) && fAbs < s(b.hasta as number));
  // dónde está cada muñeco ahora (si camina, el bocadillo le sigue)
  const estados = Object.fromEntries(actores.map((a) => [a.q, estadoActor({ q: a.q, x: a.x, mira: a.mira, pose: typeof a.pose === "object" ? a.pose : undefined, acciones: a.acciones as never }, fAbs)]));
  // el tamaño de verdad de cada cosa de la escena (medidas.ts). Si dos se pisan (los planes de antes las ponían al
  // tamaño de icono, juntas), primero se separan y, si no caben en la pantalla, las dos un poco más pequeñas (como si
  // estuvieran más lejos), nunca menos del 70 % de su tamaño
  const cosasE = p.cosas ?? [];
  const kReal: number[] = cosasE.map((c) => {
    const caja = (CAJAS as Record<string, number[]>)[String(c.cosa)];
    return REAL[String(c.cosa)] && caja ? Math.min(REAL[String(c.cosa)] * PERSONA * gente, ALTO_MAX) / caja[3] : 0;
  });
  const xReal: number[] = cosasE.map((c) => Number(c.x ?? 960));
  {
    const idx = cosasE.map((_, i) => i).filter((i) => kReal[i] > 0).sort((a, b) => xReal[a] - xReal[b]);
    if (idx.length > 1) {
      const caja = (i: number) => (CAJAS as Record<string, number[]>)[String(cosasE[i].cosa)];
      const anchoTotal = (k: number) => idx.reduce((t, i) => t + caja(i)[2] * kReal[i] * k, 0) + 30 * (idx.length - 1);
      const k = Math.max(0.7, Math.min(1, (W - 80) / anchoTotal(1)));
      idx.forEach((i) => { kReal[i] *= k; });
      // de izquierda a derecha, cada una donde la puso el plan o justo a la derecha de la anterior
      for (let j = 1; j < idx.length; j++) {
        const a = idx[j - 1], b = idx[j];
        const minimo = xReal[a] + (caja(a)[2] * kReal[a] + caja(b)[2] * kReal[b]) / 2 + 30;
        if (xReal[b] < minimo) xReal[b] = minimo;
      }
      // si se salen por la derecha, todo el grupo hacia la izquierda
      const ult = idx[idx.length - 1];
      const sobra = xReal[ult] + (caja(ult)[2] * kReal[ult]) / 2 - (W - 30);
      if (sobra > 0) idx.forEach((i) => { xReal[i] -= sobra; });
    }
  }
  const visibles = burbujas.filter((b) => fAbs >= s(b.t) && fAbs < s(b.hasta)).map((b) => { const a = actores.find((x) => x.q === b.a); return { b, ...cajaBocadillo(b, a, a ? estados[a.q].x : 960, suelo) }; });
  // los rótulos sueltos de la escena (palabras a mano) van con la cámara, pegados a su sitio, y la cámara no los corta
  const rotEscena = rot.filter((r) => r.tipo !== "fecha");
  const cajasRot = rotEscena.filter((r) => fAbs >= s(r.t)).map((r) => { const tam = Number(r.tam ?? 70), w = String(r.texto).length * tam * (r.gorda ? 0.75 : 0.6) + 30; return { x: Number(r.x ?? 960) - w / 2, y: Number(r.y ?? 140) - tam * 1.1, w, h: tam * 1.3 }; });
  const cam = camaraEscena(p, actores.map((a) => ({ x: estados[a.q].x, y: a.y ?? suelo, s: a.s ?? 1, q: a.q })), burbujas, [...visibles, ...cajasRot], fAbs, u, plan.palabras);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${cam.ox}px ${cam.oy}px`, transform: `translateX(${cam.dx}px) scale(${cam.z})` }}>
        <SVGTerra tema={tema}>
          <Decorado id={deco} tema={tema} frame={fAbs} noche={p.noche} atardecer={p.atardecer} estandartes={p.estandartes} barco={p.barco} tormenta={p.tormenta} humo={p.humo} piramide={p.piramide !== false} u={u} estilo={p.estilo} semilla={p.n + 1} cupula={p.cupula} />
          {p.multitud && <Multitud tema={tema} frame={fAbs} n={p.multitud.n} x0={p.multitud.x0} x1={p.multitud.x1} y={p.multitud.y ?? suelo} color={p.multitud.color} agita={p.multitud.agita} antorchas={p.multitud.antorchas} lanzas={p.multitud.lanzas} />}
          {[...actores].sort((a, b) => (a.y ?? suelo) - (b.y ?? suelo)).map((a) => {
            const e = estados[a.q];
            const sc = a.s ?? 1;
            // a caballo: el caballo va debajo y el muñeco, sentado en la silla (si camina, el caballo anda)
            const anda = a.montado ? Math.abs(e.x - estadoActor({ q: a.q, x: a.x, mira: a.mira, acciones: a.acciones as never }, fAbs - 1).x) > 0.3 : false;
            const mira = (typeof a.pose === "object" && a.pose.mira !== undefined ? a.pose.mira : e.pose.mira ?? a.mira ?? 1) < 0 ? -1 : 1;
            const quita = a.acciones.find((ac) => ac.hace === "quita_sombrero");
            return (
              <g key={a.q} transform={`translate(${e.x}, ${a.y ?? suelo}) rotate(${e.rot}) scale(${sc})`}>
                {a.montado ? <g transform={`scale(${CABALLO_ESCALA})`}><Caballo tema={tema} f={fAbs} paso={anda} mira={mira} color={typeof a.montado === "string" ? color(a.montado) : undefined} /></g> : null}
                <g transform={a.montado ? `translate(${-mira * 12}, ${-ALTO_LOMO * CABALLO_ESCALA + 86})` : undefined}>
                  <Persona tema={tema} traje={{ ...trajeDe(a.traje), ...(a.colores ?? {}) }} frame={fAbs} semilla={a.q.length * 7 + a.q.charCodeAt(0)} pose={e.pose} sentado={a.sentado} montado={Boolean(a.montado)}
                    ojos={ojosDe(e.ojos ?? a.ojos)} boca={bocaDe(e.boca ?? a.boca)} habla={habla(a.q)} quitado={quita ? fAbs >= s(quita.t) + 8 : false}
                    lleva={a.lleva ? <Cosa id={a.lleva} tema={tema} f={fAbs} /> : undefined} llevaI={a.llevaI ? <Cosa id={a.llevaI} tema={tema} f={fAbs} /> : undefined} />
                </g>
              </g>
            );
          })}
          <DecoradoDelante id={deco} tema={tema} frame={fAbs} />
          {(p.cosas ?? []).map((c, i) => {
            const f = aparece(fAbs, c.t, 10);
            if (f <= 0) return null;
            const salto = (1 - CURVA.rapida(clamp((fAbs - s(c.t)) / 14))) * Number(c.salta ?? 0);
            const caja = (CAJAS as Record<string, number[]>)[String(c.cosa)];
            if (REAL[String(c.cosa)] && caja) {
              // a su tamaño de verdad al lado de una persona (medidas.ts), con la base donde el plan la puso
              const k = kReal[i];
              const fondo = caja[1] + caja[3]; // lo más bajo del dibujo
              const base = Math.min(suelo + 30, Number(c.y ?? suelo - 20) + fondo * Number(c.escala ?? 1));
              return <g key={`ec${i}`} transform={`translate(${xReal[i]}, ${base - fondo * k * CURVA.llega(f) + salto}) scale(${CURVA.llega(f) * k})`}><Cosa id={String(c.cosa)} tema={tema} f={fAbs} /></g>;
            }
            // un símbolo (corona, cruz, pergamino…): a la escala de la gente de este decorado, acercándose al suelo igual
            const cy = suelo - (suelo - Number(c.y ?? 700)) * gente;
            return <g key={`ec${i}`} transform={`translate(${Number(c.x ?? 960)}, ${cy + salto}) scale(${CURVA.llega(f) * Number(c.escala ?? 1) * gente})`}><Cosa id={String(c.cosa)} tema={tema} f={fAbs} /></g>;
          })}
          {visibles.map((v, i) => <Bocadillo key={i} tema={tema} x={v.x} y={v.y} ax={v.ax} ay={v.cabeza - 20} ancho={v.w} texto={String(v.b.texto)} escrito={1} f={aparece(fAbs, v.b.t, 8)} />)}
        </SVGTerra>
        <Rotulos tema={tema} rotulos={rotEscena} fAbs={fAbs} claro />
      </div>
      <Rotulos tema={tema} rotulos={rot.filter((r) => r.tipo === "fecha")} fAbs={fAbs} claro />
    </AbsoluteFill>
  );
};

/** El sonido de cada cosa cuando aparece (la referencia: «que suene lo que se ve»). Los efectos son de Kenney (CC0) y los
 *  hechos con ffmpeg: herramientas/sonidos_libres.py. */
const SONIDO_COSA: Record<string, string> = {
  moneda: "monedas", carabela: "olas", corona: "corona", calavera: "sordo", espada: "metal", castillo: "piedra", anillos: "cristal",
  isla: "olas", suscribete: "campana", alabarda: "metal", barril: "madera", ancla: "metal", globo: "territorio", sol: "corona",
  pergamino: "hoja", mapa_abierto: "hoja", mapa_enrollado: "hoja", antorcha: "madera", cruz: "campana", media_luna: "campana",
  picos: "picos", lingote: "metal", banquero: "monedas", sal: "hoja", pez: "olas", especias: "tela", seda: "tela",
  galera: "olas", trigo: "hoja", islote: "olas", caballo: "cascos", arco: "tela", yurta: "tela", junco: "olas", cuenco: "trago",
  canon: "golpe", fusil: "metal", catapulta: "madera", escudo: "madera", bomba: "sordo", piramide: "piedra", templo: "piedra",
  muralla: "piedra", pagoda: "campana", fabrica: "metal", tren: "cascos", barco_vapor: "olas", camello: "cascos", elefante: "sordo",
  vaca: "pasos", rata: "pop", bandera: "tela", bandera_blanca: "tela", bandera_uk: "tela", bandera_inglaterra: "tela", bandera_irlanda: "tela", libro: "hoja", pluma: "hoja", billete: "hoja", fuego: "viento",
  petroleo: "metal", oro: "monedas", cadenas: "metal", balanza: "metal", reloj: "clic", loba: "pasos", choza: "madera", bebe: "tela", cesta: "madera",
  cupula: "corona", arca: "corona", tablilla: "piedra", menora: "metal", muro: "piedra",
  te: "madera", patata: "pop", diamante: "cristal", ametralladora: "metal", azucar: "hoja", tabaco: "hoja", bicicleta: "metal", amapola: "hoja",
  tanque: "metal", avion: "whoosh", acorazado: "olas", portaaviones: "olas", submarino: "olas", radar: "clic", bandera_francia: "tela", bandera_italia: "tela", bandera_eeuu: "tela", bandera_japon: "tela", bandera_urss: "tela",
};
/** Ambiente de fondo de cada decorado (muy bajo; se aparta cuando habla la voz). [sonido, volumen] */
const AMBIENTE: Record<string, [string, number]> = { puerto: ["olas", 0.9], mar: ["olas", 1.0], campo: ["viento", 0.7], desierto: ["viento", 0.8], nieve: ["viento", 0.9], mina: ["picos", 0.35], canales: ["olas", 0.45], laguna: ["olas", 0.4], estepa: ["viento", 0.9], foro: ["viento", 0.4], palacio: ["viento", 0.35], selva: ["viento", 0.5], fabrica: ["picos", 0.3], calle: ["viento", 0.3], trinchera: ["viento", 0.8], montana: ["viento", 1.0], calzada: ["viento", 0.5], rio: ["olas", 0.45] };
const INTERIOR = new Set(["sala_trono", "interior", "despacho"]);

type Sonido = [string, number, number, number?]; // [archivo, segundo, volumen, duración]
/** Los efectos de cada plano: un sonido por cada cosa que aparece, pasos al caminar, golpes al caer, papel en el papel. */
const sonidosDe = (p: PlanoT): Sonido[] => {
  const sx: Sonido[] = [
    ...(p.capas ?? []).map((c) => ["territorio", c.t, 0.4] as Sonido),
    ...(p.pins ?? []).map((c) => ["chincheta", c.t + 0.1, 0.5] as Sonido),
    ...(p.iconos ?? []).map((c) => [SONIDO_COSA[String(c.cosa)] ?? "pop", c.t, 0.5, 1.6] as Sonido),
    ...(p.flechas ?? []).map((c) => ["whoosh", c.t, 0.45] as Sonido),
    ...(p.ejercitos ?? []).map((c) => ["pasos", c.t, 0.4, Math.min(2.5, Number(c.d ?? 2.5))] as Sonido),
    ...(p.asedios ?? []).map((c) => ["metal", c.t + 0.2, 0.35] as Sonido),
    ...(p.fuegos ?? []).map((c) => ["viento", c.t, 0.35, 1.6] as Sonido),
    ...(p.cosas ?? []).flatMap((c): Sonido[] => {
      if (c.palabra || c.frase) return [["letra", c.t, 0.35]];
      if (c.cifra) return [["cifra", c.t, 0.6]];
      const extra: Sonido[] = c.cosa && SONIDO_COSA[String(c.cosa)] ? [[SONIDO_COSA[String(c.cosa)], c.t + 0.08, 0.45, 1.6]] : [];
      if (c.tachar !== undefined || c.tachar_en !== undefined) extra.push(["golpe", typeof c.tachar_t === "number" ? c.tachar_t : c.t + (typeof c.tachar === "number" ? c.tachar : 0.6), 0.3]);
      if (c.tarjeta !== undefined || c.imagen) return [["tarjeta", c.t, 0.5], ...extra];
      return extra.length ? extra : [["pop", c.t, 0.4]];
    }),
    ...(p.bocadillos ?? []).map((c) => ["clic", c.t, 0.35] as Sonido),
    ...(p.rotulos ?? []).filter((r) => r.tipo !== "fecha").map((r) => (r.tipo === "titular" ? ["letra", r.t, 0.28] : ["pop", r.t, 0.4]) as Sonido),
    ...(p.actores ?? []).flatMap((a) => (a.acciones ?? []).flatMap((ac): Sonido[] => {
      if (ac.hace === "camina" || ac.hace === "entra" || ac.hace === "sale") return [[INTERIOR.has(p.decorado ?? "") ? "pasos_madera" : a.montado || (p.decorado === "campo" && a.traje?.includes("mozo")) ? "cascos" : "pasos", ac.t, 0.45, Math.min(2.2, ac.d ?? 2)]];
      if (ac.hace === "quita_sombrero") return [["tela", ac.t + 0.2, 0.3]];
      if (ac.hace === "cae") return [["golpe", ac.t + 0.4, 0.55]];
      if (ac.hace === "senala" || ac.hace === "encoge") return [["tela", ac.t, 0.18]];
      return [];
    })),
  ];
  if (p.tipo === "papel") sx.push(["hoja", p.ini, 0.45]);
  if (p.tipo === "archivo") sx.push(["tarjeta", p.ini, 0.35]);
  if (p.tipo === "portada") sx.push(["whoosh", p.ini, 0.3], ["corona", p.ini + 0.25, 0.3], ["letra", p.ini + 0.9, 0.3]);
  if (p.tipo === "capitulo") sx.push(["pergamino", p.ini, 0.55], ["campana", p.ini + 0.7, 0.18]);
  return sx;
};

export const VideoTerra: React.FC<Props> = ({ id, pista = "todo", plan }) => {
  cargarLetras();
  if (!plan) return null;
  const tema = TEMAS[plan.estilo ?? TEMA_CANAL];
  // la voz no va en el render (se pega luego con sonido.mjs); sí en Remotion Studio y al sacar la pista «voz»
  const voz = pista === "voz" || (pista === "todo" && !getRemotionEnvironment().isRendering);
  const fondo = pista !== "voz";
  const total = s(plan.duracion);
  const tramos = plan.palabras.map((w) => [s(w.ini), s(w.fin)] as const);
  const hablando = (f: number) => {
    let m = 0;
    for (const [i, fin] of tramos) {
      if (i - 6 > f) break;
      const d = f < i ? i - f : f > fin + 4 ? f - fin - 4 : 0;
      m = Math.max(m, 1 - Math.min(1, d / 6));
      if (m >= 1) break;
    }
    return m;
  };
  const conVoz = (f: number, solo: number, debajo: number) => solo + (debajo - solo) * hablando(f);
  const sonidos = plan.planos.flatMap(sonidosDe);
  // un «swoosh» suave cuando cambia el tipo de plano (mapa → gris → escena), como en la referencia
  plan.planos.forEach((p, i) => { if (i > 0 && p.tipo !== plan.planos[i - 1].tipo && p.tipo !== "capitulo") sonidos.push(["whoosh", Math.max(0, p.ini - 0.12), 0.22]); });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {plan.planos.map((p) => (
        <Sequence key={p.n} from={s(p.ini)} durationInFrames={Math.max(1, s(p.fin) - s(p.ini))}>
          <PlanoTerra p={p} plan={plan} tema={tema} />
        </Sequence>
      ))}
      {voz && <Audio src={staticFile(`videos/${id}/voz.mp3`)} />}
      {fondo && sonidos.map(([k, t, v, d = 1.5], i) => (
        <Sequence key={`s${i}`} from={s(t)} durationInFrames={s(d)}>
          <Audio src={staticFile(`sfx/${k}.mp3`)} volume={(f) => v * conVoz(f + s(t), 0.55, 0.15) * interpolate(f, [s(d) - 9, s(d)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        </Sequence>
      ))}
      {fondo && plan.planos.filter((p) => p.tipo === "escena" && (p.tormenta || AMBIENTE[p.decorado ?? ""])).map((p) => {
        const [k, v] = p.tormenta ? ["lluvia", 1.0] : AMBIENTE[p.decorado!];
        const dur = Math.max(1, s(p.fin) - s(p.ini));
        return (
          <Sequence key={`amb${p.n}`} from={s(p.ini)} durationInFrames={dur}>
            <Audio src={staticFile(`sfx/${k}.mp3`)} loop volume={(f) => v * conVoz(f + s(p.ini), 0.5, 0.08) * interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          </Sequence>
        );
      })}
      {fondo && plan.musica.map((m, i) => {
        const fin = i + 1 < plan.musica.length ? plan.musica[i + 1].t : plan.duracion;
        return (
          <Sequence key={`m${i}`} from={s(m.t)} durationInFrames={Math.max(1, s(fin) - s(m.t))}>
            <Audio src={staticFile(`musica/${m.pista}`)} loop volume={(f) => (m.volumen ?? 1) * conVoz(f + s(m.t), 0.09, 0.016) * interpolate(f, [0, 30, Math.max(31, s(fin) - s(m.t) - 30), Math.max(32, s(fin) - s(m.t))], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * interpolate(f + s(m.t), [total - 45, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
