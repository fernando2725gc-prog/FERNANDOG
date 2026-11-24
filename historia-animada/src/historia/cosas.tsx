// Objetos e iconos de la plantilla : lo que llevan los muñecos y lo que salta al lado del narrador. Todos pasan
// por <Forma>, así se dibujan a la manera del tema. Tamaño a escala 1 ≈ 100-160 px.
import React from "react";
import { Forma, Linea, Texto, tono } from "./forma";
import { Tema } from "./tema";

export const COSAS = ["barras", "lingote", "pico", "saco", "monton_monedas", "isla", "suscribete", "sol", "anillos", "globo", "alabarda", "antorcha", "mapa_enrollado", "mapa_abierto", "carabela", "corona", "calavera", "moneda", "espada", "pergamino", "cruz", "media_luna", "castillo", "barril", "ancla", "sal", "pez", "especias", "seda", "galera", "trigo", "islote", "caballo", "arco", "yurta", "oveja", "junco", "cuenco", "canon", "fusil", "catapulta", "escudo", "bomba", "piramide", "templo", "muralla", "pagoda", "fabrica", "tren", "barco_vapor", "camello", "elefante", "vaca", "rata", "bandera", "bandera_blanca", "bandera_uk", "bandera_inglaterra", "bandera_irlanda", "libro", "pluma", "billete", "fuego", "petroleo", "oro", "cadenas", "balanza", "reloj", "loba", "choza", "bebe", "cesta", "cupula", "arca", "tablilla", "menora", "muro", "te", "patata", "diamante", "ametralladora", "azucar", "tabaco", "bicicleta", "amapola", "tanque", "avion", "acorazado", "portaaviones", "submarino", "radar", "bandera_francia", "bandera_italia", "bandera_eeuu", "bandera_japon", "bandera_urss"] as const;
export type CosaId = (typeof COSAS)[number];

export const Cosa: React.FC<{ id: CosaId | string; tema: Tema; f?: number }> = ({ id, tema, f = 0 }) => {
  const t = tema;
  switch (id) {
    case "mapa_enrollado":
      return (
        <g transform="rotate(-14)">
          <Forma tema={t} fill="#efe1bf" x={-11} y={-62} w={22} h={124} esq={8} />
          <Forma tema={t} fill="#e2cc9a" rx={12} ry={6} cx={0} cy={-62} grosor={0.7} />
          <path d="M -11 20 L 11 20" stroke="#b5372b" strokeWidth={6} />
        </g>
      );
    case "barras":
      // el escudo de Aragón: cuatro barras rojas sobre oro
      return (
        <g>
          <Forma tema={t} fill="#f0c23b" d="M -50 -60 L 50 -60 L 50 10 Q 50 50 0 66 Q -50 50 -50 10 Z" />
          {[-30, -10, 10, 30].map((x) => <rect key={x} x={x - 6} y={-58} width={12} height={x === -30 || x === 30 ? 84 : 110} fill="#c8322b" />)}
          <path d="M -50 -60 L 50 -60 L 50 10 Q 50 50 0 66 Q -50 50 -50 10 Z" fill="none" stroke={t.tinta} strokeWidth={Math.max(2.5, t.trazo)} strokeLinejoin="round" />
        </g>
      );
    case "lingote":
      return (
        <g>
          <Forma tema={t} fill="#d9dde3" d="M -60 20 L -40 -20 L 40 -20 L 60 20 Z" brillo />
          <Forma tema={t} fill="#f2f4f7" d="M -40 -20 L -30 -32 L 30 -32 L 40 -20 Z" grosor={0.7} />
        </g>
      );
    case "pico":
      return (
        <g transform="rotate(200)">
          <Linea tema={t} pts={[[0, 0], [0, 120]]} color="#7a5230" ancho={Math.max(5, t.palito)} />
          <Forma tema={t} fill="#9aa1ab" d="M -54 118 Q 0 98 54 118 L 50 128 Q 0 112 -50 128 Z" grosor={0.7} />
        </g>
      );
    case "saco":
      return <Forma tema={t} fill="#c9a66b" d="M -34 50 Q -46 0 -20 -30 L -12 -44 L 12 -44 L 20 -30 Q 46 0 34 50 Z" />;
    case "monton_monedas":
      return (
        <g>
          {[[-40, 30], [0, 30], [40, 30], [-20, 10], [20, 10], [0, -10]].map(([x, y], i) => <g key={i} transform={`translate(${x}, ${y}) scale(0.55)`}><Forma tema={t} fill="#f2c230" cx={0} cy={0} r={40} brillo /></g>)}
        </g>
      );
    case "isla":
      return (
        <g>
          <ellipse cx={0} cy={40} rx={96} ry={18} fill="#6fb7e8" opacity={0.7} />
          <Forma tema={t} fill="#e9cf8f" d="M -78 40 Q -40 4 0 6 Q 44 4 78 40 Z" />
          <Linea tema={t} pts={[[6, 20], [14, -30], [8, -70]]} color="#8a5a34" ancho={Math.max(5, t.palito)} />
          {[-1, 1].map((l) => <Forma key={l} tema={t} fill="#4f9a3e" d={`M 8 -70 Q ${8 + l * 30} -96 ${8 + l * 62} -70 Q ${8 + l * 30} -80 8 -70 Z`} grosor={0.7} />)}
          <Forma tema={t} fill="#4f9a3e" d="M 8 -70 Q 0 -110 -26 -112 Q 0 -96 8 -70 Z" grosor={0.7} />
        </g>
      );
    case "suscribete": {
      // el botón de suscribirse con su campana (la petición de la mitad del vídeo)
      const late = 1 + Math.max(0, Math.sin(f * 0.25)) * 0.05;
      return (
        <g transform={`scale(${late})`}>
          <Forma tema={t} fill="#e2312d" x={-170} y={-50} w={340} h={100} esq={22} />
          <text x={-20} y={14} textAnchor="middle" fontFamily={t.letraGorda} fontSize={44} fill="#ffffff">SUSCRÍBETE</text>
          <g transform={`translate(128, 0) rotate(${Math.sin(f * 0.5) * 14})`}><Forma tema={t} fill="#f2c230" d="M -18 14 Q -18 -22 0 -24 Q 18 -22 18 14 L 24 20 L -24 20 Z" grosor={0.6} /><circle cx={0} cy={26} r={6} fill={t.tinta} /></g>
        </g>
      );
    }
    case "sol": {
      const g = f * 0.6;
      return (
        <g>
          <g transform={`rotate(${g})`}>{Array.from({ length: 12 }).map((_, i) => <g key={i} transform={`rotate(${i * 30})`}><Forma tema={t} fill="#f7b733" d="M -10 -62 L 0 -96 L 10 -62 Z" grosor={0.6} /></g>)}</g>
          <Forma tema={t} fill="#ffd34d" cx={0} cy={0} r={56} brillo />
          <circle cx={-18} cy={-8} r={5} fill={t.tinta} /><circle cx={18} cy={-8} r={5} fill={t.tinta} />
          <path d="M -18 16 Q 0 30 18 16" stroke={t.tinta} strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case "anillos":
      return (
        <g fill="none" strokeLinecap="round">
          <circle cx={-24} cy={6} r={40} stroke={t.tinta} strokeWidth={18} /><circle cx={-24} cy={6} r={40} stroke="#f0c23b" strokeWidth={11} />
          <circle cx={26} cy={-6} r={40} stroke={t.tinta} strokeWidth={18} /><circle cx={26} cy={-6} r={40} stroke="#f0c23b" strokeWidth={11} />
          <path d="M 6 -40 A 40 40 0 0 1 60 -20" stroke="#f0c23b" strokeWidth={11} />
          <Forma tema={t} fill="#bfe6ff" d="M 18 -60 L 34 -60 L 40 -50 L 26 -38 L 12 -50 Z" grosor={0.6} />
        </g>
      );
    case "globo":
      return (
        <g>
          <Forma tema={t} fill="#3f86c4" cx={0} cy={0} r={70} />
          <Forma tema={t} fill="#5fae5a" d="M -40 -40 Q -10 -60 10 -40 Q 30 -20 10 0 Q -20 10 -30 -10 Q -50 -20 -40 -40 Z M 20 20 Q 40 10 50 30 Q 40 55 20 50 Q 5 40 20 20 Z" grosor={0.6} />
          <path d="M -70 0 Q 0 30 70 0 M 0 -70 Q 30 0 0 70" stroke="#ffffff" strokeWidth={2} fill="none" opacity={0.5} />
        </g>
      );
    case "alabarda":
      return (
        <g>
          <Linea tema={t} pts={[[0, 60], [0, -230]]} color="#7a5230" ancho={Math.max(4, t.palito * 0.8)} />
          <Forma tema={t} fill="#cfd4da" d="M 0 -230 L 10 -262 L 6 -236 L 34 -222 Q 40 -196 26 -180 L 2 -196 Z" grosor={0.8} />
        </g>
      );
    case "antorcha": {
      const llama = 1 + Math.sin(f * 0.6) * 0.08 + Math.sin(f * 1.3) * 0.05;
      return (
        <g>
          <circle cx={0} cy={-50} r={110} fill="#ffc455" opacity={0.18} />
          <Forma tema={t} fill="#6b4425" d="M -8 0 L 8 0 L 12 -40 L -12 -40 Z" grosor={0.7} />
          <g transform={`translate(0,-42) scale(${llama})`}><Forma tema={t} fill="#ff9a2e" d="M 0 -50 Q 22 -22 12 -4 Q 0 6 -12 -4 Q -22 -22 0 -50 Z" grosor={0.6} /><path d="M 0 -30 Q 9 -16 4 -6 Q 0 -2 -4 -6 Q -9 -16 0 -30 Z" fill="#ffe27a" /></g>
        </g>
      );
    }
    case "mapa_abierto":
      return (
        <g>
          <Forma tema={t} fill="#efe1bf" d="M -90 -60 L -30 -70 L 30 -58 L 90 -68 L 90 60 L 30 70 L -30 58 L -90 68 Z" />
          <path d="M -30 -70 L -30 58 M 30 -58 L 30 70" stroke={tono("#efe1bf", -0.25)} strokeWidth={2} />
          <path d="M -70 -20 Q -40 -40 -10 -10 Q 20 20 60 -5 Q 70 20 40 35 Q 0 45 -20 30 Q -60 25 -70 -20 Z" fill="#9cbf7a" opacity={0.85} />
          <path d="M -50 10 Q 0 -30 55 20" stroke="#b5372b" strokeWidth={3} strokeDasharray="7 6" fill="none" />
          <path d="M 50 14 l 10 10 m 0 -10 l -10 10" stroke="#b5372b" strokeWidth={4} />
        </g>
      );
    case "carabela": {
      const ola = Math.sin(f * 0.12) * 4;
      return (
        <g transform={`translate(0, ${ola}) rotate(${Math.sin(f * 0.1) * 2})`}>
          <Forma tema={t} fill="#f4ecd8" d="M -8 -120 Q 40 -90 44 -40 L -8 -40 Z" />
          <Forma tema={t} fill="#f4ecd8" d="M -14 -100 Q -60 -80 -62 -40 L -14 -40 Z" />
          <path d="M -8 -40 L 30 -40 M -36 -60 l 0 0" stroke="#b5372b" strokeWidth={0} />
          <Linea tema={t} pts={[[-10, -128], [-10, -20]]} color="#7a5230" ancho={Math.max(4, t.palito * 0.7)} />
          <Forma tema={t} fill="#9a6a3c" d="M -90 -24 L 92 -24 Q 80 18 50 22 L -60 22 Q -86 10 -90 -24 Z" />
          <path d="M -80 -8 L 84 -8" stroke={tono("#9a6a3c", -0.3)} strokeWidth={3} />
          <path d="M -4 -126 l 22 6 l -22 6 z" fill="#c8322b" />
          <path d="M -20 -78 l 10 0 m -5 -6 l 0 12" stroke="#c8322b" strokeWidth={4} />
        </g>
      );
    }
    case "corona":
      return <Forma tema={t} fill="#f0c23b" d="M -60 30 L -68 -34 L -32 -6 L 0 -46 L 32 -6 L 68 -34 L 60 30 Z" brillo />;
    case "calavera":
      return (
        <g>
          <Forma tema={t} fill="#f2efe6" d="M -42 -10 Q -46 -62 0 -64 Q 46 -62 42 -10 Q 40 10 26 16 L 26 34 L -26 34 L -26 16 Q -40 10 -42 -10 Z" />
          <circle cx={-17} cy={-14} r={11} fill={t.tinta} />
          <circle cx={17} cy={-14} r={11} fill={t.tinta} />
          <path d="M -12 34 L -12 22 M 0 34 L 0 22 M 12 34 L 12 22" stroke={t.tinta} strokeWidth={3} />
        </g>
      );
    case "moneda":
      return (
        <g>
          <Forma tema={t} fill="#f2c230" cx={0} cy={0} r={40} brillo />
          <circle cx={0} cy={0} r={28} fill="none" stroke={tono("#f2c230", -0.3)} strokeWidth={4} />
        </g>
      );
    case "espada":
      return (
        <g transform="rotate(180)">
          <Forma tema={t} fill="#d7dbe0" d="M -7 0 L 7 0 L 5 -140 L 0 -156 L -5 -140 Z" />
          <Forma tema={t} fill="#b8862f" x={-30} y={-4} w={60} h={12} esq={5} />
          <Forma tema={t} fill="#6b4425" x={-6} y={8} w={12} h={34} esq={4} />
        </g>
      );
    case "pergamino":
      return (
        <g>
          <Forma tema={t} fill="#f1e3c0" x={-70} y={-90} w={140} h={180} esq={6} />
          {[-50, -28, -6, 16, 38].map((y) => <path key={y} d={`M -48 ${y} L 48 ${y}`} stroke={tono("#f1e3c0", -0.3)} strokeWidth={4} strokeLinecap="round" />)}
          <circle cx={36} cy={66} r={14} fill="#b5372b" />
        </g>
      );
    case "cruz":
      return <Forma tema={t} fill="#f0c23b" d="M -12 -70 L 12 -70 L 12 -34 L 44 -34 L 44 -10 L 12 -10 L 12 60 L -12 60 L -12 -10 L -44 -10 L -44 -34 L -12 -34 Z" />;
    case "media_luna":
      return <Forma tema={t} fill="#f0c23b" d="M 10 -60 A 60 60 0 1 0 10 60 A 46 46 0 1 1 10 -60 Z" />;
    case "castillo":
      return (
        <g>
          <Forma tema={t} fill="#c9b48e" d="M -80 60 L -80 -30 L -64 -30 L -64 -46 L -48 -46 L -48 -30 L -32 -30 L -32 -46 L -16 -46 L -16 -30 L 16 -30 L 16 -46 L 32 -46 L 32 -30 L 48 -30 L 48 -46 L 64 -46 L 64 -30 L 80 -30 L 80 60 Z" />
          <Forma tema={t} fill="#5a3d26" d="M -18 60 L -18 22 Q 0 4 18 22 L 18 60 Z" grosor={0.7} />
        </g>
      );
    case "barril":
      return (
        <g>
          <Forma tema={t} fill="#a8733f" d="M -36 -50 Q -48 0 -36 50 L 36 50 Q 48 0 36 -50 Z" />
          <path d="M -42 -22 L 42 -22 M -42 22 L 42 22" stroke="#555" strokeWidth={6} />
        </g>
      );
    case "ancla":
      return (
        <g fill="none" stroke={t.tinta} strokeWidth={10} strokeLinecap="round">
          <circle cx={0} cy={-60} r={12} />
          <path d="M 0 -48 L 0 50 M -30 -30 L 30 -30 M -50 20 Q -40 56 0 54 Q 40 56 50 20" />
        </g>
      );
    case "sal":
      // un montón de sal blanca con su pala de madera
      return (
        <g>
          <Forma tema={t} fill="#f7f6f2" d="M -70 40 Q -40 -40 0 -46 Q 40 -40 70 40 Z" />
          {[[-24, -6], [10, -22], [30, 10], [-6, 18], [-40, 24]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#c9ccd3" />)}
          <Linea tema={t} pts={[[44, -60], [18, 8]]} color="#8a5a34" ancho={Math.max(5, t.palito)} />
          <Forma tema={t} fill="#b07b47" d="M 8 0 L 30 8 L 22 30 L 0 22 Z" grosor={0.7} />
        </g>
      );
    case "pez":
      return (
        <g>
          <Forma tema={t} fill="#8fb3c9" d="M -70 0 Q -30 -40 30 -16 L 70 -40 L 62 0 L 70 40 L 30 16 Q -30 40 -70 0 Z" brillo />
          <circle cx={-44} cy={-6} r={6} fill={t.tinta} />
          <path d="M -24 -18 Q -14 0 -24 18" stroke={tono("#8fb3c9", -0.35)} strokeWidth={4} fill="none" />
        </g>
      );
    case "especias":
      // un cuenco con tres montoncitos de especias (pimienta, azafrán y canela)
      return (
        <g>
          <Forma tema={t} fill="#c8322b" d="M -46 -6 Q -40 -40 -16 -40 Q 4 -36 4 -6 Z" grosor={0.7} />
          <Forma tema={t} fill="#e8a52a" d="M -8 -6 Q 0 -50 26 -48 Q 46 -40 46 -6 Z" grosor={0.7} />
          <Forma tema={t} fill="#7a4a26" d="M -30 -6 Q -14 -26 6 -24 Q 22 -20 20 -6 Z" grosor={0.7} />
          <Forma tema={t} fill="#a8733f" d="M -72 -8 L 72 -8 Q 64 50 0 52 Q -64 50 -72 -8 Z" />
          <path d="M -62 12 Q 0 22 62 12" stroke={tono("#a8733f", -0.3)} strokeWidth={4} fill="none" />
        </g>
      );
    case "seda":
      // un rollo de tela de seda que se desenrolla
      return (
        <g>
          <Forma tema={t} fill="#c9417a" d="M -20 -40 L 76 -16 Q 86 10 70 40 L -20 30 Z" brillo />
          <path d="M -4 -24 L 70 -4 M -4 0 L 74 16" stroke={tono("#c9417a", 0.3)} strokeWidth={4} />
          <Forma tema={t} fill="#d9558c" rx={30} ry={46} cx={-28} cy={-4} />
          <Forma tema={t} fill="#a8326a" rx={12} ry={18} cx={-28} cy={-4} grosor={0.7} />
        </g>
      );
    case "galera": {
      // la galera del Mediterráneo (Venecia, Génova, otomanos, Roma): casco largo y bajo, una fila de remos y la vela
      // latina (triangular) en una entena inclinada. No es la carabela (barco alto del Atlántico).
      const ola = Math.sin(f * 0.12) * 3;
      const remo = Math.sin(f * 0.18) * 12;
      return (
        <g transform={`translate(0, ${ola}) rotate(${Math.sin(f * 0.1) * 1.5})`}>
          <Linea tema={t} pts={[[-6, -12], [-6, -112]]} color="#7a5230" ancho={Math.max(4, t.palito * 0.7)} />
          <Forma tema={t} fill="#f4ecd8" d="M -70 -40 L 52 -128 Q 40 -70 -2 -40 Z" />
          <path d="M -82 -30 L 62 -134" stroke="#7a5230" strokeWidth={5} strokeLinecap="round" />
          <path d="M -4 -116 l 20 6 l -20 6 z" fill="#c8322b" />
          {Array.from({ length: 7 }).map((_, i) => { const x = -84 + i * 26; return <path key={i} d={`M ${x} 2 L ${x - 14 + remo * 0.6} 40`} stroke="#8a5a34" strokeWidth={4} strokeLinecap="round" />; })}
          <Forma tema={t} fill="#9a3a2c" d="M -128 -18 L 112 -18 L 136 -34 Q 124 4 96 10 L -104 10 Q -126 2 -128 -18 Z" />
          <path d="M -120 -6 L 116 -6" stroke="#e8b74a" strokeWidth={3} />
          <path d="M 112 -18 L 150 -26" stroke="#7a5230" strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    }
    case "trigo":
      // una gavilla de trigo atada: los campos, las cosechas, el pan
      return (
        <g>
          {[-34, -20, -8, 4, 16, 28].map((x, i) => {
            const top = -70 - (i % 2) * 10;
            return (
              <g key={i}>
                <path d={`M ${x * 0.25} 50 Q ${x * 0.5} 0 ${x} ${top + 30}`} stroke="#c9a03a" strokeWidth={4} fill="none" strokeLinecap="round" />
                <Forma tema={t} fill="#e8c25a" rx={9} ry={24} cx={x} cy={top + 6} grosor={0.6} />
              </g>
            );
          })}
          <Forma tema={t} fill="#b5372b" x={-20} y={12} w={40} h={12} esq={4} grosor={0.6} />
        </g>
      );
    case "islote":
      // isla de barro y cañas con una cabaña (marismas, lagunas, deltas; la «isla» con palmera es para el trópico)
      return (
        <g>
          <ellipse cx={0} cy={40} rx={104} ry={18} fill="#6fa8c8" opacity={0.7} />
          <Forma tema={t} fill="#9c8a62" d="M -86 40 Q -50 12 -4 14 Q 50 10 86 40 Z" />
          {[-70, -58, 58, 70, 46].map((x, i) => <path key={i} d={`M ${x} 34 Q ${x + 4} ${4 - (i % 2) * 10} ${x + 10} ${-14 - (i % 3) * 8}`} stroke="#6f8a3e" strokeWidth={4} fill="none" strokeLinecap="round" />)}
          <Forma tema={t} fill="#c9a66b" x={-30} y={-14} w={56} h={34} esq={2} grosor={0.7} />
          <Forma tema={t} fill="#b89a5a" d="M -40 -12 L -2 -46 L 36 -12 Z" grosor={0.7} />
          <rect x={-8} y={0} width={14} height={20} fill="#5a3d26" />
        </g>
      );
    case "caballo": {
      // un caballo de lado, al paso (para el narrador o el papel; en las escenas, un muñeco «montado» lleva el suyo)
      return <g transform="scale(0.55) translate(-20, 140)"><Caballo tema={t} f={f} /></g>;
    }
    case "arco":
      return (
        <g transform="rotate(-20)">
          <path d="M -6 -80 Q 56 0 -6 80" stroke="#8a5a34" strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d="M -6 -80 L -6 80" stroke="#efe6d2" strokeWidth={2.5} />
          <path d="M -40 0 L 70 0" stroke="#6b4425" strokeWidth={4} strokeLinecap="round" />
          <path d="M 70 0 l -14 -8 l 0 16 z" fill="#9aa1ab" stroke={t.tinta} strokeWidth={1.5} />
          <path d="M -40 0 l -10 -8 M -40 0 l -10 8" stroke="#c8322b" strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case "yurta":
      // la tienda redonda de fieltro de las estepas (mongoles, kazajos)
      return (
        <g>
          <Forma tema={t} fill="#f1e8d6" d="M -80 40 L -80 -10 Q -40 -64 0 -70 Q 40 -64 80 -10 L 80 40 Z" />
          <path d="M -80 -10 Q 0 -30 80 -10" stroke="#b5372b" strokeWidth={6} fill="none" />
          <path d="M -80 12 L 80 12" stroke="#b5372b" strokeWidth={4} />
          <Forma tema={t} fill="#c8322b" x={-16} y={2} w={32} h={38} esq={3} grosor={0.7} />
          <Forma tema={t} fill="#d9c9a3" rx={14} ry={6} cx={0} cy={-68} grosor={0.6} />
        </g>
      );
    case "oveja":
      // una oveja de la estepa (los rebaños de los pastores): lana en nubes, cara y patas oscuras
      return (
        <g transform={`translate(0, ${Math.abs(Math.sin(f * 0.09)) * -3})`}>
          {[[-12, 52], [24, 52], [-30, 52], [40, 52]].map(([x, y], i) => <path key={i} d={`M ${x} 18 L ${x} ${y}`} stroke="#3a2f2a" strokeWidth={7} strokeLinecap="round" />)}
          <Forma tema={t} fill="#f4efe3" d="M -56 4 Q -66 -26 -38 -34 Q -26 -56 0 -46 Q 22 -60 40 -40 Q 66 -36 60 -8 Q 70 18 40 26 Q 14 38 -10 28 Q -44 36 -56 4 Z" />
          <Forma tema={t} fill="#3a2f2a" rx={18} ry={24} cx={64} cy={-30} />
          <Forma tema={t} fill="#3a2f2a" rx={12} ry={6} cx={52} cy={-48} grosor={0.6} />
          <circle cx={70} cy={-34} r={3.5} fill="#f4efe3" />
        </g>
      );
    case "junco": {
      // el junco chino y coreano (la flota mongola contra Japón): casco alto con popa levantada y velas de esteras con
      // listones (no es la carabela ni la galera)
      const ola = Math.sin(f * 0.12) * 3;
      return (
        <g transform={`translate(0, ${ola})`}>
          {[[-46, -150, 92], [40, -120, 70]].map(([x, y, w], i) => (
            <g key={i}>
              <Linea tema={t} pts={[[x, -16], [x, y - 8]]} color="#6b4425" ancho={Math.max(4, t.palito * 0.7)} />
              <Forma tema={t} fill="#b5532c" d={`M ${x - w / 2} ${y} L ${x + w / 2} ${y + 6} L ${x + w / 2 + 8} -26 L ${x - w / 2 - 4} -26 Z`} />
              {[0.2, 0.4, 0.6, 0.8].map((k) => <path key={k} d={`M ${x - w / 2 - 1} ${y + (-26 - y) * k} L ${x + w / 2 + 5} ${y + 6 + (-32 - y) * k}`} stroke="#6b2f1a" strokeWidth={3} />)}
            </g>
          ))}
          <Forma tema={t} fill="#7a5230" d="M -128 -40 L -96 -22 L 96 -22 L 122 -52 Q 128 4 92 14 L -96 14 Q -124 0 -128 -40 Z" />
          <path d="M -100 -6 L 104 -6" stroke="#e8b74a" strokeWidth={3} />
          <Forma tema={t} fill="#5a3d26" x={70} y={-46} w={40} h={26} esq={3} grosor={0.6} />
        </g>
      );
    }
    case "cuenco":
      // un cuenco de beber (leche, kumis… o veneno)
      return (
        <g>
          <Forma tema={t} fill="#c9a66b" d="M -46 -14 Q -44 34 0 36 Q 44 34 46 -14 Z" />
          <Forma tema={t} fill="#f1ead6" rx={46} ry={10} cx={0} cy={-14} grosor={0.7} />
          <path d="M -36 6 Q 0 16 36 6" stroke="#8a6a3c" strokeWidth={3} fill="none" />
        </g>
      );
    // ——— guerra ———
    case "canon":
      // cañón de bronce sobre su cureña de madera (de 1400 a 1860)
      return (
        <g>
          <Forma tema={t} fill="#c9963a" d="M -78 -30 L 56 -46 Q 70 -46 70 -36 L 70 -16 Q 70 -6 56 -6 L -78 -14 Q -92 -22 -78 -30 Z" brillo />
          <Forma tema={t} fill="#b07f2c" rx={10} ry={21} cx={70} cy={-26} grosor={0.7} />
          <circle cx={70} cy={-26} r={6} fill={t.tinta} />
          <path d="M -40 -34 L -40 -10 M 20 -40 L 20 -8" stroke={tono("#c9963a", -0.3)} strokeWidth={4} />
          <Forma tema={t} fill="#7a5230" d="M -70 -10 L 30 -10 L 10 26 L -60 26 Z" />
          <Forma tema={t} fill="#8a5a34" cx={-12} cy={30} r={26} />
          <circle cx={-12} cy={30} r={7} fill={t.tinta} />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M -12 30 L ${-12 + Math.cos(i * Math.PI / 4) * 24} ${30 + Math.sin(i * Math.PI / 4) * 24} M -12 30 L ${-12 - Math.cos(i * Math.PI / 4) * 24} ${30 - Math.sin(i * Math.PI / 4) * 24}`} stroke={tono("#8a5a34", -0.3)} strokeWidth={3} />)}
          {[[-74, 48], [-56, 50], [-64, 36]].map(([x, y], i) => <Forma key={i} tema={t} fill="#2a2624" cx={x} cy={y} r={9} grosor={0.6} />)}
        </g>
      );
    case "fusil":
      // mosquete o fusil (de los tercios a las guerras mundiales)
      return (
        <g transform="rotate(-25)">
          <Forma tema={t} fill="#8a5a34" d="M -84 6 L -40 -2 L 30 -4 L 30 6 L -30 10 L -50 22 Q -80 28 -88 18 Z" />
          <Forma tema={t} fill="#7a7f87" x={20} y={-9} w={70} h={9} esq={3} brillo />
          <path d="M 86 -10 L 92 -18" stroke={t.tinta} strokeWidth={3} strokeLinecap="round" />
          <path d="M -26 10 Q -22 22 -14 22" stroke={t.tinta} strokeWidth={3} fill="none" />
          <rect x={-14} y={-8} width={14} height={8} rx={2} fill="#5a5f66" stroke={t.tinta} strokeWidth={1.5} />
        </g>
      );
    case "catapulta": {
      // catapulta de madera (asedios antiguos y medievales); el brazo se tensa y suelta
      const brazo = -20 - Math.max(0, Math.sin(f * 0.08)) * 30;
      return (
        <g>
          <Forma tema={t} fill="#8a5a34" x={-80} y={14} w={160} h={16} esq={3} />
          <Forma tema={t} fill="#7a5230" d="M -30 14 L -6 -40 L 6 -40 L 30 14 L 18 14 L 0 -24 L -18 14 Z" grosor={0.8} />
          <g transform={`translate(0, -34) rotate(${brazo})`}>
            <Forma tema={t} fill="#9a6a3c" x={-6} y={-6} w={96} h={12} esq={4} />
            <Forma tema={t} fill="#6b4425" d="M 76 -6 Q 84 -26 100 -20 Q 104 -6 92 2 Z" grosor={0.7} />
            <Forma tema={t} fill="#9aa1ab" cx={90} cy={-18} r={9} grosor={0.6} />
          </g>
          {[-56, 56].map((x) => <g key={x}><Forma tema={t} fill="#8a5a34" cx={x} cy={34} r={18} /><circle cx={x} cy={34} r={5} fill={t.tinta} /></g>)}
        </g>
      );
    }
    case "escudo":
      // escudo redondo de madera con umbo de metal (vikingos, griegos, celtas…)
      return (
        <g>
          <Forma tema={t} fill="#b5372b" cx={0} cy={0} r={66} />
          <path d="M -64 0 L 64 0 M 0 -64 L 0 64" stroke="#e8b74a" strokeWidth={12} />
          <circle cx={0} cy={0} r={62} fill="none" stroke="#9aa1ab" strokeWidth={7} />
          <Forma tema={t} fill="#c4c9d0" cx={0} cy={0} r={18} brillo />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={Math.cos(i * Math.PI / 4) * 54} cy={Math.sin(i * Math.PI / 4) * 54} r={3.5} fill={t.tinta} />)}
        </g>
      );
    case "bomba": {
      // bomba redonda con la mecha encendida (chispas que saltan)
      const chispa = Math.sin(f * 0.6);
      return (
        <g>
          <Forma tema={t} fill="#2a2624" cx={0} cy={14} r={50} brillo />
          <Forma tema={t} fill="#3a3632" x={-14} y={-46} w={28} h={16} esq={3} grosor={0.7} />
          <path d="M 0 -46 Q 8 -66 26 -70" stroke="#c9a66b" strokeWidth={5} fill="none" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 + f * 0.3; const r = 10 + chispa * 4; return <path key={i} d={`M 28 -72 L ${28 + Math.cos(a) * r} ${-72 + Math.sin(a) * r}`} stroke={i % 2 ? "#f2c230" : "#f08a24"} strokeWidth={4} strokeLinecap="round" />; })}
        </g>
      );
    }
    // ——— lugares ———
    case "piramide":
      return (
        <g>
          <Forma tema={t} fill="#e3bd74" d="M -100 50 L 0 -70 L 100 50 Z" />
          <Forma tema={t} fill="#c99d55" d="M 0 -70 L 100 50 L 30 50 Z" sinBorde />
          <path d="M -100 50 L 0 -70 L 100 50 Z" fill="none" stroke={t.tinta} strokeWidth={Math.max(2.5, t.trazo)} strokeLinejoin="round" />
          {[-30, -6, 18].map((y, i) => <path key={i} d={`M ${-((y + 70) / 120) * 100} ${y} L ${((y + 70) / 120) * 100} ${y}`} stroke={tono("#e3bd74", -0.25)} strokeWidth={2.5} />)}
          <rect x={-10} y={30} width={20} height={20} fill="#5a3d26" />
        </g>
      );
    case "templo":
      // templo grecorromano: frontón, columnas y escalones (Roma, Grecia, el Senado, la religión antigua)
      return (
        <g transform="scale(0.85)">
        <g>
          <Forma tema={t} fill="#f1ead6" d="M -96 -36 L 0 -84 L 96 -36 Z" />
          <path d="M -62 -44 L 0 -74 L 62 -44" stroke={tono("#f1ead6", -0.25)} strokeWidth={3} fill="none" />
          <Forma tema={t} fill="#e9dfc6" x={-92} y={-38} w={184} h={14} esq={2} grosor={0.8} />
          {[-72, -36, 0, 36, 72].map((x) => <g key={x}><Forma tema={t} fill="#f4efe3" x={x - 9} y={-24} w={18} h={66} grosor={0.7} /><path d={`M ${x - 3} -20 L ${x - 3} 38 M ${x + 3} -20 L ${x + 3} 38`} stroke={tono("#f4efe3", -0.2)} strokeWidth={2} /></g>)}
          <Forma tema={t} fill="#e3d6bc" x={-100} y={42} w={200} h={10} esq={2} grosor={0.7} />
          <Forma tema={t} fill="#d6c7a8" x={-108} y={52} w={216} h={10} esq={2} grosor={0.7} />
        </g>
        </g>
      );
    case "muralla":
      // muralla de piedra con almenas y una torre (la Gran Muralla, Constantinopla, una ciudad amurallada)
      return (
        <g transform="scale(0.82)">
        <g>
          <Forma tema={t} fill="#b9a98a" d="M -110 50 L -110 -14 L -96 -14 L -96 -26 L -80 -26 L -80 -14 L -64 -14 L -64 -26 L -48 -26 L -48 -14 L 30 -14 L 30 50 Z" />
          <Forma tema={t} fill="#a8977a" d="M 30 50 L 30 -50 L 42 -50 L 42 -64 L 58 -64 L 58 -50 L 74 -50 L 74 -64 L 90 -64 L 90 -50 L 102 -50 L 102 50 Z" />
          {[[-100, 4], [-70, 4], [-40, 4], [-10, 4], [-86, 26], [-56, 26], [-26, 26], [4, 26], [44, -20], [74, -20], [58, 6], [44, 30], [80, 30]].map(([x, y], i) => <rect key={i} x={x} y={y} width={22} height={12} rx={2} fill="none" stroke={tono("#b9a98a", -0.3)} strokeWidth={2} />)}
          <path d="M 56 50 L 56 26 Q 66 14 76 26 L 76 50 Z" fill="#3a2f2a" />
        </g>
        </g>
      );
    case "pagoda":
      // pagoda de tejados curvos (China, Japón, Corea)
      return (
        <g>
          {[[70, 40], [56, 0], [42, -38]].map(([w, y], i) => (
            <g key={i}>
              <Forma tema={t} fill="#c8322b" x={-w * 0.62} y={y - 2} w={w * 1.24} h={34} grosor={0.7} />
              <Forma tema={t} fill="#2f5f4a" d={`M ${-w - 14} ${y - 2} Q ${-w * 0.6} ${y - 10} ${-w * 0.5} ${y - 22} L ${w * 0.5} ${y - 22} Q ${w * 0.6} ${y - 10} ${w + 14} ${y - 2} Q ${w * 0.5} ${y - 8} ${-w * 0.0} ${y - 8} Q ${-w * 0.5} ${y - 8} ${-w - 14} ${y - 2} Z`} />
            </g>
          ))}
          <path d="M 0 -60 L 0 -88" stroke="#e8b74a" strokeWidth={5} strokeLinecap="round" />
          <circle cx={0} cy={-90} r={5} fill="#e8b74a" stroke={t.tinta} strokeWidth={1.5} />
          <Forma tema={t} fill="#d6c7a8" x={-60} y={72} w={120} h={10} esq={2} grosor={0.7} />
          <rect x={-10} y={50} width={20} height={22} fill="#5a3d26" />
        </g>
      );
    case "fabrica":
      // fábrica de ladrillo con chimeneas que echan humo (la revolución industrial)
      return (
        <g transform="scale(0.88)">
        <g>
          {[[34, -100], [66, -84]].map(([x, top], i) => (
            <g key={i}>
              <Forma tema={t} fill="#a8503a" x={x - 9} y={top} w={18} h={110 + (top + 100) * -1 + 10} grosor={0.7} />
              {[0, 1, 2].map((k) => { const c = ((f * 0.6 + k * 26 + i * 13) % 78); return <circle key={k} cx={x + c * 0.4} cy={top - 8 - c} r={8 + c * 0.18} fill="#8a8f96" opacity={Math.max(0, 0.75 - c / 100)} />; })}
            </g>
          ))}
          <Forma tema={t} fill="#b5573c" d="M -96 50 L -96 -10 L -60 -34 L -60 -10 L -24 -34 L -24 -10 L 12 -34 L 12 -10 L 90 -10 L 90 50 Z" />
          {[-80, -44, -8, 28, 60].map((x) => <rect key={x} x={x} y={8} width={20} height={22} fill="#f2cf6a" stroke={t.tinta} strokeWidth={1.5} />)}
        </g>
        </g>
      );
    // ——— transporte ———
    case "tren": {
      // locomotora de vapor (siglo XIX) con humo
      const r = f * 0.15;
      return (
        <g transform="scale(0.8)">
        <g>
          {[0, 1, 2].map((k) => { const c = ((f * 0.7 + k * 24) % 72); return <circle key={k} cx={58 - c * 0.9} cy={-62 - c * 0.5} r={9 + c * 0.2} fill="#c9ccd3" opacity={Math.max(0, 0.8 - c / 90)} />; })}
          <Forma tema={t} fill="#2f4f8f" x={-96} y={-56} w={48} h={56} esq={4} />
          <rect x={-88} y={-48} width={32} height={22} fill="#cfe7f5" stroke={t.tinta} strokeWidth={1.5} />
          <Forma tema={t} fill="#2a2624" x={-104} y={-64} w={64} h={10} esq={3} grosor={0.7} />
          <Forma tema={t} fill="#3a3d45" d="M -48 -36 L 72 -36 Q 84 -36 84 -24 L 84 0 L -48 0 Z" brillo />
          <Forma tema={t} fill="#2a2624" x={48} y={-62} w={18} h={28} esq={2} grosor={0.7} />
          <Forma tema={t} fill="#c8322b" d="M 84 -4 L 100 16 L 84 16 Z" grosor={0.7} />
          {[-76, -20, 24, 64].map((x, i) => <g key={x} transform={`translate(${x}, 14) rotate(${(r * 57) % 360})`}><Forma tema={t} fill="#c8322b" cx={0} cy={0} r={i === 0 ? 18 : 14} /><path d="M -12 0 L 12 0 M 0 -12 L 0 12" stroke={t.tinta} strokeWidth={2.5} /></g>)}
          <path d="M -76 14 L 64 14" stroke="#9aa1ab" strokeWidth={4} />
        </g>
        </g>
      );
    }
    case "barco_vapor": {
      // barco de vapor con chimenea y rueda de paletas (siglo XIX)
      const ola = Math.sin(f * 0.12) * 3;
      return (
        <g transform="scale(0.72)">
        <g transform={`translate(0, ${ola})`}>
          {[0, 1, 2].map((k) => { const c = ((f * 0.6 + k * 24) % 72); return <circle key={k} cx={10 - c * 0.8} cy={-96 - c * 0.5} r={9 + c * 0.2} fill="#8a8f96" opacity={Math.max(0, 0.75 - c / 90)} />; })}
          <Forma tema={t} fill="#2a2624" x={-2} y={-96} w={24} h={58} esq={2} />
          <rect x={-2} y={-90} width={24} height={8} fill="#c8322b" />
          <Forma tema={t} fill="#f4efe3" x={-60} y={-44} w={110} h={26} esq={3} />
          {[-48, -26, -4, 18].map((x) => <circle key={x} cx={x + 8} cy={-31} r={5} fill="#5a6f86" stroke={t.tinta} strokeWidth={1.2} />)}
          <Forma tema={t} fill="#26201c" d="M -116 -18 L 112 -18 L 128 -34 Q 120 10 92 14 L -94 14 Q -114 4 -116 -18 Z" />
          <path d="M -108 -8 L 116 -8" stroke="#c8322b" strokeWidth={4} />
          <Forma tema={t} fill="#c8322b" d="M 46 -18 A 26 26 0 0 1 94 -18 Z" grosor={0.7} />
        </g>
        </g>
      );
    }
    // ——— animales ———
    case "camello":
      return (
        <g>
          {[-44, -26, 30, 48].map((x, i) => <Linea key={i} tema={t} pts={[[x, 0], [x + (i % 2 ? 2 : -2), 30], [x, 60]]} color={i % 2 ? "#b98a4a" : "#c99a56"} ancho={Math.max(7, t.palito)} />)}
          <Forma tema={t} fill="#d6a85e" d="M -62 6 Q -66 -22 -40 -28 Q -30 -64 -10 -40 Q 4 -66 22 -40 Q 46 -34 54 -10 L 62 -28 Q 66 -60 82 -66 L 98 -62 Q 104 -52 92 -48 L 80 -46 Q 76 -20 66 6 Q 40 20 -10 18 Q -50 20 -62 6 Z" />
          <circle cx={90} cy={-58} r={3.5} fill={t.tinta} />
          <path d="M -62 0 Q -78 10 -74 26" stroke="#b98a4a" strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      );
    case "elefante":
      // elefante (Aníbal, la India, Cartago)
      return (
        <g>
          {[-54, -30, 24, 46].map((x, i) => <Forma key={i} tema={t} fill={i % 2 ? "#8f969e" : "#a1a8b0"} x={x - 11} y={0} w={22} h={52} esq={6} grosor={0.7} />)}
          <Forma tema={t} fill="#a1a8b0" d="M -74 10 Q -84 -46 -20 -54 Q 40 -60 62 -30 Q 70 -10 60 14 L -66 14 Q -74 14 -74 10 Z" />
          <Forma tema={t} fill="#a1a8b0" d="M 50 -50 Q 92 -60 96 -26 Q 98 0 104 26 Q 106 40 94 38 Q 88 14 82 -4 Q 70 -10 56 -14 Z" />
          <Forma tema={t} fill="#8f969e" d="M 46 -46 Q 20 -40 26 -10 Q 34 6 54 -4 Z" grosor={0.7} />
          <path d="M 80 -8 Q 92 0 98 -6" stroke="#f4efe3" strokeWidth={6} strokeLinecap="round" fill="none" />
          <circle cx={74} cy={-32} r={4} fill={t.tinta} />
          <path d="M -74 -4 Q -90 6 -84 22" stroke="#8f969e" strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      );
    case "loba": {
      // la loba de la leyenda de Roma (o cualquier lobo): de lado, mirando a la derecha, pardo gris, hocico largo, orejas
      // de punta y cola baja; la cola se mueve despacio
      const cola = Math.sin(f * 0.1) * 6;
      return (
        <g>
          {[[-60, 0], [-36, 4], [44, 0], [66, 4]].map(([x, d], i) => <Forma key={i} tema={t} fill={i % 2 ? "#7d756c" : "#8e867c"} x={x - 8} y={6 + d} w={16} h={58 - d} esq={6} grosor={0.6} />)}
          <Forma tema={t} fill="#8e867c" d={`M -86 -10 Q -120 ${10 + cola} -130 ${54 + cola} Q -112 ${48 + cola} -98 ${18 + cola} Z`} grosor={0.7} />
          <Forma tema={t} fill="#9a9288" d="M -90 -18 Q -96 -52 -50 -56 L 50 -58 Q 92 -60 96 -24 Q 96 18 60 22 L -60 22 Q -92 20 -90 -18 Z" />
          <Forma tema={t} fill="#c9c0b2" d="M -40 14 Q 0 32 48 14 Q 20 22 -40 14 Z" grosor={0.5} />
          <Forma tema={t} fill="#9a9288" d="M 64 -40 Q 80 -96 120 -92 Q 150 -86 176 -66 Q 182 -54 168 -50 L 128 -44 Q 110 -20 84 -14 Z" />
          <Forma tema={t} fill="#9a9288" d="M 96 -84 L 100 -122 L 120 -92 Z" grosor={0.7} />
          <Forma tema={t} fill="#9a9288" d="M 116 -88 L 126 -124 L 138 -86 Z" grosor={0.7} />
          <circle cx={178} cy={-62} r={6} fill={t.tinta} />
          <circle cx={132} cy={-74} r={4.5} fill={t.tinta} />
          <path d="M 132 -48 Q 150 -44 166 -50" stroke={t.tinta} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case "choza":
      // la choza de una aldea antigua (las primeras casas de Roma, del Lacio y de la Edad del Hierro): paredes de barro y
      // palos, tejado cónico de paja con su humo
      return (
        <g>
          <Forma tema={t} fill="#b98a5c" d="M -70 50 L -64 -14 L 64 -14 L 70 50 Z" />
          {[-44, -14, 16, 46].map((x) => <path key={x} d={`M ${x} -10 L ${x + 2} 46`} stroke={tono("#b98a5c", -0.25)} strokeWidth={3} />)}
          <Forma tema={t} fill="#5a3d26" d="M -18 50 L -18 6 Q 0 -8 18 6 L 18 50 Z" grosor={0.7} />
          <Forma tema={t} fill="#d9b25e" d="M -92 -6 Q 0 -150 92 -6 Q 0 8 -92 -6 Z" />
          {[-60, -30, 0, 30, 60].map((x) => <path key={x} d={`M ${x * 0.25} -104 L ${x} -6`} stroke={tono("#d9b25e", -0.22)} strokeWidth={3} />)}
          <path d="M -6 -118 L 0 -100 L 6 -118" stroke="#6b4425" strokeWidth={5} fill="none" strokeLinecap="round" />
          {[0, 1, 2].map((i) => { const sube = (f * 0.8 + i * 18) % 54; return <circle key={i} cx={4 + Math.sin((f + i * 20) / 12) * 6} cy={-124 - sube} r={8 + sube * 0.15} fill="#b9b4ac" opacity={Math.max(0, 0.7 - sube / 80)} />; })}
        </g>
      );
    case "vaca":
      return (
        <g>
          {[-46, -28, 30, 46].map((x, i) => <Forma key={i} tema={t} fill={i % 2 ? "#e8e2d4" : "#f4efe3"} x={x - 6} y={10} w={12} h={44} esq={4} grosor={0.6} />)}
          <Forma tema={t} fill="#f4efe3" x={-64} y={-34} w={124} h={56} esq={24} />
          <Forma tema={t} fill="#3a2f2a" d="M -40 -34 Q -20 -10 -44 8 Q -60 -4 -56 -26 Z" sinBorde />
          <Forma tema={t} fill="#3a2f2a" d="M 10 -20 Q 30 -30 34 -8 Q 20 10 6 0 Z" sinBorde />
          <Forma tema={t} fill="#f4efe3" rx={24} ry={28} cx={74} cy={-36} />
          <Forma tema={t} fill="#e8a5a0" rx={18} ry={11} cx={80} cy={-16} grosor={0.6} />
          <path d="M 58 -60 L 50 -74 M 90 -60 L 98 -74" stroke="#c9a66b" strokeWidth={6} strokeLinecap="round" />
          <circle cx={66} cy={-40} r={3.5} fill={t.tinta} /><circle cx={84} cy={-40} r={3.5} fill={t.tinta} />
          <Forma tema={t} fill="#e8a5a0" rx={12} ry={8} cx={-20} cy={24} grosor={0.6} />
        </g>
      );
    case "rata":
      // la rata (la peste negra, las epidemias)
      return (
        <g transform={`translate(0, ${Math.abs(Math.sin(f * 0.25)) * -3})`}>
          <path d="M -50 10 Q -90 20 -96 -10" stroke="#c99a8a" strokeWidth={5} fill="none" strokeLinecap="round" />
          <Forma tema={t} fill="#7a7068" d="M -56 10 Q -60 -28 -10 -34 Q 30 -36 48 -14 L 72 -4 Q 66 12 40 18 L -50 18 Q -58 16 -56 10 Z" />
          <Forma tema={t} fill="#8a8078" rx={14} ry={16} cx={30} cy={-34} />
          <Forma tema={t} fill="#e8a5a0" rx={7} ry={9} cx={30} cy={-34} grosor={0.5} />
          <circle cx={54} cy={-14} r={3.5} fill={t.tinta} />
          <circle cx={73} cy={-4} r={4} fill="#e8a5a0" stroke={t.tinta} strokeWidth={1.5} />
          <path d="M 70 -6 L 92 -14 M 70 -2 L 94 -2" stroke={t.tinta} strokeWidth={1.5} />
          {[-36, 20].map((x) => <path key={x} d={`M ${x} 18 L ${x - 4} 30`} stroke="#c99a8a" strokeWidth={5} strokeLinecap="round" />)}
        </g>
      );
    // ——— cosas ———
    case "bandera":
    case "bandera_blanca": {
      // bandera que ondea en su asta (roja con franja dorada; la blanca = rendirse)
      const blanca = id === "bandera_blanca";
      const o = (x: number) => Math.sin(f * 0.18 - x * 0.05) * 7 * (x / 110);
      const pts = Array.from({ length: 12 }, (_, i) => -36 + i * 10);
      const arriba = pts.map((x) => `${x + 36 + 4},${-82 + o(x + 36)}`).join(" L ");
      const abajo = [...pts].reverse().map((x) => `${x + 36 + 4},${-22 + o(x + 36)}`).join(" L ");
      return (
        <g transform="translate(-30, 0)">
          <Linea tema={t} pts={[[0, 70], [0, -92]]} color="#6b4425" ancho={Math.max(5, t.palito)} />
          <circle cx={0} cy={-94} r={6} fill="#e8b74a" stroke={t.tinta} strokeWidth={1.5} />
          <Forma tema={t} fill={blanca ? "#f7f4ec" : "#c8322b"} d={`M ${arriba} L ${abajo} Z`} />
          {!blanca && <path d={`M 4,${-52 + o(0)} ${pts.map((x) => `L ${x + 36 + 4},${-52 + o(x + 36)}`).join(" ")}`} stroke="#f2c230" strokeWidth={9} fill="none" />}
        </g>
      );
    }
    case "bandera_uk":
    case "bandera_inglaterra":
    case "bandera_irlanda":
    case "bandera_francia":
    case "bandera_italia":
    case "bandera_eeuu":
    case "bandera_japon":
    case "bandera_urss": {
      // banderas con dibujo, que ondean igual que la «bandera»: la Union Jack (Reino Unido, desde 1801; antes de 1707,
      // la de Inglaterra), la cruz de San Jorge (Inglaterra) y la tricolor irlandesa (1916, la República)
      const o = (x: number) => Math.sin(f * 0.18 - x * 0.05) * 7 * (x / 110);
      const W = (x: number, y: number) => `${x.toFixed(1)},${(y + o(x - 4)).toFixed(1)}`;
      const linea = (a: [number, number], b: [number, number]) => Array.from({ length: 11 }, (_, i) => W(a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10)).join(" L ");
      const pts = Array.from({ length: 12 }, (_, i) => 4 + i * 10);
      const contorno = `M ${pts.map((x) => W(x, -82)).join(" L ")} L ${[...pts].reverse().map((x) => W(x, -22)).join(" L ")} Z`;
      const cid = `bnd-${id}-${Math.round(f * 10)}`;
      const X0 = 4, X1 = 114, Y0 = -82, Y1 = -22, XC = 59, YC = -52;
      let dibujo: React.ReactNode;
      const tri = (a: string, b: string, c: string) => {
        const franja = (x0: number, x1: number, col: string) => <path d={`M ${linea([x0, Y0], [x1, Y0])} L ${linea([x1, Y1], [x0, Y1])} Z`} fill={col} />;
        return <g>{franja(X0, 41, a)}{franja(41, 78, b)}{franja(78, X1, c)}</g>;
      };
      if (id === "bandera_francia") dibujo = tri("#1f3f8f", "#f7f4ec", "#c8322b");
      else if (id === "bandera_italia") dibujo = tri("#169b62", "#f7f4ec", "#c8322b");
      else if (id === "bandera_japon") dibujo = <g><rect x={0} y={-100} width={120} height={90} fill="#f7f4ec" /><circle cx={XC} cy={YC + o(XC - 4)} r={17} fill="#c8322b" /></g>;
      else if (id === "bandera_urss") dibujo = <g><rect x={0} y={-100} width={120} height={90} fill="#c8322b" /><path d={`M ${W(18, -74)} L ${W(30, -74)}`} stroke="#f2c230" strokeWidth={0} /><g transform={`translate(22, ${-68 + o(18)})`}><path d="M 0 -9 L 2.6 -2.8 L 9 -2.8 L 3.8 1.2 L 5.6 7.6 L 0 3.8 L -5.6 7.6 L -3.8 1.2 L -9 -2.8 L -2.6 -2.8 Z" fill="#f2c230" /><path d="M -6 22 Q 4 26 10 14 M -2 12 L 10 26" stroke="#f2c230" strokeWidth={3.5} fill="none" strokeLinecap="round" /></g></g>;
      else if (id === "bandera_eeuu") dibujo = (
        <g>
          <rect x={0} y={-100} width={120} height={90} fill="#f7f4ec" />
          {[0, 2, 4, 6].map((k) => { const y0 = Y0 + k * 8.6, y1 = y0 + 8.6; return <path key={k} d={`M ${linea([X0, y0], [X1, y0])} L ${linea([X1, y1], [X0, y1])} Z`} fill="#c8322b" />; })}
          <path d={`M ${linea([X0, Y0], [52, Y0])} L ${linea([52, Y0 + 32], [X0, Y0 + 32])} Z`} fill="#1f3f8f" />
          {[[14, -74], [28, -74], [42, -74], [21, -64], [35, -64], [14, -55], [28, -55], [42, -55]].map(([x, y], k) => <circle key={k} cx={x} cy={y + o(x - 4)} r={2.4} fill="#f7f4ec" />)}
        </g>
      );
      else if (id === "bandera_irlanda") {
        const franja = (a: number, b: number, c: string) => <path d={`M ${linea([a, Y0], [b, Y0])} L ${linea([b, Y1], [a, Y1])} Z`} fill={c} />;
        dibujo = <g>{franja(X0, 41, "#169b62")}{franja(41, 78, "#f7f4ec")}{franja(78, X1, "#ff883e")}</g>;
      } else {
        const uk = id === "bandera_uk";
        dibujo = (
          <g>
            <rect x={0} y={-100} width={120} height={90} fill={uk ? "#1f3f8f" : "#f7f4ec"} />
            {uk && <path d={`M ${linea([X0, Y0], [X1, Y1])} M ${linea([X0, Y1], [X1, Y0])}`} stroke="#f7f4ec" strokeWidth={13} fill="none" />}
            {uk && <path d={`M ${linea([X0, Y0], [X1, Y1])} M ${linea([X0, Y1], [X1, Y0])}`} stroke="#c8322b" strokeWidth={4.5} fill="none" />}
            {uk && <path d={`M ${linea([X0, YC], [X1, YC])} M ${W(XC, Y0 - 10)} L ${W(XC, Y1 + 10)}`} stroke="#f7f4ec" strokeWidth={19} fill="none" />}
            <path d={`M ${linea([X0, YC], [X1, YC])} M ${W(XC, Y0 - 10)} L ${W(XC, Y1 + 10)}`} stroke="#c8322b" strokeWidth={11} fill="none" />
          </g>
        );
      }
      return (
        <g transform="translate(-30, 0)">
          <defs><clipPath id={cid}><path d={contorno} /></clipPath></defs>
          <Linea tema={t} pts={[[0, 70], [0, -92]]} color="#6b4425" ancho={Math.max(5, t.palito)} />
          <circle cx={0} cy={-94} r={6} fill="#e8b74a" stroke={t.tinta} strokeWidth={1.5} />
          <g clipPath={`url(#${cid})`}>{dibujo}</g>
          <path d={contorno} fill="none" stroke={t.tinta} strokeWidth={t.trazo} strokeLinejoin="round" />
        </g>
      );
    }
    case "libro":
      return (
        <g>
          <Forma tema={t} fill="#7a1f2b" d="M -76 -46 L 0 -36 L 76 -46 L 76 50 L 0 60 L -76 50 Z" />
          <Forma tema={t} fill="#f7f1e2" d="M -68 -44 L 0 -34 L 0 54 L -68 44 Z" grosor={0.7} />
          <Forma tema={t} fill="#efe6d0" d="M 68 -44 L 0 -34 L 0 54 L 68 44 Z" grosor={0.7} />
          {[-24, -10, 4, 18].map((y) => <g key={y}><path d={`M -58 ${y - 6} L -10 ${y + 1}`} stroke="#b0a58e" strokeWidth={3} /><path d={`M 10 ${y + 1} L 58 ${y - 6}`} stroke="#b0a58e" strokeWidth={3} /></g>)}
          <path d="M 30 -38 L 30 70 L 38 62 L 46 70 L 46 -40" fill="#c8322b" stroke={t.tinta} strokeWidth={1.5} />
        </g>
      );
    case "pluma":
      // pluma y tintero: firmar un tratado, una ley, una constitución
      return (
        <g>
          <Forma tema={t} fill="#2a2624" d="M -62 56 L -62 10 Q -62 -2 -48 -2 L 6 -2 Q 20 -2 20 10 L 20 56 Z" brillo />
          <Forma tema={t} fill="#3a3632" rx={26} ry={7} cx={-21} cy={-2} grosor={0.6} />
          <Forma tema={t} fill="#f2ead6" x={-52} y={20} w={62} h={20} esq={3} grosor={0.5} />
          <g transform={`rotate(${28 + Math.sin(f * 0.15) * 3})`}>
            <Forma tema={t} fill="#f4efe3" d="M -8 0 Q 10 -50 44 -96 Q 56 -60 30 -24 Q 12 -6 -2 6 Z" />
            <path d="M -6 6 Q 18 -44 44 -96" stroke={tono("#f4efe3", -0.35)} strokeWidth={2.5} fill="none" />
            <path d="M -8 0 L -14 18" stroke={t.tinta} strokeWidth={3} strokeLinecap="round" />
          </g>
        </g>
      );
    case "billete":
      // un fajo de billetes (dinero, deuda, inflación)
      return (
        <g transform="rotate(-8)">
          {[10, 0].map((dy, i) => (
            <g key={i} transform={`translate(${i * -8}, ${dy})`}>
              <Forma tema={t} fill={i ? "#8fbf7a" : "#7fb06a"} x={-80} y={-36} w={160} h={72} esq={4} />
              <rect x={-70} y={-26} width={140} height={52} rx={3} fill="none" stroke={tono("#7fb06a", -0.35)} strokeWidth={2.5} />
              {i === 1 && <><Forma tema={t} fill="#a9cf96" cx={0} cy={0} r={20} grosor={0.6} /><path d="M -4 -10 Q 8 -12 8 -4 Q 8 2 0 2 Q -8 2 -8 8 Q -6 14 6 12 M 0 -16 L 0 18" stroke={tono("#7fb06a", -0.5)} strokeWidth={3} fill="none" strokeLinecap="round" /></>}
            </g>
          ))}
          <Forma tema={t} fill="#e8d8b0" x={-12} y={-44} w={24} h={88} grosor={0.6} />
        </g>
      );
    case "fuego": {
      // llamas que se mueven (incendios, ciudades que arden, guerras)
      const l = (k: number) => Math.sin(f * 0.35 + k) * 6;
      return (
        <g>
          <Forma tema={t} fill="#f08a24" d={`M -56 40 Q -66 0 -40 -26 Q -36 ${-6 + l(1)} -24 -8 Q -26 ${-56 + l(2)} 0 -84 Q 6 ${-46 + l(3)} 22 -34 Q 30 ${-60 + l(4)} 44 -46 Q 66 -10 56 40 Z`} />
          <Forma tema={t} fill="#f2c230" d={`M -32 40 Q -40 10 -20 -6 Q -14 ${8 + l(5)} -6 6 Q -6 ${-30 + l(6)} 8 -48 Q 16 ${-20 + l(2)} 26 -14 Q 40 10 32 40 Z`} grosor={0.7} />
          <Forma tema={t} fill="#fff1b8" d={`M -12 40 Q -16 22 -2 10 Q 6 ${-4 + l(3)} 12 10 Q 20 26 14 40 Z`} grosor={0.5} />
          <Forma tema={t} fill="#6b4425" d="M -60 36 L 60 46 L 58 56 L -62 46 Z" grosor={0.7} />
        </g>
      );
    }
    case "petroleo": {
      // torre de petróleo (el siglo XX, los países del petróleo)
      return (
        <g>
          <Forma tema={t} fill="#2a2624" d="M -60 50 Q -64 36 -40 34 L 40 34 Q 64 36 60 50 Z" />
          <path d="M -40 34 L -10 -96 L 10 -96 L 40 34" stroke="#6b6f75" strokeWidth={8} fill="none" strokeLinejoin="round" />
          {[-60, -22, 14].map((y, i) => { const w = 10 + ((y + 96) / 130) * 30; return <path key={i} d={`M ${-w} ${y} L ${w} ${y + 30} M ${w} ${y} L ${-w} ${y + 30}`} stroke="#6b6f75" strokeWidth={4} />; })}
          <Forma tema={t} fill="#c8322b" x={-14} y={-110} w={28} h={16} esq={3} grosor={0.7} />
          <Forma tema={t} fill="#2a2624" d={`M 52 34 Q 50 ${16 + Math.sin(f * 0.2) * 3} 58 4 Q 66 ${16 + Math.sin(f * 0.2) * 3} 64 34 Z`} grosor={0.6} />
        </g>
      );
    }
    case "oro":
      // pepitas de oro (fiebres del oro, minas, riqueza)
      return (
        <g>
          {[[-44, 22, 26], [-6, 26, 30], [34, 22, 24], [-24, -6, 24], [16, -8, 26], [-2, -32, 20]].map(([x, y, r], i) => (
            <Forma key={i} tema={t} fill={i % 2 ? "#f2c230" : "#e8b02a"} d={`M ${x - r} ${y} Q ${x - r} ${y - r * 0.8} ${x - r * 0.2} ${y - r * 0.9} Q ${x + r} ${y - r} ${x + r} ${y - r * 0.1} Q ${x + r * 0.9} ${y + r * 0.8} ${x} ${y + r * 0.7} Q ${x - r * 0.9} ${y + r * 0.8} ${x - r} ${y} Z`} brillo />
          ))}
          {[[-30, -40], [40, -30]].map(([x, y], i) => <path key={i} d={`M ${x} ${y - 10} L ${x} ${y + 10} M ${x - 10} ${y} L ${x + 10} ${y}`} stroke="#fff6c4" strokeWidth={4} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(f * 0.2 + i * 2)} />)}
        </g>
      );
    case "cadenas":
      // cadenas rotas (esclavitud y libertad, revoluciones): dos trozos de cadena y la rotura en medio
      return (
        <g>
          {[-1, 1].map((l) => (
            <g key={l} transform={`translate(${l * 14}, ${l * 6}) rotate(${l * 8})`}>
              {[0, 1, 2, 3].map((k) => {
                const x = l * (20 + k * 24);
                return k % 2 === 0
                  ? <g key={k}><ellipse cx={x} cy={0} rx={18} ry={12} fill="none" stroke={t.tinta} strokeWidth={13} /><ellipse cx={x} cy={0} rx={18} ry={12} fill="none" stroke="#9aa1ab" strokeWidth={7} /></g>
                  : <g key={k}><rect x={x - 17} y={-5} width={34} height={10} rx={5} fill="#7a7f87" stroke={t.tinta} strokeWidth={2.5} /></g>;
              })}
            </g>
          ))}
          {[[-6, -26, -2, -44], [6, 22, 2, 40], [-10, 4, -28, 10], [10, -4, 28, -10]].map(([a, b, c, d], i) => <path key={i} d={`M ${a} ${b} L ${c} ${d}`} stroke="#f2c230" strokeWidth={5} strokeLinecap="round" />)}
        </g>
      );
    case "balanza": {
      // la balanza (justicia, leyes, comercio)
      const g = Math.sin(f * 0.08) * 6;
      return (
        <g>
          <Linea tema={t} pts={[[0, 60], [0, -70]]} color="#c9963a" ancho={Math.max(6, t.palito)} />
          <Forma tema={t} fill="#c9963a" d="M -40 64 L 40 64 L 30 50 L -30 50 Z" grosor={0.8} />
          <g transform={`rotate(${g * 0.6}, 0, -60)`}>
            <path d="M -76 -60 L 76 -60" stroke="#c9963a" strokeWidth={7} strokeLinecap="round" />
          </g>
          {[-1, 1].map((l) => { const x = l * 76 * Math.cos((g * 0.6 * Math.PI) / 180), y = -60 + l * 76 * Math.sin((g * 0.6 * Math.PI) / 180); return (
            <g key={l}>
              <path d={`M ${x} ${y} L ${x - 24} ${y + 50} M ${x} ${y} L ${x + 24} ${y + 50}`} stroke={t.tinta} strokeWidth={2} />
              <Forma tema={t} fill="#e0b24a" d={`M ${x - 30} ${y + 50} Q ${x} ${y + 72} ${x + 30} ${y + 50} Z`} brillo />
            </g>
          ); })}
          <circle cx={0} cy={-72} r={8} fill="#e8b74a" stroke={t.tinta} strokeWidth={2} />
        </g>
      );
    }
    case "reloj": {
      // reloj de bolsillo (el tiempo se acaba, fechas límite)
      const a = f * 3;
      return (
        <g>
          <Forma tema={t} fill="#c9963a" x={-10} y={-80} w={20} h={16} esq={4} grosor={0.7} />
          <ellipse cx={0} cy={-88} rx={12} ry={8} fill="none" stroke="#c9963a" strokeWidth={5} />
          <Forma tema={t} fill="#d9a83a" cx={0} cy={0} r={66} brillo />
          <Forma tema={t} fill="#f7f4ec" cx={0} cy={0} r={54} grosor={0.7} />
          {Array.from({ length: 12 }).map((_, i) => { const an = (i / 12) * Math.PI * 2; return <path key={i} d={`M ${Math.sin(an) * 44} ${-Math.cos(an) * 44} L ${Math.sin(an) * 50} ${-Math.cos(an) * 50}`} stroke={t.tinta} strokeWidth={i % 3 ? 2 : 4} />; })}
          <path d={`M 0 0 L ${Math.sin((a / 12) * Math.PI / 180) * 28} ${-Math.cos((a / 12) * Math.PI / 180) * 28}`} stroke={t.tinta} strokeWidth={6} strokeLinecap="round" />
          <path d={`M 0 0 L ${Math.sin((a * Math.PI) / 180) * 42} ${-Math.cos((a * Math.PI) / 180) * 42}`} stroke={t.acento} strokeWidth={4} strokeLinecap="round" />
          <circle cx={0} cy={0} r={5} fill={t.tinta} />
        </g>
      );
    }
    case "bebe":
      // un bebé en pañales (un heredero que nace, un niño abandonado)
      return (
        <g transform={`rotate(${Math.sin(f * 0.08) * 3})`}>
          <Forma tema={t} fill="#f4efe3" d="M -62 10 Q -64 -26 -30 -30 L 40 -24 Q 66 -18 64 8 Q 62 32 34 34 L -34 34 Q -60 30 -62 10 Z" />
          <path d="M -20 -26 Q -10 4 -24 32 M 10 -24 Q 22 4 8 34" stroke={tono("#f4efe3", -0.25)} strokeWidth={3} fill="none" />
          <Forma tema={t} fill={t.piel} cx={-58} cy={-6} r={30} brillo />
          <circle cx={-66} cy={-10} r={3.5} fill={t.tinta} />
          <circle cx={-50} cy={-10} r={3.5} fill={t.tinta} />
          <path d="M -64 4 Q -58 9 -52 4" stroke={t.tinta} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </g>
      );
    case "cesta":
      // una cesta de mimbre con un bebé dentro (Rómulo y Remo en el río, Moisés)
      return (
        <g>
          <g transform="translate(6, -26) scale(0.8)"><Cosa id="bebe" tema={t} f={f} /></g>
          <Forma tema={t} fill="#c9944f" d="M -84 -12 L 84 -12 Q 80 42 52 50 L -52 50 Q -80 42 -84 -12 Z" />
          {[-60, -30, 0, 30, 60].map((x) => <path key={x} d={`M ${x} -10 Q ${x + 4} 20 ${x * 0.8} 48`} stroke={tono("#c9944f", -0.3)} strokeWidth={3} fill="none" />)}
          <path d="M -80 8 Q 0 18 80 8 M -72 30 Q 0 40 72 30" stroke={tono("#c9944f", -0.3)} strokeWidth={3} fill="none" />
          <Forma tema={t} fill={tono("#c9944f", 0.12)} x={-90} y={-20} w={180} h={14} esq={7} grosor={0.7} />
        </g>
      );
    case "cupula":
      // la Cúpula de la Roca (Jerusalén, 691): octógono de azulejos azules y cúpula de oro sobre un tambor
      return (
        <g transform="scale(0.9)">
          <Forma tema={t} fill="#d8cdb4" x={-112} y={44} w={224} h={14} esq={2} grosor={0.7} />
          <Forma tema={t} fill="#2f6fb0" x={-100} y={-6} w={200} h={52} grosor={0.9} />
          {[-80, -50, -20, 10, 40, 70].map((x) => <path key={x} d={`M ${x} 40 L ${x} 12 Q ${x + 9} 0 ${x + 18} 12 L ${x + 18} 40`} fill="#1d3f6e" stroke={tono("#2f6fb0", 0.5)} strokeWidth={2} />)}
          <path d="M -100 4 L 100 4" stroke="#e8e2cf" strokeWidth={3} />
          <Forma tema={t} fill="#2a5f99" x={-52} y={-26} w={104} h={22} grosor={0.7} />
          <Forma tema={t} fill="#f2c230" d="M -56 -24 Q -58 -96 0 -104 Q 58 -96 56 -24 Z" brillo />
          <path d="M -30 -40 Q -26 -84 0 -96" stroke={tono("#f2c230", 0.45)} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Linea tema={t} pts={[[0, -104], [0, -128]]} color="#c99a1a" ancho={4} />
          <path d="M -8 -132 A 9 9 0 1 0 6 -122" stroke="#c99a1a" strokeWidth={4} fill="none" />
        </g>
      );
    case "arca":
      // el Arca de la Alianza: cofre de oro con dos querubines alados encima y las varas para llevarla
      return (
        <g transform="scale(0.9)">
          <Linea tema={t} pts={[[-120, 18], [120, 18]]} color="#a07a2a" ancho={8} />
          <Forma tema={t} fill="#e2b33a" x={-80} y={-20} w={160} h={76} esq={3} brillo />
          <path d="M -80 0 L 80 0 M -80 38 L 80 38" stroke={tono("#e2b33a", -0.3)} strokeWidth={3} />
          {[-1, 1].map((l) => <g key={l}><Forma tema={t} fill="#f2c94c" d={`M ${l * 14} -22 Q ${l * 30} -50 ${l * 26} -62 L ${l * 38} -62 Q ${l * 44} -40 ${l * 38} -22 Z`} grosor={0.7} />
            <Forma tema={t} fill="#f6d77a" d={`M ${l * 30} -56 Q ${l * 80} -92 ${l * 4} -96 Q ${l * 40} -80 ${l * 30} -56 Z`} grosor={0.7} /></g>)}
          <Forma tema={t} fill="#f2c94c" x={-84} y={-28} w={168} h={10} esq={3} grosor={0.7} />
        </g>
      );
    case "tablilla":
      // tablilla de arcilla con escritura cuneiforme (las cartas de Amarna, las crónicas asirias)
      return (
        <g transform="rotate(-6)">
          <Forma tema={t} fill="#c79a68" x={-58} y={-76} w={116} h={152} esq={16} />
          {[-56, -36, -16, 4, 24, 44].map((y, i) => <g key={y}>{[-38, -22, -6, 10, 26].map((x, j) => (i + j) % 4 === 3 ? null : <path key={x} d={`M ${x} ${y} l 8 3 l -8 3 M ${x + 8} ${y + 3} l 6 0`} stroke={tono("#c79a68", -0.45)} strokeWidth={2.5} fill="none" />)}</g>)}
        </g>
      );
    case "menora":
      // la menorá, el candelabro de siete brazos del Templo
      return (
        <g>
          <Forma tema={t} fill="#e2b33a" d="M -40 60 L 40 60 L 26 44 L -26 44 Z" grosor={0.8} />
          <Linea tema={t} pts={[[0, 44], [0, -50]]} color="#d9a92c" ancho={9} />
          {[30, 60, 90].map((r) => <path key={r} d={`M ${-r} -50 Q ${-r} ${-50 + r * 1.05} 0 ${-50 + r * 1.05} Q ${r} ${-50 + r * 1.05} ${r} -50`} stroke="#d9a92c" strokeWidth={8} fill="none" strokeLinecap="round" />)}
          {[-90, -60, -30, 0, 30, 60, 90].map((x) => <g key={x}><Forma tema={t} fill="#e2b33a" x={x - 8} y={-58} w={16} h={10} esq={2} grosor={0.6} /><path d={`M ${x} -60 Q ${x - 6} -72 ${x} -82 Q ${x + 6} -72 ${x} -60 Z`} fill="#f08a24" /></g>)}
        </g>
      );
    case "muro":
      // el Muro Occidental: sillares enormes de piedra clara con matas que salen de las juntas
      return (
        <g transform="scale(0.85)">
          <Forma tema={t} fill="#e2d3a8" x={-120} y={-80} w={240} h={140} esq={2} />
          {[[-120, -80, 90], [-30, -80, 150], [-120, -40, 140], [20, -40, 100], [-120, 0, 70], [-50, 0, 120], [70, 0, 50], [-120, 30, 110], [-10, 30, 130]].map(([x, y, w], i) => (
            <rect key={i} x={x + 2} y={y + 2} width={w - 4} height={(y === 30 ? 30 : y === 0 ? 30 : 40) - 4} rx={3} fill={i % 3 ? tono("#e2d3a8", -0.06) : tono("#e2d3a8", 0.05)} stroke={tono("#e2d3a8", -0.35)} strokeWidth={2.5} />))}
          {[[-34, -40], [60, 0], [-112, 30]].map(([x, y], i) => <path key={i} d={`M ${x} ${y} q -10 -16 -4 -24 M ${x} ${y} q 6 -18 14 -20 M ${x} ${y} q 0 -14 2 -26`} stroke="#5f8f3e" strokeWidth={4} fill="none" strokeLinecap="round" />)}
        </g>
      );
    case "te":
      // una tetera de porcelana azul y blanca y una caja de té (la Compañía, Boston, China)
      return (
        <g>
          <Forma tema={t} fill="#9b6a3a" x={-118} y={-6} w={92} h={66} esq={3} />
          <path d="M -118 14 L -26 14 M -72 -6 L -72 60" stroke={tono("#9b6a3a", -0.35)} strokeWidth={3} />
          <Texto tema={t} x={-72} y={46} t="TÉ" tam={22} color="#f3e6c8" />
          <Forma tema={t} fill="#f4f1ea" d="M 4 58 Q -26 50 -24 14 Q -22 -26 30 -30 Q 82 -26 84 14 Q 86 50 56 58 Z" brillo />
          <Forma tema={t} fill="#f4f1ea" d="M 84 4 Q 120 -10 126 -40 L 134 -36 Q 128 2 88 26 Z" grosor={0.7} />
          <path d="M -22 4 Q -52 6 -50 26 Q -48 44 -18 40" stroke={t.tinta} strokeWidth={Math.max(5, t.palito)} fill="none" strokeLinecap="round" />
          <Forma tema={t} fill="#f4f1ea" rx={30} ry={8} cx={30} cy={-30} grosor={0.7} />
          <Forma tema={t} fill="#2f5fa8" cx={30} cy={-42} r={9} grosor={0.6} />
          <path d="M -8 10 Q 8 -2 30 8 Q 52 18 70 6 M -6 30 Q 14 22 30 32 Q 48 40 70 28" stroke="#2f5fa8" strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      );
    case "patata":
      // tres patatas, una con manchas negras del hongo (la Gran Hambruna de Irlanda)
      return (
        <g>
          {[[-46, 20, 44, 32, "#c9a46a"], [40, 24, 40, 30, "#c69e62"], [-2, -14, 46, 34, "#7d6a4a"]].map(([x, y, rx, ry, c], i) => (
            <g key={i}>
              <Forma tema={t} fill={c as string} rx={rx as number} ry={ry as number} cx={x as number} cy={y as number} />
              {[[-12, -6], [10, 4], [-2, 12]].map(([a, b], j) => <circle key={j} cx={(x as number) + a} cy={(y as number) + b} r={3} fill={tono(c as string, -0.4)} />)}
            </g>
          ))}
          {[[-14, -24, 9], [8, -8, 11], [-22, -4, 7], [18, -22, 6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#2b2620" opacity={0.85} />)}
        </g>
      );
    case "diamante":
      // un diamante tallado que brilla (Kimberley, De Beers, Cecil Rhodes)
      return (
        <g>
          <Forma tema={t} fill="#cfefff" d="M -70 -24 L -40 -60 L 40 -60 L 70 -24 L 0 66 Z" brillo />
          <path d="M -70 -24 L 70 -24 M -40 -60 L -20 -24 L 0 66 L 20 -24 L 40 -60 M -20 -24 L 0 -60 L 20 -24" stroke={tono("#9fd6f0", -0.35)} strokeWidth={3} fill="none" strokeLinejoin="round" />
          {[[86, -64], [-88, 2], [60, 40]].map(([x, y], i) => <path key={i} d={`M ${x} ${y - 14} L ${x + 4} ${y - 4} L ${x + 14} ${y} L ${x + 4} ${y + 4} L ${x} ${y + 14} L ${x - 4} ${y + 4} L ${x - 14} ${y} L ${x - 4} ${y - 4} Z`} fill="#fff6b0" opacity={0.6 + 0.4 * Math.abs(Math.sin(f * 0.15 + i))} />)}
        </g>
      );
    case "tanque": {
      // tanque de la Segunda Guerra Mundial: orugas que ruedan, casco y torreta con cañón
      const g = (f * 2) % 20;
      return (
        <g>
          <Forma tema={t} fill="#3a3d36" d="M -110 30 Q -124 30 -124 46 Q -124 62 -108 62 L 108 62 Q 124 62 124 46 Q 124 30 110 30 Z" />
          {[-96, -64, -32, 0, 32, 64, 96].map((x) => <circle key={x} cx={x} cy={46} r={12} fill="#6b6f66" stroke={t.tinta} strokeWidth={1.8} />)}
          {Array.from({ length: 13 }, (_, i) => -120 + i * 20 + g).filter((x) => x < 120).map((x) => <path key={x} d={`M ${x} 30 l 0 -4`} stroke={t.tinta} strokeWidth={2} />)}
          <Forma tema={t} fill="#6f7a4a" d="M -116 30 L -96 -2 L 100 -2 L 120 30 Z" brillo />
          <Forma tema={t} fill="#7a8552" d="M -50 -2 L -40 -40 Q -36 -48 -26 -48 L 34 -48 Q 46 -48 50 -38 L 58 -2 Z" brillo />
          <Linea tema={t} pts={[[50, -28], [148, -32]]} color="#4f5636" ancho={11} />
          <Forma tema={t} fill="#4f5636" x={-14} y={-60} w={26} h={14} esq={4} grosor={0.7} />
        </g>
      );
    }
    case "avion": {
      // avión de hélice de la Segunda Guerra Mundial, de lado, con la hélice que gira
      const h = Math.abs(Math.sin(f * 1.3));
      return (
        <g>
          <Forma tema={t} fill="#8f969e" d="M -120 -6 Q -120 -18 -100 -18 L 80 -16 Q 112 -14 116 0 Q 112 14 80 16 L -100 14 Q -120 12 -120 -6 Z" brillo />
          <Forma tema={t} fill="#7a8088" d="M -112 -14 L -132 -54 L -104 -54 L -84 -16 Z" grosor={0.8} />
          <Forma tema={t} fill="#7a8088" d="M -20 2 L -54 46 L 6 46 L 30 4 Z" grosor={0.8} />
          <Forma tema={t} fill="#cfe7f5" d="M 20 -16 Q 34 -36 58 -16 Z" grosor={0.7} />
          <Forma tema={t} fill="#4f5560" x={112} y={-8} w={12} h={16} esq={3} grosor={0.6} />
          <ellipse cx={126} cy={0} rx={5} ry={6 + 36 * h} fill="#3a3530" opacity={0.75} />
        </g>
      );
    }
    case "acorazado": {
      // acorazado gris con torretas y chimenea (Pearl Harbor, el Missouri)
      const ola = Math.sin(f * 0.12) * 3;
      return (
        <g transform={`scale(0.8) translate(0, ${ola})`}>
          {[0, 1].map((k) => { const c = ((f * 0.6 + k * 30) % 72); return <circle key={k} cx={6 - c * 0.8} cy={-86 - c * 0.5} r={9 + c * 0.2} fill="#8a8f96" opacity={Math.max(0, 0.7 - c / 90)} />; })}
          <Forma tema={t} fill="#7d848c" d="M -150 -10 L 150 -10 L 128 22 L -132 22 Z" brillo />
          <Forma tema={t} fill="#8f969e" x={-40} y={-44} w={80} h={34} esq={3} />
          <Forma tema={t} fill="#8f969e" x={-14} y={-74} w={30} h={30} esq={3} />
          <Forma tema={t} fill="#5a6068" x={-6} y={-90} w={20} h={18} esq={2} grosor={0.7} />
          {[-110, -76, 70, 104].map((x, i) => <g key={x}><Forma tema={t} fill="#6b7178" x={x - 14} y={-24} w={28} h={14} esq={5} grosor={0.7} /><Linea tema={t} pts={[[x + (i < 2 ? -10 : 10), -18], [x + (i < 2 ? -44 : 44), -22]]} color="#4f555c" ancho={5} /></g>)}
          <path d="M -150 -10 L 150 -10" stroke="#c8322b" strokeWidth={0} />
        </g>
      );
    }
    case "portaaviones": {
      // portaaviones: cubierta plana con la isla a un lado y aviones encima (Midway, Pearl Harbor)
      const ola = Math.sin(f * 0.12) * 3;
      return (
        <g transform={`scale(0.8) translate(0, ${ola})`}>
          <Forma tema={t} fill="#6b7178" d="M -140 -4 L 140 -4 L 120 26 L -126 26 Z" brillo />
          <Forma tema={t} fill="#9a8f78" d="M -160 -16 L 160 -16 L 156 -4 L -156 -4 Z" />
          <path d="M -150 -10 L 150 -10" stroke="#f4efe3" strokeWidth={2} strokeDasharray="14 10" />
          <Forma tema={t} fill="#7d848c" x={60} y={-60} w={34} h={44} esq={3} />
          <Forma tema={t} fill="#5a6068" x={68} y={-80} w={18} h={20} esq={2} grosor={0.7} />
          {[-110, -60].map((x) => <g key={x} transform={`translate(${x}, -24) scale(0.32)`}><Forma tema={t} fill="#8f969e" d="M -120 -6 Q -120 -18 -100 -18 L 80 -16 Q 112 -14 116 0 Q 112 14 80 16 L -100 14 Q -120 12 -120 -6 Z" /></g>)}
        </g>
      );
    }
    case "submarino": {
      // submarino (los de Versalles, prohibidos)
      const ola = Math.sin(f * 0.12) * 2;
      return (
        <g transform={`translate(0, ${ola})`}>
          <Forma tema={t} fill="#5a6068" d="M -130 0 Q -130 -26 -96 -26 L 100 -26 Q 136 -22 136 0 Q 136 22 100 26 L -96 26 Q -130 26 -130 0 Z" brillo />
          <Forma tema={t} fill="#6b7178" d="M -24 -26 L -18 -62 L 28 -62 L 36 -26 Z" />
          <Linea tema={t} pts={[[10, -62], [10, -92], [24, -92]]} color="#3a3d45" ancho={5} />
          {[-80, -50, 50, 80].map((x) => <circle key={x} cx={x} cy={0} r={6} fill="#3a3d45" />)}
          <Forma tema={t} fill="#4f555c" d="M -130 0 L -150 -18 L -150 18 Z" grosor={0.7} />
        </g>
      );
    }
    case "radar": {
      // torre de radar de la costa inglesa (Chain Home) con ondas que salen
      const k = (f % 45) / 45;
      return (
        <g>
          <Linea tema={t} pts={[[-40, 80], [0, -100], [40, 80]]} color="#7a8088" ancho={7} />
          {[-40, 0, 40].map((y, i) => <path key={i} d={`M ${-34 + i * 9} ${y + 40} L ${34 - i * 9} ${y + 40}`} stroke="#7a8088" strokeWidth={4} />)}
          <path d="M -30 -60 L 30 -60 M -24 -36 L 24 -36" stroke="#7a8088" strokeWidth={4} />
          {[0, 0.33, 0.66].map((d) => { const u = (k + d) % 1; return <path key={d} d={`M ${20 + u * 70} ${-90 - u * 30} Q ${40 + u * 100} ${-60} ${20 + u * 70} ${-30 + u * 30}`} stroke="#5fb0d8" strokeWidth={5} fill="none" opacity={1 - u} strokeLinecap="round" />; })}
        </g>
      );
    }
    case "ametralladora":
      // la ametralladora Maxim sobre su trípode (Omdurmán, 1898)
      return (
        <g>
          <Linea tema={t} pts={[[-10, 14], [-70, 70]]} color="#4a4540" ancho={8} />
          <Linea tema={t} pts={[[-10, 14], [50, 70]]} color="#4a4540" ancho={8} />
          <Linea tema={t} pts={[[-10, 14], [-10, 74]]} color="#3a3530" ancho={8} />
          <Forma tema={t} fill="#5f5a52" x={-70} y={-30} w={110} h={42} esq={8} brillo />
          {[-56, -42, -28, -14, 0, 14, 28].map((x) => <path key={x} d={`M ${x} -30 L ${x} 12`} stroke={tono("#5f5a52", -0.3)} strokeWidth={3} />)}
          <Linea tema={t} pts={[[40, -10], [128, -12]]} color="#3a3530" ancho={9} />
          <Forma tema={t} fill="#c9963a" x={-46} y={12} w={30} h={34} esq={3} grosor={0.7} />
          <Linea tema={t} pts={[[-70, -6], [-100, 8]]} color="#3a3530" ancho={7} />
        </g>
      );
    case "azucar":
      // cañas de azúcar atadas y un pan de azúcar (el Caribe, Barbados, Jamaica)
      return (
        <g>
          {[-34, -14, 6, 26].map((x, i) => <g key={x}><Linea tema={t} pts={[[x, 70], [x + (i - 1.5) * 6, -60]]} color="#9bb04a" ancho={11} />
            {[30, -6, -40].map((y) => <path key={y} d={`M ${x - 7 + (i - 1.5) * (70 - y) / 22} ${y} l 14 0`} stroke="#6d7d2e" strokeWidth={3} />)}
            <Forma tema={t} fill="#5f9a3a" d={`M ${x + (i - 1.5) * 6} -60 Q ${x + (i - 1.5) * 16 + 30} -96 ${x + (i - 1.5) * 20 + 44} -86 Q ${x + 18} -78 ${x + (i - 1.5) * 6} -60 Z`} grosor={0.6} /></g>)}
          <path d="M -44 22 L 36 22" stroke="#8a5a34" strokeWidth={7} strokeLinecap="round" />
          <Forma tema={t} fill="#f6f2e8" d="M 60 70 L 84 -6 Q 92 -18 100 -6 L 124 70 Z" brillo />
          <Forma tema={t} fill="#2f5fa8" d="M 60 70 L 124 70 L 120 54 L 64 54 Z" grosor={0.6} />
        </g>
      );
    case "tabaco":
      // hojas de tabaco secándose, colgadas de una vara (Virginia, John Rolfe)
      return (
        <g>
          <Linea tema={t} pts={[[-100, -60], [100, -60]]} color="#7a5230" ancho={8} />
          {[-66, -22, 22, 66].map((x, i) => <Forma key={x} tema={t} fill={i % 2 ? "#a8823e" : "#8f6a2e"} d={`M ${x} -58 Q ${x + 30} -10 ${x + 4} 66 Q ${x - 30} 10 ${x} -58 Z`} />)}
          {[-66, -22, 22, 66].map((x) => <path key={x} d={`M ${x} -58 Q ${x + 6} 0 ${x + 4} 62`} stroke="#6b4a1e" strokeWidth={3} fill="none" />)}
        </g>
      );
    case "bicicleta":
      // una bicicleta de soldado (los japoneses bajando por Malasia, 1941-42)
      return (
        <g>
          {[-62, 62].map((x) => <g key={x}><circle cx={x} cy={22} r={42} fill="none" stroke={t.tinta} strokeWidth={Math.max(6, t.palito)} />
            {[0, 1, 2, 3].map((i) => <path key={i} d={`M ${x} 22 L ${x + Math.cos(i * Math.PI / 4 + f * 0.1) * 40} ${22 + Math.sin(i * Math.PI / 4 + f * 0.1) * 40} M ${x} 22 L ${x - Math.cos(i * Math.PI / 4 + f * 0.1) * 40} ${22 - Math.sin(i * Math.PI / 4 + f * 0.1) * 40}`} stroke={tono("#777777", 0.2)} strokeWidth={2} />)}</g>)}
          <path d="M -62 22 L -14 -30 L 40 -30 L 0 22 Z M 40 -30 L 62 22 M 52 -50 L 40 -30 M -14 -30 L -22 -44" stroke="#5a6b3a" strokeWidth={8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Forma tema={t} fill="#3a3530" x={-38} y={-50} w={34} h={10} esq={5} grosor={0.6} />
          <path d="M 42 -54 L 66 -50" stroke={t.tinta} strokeWidth={7} strokeLinecap="round" />
        </g>
      );
    case "amapola":
      // la adormidera del opio: flor roja y la cápsula rayada de la que sale (Bengala → China)
      return (
        <g>
          <Linea tema={t} pts={[[-30, 70], [-34, -10]]} color="#5f8f3e" ancho={6} />
          <Linea tema={t} pts={[[34, 70], [30, -20]]} color="#5f8f3e" ancho={6} />
          {[0, 72, 144, 216, 288].map((a) => <Forma key={a} tema={t} fill="#d8342b" rx={22} ry={30} cx={-34 + Math.cos(a * Math.PI / 180) * 22} cy={-30 + Math.sin(a * Math.PI / 180) * 22} grosor={0.6} />)}
          <circle cx={-34} cy={-30} r={11} fill="#2b2620" />
          <Forma tema={t} fill="#9db070" rx={24} ry={30} cx={30} cy={-46} brillo />
          <path d="M 18 -60 L 20 -28 M 30 -66 L 30 -24 M 42 -60 L 40 -28" stroke="#6d7d4e" strokeWidth={3} />
          <Forma tema={t} fill="#7d8f52" x={14} y={-82} w={32} h={10} esq={4} grosor={0.6} />
        </g>
      );
    default:
      return <Texto tema={t} x={0} y={10} t={`¿${id}?`} tam={40} color={t.acento} />;
  }
};

/** Un caballo de lado, mirando a la derecha (mira = -1, a la izquierda). El origen está entre los cascos, en el suelo;
 *  mide unos 300 de largo y su lomo queda a ALTO_LOMO. «paso» mueve las patas (el muñeco que camina montado). */
export const ALTO_LOMO = 200;
export const Caballo: React.FC<{ tema: Tema; f?: number; paso?: boolean; color?: string; mira?: number }> = ({ tema: t, f = 0, paso = false, color = "#9a6a3c", mira = 1 }) => {
  const crin = tono(color, -0.45);
  const pata = (x: number, fase: number, delante: boolean) => {
    const g = paso ? Math.sin(f * 0.35 + fase) * 16 : 0;
    return <Linea key={`${x}${fase}`} tema={t} pts={[[x, -120], [x + g * 0.5, -60], [x + g, 0]]} color={delante ? color : tono(color, -0.2)} ancho={Math.max(9, t.palito * 1.2)} />;
  };
  return (
    <g transform={`scale(${mira}, 1) translate(0, ${paso ? Math.abs(Math.sin(f * 0.35)) * -4 : 0})`}>
      {pata(-90, Math.PI, false)}{pata(80, 0, false)}
      <Forma tema={t} fill={crin} d={`M -132 -150 Q -170 -110 -160 -60 Q -150 -100 -128 -128 Z`} grosor={0.7} />
      <Forma tema={t} fill={color} rx={140} ry={58} cx={-8} cy={-150} />
      <Forma tema={t} fill={color} d={`M 92 -180 Q 112 -250 150 -268 L 178 -262 Q 190 -230 166 -214 Q 140 -200 128 -150 Z`} />
      <Forma tema={t} fill={color} d={`M 148 -270 Q 196 -262 206 -232 Q 208 -216 190 -214 Q 168 -214 156 -228 Z`} />
      <Forma tema={t} fill={crin} d={`M 96 -186 Q 112 -246 146 -270 L 140 -282 Q 100 -262 84 -196 Z`} grosor={0.7} />
      <path d={`M 150 -274 l 6 -18 l 8 16`} stroke={t.tinta} strokeWidth={4} fill={color} strokeLinejoin="round" />
      <circle cx={176} cy={-246} r={5} fill={t.tinta} />
      {pata(-60, 0, true)}{pata(104, Math.PI, true)}
      <Forma tema={t} fill="#7a1f2b" d={`M -40 -206 Q 0 -216 40 -206 L 44 -170 Q 0 -160 -44 -170 Z`} grosor={0.7} />
    </g>
  );
};
