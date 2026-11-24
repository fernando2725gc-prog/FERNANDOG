// Los fondos de la plantilla: el «gris» del narrador (en la referencia, gris plano #c2c2c2 con la mascota a la izquierda), los
// decorados de las escenas ilustradas, los bocadillos, las tarjetas que saltan y la textura de papel de C y D.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { clamp, CURVA } from "../motor/anim";
import { Cosa } from "./cosas";
import { DefsTerra, Forma, Texto, tono } from "./forma";
import { H, Tema, W } from "./tema";

export const Papel: React.FC<{ tema: Tema; fuerza?: number }> = ({ tema, fuerza }) =>
  tema.papel ? (
    <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: fuerza ?? (tema.dibujo === "papel" ? 0.16 : 0.3), pointerEvents: "none" }}>
      <Img src={staticFile("textura.jpg")} style={{ width: W, height: H, filter: "contrast(1.6) brightness(1.35)" }} />
    </AbsoluteFill>
  ) : null;

/** Fondo del narrador. */
export const FondoNarrador: React.FC<{ tema: Tema }> = ({ tema }) => {
  const bg = tema.dibujo === "cabezon"
    ? `radial-gradient(ellipse at 50% 42%, ${tono(tema.fondo, 0.35)} 0%, ${tema.fondo} 55%, ${tema.fondo2} 100%)`
    : tema.dibujo === "tinta"
      ? `radial-gradient(ellipse at 50% 45%, ${tono(tema.fondo, 0.2)} 0%, ${tema.fondo} 60%, ${tema.fondo2} 100%)`
      : tema.dibujo === "papel" ? `linear-gradient(180deg, ${tono(tema.fondo, 0.06)} 0%, ${tema.fondo} 100%)` : tema.fondo;
  return (
    <AbsoluteFill style={{ background: bg }}>
      {tema.dibujo === "tinta" && <AbsoluteFill style={{ boxShadow: "inset 0 0 220px rgba(90,60,25,0.45)" }} />}
    </AbsoluteFill>
  );
};

/** Bocadillo con la cola apuntando a (ax, ay). Se escribe a máquina con «escrito» 0..1. */
/** Letra de los bocadillos (38 px a 1080p; se eligió esta a la de 50 px, 09-11-2026). */
export const BOC_TAM = 38;
export const Bocadillo: React.FC<{ tema: Tema; x: number; y: number; ax: number; ay: number; texto: string; escrito?: number; ancho?: number; f?: number }> = ({ tema, x, y, ax, ay, texto, escrito = 1, ancho = 520, f = 1 }) => {
  const tam = tema.dibujo === "cabezon" ? 34 : BOC_TAM;
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let l = "";
  for (const p of palabras) {
    if ((l + " " + p).trim().length * tam * (tema.dibujo === "cabezon" ? 0.6 : 0.5) > ancho - 70) { lineas.push(l.trim()); l = p; } else l += " " + p;
  }
  if (l.trim()) lineas.push(l.trim());
  const alto = lineas.length * tam * 1.2 + 44;
  const total = texto.length;
  let quedan = Math.round(total * clamp(escrito));
  const p = CURVA.llega(clamp(f));
  const ink = tema.dibujo === "papel" ? "#fffaf2" : tema.tinta;
  const relleno = tema.dibujo === "tinta" ? "#f6ecd4" : "#ffffff";
  // la cola sale del borde de abajo, hacia quien habla
  const bx = x + ancho / 2, by = y + alto;
  const cola = `M ${bx - 26} ${by - 4} L ${ax} ${ay} L ${bx + 26} ${by - 4} Z`;
  return (
    <g transform={`translate(${bx}, ${by}) scale(${p}) translate(${-bx}, ${-by})`} filter={tema.dibujo === "papel" ? "url(#t-papel)" : undefined}>
      <path d={cola} fill={relleno} stroke={tema.dibujo === "papel" ? "none" : ink} strokeWidth={Math.max(2.5, tema.trazo)} strokeLinejoin="round" />
      <rect x={x} y={y} width={ancho} height={alto} rx={tema.dibujo === "tinta" ? 14 : 34} fill={relleno} stroke={tema.dibujo === "papel" ? "none" : ink} strokeWidth={Math.max(2.5, tema.trazo)} />
      <path d={`M ${bx - 24} ${by - 2} L ${bx + 24} ${by - 2}`} stroke={relleno} strokeWidth={Math.max(4, tema.trazo + 2)} />
      {lineas.map((ln, i) => {
        const vis = ln.slice(0, Math.max(0, quedan));
        quedan -= ln.length + 1;
        return <Texto key={i} tema={tema} x={x + ancho / 2} y={y + 30 + tam * 0.85 + i * tam * 1.2} t={vis} tam={tam} color={tema.oscuro} gorda={tema.dibujo === "cabezon"} />;
      })}
    </g>
  );
};

/** Tarjeta que salta al lado del narrador: papel con un icono y/o una palabra. */
export const Tarjeta: React.FC<{ tema: Tema; x: number; y: number; ancho: number; alto: number; f: number; texto?: string; children?: React.ReactNode; giro?: number }> = ({ tema, x, y, ancho, alto, f, texto, children, giro = 0 }) => {
  if (f <= 0) return null;
  const p = CURVA.llega(clamp(f));
  const fill = tema.dibujo === "tinta" ? "#f3e6c6" : tema.dibujo === "papel" ? "#f7efdc" : "#f4ead2";
  return (
    <g transform={`translate(${x}, ${y}) rotate(${giro}) scale(${p})`} filter={tema.dibujo === "papel" ? "url(#t-papel)" : tema.dibujo === "plano" ? "url(#t-sombra)" : undefined}>
      <Forma tema={tema} fill={fill} x={-ancho / 2} y={-alto / 2} w={ancho} h={alto} esq={tema.dibujo === "tinta" ? 4 : 16} grosor={tema.dibujo === "plano" ? 0.8 : 1} />
      {tema.dibujo === "plano" && [-0.18, 0.06, 0.3].map((k) => <path key={k} d={`M ${-ancho / 2 + 18} ${alto * k} L ${ancho / 2 - 18} ${alto * k}`} stroke="#d8c9a6" strokeWidth={2} />)}
      {children}
      {texto && (() => {
        // que el texto quepa siempre en la tarjeta (VID-100: «ni la más fuerte de Europa» se salía por los dos lados):
        // si es largo, en dos líneas, y si aun así no cabe, más pequeño
        const base = tema.dibujo === "cabezon" ? 30 : 38, util = ancho - 44, k = 0.6;
        let lineas = [texto];
        if (texto.length * base * k > util && texto.includes(" ")) {
          const pal = texto.split(" ");
          let mejor = 1, dif = Infinity;
          for (let i = 1; i < pal.length; i++) { const d = Math.abs(pal.slice(0, i).join(" ").length - pal.slice(i).join(" ").length); if (d < dif) { dif = d; mejor = i; } }
          lineas = [pal.slice(0, mejor).join(" "), pal.slice(mejor).join(" ")];
        }
        const largo = Math.max(...lineas.map((l) => l.length));
        const tam = Math.min(base, util / Math.max(1, largo * k));
        return lineas.map((l, i) => <Texto key={i} tema={tema} x={0} y={alto / 2 - 26 - (lineas.length - 1 - i) * tam * 1.1} t={l} tam={tam} color={tema.oscuro} gorda={tema.dibujo === "cabezon"} />);
      })()}
    </g>
  );
};

/** Decorado «sala del trono» (corte de un reino: Castilla, Inglaterra, Francia…). Suelo en perspectiva, luz de los
 *  ventanales, antorchas, estandartes (estandartes: [fondo, figura] de cada uno) y dos tronos en una tarima. */
export const SalaTrono: React.FC<{ tema: Tema; frame: number; estandartes?: [string, string][]; lisos?: boolean }> = ({ tema, frame, estandartes = [["#b5262b", "#f0c23b"], ["#f0c23b", "#b5262b"]], lisos = false }) => {
  const piedra = tema.dibujo === "tinta" ? "#e2cfa6" : tema.dibujo === "papel" ? "#d8be92" : "#dcc9a2";
  const suelo1 = tema.dibujo === "papel" ? "#9b6b45" : "#a8794e";
  const suelo2 = tema.dibujo === "papel" ? "#c69c6c" : "#e8d9b8";
  const cielo = tema.dibujo === "tinta" ? "#c9d6cf" : "#8fc4e8";
  const linea = tema.dibujo === "papel" ? "#fffaf2" : tema.tinta;
  const pie = 830;
  const VP = { x: 1300, y: 420 }; // punto de fuga del suelo
  const enY = (xb: number, y: number) => VP.x + (xb - VP.x) * ((y - VP.y) / (H - VP.y));
  const filas = [0, 0.12, 0.28, 0.5, 0.76, 1.05].map((k) => pie + (H - pie) * k);
  const cols = Array.from({ length: 17 }).map((_, j) => -1100 + j * 300);
  return (
    <g>
      <defs>
        <linearGradient id="t-pared" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tono(piedra, -0.12)} /><stop offset="1" stopColor={piedra} /></linearGradient>
        <linearGradient id="t-luz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff8dc" stopOpacity="0.55" /><stop offset="1" stopColor="#fff8dc" stopOpacity="0" /></linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={pie} fill={tema.dibujo === "plano" || tema.dibujo === "cabezon" ? "url(#t-pared)" : piedra} />
      {tema.dibujo !== "papel" && [0, 1, 2, 3, 4, 5, 6].map((f) => <path key={f} d={`M 0 ${f * 118 + 60} L ${W} ${f * 118 + 60}`} stroke={tono(piedra, -0.12)} strokeWidth={tema.dibujo === "tinta" ? 1.5 : 2.5} />)}
      {/* juntas de las piedras, al tresbolillo */}
      {tema.dibujo !== "papel" && [0, 1, 2, 3, 4, 5].map((f) => Array.from({ length: 9 }).map((_, c) => { const x = c * 230 + (f % 2 ? 115 : 0); return <path key={`j${f}-${c}`} d={`M ${x} ${f * 118 + 60} L ${x} ${f * 118 + 178}`} stroke={tono(piedra, -0.12)} strokeWidth={2.5} />; }))}
      {[360, 960, 1560].map((x, i) => (
        <g key={x}>
          <Forma tema={tema} fill={tono(piedra, -0.18)} d={`M ${x - 130} ${pie - 120} L ${x - 130} 250 Q ${x - 130} 110 ${x} 110 Q ${x + 130} 110 ${x + 130} 250 L ${x + 130} ${pie - 120} Z`} />
          <Forma tema={tema} fill={cielo} d={`M ${x - 100} ${pie - 150} L ${x - 100} 260 Q ${x - 100} 140 ${x} 140 Q ${x + 100} 140 ${x + 100} 260 L ${x + 100} ${pie - 150} Z`} grosor={0.7} />
          <path d={`M ${x} 140 L ${x} ${pie - 150} M ${x - 100} 420 L ${x + 100} 420`} stroke={linea} strokeWidth={tema.dibujo === "cabezon" ? 7 : 4} />
          {i !== 1 && <Forma tema={tema} fill="#ffffff" d={`M ${x - 60 + Math.sin(frame * 0.01 + i) * 8} 300 q 20 -26 50 -6 q 26 -16 44 6 q 20 4 10 18 h -100 q -14 -8 -4 -18 z`} sinBorde grosor={0.5} />}
        </g>
      ))}
      {/* antorchas entre los ventanales */}
      {[660, 1260].map((x) => <g key={`a${x}`} transform={`translate(${x === 660 ? 160 : 1860}, 560) scale(0.9)`}><Cosa id="antorcha" tema={tema} f={frame + x} /></g>)}
      {/* estandartes */}
      {([[700, estandartes[0]], [1260, estandartes[1] ?? estandartes[0]]] as [number, [string, string]][]).map(([x, [a, b]], i) => {
        const v = Math.sin(frame * 0.05 + i) * 3;
        return (
          <g key={i}>
            <Forma tema={tema} fill={a} d={`M ${x - 70} 150 L ${x + 70} 150 L ${x + 70 + v} 470 L ${x + v} 420 L ${x - 70 + v} 470 Z`} />
            {lisos ? <path d={`M ${x - 70 + v * 0.3} 175 L ${x + 70 + v * 0.3} 175`} stroke={b} strokeWidth={10} /> : i === 0 ? <Forma tema={tema} fill={b} d={`M ${x - 30} 340 L ${x - 30} 270 L ${x - 18} 270 L ${x - 18} 282 L ${x - 6} 282 L ${x - 6} 270 L ${x + 6} 270 L ${x + 6} 282 L ${x + 18} 282 L ${x + 18} 270 L ${x + 30} 270 L ${x + 30} 340 Z`} grosor={0.6} />
              : [-40, -14, 12, 38].map((dx) => <rect key={dx} x={x + dx - 6} y={160} width={12} height={270} fill={b} opacity={0.95} />)}
            <Forma tema={tema} fill="#7a5230" x={x - 90} y={140} w={180} h={16} esq={8} grosor={0.7} />
          </g>
        );
      })}
      {/* tarima y tronos (el asiento a la altura de la cadera de un muñeco sentado) */}
      <Forma tema={tema} fill={tono(piedra, -0.25)} x={980} y={pie - 70} w={760} h={70} esq={6} />
      <Forma tema={tema} fill={tono(piedra, -0.35)} x={1020} y={pie - 120} w={680} h={52} esq={6} />
      {[1210, 1490].map((x) => (
        <g key={x}>
          <Forma tema={tema} fill="#8e2a26" d={`M ${x - 78} ${pie - 120} L ${x - 78} ${pie - 400} Q ${x} ${pie - 490} ${x + 78} ${pie - 400} L ${x + 78} ${pie - 120} Z`} />
          <Forma tema={tema} fill="#e3b240" d={`M ${x - 56} ${pie - 380} Q ${x} ${pie - 450} ${x + 56} ${pie - 380} L ${x + 56} ${pie - 350} L ${x - 56} ${pie - 350} Z`} grosor={0.6} />
          <Forma tema={tema} fill="#6e1f1c" x={x - 92} y={pie - 212} w={184} h={30} esq={8} grosor={0.8} />
        </g>
      ))}
      {/* sombra al pie de la pared */}
      <defs><linearGradient id="t-pie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.16" /></linearGradient></defs>
      <rect x={0} y={pie - 110} width={W} height={110} fill="url(#t-pie)" />
      {/* luz de los ventanales sobre el suelo */}
      {[360, 960].map((x) => <path key={`l${x}`} d={`M ${x - 100} ${pie - 150} L ${x + 100} ${pie - 150} L ${x + 260} ${H} L ${x - 20} ${H} Z`} fill="url(#t-luz)" opacity={tema.dibujo === "tinta" ? 0.4 : 0.8} />)}
      {/* suelo de baldosas en perspectiva */}
      <rect x={0} y={pie} width={W} height={H - pie} fill={suelo2} />
      {filas.slice(0, -1).map((y0, r) => cols.slice(0, -1).map((xb, j) => {
        if ((r + j) % 2) return null;
        const y1 = filas[r + 1], xb2 = cols[j + 1];
        return <path key={`${r}-${j}`} d={`M ${enY(xb, y0)} ${y0} L ${enY(xb2, y0)} ${y0} L ${enY(xb2, y1)} ${y1} L ${enY(xb, y1)} ${y1} Z`} fill={suelo1} opacity={tema.dibujo === "tinta" ? 0.55 : 0.9} />;
      }))}
      {[360, 960].map((x) => <path key={`l2${x}`} d={`M ${x - 100} ${pie} L ${x + 120} ${pie} L ${x + 260} ${H} L ${x - 20} ${H} Z`} fill="#fff8dc" opacity={0.16} />)}
      <path d={`M 0 ${pie} L ${W} ${pie}`} stroke={linea} strokeWidth={tema.dibujo === "cabezon" ? 7 : 3} />
      {/* alfombra hacia la tarima */}
      <Forma tema={tema} fill="#a4262b" d={`M ${enY(1200, pie)} ${pie} L ${enY(1500, pie)} ${pie} L ${enY(1500, H)} ${H} L ${enY(1200, H)} ${H} Z`} grosor={0.8} />
      <path d={`M ${enY(1225, pie)} ${pie} L ${enY(1225, H)} ${H} M ${enY(1475, pie)} ${pie} L ${enY(1475, H)} ${H}`} stroke="#e3b240" strokeWidth={5} />
      {tema.dibujo === "tinta" && <rect x={0} y={0} width={W} height={H} fill="url(#t-trama)" opacity={0.08} />}
    </g>
  );
};

export const SVGTerra: React.FC<{ tema: Tema; children: React.ReactNode }> = ({ tema, children }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
    <DefsTerra tema={tema} />
    {children}
  </svg>
);
