// La ciudad de las escenas de la plantilla (rehecha el 11-11-2026). Antes eran casas bajitas en fila, pegadas a los muñecos
// (la gente casi tan alta como las casas) y siempre iguales: Jerusalén, Salónica, las Trece Colonias y Palestina salían
// con la misma calle. Ahora:
//  - las fachadas van al fondo de una calle (pie en y 800) con puertas de verdad: los muñecos (que pisan en 1010) son
//    más grandes que una puerta porque están más cerca, como en un dibujo con perspectiva;
//  - cada plano cambia las casas (orden, alturas, colores, balcones, puestos) con su número: «semilla»;
//  - «estilo»: «europa» (tejados de teja, contraventanas) u «oriente» (Jerusalén, El Cairo, Bagdad, Estambul, el norte
//    de África: azoteas, piedra clara, ventanas en arco, celosías, cúpulas y alminares al fondo, palmeras). Con
//    «"cupula": true», la gran cúpula dorada al fondo (la Cúpula de la Roca de Jerusalén).
import React from "react";
import { Forma, tono } from "./forma";
import { H, Tema, W } from "./tema";
import { MEDIDA, P } from "./medidas";

export const SUELO_CIUDAD = 1010;
// las fachadas tocan la calle justo detrás de los pies de los muñecos (sin perspectiva que adivinar) y todo se mide en
// personas (medidas.ts): puerta 1,25, planta baja 1,55, cada piso 1,35, ventana 0,55
const PIE = 1000;
const UP = P("ciudad");
const PUERTA = UP * MEDIDA.puerta, BAJO = UP * MEDIDA.bajo, PISO = UP * MEDIDA.piso, VENT = UP * MEDIDA.ventana;

const azar = (semilla: number) => (k: number) => {
  const x = Math.sin(semilla * 91.73 + k * 12.989) * 43758.5453;
  return x - Math.floor(x);
};

type Props = { tema: Tema; frame: number; noche?: boolean; estilo?: string; semilla?: number; cupula?: boolean };

export const Ciudad: React.FC<Props> = ({ tema, frame, noche, estilo = "europa", semilla = 1, cupula = false }) => {
  const r = azar(semilla);
  const oriente = estilo === "oriente";
  const tinta = tema.tinta;
  const fachadas = oriente
    ? ["#efe3c8", "#e6d4b0", "#f3ead8", "#dcc79f", "#e9dcc0", "#d8c39a"]
    : ["#e9d5ad", "#d7b98a", "#c97b5a", "#e3c9a0", "#b8956a", "#d6a77c", "#cf8f6e"];
  const ventana = noche ? "#f2cf6a" : oriente ? "#4a3b2c" : "#5a6f86";

  // las casas: planta baja y 0, 1 o 2 pisos (la de 2 se sale por arriba, como una casa alta de verdad)
  const cxCupula = 960 + (r(92) - 0.5) * 160;
  const casas: { x: number; w: number; h: number; c: string; pisos: number; balcon: boolean; tienda: boolean; domo: boolean }[] = [];
  let x = -60 - r(1) * 140, k = 0;
  while (x < W + 40) {
    const w = 300 + Math.floor(r(10 + k) * 150);
    const tapaCupula = cupula && x + w > cxCupula - 240 && x < cxCupula + 240;
    const q = r(20 + k);
    const pisos = tapaCupula ? 0 : q < 0.28 ? 0 : q < 0.82 ? 1 : 2;
    const h = BAJO + pisos * PISO;
    casas.push({ x, w, h, c: fachadas[Math.floor(r(30 + k) * fachadas.length)], pisos, balcon: r(40 + k) > 0.5, tienda: r(50 + k) > 0.45, domo: oriente && pisos === 0 && !tapaCupula && r(60 + k) > 0.5 });
    x += w + (oriente ? 0 : 6);
    k++;
  }
  const FONDO = PIE - BAJO; // la silueta de lejos asoma por encima de las casas bajas

  return (
    <g>
      {/* al fondo, la silueta de la ciudad (más clara: está lejos) */}
      <g opacity={0.9}>
        {Array.from({ length: 14 }).map((_, i) => {
          const bx = i * 150 - 40 + r(70 + i) * 40, bh = 90 + r(80 + i) * 150;
          const c = tono(oriente ? "#d9ccb2" : "#b9a88e", 0.18);
          return <rect key={`l${i}`} x={bx} y={FONDO - bh} width={150} height={bh + 60} fill={c} />;
        })}
        {oriente ? (
          <g>
            {/* alminares y cúpulas lejos */}
            {[[260 + r(90) * 300, 1], [1380 + r(91) * 300, 0.85]].map(([mx, kk], i) => (
              <g key={`m${i}`} transform={`translate(${mx}, ${FONDO + 40}) scale(${kk})`}>
                <rect x={-16} y={-330} width={32} height={330} fill="#e8dcc4" stroke={tono("#e8dcc4", -0.3)} strokeWidth={2} />
                <rect x={-24} y={-250} width={48} height={14} fill="#d6c7a8" />
                <path d="M -18 -330 Q 0 -380 18 -330 Z" fill="#cbb98f" />
              </g>
            ))}
            {cupula ? (
              <g transform={`translate(${cxCupula}, ${FONDO + 30})`}>
                <rect x={-150} y={-70} width={300} height={90} fill="#5b86b8" stroke={tinta} strokeWidth={2} />
                {[-110, -55, 0, 55, 110].map((dx) => <path key={dx} d={`M ${dx - 16} 20 L ${dx - 16} -40 Q ${dx} -60 ${dx + 16} -40 L ${dx + 16} 20 Z`} fill="#2f5d8f" />)}
                <rect x={-80} y={-110} width={160} height={42} fill="#5b86b8" stroke={tinta} strokeWidth={2} />
                <path d="M -96 -108 Q -96 -240 0 -250 Q 96 -240 96 -108 Z" fill="#f0c23b" stroke={tinta} strokeWidth={3} />
                <path d="M -60 -150 Q -40 -220 0 -228" stroke="#fff0b0" strokeWidth={8} fill="none" opacity={0.7} strokeLinecap="round" />
                <path d="M 0 -250 L 0 -282" stroke={tinta} strokeWidth={4} />
              </g>
            ) : (
              <path d={`M ${880} ${FONDO} Q ${880} ${FONDO - 110} ${960} ${FONDO - 115} Q ${1040} ${FONDO - 110} ${1040} ${FONDO} Z`} fill="#e5d8bd" />
            )}
          </g>
        ) : (
          <g transform={`translate(${520 + r(93) * 800}, ${FONDO + 60})`}>
            {/* el campanario de la iglesia, lejos */}
            <rect x={-40} y={-300} width={80} height={300} fill="#cdbb98" stroke={tono("#cdbb98", -0.3)} strokeWidth={2} />
            <path d="M -40 -120 Q 0 -150 40 -120" stroke={tono("#cdbb98", -0.35)} strokeWidth={4} fill="none" />
            <path d="M -50 -300 L 0 -400 L 50 -300 Z" fill="#a8604a" />
          </g>
        )}
      </g>

      {/* la fila de casas, con la puerta a la altura de los muñecos */}
      {casas.map((c, i) => {
        const top = PIE - c.h;
        const oscuro = tono(c.c, -0.28);
        const nv = Math.max(2, Math.floor((c.w - 40) / 150)); // ventanas por piso
        const ancho = (c.w - 40) / nv;
        const vw = UP * 0.36;
        const px = c.x + c.w * 0.28, pw = UP * 0.55; // la puerta
        const ventanaEn = (vx: number, vy: number, luz: boolean, key: string) => {
          const col = luz ? "#f2cf6a" : ventana;
          return oriente ? (
            <path key={key} d={`M ${vx - vw / 2} ${vy + VENT} L ${vx - vw / 2} ${vy + vw * 0.4} Q ${vx} ${vy - vw * 0.15} ${vx + vw / 2} ${vy + vw * 0.4} L ${vx + vw / 2} ${vy + VENT} Z`} fill={col} stroke={oscuro} strokeWidth={3} />
          ) : (
            <g key={key}>
              <rect x={vx - vw / 2} y={vy} width={vw} height={VENT} fill={col} stroke={oscuro} strokeWidth={3} />
              <path d={`M ${vx} ${vy} L ${vx} ${vy + VENT} M ${vx - vw / 2} ${vy + VENT * 0.45} L ${vx + vw / 2} ${vy + VENT * 0.45}`} stroke={oscuro} strokeWidth={2.5} />
              {!luz && <><rect x={vx - vw / 2 - 26} y={vy} width={24} height={VENT} fill={["#3f6a4a", "#2f5a7a", "#7a3f2f"][i % 3]} /><rect x={vx + vw / 2 + 2} y={vy} width={24} height={VENT} fill={["#3f6a4a", "#2f5a7a", "#7a3f2f"][i % 3]} /></>}
              <rect x={vx - vw / 2 - 8} y={vy + VENT} width={vw + 16} height={10} fill={oscuro} />
            </g>
          );
        };
        return (
          <g key={i}>
            <Forma tema={tema} fill={c.c} x={c.x} y={top} w={c.w} h={c.h + 20} grosor={0.8} />
            {/* zócalo */}
            <rect x={c.x} y={PIE - 40} width={c.w} height={40} fill={tono(c.c, -0.12)} />
            {/* tejado */}
            {oriente ? (
              <g>
                <Forma tema={tema} fill={oscuro} x={c.x - 8} y={top - 22} w={c.w + 16} h={26} esq={2} grosor={0.7} />
                {[0.2, 0.5, 0.8].map((q) => <rect key={q} x={c.x + c.w * q - 12} y={top - 40} width={24} height={20} fill={c.c} stroke={oscuro} strokeWidth={2} />)}
                {c.domo && <Forma tema={tema} fill="#f3ead8" d={`M ${c.x + c.w / 2 - 90} ${top - 20} Q ${c.x + c.w / 2 - 90} ${top - 160} ${c.x + c.w / 2} ${top - 168} Q ${c.x + c.w / 2 + 90} ${top - 160} ${c.x + c.w / 2 + 90} ${top - 20} Z`} grosor={0.8} />}
              </g>
            ) : (
              <g>
                <Forma tema={tema} fill="#a04a32" d={`M ${c.x - 22} ${top + 6} L ${c.x + c.w / 2} ${top - 80 - c.w * 0.1} L ${c.x + c.w + 22} ${top + 6} Z`} grosor={0.8} />
                {r(100 + i) > 0.5 && <Forma tema={tema} fill={tono(c.c, -0.15)} x={c.x + c.w * 0.7} y={top - 110} w={40} h={90} grosor={0.6} />}
              </g>
            )}
            {/* pisos de arriba: cada uno 1,35 personas, con sus ventanas */}
            {Array.from({ length: c.pisos }).map((_, f) => {
              const techo = PIE - BAJO - (f + 1) * PISO;
              const vy = techo + (PISO - VENT) / 2;
              return (
                <g key={`f${f}`}>
                  <path d={`M ${c.x} ${techo + PISO} L ${c.x + c.w} ${techo + PISO}`} stroke={oscuro} strokeWidth={4} opacity={0.6} />
                  {Array.from({ length: nv }).map((_, v) => ventanaEn(c.x + 20 + v * ancho + ancho / 2, vy, Boolean(noche) && (i * 5 + f * 3 + v) % 3 !== 0, `v${v}`))}
                  {c.balcon && f === 0 && (oriente ? (
                    <g>
                      <Forma tema={tema} fill="#8a5a34" x={c.x + c.w / 2 - UP * 0.4} y={vy - 10} w={UP * 0.8} h={VENT + 24} esq={3} grosor={0.8} />
                      {Array.from({ length: 6 }).map((_, b) => <path key={b} d={`M ${c.x + c.w / 2 - UP * 0.32 + b * UP * 0.128} ${vy} L ${c.x + c.w / 2 - UP * 0.32 + b * UP * 0.128} ${vy + VENT + 6}`} stroke="#5d3a1f" strokeWidth={4} />)}
                    </g>
                  ) : (
                    <g>
                      {/* barandilla a la altura de la cintura de una persona (0,5) */}
                      <path d={`M ${c.x + 16} ${techo + PISO} L ${c.x + c.w - 16} ${techo + PISO}`} stroke="#2a2624" strokeWidth={7} />
                      <path d={`M ${c.x + 16} ${techo + PISO - UP * 0.5} L ${c.x + c.w - 16} ${techo + PISO - UP * 0.5}`} stroke="#2a2624" strokeWidth={4} />
                      {Array.from({ length: Math.floor((c.w - 32) / 22) }).map((_, b) => <path key={b} d={`M ${c.x + 22 + b * 22} ${techo + PISO} l 0 ${-UP * 0.5}`} stroke="#2a2624" strokeWidth={2.5} />)}
                    </g>
                  ))}
                </g>
              );
            })}
            {/* la planta baja: la puerta (1,25 personas) y una ventana o una tienda con toldo */}
            <g>
              <Forma tema={tema} fill="#6b4425" d={`M ${px - pw / 2} ${PIE} L ${px - pw / 2} ${PIE - PUERTA + pw / 2} Q ${px - pw / 2} ${PIE - PUERTA} ${px} ${PIE - PUERTA} Q ${px + pw / 2} ${PIE - PUERTA} ${px + pw / 2} ${PIE - PUERTA + pw / 2} L ${px + pw / 2} ${PIE} Z`} grosor={0.8} />
              <path d={`M ${px} ${PIE - PUERTA + 10} L ${px} ${PIE}`} stroke={tono("#6b4425", -0.3)} strokeWidth={3} />
              <circle cx={px + pw * 0.3} cy={PIE - UP * 0.5} r={6} fill="#e3b240" />
              {c.tienda ? (
                <g>
                  <rect x={c.x + c.w * 0.55} y={PIE - UP * 1.05} width={c.w * 0.38} height={UP * 1.05} fill={noche ? "#f2cf6a" : "#3e3328"} opacity={0.85} />
                  <Forma tema={tema} fill={i % 2 ? "#b5332b" : oriente ? "#2f6a8a" : "#2f6a4a"} d={`M ${c.x + c.w * 0.52} ${PIE - UP * 1.2} L ${c.x + c.w * 0.96} ${PIE - UP * 1.2} L ${c.x + c.w * 1.0} ${PIE - UP * 1.02} L ${c.x + c.w * 0.48} ${PIE - UP * 1.02} Z`} grosor={0.7} />
                  {Array.from({ length: 4 }).map((_, t) => <path key={t} d={`M ${c.x + c.w * (0.56 + t * 0.1)} ${PIE - UP * 1.2} l -5 ${UP * 0.18}`} stroke="#f4efe3" strokeWidth={8} opacity={0.8} />)}
                </g>
              ) : ventanaEn(c.x + c.w * 0.72, PIE - BAJO + (BAJO - VENT) / 2 - UP * 0.1, Boolean(noche) && i % 2 === 0, "vb")}
            </g>
          </g>
        );
      })}

      {/* la calle, delante: aquí pisan los muñecos */}
      <rect x={0} y={PIE} width={W} height={H - PIE} fill={oriente ? "#d9c7a0" : "#b9a88a"} />
      <path d={`M 0 ${PIE} L ${W} ${PIE}`} stroke={tinta} strokeWidth={3} />
      {Array.from({ length: 2 }).map((_, f) => Array.from({ length: 17 }).map((_, j) => (
        <rect key={`a${f}-${j}`} x={j * 120 - (f % 2) * 60} y={PIE + 12 + f * 36} width={108} height={28} rx={7} fill="none" stroke={tono(oriente ? "#d9c7a0" : "#b9a88a", -0.16)} strokeWidth={2.5} />
      )))}
      {/* cosas de la calle (a escala: palmera 1,7 personas, cántaro 0,4, pozo 0,6, barril 0,45), cambian con el plano */}
      {oriente ? (
        <g>
          {[r(110) > 0.4 ? 90 + r(111) * 140 : -999, r(112) > 0.4 ? 1700 + r(113) * 140 : -999].map((pxx, i) => pxx > 0 && (
            <g key={`pa${i}`} transform={`translate(${pxx}, ${PIE + 20}) scale(${(UP * 1.7) / 380})`}>
              <path d="M 0 0 Q -8 -200 10 -380" stroke="#8a6a44" strokeWidth={22} fill="none" strokeLinecap="round" />
              {[-150, -100, -40, 20, 80, 140].map((a, j) => <path key={j} d={`M 10 -380 q ${Math.cos((a * Math.PI) / 180) * 60} ${-30 + j * 6} ${Math.cos((a * Math.PI) / 180) * 130} ${50 + Math.abs(a) * 0.3 + Math.sin(frame * 0.05 + j) * 4}`} stroke="#4f8f3a" strokeWidth={16} fill="none" strokeLinecap="round" />)}
            </g>
          ))}
          {r(114) > 0.35 && <g transform={`translate(${700 + r(115) * 500}, ${PIE + 18}) scale(${(UP * 0.4) / 56})`}>
            {[-50, 0, 50].map((dx, j) => <Forma key={j} tema={tema} fill={["#c9703a", "#b5582e", "#d8894a"][j]} d={`M ${dx - 20} 0 Q ${dx - 30} -40 ${dx - 12} -56 L ${dx + 12} -56 Q ${dx + 30} -40 ${dx + 20} 0 Z`} grosor={0.6} />)}
          </g>}
        </g>
      ) : (
        <g>
          {r(120) > 0.4 && <g transform={`translate(${130 + r(121) * 260}, ${PIE + 20}) scale(${(UP * 0.6) / 205})`}>
            <Forma tema={tema} fill="#a59a88" x={-60} y={-70} w={120} h={70} esq={6} grosor={0.8} />
            <path d="M -50 -70 L -50 -170 M 50 -70 L 50 -170 M -64 -170 L 64 -170" stroke="#6b4425" strokeWidth={9} strokeLinecap="round" />
            <path d="M -70 -170 L 0 -205 L 70 -170 Z" fill="#a04a32" stroke={tinta} strokeWidth={2} />
          </g>}
          {r(122) > 0.4 && <g transform={`translate(${1540 + r(123) * 260}, ${PIE + 16}) scale(${(UP * 0.45) / 80})`}>
            {[-34, 34].map((dx) => <Forma key={dx} tema={tema} fill="#9a6a3c" x={dx - 30} y={-80} w={60} h={80} esq={14} grosor={0.7} />)}
          </g>}
        </g>
      )}
    </g>
  );
};
