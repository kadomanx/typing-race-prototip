// ============================================================
//  Typing Race – Ses Motoru (sound.js)
//  Web Audio API ile harici dosya gerektirmeyen hafif SFX motoru
// ============================================================

const SoundFX = (() => {
  "use strict";

  let audioCtx = null;
  let isMuted = localStorage.getItem("typing_race_muted") === "true";

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

  // Kullanıcı ilk etkileşiminde AudioContext'i hazırla
  window.addEventListener("keydown", () => getAudioContext(), { once: true });
  window.addEventListener("click", () => getAudioContext(), { once: true });

  return {
    get isMuted() {
      return isMuted;
    },

    toggleMute() {
      isMuted = !isMuted;
      localStorage.setItem("typing_race_muted", isMuted ? "true" : "false");
      return isMuted;
    },

    // ── 1. Mekanik Klavye Tuş Sesi (Doğru vuruş) ───────────────
    playKeySuccess() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Çıt / Click transiyenti (Yüksek frekans darbesi)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Mekanik switch klik hissi: 2200Hz -> 400Hz ani düşüş
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1800 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);

      // Tok alt gövde sesi (Switch taban vuruşu)
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(160 + Math.random() * 30, now);
      gainSub.gain.setValueAtTime(0.12, now);
      gainSub.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      oscSub.connect(gainSub);
      gainSub.connect(ctx.destination);

      oscSub.start(now);
      oscSub.stop(now + 0.05);
    },

    // ── 2. Yanlış Tuş Vuruşu (Tok Hata Sesi) ───────────────────
    playKeyError() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      // Düşük geçiren filtre ile yumuşat
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
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
