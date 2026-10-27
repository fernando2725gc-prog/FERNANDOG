// Cerebro holográfico: una red neuronal con forma de cerebro (dos hemisferios y
// cerebelo) proyectada en 3D sobre un canvas, con anillos de HUD alrededor.
// Estados: idle | thinking | speaking | error.

const TAU = Math.PI * 2;

// Generador pseudoaleatorio con semilla, para que el cerebro siempre se vea igual.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Puntos sobre la "corteza": elipsoides deformados con pliegues (giros).
export function buildBrain({ nodes = 600, links = 3, seed = 7 } = {}) {
  const rand = rng(seed);
  const points = [];
  const surface = (cx, cy, cz, rx, ry, rz, n, folds = true) => {
    for (let i = 0; i < n; i++) {
      // Dirección uniforme en la esfera.
      const u = rand() * 2 - 1;
      const t = rand() * TAU;
      const r = Math.sqrt(1 - u * u);
      let x = r * Math.cos(t);
      let y = u;
      let z = r * Math.sin(t);
      const fold = folds ? 1 + 0.07 * Math.sin(7 * x + 3 * y) * Math.cos(6 * z - 2 * y) : 1;
      x = cx + x * rx * fold;
      y = cy + y * ry * fold;
      z = cz + z * rz * fold;
      if (y < -0.32) y = -0.32 + (y + 0.32) * 0.55; // base del cerebro más plana
      points.push({ x, y, z, phase: rand() * TAU });
    }
  };
  const hemi = Math.round(nodes * 0.42);
  surface(-0.34, 0.08, 0, 0.42, 0.62, 0.95, hemi); // hemisferio izquierdo (x = ancho, z = largo)
  surface(0.34, 0.08, 0, 0.42, 0.62, 0.95, hemi); // hemisferio derecho
  surface(0, -0.46, -0.62, 0.42, 0.22, 0.28, Math.round(nodes * 0.12)); // cerebelo
  for (let i = 0; i < Math.round(nodes * 0.04); i++) {
    points.push({ x: (rand() - 0.5) * 0.12, y: -0.55 - rand() * 0.45, z: -0.3 + (rand() - 0.5) * 0.12, phase: rand() * TAU }); // tallo
  }

  // Cada punto se une con sus vecinos más cercanos.
  const edges = [];
  const seen = new Set();
  points.forEach((p, i) => {
    const near = points
      .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 }))
      .filter((n) => n.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, links);
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  });
  return { points, edges };
}

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function createHologram(canvas) {
  const ctx = canvas.getContext("2d");
  const { points, edges } = buildBrain();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let state = "idle";
  let level = 0; // intensidad al hablar (0..1)
  let angle = 0.6;
  let last = performance.now();
  let width = 0;
  let height = 0;
  let pulses = [];
  let frame = 0;
  const colors = { holo: "#5ce1ff", warn: "#ffb547", stop: "#ff5d5d" };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    colors.holo = cssVar("--holo", colors.holo);
    colors.warn = cssVar("--warn", colors.warn);
    colors.stop = cssVar("--stop", colors.stop);
    if (reduceMotion) draw(0);
  };
  new ResizeObserver(resize).observe(canvas);

  const rgba = (hex, a) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function spawnPulse(color) {
    const e = edges[(Math.random() * edges.length) | 0];
    pulses.push({ a: e[0], b: e[1], t: 0, speed: 0.6 + Math.random() * 1.2, color });
  }

  function rings(cx, cy, r, time, accent) {
    ctx.lineWidth = 1;
    // Anillo exterior con marcas, como un dial.
    ctx.strokeStyle = rgba(colors.holo, 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.32, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU + time * 0.05;
      const long = i % 6 === 0;
      const r1 = r * 1.32;
      const r2 = r * (long ? 1.27 : 1.3);
      ctx.strokeStyle = rgba(colors.holo, long ? 0.45 : 0.2);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // Arcos que giran en sentidos opuestos.
    const speed = state === "thinking" ? 1.6 : state === "speaking" ? 0.9 : 0.35;
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(accent, 0.75);
    for (let k = 0; k < 3; k++) {
      const start = time * speed + (k * TAU) / 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.42, start, start + 0.7);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(colors.holo, 0.35);
    for (let k = 0; k < 2; k++) {
      const start = -time * speed * 0.7 + k * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.2, start, start + 1.2);
      ctx.stroke();
    }
  }

  function draw(dt) {
    const time = performance.now() / 1000;
    ctx.clearRect(0, 0, width, height);
    if (!width || !height) return;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.3;
    const accent = state === "error" ? colors.stop : state === "thinking" ? colors.warn : colors.holo;

    const spin = state === "thinking" ? 0.55 : state === "speaking" ? 0.3 : 0.14;
    if (!reduceMotion) angle += dt * spin;
    level += ((state === "speaking" ? 0.5 + 0.5 * Math.abs(Math.sin(time * 9) * Math.sin(time * 3.7)) : 0) - level) * 0.15;
    const breathe = 1 + (state === "speaking" ? level * 0.05 : Math.sin(time * 1.4) * 0.012);

    rings(cx, cy, r, reduceMotion ? 0 : time, accent);

    // Proyección: giro en Y y leve inclinación en X.
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const tilt = -0.28;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const proj = points.map((p) => {
      const x1 = p.x * cosA + p.z * sinA;
      const z1 = -p.x * sinA + p.z * cosA;
      const y1 = p.y * cosT - z1 * sinT;
      const z2 = p.y * sinT + z1 * cosT;
      const persp = 2.6 / (2.6 + z2);
      return { x: cx + x1 * r * persp * breathe, y: cy - y1 * r * persp * breathe, depth: (1 - z2) / 2 };
    });

    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 0.7;
    for (const [i, j] of edges) {
      const a = proj[i];
      const b = proj[j];
      const alpha = 0.05 + 0.22 * ((a.depth + b.depth) / 2);
      ctx.strokeStyle = rgba(colors.holo, alpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    points.forEach((p, i) => {
      const q = proj[i];
      const twinkle = state === "thinking" ? 0.5 + 0.5 * Math.sin(time * 6 + p.phase) : 0.75 + 0.25 * Math.sin(time * 1.5 + p.phase);
      ctx.fillStyle = rgba(colors.holo, (0.25 + 0.65 * q.depth) * twinkle);
      const size = 0.6 + 1.5 * q.depth;
      ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
    });

    // Sinapsis: pulsos que viajan por las conexiones.
    if (!reduceMotion) {
      const rate = state === "thinking" ? 3 : state === "speaking" ? 1.2 : 0.12;
      if (Math.random() < rate * dt * 10) spawnPulse(state === "thinking" ? colors.warn : accent);
      pulses = pulses.filter((p) => (p.t += dt * p.speed) < 1);
      for (const p of pulses) {
        const a = proj[p.a];
        const b = proj[p.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 6);
        glow.addColorStop(0, rgba(p.color, 0.95));
        glow.addColorStop(1, rgba(p.color, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(x - 6, y - 6, 12, 12);
      }
    }

    // Núcleo luminoso.
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.9);
    core.addColorStop(0, rgba(accent, 0.18 + level * 0.15));
    core.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = core;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(dt);
    frame = requestAnimationFrame(loop);
  }
  if (!reduceMotion) frame = requestAnimationFrame(loop);

  return {
    setState(next) {
      state = next;
      if (reduceMotion) draw(0);
    },
    destroy() {
      cancelAnimationFrame(frame);
    }
  };
}
