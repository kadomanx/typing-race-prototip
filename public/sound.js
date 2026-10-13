// ============================================================
//  Typing Race – Ses Motoru (sound.js)
//  Gerçek 10fastfingers & Monkeytype (Cherry / Click) WAV sesleri
//  Web Audio API AudioBuffer ile sıfır gecikmeli çoklu çalma
// ============================================================

const SoundFX = (() => {
  "use strict";

  let audioCtx = null;
  let isMuted = localStorage.getItem("typing_race_muted") === "true";

  // Ses dosyası havuzu
  const clickBuffers = [];
  let errorBuffer = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Ses dosyalarını belleğe (AudioBuffer) önceden yükle
  async function loadAudioBuffer(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const ctx = getAudioContext();
      if (!ctx) return null;
      return await ctx.decodeAudioData(arrayBuf);
    } catch {
      return null;
    }
  }

  async function initSounds() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const [c1, c2, c3, err] = await Promise.all([
        loadAudioBuffer("/sounds/click1.wav"),
        loadAudioBuffer("/sounds/click2.wav"),
        loadAudioBuffer("/sounds/click3.wav"),
        loadAudioBuffer("/sounds/error.wav"),
      ]);
      if (c1) clickBuffers.push(c1);
      if (c2) clickBuffers.push(c2);
      if (c3) clickBuffers.push(c3);
      if (err) errorBuffer = err;
    } catch (e) {
      console.warn("Ses dosyaları yüklenirken hata:", e);
    }
  }

  // İlk kullanıcı etkileşiminde sesleri başlat ve belleğe al
  const startTrigger = () => {
    getAudioContext();
    initSounds();
    window.removeEventListener("keydown", startTrigger);
    window.removeEventListener("click", startTrigger);
  };
  window.addEventListener("keydown", startTrigger, { once: true });
  window.addEventListener("click", startTrigger, { once: true });

  // Sayfa yüklendiğinde arka planda sesleri indir
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSounds);
  } else {
    initSounds();
  }

  return {
    get isMuted() {
      return isMuted;
    },

    toggleMute() {
      isMuted = !isMuted;
      localStorage.setItem("typing_race_muted", isMuted ? "true" : "false");
      return isMuted;
    },

    // ── 1. Doğru Tuş Vuruşu (10FastFingers / Monkeytype Click) ────
    playKeySuccess() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      // Eğer WAV AudioBuffer hazırsa, 3 varyasyondan birini rastgele çal
      if (clickBuffers.length > 0) {
        const buf = clickBuffers[Math.floor(Math.random() * clickBuffers.length)];
        const source = ctx.createBufferSource();
        source.buffer = buf;

        // Çok hafif pitch varyasyonu ile doğal daktilo/klavye hissi
        source.playbackRate.value = 0.96 + Math.random() * 0.08;

        const gain = ctx.createGain();
        gain.gain.value = 0.55;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        return;
      }

      // Fallback (Buffer henüz inmediyse hafif temiz click)
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.02);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    },

    // ── 2. Yanlış Tuş Vuruşu (Monkeytype / 10FastFingers Hata Sesi) ─
    playKeyError() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      if (errorBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = errorBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.45;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        return;
      }

      // Fallback
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    },

    // ── 3. Geri Sayım Bip Sesi (3.. 2.. 1..) ───────────────────
    playCountdownTick(count) {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (count > 0) {
        // Normal geri sayım bipi (600Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(count === 1 ? 700 : 550, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
      } else {
        // BAŞLA! Başlangıç Zili (Çift Tonlu Çan - 1050Hz + 1400Hz)
        [1050, 1400].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.65);
        });
      }
    },

    // ── 4. Zafer / Bitiş Fanfarı (Majör Arpej) ─────────────────
    playVictory() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // C5, E5, G5, C6 notaları (523, 659, 784, 1046 Hz)
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.14 },
        { freq: 659.25, time: 0.14, dur: 0.14 },
        { freq: 783.99, time: 0.28, dur: 0.16 },
        { freq: 1046.50, time: 0.44, dur: 0.45 },
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0.28, now + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur + 0.05);
      });
    },

    // ── 5. Odak Kaybı / Hile Uyarısı Sesi ───────────────────────
    playWarning() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(220, now + 0.12);
      osc.frequency.setValueAtTime(140, now + 0.24);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    },
  };
})();
