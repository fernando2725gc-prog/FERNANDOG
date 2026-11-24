// Una multitud en siluetas oscuras (la referencia, «Holanda» 0:35: la gente de noche con antorchas). Cabezas redondas y cuerpos
// lisos en 2-3 filas de profundidad, cada uno con su altura y su vaivén; «agita» levanta los puños, «antorchas» y
// «lanzas» reparten antorchas con llama o lanzas. Barata de dibujar: sin contorno, sin caras. Se pone en el suelo de
// una escena (y = dónde pisan) entre x0 y x1.
import React from "react";
import { tono } from "./forma";
import { Tema } from "./tema";

const azar = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

export const Multitud: React.FC<{
  tema: Tema; frame: number; n?: number; x0?: number; x1?: number; y?: number; color?: string;
  agita?: boolean; antorchas?: boolean; lanzas?: boolean;
}> = ({ tema, frame, n = 18, x0 = 160, x1 = 1760, y = 1000, color = "#1d1a18", agita = false, antorchas = false, lanzas = false }) => {
  // tres filas: la de atrás más pequeña, más alta en pantalla y un poco más clara (aire)
  const filas = [
    { k: 0.78, dy: -70, col: tono(color, 0.1), cuantos: Math.round(n * 0.3) },
    { k: 0.89, dy: -34, col: tono(color, 0.05), cuantos: Math.round(n * 0.3) },
    { k: 1.0, dy: 0, col: color, cuantos: 0 },
  ];
  filas[2].cuantos = Math.max(1, n - filas[0].cuantos - filas[1].cuantos);
  const llamas: React.ReactNode[] = [];
  const cuerpos = filas.map((fila, fi) => {
    const paso = (x1 - x0) / Math.max(1, fila.cuantos);
    return Array.from({ length: fila.cuantos }).map((_, i) => {
      const sem = fi * 100 + i;
      const s = fila.k * (0.88 + azar(sem) * 0.24);
      const x = x0 + paso * (i + 0.5) + (azar(sem + 7) - 0.5) * paso * 0.5 + (fi % 2 ? paso * 0.25 : 0);
      const pie = y + fila.dy + (azar(sem + 3) - 0.5) * 10;
      const bob = Math.sin(frame * (0.1 + azar(sem + 5) * 0.06) + sem) * 3 * s;
      const r = 26 * s, alto = 150 * s, anchoH = 30 * s, anchoB = 40 * s;
      const cuello = pie - alto, cabeza = cuello - r * 0.85;
      const lleva = antorchas && sem % 3 === 1 ? "antorcha" : lanzas && sem % 3 === 2 ? "lanza" : null;
      const sube = agita && sem % 2 === 0;
      const tiembla = Math.sin(frame * 0.45 + sem * 1.7) * 14;
      const hombro: [number, number] = [x + anchoH * 0.85, cuello + 10 * s];
      // el brazo levantado (puño que se agita, o la mano que sujeta la antorcha o la lanza)
      const angulo = lleva ? -70 + Math.sin(frame * 0.08 + sem) * 4 : sube ? -78 + tiembla : 62 + Math.sin(frame * 0.06 + sem) * 3;
      const largo = 74 * s;
      const a = (angulo * Math.PI) / 180;
      const mano: [number, number] = [hombro[0] + Math.cos(a) * largo, hombro[1] + Math.sin(a) * largo];
      if (lleva === "antorcha") {
        const fx = mano[0] + 4 * s, fy = mano[1] - 46 * s;
        const parpadeo = 1 + Math.sin(frame * 0.9 + sem) * 0.12 + Math.sin(frame * 1.7 + sem * 2) * 0.06;
        llamas.push(
          <g key={`l${sem}`} transform={`translate(${fx}, ${fy + bob})`}>
            <circle cx={0} cy={-6 * s} r={46 * s * parpadeo} fill="url(#multitud-brillo)" />
            <path d={`M ${-11 * s} 0 Q ${-14 * s} ${-18 * s} 0 ${-38 * s * parpadeo} Q ${14 * s} ${-18 * s} ${11 * s} 0 Z`} fill="#f08a24" />
            <path d={`M ${-6 * s} 0 Q ${-7 * s} ${-10 * s} 0 ${-22 * s * parpadeo} Q ${7 * s} ${-10 * s} ${6 * s} 0 Z`} fill="#ffd45a" />
          </g>,
        );
      }
      return (
        <g key={sem} transform={`translate(0, ${bob})`} fill={fila.col}>
          {/* piernas (solo asoman un poco por debajo del cuerpo) */}
          <path d={`M ${x - 12 * s} ${pie - 34 * s} L ${x - 14 * s} ${pie} M ${x + 12 * s} ${pie - 34 * s} L ${x + 14 * s} ${pie}`} stroke={fila.col} strokeWidth={11 * s} strokeLinecap="round" />
          <path d={`M ${x - anchoH} ${cuello + 6 * s} Q ${x} ${cuello - 6 * s} ${x + anchoH} ${cuello + 6 * s} L ${x + anchoB} ${pie - 28 * s} Q ${x} ${pie - 20 * s} ${x - anchoB} ${pie - 28 * s} Z`} />
          <circle cx={x + (azar(sem + 11) - 0.5) * 4} cy={cabeza} r={r} />
          {/* el otro brazo, abajo */}
          <path d={`M ${x - anchoH * 0.85} ${cuello + 10 * s} L ${x - anchoH * 1.2} ${cuello + 70 * s}`} stroke={fila.col} strokeWidth={10 * s} strokeLinecap="round" />
          <path d={`M ${hombro[0]} ${hombro[1]} L ${mano[0]} ${mano[1]}`} stroke={fila.col} strokeWidth={10 * s} strokeLinecap="round" />
          {sube && !lleva && <circle cx={mano[0]} cy={mano[1]} r={9 * s} />}
          {lleva === "antorcha" && <path d={`M ${mano[0] - 2 * s} ${mano[1] + 14 * s} L ${mano[0] + 4 * s} ${mano[1] - 46 * s}`} stroke={tono(fila.col, 0.25)} strokeWidth={7 * s} strokeLinecap="round" />}
          {lleva === "lanza" && (
            <g>
              <path d={`M ${mano[0] - 2 * s} ${mano[1] + 60 * s} L ${mano[0] + 6 * s} ${mano[1] - 120 * s}`} stroke={fila.col} strokeWidth={5 * s} strokeLinecap="round" />
              <path d={`M ${mano[0] + 6 * s} ${mano[1] - 150 * s} L ${mano[0] - 2 * s} ${mano[1] - 118 * s} L ${mano[0] + 14 * s} ${mano[1] - 118 * s} Z`} />
            </g>
          )}
        </g>
      );
    });
  });
  return (
    <g>
      <defs>
        <radialGradient id="multitud-brillo">
          <stop offset="0" stopColor="#ffcf6a" stopOpacity={0.55} />
          <stop offset="1" stopColor="#ffcf6a" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* sombra en el suelo, de lado a lado de la multitud */}
      <ellipse cx={(x0 + x1) / 2} cy={y + 4} rx={(x1 - x0) / 2 + 40} ry={16} fill="#000" opacity={tema.dibujo === "papel" ? 0 : 0.14} />
      {cuerpos}
      {llamas}
    </g>
  );
};
