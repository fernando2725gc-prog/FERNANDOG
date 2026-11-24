// El caballero cabezón: un muñeco por piezas (piernas con IK, tronco, cabeza con yelmo, brazos con hombro y codo).
// Todos los caballeros son el MISMO muñeco con distinto disfraz, como en el original. Medido sobre los fotogramas de
// la referencia: la cabeza es un huevo alto (más ancha que el cuerpo entero), casi siempre a tres cuartos, con la
// visera bajada y los ojos en la rendija; el cuerpo es estrecho, con brazos finos de placas, codales y guanteletes.
// El origen es el punto entre los pies, sobre el suelo; mide unos 440 de alto a escala 1.
import React from "react";
import { C, GROSOR } from "../estilo";
import { azar, clamp, lerp } from "./anim";

export type Pose = {
  bi: number; ci: number; // brazo de la izquierda de la pantalla: hombro y codo (grados; + = hacia fuera / arriba)
  bd: number; cd: number; // brazo de la derecha
  pieI: number; pieD: number; // separación de cada pie (+ = hacia fuera)
  alzaI: number; alzaD: number; // levantar un pie
  tronco: number; // inclinación del tronco (grados, + = a la derecha)
  cabeza: number; // inclinación de la cabeza (grados)
  cabezaY: number; // sube (−) o baja (+) la cabeza sobre el cuello: «encogerse»
  agacha: number; // baja la cadera (las rodillas se doblan solas)
  mira: number; // −1…1: gira la cabeza hacia un lado (tres cuartos)
  ojoX: number; ojoY: number; // −1…1: hacia dónde miran las pupilas
  aplasta: number; // + aplasta, − estira (todo el muñeco, desde los pies)
  salto: number; // altura sobre el suelo
  visera: number; // 0 = bajada (ojos en la rendija), 1 = levantada (se ve la cara)
};

export const POSE: Pose = {
  bi: 10, ci: -10, bd: 10, cd: -10, pieI: 0, pieD: 0, alzaI: 0, alzaD: 0, tronco: 0, cabeza: 0, cabezaY: 0,
  agacha: 0, mira: 0.35, ojoX: 0, ojoY: 0, aplasta: 0, salto: 0, visera: 0,
};

export type Ojos = "normal" | "susto" | "entornados" | "cerrados" | "felices" | "apretados" | "picaro" | "aturdido";
export type Boca = "nada" | "linea" | "sonrisa" | "picara" | "o" | "abierta" | "susto" | "dientes" | "triste";
export type Yelmo = "bacinete" | "cubo" | "nasal" | "capelina" | "galea" | "kabuto" | "corona" | "capucha" | "ninguno";
export type Ropa = "tabardo" | "gambeson" | "lorica" | "tunica" | "do";
export type Material = "placas" | "malla" | "tela" | "piel";
export type Figura = "cheuron" | "cruz" | "banda" | "cuartelado" | "ninguna";

export type Disfraz = {
  yelmo: Yelmo;
  tabardo: string; tabardoSombra: string;
  figura: Figura; figuraColor: string; figuraColor2?: string;
  placas: boolean; // brazos y piernas de placas (si no, malla); «brazos» y «piernas» mandan sobre esto
  ropa?: Ropa; // lo que lleva en el tronco (por defecto, tabardo)
  brazos?: Material; piernas?: Material;
  tela?: string; // color de la tela de brazos y piernas (y de la capucha)
  pelo?: string; barba?: string; // color del pelo (sin yelmo, corona) y de la barba
  bigote?: boolean;
  penacho?: string; // pluma en el yelmo
  cresta?: string; // cresta del yelmo romano
};

const brazosDe = (d: Disfraz): Material => d.brazos ?? (d.placas ? "placas" : "malla");
const piernasDe = (d: Disfraz): Material => d.piernas ?? (d.placas ? "placas" : "malla");
type Mat = { color: string; sombra?: string; brillo?: string };
const material = (m: Material, d: Disfraz): Mat =>
  m === "placas" ? { color: C.acero, sombra: C.aceroSombra, brillo: C.aceroBrillo }
  : m === "malla" ? { color: C.malla, sombra: C.aceroSombra }
  : m === "piel" ? { color: C.cara, sombra: C.caraSombra }
  : { color: d.tela ?? "#8a6a4a", sombra: "rgba(30,20,10,0.22)" };

export const PROTA: Disfraz = { yelmo: "bacinete", tabardo: C.amarillo, tabardoSombra: C.amarilloSombra, figura: "cheuron", figuraColor: C.rojo, placas: true };

type Props = {
  pose: Pose;
  previa?: Pose; // la pose de dos fotogramas antes: con ella se mueven solos el tabardo y el penacho
  frame: number;
  semilla?: number; // cambia el ritmo de respiración, parpadeo y mirada de cada muñeco
  disfraz?: Disfraz;
  ojos?: Ojos; boca?: Boca;
  cejas?: "nada" | "enfado" | "pena" | "picaro";
  habla?: boolean;
  sudor?: number; // 0…1: la gota de sudor baja; sin valor, no hay gota
  mojado?: boolean; // gotas de lluvia resbalando por el yelmo
  rubor?: boolean;
  manoI?: "abierta" | "puno"; manoD?: "abierta" | "puno";
  objI?: React.ReactNode; objD?: React.ReactNode; // lo que lleva en cada mano (se gira con el antebrazo)
  brazosDetras?: boolean;
  sombra?: boolean;
};

const t = C.tinta;
const G = GROSOR;

/** Un tramo de brazo o pierna: contorno y relleno con dos trazos redondos, sombra a un lado y brillo al otro. */
const Tramo: React.FC<{ x1: number; y1: number; x2: number; y2: number; ancho: number; color: string; sombra?: string; brillo?: string }> = ({ x1, y1, x2, y2, ancho, color, sombra, brillo }) => (
  <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={t} strokeWidth={ancho + G * 2} strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={ancho} strokeLinecap="round" />
    {sombra && <line x1={x1 + ancho * 0.24} y1={y1} x2={x2 + ancho * 0.24} y2={y2} stroke={sombra} strokeWidth={ancho * 0.3} strokeLinecap="round" />}
    {brillo && <line x1={x1 - ancho * 0.22} y1={y1 + 3} x2={x2 - ancho * 0.22} y2={y2 - 3} stroke={brillo} strokeWidth={ancho * 0.14} strokeLinecap="round" />}
  </>
);

const Remache: React.FC<{ x: number; y: number; r?: number; color?: string }> = ({ x, y, r = 3.2, color = t }) => <circle cx={x} cy={y} r={r} fill={color} />;

const Mano: React.FC<{ tipo: "abierta" | "puno"; mat: Material; lado: number }> = ({ tipo, mat, lado }) => {
  const placas = mat === "placas";
  const color = placas ? C.acero : mat === "malla" ? C.cuero : C.cara;
  const sombra = placas ? C.aceroSombra : mat === "malla" ? C.cueroSombra : C.caraSombra;
  // puño del guantelete (la campana de la muñeca) y la mano; sin placas, la mano desnuda o con guante
  const campana = placas ? <path d="M -15 -8 L 15 -8 L 17 6 L -17 6 Z" fill={color} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" /> : null;
  if (tipo === "puno")
    return (
      <g>
        <rect x={-15} y={2} width={30} height={26} rx={10} fill={color} stroke={t} strokeWidth={G * 0.9} />
        <path d="M -8 12 L -8 22 M 0 12 L 0 23 M 8 12 L 8 22" stroke={sombra} strokeWidth={2.6} strokeLinecap="round" />
        {campana}
      </g>
    );
  return (
    <g>
      {[-1.5, -0.5, 0.5, 1.5].map((i) => (
        <rect key={i} x={-4.5} y={14} width={9} height={22} rx={4.5} fill={color} stroke={t} strokeWidth={G * 0.7} transform={`rotate(${i * 12}) translate(${i * 6.5}, 0)`} />
      ))}
      <rect x={-4.5} y={4} width={9} height={18} rx={4.5} fill={color} stroke={t} strokeWidth={G * 0.7} transform={`rotate(${-lado * 64}) translate(0, 6)`} />
      <rect x={-14} y={0} width={28} height={22} rx={8} fill={color} stroke={t} strokeWidth={G * 0.9} />
      <path d="M -8 10 L 8 10" stroke={sombra} strokeWidth={2.6} strokeLinecap="round" />
      {campana}
    </g>
  );
};

const LARGO_BRAZO = 44, LARGO_ANTEBRAZO = 42, MUSLO = 46, ESPINILLA = 46, CADERA = 90;

export const Caballero: React.FC<Props> = (p) => {
  const pose = p.pose;
  const prev = p.previa ?? pose;
  const d = p.disfraz ?? PROTA;
  const sem = p.semilla ?? 1;
  const f = p.frame;
  // respirar y mecerse: nunca está quieto del todo; la cabeza sigue al tronco con retraso
  const periodo = 62 + azar(sem) * 18;
  const resp = Math.sin((f / periodo) * Math.PI * 2 + sem);
  const respCab = Math.sin(((f - 5) / periodo) * Math.PI * 2 + sem);
  const vaiven = Math.sin((f / (periodo * 1.7)) * Math.PI * 2 + sem * 2);
  const vaivenCab = Math.sin(((f - 8) / (periodo * 1.3)) * Math.PI * 2 + sem * 3);
  // parpadeo cada 2,5-4 s, 4 fotogramas
  const cada = 80 + Math.floor(azar(sem + 9) * 40);
  const parpadea = (f + Math.floor(azar(sem + 3) * cada)) % cada < 4;
  // movimiento secundario: el tabardo y el penacho se quedan atrás cuando el cuerpo se mueve
  const vel = (pose.tronco - prev.tronco) * 1.2 + (pose.salto - prev.salto) * 0.25 - (pose.agacha - prev.agacha) * 0.3 + ((pose.bd - prev.bd) - (pose.bi - prev.bi)) * 0.04;
  const ondea = clamp(-vel * 1.6 + vaiven * 1.2, -14, 14);

  const agacha = pose.agacha;
  const caderaY = -CADERA + agacha;
  // estirar al subir y aplastar al bajar, según la velocidad (además de lo que pida el gesto)
  const vs = pose.salto - prev.salto;
  const aplasta = pose.aplasta + clamp(-vs * 0.004, -0.07, 0.07);
  const s1 = 1 + aplasta * 0.6, s2 = 1 - aplasta;

  // piernas con IK: el pie se queda en el suelo y la rodilla se dobla hacia fuera
  const tp = piernasDe(d), tb = brazosDe(d);
  const mp = material(tp, d), mb = material(tb, d);
  const pierna = (lado: number, pie: number, alza: number) => {
    const hx = lado * 18, hy = caderaY;
    const fx = lado * (24 + pie), fy = -alza;
    let dx = fx - hx, dy = fy - hy;
    let dist = Math.hypot(dx, dy);
    const max = MUSLO + ESPINILLA - 0.5;
    if (dist > max) { dx *= max / dist; dy *= max / dist; dist = max; }
    const a = (MUSLO * MUSLO - ESPINILLA * ESPINILLA + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, MUSLO * MUSLO - a * a));
    const mx = hx + (dx * a) / dist, my = hy + (dy * a) / dist;
    const px = -dy / dist, py = dx / dist;
    const sg = Math.sign(px * lado) || 1;
    const kx = mx + px * h * sg, ky = my + py * h * sg;
    const ex = hx + dx, ey = hy + dy;
    return (
      <g key={lado}>
        <Tramo x1={hx} y1={hy} x2={kx} y2={ky} ancho={25} color={mp.color} sombra={mp.sombra} brillo={mp.brillo} />
        <Tramo x1={kx} y1={ky} x2={ex} y2={ey - 8} ancho={23} color={mp.color} sombra={mp.sombra} brillo={mp.brillo} />
        {tp === "placas" && (
          <g transform={`translate(${kx},${ky})`}>
            <path d="M -14 -4 Q 0 -16 14 -4 Q 12 10 0 12 Q -12 10 -14 -4 Z" fill={C.acero} stroke={t} strokeWidth={G * 0.75} strokeLinejoin="round" />
            <Remache x={0} y={1} r={2.8} />
          </g>
        )}
        <g transform={`translate(${ex},${ey}) scale(${lado},1)`}><Pie mat={tp} /></g>
      </g>
    );
  };

  const brazo = (lado: number, hombro: number, codo: number, mano: "abierta" | "puno", obj?: React.ReactNode) => {
    const a1 = -lado * hombro, a2 = -lado * codo;
    const hombrera = tb === "placas" || d.ropa === "lorica" ? C.acero : d.ropa === "do" ? d.tabardo : tb === "piel" ? d.tabardo : d.ropa === "gambeson" || d.ropa === "tunica" ? d.tabardo : tb === "tela" ? mb.color : d.tabardo;
    return (
      <g key={lado} transform={`translate(${lado * 44}, -86) rotate(${a1})`}>
        <Tramo x1={0} y1={0} x2={0} y2={LARGO_BRAZO} ancho={21} color={mb.color} sombra={mb.sombra} brillo={mb.brillo} />
        {tb === "placas" && <path d="M -11 20 Q 0 25 11 20" fill="none" stroke={C.aceroOscuro} strokeWidth={2.4} />}
        <g transform={`translate(0, ${LARGO_BRAZO}) rotate(${a2})`}>
          <Tramo x1={0} y1={0} x2={0} y2={LARGO_ANTEBRAZO} ancho={20} color={mb.color} sombra={mb.sombra} brillo={mb.brillo} />
          {tb === "placas" && (
            <g>
              {/* codal: cazoleta con su aleta */}
              <path d={`M ${lado * 4} -12 Q ${lado * 22} -6 ${lado * 18} 10 L ${lado * 2} 8 Z`} fill={C.acero} stroke={t} strokeWidth={G * 0.7} strokeLinejoin="round" />
              <circle r={10} fill={C.acero} stroke={t} strokeWidth={G * 0.75} />
              <Remache x={0} y={0} r={2.6} />
            </g>
          )}
          <g transform={`translate(0, ${LARGO_ANTEBRAZO})`}>
            <Mano tipo={mano} mat={tb} lado={lado} />
            {obj}
          </g>
        </g>
        {/* hombrera baja y pequeña: el brazo sale del costado, por debajo de la cabeza */}
        <path d="M -16 8 Q -18 -12 0 -14 Q 18 -12 16 8 Q 0 14 -16 8 Z" fill={hombrera} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
        <path d={`M ${-lado * 2} -9 Q ${lado * 11} -8 ${lado * 12} 2`} fill="none" stroke={hombrera === C.acero ? C.aceroBrillo : "rgba(255,255,255,0.4)"} strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  };

  // estela: si un brazo va rápido, se ven dos copias tenues de dónde estaba (como los fotogramas «smear» del original)
  const estela = (lado: number) => {
    const h = lado > 0 ? pose.bd : pose.bi, c = lado > 0 ? pose.cd : pose.ci;
    const h0 = lado > 0 ? prev.bd : prev.bi, c0 = lado > 0 ? prev.cd : prev.ci;
    if (Math.abs(h - h0) + Math.abs(c - c0) < 22) return null;
    return [0.35, 0.7].map((u, i) => (
      <g key={`e${lado}${i}`} opacity={0.16 + i * 0.1}>{brazo(lado, h0 + (h - h0) * u, c0 + (c - c0) * u, lado > 0 ? p.manoD ?? "puno" : p.manoI ?? "puno")}</g>
    ));
  };
  const brazos = (
    <>
      {estela(-1)}
      {estela(1)}
      {brazo(-1, pose.bi, pose.ci, p.manoI ?? "puno", p.objI)}
      {brazo(1, pose.bd, pose.cd, p.manoD ?? "puno", p.objD)}
    </>
  );

  // el tabardo (o lo que lleve): recto, y por abajo ondea (se queda atrás) con el movimiento
  const o = ondea;

  const tronco = (
    <g transform={`translate(0, ${caderaY}) rotate(${pose.tronco + vaiven * 1.3}) scale(1, ${1 + resp * 0.013})`}>
      <RopaTronco d={d} o={o} sem={sem} />
      {/* gola de acero */}
      <path d="M -40 -90 Q 0 -104 40 -90 L 34 -112 Q 0 -124 -34 -112 Z" fill={tb === "placas" || d.ropa === "lorica" ? C.acero : d.yelmo === "capucha" ? d.tela ?? C.cuero : tb === "piel" || d.ropa === "tunica" || d.ropa === "gambeson" ? d.tabardoSombra : C.malla} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
      {/* cabeza: sombra que proyecta sobre el pecho, y la cabeza */}
      <ellipse cx={8} cy={-84} rx={52} ry={12} fill="rgba(30,20,15,0.22)" />
      <g transform={`translate(0, ${-104 + respCab * 1.6 + pose.cabezaY}) rotate(${pose.cabeza - pose.tronco * 0.3 + vaivenCab * 1.8}) translate(0, -94)`}>
        <Cabeza {...p} disfraz={d} parpadea={parpadea} ondea={o} />
      </g>
      {!p.brazosDetras && brazos}
    </g>
  );

  return (
    <g transform={`translate(0, ${-pose.salto}) scale(${s1}, ${s2})`}>
      {Math.abs(vs) > 7 && [-24, 0, 24].map((x, i) => (
        <line key={i} x1={x} y1={vs > 0 ? 30 + pose.salto : -470} x2={x} y2={vs > 0 ? 80 + pose.salto : -520} stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
      ))}
      {p.sombra !== false && <ellipse cx={0} cy={pose.salto} rx={72 - Math.min(36, pose.salto * 0.2)} ry={12} fill="rgba(20,15,10,0.24)" />}
      {pierna(-1, pose.pieI, pose.alzaI)}
      {pierna(1, pose.pieD, pose.alzaD)}
      {p.brazosDetras && <g transform={`translate(0, ${caderaY}) rotate(${pose.tronco})`}>{brazos}</g>}
      {tronco}
    </g>
  );
};

/** El pie: escarpe de placas, bota de cuero o sandalia. Mira hacia +x (se refleja para el otro lado). */
const Pie: React.FC<{ mat: Material }> = ({ mat }) => {
  if (mat === "placas")
    return (
      <>
        <path d="M -12 -16 L 8 -16 Q 28 -11 34 0 L -14 0 Q -18 -9 -12 -16 Z" fill={C.acero} stroke={t} strokeWidth={G * 0.9} strokeLinejoin="round" />
        <path d="M 2 -15 L 4 -2 M 13 -12 L 15 -2" stroke={C.aceroSombra} strokeWidth={2.6} />
      </>
    );
  if (mat === "piel")
    return (
      <>
        <path d="M -12 -14 L 6 -14 Q 26 -10 30 0 L -14 0 Q -17 -8 -12 -14 Z" fill={C.cara} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
        <path d="M -8 -14 L -2 0 M 6 -12 L 10 0 M -12 -7 L 22 -7" stroke={C.cuero} strokeWidth={3} />
      </>
    );
  return <path d="M -13 -18 L 7 -18 Q 28 -12 32 0 L -15 0 Q -19 -10 -13 -18 Z" fill={C.cuero} stroke={t} strokeWidth={G * 0.9} strokeLinejoin="round" />;
};

/** Lo que lleva en el tronco: tabardo con su figura, gambesón acolchado, loriga romana, túnica o do samurái. */
const RopaTronco: React.FC<{ d: Disfraz; o: number; sem: number }> = ({ d, o, sem }) => {
  const ropa = d.ropa ?? "tabardo";
  const largo = ropa === "tunica" ? 22 : 6;
  const forma = `M -42 -92 Q 0 -86 42 -92 L ${46 + o * 0.6} ${largo} L ${7 + o} ${largo + 2} L ${o * 0.6} ${largo - 6} L ${-7 + o} ${largo + 2} L ${-46 + o * 0.6} ${largo} Z`;
  const cid = `tab-${sem}`;
  const cinto = (
    <>
      <path d="M -47 -30 Q 0 -20 47 -30 L 48 -19 Q 0 -9 -48 -19 Z" fill={C.cuero} stroke={t} strokeWidth={G * 0.75} strokeLinejoin="round" />
      <rect x={-7} y={-27} width={14} height={12} rx={2} fill={C.amarillo} stroke={t} strokeWidth={2.6} />
    </>
  );
  if (ropa === "lorica")
    return (
      <g>
        {/* túnica roja con faldón de tiras (pteruges) y la loriga de bandas de acero encima */}
        <path d={`M -44 -40 L 44 -40 L ${48 + o * 0.6} 16 L ${-48 + o * 0.6} 16 Z`} fill={d.tabardo} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        {[-30, -15, 0, 15, 30].map((x) => <rect key={x} x={x - 6 + o * 0.5} y={-24} width={12} height={34} rx={3} fill={C.cuero} stroke={t} strokeWidth={2.4} />)}
        <path d="M -44 -94 Q 0 -86 44 -94 L 46 -26 Q 0 -18 -46 -26 Z" fill={C.acero} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        {[-78, -62, -46].map((y) => <path key={y} d={`M -45 ${y} Q 0 ${y + 8} 45 ${y}`} fill="none" stroke={C.aceroOscuro} strokeWidth={3} />)}
        <path d="M 22 -90 L 40 -92 L 44 -28 L 26 -24 Z" fill={C.aceroSombra} opacity={0.7} />
        <path d="M 0 -88 L 0 -26" stroke={C.aceroOscuro} strokeWidth={2.5} />
      </g>
    );
  if (ropa === "do")
    return (
      <g>
        {/* faldón de láminas (kusazuri) y peto lacado con hileras de láminas atadas */}
        {[-34, -12, 12, 34].map((x) => <rect key={x} x={x - 12 + o * 0.5} y={-24} width={24} height={40} rx={3} fill={d.tabardo} stroke={t} strokeWidth={G * 0.7} />)}
        {[-34, -12, 12, 34].flatMap((x) => [-12, 0].map((y) => <line key={`${x}${y}`} x1={x - 11 + o * 0.5} y1={y} x2={x + 11 + o * 0.5} y2={y} stroke={d.figuraColor} strokeWidth={2.4} />))}
        <path d="M -44 -94 Q 0 -86 44 -94 L 46 -22 Q 0 -14 -46 -22 Z" fill={d.tabardo} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        {[-80, -68, -56, -44, -32].map((y) => <path key={y} d={`M -45 ${y} Q 0 ${y + 6} 45 ${y}`} fill="none" stroke={d.figuraColor} strokeWidth={2.6} />)}
        <path d="M 24 -90 L 42 -93 L 45 -24 L 28 -20 Z" fill={d.tabardoSombra} opacity={0.7} />
      </g>
    );
  return (
    <g>
      {ropa === "tabardo" && <path d={`M -40 -6 L 40 -6 L ${42 + o * 0.5} 14 Q 0 20 ${-42 + o * 0.5} 14 Z`} fill={C.malla} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" />}
      <path d={forma} fill={d.tabardo} stroke={t} strokeWidth={G} strokeLinejoin="round" />
      <clipPath id={cid}><path d={forma} /></clipPath>
      <g clipPath={`url(#${cid})`}>
        <rect x={22} y={-100} width={40} height={140} fill={d.tabardoSombra} transform={`skewX(${-o * 0.4})`} />
        {ropa === "gambeson"
          ? [-30, -15, 0, 15, 30].map((x) => <path key={x} d={`M ${x} -90 L ${x + o * 0.5} 10`} stroke={d.tabardoSombra} strokeWidth={3} />)
          : <path d={`M ${-12 + o * 0.5} -30 L ${-14 + o} 8 M ${14 + o * 0.5} -30 L ${16 + o} 8`} stroke={d.tabardoSombra} strokeWidth={3} opacity={0.6} />}
        {ropa === "gambeson" && [-70, -50].map((y) => <path key={y} d={`M -46 ${y} Q 0 ${y + 6} 46 ${y}`} fill="none" stroke={d.tabardoSombra} strokeWidth={3} />)}
      </g>
      {ropa === "tabardo" && <Figura d={d} />}
      {cinto}
    </g>
  );
};

const Figura: React.FC<{ d: Disfraz }> = ({ d }) => {
  const c = d.figuraColor;
  switch (d.figura) {
    case "cheuron":
      return <path d="M -26 -40 L 0 -68 L 26 -40 L 26 -26 L 0 -54 L -26 -26 Z" fill={c} stroke={t} strokeWidth={3.2} strokeLinejoin="round" />;
    case "cruz":
      return <path d="M -6 -78 L 6 -78 L 6 -62 L 22 -62 L 22 -51 L 6 -51 L 6 -36 L -6 -36 L -6 -51 L -22 -51 L -22 -62 L -6 -62 Z" fill={c} stroke={t} strokeWidth={3.2} strokeLinejoin="round" />;
    case "banda":
      return <path d="M -42 -84 L -26 -90 L 46 -30 L 44 -14 Z" fill={c} stroke={t} strokeWidth={3.2} strokeLinejoin="round" />;
    case "cuartelado":
      return (
        <>
          <path d="M 0 -88 Q 21 -88 42 -92 L 44 -40 L 0 -40 Z" fill={c} />
          <path d="M 0 -40 L -44 -40 L -46 6 L -7 8 L 0 0 Z" fill={d.figuraColor2 ?? c} />
        </>
      );
    default:
      return null;
  }
};

/** La cabeza. Centro en (0, 0); el huevo mide 228 de ancho y ~280 de alto. */
const Cabeza: React.FC<Props & { disfraz: Disfraz; parpadea: boolean; ondea: number }> = (p) => {
  const d = p.disfraz;
  const m = p.pose.mira;
  const sem = p.semilla ?? 1;
  const fx = m * 34; // la cara y la visera se corren hacia donde mira
  const id = `casco-${sem}`;
  let ojos = p.ojos ?? "normal";
  if (p.parpadea && (ojos === "normal" || ojos === "susto" || ojos === "picaro" || ojos === "entornados")) ojos = "cerrados";
  let boca = p.boca ?? "linea";
  if (p.habla && (boca === "linea" || boca === "nada")) boca = Math.floor(p.frame / 4 + sem) % 3 === 1 ? "linea" : "o";
  // mirada viva: si nadie le dice dónde mirar, las pupilas saltan de vez en cuando (sacadas)
  let ox = p.pose.ojoX, oy = p.pose.ojoY;
  if (Math.abs(ox) < 0.05 && Math.abs(oy) < 0.05) {
    const paso = 50 + Math.floor(azar(sem + 21) * 30);
    const k = Math.floor((p.frame + sem * 31) / paso);
    const u = clamp(((p.frame + sem * 31) % paso) / 3);
    const objetivo = (i: number) => (azar(i * 3 + sem) < 0.45 ? [0, 0] : [(azar(i + sem * 7) - 0.5) * 0.7, (azar(i + sem * 13) - 0.5) * 0.4]);
    const [ax, ay] = objetivo(k - 1), [bx, by] = objetivo(k);
    ox = lerp(ax, bx, u); oy = lerp(ay, by, u);
  }

  const rostro = <Rostro x={fx} ojos={ojos} boca={boca} cejas={p.cejas ?? "nada"} ox={ox} oy={oy} bigote={d.bigote} rubor={p.rubor} />;

  const gotas = p.mojado ? <Gotas frame={p.frame} sem={sem} /> : null;
  const sudor = p.sudor !== undefined ? (
    <path transform={`translate(${96 - m * 30}, ${-40 + p.sudor * 50}) scale(${0.6 + Math.min(1, p.sudor * 4) * 0.4})`} d="M 0 -26 Q 16 -2 14 8 Q 12 22 0 22 Q -12 22 -14 8 Q -16 -2 0 -26 Z" fill={C.sudor} stroke={t} strokeWidth={3.5} strokeLinejoin="round" />
  ) : null;
  const penacho = d.penacho ? (
    <path transform={`rotate(${p.ondea * 1.4} -10 -150)`} d="M -10 -150 Q 10 -205 80 -200 Q 40 -180 18 -142 Z" fill={d.penacho} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" />
  ) : null;

  if (d.yelmo === "ninguno" && !d.pelo)
    return (
      <g>
        <ellipse rx={104} ry={112} fill={C.cara} stroke={t} strokeWidth={G} />
        {rostro}
        {sudor}
      </g>
    );

  if (d.yelmo === "nasal")
    return (
      <g>
        {/* almófar de malla (cota) alrededor de la cara */}
        <clipPath id={id}><path d="M -108 30 C -112 -70 -64 -128 0 -128 C 64 -128 112 -70 108 30 C 106 84 88 112 60 120 L -60 120 C -88 112 -106 84 -108 30 Z" /></clipPath>
        <path d="M -108 30 C -112 -70 -64 -128 0 -128 C 64 -128 112 -70 108 30 C 106 84 88 112 60 120 L -60 120 C -88 112 -106 84 -108 30 Z" fill={C.malla} stroke={t} strokeWidth={G} />
        <g clipPath={`url(#${id})`}><Malla /></g>
        <rect x={fx - 70} y={-36} width={140} height={128} rx={34} fill={C.cara} stroke={t} strokeWidth={G} />
        {rostro}
        {/* casco cónico con cresta, banda dorada con remaches y nasal con correa */}
        <path d="M 0 -150 C 40 -130 86 -84 92 -36 L -92 -36 C -86 -84 -40 -130 0 -150 Z" fill={C.acero} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        <path d="M 0 -150 C 40 -130 86 -84 92 -36 L 40 -36 C 34 -90 16 -126 0 -150 Z" fill={C.aceroSombra} opacity={0.7} />
        <path d="M 0 -148 L 0 -40" stroke={C.aceroOscuro} strokeWidth={3} />
        <path d="M -30 -120 Q -52 -96 -62 -56" fill="none" stroke={C.aceroBrillo} strokeWidth={6} strokeLinecap="round" />
        <path d="M -96 -42 L 96 -42 L 96 -16 L -96 -16 Z" fill={C.amarillo} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
        {[-70, -35, 0, 35, 70].map((x) => <circle key={x} cx={x} cy={-29} r={3.6} fill="#fff4c9" stroke={t} strokeWidth={2} />)}
        <rect x={fx - 9} y={-20} width={18} height={66} rx={5} fill={C.acero} stroke={t} strokeWidth={G * 0.8} />
        {sudor}
      </g>
    );

  if (d.yelmo === "cubo") {
    // yelmo de cubo con cruz dorada y rendija (Sir Gastón)
    const cubo = "M -100 -132 Q -100 -146 -84 -146 L 84 -146 Q 100 -146 102 -130 L 106 96 Q 106 116 86 116 L -86 116 Q -106 116 -104 96 Z";
    return (
      <g>
        <clipPath id={id}><path d={cubo} /></clipPath>
        <path d={cubo} fill={C.acero} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        <g clipPath={`url(#${id})`}>
          <rect x={62} y={-160} width={60} height={300} fill={C.aceroSombra} />
          <path d="M -70 -130 L -70 100" stroke={C.aceroBrillo} strokeWidth={6} />
          <path d="M -84 -126 L -84 104" stroke={C.aceroSombra} strokeWidth={3} />
        </g>
        <path d={cubo} fill="none" stroke={t} strokeWidth={G} strokeLinejoin="round" />
        <rect x={-108} y={-22} width={216} height={26} fill={C.amarillo} stroke={t} strokeWidth={G * 0.8} />
        {[-70, -26, 26, 70].map((x) => <circle key={x} cx={x + fx * 0.3} cy={-9} r={4} fill="#fff4c9" stroke={t} strokeWidth={2.2} />)}
        <rect x={-96} y={6} width={192} height={36} rx={14} fill="#1f1b1a" />
        <clipPath id={`${id}-r`}><rect x={-96} y={6} width={192} height={36} rx={14} /></clipPath>
        <g clipPath={`url(#${id}-r)`}><g transform="translate(0, 7)"><OjosVisera x={fx * 0.5} ojos={ojos} ox={ox} oy={oy} tapaColor={C.acero} /></g></g>
        <rect x={fx * 0.5 - 11} y={-22} width={22} height={138} fill={C.amarillo} stroke={t} strokeWidth={G * 0.8} />
        {[0, 1, 2].flatMap((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={fx * 0.5 + 34 + i * 16} cy={66 + j * 18} r={4} fill={t} />))}
        {gotas}
        {penacho}
      </g>
    );
  }

  // cara para los yelmos abiertos (y sin yelmo): un rectángulo redondeado como en el original
  const caraAbierta = (
    <>
      <rect x={fx - 70} y={-36} width={140} height={128} rx={34} fill={C.cara} stroke={t} strokeWidth={G} />
      {rostro}
      {d.barba && <path d={`M ${fx - 56} 50 Q ${fx} 64 ${fx + 56} 50 Q ${fx + 50} 104 ${fx} 112 Q ${fx - 50} 104 ${fx - 56} 50 Z`} fill={d.barba} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" />}
      {d.barba && <path d={`M ${fx - 12} 66 Q ${fx + 4} 72 ${fx + 18} 60`} fill="none" stroke={t} strokeWidth={4} strokeLinecap="round" />}
    </>
  );
  const coif = (color: string, malla: boolean) => (
    <>
      <clipPath id={`${id}-c`}><path d="M -108 30 C -112 -70 -64 -128 0 -128 C 64 -128 112 -70 108 30 C 106 84 88 112 60 120 L -60 120 C -88 112 -106 84 -108 30 Z" /></clipPath>
      <path d="M -108 30 C -112 -70 -64 -128 0 -128 C 64 -128 112 -70 108 30 C 106 84 88 112 60 120 L -60 120 C -88 112 -106 84 -108 30 Z" fill={color} stroke={t} strokeWidth={G} />
      {malla ? <g clipPath={`url(#${id}-c)`}><Malla /></g> : <path d="M 50 -110 Q 100 -60 100 30 Q 96 90 60 116 L 70 116 Q 104 80 108 30 Q 110 -70 60 -116 Z" fill="rgba(30,20,10,0.2)" />}
    </>
  );

  if (d.yelmo === "capucha")
    return (
      <g>
        {coif(d.tela ?? C.cuero, false)}
        {caraAbierta}
        {sudor}
      </g>
    );

  if (d.yelmo === "corona" || (d.yelmo === "ninguno" && d.pelo)) {
    const pelo = d.pelo ?? "#6b3f22";
    return (
      <g>
        <path d="M -112 40 C -118 -60 -70 -132 0 -132 C 70 -132 118 -60 112 40 C 110 90 90 112 70 112 L -70 112 C -90 112 -110 90 -112 40 Z" fill={pelo} stroke={t} strokeWidth={G} />
        <ellipse cx={fx} cy={14} rx={90} ry={100} fill={C.cara} stroke={t} strokeWidth={G} />
        <path d={`M ${fx - 92} -30 Q ${fx - 60} -96 ${fx} -98 Q ${fx + 70} -96 ${fx + 92} -30 Q ${fx + 40} -66 ${fx - 10} -60 Q ${fx - 60} -58 ${fx - 92} -30 Z`} fill={pelo} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" />
        {rostro}
        {d.barba && <path d={`M ${fx - 70} 40 Q ${fx} 60 ${fx + 70} 40 Q ${fx + 64} 112 ${fx} 122 Q ${fx - 64} 112 ${fx - 70} 40 Z`} fill={d.barba} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" />}
        {d.barba && <path d={`M ${fx - 14} 58 Q ${fx + 4} 66 ${fx + 20} 52`} fill="none" stroke={t} strokeWidth={4} strokeLinecap="round" />}
        {d.yelmo === "corona" && (
          <g transform={`translate(${fx * 0.6}, -96)`}>
            <path d="M -70 20 L -76 -36 L -40 -6 L -16 -46 L 0 -10 L 16 -46 L 40 -6 L 76 -36 L 70 20 Z" fill={C.amarillo} stroke={t} strokeWidth={G * 0.9} strokeLinejoin="round" />
            <path d="M 30 -6 L 60 -20 L 64 18 L 40 20 Z" fill={C.amarilloSombra} />
            {[-40, 0, 40].map((x) => <circle key={x} cx={x} cy={4} r={6} fill={C.rojo} stroke={t} strokeWidth={2.4} />)}
          </g>
        )}
        {sudor}
      </g>
    );
  }

  if (d.yelmo === "capelina")
    return (
      <g>
        {/* capelina: sombrero de hierro de ala ancha sobre la cofia de malla (arqueros y peones) */}
        {coif(C.malla, true)}
        {caraAbierta}
        <path d="M -70 -40 C -70 -110 -36 -136 0 -136 C 36 -136 70 -110 70 -40 Z" fill={C.acero} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        <path d="M 20 -132 C 50 -122 70 -90 70 -40 L 40 -40 C 40 -84 34 -118 20 -132 Z" fill={C.aceroSombra} opacity={0.7} />
        <ellipse cx={0} cy={-40} rx={142} ry={24} fill={C.acero} stroke={t} strokeWidth={G} />
        <path d="M -130 -36 Q 0 -6 130 -36" fill="none" stroke={C.aceroSombra} strokeWidth={6} />
        <path d="M -40 -118 Q -58 -96 -62 -60" fill="none" stroke={C.aceroBrillo} strokeWidth={6} strokeLinecap="round" />
        {d.penacho && <path d="M 30 -120 Q 70 -170 120 -150 Q 80 -140 46 -108 Z" fill={d.penacho} stroke={t} strokeWidth={G * 0.8} />}
        {sudor}
      </g>
    );

  if (d.yelmo === "galea")
    return (
      <g>
        {/* casco romano: cuenco con guardanuca, carrilleras y cresta de crin */}
        {d.cresta && (
          <g transform={`rotate(${p.ondea * 0.8} 0 -130)`}>
            <path d="M -86 -120 Q 0 -230 86 -120 L 70 -110 Q 0 -196 -70 -110 Z" fill={d.cresta} stroke={t} strokeWidth={G * 0.9} strokeLinejoin="round" />
            {[-60, -36, -12, 12, 36, 60].map((x) => <path key={x} d={`M ${x} ${-128 - (60 - Math.abs(x)) * 0.9} L ${x * 0.8} ${-118 - (60 - Math.abs(x)) * 0.6}`} stroke="rgba(0,0,0,0.35)" strokeWidth={3} />)}
          </g>
        )}
        <path d="M -112 0 C -112 -90 -64 -140 0 -140 C 64 -140 112 -90 112 0 L 126 30 L 96 34 L 92 -6 L -92 -6 L -96 34 L -126 30 Z" fill={C.acero} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        <path d="M 40 -134 C 90 -110 112 -60 112 0 L 126 30 L 96 34 L 92 -6 L 60 -6 C 70 -70 60 -112 40 -134 Z" fill={C.aceroSombra} opacity={0.75} />
        <path d="M -50 -118 Q -84 -90 -92 -40" fill="none" stroke={C.aceroBrillo} strokeWidth={7} strokeLinecap="round" />
        <rect x={fx - 72} y={-20} width={144} height={112} rx={30} fill={C.cara} stroke={t} strokeWidth={G} />
        {rostro}
        <path d="M -96 -22 L -110 -24 L -110 6 L -96 6 Z M 96 -22 L 110 -24 L 110 6 L 96 6 Z" fill={C.amarillo} stroke={t} strokeWidth={3} />
        <path d="M -104 -16 L 104 -16" stroke={C.amarillo} strokeWidth={8} />
        <path d="M -104 -16 L 104 -16" stroke={t} strokeWidth={2} opacity={0.4} />
        {/* carrilleras */}
        <path d={`M ${fx - 92} -6 Q ${fx - 98} 60 ${fx - 70} 100 L ${fx - 46} 92 Q ${fx - 54} 40 ${fx - 60} -4 Z`} fill={C.acero} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
        <path d={`M ${fx + 92} -6 Q ${fx + 98} 60 ${fx + 70} 100 L ${fx + 46} 92 Q ${fx + 54} 40 ${fx + 60} -4 Z`} fill={C.aceroSombra} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
        {sudor}
      </g>
    );

  if (d.yelmo === "kabuto")
    return (
      <g>
        {/* kabuto: cuenco lacado, cubrenuca en abanico, orejeras vueltas y cuernos dorados */}
        <path d="M -150 30 Q -130 -10 -96 -20 L 96 -20 Q 130 -10 150 30 Q 120 50 96 40 L -96 40 Q -120 50 -150 30 Z" fill={d.tabardo} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        {[0, 14].map((y) => <path key={y} d={`M -140 ${24 + y * 0.3} Q 0 ${-6 + y} 140 ${24 + y * 0.3}`} fill="none" stroke={d.figuraColor} strokeWidth={3} />)}
        <rect x={fx - 70} y={-36} width={140} height={128} rx={34} fill={C.cara} stroke={t} strokeWidth={G} />
        {rostro}
        <path d="M -100 -26 C -100 -110 -56 -142 0 -142 C 56 -142 100 -110 100 -26 Z" fill={d.tabardoSombra} stroke={t} strokeWidth={G} strokeLinejoin="round" />
        {[-60, -30, 0, 30, 60].map((x) => <path key={x} d={`M ${x * 0.3} -140 Q ${x} -90 ${x * 1.5} -28`} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={3} />)}
        <path d="M -100 -26 L -124 -40 L -118 -6 Z M 100 -26 L 124 -40 L 118 -6 Z" fill={d.tabardo} stroke={t} strokeWidth={G * 0.8} strokeLinejoin="round" />
        <path d="M -104 -30 L 104 -30" stroke={t} strokeWidth={G} />
        <path d={`M ${fx * 0.6 - 10} -120 Q ${fx * 0.6 - 60} -170 ${fx * 0.6 - 90} -220 Q ${fx * 0.6 - 40} -190 ${fx * 0.6} -132 Q ${fx * 0.6 + 40} -190 ${fx * 0.6 + 90} -220 Q ${fx * 0.6 + 60} -170 ${fx * 0.6 + 10} -120 Z`} fill={C.amarillo} stroke={t} strokeWidth={G * 0.85} strokeLinejoin="round" />
        {sudor}
      </g>
    );

  // ── bacinete: huevo alto con visera articulada (bajada o levantada) y barbera
  const casco = "M -6 -160 C 66 -156 114 -86 114 6 C 114 66 96 104 66 118 L -66 118 C -96 104 -114 66 -114 6 C -114 -86 -76 -162 -6 -160 Z";
  const v = clamp(p.pose.visera);
  const ancho = 1 - Math.abs(m) * 0.18; // la visera se estrecha al girar
  const sv = lerp(1, 0.5, v);
  return (
    <g>
      <clipPath id={id}><path d={casco} /></clipPath>
      <path d={casco} fill={C.aceroSombra} stroke={t} strokeWidth={G} />
      <g clipPath={`url(#${id})`}>
        <ellipse cx={-18 + fx * 0.2} cy={-10} rx={120} ry={150} fill={C.acero} />
        <path d="M -76 -96 Q -50 -140 -4 -148" fill="none" stroke={C.aceroBrillo} strokeWidth={8} strokeLinecap="round" />
        <path d="M -92 -40 Q -96 -10 -92 20" fill="none" stroke={C.aceroBrillo} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
        {/* abertura de la cara (se ve cuando la visera sube) */}
        <rect x={fx - 80} y={-40} width={160} height={124} rx={40} fill={C.cara} stroke={t} strokeWidth={G} />
        {rostro}
      </g>
      <path d={casco} fill="none" stroke={t} strokeWidth={G} />
      {/* barbera: tapa la barbilla */}
      <path d={`M ${fx - 82} 62 Q ${fx} 52 ${fx + 82} 62 L ${fx + 76} 112 Q ${fx} 124 ${fx - 76} 112 Z`} fill={C.acero} stroke={t} strokeWidth={G} strokeLinejoin="round" />
      <path d={`M ${fx + 40} 58 Q ${fx + 70} 60 ${fx + 82} 62 L ${fx + 76} 112 Q ${fx + 60} 118 ${fx + 44} 120 Z`} fill={C.aceroSombra} opacity={0.8} />
      {[0, 1, 2].map((i) => <circle key={i} cx={fx + 26 + i * 12} cy={82} r={3} fill={t} />)}
      {/* pivotes de la visera a los lados */}
      <circle cx={-98 + fx * 0.25} cy={-16} r={7} fill={C.amarillo} stroke={t} strokeWidth={2.6} />
      <circle cx={98 + fx * 0.25} cy={-16} r={7} fill={C.amarillo} stroke={t} strokeWidth={2.6} />
      {/* la visera: bajada tapa la cara; al subir se va a la frente y se acorta (está de canto) */}
      <g transform={`translate(${fx}, ${lerp(10, -104, v)}) scale(${ancho}, ${sv})`}>
        <path d="M -86 -66 Q -86 -88 -62 -90 L 62 -90 Q 88 -88 88 -64 L 90 40 Q 90 76 58 80 L -56 80 Q -88 76 -88 40 Z" fill={C.acero} stroke={t} strokeWidth={G / sv} strokeLinejoin="round" />
        <path d="M 48 -88 Q 86 -86 88 -64 L 90 40 Q 90 74 60 80 L 56 80 Q 74 40 66 -88 Z" fill={C.aceroSombra} opacity={0.85} />
        <path d="M -70 -74 L 40 -74" stroke={C.aceroBrillo} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
        {/* rendija con los ojos dentro (solo con la visera bajada) */}
        <rect x={-74} y={-22} width={148} height={36} rx={14} fill="#1f1b1a" />
        {v < 0.3 && (
          <>
            <clipPath id={`${id}-r`}><rect x={-74} y={-22} width={148} height={36} rx={14} /></clipPath>
            <g clipPath={`url(#${id}-r)`}><g transform="translate(0, -20)"><OjosVisera x={0} ojos={ojos} ox={ox} oy={oy} tapaColor={C.acero} /></g></g>
          </>
        )}
        <path d="M 0 18 L 0 78" stroke={C.aceroOscuro} strokeWidth={3} />
        {[0, 1, 2].flatMap((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={22 + i * 13} cy={36 + j * 14} r={3.4} fill={t} />))}
      </g>
      {v < 0.4 && gotas}
      {sudor}
      {penacho}
    </g>
  );
};

/** Gotas de lluvia que resbalan por el yelmo (con su contorno, como en el original). */
const Gotas: React.FC<{ frame: number; sem: number }> = ({ frame, sem }) => (
  <g>
    {Array.from({ length: 7 }).map((_, i) => {
      const per = 70 + azar(i + sem) * 50;
      const u = ((frame + azar(i * 3 + sem) * per) % per) / per;
      const x = -80 + azar(i * 7 + sem) * 160;
      const y = -130 + u * 200 + azar(i * 5) * 30;
      const a = Math.min(1, u * 6, (1 - u) * 5);
      return <path key={i} opacity={a} transform={`translate(${x}, ${y}) scale(0.55)`} d="M 0 -14 Q 9 0 8 6 Q 6 13 0 13 Q -6 13 -8 6 Q -9 0 0 -14 Z" fill="#e8f1f8" stroke={C.aceroOscuro} strokeWidth={3} />;
    })}
  </g>
);

const Malla: React.FC = () => (
  <g opacity={0.4} stroke={C.tinta} strokeWidth={1.8} fill="none">
    {Array.from({ length: 11 }).flatMap((_, i) =>
      Array.from({ length: 16 }).map((__, j) => <path key={`${i}-${j}`} d={`M ${-104 + j * 14 + (i % 2) * 7} ${-108 + i * 21} q 4 5 8 0`} />),
    )}
  </g>
);

const OjosVisera: React.FC<{ x: number; ojos: Ojos; ox: number; oy: number; tapaColor: string }> = ({ x, ojos, ox, oy, tapaColor }) => (
  <>
    {[-1, 1].map((l) => {
      const cx = x + l * 32;
      if (ojos === "cerrados") return <path key={l} d={`M ${cx - 17} 16 Q ${cx} 22 ${cx + 17} 16`} stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" />;
      if (ojos === "felices") return <path key={l} d={`M ${cx - 17} 22 Q ${cx} 6 ${cx + 17} 22`} stroke="#fff" strokeWidth={5.5} fill="none" strokeLinecap="round" />;
      if (ojos === "apretados") return <path key={l} d={`M ${cx - l * 14} 7 L ${cx + l * 12} 16 L ${cx - l * 14} 25`} stroke="#fff" strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      if (ojos === "aturdido") return <path key={l} d={`M ${cx - 10} 6 L ${cx + 10} 26 M ${cx + 10} 6 L ${cx - 10} 26`} stroke="#fff" strokeWidth={5} strokeLinecap="round" />;
      const tapa = ojos === "entornados" ? 0.5 : ojos === "picaro" && l === -1 ? 0.45 : 0;
      return (
        <g key={l}>
          <rect x={cx - 22} y={3} width={44} height={27} rx={13} fill="#fff" stroke={C.tinta} strokeWidth={3} />
          <circle cx={cx + ox * 11} cy={17 + oy * 6} r={ojos === "susto" ? 4.5 : 8} fill={C.tinta} />
          {tapa > 0 && (
            <>
              <rect x={cx - 24} y={0} width={48} height={27 * tapa + 3} fill={tapaColor} />
              <path d={`M ${cx - 22} ${3 + 27 * tapa} L ${cx + 22} ${3 + 27 * tapa}`} stroke={C.tinta} strokeWidth={3.5} strokeLinecap="round" />
            </>
          )}
        </g>
      );
    })}
  </>
);

const Rostro: React.FC<{ x: number; ojos: Ojos; boca: Boca; cejas: string; ox: number; oy: number; bigote?: boolean; rubor?: boolean }> = ({ x, ojos, boca, cejas, ox, oy, bigote, rubor }) => {
  const ey = 4;
  const ojo = (l: number) => {
    const cx = x + l * 30;
    switch (ojos) {
      case "cerrados":
        return <path key={l} d={`M ${cx - 14} ${ey + 2} Q ${cx} ${ey + 9} ${cx + 14} ${ey + 2}`} stroke={t} strokeWidth={4} fill="none" strokeLinecap="round" />;
      case "felices":
        return <path key={l} d={`M ${cx - 14} ${ey + 6} Q ${cx} ${ey - 8} ${cx + 14} ${ey + 6}`} stroke={t} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
      case "apretados":
        return <path key={l} d={`M ${cx - l * 13} ${ey - 10} L ${cx + l * 11} ${ey} L ${cx - l * 13} ${ey + 10}`} stroke={t} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "aturdido":
        return <path key={l} d={`M ${cx - 10} ${ey - 10} L ${cx + 10} ${ey + 10} M ${cx + 10} ${ey - 10} L ${cx - 10} ${ey + 10}`} stroke={t} strokeWidth={4.5} strokeLinecap="round" />;
      default: {
        const grande = ojos === "susto";
        const rx = grande ? 18 : 15, ry = grande ? 22 : 18;
        const tapa = ojos === "entornados" ? 0.52 : ojos === "picaro" && l === -1 ? 0.48 : 0;
        const kid = `tapa-${l}-${Math.round(x * 10)}`;
        return (
          <g key={l}>
            <ellipse cx={cx} cy={ey} rx={rx} ry={ry} fill="#fff" stroke={t} strokeWidth={3.6} />
            <circle cx={cx + ox * (rx - 7)} cy={ey + oy * (ry - 8)} r={grande ? 4.5 : 7} fill={t} />
            {tapa > 0 && (
              <>
                <clipPath id={kid}><ellipse cx={cx} cy={ey} rx={rx} ry={ry} /></clipPath>
                <rect clipPath={`url(#${kid})`} x={cx - rx - 2} y={ey - ry - 2} width={rx * 2 + 4} height={ry * 2 * tapa + 2} fill={C.cara} />
                <path d={`M ${cx - rx} ${ey - ry + ry * 2 * tapa} L ${cx + rx} ${ey - ry + ry * 2 * tapa}`} stroke={t} strokeWidth={4} strokeLinecap="round" />
                <ellipse cx={cx} cy={ey} rx={rx} ry={ry} fill="none" stroke={t} strokeWidth={3.6} />
              </>
            )}
          </g>
        );
      }
    }
  };
  const by = 40, bx = x + 4;
  let bocaEl: React.ReactNode = null;
  switch (boca) {
    case "linea": bocaEl = <path d={`M ${bx - 10} ${by} L ${bx + 10} ${by}`} stroke={t} strokeWidth={4} strokeLinecap="round" />; break;
    case "sonrisa": bocaEl = <path d={`M ${bx - 16} ${by - 4} Q ${bx} ${by + 11} ${bx + 16} ${by - 4}`} stroke={t} strokeWidth={4} fill="none" strokeLinecap="round" />; break;
    case "picara": bocaEl = <path d={`M ${bx - 13} ${by + 3} Q ${bx + 4} ${by + 8} ${bx + 18} ${by - 7}`} stroke={t} strokeWidth={4} fill="none" strokeLinecap="round" />; break;
    case "triste": bocaEl = <path d={`M ${bx - 13} ${by + 6} Q ${bx} ${by - 6} ${bx + 13} ${by + 6}`} stroke={t} strokeWidth={4} fill="none" strokeLinecap="round" />; break;
    case "o": bocaEl = <ellipse cx={bx} cy={by + 2} rx={7} ry={9} fill="#5a2a24" stroke={t} strokeWidth={3.4} />; break;
    case "abierta": bocaEl = <path d={`M ${bx - 17} ${by - 4} Q ${bx} ${by - 2} ${bx + 17} ${by - 4} Q ${bx + 13} ${by + 20} ${bx} ${by + 20} Q ${bx - 13} ${by + 20} ${bx - 17} ${by - 4} Z`} fill="#5a2a24" stroke={t} strokeWidth={3.4} strokeLinejoin="round" />; break;
    case "susto": bocaEl = <path d={`M ${bx - 17} ${by + 2} q 4.25 -7 8.5 0 t 8.5 0 t 8.5 0 t 8.5 0`} stroke={t} strokeWidth={3.8} fill="none" strokeLinecap="round" />; break;
    case "dientes": bocaEl = (
      <g>
        <rect x={bx - 19} y={by - 8} width={38} height={17} rx={6} fill="#fff" stroke={t} strokeWidth={3.4} />
        <path d={`M ${bx - 19} ${by + 0.5} L ${bx + 19} ${by + 0.5} M ${bx - 6} ${by - 8} L ${bx - 6} ${by + 9} M ${bx + 6} ${by - 8} L ${bx + 6} ${by + 9}`} stroke={t} strokeWidth={2.4} />
      </g>
    ); break;
  }
  const ceja = (l: number) => {
    const cx = x + l * 30, cy = ey - 30;
    if (cejas === "enfado") return <path key={l} d={`M ${cx - 14} ${cy} L ${cx + 14} ${cy}`} transform={`rotate(${l * 18} ${cx} ${cy})`} stroke={t} strokeWidth={5} strokeLinecap="round" />;
    if (cejas === "pena") return <path key={l} d={`M ${cx - 13} ${cy} L ${cx + 13} ${cy}`} transform={`rotate(${-l * 18} ${cx} ${cy})`} stroke={t} strokeWidth={5} strokeLinecap="round" />;
    if (cejas === "picaro") return <path key={l} d={l === 1 ? `M ${cx - 13} ${cy - 8} Q ${cx} ${cy - 16} ${cx + 13} ${cy - 8}` : `M ${cx - 13} ${cy + 6} L ${cx + 13} ${cy + 4}`} stroke={t} strokeWidth={5} fill="none" strokeLinecap="round" />;
    return null;
  };
  return (
    <g>
      {ojo(-1)}
      {ojo(1)}
      {ceja(-1)}
      {ceja(1)}
      {rubor && [-1, 1].map((l) => <ellipse key={l} cx={x + l * 48} cy={28} rx={12} ry={6} fill="#f2a59a" opacity={0.7} />)}
      {bigote && <path d={`M ${x} 26 Q ${x - 14} 20 ${x - 30} 34 Q ${x - 22} 40 ${x - 8} 34 Q ${x} 32 ${x} 30 Q ${x} 32 ${x + 8} 34 Q ${x + 22} 40 ${x + 30} 34 Q ${x + 14} 20 ${x} 26 Z`} fill="#6b3f22" stroke={t} strokeWidth={3.5} strokeLinejoin="round" />}
      {bocaEl}
    </g>
  );
};
