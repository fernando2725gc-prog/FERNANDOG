// Cómo se pinta una forma según el tema (A plano, B cabezón, C recortable, D libro). Todo lo de la plantilla (muñecos,
// objetos, decorados, tarjetas) pasa por <Forma>, así cambiar de estilo es cambiar el tema y no los dibujos.
import React from "react";
import { Tema } from "./tema";

/** Va una vez dentro de cada <svg> de la plantilla: tramas, máscaras de sombra y la sombra del papel. */
export const DefsTerra: React.FC<{ tema: Tema }> = ({ tema }) => (
  <defs>
    {/* sombra dura a la derecha (cabezón) y sombra suave (libro), en unidades de la propia forma */}
    <linearGradient id="t-lado-g" x1="0" y1="0" x2="1" y2="0.25">
      <stop offset="0.6" stopColor="#000" />
      <stop offset="0.6" stopColor="#fff" />
    </linearGradient>
    <mask id="t-lado" maskContentUnits="objectBoundingBox">
      <rect x="0" y="0" width="1" height="1" fill="url(#t-lado-g)" />
    </mask>
    <linearGradient id="t-suave-g" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0.35" stopColor="#000" />
      <stop offset="1" stopColor="#fff" />
    </linearGradient>
    <mask id="t-suave" maskContentUnits="objectBoundingBox">
      <rect x="0" y="0" width="1" height="1" fill="url(#t-suave-g)" />
    </mask>
    <pattern id="t-trama" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="7" stroke={tema.tinta} strokeWidth="1.3" />
    </pattern>
    <filter id="t-papel" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="5" dy="7" stdDeviation="3.5" floodColor="#2a1a0a" floodOpacity="0.38" />
    </filter>
    <filter id="t-sombra" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#000" floodOpacity="0.35" />
    </filter>
  </defs>
);

/** Aclara u oscurece un color #rrggbb (k > 0 aclara, k < 0 oscurece). */
export const tono = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
};

/** Mezcla un color con otro (para la acuarela del libro: un poco del papel en cada color). */
export const mezcla = (a: string, b: string, k: number) => {
  const p = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const x = p(a), y = p(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
};

type Geo = { d?: string; cx?: number; cy?: number; r?: number; rx?: number; ry?: number; x?: number; y?: number; w?: number; h?: number; esq?: number };

const Geom: React.FC<Geo & React.SVGProps<SVGElement>> = ({ d, cx, cy, r, rx, ry, x, y, w, h, esq, ...rest }) => {
  const props = rest as Record<string, unknown>;
  if (d) return <path d={d} {...props} />;
  if (r !== undefined) return <circle cx={cx} cy={cy} r={r} {...props} />;
  if (rx !== undefined) return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...props} />;
  return <rect x={x} y={y} width={w} height={h} rx={esq ?? 0} {...props} />;
};

/** Una forma con relleno, pintada a la manera del tema. «sombra» = color de la sombra (si no, el relleno oscurecido). */
export const Forma: React.FC<Geo & { tema: Tema; fill: string; sombra?: string; brillo?: boolean; grosor?: number; sinBorde?: boolean }> = ({ tema, fill, sombra, brillo, grosor, sinBorde, ...g }) => {
  const sw = (grosor ?? 1) * tema.trazo;
  const jl = { strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (tema.dibujo) {
    case "plano":
      return <Geom {...g} fill={fill} stroke={sinBorde ? "none" : tema.tinta} strokeWidth={sw} {...jl} />;
    case "cabezon":
      return (
        <g>
          <Geom {...g} fill={fill} />
          <Geom {...g} fill={sombra ?? tono(fill, -0.22)} mask="url(#t-lado)" />
          {brillo && g.r !== undefined && <ellipse cx={(g.cx ?? 0) - g.r * 0.42} cy={(g.cy ?? 0) - g.r * 0.45} rx={g.r * 0.2} ry={g.r * 0.12} fill="#fff" opacity={0.55} transform={`rotate(-35 ${(g.cx ?? 0) - g.r * 0.42} ${(g.cy ?? 0) - g.r * 0.45})`} />}
          {!sinBorde && <Geom {...g} fill="none" stroke={tema.tinta} strokeWidth={sw} {...jl} />}
        </g>
      );
    case "papel":
      return <Geom {...g} fill={fill} stroke={sinBorde ? "none" : "#fffaf2"} strokeWidth={5 * (grosor ?? 1)} paintOrder="stroke" {...jl} />;
    case "tinta": {
      const f = mezcla(fill, "#efe2c4", 0.28);
      return (
        <g>
          <Geom {...g} fill={f} opacity={0.92} />
          <Geom {...g} fill="url(#t-trama)" mask="url(#t-suave)" opacity={0.55} />
          {!sinBorde && <Geom {...g} fill="none" stroke={tema.tinta} strokeWidth={sw} {...jl} />}
          {!sinBorde && <Geom {...g} fill="none" stroke={tema.tinta} strokeWidth={sw * 0.45} opacity={0.5} transform="translate(1.8,-1.4)" {...jl} />}
        </g>
      );
    }
  }
};

/** Una línea (brazos, piernas, palos): de palito en A y D, gruesa y con color en B y C. */
export const Linea: React.FC<{ tema: Tema; pts: [number, number][]; color?: string; ancho?: number }> = ({ tema, pts, color, ancho }) => {
  const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L");
  const a = ancho ?? tema.palito;
  const jl = { strokeLinejoin: "round" as const, strokeLinecap: "round" as const, fill: "none" };
  if (tema.dibujo === "plano") return <path d={d} stroke={tema.tinta} strokeWidth={a} {...jl} />;
  if (tema.dibujo === "tinta") return (
    <g>
      <path d={d} stroke={tema.tinta} strokeWidth={a} {...jl} />
      <path d={d} stroke={tema.tinta} strokeWidth={a * 0.4} opacity={0.5} transform="translate(1.5,-1)" {...jl} />
    </g>
  );
  if (tema.dibujo === "cabezon") return (
    <g>
      <path d={d} stroke={tema.tinta} strokeWidth={a + tema.trazo * 2} {...jl} />
      <path d={d} stroke={color ?? tema.piel} strokeWidth={a} {...jl} />
    </g>
  );
  return (
    <g>
      <path d={d} stroke="#fffaf2" strokeWidth={a + 9} {...jl} />
      <path d={d} stroke={color ?? tema.piel} strokeWidth={a} {...jl} />
    </g>
  );
};

/** Texto de rótulo: letra del tema, con borde para que se lea sobre cualquier fondo. */
export const Texto: React.FC<{ tema: Tema; x: number; y: number; t: string; tam: number; color?: string; borde?: string; gorda?: boolean; ancla?: "start" | "middle" | "end"; op?: number; rot?: number }> = ({ tema, x, y, t, tam, color, borde, gorda, ancla = "middle", op = 1, rot = 0 }) => (
  <text x={x} y={y} fontFamily={gorda ? tema.letraGorda : tema.letra} fontSize={tam} fill={color ?? tema.claro} textAnchor={ancla}
    stroke={borde ?? "none"} strokeWidth={borde ? tam * 0.13 : 0} paintOrder="stroke" strokeLinejoin="round" opacity={op}
    transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}>{t}</text>
);
