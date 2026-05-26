/* Carbly hero film — Remotion-style timeline
   30fps, 360 frames total (12s). Self-contained DOM animation.

   Chapters:
     01 Aim      0-60   (2.0s)  — camera viewfinder, detection lock
     02 Snap     60-90  (1.0s)  — shutter press + flash
     03 Talk     90-180 (3.0s)  — voice context, transcript builds
     04 Analyze  180-240 (2.0s) — AI scan beam
     05 Log      240-360 (4.0s) — result reveals
*/
(function () {
  'use strict';

  const FPS = 30;
  const DURATION = 360;

  const CHAPTERS = [
    { id: 'aim',     label: '01 Aim',     start: 0,   end: 60,  caption: '01 · POINT AT THE PLATE' },
    { id: 'snap',    label: '02 Snap',    start: 60,  end: 90,  caption: '02 · CAPTURE' },
    { id: 'talk',    label: '03 Talk',    start: 90,  end: 180, caption: '03 · TALK TO YOUR FOOD' },
    { id: 'analyze', label: '04 Analyze', start: 180, end: 240, caption: '04 · ANALYZING' },
    { id: 'log',     label: '05 Log',     start: 240, end: 360, caption: '05 · LOG IT' },
  ];

  // Voice transcript word reveal frames (relative to chapter start at 90)
  const WORD_FRAMES = [10, 28, 48, 68]; // 4 word groups

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  const norm = (f, a, b) => clamp((f - a) / (b - a), 0, 1);

  function fmt(t) {
    // M:SS (e.g. 0:12 for 12s) — unambiguous as wall-clock time
    const total = Math.floor(t);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const state = {
    frame: 0,
    playing: true,
    raf: null,
    lastTs: 0,
    dragging: false,
  };

  function mount() {
    const root = document.querySelector('[data-film]');
    if (!root) return;

    const chapters = root.querySelector('[data-chapters]');
    const markers = root.querySelector('[data-markers]');
    CHAPTERS.forEach((ch, i) => {
      const btn = document.createElement('button');
      btn.className = 'transport__chapter';
      btn.dataset.chapter = ch.id;
      const seconds = ((ch.end - ch.start) / FPS).toFixed(1);
      btn.innerHTML = `${ch.label}<span>${seconds}s</span>`;
      btn.addEventListener('click', () => seek(ch.start));
      chapters.appendChild(btn);

      if (i > 0) {
        const m = document.createElement('div');
        m.className = 'transport__marker';
        m.style.left = `${(ch.start / DURATION) * 100}%`;
        markers.appendChild(m);
      }
    });

    const playBtn = root.querySelector('[data-play]');
    playBtn.addEventListener('click', togglePlay);

    const track = root.querySelector('[data-track]');
    const onPointer = (e) => {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const t = clamp(x / rect.width, 0, 1);
      seek(t * DURATION);
    };
    track.addEventListener('mousedown', (e) => {
      state.dragging = true;
      if (state.playing) togglePlay();
      onPointer(e);
    });
    window.addEventListener('mousemove', (e) => { if (state.dragging) onPointer(e); });
    window.addEventListener('mouseup', () => { state.dragging = false; });
    track.addEventListener('touchstart', (e) => { state.dragging = true; onPointer(e); }, { passive: true });
    track.addEventListener('touchmove', (e) => { if (state.dragging) onPointer(e); }, { passive: true });
    track.addEventListener('touchend', () => { state.dragging = false; });

    const nodes = {
      root,
      scenes: {
        cam:    root.querySelector('[data-scene="cam"]'),
        voice:  root.querySelector('[data-scene="voice"]'),
        proc:   root.querySelector('[data-scene="proc"]'),
        result: root.querySelector('[data-scene="result"]'),
      },
      plate:   root.querySelector('[data-meal-wrap]'),
      bbox:    root.querySelector('[data-bbox]'),
      reticle: root.querySelector('[data-reticle]'),
      shutter: root.querySelector('[data-shutter]'),
      flash:   root.querySelector('[data-flash]'),
      voiceWave: root.querySelector('[data-voice-wave]'),
      voiceTranscript: root.querySelector('[data-voice-transcript]'),
      voiceWords: root.querySelectorAll('[data-voice-transcript] [data-word]'),
      procCard: root.querySelector('[data-proc-card]'),
      procBeam: root.querySelector('[data-proc-beam]'),
      pill:    root.querySelector('[data-result-pill]'),
      title:   root.querySelector('[data-result-title]'),
      conf:    root.querySelector('[data-result-conf]'),
      carbs:   root.querySelector('[data-result-carbs]'),
      carbsLabel: root.querySelector('[data-result-carbs-label]'),
      health:  root.querySelector('[data-result-health]'),
      macros:  root.querySelectorAll('[data-result-macro]'),
      electro: root.querySelector('[data-result-electro]'),
      note:    root.querySelector('[data-result-note]'),
      scroll:  root.querySelector('[data-result-scroll]'),
      caption: root.querySelector('[data-caption]'),
      captionText: root.querySelector('[data-caption-text]'),
      scnNum:  root.querySelector('[data-scn]'),
      head:    root.querySelector('[data-head]'),
      fill:    root.querySelector('[data-fill]'),
      tCurrent: root.querySelector('[data-time-current]'),
      tTotal:   root.querySelector('[data-time-total]'),
      playIcon: root.querySelector('[data-play-icon]'),
      pauseIcon: root.querySelector('[data-pause-icon]'),
    };

    state.nodes = nodes;
    nodes.tTotal.textContent = fmt(DURATION / FPS);

    // Cache voice wave bars
    state.voiceBars = nodes.voiceWave ? Array.from(nodes.voiceWave.querySelectorAll('.bar')) : [];

    render();

    state.lastTs = performance.now();
    state.raf = requestAnimationFrame(tick);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(state.raf);
      } else if (state.playing) {
        state.lastTs = performance.now();
        state.raf = requestAnimationFrame(tick);
      }
    });

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) {
      togglePlay();
      seek(260);
    }
  }

  function togglePlay() {
    state.playing = !state.playing;
    const n = state.nodes;
    n.playIcon.style.display = state.playing ? 'none' : 'block';
    n.pauseIcon.style.display = state.playing ? 'block' : 'none';
    if (state.playing) {
      state.lastTs = performance.now();
      state.raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(state.raf);
    }
  }

  function seek(frame) {
    state.frame = clamp(frame, 0, DURATION - 1);
    render();
  }

  function tick(ts) {
    const dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;
    if (state.playing) {
      state.frame += dt * FPS;
      if (state.frame >= DURATION) state.frame = 0;
      render();
    }
    if (state.playing) state.raf = requestAnimationFrame(tick);
  }

  function setScene(name) {
    const n = state.nodes;
    Object.entries(n.scenes).forEach(([k, el]) => {
      if (el) el.classList.toggle('is-active', k === name);
    });
  }

  // Pseudo-random but deterministic noise for wave bars
  function noise(seed, t) {
    const x = Math.sin(seed * 12.9898 + t * 0.13) * 43758.5453;
    return x - Math.floor(x);
  }

  function render() {
    const f = state.frame;
    const n = state.nodes;

    let activeCh = CHAPTERS[0];
    let chIdx = 0;
    for (let i = 0; i < CHAPTERS.length; i++) {
      if (f >= CHAPTERS[i].start && f < CHAPTERS[i].end) {
        activeCh = CHAPTERS[i];
        chIdx = i;
        break;
      }
    }
    if (f >= CHAPTERS[CHAPTERS.length-1].end - 1) {
      activeCh = CHAPTERS[CHAPTERS.length-1];
      chIdx = CHAPTERS.length-1;
    }

    // Scene switching
    if (f < 90) setScene('cam');
    else if (f < 180) setScene('voice');
    else if (f < 240) setScene('proc');
    else setScene('result');

    // Caption + scene number
    n.captionText.textContent = activeCh.caption;
    n.caption.classList.add('is-visible');
    if (n.scnNum) n.scnNum.textContent = String(chIdx + 1).padStart(2, '0');

    // ---- AIM (0 - 60) ----
    if (f < 60) {
      const plateP = norm(f, 0, 24);
      const plateScale = lerp(0.92, 1.0, easeOut(plateP));
      n.plate.style.transform = `translate(-50%, -50%) rotate(-3deg) scale(${plateScale})`;
      n.plate.style.opacity = plateP.toFixed(3);

      // Reticle visible early, fades when bbox locks
      n.reticle.style.opacity = norm(f, 6, 22).toFixed(3) * (1 - norm(f, 30, 50));

      // Bbox locks on at ~28
      if (f >= 28) {
        const bP = norm(f, 28, 44);
        const scale = lerp(1.15, 1.0, easeOut(bP));
        n.bbox.style.transform = `translate(-50%, -50%) scale(${scale})`;
        n.bbox.style.opacity = bP.toFixed(3);
      } else {
        n.bbox.style.opacity = '0';
      }

      // Subtle float
      const float = Math.sin(f * 0.09) * 1.2;
      n.plate.style.top = `${50 + float * 0.1}%`;
    }

    // ---- SNAP (60 - 90) ----
    if (f >= 60 && f < 90) {
      // Hold the locked frame
      n.plate.style.opacity = '1';
      n.bbox.style.opacity = '1';

      // Shutter press at f=62, flash burst at 66-78
      if (n.shutter) {
        n.shutter.classList.toggle('is-press', f >= 62 && f < 78);
      }
      if (f >= 66 && f < 82) {
        const flashP = norm(f, 66, 82);
        n.flash.style.opacity = (Math.pow(1 - flashP, 1.5)).toFixed(3);
      } else {
        n.flash.style.opacity = '0';
      }
    } else if (f < 60 || f >= 90) {
      if (n.shutter) n.shutter.classList.remove('is-press');
      if (f >= 90) n.flash.style.opacity = '0';
    }

    // ---- TALK (90 - 180) ----
    if (f >= 90 && f < 180) {
      const local = f - 90;

      // Animate waveform bars
      const speakingP = clamp(norm(local, 8, 78), 0, 1); // speech window
      const decayP = norm(local, 78, 86); // brief settle
      const speaking = (speakingP > 0 && speakingP < 1) || (local >= 8 && local < 86);
      state.voiceBars.forEach((bar, i) => {
        const seed = i + 1;
        // Noisy amplitude modulated by speech window
        let amp = noise(seed, local * 0.6 + i * 0.12);
        // Slight wave pattern across bars
        amp *= 0.55 + 0.45 * Math.sin(local * 0.18 + i * 0.4);
        amp = Math.abs(amp);
        // Envelope
        const env = (local < 8) ? norm(local, 0, 8)
                  : (local > 78) ? (1 - norm(local, 78, 86))
                  : 1;
        const h = lerp(3, 36, amp * env);
        bar.style.height = `${h}px`;
      });

      // Word reveal
      n.voiceWords.forEach((w, i) => {
        const showAt = WORD_FRAMES[i] || 999;
        w.classList.toggle('is-shown', local >= showAt);
      });
    } else {
      // Reset voice bars/words
      state.voiceBars.forEach(b => { b.style.height = '3px'; });
      n.voiceWords.forEach(w => w.classList.remove('is-shown'));
    }

    // ---- ANALYZE (180 - 240) ----
    if (f >= 180 && f < 240) {
      const local = f - 180;
      const cardP = norm(local, 0, 18);
      const cardScale = lerp(0.86, 1.0, easeOut(cardP));
      n.procCard.style.transform = `scale(${cardScale})`;
      n.procCard.style.opacity = cardP.toFixed(3);

      // Beam cycles top-to-bottom every ~30 frames
      const beamP = ((local) / 30) % 1;
      n.procBeam.style.top = `${beamP * 100 - 28}%`;
      n.procBeam.style.opacity = norm(local, 4, 14).toFixed(3);

      if (local >= 48) {
        const fadeP = norm(local, 48, 60);
        n.procBeam.style.opacity = (1 - fadeP).toFixed(3);
      }
    }

    // ---- LOG / RESULT (240 - 360) ----
    if (f >= 240) {
      const local = f - 240;

      const pillP = norm(local, 0, 14);
      const pillY = lerp(10, 0, easeOut(pillP));
      n.pill.style.transform = `translateY(${pillY}px)`;
      n.pill.style.opacity = pillP.toFixed(3);

      const titleP = norm(local, 6, 22);
      n.title.style.opacity = titleP.toFixed(3);
      n.title.style.transform = `translateY(${lerp(8, 0, easeOut(titleP))}px)`;

      const confP = norm(local, 14, 28);
      n.conf.style.opacity = confP.toFixed(3);

      const carbsP = norm(local, 20, 44);
      n.carbsLabel.style.opacity = norm(local, 18, 32).toFixed(3);
      const carbVal = Math.round(lerp(0, 42, easeOut(carbsP)));
      n.carbs.textContent = `${carbVal}g`;
      n.carbs.style.opacity = carbsP.toFixed(3);
      n.carbs.style.transform = `scale(${lerp(0.86, 1, easeOut(carbsP))})`;

      const healthP = norm(local, 38, 58);
      n.health.style.opacity = healthP.toFixed(3);
      n.health.style.transform = `translateY(${lerp(12, 0, easeOut(healthP))}px)`;

      n.macros.forEach((el, i) => {
        const p = norm(local, 50 + i * 5, 68 + i * 5);
        el.style.opacity = p.toFixed(3);
        el.style.transform = `translateY(${lerp(10, 0, easeOut(p))}px)`;
      });

      const elP = norm(local, 72, 92);
      n.electro.style.opacity = elP.toFixed(3);
      n.electro.style.transform = `translateY(${lerp(10, 0, easeOut(elP))}px)`;
      const noteP = norm(local, 86, 104);
      n.note.style.opacity = noteP.toFixed(3);
      n.note.style.transform = `translateY(${lerp(10, 0, easeOut(noteP))}px)`;

      const scrollP = norm(local, 96, 118);
      const scrollY = lerp(0, -72, easeInOut(scrollP));
      n.scroll.style.transform = `translateY(${scrollY}px)`;
    } else {
      n.pill.style.opacity = '0';
      n.title.style.opacity = '0';
      n.conf.style.opacity = '0';
      n.carbs.style.opacity = '0';
      n.carbsLabel.style.opacity = '0';
      n.health.style.opacity = '0';
      n.macros.forEach(el => el.style.opacity = '0');
      n.electro.style.opacity = '0';
      n.note.style.opacity = '0';
      n.scroll.style.transform = 'translateY(0)';
    }

    // ---- Transport ----
    const pct = (f / DURATION) * 100;
    n.fill.style.width = `${pct}%`;
    n.head.style.left = `${pct}%`;
    n.tCurrent.textContent = fmt(f / FPS);

    document.querySelectorAll('.transport__chapter').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.chapter === activeCh.id);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

// ---------- Sync the meal photo from <image-slot id="meal-photo"> to scenes ----------
(function () {
  'use strict';
  function setMealPhoto(url) {
    const film = document.querySelector('[data-film]');
    if (!film) return;
    film.style.setProperty('--meal-photo',
      url ? `url("${url.replace(/"/g, '\\"')}")` : '');
  }

  function start() {
    const slot = document.querySelector('image-slot#meal-photo');
    if (!slot) return;
    const probe = () => {
      // Read the inner <img> from the slot's shadow DOM
      const innerImg = slot.shadowRoot && slot.shadowRoot.querySelector('img[part="image"]');
      if (innerImg && innerImg.src && innerImg.style.display !== 'none') {
        setMealPhoto(innerImg.src);
      } else {
        setMealPhoto('');
      }
    };
    // Initial check (allow image-slot to hydrate from sidecar)
    let tries = 0;
    const initial = setInterval(() => {
      probe();
      tries++;
      if (tries > 40) clearInterval(initial); // give up after 4s
    }, 100);
    // MutationObserver on the shadow DOM image — fires whenever src/display flips
    requestAnimationFrame(() => {
      const innerImg = slot.shadowRoot && slot.shadowRoot.querySelector('img[part="image"]');
      if (!innerImg) return;
      const mo = new MutationObserver(probe);
      mo.observe(innerImg, { attributes: true, attributeFilter: ['src', 'style'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
(function () {
  'use strict';
  function mount() {
    const wave = document.querySelector('[data-talk-wave]');
    const transcript = document.querySelector('[data-talk-transcript]');
    if (!wave) return;

    // Build 36 bars
    const BAR_COUNT = 36;
    const bars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const b = document.createElement('span');
      b.className = 'bar';
      b.style.height = '4px';
      wave.appendChild(b);
      bars.push(b);
    }

    // Words to reveal
    const words = transcript ? Array.from(transcript.querySelectorAll('.word')) : [];
    let start = performance.now();
    const WORD_AT = [400, 1100, 2000, 2900, 3600, 4400, 5200]; // ms

    function noise(seed, t) {
      const x = Math.sin(seed * 12.9898 + t * 0.013) * 43758.5453;
      return x - Math.floor(x);
    }

    function frame(ts) {
      const elapsed = ts - start;
      const cycle = elapsed % 7000; // 7s loop

      // Reset on loop
      if (cycle < 60) {
        words.forEach(w => w.classList.remove('is-shown'));
      }

      // Word reveal
      words.forEach((w, i) => {
        if (cycle >= (WORD_AT[i] || 99999)) w.classList.add('is-shown');
      });

      // Bars: active during speech window (300-5800ms in cycle)
      const speaking = cycle > 300 && cycle < 5800;
      bars.forEach((b, i) => {
        let amp = noise(i + 7, cycle * 0.6 + i * 17);
        amp *= 0.55 + 0.45 * Math.sin(cycle * 0.006 + i * 0.4);
        amp = Math.abs(amp);
        const env = !speaking ? 0.06 : 1;
        const h = 4 + amp * env * 48;
        b.style.height = `${h}px`;
      });

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
