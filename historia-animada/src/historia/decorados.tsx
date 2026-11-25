// Decorados de las escenas de la plantilla (ilustración plana con un poco de degradado en el cielo y decorados
// con detalle). Todos miden 1920×1080 y tienen el suelo en SUELO_DE[id] (donde se ponen los pies de los muñecos).
// Si un vídeo necesita otro sitio, se añade aquí en el mismo estilo (con <Forma>) y se apunta en MONTAR.md.
import React from "react";
import { clamp, CURVA } from "../motor/anim";
import { Cosa } from "./cosas";
import { Forma, tono } from "./forma";
import { SalaTrono } from "./escenario";
import { Ciudad } from "./ciudad";
import { MEDIDA, PERSONA } from "./medidas";
import { H, Tema, W } from "./tema";

export const DECORADOS = ["mina", "despacho", "sala_trono", "puerto", "mar", "campo", "desierto", "nieve", "ciudad", "campamento", "interior", "canales", "laguna", "estepa", "foro", "palacio", "selva", "fabrica", "calle", "trinchera", "montana", "calzada", "rio", "tenochtitlan"] as const;
export type DecoradoId = (typeof DECORADOS)[number];
export const SUELO_DE: Record<string, number> = { mina: 1000, despacho: 1000, sala_trono: 1000, puerto: 1010, mar: 900, campo: 1000, desierto: 1000, nieve: 1000, ciudad: 1010, campamento: 1000, interior: 1000, canales: 1020, laguna: 1000, estepa: 1000, foro: 1000, palacio: 1000, selva: 1000, fabrica: 1010, calle: 1010, trinchera: 1000, montana: 1000, calzada: 1000, rio: 1000, tenochtitlan: 1000 };

const Cielo: React.FC<{ tema: Tema; noche?: boolean; atardecer?: boolean; frame: number; nubes?: boolean }> = ({ tema, noche, atardecer, frame, nubes = true }) => {
  const [a, b] = noche ? ["#1d2748", "#3a4a78"] : atardecer ? ["#f2a35e", "#f7dca0"] : tema.dibujo === "tinta" ? ["#c8d6d0", "#eee4c8"] : ["#79b8e8", "#cfe7f5"];
  return (
    <g>
      <defs>
        <linearGradient id={`cielo-${noche ? "n" : atardecer ? "a" : "d"}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#cielo-${noche ? "n" : atardecer ? "a" : "d"})`} />
      {noche && <Forma tema={tema} fill="#f4efd6" cx={1600} cy={170} r={56} sinBorde={tema.dibujo !== "cabezon"} />}
      {!noche && <Forma tema={tema} fill={atardecer ? "#ffe2a0" : "#fff3c4"} cx={1640} cy={150} r={60} sinBorde={tema.dibujo !== "cabezon"} />}
      {nubes && !noche && [[260, 160, 1], [820, 110, 0.8], [1240, 200, 1.1]].map(([x, y, s], i) => {
        const dx = ((frame * 0.25 * (i + 1)) % 400) - 200;
        return <g key={i} transform={`translate(${x + dx}, ${y}) scale(${s})`}><Forma tema={tema} fill="#ffffff" d="M -90 20 Q -100 -20 -50 -16 Q -40 -56 10 -44 Q 40 -70 70 -34 Q 110 -36 100 10 Q 110 30 80 30 L -80 30 Q -110 30 -90 20 Z" grosor={0.7} /></g>;
      })}
    </g>
  );
};


/** Cielo gris de humo y lluvia (fábricas, trincheras); de noche, el de siempre. */
const CieloGris: React.FC<{ tema: Tema; noche?: boolean; frame: number }> = ({ tema, noche, frame }) => {
  if (noche) return <Cielo tema={tema} frame={frame} noche nubes={false} />;
  return (
    <g>
      <defs><linearGradient id="cielo-gris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8e959c" /><stop offset="1" stopColor="#d3d0c6" /></linearGradient></defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#cielo-gris)" />
      {[[300, 150, 1.3], [950, 110, 1], [1550, 180, 1.2]].map(([x, y, k], i) => {
        const dx = ((frame * 0.2 * (i + 1)) % 400) - 200;
        return <g key={i} transform={`translate(${x + dx}, ${y}) scale(${k})`} opacity={0.85}><Forma tema={tema} fill="#b9bcbf" d="M -120 26 Q -130 -20 -70 -18 Q -56 -64 10 -50 Q 52 -80 92 -38 Q 144 -40 132 14 Q 144 36 104 36 L -100 36 Q -144 36 -120 26 Z" grosor={0.6} /></g>;
      })}
    </g>
  );
};

/** Columnas de humo que suben y fuegos lejos (una batalla, una ciudad que arde): «humo»: true en la escena. */
const Humo: React.FC<{ tema: Tema; frame: number }> = ({ tema, frame }) => (
  <g>
    {[[260, 700, 1], [760, 660, 0.8], [1380, 690, 1.1], [1760, 650, 0.7]].map(([x, y, k], c) => (
      <g key={c}>
        {Array.from({ length: 8 }).map((_, i) => {
          const sube = (frame * 1.4 * k + i * 48 + c * 37) % 384;
          const r = (26 + sube * 0.22) * k;
          const op = Math.max(0, 0.75 - sube / 520);
          return <circle key={i} cx={x + Math.sin((sube + c * 50) / 60) * 26 * k + sube * 0.18} cy={y - sube} r={r} fill={i % 2 ? "#6f6f6f" : "#858585"} opacity={op} />;
        })}
        {[-1, 0, 1].map((j) => {
          const alto = (34 + Math.sin(frame * 0.5 + j * 2 + c) * 10) * k;
          return <path key={`f${j}`} d={`M ${x + j * 18 * k - 14 * k} ${y + 8} Q ${x + j * 18 * k} ${y + 8 - alto * 1.4} ${x + j * 18 * k + 14 * k} ${y + 8} Z`} fill={j === 0 ? "#f2c230" : "#e8641e"} stroke={tema.tinta} strokeWidth={1.5} />;
        })}
      </g>
    ))}
  </g>
);

const Barco: React.FC<{ tema: Tema; x: number; y: number; s: number; frame: number; i: number; id?: string }> = ({ tema, x, y, s, frame, i, id = "carabela" }) => (
  <g transform={`translate(${x}, ${y + Math.sin(frame * 0.07 + i) * 5}) rotate(${Math.sin(frame * 0.05 + i * 2) * 2}) scale(${s})`}><Cosa id={id} tema={tema} f={frame + i * 30} /></g>
);

/** Lo que va DELANTE de los muñecos (la mesa del despacho tapa las piernas del que está sentado). */
export const DecoradoDelante: React.FC<{ id: string; tema: Tema; frame: number }> = ({ id, tema }) => {
  if (id !== "despacho") return null;
  return (
    <g>
      <Forma tema={tema} fill="#6b4425" x={600} y={760} w={760} h={34} esq={6} />
      <Forma tema={tema} fill="#7a5230" x={630} y={792} w={700} h={170} esq={4} />
      {[660, 1260].map((x) => <Forma key={x} tema={tema} fill="#5a3d26" x={x} y={950} w={40} h={80} grosor={0.6} />)}
      <Forma tema={tema} fill="#f3e6c6" d="M 700 762 L 860 750 L 880 770 L 720 782 Z" grosor={0.6} />
      <path d="M 1180 752 L 1220 700" stroke="#f7f4ec" strokeWidth={6} strokeLinecap="round" />
      <Forma tema={tema} fill="#2a2624" cx={1180} cy={760} r={14} grosor={0.6} />
    </g>
  );
};

type PropsDecorado = { id: string; tema: Tema; frame: number; noche?: boolean; atardecer?: boolean; barcos?: number; estandartes?: string; barco?: string; tormenta?: boolean; u?: number; humo?: boolean; piramide?: boolean; estilo?: string; semilla?: number; cupula?: boolean };

/** El decorado de una escena; con «humo» (una batalla, una ciudad que arde) suben columnas de humo y arden fuegos lejos. */
export const Decorado: React.FC<PropsDecorado> = (p) => (
  <g>
    <DecoradoBase {...p} />
    {p.humo && !INTERIORES.has(p.id) ? <Humo tema={p.tema} frame={p.frame} /> : null}
  </g>
);
const INTERIORES = new Set(["sala_trono", "despacho", "interior"]);

const DecoradoBase: React.FC<PropsDecorado> = ({ id, tema, frame, noche, atardecer, barcos = 3, estandartes, barco, tormenta, u = 0, piramide = true, estilo, semilla = 1, cupula }) => {
  const tinta = tema.dibujo === "papel" ? "#fffaf2" : tema.tinta;
  const grueso = tema.dibujo === "cabezon" ? 6 : 3;
  switch (id) {
    case "sala_trono":
      // estandartes lisos (sin escudos) salvo «"estandartes": "espana"» (el castillo y las barras de Castilla y Aragón)
      return <SalaTrono tema={tema} frame={frame} lisos={estandartes !== "espana"} estandartes={estandartes !== "espana" ? [["#b5262b", "#f0c23b"], ["#b5262b", "#f0c23b"]] : undefined} />;
    case "mina": {
      // el Cerro Rico de Potosí (o cualquier mina de montaña): cono rojizo con bocaminas, vagoneta y mineral
      const cerro = "#a8603e";
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          <Forma tema={tema} fill="#c9a37a" d={`M 0 760 Q 300 640 620 720 Q 900 790 1100 760 L ${W} 780 L ${W} ${H} L 0 ${H} Z`} grosor={0.7} />
          <Forma tema={tema} fill={cerro} d="M 380 880 Q 600 760 760 560 Q 900 360 1080 230 Q 1170 168 1250 172 Q 1340 178 1420 250 Q 1600 420 1760 640 Q 1880 800 2040 880 Z" />
          {[[700, 760, 1500, 760], [820, 620, 1590, 640], [960, 470, 1440, 480], [1080, 330, 1340, 330]].map(([x1, y1, x2, y2], i) => <path key={i} d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 - 30} ${x2} ${y2}`} stroke={tono(cerro, -0.18)} strokeWidth={6} fill="none" opacity={0.7} />)}
          {[[1000, 700], [1380, 600], [1190, 420]].map(([x, y], i) => (
            <g key={`b${i}`}>
              <Forma tema={tema} fill="#7a5230" d={`M ${x - 56} ${y + 60} L ${x - 56} ${y - 10} Q ${x} ${y - 66} ${x + 56} ${y - 10} L ${x + 56} ${y + 60} Z`} grosor={0.8} />
              <Forma tema={tema} fill="#2a1d14" d={`M ${x - 38} ${y + 60} L ${x - 38} ${y} Q ${x} ${y - 40} ${x + 38} ${y} L ${x + 38} ${y + 60} Z`} grosor={0.6} />
            </g>
          ))}
          <rect x={0} y={880} width={W} height={H - 880} fill="#b98a5c" />
          <path d={`M 0 880 L ${W} 880`} stroke={tinta} strokeWidth={grueso * 0.7} opacity={0.6} />
          <path d="M 0 990 L 1100 950 M 0 1030 L 1100 990" stroke="#5a4632" strokeWidth={8} />
          <g transform="translate(300, 990) scale(1.6)">
            <Forma tema={tema} fill="#6b4a2e" d="M -110 -80 L 110 -80 L 90 0 L -90 0 Z" />
            {[-60, -15, 30, 70].map((x, i) => <Forma key={i} tema={tema} fill="#c7ccd3" cx={x} cy={-92} r={26} brillo grosor={0.7} />)}
            {[-60, 60].map((x) => <Forma key={x} tema={tema} fill="#3b2a1e" cx={x} cy={4} r={18} grosor={0.7} />)}
          </g>
          {[[1600, 950], [1760, 980], [720, 965]].map(([x, y], i) => <Forma key={`r${i}`} tema={tema} fill="#8a6a50" d={`M ${x - 40} ${y} Q ${x - 30} ${y - 40} ${x} ${y - 44} Q ${x + 34} ${y - 38} ${x + 42} ${y} Z`} grosor={0.6} />)}
        </g>
      );
    }
    case "despacho": {
      // despacho de un rey, un banquero o un ministro: paneles de madera, estantería, mapa en la pared y ventana
      const madera = "#7a5230";
      return (
        <g>
          <rect x={0} y={0} width={W} height={H} fill="#e3cfa6" />
          <rect x={0} y={560} width={W} height={300} fill={madera} />
          {Array.from({ length: 10 }).map((_, i) => <Forma key={i} tema={tema} fill={tono(madera, 0.08)} x={i * 196 + 16} y={590} w={164} h={240} esq={4} grosor={0.5} />)}
          {/* estantería con libros */}
          <Forma tema={tema} fill="#5a3d26" x={70} y={140} w={360} h={520} esq={4} />
          {[0, 1, 2, 3].map((f) => Array.from({ length: 9 }).map((_, k) => { const cs = ["#a8262c", "#2f4f8f", "#3f7a4a", "#c9a24a", "#6b2f6b"]; return <rect key={`${f}-${k}`} x={92 + k * 36} y={170 + f * 120} width={28} height={96 - (k % 3) * 10} fill={cs[(k + f) % 5]} stroke={tinta} strokeWidth={2} />; }))}
          {[0, 1, 2, 3].map((f) => <rect key={`e${f}`} x={70} y={268 + f * 120} width={360} height={10} fill="#3b2a1e" />)}
          {/* mapa en la pared */}
          <Forma tema={tema} fill="#efe1bf" x={780} y={120} w={420} h={290} esq={6} />
          <path d="M 830 200 Q 880 170 930 210 Q 970 250 920 300 Q 870 330 840 280 Z M 990 180 Q 1080 160 1140 220 Q 1150 300 1060 330 Q 1000 300 990 240 Z" fill="#9cbf7a" stroke={tinta} strokeWidth={2} />
          {/* ventana con cortinas */}
          <Forma tema={tema} fill="#8fc4e8" x={1450} y={110} w={300} h={380} esq={6} />
          <path d="M 1600 110 L 1600 490 M 1450 300 L 1750 300" stroke={tinta} strokeWidth={4} />
          <Forma tema={tema} fill="#8e2a26" d="M 1420 90 L 1500 90 Q 1470 300 1500 520 L 1420 520 Z" />
          <Forma tema={tema} fill="#8e2a26" d="M 1780 90 L 1700 90 Q 1730 300 1700 520 L 1780 520 Z" />
          <rect x={0} y={860} width={W} height={H - 860} fill="#a8794e" />
          {Array.from({ length: 9 }).map((_, i) => <path key={`t${i}`} d={`M ${i * 240} 860 L ${i * 240 - 80} ${H}`} stroke={tono("#a8794e", -0.2)} strokeWidth={3} />)}
          {/* sillón detrás de la mesa */}
          <Forma tema={tema} fill="#6e1f1c" d="M 880 860 L 880 520 Q 1000 450 1120 520 L 1120 860 Z" />
        </g>
      );
    }
    case "puerto": {
      const mar = noche ? "#24406e" : "#3f86c4";
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* pueblo al fondo, en la otra orilla (más grande: antes las casas eran más pequeñas que un barril) */}
          <g transform="translate(1540, 690) scale(1.7) translate(-1540, -690)">
          {[[1300, 520], [1420, 500], [1540, 530], [1660, 505], [1780, 525]].map(([x, y], i) => (
            <g key={i}>
              <Forma tema={tema} fill={tono("#efe3c6", -0.05 * (i % 2))} x={x - 55} y={y} w={110} h={680 - y} esq={3} grosor={0.7} />
              <Forma tema={tema} fill="#b4573a" d={`M ${x - 65} ${y + 4} L ${x} ${y - 46} L ${x + 65} ${y + 4} Z`} grosor={0.7} />
              <rect x={x - 14} y={y + 40} width={28} height={36} fill={tono("#5a3d26", 0.1)} />
            </g>
          ))}
          </g>
          <Forma tema={tema} fill="#d8c08f" d={`M 1180 690 Q 1500 640 ${W} 660 L ${W} 760 L 1180 760 Z`} grosor={0.7} />
          <rect x={0} y={680} width={W} height={H - 680} fill={mar} />
          {[720, 780, 860, 960].map((y, i) => <path key={y} d={`M ${-100 + ((frame * (0.6 + i * 0.2)) % 200)} ${y} q 40 -10 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`} stroke={tono(mar, 0.25)} strokeWidth={3} fill="none" opacity={0.6} />)}
          {Array.from({ length: Math.min(barcos, 2) }).map((_, i) => <Barco key={i} tema={tema} x={i ? 330 : 1000} y={900 - i * 40} s={(i ? 2.6 : 3.4)} frame={frame} i={i} id={barco} />)}
          {/* el muelle de piedra a lo ancho, delante: los muñecos están en tierra, no sobre el agua */}
          <Forma tema={tema} fill="#d6c7a8" x={-20} y={985} w={W + 40} h={H - 985} grosor={0.8} />
          {Array.from({ length: 10 }).map((_, i) => <path key={`q${i}`} d={`M ${i * 200 + 80} 985 L ${i * 200 + 60} ${H}`} stroke={tono("#d6c7a8", -0.22)} strokeWidth={3} />)}
          {[300, 760].map((x) => <g key={`b${x}`}><Forma tema={tema} fill="#6b6f75" x={x - 14} y={950} w={28} h={40} esq={6} grosor={0.6} /></g>)}
          {/* pantalán de madera */}
          <Forma tema={tema} fill="#9a6a3c" x={1080} y={900} w={W - 1080} h={60} esq={4} />
          {[1120, 1300, 1480, 1660, 1840].map((x) => <Forma key={x} tema={tema} fill={tono("#9a6a3c", -0.25)} x={x} y={950} w={26} h={130} esq={3} grosor={0.7} />)}
          <Forma tema={tema} fill={tono("#9a6a3c", 0.15)} x={1060} y={980} w={W - 1060} h={H - 980} grosor={0.8} />
          <path d={`M 1060 980 L ${W} 980`} stroke={tinta} strokeWidth={grueso} />
          {[1500, 1640].map((x) => <g key={x} transform={`translate(${x}, 975) scale(0.6)`}><Cosa id="barril" tema={tema} /></g>)}
        </g>
      );
    }
    case "mar": {
      const mar = tormenta ? "#1b2c48" : noche ? "#1f3864" : "#2f76b8";
      if (tormenta) {
        // el tifón (Japón, 1281): nubes negras, lluvia, rayos, olas grandes y los barcos que se escoran y se hunden a lo
        // largo del plano (los de en medio primero); el agua de delante tapa lo que se hunde
        const rayo = frame % 64 < 4 || (frame + 23) % 97 < 3;
        return (
          <g>
            <rect x={0} y={0} width={W} height={H} fill="#2a3348" />
            {[[200, 120, 1.3], [700, 80, 1.1], [1200, 140, 1.4], [1700, 90, 1.2]].map(([x, y, k], i) => (
              <g key={`n${i}`} transform={`translate(${x + Math.sin(frame * 0.02 + i) * 30}, ${y}) scale(${k})`}>
                <Forma tema={tema} fill="#3b4258" d="M -170 40 Q -180 -10 -120 -16 Q -100 -70 -30 -54 Q 20 -90 80 -50 Q 160 -50 160 10 Q 190 40 140 50 L -150 50 Q -190 50 -170 40 Z" sinBorde />
              </g>
            ))}
            {rayo && <path d={`M ${1300 + (frame % 3) * 120} 140 l -60 140 l 50 0 l -70 170 l 120 -200 l -50 0 l 50 -110 z`} fill="#fff6c8" />}
            <rect x={0} y={560} width={W} height={H - 560} fill={mar} />
            {[600, 680, 770].map((y, i) => <path key={y} d={`M ${-240 + ((frame * (2.2 + i)) % 240)} ${y} ${Array.from({ length: 11 }).map(() => "q 60 -46 120 0 t 120 0").join(" ")}`} stroke="#cfdcea" strokeWidth={4 + i * 2} fill="none" opacity={0.6} />)}
            {Array.from({ length: barcos }).map((_, i) => {
              const hunde = CURVA.suave(clamp((u - 0.15 - (i === 1 ? 0 : 0.25 + i * 0.1)) / 0.55));
              return (
                <g key={i} transform={`translate(${520 + i * 440}, ${730 + (i % 2) * 30 + hunde * 260}) rotate(${Math.sin(frame * 0.12 + i * 2) * 12 + hunde * (i % 2 ? -30 : 30)})`}>
                  <Barco tema={tema} x={0} y={0} s={1.25 + (i === 1 ? 0.35 : 0)} frame={frame} i={i} id={barco} />
                </g>
              );
            })}
            <Forma tema={tema} fill={mar} d={`M 0 ${800 + Math.sin(frame * 0.1) * 14} ${Array.from({ length: 8 }).map((_, k) => `Q ${k * 240 + 120} ${750 + Math.sin(frame * 0.1 + k) * 20} ${(k + 1) * 240} ${800 + Math.sin(frame * 0.1 + k + 1) * 14}`).join(" ")} L ${W} ${H} L 0 ${H} Z`} sinBorde />
            <g stroke="#b9c6d8" strokeWidth={3} opacity={0.55}>
              {Array.from({ length: 70 }).map((_, i) => { const x = ((i * 137 + frame * 26) % (W + 300)) - 150, y = ((i * 211 + frame * 44) % H); return <line key={i} x1={x} y1={y} x2={x - 22} y2={y + 60} />; })}
            </g>
            {rayo && <rect x={0} y={0} width={W} height={H} fill="#ffffff" opacity={0.28} />}
          </g>
        );
      }
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          <rect x={0} y={600} width={W} height={H - 600} fill={mar} />
          {[640, 700, 780, 880, 1000].map((y, i) => <path key={y} d={`M ${-160 + ((frame * (0.8 + i * 0.3)) % 160)} ${y} q 40 -12 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`} stroke={tono(mar, 0.3)} strokeWidth={3 + i} fill="none" opacity={0.55} />)}
          {Array.from({ length: barcos }).map((_, i) => <Barco key={i} tema={tema} x={700 + i * 380} y={720 + (i % 2) * 40} s={1.2 + (i === 0 ? 0.6 : 0)} frame={frame} i={i} id={barco} />)}
        </g>
      );
    }
    case "campo":
    case "desierto":
    case "nieve": {
      const [lejos, cerca, suelo] = id === "desierto" ? ["#e3b878", "#d9a35c", "#e8c48a"] : id === "nieve" ? ["#dfe8ef", "#c9d6e0", "#f3f6f8"] : ["#8fbf6a", "#79ab55", "#9ccc74"];
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          <Forma tema={tema} fill={lejos} d={`M 0 640 Q 300 520 640 600 Q 1000 680 1300 560 Q 1600 470 ${W} 600 L ${W} ${H} L 0 ${H} Z`} grosor={0.7} />
          <Forma tema={tema} fill={cerca} d={`M 0 760 Q 500 690 1000 760 Q 1500 820 ${W} 740 L ${W} ${H} L 0 ${H} Z`} grosor={0.7} />
          <rect x={0} y={880} width={W} height={H - 880} fill={suelo} />
          <path d={`M 0 880 L ${W} 880`} stroke={tinta} strokeWidth={grueso * 0.7} opacity={0.6} />
          {id === "campo" && (
            <g>
              {/* castillo lejos, en la loma */}
              <g transform="translate(330, 560) scale(0.9)" opacity={0.9}>
                <Forma tema={tema} fill="#b9a98a" d="M -90 40 L -90 -40 L -70 -40 L -70 -60 L -50 -60 L -50 -40 L -20 -40 L -20 -90 L 0 -110 L 20 -90 L 20 -40 L 50 -40 L 50 -60 L 70 -60 L 70 -40 L 90 -40 L 90 40 Z" grosor={0.6} />
                <path d="M 0 -110 L 0 -140" stroke={tinta} strokeWidth={2.5} /><path d="M 0 -140 l 22 7 l -22 7 z" fill="#b5262b" />
                <rect x={-10} y={10} width={20} height={30} rx={8} fill="#5a3d26" />
              </g>
              {/* camino de tierra que se pierde hacia el fondo */}
              <Forma tema={tema} fill="#d8b77e" d={`M 760 ${H} Q 860 900 900 820 Q 960 720 1050 690 L 1080 692 Q 1010 730 990 820 Q 960 920 1180 ${H} Z`} grosor={0.6} />
              {/* valla */}
              {Array.from({ length: 9 }).map((_, i) => <Forma key={`v${i}`} tema={tema} fill="#9a6a3c" x={1250 + i * 70} y={812 - i * 6} w={12} h={58} esq={3} grosor={0.5} />)}
              <path d="M 1250 826 L 1880 778 M 1250 846 L 1880 798" stroke="#7a5230" strokeWidth={7} strokeLinecap="round" />
              {/* árboles */}
              {[[180, 760, 1.1], [1700, 690, 0.9], [560, 700, 0.7], [1460, 720, 0.75]].map(([x, y, k], i) => (
                <g key={`a${i}`} transform={`translate(${x}, ${y}) scale(${k})`}><Forma tema={tema} fill="#6b4425" x={-10} y={0} w={20} h={90} grosor={0.7} /><Forma tema={tema} fill={i % 2 ? "#5a9a44" : "#4f8f3a"} cx={0} cy={-30} r={64} /><Forma tema={tema} fill={i % 2 ? "#6aaa52" : "#5f9f48"} cx={-22} cy={-52} r={30} sinBorde /></g>
              ))}
              {/* hierba y flores */}
              {Array.from({ length: 26 }).map((_, i) => { const x = (i * 271) % 1900 + 10, y = 900 + ((i * 97) % 170); return <path key={`h${i}`} d={`M ${x - 9} ${y} l 6 -16 M ${x} ${y} l 0 -20 M ${x + 9} ${y} l -6 -16`} stroke="#5f9445" strokeWidth={3} strokeLinecap="round" />; })}
              {Array.from({ length: 14 }).map((_, i) => { const x = (i * 433) % 1880 + 20, y = 930 + ((i * 61) % 140); return <circle key={`f${i}`} cx={x} cy={y} r={6} fill={["#f2c230", "#ffffff", "#e0679b"][i % 3]} stroke={tinta} strokeWidth={1.5} />; })}
              {/* pájaros */}
              {[0, 1, 2].map((i) => { const x = ((frame * 2.2 + i * 90) % 2200) - 140, y = 230 + i * 26 + Math.sin(frame * 0.2 + i) * 5; const a = Math.sin(frame * 0.5 + i) * 6; return <path key={`p${i}`} d={`M ${x - 14} ${y - a} Q ${x - 6} ${y - 8} ${x} ${y} Q ${x + 6} ${y - 8} ${x + 14} ${y - a}`} stroke={tinta} strokeWidth={3} fill="none" strokeLinecap="round" />; })}
            </g>
          )}
          {id === "desierto" && [[300, 820], [1500, 800]].map(([x, y], i) => <Forma key={i} tema={tema} fill="#5d8f4a" d={`M ${x} ${y} L ${x} ${y - 140} Q ${x} ${y - 160} ${x + 16} ${y - 150} L ${x + 16} ${y} Z`} grosor={0.7} />)}
        </g>
      );
    }
    case "ciudad":
      // ver ciudad.tsx: calle con las fachadas al fondo, casas que cambian con el plano y estilo «europa» u «oriente»
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          <Ciudad tema={tema} frame={frame} noche={noche} estilo={estilo} semilla={semilla} cupula={cupula} />
        </g>
      );
    case "canales": {
      // una ciudad sobre el agua (Venecia, Ámsterdam, Brujas, Tenochtitlan con otros tejados): fachadas de colores con
      // ventanas en arco a los dos lados de un canal, un puente de piedra, una góndola y el muelle delante (los pies)
      const agua = noche ? "#24406e" : "#3f8aa8";
      const fach = ["#e7b98a", "#d98e6a", "#efd9ae", "#c9705a", "#e3c290", "#b9876a", "#efcf9e"];
      const casa = (x: number, w: number, h: number, i: number, base: number) => (
        <g key={`${base}${i}`}>
          <Forma tema={tema} fill={fach[i % fach.length]} x={x} y={base - h} w={w} h={h} grosor={0.8} />
          <rect x={x - 4} y={base - h - 10} width={w + 8} height={14} fill={tono(fach[i % fach.length], -0.3)} />
          {Array.from({ length: Math.floor((h - 60) / 90) }).map((_, f) => [0, 1, 2].slice(0, w > 150 ? 3 : 2).map((c) => {
            const vx = x + 22 + c * ((w - 44) / (w > 150 ? 3 : 2)), vy = base - h + 40 + f * 90, vw = (w - 44) / (w > 150 ? 3 : 2) - 16;
            return <path key={`${f}${c}`} d={`M ${vx} ${vy + 50} L ${vx} ${vy + 16} Q ${vx + vw / 2} ${vy - 8} ${vx + vw} ${vy + 16} L ${vx + vw} ${vy + 50} Z`} fill={noche ? "#f2cf6a" : "#4f6680"} opacity={0.88} />;
          }))}
          <path d={`M ${x} ${base} L ${x + w} ${base}`} stroke={tinta} strokeWidth={grueso * 0.7} />
        </g>
      );
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* campanario al fondo */}
          <Forma tema={tema} fill="#c9705a" x={1370} y={180} w={70} h={480} grosor={0.8} />
          <Forma tema={tema} fill="#7a8f6a" d="M 1360 184 L 1405 90 L 1450 184 Z" grosor={0.8} />
          <rect x={1390} y={220} width={30} height={40} fill="#4f6680" />
          {[[0, 180, 470], [180, 150, 400], [330, 200, 520], [530, 160, 430]].map(([x, w, h], i) => casa(x, w, h, i, 760))}
          {[[1160, 170, 420], [1330, 160, 360], [1490, 210, 500], [1700, 230, 440]].map(([x, w, h], i) => casa(x, w, h, i + 4, 760))}
          <rect x={0} y={740} width={W} height={H - 740} fill={agua} />
          {/* reflejos */}
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={`r${i}`} x={80 + i * 330 + Math.sin(frame * 0.05 + i) * 10} y={770 + (i % 2) * 40} width={120} height={6} rx={3} fill={tono(agua, 0.35)} opacity={0.6} />)}
          {[790, 850, 920].map((y, i) => <path key={y} d={`M ${-100 + ((frame * (0.5 + i * 0.2)) % 200)} ${y} q 40 -8 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`} stroke={tono(agua, 0.25)} strokeWidth={3} fill="none" opacity={0.6} />)}
          {/* puente de piedra en arco */}
          <Forma tema={tema} fill="#e3d6bc" d="M 690 760 L 690 640 Q 960 548 1230 640 L 1230 760 L 1170 760 Q 1160 672 960 664 Q 760 672 750 760 Z" />
          <Forma tema={tema} fill="#efe4cc" d="M 680 646 Q 960 548 1240 646 L 1240 620 Q 960 522 680 620 Z" grosor={0.7} />
          {[760, 840, 920, 1000, 1080, 1160].map((x) => <path key={`bal${x}`} d={`M ${x} ${640 - Math.sin(((x - 680) / 560) * Math.PI) * 92} l 0 -24`} stroke={tono("#e3d6bc", -0.3)} strokeWidth={5} />)}
          {/* góndola que cruza despacio */}
          {(() => { const gx = ((frame * 1.6) % 2400) - 240; return (
            <g transform={`translate(${gx}, ${830 + Math.sin(frame * 0.08) * 3})`}>
              <Forma tema={tema} fill="#26201c" d="M -150 0 Q -120 22 0 24 Q 120 22 150 0 Q 172 -20 168 -46 L 156 -40 Q 150 -10 120 -6 L -120 -6 Q -150 -10 -158 -30 Z" />
              <rect x={-60} y={-24} width={70} height={18} rx={4} fill="#7a1f2b" />
              <path d="M 110 -6 L 136 -110" stroke="#6b4425" strokeWidth={5} strokeLinecap="round" />
            </g>
          ); })()}
          {/* muelle de piedra delante, donde están los muñecos */}
          <Forma tema={tema} fill="#d6c7a8" x={-20} y={960} w={W + 40} h={H - 960} grosor={0.8} />
          {Array.from({ length: 10 }).map((_, i) => <path key={`m${i}`} d={`M ${i * 200 + 60} 960 L ${i * 200 + 40} ${H}`} stroke={tono("#d6c7a8", -0.22)} strokeWidth={3} />)}
          <path d={`M 0 960 L ${W} 960`} stroke={tinta} strokeWidth={grueso} />
          {[220, 1700].map((x) => <g key={x}><Forma tema={tema} fill="#f4efe3" x={x - 9} y={830} w={18} h={140} esq={4} grosor={0.6} /><path d={`M ${x - 9} 860 L ${x + 9} 878 M ${x - 9} 900 L ${x + 9} 918`} stroke="#2c4a8a" strokeWidth={6} /></g>)}
        </g>
      );
    }
    case "laguna": {
      // marismas y lagunas (los primeros venecianos, deltas, Tenochtitlan antes de la ciudad): agua quieta con islotes
      // de barro y cañas, palafitos lejos y una isla de barro delante donde se ponen los muñecos
      const agua = noche ? "#2a4a6e" : "#7fb2c4";
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          <rect x={0} y={600} width={W} height={H - 600} fill={agua} />
          {[640, 700, 780, 870].map((y, i) => <path key={y} d={`M ${-100 + ((frame * (0.3 + i * 0.1)) % 200)} ${y} q 40 -6 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`} stroke={tono(agua, 0.25)} strokeWidth={2.5} fill="none" opacity={0.6} />)}
          {[[300, 650, 1.1], [820, 630, 0.8], [1500, 660, 1.2]].map(([x, y, k], i) => <g key={`i${i}`} transform={`translate(${x}, ${y}) scale(${k})`}><Cosa id="islote" tema={tema} /></g>)}
          {/* palafitos a media distancia (más grandes: antes, más pequeños que una cabeza) */}
          {[1120, 1250].map((x, i) => (
            <g key={`p${i}`} transform={`translate(${x}, 650) scale(2.2) translate(${-x}, -640)`}>
              {[-30, 0, 30].map((dx) => <path key={dx} d={`M ${x + dx} 640 L ${x + dx} 600`} stroke="#6b4425" strokeWidth={5} />)}
              <Forma tema={tema} fill="#c9a66b" x={x - 44} y={560} w={88} h={42} esq={2} grosor={0.6} />
              <Forma tema={tema} fill="#b89a5a" d={`M ${x - 54} 562 L ${x} 520 L ${x + 54} 562 Z`} grosor={0.6} />
            </g>
          ))}
          {/* pájaros */}
          {[0, 1].map((i) => { const x = ((frame * 1.8 + i * 120) % 2200) - 140, y = 260 + i * 30 + Math.sin(frame * 0.2 + i) * 5; const a = Math.sin(frame * 0.5 + i) * 6; return <path key={`b${i}`} d={`M ${x - 14} ${y - a} Q ${x - 6} ${y - 8} ${x} ${y} Q ${x + 6} ${y - 8} ${x + 14} ${y - a}`} stroke={tinta} strokeWidth={3} fill="none" strokeLinecap="round" />; })}
          {/* la isla de barro delante */}
          <Forma tema={tema} fill="#a8946a" d={`M -40 ${H} L -40 930 Q 400 880 960 890 Q 1500 880 ${W + 40} 930 L ${W + 40} ${H} Z`} />
          {Array.from({ length: 18 }).map((_, i) => { const x = (i * 211) % 1880 + 20; return <path key={`c${i}`} d={`M ${x} 940 Q ${x + 6} 880 ${x + 14} ${850 - (i % 3) * 20}`} stroke="#6f8a3e" strokeWidth={5} fill="none" strokeLinecap="round" />; })}
        </g>
      );
    }
    case "tenochtitlan": {
      // Tenochtitlan (añadido para la historia 4): los volcanes al fondo, el lago, la ciudad blanca de azoteas planas,
      // el Templo Mayor con sus dos santuarios (rojo, Huitzilopochtli; azul, Tláloc), canoas y la calzada de piedra delante
      const agua = noche ? "#2a4a6e" : "#6fa8bf";
      const piedra = "#c9bfa6";
      const casas = [[40, 120, 46], [170, 90, 60], [270, 140, 40], [420, 100, 56], [530, 130, 44], [670, 90, 64], [770, 150, 42],
        [1560, 110, 50], [1680, 140, 42], [1830, 120, 58]];
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* volcanes: Popocatépetl e Iztaccíhuatl */}
          <Forma tema={tema} fill="#8d9fbd" d="M 1300 600 L 1560 330 L 1640 320 L 1900 600 Z" grosor={0.6} />
          <Forma tema={tema} fill="#f4f6fa" d="M 1500 392 L 1560 330 L 1640 320 L 1700 386 L 1650 372 L 1600 392 L 1550 376 Z" grosor={0.5} />
          <Forma tema={tema} fill="#9aabc6" d="M 0 600 L 160 470 L 300 440 L 420 470 L 560 420 L 700 600 Z" grosor={0.6} />
          <Forma tema={tema} fill="#f4f6fa" d="M 250 452 L 300 440 L 360 456 L 330 462 Z" grosor={0.4} />
          <rect x={0} y={600} width={W} height={H - 600} fill={agua} />
          {[650, 720, 800, 860].map((y, i) => <path key={y} d={`M ${-100 + ((frame * (0.3 + i * 0.1)) % 200)} ${y} q 40 -6 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`} stroke={tono(agua, 0.25)} strokeWidth={2.5} fill="none" opacity={0.6} />)}
          {/* la isla de la ciudad */}
          <Forma tema={tema} fill="#b9a982" d={`M 0 640 L 0 600 L ${W} 600 L ${W} 640 Z`} grosor={0.5} />
          {casas.map(([x, w, h], i) => (
            <g key={`c${i}`}>
              <Forma tema={tema} fill={i % 3 === 1 ? "#efe6d2" : "#f7f2e6"} x={x} y={612 - h} w={w} h={h} esq={1} grosor={0.6} />
              <rect x={x + w * 0.35} y={612 - h * 0.55} width={w * 0.3} height={h * 0.55} fill="#6b4425" opacity={0.75} />
              <rect x={x - 3} y={612 - h - 6} width={w + 6} height={8} fill={i % 2 ? "#c0392b" : "#d9b26a"} />
            </g>
          ))}
          {/* el Templo Mayor: cinco cuerpos, doble escalinata y dos santuarios */}
          {Array.from({ length: 5 }).map((_, i) => <Forma key={`tm${i}`} tema={tema} fill={tono(piedra, -0.04 * (i % 2))} x={900 + i * 44} y={612 - (i + 1) * 62} w={560 - i * 88} h={64} esq={2} grosor={0.8} />)}
          <Forma tema={tema} fill={tono(piedra, 0.08)} d="M 1120 612 L 1146 302 L 1214 302 L 1240 612 Z" grosor={0.7} />
          <path d="M 1180 612 L 1180 302" stroke={tono(piedra, -0.35)} strokeWidth={4} />
          {Array.from({ length: 14 }).map((_, i) => <path key={`es${i}`} d={`M ${1124 + i * 1.8} ${590 - i * 21} L ${1236 - i * 1.8} ${590 - i * 21}`} stroke={tono(piedra, -0.2)} strokeWidth={2.5} />)}
          <Forma tema={tema} fill="#c0392b" x={1086} y={232} w={84} h={72} esq={2} grosor={0.8} />
          <Forma tema={tema} fill="#8e2a20" d="M 1078 236 L 1128 196 L 1178 236 Z" grosor={0.7} />
          <rect x={1112} y={262} width={32} height={42} fill="#2a1d14" />
          <Forma tema={tema} fill="#3c7fd0" x={1190} y={232} w={84} h={72} esq={2} grosor={0.8} />
          <Forma tema={tema} fill="#2a5a9a" x={1184} y={214} w={96} h={22} esq={2} grosor={0.7} />
          <rect x={1216} y={262} width={32} height={42} fill="#2a1d14" />
          {/* chinampas */}
          {[[120, 690, 260], [1500, 700, 300]].map(([x, y, w], i) => (
            <g key={`ch${i}`}>
              <Forma tema={tema} fill="#7a9a4a" x={x} y={y} w={w} h={26} esq={6} grosor={0.5} />
              {Array.from({ length: 6 }).map((_, k) => <path key={k} d={`M ${x + 20 + k * (w - 40) / 5} ${y + 2} q 4 -26 10 -34`} stroke="#4f7a2e" strokeWidth={4} fill="none" strokeLinecap="round" />)}
            </g>
          ))}
          {/* canoas */}
          {[[0, 760, 0.9], [1, 820, 1.1]].map(([i, y, k]) => { const x = ((frame * (0.9 + i * 0.4) + i * 900) % 2300) - 200; return (
            <g key={`ca${i}`} transform={`translate(${x}, ${y}) scale(${k})`}>
              <Forma tema={tema} fill="#7a4a24" d="M -90 0 Q 0 26 90 0 L 76 -12 L -76 -12 Z" grosor={0.6} />
              <circle cx={10} cy={-30} r={11} fill="#e8c39e" stroke={tinta} strokeWidth={2} />
              <path d="M 10 -19 L 10 -12" stroke={tinta} strokeWidth={6} />
              <path d={`M 40 -40 L ${-20} 16`} stroke="#6b4425" strokeWidth={4} />
            </g>
          ); })}
          {/* pájaros */}
          {[0, 1].map((i) => { const x = ((frame * 1.8 + i * 120) % 2200) - 140, y = 220 + i * 30 + Math.sin(frame * 0.2 + i) * 5; const a = Math.sin(frame * 0.5 + i) * 6; return <path key={`b${i}`} d={`M ${x - 14} ${y - a} Q ${x - 6} ${y - 8} ${x} ${y} Q ${x + 6} ${y - 8} ${x + 14} ${y - a}`} stroke={tinta} strokeWidth={3} fill="none" strokeLinecap="round" />; })}
          {/* la calzada de piedra delante, donde están los muñecos */}
          <Forma tema={tema} fill={piedra} d={`M -40 ${H} L -40 920 Q 960 900 ${W + 40} 920 L ${W + 40} ${H} Z`} />
          {Array.from({ length: 12 }).map((_, i) => <path key={`lo${i}`} d={`M ${i * 170 + 40} ${930 + (i % 2) * 40} l 0 ${60 - (i % 2) * 20}`} stroke={tono(piedra, -0.2)} strokeWidth={3} />)}
          <path d={`M -40 990 L ${W + 40} 990`} stroke={tono(piedra, -0.15)} strokeWidth={3} />
        </g>
      );
    }
    case "estepa": {
      // la estepa (Mongolia, Asia central, las llanuras): hierba amarilla hasta el horizonte, montañas azules lejos,
      // yurtas y nada más (el «campo» tiene castillo, valla y árboles)
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          <Forma tema={tema} fill="#8fa3c0" d={`M 0 640 L 180 520 L 330 600 L 520 470 L 700 590 L 900 500 L 1100 610 L 1320 480 L 1520 590 L 1720 510 L ${W} 600 L ${W} 700 L 0 700 Z`} grosor={0.7} />
          <Forma tema={tema} fill="#c9bb6a" d={`M 0 680 Q 600 640 1100 680 Q 1500 710 ${W} 670 L ${W} ${H} L 0 ${H} Z`} grosor={0.7} />
          <rect x={0} y={860} width={W} height={H - 860} fill="#d6c878" />
          {/* yurtas a media distancia: más de media persona de alto (antes, del tamaño de una piedra) */}
          {[[330, 760, 1.8], [610, 745, 1.4], [1560, 755, 1.6]].map(([x, y, k], i) => <g key={`y${i}`} transform={`translate(${x}, ${y}) scale(${k})`}><Cosa id="yurta" tema={tema} /></g>)}
          {Array.from({ length: 30 }).map((_, i) => { const x = (i * 271) % 1900 + 10, y = 880 + ((i * 97) % 190); return <path key={`h${i}`} d={`M ${x - 9} ${y} l 6 -16 M ${x} ${y} l 0 -22 M ${x + 9} ${y} l -6 -16`} stroke="#a89a4a" strokeWidth={3} strokeLinecap="round" />; })}
          {/* hierba que mueve el viento */}
          {Array.from({ length: 6 }).map((_, i) => <path key={`v${i}`} d={`M ${i * 340 + ((frame * 2) % 340) - 170} ${780 + (i % 3) * 30} q 40 -10 80 0`} stroke="#f1e9b8" strokeWidth={3} fill="none" opacity={0.7} />)}
        </g>
      );
    }
    case "foro": {
      // Roma o Grecia: templo de columnas con frontón sobre escalinata, una estatua, pórtico al fondo y plaza enlosada
      const marmol = "#efe7d6";
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* colinas y cipreses al fondo */}
          <Forma tema={tema} fill="#9cb47a" d={`M 0 640 Q 300 560 620 610 Q 900 650 1200 590 Q 1550 530 ${W} 610 L ${W} 800 L 0 800 Z`} grosor={0.6} />
          {[[120, 640], [190, 650], [1820, 620]].map(([x, y], i) => <g key={`ci${i}`}><Forma tema={tema} fill="#3f6a3a" d={`M ${x} ${y - 150} Q ${x + 30} ${y - 60} ${x + 22} ${y} L ${x - 22} ${y} Q ${x - 30} ${y - 60} ${x} ${y - 150} Z`} grosor={0.7} /></g>)}
          {/* pórtico bajo a la izquierda */}
          <Forma tema={tema} fill={tono(marmol, -0.06)} x={230} y={560} w={600} h={30} esq={2} grosor={0.7} />
          <Forma tema={tema} fill={tono(marmol, -0.1)} x={230} y={590} w={600} h={190} grosor={0.7} />
          {Array.from({ length: 6 }).map((_, i) => <path key={`ar${i}`} d={`M ${262 + i * 96} 780 L ${262 + i * 96} 660 Q ${302 + i * 96} 612 ${342 + i * 96} 660 L ${342 + i * 96} 780 Z`} fill={tono(marmol, -0.42)} />)}
          {/* templo */}
          <Forma tema={tema} fill={tono(marmol, -0.05)} d="M 930 330 L 1300 200 L 1670 330 Z" />
          <Forma tema={tema} fill={tono(marmol, -0.25)} d="M 990 318 L 1300 222 L 1610 318 Z" grosor={0.5} />
          <Forma tema={tema} fill={marmol} x={920} y={330} w={760} h={56} esq={2} />
          <path d="M 920 352 L 1680 352" stroke={tono(marmol, -0.3)} strokeWidth={3} />
          <Forma tema={tema} fill={tono(marmol, -0.32)} x={950} y={386} w={700} h={300} grosor={0.6} />
          <Forma tema={tema} fill={tono(marmol, -0.5)} d="M 1250 686 L 1250 500 Q 1300 450 1350 500 L 1350 686 Z" grosor={0.6} />
          {Array.from({ length: 6 }).map((_, i) => {
            const x = 960 + i * 132;
            return (
              <g key={`co${i}`}>
                <Forma tema={tema} fill={marmol} x={x} y={386} w={56} h={300} esq={3} />
                {[14, 28, 42].map((dx) => <path key={dx} d={`M ${x + dx} 396 L ${x + dx} 676`} stroke={tono(marmol, -0.2)} strokeWidth={2.5} />)}
                <Forma tema={tema} fill={tono(marmol, -0.08)} x={x - 8} y={380} w={72} h={14} esq={2} grosor={0.6} />
                <Forma tema={tema} fill={tono(marmol, -0.08)} x={x - 8} y={680} w={72} h={14} esq={2} grosor={0.6} />
              </g>
            );
          })}
          {/* escalinata */}
          {[0, 1, 2, 3].map((i) => <Forma key={`es${i}`} tema={tema} fill={tono(marmol, -0.04 * i)} x={890 - i * 30} y={694 + i * 24} w={820 + i * 60} h={24} grosor={0.7} />)}
          {/* estatua sobre pedestal */}
          <Forma tema={tema} fill={tono(marmol, -0.12)} x={420} y={700} w={120} h={150} esq={2} />
          <Forma tema={tema} fill={marmol} x={404} y={690} w={152} h={18} esq={2} grosor={0.6} />
          <g transform="translate(480, 690)">
            <Forma tema={tema} fill="#8fa89a" d="M -40 0 L -26 -150 Q 0 -168 26 -150 L 40 0 Z" />
            <Forma tema={tema} fill="#8fa89a" d="M 18 -140 L 64 -214 L 76 -206 L 34 -128 Z" grosor={0.7} />
            <Forma tema={tema} fill="#8fa89a" cx={0} cy={-186} r={28} />
            <path d="M -22 -150 Q 0 -120 30 -40" stroke={tono("#8fa89a", -0.3)} strokeWidth={3} fill="none" />
          </g>
          {/* plaza enlosada */}
          <rect x={0} y={790} width={W} height={H - 790} fill="#dccfb2" />
          <path d={`M 0 790 L ${W} 790`} stroke={tinta} strokeWidth={grueso * 0.8} />
          {[840, 910, 1000].map((y) => <path key={`lh${y}`} d={`M 0 ${y} L ${W} ${y}`} stroke={tono("#dccfb2", -0.18)} strokeWidth={3} />)}
          {Array.from({ length: 13 }).map((_, i) => <path key={`lv${i}`} d={`M ${960 + (i - 6) * 150} 790 L ${960 + (i - 6) * 260} ${H}`} stroke={tono("#dccfb2", -0.18)} strokeWidth={3} />)}
        </g>
      );
    }
    case "palacio": {
      // palacio de China o Japón: tejados de pagoda con aleros curvos, columnas rojas, basamento de piedra y patio
      const rojo = "#b5332b", teja = "#33454f";
      const tejado = (cx: number, y: number, ancho: number, alto: number) => (
        <g>
          <Forma tema={tema} fill={teja} d={`M ${cx - ancho / 2 - 40} ${y - 26} Q ${cx - ancho / 2} ${y} ${cx - ancho / 2 + 40} ${y - 6} L ${cx + ancho / 2 - 40} ${y - 6} Q ${cx + ancho / 2} ${y} ${cx + ancho / 2 + 40} ${y - 26} Q ${cx + ancho / 2 - 10} ${y - 30} ${cx + ancho / 2 - 70} ${y - alto} L ${cx - ancho / 2 + 70} ${y - alto} Q ${cx - ancho / 2 + 10} ${y - 30} ${cx - ancho / 2 - 40} ${y - 26} Z`} />
          {Array.from({ length: Math.floor((ancho - 130) / 40) + 1 }).map((_, i) => <path key={i} d={`M ${cx - ancho / 2 + 70 + i * 40} ${y - alto + 4} L ${cx - ancho / 2 + 60 + i * 40} ${y - 10}`} stroke={tono(teja, 0.25)} strokeWidth={3} />)}
          <Forma tema={tema} fill="#d9a536" x={cx - ancho / 2 + 60} y={y - alto - 10} w={ancho - 120} h={12} esq={4} grosor={0.6} />
          {[-1, 1].map((l) => <Forma key={l} tema={tema} fill="#d9a536" d={`M ${cx + l * (ancho / 2 - 60)} ${y - alto - 10} q ${l * 14} -26 ${l * 30} -18 q ${-l * 10} 6 ${-l * 18} 18 z`} grosor={0.6} />)}
        </g>
      );
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* muralla del patio al fondo */}
          <Forma tema={tema} fill="#c46a4a" x={-20} y={640} w={W + 40} h={170} grosor={0.7} />
          <Forma tema={tema} fill={teja} d={`M -20 646 L ${W + 20} 646 L ${W + 20} 620 L -20 620 Z`} grosor={0.7} />
          {/* pinos */}
          {[[170, 700], [1760, 690]].map(([x, y], i) => (
            <g key={`pi${i}`}>
              <path d={`M ${x} ${y + 120} Q ${x - 10} ${y} ${x + 20} ${y - 80}`} stroke="#5a3d26" strokeWidth={14} fill="none" strokeLinecap="round" />
              {[[-60, -40], [40, -90], [-20, -130]].map(([dx, dy], j) => <Forma key={j} tema={tema} fill="#3f6a4a" rx={70} ry={26} cx={x + dx} cy={y + dy} grosor={0.7} />)}
            </g>
          ))}
          {/* el salón */}
          <Forma tema={tema} fill="#e8e2d4" x={560} y={700} w={800} h={110} esq={2} />
          {[0, 1, 2].map((i) => <path key={`ba${i}`} d={`M 560 ${724 + i * 28} L 1360 ${724 + i * 28}`} stroke={tono("#e8e2d4", -0.18)} strokeWidth={2.5} />)}
          <Forma tema={tema} fill={tono("#e8e2d4", -0.06)} d="M 860 810 L 900 700 L 1020 700 L 1060 810 Z" grosor={0.7} />
          <Forma tema={tema} fill="#6b2a24" x={650} y={480} w={594} h={220} grosor={0.7} />
          {Array.from({ length: 6 }).map((_, i) => <Forma key={`cr${i}`} tema={tema} fill={rojo} x={650 + i * 112} y={470} w={34} h={230} esq={3} />)}
          {[0, 1, 2, 3, 4].map((i) => <rect key={`ve${i}`} x={700 + i * 112} y={520} width={60} height={120} fill={noche ? "#f2cf6a" : "#e9d9b0"} opacity={0.75} />)}
          {tejado(960, 474, 760, 110)}
          <Forma tema={tema} fill={rojo} x={760} y={300} w={400} h={70} grosor={0.7} />
          {tejado(960, 304, 520, 96)}
          {/* farolillos */}
          {[600, 1320].map((x) => <g key={`fa${x}`}><path d={`M ${x} 470 L ${x} 520`} stroke={tinta} strokeWidth={2.5} /><Forma tema={tema} fill="#d8322a" rx={22} ry={30} cx={x} cy={548} grosor={0.7} /><rect x={x - 10} y={574} width={20} height={8} fill="#d9a536" /></g>)}
          {/* patio de losas */}
          <rect x={0} y={810} width={W} height={H - 810} fill="#cfc8b8" />
          <path d={`M 0 810 L ${W} 810`} stroke={tinta} strokeWidth={grueso * 0.8} />
          {[870, 950, 1040].map((y) => <path key={`ph${y}`} d={`M 0 ${y} L ${W} ${y}`} stroke={tono("#cfc8b8", -0.16)} strokeWidth={3} />)}
          {Array.from({ length: 11 }).map((_, i) => <path key={`pv${i}`} d={`M ${960 + (i - 5) * 180} 810 L ${960 + (i - 5) * 300} ${H}`} stroke={tono("#cfc8b8", -0.16)} strokeWidth={3} />)}
        </g>
      );
    }
    case "selva": {
      // selva: hojas grandes, lianas y una pirámide escalonada maya o azteca medio escondida al fondo
      const piedra = "#a39f8c";
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} nubes={false} />
          <Forma tema={tema} fill="#5f8f5a" d={`M 0 560 Q 200 470 420 540 Q 640 600 860 520 Q 1100 440 1340 520 Q 1600 590 ${W} 500 L ${W} 900 L 0 900 Z`} grosor={0.6} />
          {/* pirámide («"piramide": false» la quita: una selva que no es de América, como el Congo o Malasia) */}
          {piramide && <>{Array.from({ length: 6 }).map((_, i) => <Forma key={`py${i}`} tema={tema} fill={tono(piedra, -0.03 * (i % 2))} x={1060 + i * 42} y={700 - i * 66} w={560 - i * 84} h={70} esq={2} grosor={0.8} />)}
          <Forma tema={tema} fill={tono(piedra, 0.08)} d="M 1290 770 L 1310 304 L 1370 304 L 1390 770 Z" grosor={0.7} />
          {Array.from({ length: 14 }).map((_, i) => <path key={`st${i}`} d={`M ${1296 + i * 0.6} ${740 - i * 32} L ${1384 - i * 0.6} ${740 - i * 32}`} stroke={tono(piedra, -0.2)} strokeWidth={2.5} />)}
          <Forma tema={tema} fill={piedra} x={1270} y={232} w={140} h={74} esq={2} />
          <rect x={1318} y={258} width={44} height={48} fill="#3a3528" />
          <Forma tema={tema} fill="#7a3a2c" x={1260} y={220} w={160} h={18} esq={2} grosor={0.6} />
          {[[1100, 650], [1500, 560], [1180, 520]].map(([x, y], i) => <Forma key={`mu${i}`} tema={tema} fill="#6a9a4a" rx={44} ry={16} cx={x} cy={y} sinBorde />)}</>}
          {/* árboles del medio que tapan la pirámide */}
          {[[960, 600, 1.1], [1700, 620, 1.2], [600, 640, 1]].map(([x, y, k], i) => (
            <g key={`ar${i}`} transform={`translate(${x}, ${y}) scale(${k})`}>
              <Forma tema={tema} fill="#5a3d26" x={-14} y={0} w={28} h={260} grosor={0.7} />
              <Forma tema={tema} fill="#3f7a3a" cx={0} cy={-30} r={110} />
              <Forma tema={tema} fill="#4f8f44" cx={-60} cy={-70} r={60} sinBorde />
              <Forma tema={tema} fill="#4f8f44" cx={60} cy={-10} r={56} sinBorde />
            </g>
          ))}
          {/* troncos gordos a los lados y lianas */}
          <Forma tema={tema} fill="#5a3d26" d={`M 0 0 L 170 0 Q 140 500 210 ${H} L 0 ${H} Z`} />
          <Forma tema={tema} fill="#5a3d26" d={`M ${W} 0 L ${W - 150} 0 Q ${W - 120} 500 ${W - 190} ${H} L ${W} ${H} Z`} />
          {[[150, 0, 520], [420, 0, 360], [760, 0, 280], [1180, 0, 300], [1560, 0, 420], [1790, 0, 560]].map(([x, , l], i) => {
            const v = Math.sin(frame * 0.04 + i) * 8;
            return <path key={`li${i}`} d={`M ${x} 0 Q ${x + 40 + v} ${l * 0.5} ${x + 10 + v} ${l}`} stroke="#4f7a32" strokeWidth={6} fill="none" strokeLinecap="round" />;
          })}
          {/* copas arriba */}
          {Array.from({ length: 9 }).map((_, i) => <Forma key={`co${i}`} tema={tema} fill={i % 2 ? "#3f7a3a" : "#4a8a40"} cx={i * 240} cy={-30} r={140} />)}
          {/* suelo y helechos */}
          <rect x={0} y={900} width={W} height={H - 900} fill="#4f7a3a" />
          <path d={`M 0 900 L ${W} 900`} stroke={tinta} strokeWidth={grueso * 0.7} opacity={0.6} />
          {[[90, 1040, 1], [1840, 1030, 1.1], [330, 1070, 0.7], [1600, 1075, 0.7]].map(([x, y, k], i) => (
            <g key={`ho${i}`} transform={`translate(${x}, ${y}) scale(${k})`}>
              {[-60, -25, 10, 45].map((a, j) => <g key={j} transform={`rotate(${a})`}><Forma tema={tema} fill={j % 2 ? "#5fa04a" : "#4f9040"} d="M 0 0 Q -40 -90 0 -190 Q 40 -90 0 0 Z" grosor={0.7} /></g>)}
            </g>
          ))}
        </g>
      );
    }
    case "fabrica": {
      // la Revolución Industrial: fábricas de ladrillo con tejados de sierra, chimeneas que echan humo, cielo gris y adoquines
      const ladrillo = "#9c4a32";
      const humo = (x: number, y: number, k: number) => Array.from({ length: 7 }).map((_, i) => {
        const sube = (frame * 1.1 + i * 50 + x) % 350;
        return <circle key={`h${x}${i}`} cx={x + sube * 0.35 + Math.sin(sube / 40) * 10} cy={y - sube} r={(18 + sube * 0.2) * k} fill={i % 2 ? "#5e5e5e" : "#777"} opacity={Math.max(0, 0.8 - sube / 420)} />;
      });
      return (
        <g>
          <CieloGris tema={tema} noche={noche} frame={frame} />
          {/* fábricas lejos */}
          <Forma tema={tema} fill="#8a8a86" d={`M 0 640 L 0 560 L 120 520 L 120 560 L 240 520 L 240 560 L 360 520 L 360 640 Z`} grosor={0.6} />
          <Forma tema={tema} fill="#8a8a86" d={`M 1500 640 L 1500 540 L 1640 500 L 1640 540 L 1780 500 L 1780 540 L ${W} 510 L ${W} 640 Z`} grosor={0.6} />
          {/* chimeneas con humo */}
          {[[520, 180, 1], [880, 120, 1.2], [1390, 210, 0.9]].map(([x, y, k], i) => (
            <g key={`ch${i}`}>
              {humo(x + 30 * k, y, k)}
              <Forma tema={tema} fill={tono(ladrillo, -0.08)} d={`M ${x} 640 L ${x + 8 * k} ${y} L ${x + 52 * k} ${y} L ${x + 60 * k} 640 Z`} />
              <Forma tema={tema} fill={tono(ladrillo, -0.25)} x={x + 2 * k} y={y - 14} w={56 * k} h={18} esq={2} grosor={0.6} />
              {[0, 1, 2].map((b) => <path key={b} d={`M ${x + 6 * k} ${y + 80 + b * 120} L ${x + 54 * k} ${y + 80 + b * 120}`} stroke="#e8d8b0" strokeWidth={6} opacity={0.7} />)}
            </g>
          ))}
          {/* las naves de ladrillo: al doble y apoyadas en la línea de los pies (medidas.ts: antes la puerta no llegaba
              a la cintura de un muñeco) */}
          <g transform="translate(960, 1000) scale(2) translate(-960, -900)">
          {[[380, 900], [1080, 1500]].map(([x0, x1], n) => (
            <g key={`na${n}`}>
              <Forma tema={tema} fill={ladrillo} x={x0} y={560} w={x1 - x0} h={340} grosor={0.8} />
              <Forma tema={tema} fill="#55504a" d={`M ${x0 - 10} 566 ${Array.from({ length: Math.floor((x1 - x0) / 110) }).map((_, i) => `L ${x0 + i * 110} 480 L ${x0 + i * 110 + 110} 566`).join(" ")} L ${x1 + 10} 566 Z`} grosor={0.8} />
              {Array.from({ length: Math.floor((x1 - x0 - 40) / 90) }).map((_, i) => [0, 1].map((f) => (
                <g key={`v${i}${f}`}>
                  <rect x={x0 + 30 + i * 90} y={610 + f * 130} width={56} height={90} fill={noche ? "#f2cf6a" : "#5f6f7a"} opacity={0.9} />
                  <path d={`M ${x0 + 58 + i * 90} ${610 + f * 130} L ${x0 + 58 + i * 90} ${700 + f * 130} M ${x0 + 30 + i * 90} ${655 + f * 130} L ${x0 + 86 + i * 90} ${655 + f * 130}`} stroke={tono(ladrillo, -0.35)} strokeWidth={3} />
                </g>
              )))}
              {Array.from({ length: 6 }).map((_, i) => <path key={`l${i}`} d={`M ${x0} ${590 + i * 50} L ${x1} ${590 + i * 50}`} stroke={tono(ladrillo, -0.15)} strokeWidth={1.5} opacity={0.6} />)}
            </g>
          ))}
          </g>
          {/* el portón: 1,35 personas de alto */}
          <Forma tema={tema} fill="#4a3a2c" x={1240} y={1000 - PERSONA * 0.72 * 1.35} w={PERSONA * 0.72 * 0.95} h={PERSONA * 0.72 * 1.35} esq={4} grosor={0.8} />
          <path d={`M ${1240 + PERSONA * 0.72 * 0.475} ${1000 - PERSONA * 0.72 * 1.35} L ${1240 + PERSONA * 0.72 * 0.475} 1000`} stroke="#2e241b" strokeWidth={4} />
          {/* barriles y una carretilla */}
          {/* adoquines */}
          <rect x={0} y={1000} width={W} height={H - 1000} fill="#8c8780" />
          <path d={`M 0 1000 L ${W} 1000`} stroke={tinta} strokeWidth={grueso * 0.8} />
          {[170, 290].map((x) => <g key={`b${x}`} transform={`translate(${x}, 1012) scale(1.5)`}><Cosa id="barril" tema={tema} /></g>)}
          {Array.from({ length: 30 }).map((_, i) => { const x = (i % 15) * 132 + ((Math.floor(i / 15) % 2) * 66), y = 1025 + Math.floor(i / 15) * 34; return <ellipse key={`ad${i}`} cx={x} cy={y} rx={52} ry={12} fill="none" stroke={tono("#8c8780", -0.22)} strokeWidth={2.5} />; })}
        </g>
      );
    }
    case "calle": {
      // una calle de ciudad (1880-1940): edificios altos con balcones, toldos de tienda, farolas de gas y vías del
      // tranvía; de noche se encienden las ventanas y las farolas
      const fach = ["#d9b98a", "#c98d6a", "#e3d2ac", "#b9a07a", "#cf9f7f"];
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* los edificios, a escala de los muñecos (medidas.ts): la tienda mide 1,2 personas y cada piso 1,35; se ven
              la planta baja y el primer piso, el resto se sale por arriba como en una calle de verdad */}
          <g transform="translate(960, 1000) scale(2.8) translate(-960, -860)">
          {[[0, 300, 560], [290, 260, 610], [540, 330, 520], [860, 270, 640], [1120, 310, 580], [1420, 260, 620], [1670, 270, 560]].map(([x, w, h], i) => {
            const c = fach[i % fach.length], base = 860;
            const pisos = Math.floor((h - 160) / 110);
            return (
              <g key={`ed${i}`}>
                <Forma tema={tema} fill={c} x={x} y={base - h} w={w} h={h} grosor={0.8} />
                <Forma tema={tema} fill={tono(c, -0.25)} x={x - 8} y={base - h - 16} w={w + 16} h={22} esq={2} grosor={0.7} />
                {Array.from({ length: pisos }).map((_, f) => (
                  <g key={f}>
                    {Array.from({ length: Math.floor(w / 90) }).map((_, v) => {
                      const vx = x + 24 + v * ((w - 48) / Math.floor(w / 90)), vy = base - h + 40 + f * 110, vw = (w - 48) / Math.floor(w / 90) - 26;
                      const luz = noche && (i * 7 + f * 3 + v) % 3 !== 0;
                      return <rect key={v} x={vx} y={vy} width={vw} height={66} fill={luz ? "#f2cf6a" : noche ? "#2a3550" : "#5a6f86"} opacity={0.92} />;
                    })}
                    {f % 2 === 0 && <g><path d={`M ${x + 14} ${base - h + 112 + f * 110} L ${x + w - 14} ${base - h + 112 + f * 110}`} stroke="#2a2624" strokeWidth={5} />{Array.from({ length: Math.floor(w / 24) }).map((_, b) => <path key={b} d={`M ${x + 20 + b * 24} ${base - h + 112 + f * 110} l 0 -22`} stroke="#2a2624" strokeWidth={2} />)}<path d={`M ${x + 14} ${base - h + 90 + f * 110} L ${x + w - 14} ${base - h + 90 + f * 110}`} stroke="#2a2624" strokeWidth={3} /></g>}
                  </g>
                ))}
                {/* tienda con toldo a pie de calle */}
                <rect x={x + 20} y={base - 120} width={w - 40} height={110} fill={noche ? "#f2cf6a" : "#3e4a52"} opacity={0.85} />
                <Forma tema={tema} fill={i % 2 ? "#b5332b" : "#2f6a4a"} d={`M ${x + 10} ${base - 150} L ${x + w - 10} ${base - 150} L ${x + w - 30} ${base - 110} L ${x + 30} ${base - 110} Z`} grosor={0.7} />
                {Array.from({ length: Math.floor((w - 40) / 40) }).map((_, r) => <path key={r} d={`M ${x + 40 + r * 40} ${base - 150} l -6 40`} stroke="#f4efe3" strokeWidth={8} opacity={0.8} />)}
              </g>
            );
          })}
          </g>
          {/* acera (aquí pisan los muñecos) y calzada con las vías */}
          <rect x={0} y={1000} width={W} height={H - 1000} fill="#8f8a82" />
          <path d={`M 0 1000 L ${W} 1000`} stroke={tinta} strokeWidth={grueso * 0.7} />
          <rect x={0} y={1000} width={W} height={34} fill="#b9b4aa" />
          <path d={`M 0 1034 L ${W} 1034`} stroke={tinta} strokeWidth={grueso * 0.6} />
          {[1052, 1070].map((y) => <path key={`via${y}`} d={`M 0 ${y} L ${W} ${y}`} stroke="#5c5f63" strokeWidth={5} />)}
          {/* farolas de gas: 1,7 personas */}
          {[150, 1000, 1800].map((x) => (
            <g key={`fa${x}`} transform={`translate(${x}, 1010) scale(${(PERSONA * 0.72 * 1.7) / 300}) translate(${-x}, -900)`}>
              {noche && <circle cx={x} cy={640} r={90} fill="#f7dc8a" opacity={0.25} />}
              <path d={`M ${x} 900 L ${x} 660`} stroke="#2a2624" strokeWidth={9} strokeLinecap="round" />
              <Forma tema={tema} fill={noche ? "#ffe9a0" : "#d9e4e8"} d={`M ${x - 22} 620 L ${x + 22} 620 L ${x + 16} 664 L ${x - 16} 664 Z`} grosor={0.7} />
              <Forma tema={tema} fill="#2a2624" d={`M ${x - 28} 622 L ${x} 600 L ${x + 28} 622 Z`} grosor={0.6} />
            </g>
          ))}
        </g>
      );
    }
    case "trinchera": {
      // una trinchera de la Primera Guerra Mundial: sacos terreros arriba, pared de tablas, alambre de espino en la
      // tierra de nadie, barro y tablones en el suelo, cielo gris
      const tierra = "#6b5640";
      return (
        <g>
          <CieloGris tema={tema} noche={noche} frame={frame} />
          {/* tierra de nadie: embudos, troncos pelados y alambre */}
          <Forma tema={tema} fill="#7d6a52" d={`M 0 470 Q 400 440 900 465 Q 1400 490 ${W} 455 L ${W} 560 L 0 560 Z`} grosor={0.6} />
          {[[380, 452, 1], [1460, 448, 0.8]].map(([x, y, k], i) => <g key={`tr${i}`} transform={`translate(${x}, ${y}) scale(${k})`}><path d="M 0 0 L 4 -120 M 2 -70 L 30 -96 M 3 -50 L -24 -80" stroke="#3a2e22" strokeWidth={8} strokeLinecap="round" fill="none" /></g>)}
          {Array.from({ length: 8 }).map((_, i) => {
            const x = 80 + i * 250;
            return (
              <g key={`al${i}`}>
                <path d={`M ${x - 16} 470 L ${x + 16} 424 M ${x + 16} 470 L ${x - 16} 424`} stroke="#3a2e22" strokeWidth={5} />
                <path d={`M ${x} 440 ${Array.from({ length: 10 }).map((_, j) => `q 12 -16 25 0`).join(" ")}`} stroke="#4a4a4a" strokeWidth={2.5} fill="none" />
              </g>
            );
          })}
          {/* sacos terreros */}
          {Array.from({ length: 3 }).map((_, f) => Array.from({ length: 17 }).map((_, i) => (
            <Forma key={`sa${f}${i}`} tema={tema} fill={(i + f) % 3 ? "#b8a27a" : "#a8936c"} x={i * 120 - 40 + (f % 2) * 60} y={500 + f * 34} w={124} h={40} esq={16} grosor={0.6} />
          )))}
          {/* pared de la trinchera con tablas */}
          <rect x={0} y={600} width={W} height={300} fill={tierra} />
          {Array.from({ length: 24 }).map((_, i) => <Forma key={`ta${i}`} tema={tema} fill={i % 2 ? "#7a5f3e" : "#836846"} x={i * 82} y={606} w={78} h={292} esq={2} grosor={0.5} />)}
          {[700, 820].map((y) => <path key={`trv${y}`} d={`M 0 ${y} L ${W} ${y}`} stroke="#5a4630" strokeWidth={8} />)}
          {/* escalera de mano */}
          <g transform="translate(1520, 0)">
            <path d="M 0 900 L 20 470 M 70 900 L 90 470" stroke="#6b4425" strokeWidth={9} strokeLinecap="round" />
            {Array.from({ length: 8 }).map((_, i) => <path key={i} d={`M ${2 + i * 2.4} ${860 - i * 52} L ${72 + i * 2.4} ${860 - i * 52}`} stroke="#6b4425" strokeWidth={7} />)}
          </g>
          {/* barro y tablones */}
          <rect x={0} y={900} width={W} height={H - 900} fill="#5a4632" />
          <path d={`M 0 900 L ${W} 900`} stroke={tinta} strokeWidth={grueso * 0.8} />
          <Forma tema={tema} fill="#8a6a44" x={-20} y={950} w={W + 40} h={70} esq={3} grosor={0.7} />
          {Array.from({ length: 30 }).map((_, i) => <path key={`tb${i}`} d={`M ${i * 66} 950 L ${i * 66} 1020`} stroke="#6b5034" strokeWidth={3} />)}
          {[[300, 1050], [1200, 1060]].map(([x, y], i) => <ellipse key={`ch${i}`} cx={x} cy={y} rx={110} ry={14} fill="#7f8f9a" opacity={0.7} />)}
        </g>
      );
    }
    case "montana": {
      // montañas nevadas y un paso (los Alpes, los Andes, el Himalaya): cumbres con nieve, pinos y un camino de piedras
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* cordillera del fondo */}
          <Forma tema={tema} fill="#8a9bb3" d={`M 0 640 L 160 400 L 280 500 L 470 230 L 640 470 L 820 300 L 1000 520 L 1180 260 L 1380 480 L 1560 320 L 1740 470 L ${W} 360 L ${W} 900 L 0 900 Z`} grosor={0.7} />
          {[[470, 230, 1], [1180, 260, 1], [820, 300, 0.8], [1560, 320, 0.8], [160, 400, 0.6]].map(([x, y, k], i) => (
            <Forma key={`ni${i}`} tema={tema} fill="#f6f8fb" d={`M ${x} ${y} L ${x + 70 * k} ${y + 100 * k} L ${x + 40 * k} ${y + 90 * k} L ${x + 16 * k} ${y + 116 * k} L ${x - 14 * k} ${y + 92 * k} L ${x - 44 * k} ${y + 110 * k} L ${x - 70 * k} ${y + 100 * k} Z`} grosor={0.7} />
          ))}
          {/* ladera del medio */}
          <Forma tema={tema} fill="#7f8a6a" d={`M 0 760 Q 300 620 640 700 Q 980 780 1300 660 Q 1600 560 ${W} 680 L ${W} 900 L 0 900 Z`} grosor={0.7} />
          {[[260, 720], [330, 735], [1520, 690], [1600, 705], [1680, 690]].map(([x, y], i) => <Forma key={`pi${i}`} tema={tema} fill="#3f5f45" d={`M ${x} ${y - 90} L ${x + 34} ${y} L ${x - 34} ${y} Z`} grosor={0.7} />)}
          {/* el paso: camino de piedras con nieve a los lados */}
          <rect x={0} y={880} width={W} height={H - 880} fill="#a59a86" />
          <path d={`M 0 880 L ${W} 880`} stroke={tinta} strokeWidth={grueso * 0.7} opacity={0.6} />
          <Forma tema={tema} fill="#f2f4f7" d={`M 0 880 Q 200 900 300 960 Q 200 1020 0 1040 Z`} grosor={0.6} />
          <Forma tema={tema} fill="#f2f4f7" d={`M ${W} 880 Q ${W - 240} 910 ${W - 320} 980 Q ${W - 200} 1040 ${W} 1060 Z`} grosor={0.6} />
          {[[520, 1000, 1], [1360, 1030, 0.8], [900, 1060, 0.6], [700, 930, 0.5], [1200, 940, 0.5]].map(([x, y, k], i) => <Forma key={`pd${i}`} tema={tema} fill="#8a8274" d={`M ${x - 40 * k} ${y} Q ${x - 36 * k} ${y - 30 * k} ${x} ${y - 34 * k} Q ${x + 40 * k} ${y - 26 * k} ${x + 44 * k} ${y} Z`} grosor={0.6} />)}
          {/* copos que caen despacio */}
          {Array.from({ length: 24 }).map((_, i) => { const x = (i * 173 + frame * 0.6) % W, y = ((i * 97 + frame * 1.6) % 900); return <circle key={`co${i}`} cx={x} cy={y} r={3 + (i % 3)} fill="#ffffff" opacity={0.8} />; })}
        </g>
      );
    }
    case "calzada": {
      // una calzada romana (la Vía Apia): losas grandes de basalto que se pierden hacia el fondo, bordillos, un miliario,
      // pinos piñoneros, un mausoleo redondo en ruinas y los arcos de un acueducto lejos, en el campo de Roma
      const losa = "#6f6c68";
      const fila = (y0: number, y1: number, i: number) => {
        // ancho de la calzada a esa altura (perspectiva: 160 en el horizonte, 1500 abajo)
        const a = (y: number) => 80 + ((y - 640) / (H - 640)) * 670;
        const n = 3 + Math.round((y0 - 640) / 90);
        return Array.from({ length: n }).map((_, j) => {
          const xa0 = 960 - a(y0) + (2 * a(y0) * j) / n, xa1 = 960 - a(y0) + (2 * a(y0) * (j + 1)) / n;
          const xb0 = 960 - a(y1) + (2 * a(y1) * j) / n, xb1 = 960 - a(y1) + (2 * a(y1) * (j + 1)) / n;
          const d = (i + j) % 2 ? 6 : -6;
          return <Forma key={`l${i}-${j}`} tema={tema} fill={tono(losa, ((i * 7 + j * 3) % 5) * 0.04 - 0.06)} d={`M ${xa0 + 4} ${y0 + 3} L ${xa1 - 4 + d} ${y0 + 3} L ${xb1 - 6} ${y1 - 3} L ${xb0 + 6 + d} ${y1 - 3} Z`} grosor={0.5} />;
        });
      };
      const ys = [640, 660, 685, 715, 750, 795, 850, 915, 995, H + 20];
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* acueducto lejos */}
          <g opacity={0.85}>
            <Forma tema={tema} fill="#d9b98e" x={1180} y={500} w={740} h={26} grosor={0.6} />
            {Array.from({ length: 9 }).map((_, i) => <Forma key={`ac${i}`} tema={tema} fill="#d9b98e" d={`M ${1190 + i * 82} 640 L ${1190 + i * 82} 526 L ${1252 + i * 82} 526 L ${1252 + i * 82} 640 L ${1240 + i * 82} 640 L ${1240 + i * 82} 580 Q ${1221 + i * 82} 548 ${1202 + i * 82} 580 L ${1202 + i * 82} 640 Z`} grosor={0.5} />)}
          </g>
          {/* el campo */}
          <Forma tema={tema} fill="#a9bf78" d={`M 0 650 Q 400 600 800 640 Q 1300 680 ${W} 630 L ${W} ${H} L 0 ${H} Z`} grosor={0.7} />
          <rect x={0} y={760} width={W} height={H - 760} fill="#9cb86a" />
          {/* mausoleo redondo en ruinas (como el de Cecilia Metella) */}
          <g transform="translate(330, 650)">
            <Forma tema={tema} fill="#c9b48e" x={-120} y={-40} w={240} h={70} grosor={0.7} />
            <Forma tema={tema} fill="#e3d6ba" d="M -100 -40 L -100 -190 Q 0 -214 100 -190 L 100 -40 Z" />
            <path d="M -100 -170 Q 0 -194 100 -170" stroke={tono("#e3d6ba", -0.25)} strokeWidth={8} fill="none" />
            <Forma tema={tema} fill="#b9a27a" d="M -70 -196 L -50 -232 L -20 -206 L 10 -240 L 40 -204 L 70 -222 L 84 -196 Z" grosor={0.6} />
            {[-60, -10, 40].map((x) => <path key={x} d={`M ${x} -120 l 28 0 M ${x + 10} -90 l 24 0`} stroke={tono("#e3d6ba", -0.2)} strokeWidth={3} />)}
          </g>
          {/* pinos piñoneros */}
          {[[120, 700, 1.1], [610, 650, 0.75], [1330, 660, 0.8], [1780, 720, 1.2]].map(([x, y, k], i) => (
            <g key={`pi${i}`} transform={`translate(${x}, ${y}) scale(${k})`}>
              <path d={`M 0 0 Q ${i % 2 ? 12 : -12} -110 ${i % 2 ? -8 : 8} -230`} stroke="#6b4425" strokeWidth={16} fill="none" strokeLinecap="round" />
              <Forma tema={tema} fill="#3f6a3a" d="M -130 -220 Q -120 -290 -30 -300 Q 30 -330 90 -300 Q 160 -290 140 -230 Q 60 -205 0 -215 Q -70 -200 -130 -220 Z" />
              <Forma tema={tema} fill="#4f7f46" d="M -80 -260 Q -40 -295 20 -290 Q 70 -296 100 -268 Q 40 -255 -80 -260 Z" sinBorde />
            </g>
          ))}
          {/* bordillos y losas */}
          <Forma tema={tema} fill="#8f8a80" d={`M 860 640 L 1060 640 L ${960 + 790} ${H} L ${960 - 790} ${H} Z`} grosor={0.6} />
          {ys.slice(0, -1).map((y, i) => <g key={`f${i}`}>{fila(y, ys[i + 1], i)}</g>)}
          {/* miliario */}
          <g transform="translate(1590, 900)">
            <Forma tema={tema} fill="#d8cdb6" x={-34} y={-180} w={68} h={180} esq={30} />
            <Forma tema={tema} fill="#c9bc9e" x={-46} y={-8} w={92} h={20} esq={3} grosor={0.6} />
            <path d="M -16 -130 L 16 -130 M -20 -110 L 20 -110 M -12 -90 L 12 -90" stroke="#8a7a5a" strokeWidth={4} />
          </g>
          {/* hierba a los lados */}
          {Array.from({ length: 18 }).map((_, i) => { const lado = i % 2 ? 1 : -1; const y = 820 + ((i * 53) % 230); const x = 960 + lado * (100 + ((y - 640) / (H - 640)) * 700 + 40 + ((i * 37) % 120)); return <path key={`h${i}`} d={`M ${x - 9} ${y} l 6 -16 M ${x} ${y} l 0 -20 M ${x + 9} ${y} l -6 -16`} stroke="#6f9445" strokeWidth={3} strokeLinecap="round" />; })}
        </g>
      );
    }
    case "rio": {
      // la orilla de un río (el Tíber, el Nilo, el Rin): agua que corre de lado a lado, la otra orilla con colinas y
      // árboles, cañas y juncos, y la orilla de hierba delante, donde pisan los muñecos
      const agua = noche ? "#2a4a6e" : atardecer ? "#c98f6a" : "#5f9fb8";
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche} atardecer={atardecer} />
          {/* colinas de la otra orilla */}
          <Forma tema={tema} fill="#8fae6a" d={`M 0 600 Q 220 470 460 560 Q 640 610 820 520 Q 1060 420 1300 540 Q 1520 620 1700 520 Q 1820 470 ${W} 540 L ${W} 700 L 0 700 Z`} grosor={0.7} />
          {[[300, 610, 0.8], [520, 640, 0.6], [1120, 600, 0.7], [1500, 630, 0.9], [1760, 610, 0.6]].map(([x, y, k], i) => (
            <g key={`ar${i}`} transform={`translate(${x}, ${y}) scale(${k})`}><Forma tema={tema} fill="#6b4425" x={-10} y={0} w={20} h={70} grosor={0.7} /><Forma tema={tema} fill={i % 2 ? "#5a9a44" : "#4f8f3a"} cx={0} cy={-30} r={58} /><Forma tema={tema} fill="#6aaa52" cx={-20} cy={-50} r={26} sinBorde /></g>
          ))}
          <Forma tema={tema} fill="#9fbf74" d={`M 0 690 Q 960 660 ${W} 690 L ${W} 720 L 0 720 Z`} grosor={0.6} />
          {/* el río, que corre */}
          <rect x={0} y={715} width={W} height={175} fill={agua} />
          {[740, 775, 815, 855].map((y, i) => <path key={y} d={`M ${-160 + ((frame * (1.2 + i * 0.4)) % 160)} ${y} q 40 -8 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`} stroke={tono(agua, 0.3)} strokeWidth={3 + i} fill="none" opacity={0.6} />)}
          {/* la orilla de delante */}
          <Forma tema={tema} fill="#8fbf62" d={`M -40 ${H} L -40 900 Q 480 870 960 890 Q 1440 905 ${W + 40} 880 L ${W + 40} ${H} Z`} />
          <path d={`M -40 900 Q 480 870 960 890 Q 1440 905 ${W + 40} 880`} stroke="#b89a6a" strokeWidth={10} fill="none" opacity={0.7} />
          {/* cañas y juncos de la orilla */}
          {Array.from({ length: 16 }).map((_, i) => { const x = (i * 241) % 1880 + 20; const m = Math.sin(frame * 0.06 + i) * 4; return <g key={`c${i}`}><path d={`M ${x} 900 Q ${x + 4 + m} 850 ${x + 10 + m} ${820 - (i % 3) * 22}`} stroke="#6f8a3e" strokeWidth={5} fill="none" strokeLinecap="round" />{i % 3 === 0 && <Forma tema={tema} fill="#7a5230" rx={6} ry={16} cx={x + 10 + m} cy={812 - (i % 3) * 22} grosor={0.5} />}</g>; })}
          {Array.from({ length: 20 }).map((_, i) => { const x = (i * 271) % 1900 + 10, y = 940 + ((i * 97) % 130); return <path key={`h${i}`} d={`M ${x - 9} ${y} l 6 -16 M ${x} ${y} l 0 -20 M ${x + 9} ${y} l -6 -16`} stroke="#5f9445" strokeWidth={3} strokeLinecap="round" />; })}
          {/* pájaros */}
          {[0, 1].map((i) => { const x = ((frame * 2 + i * 110) % 2200) - 140, y = 250 + i * 28 + Math.sin(frame * 0.2 + i) * 5; const a = Math.sin(frame * 0.5 + i) * 6; return <path key={`p${i}`} d={`M ${x - 14} ${y - a} Q ${x - 6} ${y - 8} ${x} ${y} Q ${x + 6} ${y - 8} ${x + 14} ${y - a}`} stroke={tinta} strokeWidth={3} fill="none" strokeLinecap="round" />; })}
        </g>
      );
    }
    case "campamento": {
      // tiendas grandes al fondo (antes eran más pequeñas que los soldados, 11-11-2026): la puerta de lona más alta que
      // un muñeco lejano, con vientos y estacas; cambian de sitio con el plano
      const sem = semilla;
      const rr = (k: number) => { const v = Math.sin(sem * 91.73 + k * 12.989) * 43758.5453; return v - Math.floor(v); };
      const tiendas = [[160 + rr(1) * 120, 1.0, "#e9e1cc"], [960 + rr(2) * 120, 0.92, "#d9c9a3"], [1760 + rr(3) * 100, 1.0, "#e9e1cc"]] as [number, number, string][];
      return (
        <g>
          <Cielo tema={tema} frame={frame} noche={noche ?? false} atardecer={atardecer ?? true} />
          <Forma tema={tema} fill="#8a9a5b" d={`M 0 640 Q 960 590 ${W} 640 L ${W} ${H} L 0 ${H} Z`} grosor={0.7} />
          <rect x={0} y={880} width={W} height={H - 880} fill="#7f8f50" />
          <path d={`M 0 880 L ${W} 880`} stroke={tinta} strokeWidth={grueso * 0.6} opacity={0.5} />
          {/* tiendas pequeñas, lejos */}
          {[120, 520, 1180, 1760].map((x, i) => <path key={`lt${i}`} d={`M ${x - 60} 660 L ${x} 600 L ${x + 60} 660 Z`} fill={tono("#e9e1cc", -0.08)} stroke={tono("#e9e1cc", -0.35)} strokeWidth={2} />)}
          {tiendas.map(([x, k, c], i) => {
            // en la línea de los pies (1000): la tienda mide 1,5 personas y su puerta 1,1 (medidas.ts)
            const y = 1000, h = PERSONA * MEDIDA.tienda * k * 1.05, w = h * 1.15;
            return (
              <g key={i}>
                <path d={`M ${x - w / 2 - 70} ${y + 10} L ${x - w * 0.18} ${y - h * 0.62} M ${x + w / 2 + 70} ${y + 10} L ${x + w * 0.18} ${y - h * 0.62}`} stroke="#6b5a40" strokeWidth={3} />
                <Forma tema={tema} fill={c} d={`M ${x - w / 2} ${y} L ${x} ${y - h} L ${x + w / 2} ${y} Z`} />
                <path d={`M ${x - w * 0.25} ${y - h * 0.5} L ${x - w * 0.3} ${y} M ${x + w * 0.25} ${y - h * 0.5} L ${x + w * 0.3} ${y}`} stroke={tono(c, -0.2)} strokeWidth={3} />
                <Forma tema={tema} fill="#4a3b2c" d={`M ${x - w * 0.2} ${y} L ${x} ${y - PERSONA * 1.1 * k} L ${x + w * 0.2} ${y} Z`} grosor={0.7} />
                <Forma tema={tema} fill={tono(c, -0.1)} d={`M ${x} ${y - PERSONA * 1.1 * k} L ${x + w * 0.2} ${y} L ${x + w * 0.3} ${y} Z`} grosor={0.6} />
                <path d={`M ${x} ${y - h} L ${x} ${y - h - 60}`} stroke="#6b4425" strokeWidth={7} />
                <path d={`M ${x} ${y - h - 60} l 56 15 l -56 15 z`} fill="#b5262b" />
              </g>
            );
          })}

          {Array.from({ length: 18 }).map((_, i) => { const x = (i * 271) % 1900 + 10, y = 920 + ((i * 97) % 140); return <path key={`h${i}`} d={`M ${x - 9} ${y} l 6 -16 M ${x} ${y} l 0 -20 M ${x + 9} ${y} l -6 -16`} stroke="#5f7a3a" strokeWidth={3} strokeLinecap="round" />; })}
        </g>
      );
    }
    case "interior":
    default:
      return (
        <g>
          <rect x={0} y={0} width={W} height={H} fill="#cdb48c" />
          <rect x={0} y={0} width={W} height={760} fill="#d9c4a0" />
          <Forma tema={tema} fill="#8fc4e8" x={760} y={160} w={400} h={360} esq={6} />
          <path d="M 960 160 L 960 520 M 760 340 L 1160 340" stroke={tinta} strokeWidth={grueso} />
          <Forma tema={tema} fill="#7a5230" x={0} y={760} w={W} h={40} grosor={0.8} />
          <rect x={0} y={800} width={W} height={H - 800} fill="#a8794e" />
          {Array.from({ length: 9 }).map((_, i) => <path key={i} d={`M ${i * 240} 800 L ${i * 240 - 120} ${H}`} stroke={tono("#a8794e", -0.2)} strokeWidth={3} />)}
        </g>
      );
  }
};

