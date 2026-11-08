// Фоновая музыка: степная тема, которую браузер играет сам (Web Audio), без аудиофайлов.
// Домбра — щипки двух струн (нижняя гудит, верхняя ведёт напев в пентатонике),
// кобыз — протяжный бурдон, ветер — отфильтрованный шум. Включается только кнопкой.
(() => {
  const buttons = [...document.querySelectorAll("[data-music]")];
  if (!buttons.length) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { buttons.forEach((b) => (b.hidden = true)); return; }

  let ctx = null, master = null, tone = null, timer = 0, playing = false;
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  // нижняя струна — D3, верхняя — G3 (обычный строй домбры кварта)
  const LOW = 50, SCALE = [55, 57, 60, 62, 65, 67, 69, 72]; // G3 A3 C4 D4 F4 G4 A4 C5
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    // общий «тембр»: чем глубже читатель, тем глуше звук
    tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 5200; tone.Q.value = 0.3;
    tone.connect(master); master.connect(ctx.destination);
    // реверберация — простор степи
    const verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    verb.connect(wet); wet.connect(tone);
    const bus = ctx.createGain(); bus.connect(tone); bus.connect(verb);
    ctx.bus = bus;

    // кобыз: два слегка расстроенных пилообразных тона D2 + A2, носовая форманта, медленное дыхание
    const drone = ctx.createGain(); drone.gain.value = 0.05;
    const nasal = ctx.createBiquadFilter(); nasal.type = "bandpass"; nasal.frequency.value = 620; nasal.Q.value = 1.4;
    const soft = ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 900;
    for (const [m, det] of [[38, -4], [38, 5], [45, 2]]) {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(soft); o.start();
    }
    soft.connect(nasal); nasal.connect(drone); soft.connect(drone);
    const breath = ctx.createOscillator(), depth = ctx.createGain();
    breath.frequency.value = 0.07; depth.gain.value = 0.025; breath.connect(depth); depth.connect(drone.gain); breath.start();
    drone.connect(bus);

    // ветер: шум через полосовой фильтр, частота которого гуляет
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 520; band.Q.value = 0.8;
    const gust = ctx.createOscillator(), gustDepth = ctx.createGain();
    gust.frequency.value = 0.045; gustDepth.gain.value = 320; gust.connect(gustDepth); gustDepth.connect(band.frequency); gust.start();
    const wind = ctx.createGain(); wind.gain.value = 0.018;
    src.connect(band); band.connect(wind); wind.connect(tone); src.start();
  }

  // щипок струны домбры
  function pluck(t, midi, vel) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(520, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    for (const [type, det, lvl] of [["sawtooth", -3, 0.6], ["triangle", 4, 1]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = hz(midi); o.detune.value = det; og.gain.value = lvl;
      o.connect(og); og.connect(f); o.start(t); o.stop(t + 1.2);
    }
    f.connect(g); g.connect(ctx.bus);
  }

  // Ритм кюя: размер 6/8, удары вниз-вверх; каждые 8 тактов — то плотная, то редкая часть
  const BEAT = 60 / 96 / 2; // восьмая при 96 ударах в минуту
  const STRUM = [1, 0, 0.55, 0.85, 0, 0.55];
  let step = 0, next = 0, idx = 3;
  function schedule() {
    while (next < ctx.currentTime + 0.35) {
      const bar = Math.floor(step / 6), pos = step % 6, part = Math.floor(bar / 8) % 2;
      const accent = STRUM[pos];
      if (accent && (part === 0 || pos === 0 || rnd() < 0.3)) {
        // напев: шаг по ладу, на сильной доле — опора на G или D
        if (pos === 0 && bar % 2 === 0) idx = rnd() < 0.5 ? 0 : 3;
        else if (rnd() < 0.6) idx = Math.max(0, Math.min(SCALE.length - 1, idx + (rnd() < 0.5 ? -1 : 1)));
        const v = 0.16 * accent * (0.85 + rnd() * 0.3);
        const jitter = (rnd() - 0.5) * 0.012;
        pluck(next + jitter, LOW, v * 0.75);
        pluck(next + jitter + 0.012, SCALE[idx], v);
      }
      step += 1;
      next += BEAT * (pos === 2 || pos === 5 ? 1.06 : 0.97); // лёгкая «скачущая» неровность
    }
  }

  function setLabel() {
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", String(playing));
      b.classList.toggle("on", playing);
      const label = b.querySelector("[data-music-label]");
      if (label) label.textContent = playing ? (b.dataset.on || "Музыка вкл.") : (b.dataset.off || "Музыка");
    });
  }

  async function start() {
    if (!ctx) build();
    await ctx.resume();
    playing = true;
    next = ctx.currentTime + 0.1;
    clearInterval(timer); timer = setInterval(schedule, 90); schedule();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.9);
    setLabel();
  }
  function stop() {
    playing = false; setLabel();
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    clearInterval(timer);
    setTimeout(() => { if (!playing) ctx.suspend(); }, 1200);
  }
  buttons.forEach((b) => b.addEventListener("click", () => {
    if (playing) stop(); else start();
    if (window.enableTilt) window.enableTilt(); // то же нажатие разрешает наклон на iPhone
    try { localStorage.setItem("music", playing ? "on" : "off"); } catch (e) {}
  }));

  // чем глубже по странице, тем глуше и ниже звучит степь
  addEventListener("scroll", () => {
    if (!ctx) return;
    const p = scrollY / Math.max(1, document.body.scrollHeight - innerHeight);
    tone.frequency.setTargetAtTime(5200 - 3400 * p, ctx.currentTime, 0.4);
  }, { passive: true });
  // на скрытой вкладке — пауза
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !playing) return;
    if (document.hidden) { clearInterval(timer); ctx.suspend(); }
    else ctx.resume().then(() => { next = ctx.currentTime + 0.1; timer = setInterval(schedule, 90); });
  });
  // если в прошлый раз музыку включали — подсветить кнопку (звук всё равно только после нажатия)
  try { if (localStorage.getItem("music") === "on") buttons.forEach((b) => b.classList.add("hint")); } catch (e) {}
  setLabel();
})();
