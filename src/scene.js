// Фоновая сцена: изометрический разрез степи у Каспия, собранный китом Anatomy (k = iso-kit, G = lathe).
// Слева — Доссор, 1911: деревянная вышка ударно-канатного бурения, балансир, паровой котёл, юрта, караван.
// Справа — Жанажол, 1978: стальная вышка роторного бурения, ротор, талевый блок, насосы, трубы.
// Под землёй — пласты: надсолевые, соль (купол), подсолевой палеозой с нефтью.
// Каждый кадр сцена заново проецируется камерой с текущим азимутом, поэтому при прокрутке она поворачивается в 3D.
(() => {
  const root = document.getElementById("scene");
  if (!root) return;
  const svg = root.querySelector("svg");
  const world = svg.querySelector(".world");
  const readout = document.querySelector("[data-scene-readout]");
  const eraLabel = document.querySelector("[data-scene-era]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  // детерминированный «случай», чтобы кусты и частицы не прыгали между кадрами
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- Мир ----------
  const X0 = -200, X1 = 200, Y0 = -92, Y1 = 92;
  const Z = { soil: -8, cover: -125, subsalt: -152, base: -170 };
  const BLOCK = { x: X0, y: Y0, w: X1 - X0, d: Y1 - Y0, r: 3 };
  const D1 = [-95, 62]; // Доссор, скв. №3
  const D2 = [95, 60];  // Жанажол, скв. №4
  const BORE1 = -34;    // ≈ 225 м (без масштаба)
  const BORE2 = -140;   // ≈ 2 894 м (без масштаба)
  const saltTop = (x) => -86 + 44 * Math.exp(-(((x - D1[0]) / 36) ** 2)) + 5 * Math.sin(x / 31);
  const saltBottom = (x) => Z.cover + 10 * Math.exp(-(((x - D2[0]) / 46) ** 2));
  const saltTopY = (y) => -86 + 4 * Math.sin(y / 17);

  let P = null; // текущая проекция
  const items = [];
  const push = (anchor, svgText) => items.push({ d: k.depthOf(anchor, P), s: svgText });
  const S = (paths, cls, opt = {}) => k.solidSvg(paths, { tone: "mid", crease: "faint", className: cls, ...opt });
  const L = (d, opt = {}) => k.lineSvg(d, { tone: "lo", ...opt });
  const poly = (pts, cls) => `<path class="${cls}" d="${k.pathOf(pts.map((p) => k.iso(p, P)), true)}"/>`;
  const line3 = (pts, cls) => `<path class="${cls}" d="${k.pathOf(pts.map((p) => k.iso(p, P)))}"/>`;

  // Брус с квадратным сечением из точки a в точку b
  const SQ = (w) => [[-w, -w], [w, -w], [w, w], [-w, w]];
  function beam(a, b, w, cls, opt) {
    const L3 = len(sub(b, a));
    if (L3 < 0.01) return "";
    return S(G.prismOf(G.frameAlong(a, sub(b, a)), SQ(w), 0, L3, P), cls, opt);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const pushBeam = (a, b, w, cls, opt) => push(mid(a, b), beam(a, b, w, cls, opt));
  // Цилиндр вдоль произвольной оси
  function rod(a, b, r, cls, steps = 18, opt) {
    const L3 = len(sub(b, a));
    return S(G.disc(0, L3, r, G.frameAlong(a, sub(b, a)), P, { steps }), cls, opt);
  }
  const box = (x, y, z, w, d, h, cls, opt = {}) => S(k.slabOf({ x, y, w, d, r: opt.r ?? 0.5 }, z, h, P, opt.steps ?? 2, opt.bevel ?? 0), cls, opt);
  const pushBox = (x, y, z, w, d, h, cls, opt) => push([x + w / 2, y + d / 2, z + h / 2], box(x, y, z, w, d, h, cls, opt));
  const ball = (c, r, cls) => S(G.sphereOf(c, r, P, { steps: 24 }), cls);

  // ---------- Земля: блок-разрез ----------
  function ground(state) {
    const out = [];
    out.push(`<path class="iso-halo" d="${k.haloOf(BLOCK, Z.base, -Z.base, P)}"/>`);
    out.push(S(k.slabOf(BLOCK, Z.base, Z.subsalt - Z.base, P, 3), "m-rock", { crease: "none" }));
    out.push(S(k.slabOf(BLOCK, Z.subsalt, Z.cover - Z.subsalt, P, 3), "m-carb", { crease: "none" }));
    out.push(S(k.slabOf(BLOCK, Z.cover, Z.soil - Z.cover, P, 3), "m-clay", { crease: "none" }));
    out.push(S(k.slabOf(BLOCK, Z.soil, -Z.soil, P, 3, 1.2), "m-sand", { crease: "faint" }));

    // Срез по фронту (грань y = Y1): соль, купол, нефть, слоистость
    const xs = [];
    for (let x = X0; x <= X1 + 0.1; x += 5) xs.push(x);
    const saltFace = [...xs.map((x) => [x, Y1, saltTop(x)]), ...xs.slice().reverse().map((x) => [x, Y1, saltBottom(x)])];
    out.push(poly(saltFace, "f-salt"));
    // грань x = X1
    const ys = [];
    for (let y = Y0; y <= Y1 + 0.1; y += 6) ys.push(y);
    out.push(poly([...ys.map((y) => [X1, y, saltTopY(y)]), ...ys.slice().reverse().map((y) => [X1, y, saltBottom(X1)])], "f-salt f-salt-x"));
    // слоистость надсолевой толщи — облекает купол
    for (const base of [-20, -36, -54, -70]) {
      const pts = xs.map((x) => [x, Y1, Math.max(base + 0.55 * (saltTop(x) + 86) * (1 + base / 120), saltTop(x) + 3)]);
      out.push(line3(pts, "f-bed"));
      out.push(line3(ys.map((y) => [X1, y, base + 0.3 * (saltTopY(y) + 86)]), "f-bed"));
    }
    // внутрисолевые линии течения
    for (const t of [0.35, 0.7]) out.push(line3(xs.map((x) => [x, Y1, lerp(saltBottom(x), saltTop(x), t)]), "f-flow"));
    // линза нефти Доссора над крылом купола (средняя юра)
    const lens = [];
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU;
      lens.push([D1[0] + 22 * Math.cos(a), Y1, BORE1 - 1 + 4.2 * Math.sin(a)]);
    }
    out.push(poly(lens, "f-oil f-oil-d" + (state.gush > 0.02 ? " on" : "")));
    // подсолевая залежь Жанажола (карбонаты, ловушка-поднятие)
    const trap = [];
    for (let x = D2[0] - 70; x <= D2[0] + 70; x += 4) trap.push([x, Y1, saltBottom(x) - 1.5]);
    for (let x = D2[0] + 70; x >= D2[0] - 70; x -= 4) trap.push([x, Y1, Z.cover - 18 + 6 * Math.exp(-(((x - D2[0]) / 40) ** 2))]);
    out.push(poly(trap, "f-oil f-oil-z" + (state.found ? " on" : "")));
    // Риска «−» глубины по ребру: метки 0 / 1 / 2 / 3 км условно
    const ticks = [];
    for (let z = 0; z >= Z.base + 2; z -= 10) ticks.push(k.segment([X1, Y1, z], [X1 + (z % 50 === 0 ? 5 : 2.5), Y1 + (z % 50 === 0 ? 5 : 2.5) * 0, z], P));
    out.push(L(ticks.join(""), { tone: "faint" }));

    // Ствол скважин на срезе
    const bore = (x, zTo, cls) => poly([[x - 1.3, Y1, 0], [x + 1.3, Y1, 0], [x + 1.3, Y1, zTo], [x - 1.3, Y1, zTo]], cls);
    out.push(bore(D1[0], BORE1 + state.tool, "f-bore"));
    out.push(bore(D2[0], lerp(-3, BORE2, state.drill), "f-bore"));
    // обсадная колонна Жанажола (кондуктор + техническая) — до соли
    const cas = Math.max(lerp(-3, BORE2, state.drill), -60);
    out.push(line3([[D2[0] - 2.2, Y1, 0], [D2[0] - 2.2, Y1, cas]], "f-casing"), line3([[D2[0] + 2.2, Y1, 0], [D2[0] + 2.2, Y1, cas]], "f-casing"));
    // долото
    const bit = k.iso([D2[0], Y1, lerp(-3, BORE2, state.drill)], P);
    out.push(`<circle class="f-bit" cx="${bit[0].toFixed(1)}" cy="${bit[1].toFixed(1)}" r="2.6"/>`);
    const tool = k.iso([D1[0], Y1, BORE1 + state.tool], P);
    out.push(`<circle class="f-bit f-bit-1" cx="${tool[0].toFixed(1)}" cy="${tool[1].toFixed(1)}" r="2"/>`);
    // тропа каравана на поверхности
    out.push(L(k.onTop(routePoints(48), 0, P, true), { tone: "faint", dotted: true }));
    return out.join("");
  }

  // ---------- Маршрут каравана ----------
  const ROUTE = { x0: -182, x1: -28, y0: -74, y1: -18, r: 26 };
  function routeAt(u) {
    // скруглённый прямоугольник, параметр u ∈ [0,1)
    const { x0, x1, y0, y1, r } = ROUTE;
    const a = x1 - x0 - 2 * r, b = y1 - y0 - 2 * r, arc = (Math.PI / 2) * r;
    const total = 2 * a + 2 * b + 4 * arc;
    let s = (((u % 1) + 1) % 1) * total;
    const segs = [
      [a, (t) => [x0 + r + t, y0, 0]],
      [arc, (t) => { const q = -Math.PI / 2 + t / r; return [x1 - r + r * Math.cos(q), y0 + r + r * Math.sin(q), q + Math.PI / 2]; }],
      [b, (t) => [x1, y0 + r + t, Math.PI / 2]],
      [arc, (t) => { const q = t / r; return [x1 - r + r * Math.cos(q), y1 - r + r * Math.sin(q), q + Math.PI / 2]; }],
      [a, (t) => [x1 - r - t, y1, Math.PI]],
      [arc, (t) => { const q = Math.PI / 2 + t / r; return [x0 + r + r * Math.cos(q), y1 - r + r * Math.sin(q), q + Math.PI / 2]; }],
      [b, (t) => [x0, y1 - r - t, -Math.PI / 2]],
      [arc, (t) => { const q = Math.PI + t / r; return [x0 + r + r * Math.cos(q), y0 + r + r * Math.sin(q), q + Math.PI / 2]; }],
    ];
    for (const [l, f] of segs) {
      if (s <= l) { const [x, y, h] = f(s); return { x, y, h }; }
      s -= l;
    }
    return { x: x0 + r, y: y0, h: 0 };
  }
  function routePoints(n) {
    const pts = [];
    for (let i = 0; i < n; i++) { const p = routeAt(i / n); pts.push([p.x, p.y]); }
    return pts;
  }

  // ---------- Верблюд с бочками воды ----------
  function camel(x, y, h, phase, lead) {
    const c = Math.cos(h), s = Math.sin(h);
    const W = (lx, ly, lz) => [x + lx * c - ly * s, y + lx * s + ly * c, lz];
    const bob = 0.35 * Math.sin(phase * 2);
    const legs = [
      [4.6, 1.9, 0], [4.6, -1.9, Math.PI], [-4.4, 1.9, Math.PI * 0.5], [-4.4, -1.9, Math.PI * 1.5],
    ];
    for (const [lx, ly, off] of legs) {
      const q = phase + off;
      const fx = lx + 1.8 * Math.sin(q);
      const fz = Math.max(0, 1.1 * Math.cos(q));
      const knee = W(lx + 0.6 * Math.sin(q), ly, 6 + fz * 0.5);
      pushBeam(W(lx, ly, 11 + bob), knee, 0.65, "m-camel");
      pushBeam(knee, W(fx, ly, fz), 0.55, "m-camel");
      push(W(fx, ly, fz), ball(W(fx, ly, fz + 0.4), 0.9, "m-camel-d"));
    }
    push(W(-3, 0, 13 + bob), ball(W(-3, 0, 13 + bob), 4.8, "m-camel"));
    push(W(3, 0, 13.3 + bob), ball(W(3, 0, 13.3 + bob), 4.9, "m-camel"));
    push(W(0, 0, 18 + bob), ball(W(-0.3, 0, 17.4 + bob), 3.3, "m-camel"));
    pushBeam(W(7, 0, 14 + bob), W(10.5, 0, 20 + bob), 1.2, "m-camel");
    pushBeam(W(10.2, 0, 20.5 + bob), W(13.8, 0, 19.8 + bob), 1.1, "m-camel-d");
    // седло-попона и бочки по бокам
    pushBeam(W(-1, -4.6, 16 + bob), W(-1, 4.6, 16 + bob), 1.4, "m-felt");
    for (const side of [-1, 1]) {
      const a = W(-4, side * 6.2, 12 + bob), b = W(2, side * 6.2, 12 + bob);
      push(mid(a, b), rod(a, b, 2.9, "m-wood", 16));
    }
    if (lead) {
      // погонщик ведёт первого верблюда
      const p = W(17, 1.5, 0);
      const step = 0.5 * Math.sin(phase * 2);
      pushBeam(W(17, 0.7, 0), W(17 + step, 0.7, 6), 0.55, "m-cloth");
      pushBeam(W(17, 2.3, 0), W(17 - step, 2.3, 6), 0.55, "m-cloth");
      push(W(17, 1.5, 9), S(k.cylinder(p[0], p[1], 1.9, 5.5, 6.5, P, 14), "m-cloth"));
      push(W(17, 1.5, 13.2), ball([p[0], p[1], 13.3], 1.4, "m-skin"));
      push(W(17, 1.5, 14.4), S(k.cylinder(p[0], p[1], 1.5, 14, 1.2, P, 14), "m-felt"));
      push(mid(W(14, 0, 19.5), W(17, 1.5, 9)), line3([W(14, 0, 19.6), W(16.4, 1.2, 10)], "iso-line rope"));
    }
  }

  // ---------- Деревянная вышка Доссора (1911) ----------
  function tower(cx, cy, hb, ht, z0, H, levels, cls, wLeg, cross) {
    const half = (z) => hb + (ht - hb) * (z - z0) / H;
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sy] of C) pushBeam([cx + sx * hb, cy + sy * hb, z0], [cx + sx * ht, cy + sy * ht, z0 + H], wLeg, cls);
    for (let i = 1; i <= levels; i++) {
      const z = z0 + (H * i) / (levels + 1);
      const h = half(z);
      for (let j = 0; j < 4; j++) {
        const [ax, ay] = C[j], [bx, by] = C[(j + 1) % 4];
        pushBeam([cx + ax * h, cy + ay * h, z], [cx + bx * h, cy + by * h, z], wLeg * 0.55, cls);
      }
    }
    for (let i = 0; i <= levels; i++) {
      const za = z0 + (H * i) / (levels + 1), zb = z0 + (H * (i + 1)) / (levels + 1);
      const ha = half(za), hb2 = half(zb);
      for (let j = 0; j < 4; j++) {
        const [ax, ay] = C[j], [bx, by] = C[(j + 1) % 4];
        const p1 = [cx + ax * ha, cy + ay * ha, za], p2 = [cx + bx * hb2, cy + by * hb2, zb];
        push(mid(p1, p2), L(k.segment(p1, p2, P), { tone: "mid", className: "brace " + cls }));
        if (cross) {
          const q1 = [cx + bx * ha, cy + by * ha, za], q2 = [cx + ax * hb2, cy + ay * hb2, zb];
          push(mid(q1, q2), L(k.segment(q1, q2, P), { tone: "mid", className: "brace " + cls }));
        }
      }
    }
  }

  function dossor(state, t) {
    const [cx, cy] = D1;
    // настил
    pushBox(cx - 17, cy - 17, 0, 34, 34, 2.4, "m-wood", { bevel: 0.6 });
    for (let i = -14; i <= 14; i += 4) push([cx, cy + i, 2.4], L(k.lineOnTop([cx - 16, cy + i], [cx + 16, cy + i], 2.4, P), { tone: "faint" }));
    tower(cx, cy, 14, 3.4, 2.4, 92, 4, "m-wood", 1.15, false);
    pushBox(cx - 4.6, cy - 4.6, 94.4, 9.2, 9.2, 3.4, "m-wood", { bevel: 0.5 }); // кронблок
    const crownWheel = rod([cx - 2.4, cy, 99], [cx + 2.4, cy, 99], 2.2, "m-iron", 14);
    push([cx, cy, 99], crownWheel);

    // Балансир (walking beam) на стойке-самсоне
    const pivot = [cx + 30, cy, 27];
    const th = state.beam;
    const at = (dx) => [pivot[0] + dx * Math.cos(th), pivot[1], pivot[2] + dx * Math.sin(th)];
    for (const sy of [-3, 3]) pushBeam([cx + 30, cy + sy, 2.4], [cx + 30, cy + sy * 0.4, 26], 1.1, "m-wood");
    pushBeam([cx + 36, cy, 2.4], [cx + 30.6, cy, 24], 0.8, "m-wood");
    pushBox(cx + 27, cy - 4, 0, 8, 8, 2.4, "m-wood");
    const front = at(-30), rear = at(15);
    pushBeam(front, rear, 1.5, "m-wood", { lit: false });
    push(front, ball(front, 1.3, "m-iron"));
    // канат с долотом уходит в устье
    push([cx, cy, 30], line3([front, [cx, cy, 2.4]], "iso-line cable"));
    push([cx, cy, 50], line3([[cx, cy, 98], [cx + 0.6, cy, 2.4]], "iso-line cable thin"));

    // Ленточное колесо + шатун
    const wc = [cx + 47, cy, 13];
    const F = G.frameOf(wc, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    push([wc[0], wc[1] - 1, wc[2]], S(G.disc(-1.4, 1.4, 11, F, P, { steps: 40 }), "m-wood"));
    push([wc[0], wc[1] + 1.5, wc[2]], L(G.spokesOf(F, 1.45, 1.6, 10.2, 8, P, { phase: state.wheel }), { tone: "mid" }) + L(G.circleOf(F, 1.45, 3, P, 20), { tone: "mid" }));
    const crank = G.pointOf(F, 2.2, 7, state.wheel);
    pushBeam(crank, rear, 0.7, "m-iron");
    pushBeam([wc[0], cy - 4, 0], [wc[0], cy - 2, 13], 1, "m-wood");
    pushBeam([wc[0], cy + 4, 0], [wc[0], cy + 2, 13], 1, "m-wood");

    // Паровой котёл и маховик паровой машины
    const fw = [cx + 66, cy - 6, 9];
    const F2 = G.frameOf(fw, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    push(fw, S(G.disc(-1.2, 1.2, 7, F2, P, { steps: 32 }), "m-iron"));
    push([fw[0], fw[1] + 1.4, fw[2]], L(G.spokesOf(F2, 1.25, 1.2, 6.2, 6, P, { phase: state.wheel * 1.8 }), { tone: "mid" }));
    // ремень от маховика к колесу
    push([cx + 56, cy, 10], line3([[fw[0], fw[1] + 0.2, fw[2] + 7], [wc[0], wc[1], wc[2] + 11]], "iso-line belt") + line3([[fw[0], fw[1] + 0.2, fw[2] - 7], [wc[0], wc[1], wc[2] - 11]], "iso-line belt"));
    pushBox(fw[0] - 5, cy - 13, 0, 12, 5, 6, "m-iron", { bevel: 0.4 });
    const b0 = [cx + 74, cy - 22, 9], b1 = [cx + 98, cy - 22, 9];
    pushBox(cx + 72, cy - 30, 0, 28, 16, 3, "m-brick");
    push(mid(b0, b1), rod(b0, b1, 7.2, "m-iron", 28, { inner: "" }));
    for (const xx of [cx + 79, cx + 87, cx + 95]) push([xx, cy - 22, 9], L(G.arcOf(G.frameAlong(b0, [1, 0, 0]), xx - b0[0], 7.25, P), { tone: "lo" }));
    push([cx + 96, cy - 22, 30], S(k.cylinder(cx + 96, cy - 22, 1.8, 15, 34, P, 16), "m-iron"));
    push([cx + 96, cy - 22, 49], S(k.cylinder(cx + 96, cy - 22, 2.6, 48, 2, P, 16), "m-iron"));

    // Юрта, контора, деревянный резервуар
    const yx = -168, yy = 30;
    push([yx, yy, 4], S(k.cylinder(yx, yy, 13, 0, 8, P, 40), "m-felt"));
    const FR = G.frameOf([yx, yy, 8], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    push([yx, yy, 10], S(G.solidOf([[0, 13.6], [5.6, 4.2], [6.2, 2.6]], FR, P, { steps: 40 }), "m-felt"));
    push([yx, yy, 14.3], L(k.ring(yx, yy, 2.6, 14.2, P, 20), { tone: "mid" }));
    push([yx + 10, yy + 7.6, 3], S(G.prismOf(G.frameOf([yx + 12.6, yy + 7.4, 0], [Math.cos(0.6), Math.sin(0.6), 0], [-Math.sin(0.6), Math.cos(0.6), 0], [0, 0, 1]), [[-2.4, 0], [2.4, 0], [2.4, 6], [-2.4, 6]], 0, 0.8, P), "m-door"));
    for (const z of [3, 6]) push([yx, yy + 13, z], L(k.sideArc(yx, yy, 13.05, z, P, 32), { tone: "faint" }));

    pushBox(-146, 12, 0, 20, 14, 10, "m-wood", { bevel: 0.5 });
    const roofF = G.frameOf([-147, 12, 10], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    push([-136, 19, 13], S(G.prismOf(roofF, [[-1, 0], [15, 0], [7, 6]], 0, 22, P), "m-roof"));
    push([-136, 26.2, 5], L(k.segment([-140, 26.1, 3.5], [-140, 26.1, 7.5], P) + k.segment([-132, 26.1, 3.5], [-132, 26.1, 7.5], P), { tone: "mid" }));

    push([-58, 18, 5], S(k.cylinder(-58, 18, 10, 0, 10, P, 36), "m-wood"));
    for (const z of [3, 7]) push([-58, 28, z], L(k.sideArc(-58, 18, 10.05, z, P, 30), { tone: "lo" }));
    push([-58, 18, 10], L(k.ring(-58, 18, 8.5, 10, P, 30), { tone: "faint" }));

    // Фонтан 29.04.1911 и нефть на настиле
    drops(state, t, cx, cy);
  }

  // Частицы фонтана — нефть, летящая выше кронблока
  const DROPS = Array.from({ length: 150 }, () => ({ a: rnd() * TAU, v: 0.8 + rnd() * 0.3, sp: 1 + rnd() * 14, ph: rnd(), r: 0.7 + rnd() * 1.5 }));
  function drops(state, t, cx, cy) {
    if (state.gush < 0.01) return;
    const g = 120;
    for (const p of DROPS) {
      const life = 2 * 140 * p.v / g;
      const age = ((t / life + p.ph) % 1) * life;
      const vz = 140 * p.v * state.gush;
      const z = 3 + vz * age - 0.5 * g * age * age;
      if (z < 0) continue;
      const pos = [cx + Math.cos(p.a) * p.sp * age, cy + Math.sin(p.a) * p.sp * age, z];
      const s = k.iso(pos, P);
      push(pos, `<circle class="drop" cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${(p.r * scale() * 1.1).toFixed(2)}" opacity="${(0.55 + 0.45 * state.gush).toFixed(2)}"/>`);
    }
    // сплошная струя от устья до вершины фонтана
    const top = 3 + (140 * 0.95 * state.gush) ** 2 / (2 * 120);
    const a0 = k.iso([cx, cy, 2.4], P), a1 = k.iso([cx, cy, top], P), w0 = P.scale * 1.6, w1 = P.scale * 5;
    push([cx, cy, 60], `<path class="jet" opacity="${state.gush.toFixed(2)}" d="M${(a0[0] - w0).toFixed(1)} ${a0[1].toFixed(1)} L${(a1[0] - w1).toFixed(1)} ${a1[1].toFixed(1)} Q${a1[0].toFixed(1)} ${(a1[1] - w1 * 2).toFixed(1)} ${(a1[0] + w1).toFixed(1)} ${a1[1].toFixed(1)} L${(a0[0] + w0).toFixed(1)} ${a0[1].toFixed(1)} Z"/>`);
    const pool = k.onTop(k.circleRing(cx + 4, cy - 6, 6 + 18 * state.gush, 28), 0.15, P, true);
    push([cx, cy - 40, 0], `<path class="pool" d="${pool}" opacity="${(0.7 * state.gush).toFixed(2)}"/>`);
  }
  const scale = () => Math.max(0.5, P.scale * 0.9);

  // ---------- Стальная вышка Жанажола (1978) ----------
  function zhanazhol(state, t) {
    const [cx, cy] = D2;
    // подвышечное основание и пол буровой
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pushBox(cx + sx * 15 - 3, cy + sy * 15 - 3, 0, 6, 6, 12, "m-steel");
    pushBeam([cx - 15, cy - 15, 6], [cx + 15, cy + 15, 6], 0.6, "m-steel");
    pushBeam([cx + 15, cy - 15, 6], [cx - 15, cy + 15, 6], 0.6, "m-steel");
    pushBox(cx - 21, cy - 21, 12, 42, 42, 2.4, "m-steel", { bevel: 0.6 });
    tower(cx, cy, 15, 3.8, 14.4, 138, 8, "m-paint", 1.1, true);
    pushBox(cx - 5, cy - 5, 152, 10, 10, 4, "m-paint", { bevel: 0.5 }); // кронблок
    push([cx, cy, 158], S(k.cylinder(cx, cy, 1.2, 156, 5, P, 10), "m-steel")); // мачта-огонь
    // ротор: вращающийся стол с рисками
    push([cx, cy, 15], S(k.cylinder(cx, cy, 5.4, 14.4, 2.2, P, 32), "m-iron"));
    push([cx, cy, 16.7], L(k.radialTicks(cx, cy, 4.6, 16, 4, 16.6, [0.8, 1.6], P, state.rotor).major + k.radialTicks(cx, cy, 4.6, 16, 4, 16.6, [0.8, 1.6], P, state.rotor).minor, { tone: "hi" }));
    // талевый блок, крюк, вертлюг, квадрат (ведущая труба)
    const bz = state.block;
    pushBeam([cx, cy, 16.6], [cx, cy, bz - 6], 0.9, "m-iron");
    push([cx, cy, bz - 3], S(k.cylinder(cx, cy, 2, bz - 6, 4, P, 14), "m-steel"));
    pushBox(cx - 3.2, cy - 2, bz, 6.4, 4, 9, "m-yellow", { bevel: 0.5 });
    push([cx, cy, (bz + 152) / 2], [-2.2, -0.8, 0.8, 2.2].map((o) => L(k.segment([cx + o, cy, bz + 9], [cx + o * 0.8, cy, 152], P), { tone: "mid", className: "cable thin" })).join(""));
    // лебёдка (буровая лебёдка с барабаном) и дизели
    pushBox(cx - 40, cy - 8, 12, 16, 16, 9, "m-steel", { bevel: 0.6 });
    const dF = G.frameOf([cx - 32, cy - 9, 18], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    push([cx - 32, cy + 9, 18], S(G.disc(0, 18, 3.6, dF, P, { steps: 24 }), "m-iron"));
    for (const dy of [-16, -6, 4]) {
      pushBox(cx - 62, cy + dy, 0, 16, 8, 7, "m-green", { bevel: 0.5 });
      push([cx - 50, cy + dy + 4, 10], S(k.cylinder(cx - 50, cy + dy + 4, 0.9, 7, 6, P, 10), "m-iron"));
    }
    // приёмные мостки и стеллаж с трубами
    pushBox(cx + 21, cy - 3, 6, 40, 6, 1.6, "m-steel");
    for (const [sx, sz] of [[0, 0], [0, 1], [1, 0]]) {
      for (let i = 0; i < 4; i++) {
        const y = cy + 9 + i * 3.4 + sx * 1.7, z = 3.4 + sz * 3;
        const a = [cx + 24, y, z], b = [cx + 68, y, z];
        push(mid(a, b), rod(a, b, 1.5, "m-pipe", 12));
      }
    }
    for (const x of [cx + 28, cx + 46, cx + 64]) pushBox(x - 1, cy + 7, 0, 2, 16, 2, "m-wood");
    // буровые насосы и ёмкости раствора
    for (const y of [-30, -14]) {
      pushBox(cx + 30, cy + y, 0, 22, 10, 8, "m-red", { bevel: 0.5 });
      const f = G.frameOf([cx + 52, cy + y + 5, 4], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      push([cx + 54, cy + y + 5, 4], S(G.disc(0, 4, 2.6, f, P, { steps: 18 }), "m-iron"));
    }
    for (let i = 0; i < 3; i++) pushBox(cx + 4 + i * 22, cy - 82, 0, 20, 14, 9, "m-steel", { bevel: 0.6 });
    // будка бурильщика и вагончики
    pushBox(cx - 12, cy - 44, 0, 22, 12, 11, "m-cabin", { bevel: 0.6 });
    for (const y of [-74, -56]) {
      pushBox(cx - 80, cy + y, 0, 30, 12, 10, "m-cabin", { bevel: 0.6 });
      for (const wx of [-74, -64, -56]) push([cx + wx, cy + y + 12, 6], L(k.segment([cx + wx, cy + y + 12.05, 4.5], [cx + wx + 4, cy + y + 12.05, 4.5], P) + k.segment([cx + wx, cy + y + 12.05, 7.5], [cx + wx + 4, cy + y + 12.05, 7.5], P), { tone: "mid" }));
    }
    // газопровод на опорах — газ уходит в Актобе
    const gy = -40;
    for (let x = 150; x <= 196; x += 12) pushBox(x - 1, gy - 1, 0, 2, 2, 5, "m-steel");
    push([175, gy, 5], rod([140, gy, 6], [199, gy, 6], 1.6, "m-yellow", 14));
    // факел
    pushBox(186, 40, 0, 3, 3, 26, "m-steel");
    flame(t, [187.5, 41.5, 27]);
  }

  function flame(t, at) {
    if (still.matches) return;
    const s = k.iso(at, P), r = P.scale * 1.6;
    const f = 1 + 0.18 * Math.sin(t * 11) + 0.1 * Math.sin(t * 17);
    push(at, `<path class="flame" d="M${(s[0] - r * 1.4).toFixed(1)} ${s[1].toFixed(1)} Q${(s[0] - r).toFixed(1)} ${(s[1] - r * 3 * f).toFixed(1)} ${s[0].toFixed(1)} ${(s[1] - r * 5.2 * f).toFixed(1)} Q${(s[0] + r).toFixed(1)} ${(s[1] - r * 3 * f).toFixed(1)} ${(s[0] + r * 1.4).toFixed(1)} ${s[1].toFixed(1)} Z"/>`);
  }

  // Дым паровика
  const PUFFS = Array.from({ length: 9 }, (_, i) => ({ ph: i / 9, dx: rnd() * 8 - 2 }));
  function smoke(t) {
    for (const p of PUFFS) {
      const a = (t / 7 + p.ph) % 1;
      const pos = [D1[0] + 96 - a * 22 + p.dx * a, D1[1] - 22 - a * 14, 51 + a * 46];
      const s = k.iso(pos, P);
      push(pos, `<circle class="puff" cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${((1.5 + a * 6) * P.scale).toFixed(1)}" opacity="${(0.4 * Math.sin(Math.PI * a)).toFixed(2)}"/>`);
    }
  }

  // Кусты саксаула и полыни
  const BUSHES = Array.from({ length: 26 }, () => {
    let x, y;
    do { x = X0 + 8 + rnd() * (X1 - X0 - 16); y = Y0 + 8 + rnd() * (Y1 - Y0 - 16); }
    while ((Math.abs(x - D1[0]) < 30 && y > 30) || (Math.abs(x - D2[0]) < 75) || (x > -190 && x < -20 && y > -84 && y < -8) || (Math.abs(x + 168) < 18 && Math.abs(y - 30) < 18) || (x > -150 && x < -120 && y > 8 && y < 32) || (Math.abs(x + 58) < 14 && Math.abs(y - 18) < 14) || (x > -40 && x < 15 && y > 30));
    return { x, y, r: 1.4 + rnd() * 1.8 };
  });
  function bushes() {
    for (const b of BUSHES) push([b.x, b.y, 0], ball([b.x, b.y, b.r * 0.7], b.r, "m-bush"));
  }

  // ---------- Состояние и камера ----------
  const state = { az: 54, el: 30, zoom: 1, fx: 0, fy: 0, fz: -40, drill: 0, beam: 0, wheel: 0, rotor: 0, block: 120, gush: 0, tool: 0, found: false };
  const target = { az: 54, el: 30, zoom: 1, fx: 0, fy: 0, fz: -40, drill: 0, gush: 0 };
  let W = 0, H = 0, area = { x: 0, y: 0, w: 0, h: 0 };
  function resize() {
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height;
    svg.setAttribute("viewBox", `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);
    const wide = W >= 1000;
    area = wide ? { x: Math.min(700, W * 0.46), y: 40, w: W - Math.min(700, W * 0.46) - 24, h: H - 80 } : { x: 0, y: H * 0.04, w: W, h: H * 0.5 };
    // макет может задать свою область сцены: data-area="x,y,w,h" в пикселях
    if (root.dataset.area) { const [x, y, w, h] = root.dataset.area.split(",").map(Number); area = { x, y, w, h }; }
    dirty = true;
  }

  const EXTREMES = [[X0, Y0, Z.base], [X1, Y0, Z.base], [X0, Y1, Z.base], [X1, Y1, Z.base], [X0, Y0, 0], [X1, Y1, 0], [D2[0], D2[1], 160], [D1[0], D1[1], 120]];
  function camera() {
    const fit = k.fitProjection(EXTREMES, area.w, area.h, { pad: 10, azimuth: state.az, elevation: state.el });
    const p = { origin: [0, 0], scale: fit.scale * state.zoom, azimuth: state.az, elevation: state.el };
    const m = k.iso([state.fx, state.fy, state.fz], p);
    p.origin = [area.x + area.w / 2 - m[0], area.y + area.h / 2 - m[1]];
    return p;
  }

  // Ключевые кадры по разделам страницы (data-scene="az,zoom,fx,fy,fz,gush")
  const keys = [...document.querySelectorAll("[data-scene]")];
  const drillSection = document.querySelector("[data-drill]");
  function fromScroll() {
    const midY = innerHeight * 0.5;
    const pts = keys.map((el) => {
      const r = el.getBoundingClientRect();
      const v = el.dataset.scene.split(",").map(Number);
      return { c: r.top + Math.min(r.height, innerHeight) / 2, v };
    });
    let v = pts[0].v;
    if (midY >= pts[pts.length - 1].c) v = pts[pts.length - 1].v;
    else for (let i = 0; i < pts.length - 1; i++) {
      if (midY >= pts[i].c && midY < pts[i + 1].c) {
        const f = smooth((midY - pts[i].c) / (pts[i + 1].c - pts[i].c));
        v = pts[i].v.map((a, j) => lerp(a, pts[i + 1].v[j], f));
        break;
      }
    }
    [target.az, target.zoom, target.fx, target.fy, target.fz, target.gush] = v;
    if (drillSection) {
      const r = drillSection.getBoundingClientRect();
      const p = clamp((innerHeight * 0.75 - r.top) / (r.height * 0.85), 0, 1);
      target.drill = Math.max(p, r.bottom < 0 ? 1 : 0);
    }
  }

  const depthM = (d) => Math.round(d * 2894 / 10) * 10;
  function say() {
    const z = state.drill > 0.02 && state.fx > -10;
    const text = z
      ? (state.found ? "скв. №4 · приток из подсоли · 2 800–2 894 м" : `скв. №4 · бурение · ${depthM(state.drill).toLocaleString("ru-RU")} м`)
      : (state.gush > 0.05 ? "скв. №3 · фонтан · ≈225 м" : "скв. №3 · ударно-канатное бурение");
    if (readout && readout.textContent !== text) readout.textContent = text;
    const era = z ? "1978 · Жанажол · роторное бурение" : (state.fx < -10 ? "1911 · Доссор · деревянная вышка" : "Доссор 1911 — Жанажол 1978");
    if (eraLabel && eraLabel.textContent !== era) eraLabel.textContent = era;
  }

  function draw(t) {
    P = camera();
    items.length = 0;
    bushes();
    dossor(state, t);
    zhanazhol(state, t);
    seed = 99;
    // караван: четыре верблюда друг за другом
    const u0 = t * 0.012;
    for (let i = 0; i < 4; i++) {
      const r = routeAt(u0 - i * 0.062);
      camel(r.x, r.y, r.h, t * 3.2 + i * 1.3, i === 0);
    }
    smoke(t);
    items.sort((a, b) => a.d - b.d);
    world.innerHTML = ground(state) + items.map((i) => i.s).join("");
    svg.classList.toggle("found", state.found);
  }

  let frame = 0, last = 0, clock = 0, dirty = true, visible = true;
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const calm = still.matches;
    if (!calm) clock += dt;
    const ease = (a, b, tau) => (calm ? b : a + (b - a) * (1 - Math.exp(-dt / tau)));
    state.az = ease(state.az, target.az + (calm ? 0 : 1.6 * Math.sin(clock / 6)), 0.6);
    state.el = ease(state.el, 30 + 4 * (state.zoom - 1), 0.6);
    state.zoom = ease(state.zoom, target.zoom, 0.6);
    state.fx = ease(state.fx, target.fx, 0.6);
    state.fy = ease(state.fy, target.fy, 0.6);
    state.fz = ease(state.fz, target.fz, 0.6);
    const prevDrill = state.drill;
    state.drill = ease(state.drill, target.drill, 0.9);
    // фонтан: включается на разделе «Доссор 1911», с атакой и затуханием
    state.gush = ease(state.gush, target.gush, target.gush > state.gush ? 0.5 : 1.4);
    if (state.gush < 0.005) state.gush = 0;
    state.found = state.drill > 0.985;
    if (!calm) {
      state.beam = 0.15 * Math.sin(clock * 2.4);
      state.wheel = clock * 2.4;
      state.tool = 1.2 * Math.sin(clock * 2.4 - 0.4);
      state.rotor += dt * (state.found ? 0.6 : 2.6);
    }
    // талевый блок опускается по мере проходки и поднимается для наращивания свечи
    const stand = (state.drill * 14) % 1;
    state.block = 32 + 104 * (1 - stand) + (calm ? 0 : 0.6 * Math.sin(clock * 1.3));
    if (Math.abs(state.drill - prevDrill) > 1e-4) dirty = true;
    draw(clock);
    say();
    frame = visible && !document.hidden && !calm ? requestAnimationFrame(tick) : 0;
    if (calm) frame = 0;
  }
  const run = () => { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } };
  addEventListener("scroll", () => { fromScroll(); if (still.matches) requestAnimationFrame(tick); else run(); }, { passive: true });
  addEventListener("resize", () => { resize(); fromScroll(); run(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) run(); });
  still.addEventListener?.("change", run);
  resize();
  fromScroll();
  Object.assign(state, { az: target.az, zoom: target.zoom, fx: target.fx, fy: target.fy, fz: target.fz, drill: target.drill });
  run();
  window.__scene = { state, target, draw };
})();
