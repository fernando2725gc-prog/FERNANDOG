// Un país como personaje (la referencia lo hace con Holanda: el territorio con ojos, boca, brazos y piernas de palito, que
// llora en un charco). Lee la forma de un territorio de un mapa ya preparado (public/mapas/<mapa>/mapa.json, la capa
// <capa>) y la convierte en un muñeco de «alto» píxeles con el origen en los pies. Se queda con el trozo grande del
// territorio y los que están pegados a él (las islas lejanas se quitan, para que se lea la silueta).
import React, { useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { Boca, Ojos } from "./Persona";
import { Linea, tono } from "./forma";
import { Tema } from "./tema";

type Datos = { capas: Record<string, { d: string }> };
const CACHE = new Map<string, Datos>();
const useDatos = (mapa: string): Datos | null => {
  const [datos, setDatos] = useState<Datos | null>(CACHE.get(mapa) ?? null);
  const [espera] = useState(() => (CACHE.has(mapa) ? null : delayRender(`país ${mapa}`, { timeoutInMilliseconds: 60000 })));
  useEffect(() => {
    if (datos) return;
    fetch(staticFile(`mapas/${mapa}/mapa.json`))
      .then((r) => r.json())
      .then((j: Datos) => { CACHE.set(mapa, j); setDatos(j); if (espera !== null) continueRender(espera); })
      .catch((e) => cancelRender(e));
  }, [datos, espera, mapa]);
  return datos;
};

type P = [number, number];
type Anillo = { pts: P[]; area: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number };

/** Parte el «d» del mapa (M…L…Z, coordenadas absolutas) en anillos con su área, su caja y su centro. */
const anillos = (d: string): Anillo[] =>
  d.split(/(?=M)/).map((tramo) => {
    const nums = (tramo.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const pts: P[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [xa, ya] = pts[i], [xb, yb] = pts[(i + 1) % pts.length];
      const c = xa * yb - xb * ya;
      a += c; cx += (xa + xb) * c; cy += (ya + yb) * c;
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const area = Math.abs(a / 2);
    return { pts, area, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
      cx: a ? cx / (3 * a) : xs.reduce((s, v) => s + v, 0) / xs.length, cy: a ? cy / (3 * a) : ys.reduce((s, v) => s + v, 0) / ys.length };
  }).filter((r) => r.pts.length >= 3);

/** La silueta lista para dibujar: el anillo grande y los pegados, escalados a la caja del cuerpo. */
const silueta = (d: string, altoCuerpo: number, anchoMax: number) => {
  const rs = anillos(d);
  if (!rs.length) return null;
  const main = rs.reduce((a, b) => (b.area > a.area ? b : a));
  const mw = main.x1 - main.x0, mh = main.y1 - main.y0;
  const dentro = (r: Anillo) => r === main || r.area > main.area * 0.15 ||
    (r.cx > main.x0 - mw * 0.12 && r.cx < main.x1 + mw * 0.12 && r.cy > main.y0 - mh * 0.12 && r.cy < main.y1 + mh * 0.12 && r.area > main.area * 0.002);
  const quedan = rs.filter(dentro);
  const x0 = Math.min(...quedan.map((r) => r.x0)), x1 = Math.max(...quedan.map((r) => r.x1));
  const y0 = Math.min(...quedan.map((r) => r.y0)), y1 = Math.max(...quedan.map((r) => r.y1));
  const k = Math.min(altoCuerpo / (y1 - y0), anchoMax / (x1 - x0));
  const w = (x1 - x0) * k, h = (y1 - y0) * k;
  const tx = (x: number) => (x - x0) * k - w / 2;
  const ty = (y: number) => (y - y1) * k; // el borde de abajo del cuerpo en y = 0
  const trazos = quedan.map((r) => {
    const out: P[] = [];
    for (const [x, y] of r.pts) {
      const q: P = [tx(x), ty(y)];
      const u = out[out.length - 1];
      if (!u || Math.hypot(q[0] - u[0], q[1] - u[1]) > 1.6) out.push(q);
    }
    return out;
  });
  const dd = trazos.map((t) => "M" + t.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z").join("");
  const todos = trazos.flat();
  // dónde va la cara: el punto de dentro con más sitio alrededor (en un imperio con un mar en medio, el centro cae en
  // el agua), con un poco de preferencia por arriba
  const dentroDe = (x: number, y: number) => {
    let c = false;
    for (const t of trazos) for (let i = 0, j = t.length - 1; i < t.length; j = i++) {
      const [xi, yi] = t[i], [xj, yj] = t[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const borde = todos.filter((_, i) => i % Math.max(1, Math.floor(todos.length / 600)) === 0);
  let mejor = { x: tx(main.cx), y: ty(main.cy), sitio: 0 };
  for (let gx = 1; gx < 24; gx++) for (let gy = 1; gy < 24; gy++) {
    const x = -w / 2 + (w * gx) / 24, y = -h + (h * gy) / 24;
    if (!dentroDe(x, y)) continue;
    let dmin = Infinity;
    for (const [bx, by] of borde) dmin = Math.min(dmin, Math.hypot(bx - x, by - y));
    const puntos = dmin * (1.15 - (0.3 * gy) / 24);
    if (puntos > mejor.sitio) mejor = { x, y, sitio: puntos };
  }
  return { d: dd, w, h, cx: mejor.x, cy: mejor.y, sitio: mejor.sitio, pts: todos };
};

export const Pais: React.FC<{
  tema: Tema; mapa: string; capa: string; color?: string; frame: number; habla?: boolean; ojos?: Ojos; boca?: Boca;
  alto?: number; mira?: number; pose?: "normal" | "triste" | "contento" | "susto";
}> = ({ tema, mapa, capa, color = "#f08a24", frame, habla, ojos, boca, alto = 380, mira = 0, pose = "normal" }) => {
  const datos = useDatos(mapa);
  const d = datos?.capas[capa]?.d;
  const sil = useMemo(() => (d ? silueta(d, alto * 0.7, alto * 1.25) : null), [d, alto]);
  if (!sil) return null;

  const tinta = tema.tinta;
  const piernas = alto * 0.3;
  const { w, h, cx, cy, pts, sitio } = sil;
  // la cara, donde hay más sitio dentro del territorio; los ojos, del tamaño que quepa
  const fx = cx, fy = cy - Math.min(sitio * 0.3, h * 0.1);
  const r = Math.max(15, Math.min(34, sitio * 0.42));
  const sep = Math.max(r * 1.2, Math.min(sitio * 0.75, r * 1.9));
  // dónde salen brazos y piernas: el borde del territorio a la altura de la cara y por abajo, cerca del centro
  // el brazo sale del borde de fuera del territorio, justo a la altura del hombro (una franja estrecha: si es ancha,
  // coge el borde de otra altura y el brazo sale del aire)
  const yHombro = fy + r * 1.6;
  const borde = (lado: number) => {
    const cerca = pts.filter(([x, y]) => Math.abs(y - yHombro) < Math.max(5, h * 0.025) && (lado < 0 ? x < fx : x > fx));
    if (!cerca.length) return fx + lado * (sep + r * 1.4);
    const xs = cerca.map(([x]) => x);
    return lado < 0 ? Math.min(...xs) : Math.max(...xs);
  };
  // las piernas salen de la parte más baja del territorio (el cuarto de abajo), repartidas a lo ancho de ella
  const bajos = pts.filter(([, y]) => y > -h * 0.25);
  const xa = bajos.length ? Math.min(...bajos.map(([x]) => x)) : -w * 0.2, xb = bajos.length ? Math.max(...bajos.map(([x]) => x)) : w * 0.2;
  const pie = (lado: number) => {
    const xL = xa + (xb - xa) * (lado < 0 ? 0.32 : 0.68);
    const cerca = pts.filter(([x]) => Math.abs(x - xL) < Math.max((xb - xa) * 0.12, 8));
    const y = cerca.length ? Math.max(...cerca.map(([, yy]) => yy)) : 0;
    return [xL, Math.min(0, y - 2)] as P;
  };
  const hombroI: P = [borde(-1) + 3, yHombro], hombroD: P = [borde(1) - 3, yHombro];
  const brazo = alto * 0.2;
  const mueve = Math.sin(frame * 0.25) * 6;
  const brazos: Record<string, [P[], P[]]> = {
    normal: [[hombroI, [hombroI[0] - brazo * 0.55, hombroI[1] + brazo * 0.45], [hombroI[0] - brazo * 0.65, hombroI[1] + brazo * 0.95]],
      [hombroD, [hombroD[0] + brazo * 0.55, hombroD[1] + brazo * 0.45], [hombroD[0] + brazo * 0.65, hombroD[1] + brazo * 0.95]]],
    triste: [[hombroI, [hombroI[0] - brazo * 0.2, hombroI[1] + brazo * 0.6], [hombroI[0] - brazo * 0.15, hombroI[1] + brazo * 1.15]],
      [hombroD, [hombroD[0] + brazo * 0.2, hombroD[1] + brazo * 0.6], [hombroD[0] + brazo * 0.15, hombroD[1] + brazo * 1.15]]],
    contento: [[hombroI, [hombroI[0] - brazo * 0.5, hombroI[1] - brazo * 0.5], [hombroI[0] - brazo * 0.7, hombroI[1] - brazo * 1.05 + mueve]],
      [hombroD, [hombroD[0] + brazo * 0.5, hombroD[1] - brazo * 0.5], [hombroD[0] + brazo * 0.7, hombroD[1] - brazo * 1.05 - mueve]]],
    susto: [[hombroI, [hombroI[0] - brazo * 0.6, hombroI[1] - brazo * 0.12], [hombroI[0] - brazo * 1.1, hombroI[1] - brazo * 0.3 + mueve * 0.4]],
      [hombroD, [hombroD[0] + brazo * 0.6, hombroD[1] - brazo * 0.12], [hombroD[0] + brazo * 1.1, hombroD[1] - brazo * 0.3 - mueve * 0.4]]],
  };
  const [bI, bD] = brazos[pose] ?? brazos.normal;
  const ojosAhora: Ojos = ojos ?? (pose === "susto" ? "susto" : "normal");
  const parpadea = ojosAhora !== "felices" && ojosAhora !== "cerrados" && frame % 97 < 4;
  const bocaBase: Boca = boca ?? (pose === "triste" ? "triste" : pose === "susto" ? "o" : pose === "contento" ? "abierta" : "sonrisa");
  const bocaAhora: Boca = habla ? (Math.floor(frame / 3) % 3 === 0 ? "linea" : Math.floor(frame / 3) % 2 ? "abierta" : "o") : bocaBase;
  const bob = pose === "contento" ? -Math.abs(Math.sin(frame * 0.2)) * 14 : Math.sin(frame * 0.09) * 3;
  const resp = 1 + Math.sin(frame * 0.09) * 0.015;
  const inclina = pose === "triste" ? 4 : 0;
  const sw = Math.max(2.5, tema.trazo * 1.15);

  const Ojo = ({ x }: { x: number }) => {
    const y = fy;
    if (parpadea || ojosAhora === "cerrados") return <path d={`M ${x - r * 0.7} ${y} L ${x + r * 0.7} ${y}`} stroke={tinta} strokeWidth={sw} strokeLinecap="round" />;
    if (ojosAhora === "felices") return <path d={`M ${x - r * 0.7} ${y + r * 0.2} Q ${x} ${y - r * 0.7} ${x + r * 0.7} ${y + r * 0.2}`} stroke={tinta} strokeWidth={sw} fill="none" strokeLinecap="round" />;
    const big = ojosAhora === "susto" ? 1.2 : 1;
    const pr = ojosAhora === "susto" ? 0.32 : 0.45;
    return (
      <g>
        <ellipse cx={x} cy={y} rx={r * 0.8 * big} ry={r * big} fill="#ffffff" stroke={tinta} strokeWidth={sw * 0.85} />
        <circle cx={x + mira * r * 0.3} cy={y + r * 0.12} r={r * pr} fill={tinta} />
        <circle cx={x + mira * r * 0.3 - r * 0.12} cy={y - r * 0.05} r={r * 0.12} fill="#ffffff" />
        {ojosAhora === "entornados" && <rect x={x - r * 0.9} y={y - r * 1.05} width={r * 1.8} height={r * 0.9} fill={color} stroke={tinta} strokeWidth={sw * 0.7} />}
        {ojosAhora === "enfado" && <path d={`M ${x - r} ${y - r * 1.2} L ${x + r * 0.6} ${y - r * 0.6}`} stroke={tinta} strokeWidth={sw} strokeLinecap="round" transform={x > fx ? `scale(-1,1) translate(${-2 * x},0)` : undefined} />}
      </g>
    );
  };
  const by = fy + r * 1.55, bw = r * 0.85;
  const Bocas: Record<Boca, React.ReactNode> = {
    nada: null,
    linea: <path d={`M ${fx - bw * 0.6} ${by} L ${fx + bw * 0.6} ${by}`} stroke={tinta} strokeWidth={sw} strokeLinecap="round" />,
    sonrisa: <path d={`M ${fx - bw} ${by - r * 0.15} Q ${fx} ${by + r * 0.55} ${fx + bw} ${by - r * 0.15}`} stroke={tinta} strokeWidth={sw} fill="none" strokeLinecap="round" />,
    triste: <path d={`M ${fx - bw} ${by + r * 0.3} Q ${fx} ${by - r * 0.3} ${fx + bw} ${by + r * 0.3}`} stroke={tinta} strokeWidth={sw} fill="none" strokeLinecap="round" />,
    o: <ellipse cx={fx} cy={by + r * 0.1} rx={r * 0.32} ry={r * 0.42} fill="#7a2a22" stroke={tinta} strokeWidth={sw * 0.8} />,
    abierta: <path d={`M ${fx - bw} ${by - r * 0.1} Q ${fx} ${by - r * 0.2} ${fx + bw} ${by - r * 0.1} Q ${fx + bw * 0.6} ${by + r * 0.9} ${fx} ${by + r * 0.9} Q ${fx - bw * 0.6} ${by + r * 0.9} ${fx - bw} ${by - r * 0.1} Z`} fill="#7a2a22" stroke={tinta} strokeWidth={sw * 0.8} strokeLinejoin="round" />,
  };
  const [pI, pD] = [pie(-1), pie(1)];
  return (
    <g>
      {pose === "triste" && (
        <g>
          <ellipse cx={0} cy={4} rx={w * 0.55 + 40} ry={18} fill="#6fb7e8" opacity={0.75} stroke={tono("#6fb7e8", -0.3)} strokeWidth={2} />
          {[0, 1, 2].map((i) => {
            const ciclo = (frame + i * 17) % 50;
            const x = (i - 1) * w * 0.22 + cx * 0.3;
            const y0 = -piernas - h * (0.15 + 0.1 * i);
            const y = y0 + ciclo * ((piernas + h * 0.2) / 50);
            return ciclo < 46 ? <path key={i} d={`M ${x} ${y - 14} Q ${x + 7} ${y} ${x} ${y + 6} Q ${x - 7} ${y} ${x} ${y - 14} Z`} fill="#6fb7e8" stroke={tono("#6fb7e8", -0.35)} strokeWidth={1.5} /> : null;
          })}
        </g>
      )}
      {pose !== "triste" && <ellipse cx={0} cy={2} rx={w * 0.35 + 30} ry={10} fill="#000" opacity={0.13} />}
      <g transform={`translate(0, ${bob})`}>
        {[pI, pD].map(([x, y], i) => <Linea key={`p${i}`} tema={tema} pts={[[x, -piernas + y + 4], [x + (i ? 4 : -4), (-piernas + y) * 0.45], [x + (i ? 8 : -8), -6]]} />)}
        {[pI, pD].map(([x], i) => <ellipse key={`z${i}`} cx={x + (i ? 14 : -14)} cy={-5} rx={tema.palito * 1.6 + 5} ry={tema.palito * 0.8 + 3} fill={tinta} />)}
        <g transform={`translate(0, ${-piernas}) rotate(${inclina}) scale(1, ${resp})`}>
          {/* las provincias juntas: primero el borde doble y encima el relleno, así no se ven las rayas de dentro */}
          <path d={sil.d} fill={tono(color, -0.25)} transform="translate(5, 6)" opacity={0.5} />
          <path d={sil.d} fill={color} stroke={tinta} strokeWidth={sw * 3} strokeLinejoin="round" />
          <path d={sil.d} fill={color} stroke={color} strokeWidth={sw * 1.2} strokeLinejoin="round" />
          <Linea tema={tema} pts={bI} />
          <Linea tema={tema} pts={bD} />
          {[bI, bD].map((b, i) => <circle key={`m${i}`} cx={b[2][0]} cy={b[2][1]} r={tema.palito * 0.95} fill={tinta} />)}
          <ellipse cx={fx - sep * 1.15} cy={fy + r * 1.4} rx={r * 0.45} ry={r * 0.25} fill="#e0679b" opacity={0.35} />
          <ellipse cx={fx + sep * 1.15} cy={fy + r * 1.4} rx={r * 0.45} ry={r * 0.25} fill="#e0679b" opacity={0.35} />
          <Ojo x={fx - sep * 0.6} />
          <Ojo x={fx + sep * 0.6} />
          {Bocas[bocaAhora]}
        </g>
      </g>
    </g>
  );
};
