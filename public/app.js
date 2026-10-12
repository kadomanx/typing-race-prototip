// ============================================================
//  Typing Race – İstemci Tarafı (app.js)
//  Socket.io bağlantısı, yazma motoru, mod seçimi ve
//  kategori bazlı liderlik tablosu
//  v2: Oyun modları + kategorize skorboard
// ============================================================

(() => {
  "use strict";

  // ── Socket.io Bağlantısı ────────────────────────────────────
  const socket = io();

  // ── DOM Referansları ────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    welcome: $("#screen-welcome"),
    game: $("#screen-game"),
    result: $("#screen-result"),
  };

  const els = {
    nicknameInput: $("#nickname-input"),
    btnStart: $("#btn-start"),
    modeBtns: $$(".mode-btn"),
    gameModeBadge: $("#game-mode-badge"),
    textDisplay: $("#text-display"),
    typingInput: $("#typing-input"),
    statWpm: $("#stat-wpm"),
    statAccuracy: $("#stat-accuracy"),
    statTimer: $("#stat-timer"),
    resultModeBadge: $("#result-mode-badge"),
    resultWpm: $("#result-wpm"),
    resultAccuracy: $("#result-accuracy"),
    btnPlayAgain: $("#btn-play-again"),
    leaderboardTabs: $$(".lb-tab"),
    leaderboardBody: $("#leaderboard-body"),
    leaderboardEmpty: $("#leaderboard-empty"),
  };

  // ── Mod Etiket Haritası ─────────────────────────────────────
  const MODE_LABELS = {
    SOLO_WORDS: { icon: "📝", name: "Kelime Akışı" },
    SOLO_TEXT:  { icon: "📖", name: "Tam Metin" },
    SOLO_CODE:  { icon: "💻", name: "Kod Snippet" },
  };

  // ── Oyun Durumu (State) ─────────────────────────────────────
  let state = {
    nickname: "",
    selectedMode: "SOLO_WORDS",     // Varsayılan mod
    activeCategory: "SOLO_WORDS",   // Leaderboard'da aktif sekme
    targetText: "",                 // Sunucudan gelen metin
    charElements: [],               // Her harf için <span> referansları
    currentIndex: 0,                // Şu an yazılan harf pozisyonu
    correctCount: 0,                // Doğru vuruş sayısı
    totalKeystrokes: 0,             // Toplam tuş vuruşu (doğru + yanlış)
    startTime: null,                // Yazma başlangıç zamanı
    timerInterval: null,            // Süre sayacı interval ID
    isFinished: false,
    allScores: {},                  // Sunucudan gelen tüm kategoriler
  };

  // ── Ekran Geçişi ────────────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ══════════════════════════════════════════════════════════════
  //  MOD SEÇİMİ
  // ══════════════════════════════════════════════════════════════

  els.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Tüm butonlardan "active" kaldır, tıklanana ekle
      els.modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedMode = btn.dataset.mode;
    });
  });

  /** Mod rozeti göster */
  function renderModeBadge(containerEl, mode) {
    const label = MODE_LABELS[mode] || MODE_LABELS.SOLO_TEXT;
    containerEl.textContent = `${label.icon} ${label.name}`;
  }

  // ══════════════════════════════════════════════════════════════
  //  RUMUZ GİRİŞİ & OYUN BAŞLATMA
  // ══════════════════════════════════════════════════════════════

  els.nicknameInput.addEventListener("input", () => {
    const val = els.nicknameInput.value.trim();
    els.btnStart.disabled = val.length === 0;
  });

  els.nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !els.btnStart.disabled) {
      els.btnStart.click();
    }
  });

  els.btnStart.addEventListener("click", () => {
    state.nickname = els.nicknameInput.value.trim();
    if (!state.nickname) return;

    // Sunucudan seçilen moda göre metin iste
    socket.emit("game:request-text", { mode: state.selectedMode });
  });

  // ── Sunucudan Metin Geldi ───────────────────────────────────
  socket.on("game:text", ({ text, mode }) => {
    resetGameState();
    state.targetText = text;
    state.selectedMode = mode;  // Sunucudan gelen modla senkronize ol

    // Mod rozetini güncelle
    renderModeBadge(els.gameModeBadge, mode);

    // Kod modu için monospace font uygula
    if (mode === "SOLO_CODE") {
      els.textDisplay.classList.add("code-mode");
      els.typingInput.classList.add("code-mode");
    } else {
      els.textDisplay.classList.remove("code-mode");
      els.typingInput.classList.remove("code-mode");
    }

    renderText(text);
    showScreen("game");
    els.typingInput.value = "";
    els.typingInput.focus();
  });

  // ══════════════════════════════════════════════════════════════
  //  YAZMA MOTORU
  // ══════════════════════════════════════════════════════════════

  /** Metin Render (Her harf için <span>) */
  function renderText(text) {
    els.textDisplay.innerHTML = "";
    state.charElements = [];

    for (let i = 0; i < text.length; i++) {
      const span = document.createElement("span");
      span.classList.add("char");
      span.textContent = text[i];
      els.textDisplay.appendChild(span);
      state.charElements.push(span);
    }

    // İlk harfi "current" olarak işaretle
    if (state.charElements.length > 0) {
      state.charElements[0].classList.add("current");
    }
  }

  /** Oyun durumunu sıfırla */
  function resetGameState() {
    state.currentIndex = 0;
    state.correctCount = 0;
    state.totalKeystrokes = 0;
    state.startTime = null;
    state.isFinished = false;

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    els.statWpm.textContent = "0";
    els.statAccuracy.textContent = "100%";
    els.statTimer.textContent = "0s";
  }

  /** Tuş dinleme – anlık karakter karşılaştırma */
  els.typingInput.addEventListener("input", () => {
    if (state.isFinished) return;

    const inputVal = els.typingInput.value;
    const inputLen = inputVal.length;

    // İlk tuş vuruşunda sayacı başlat
    if (!state.startTime && inputLen > 0) {
      state.startTime = Date.now();
      startTimer();
    }

    // Tüm harfleri yeniden değerlendir (kullanıcı geri silmiş olabilir)
    let correctSoFar = 0;

    for (let i = 0; i < state.charElements.length; i++) {
      const charEl = state.charElements[i];
      charEl.classList.remove("correct", "incorrect", "current");

      if (i < inputLen) {
        if (inputVal[i] === state.targetText[i]) {
          charEl.classList.add("correct");
          correctSoFar++;
        } else {
          charEl.classList.add("incorrect");
        }
      } else if (i === inputLen) {
        charEl.classList.add("current");
      }
    }

    state.currentIndex = inputLen;
    state.correctCount = correctSoFar;
    state.totalKeystrokes = inputLen;

    // Anlık istatistikleri güncelle
    updateStats();

    // Tüm metin yazıldı mı?
    if (inputLen >= state.targetText.length) {
      finishGame();
    }
  });

  /** Kopyala-yapıştır engeli */
  els.typingInput.addEventListener("paste", (e) => e.preventDefault());

  /** Anlık istatistik güncelleme */
  function updateStats() {
    const elapsed = getElapsedMinutes();

    // WPM = (Doğru Karakter / 5) / Dakika
    const wpm = elapsed > 0 ? (state.correctCount / 5) / elapsed : 0;
    els.statWpm.textContent = Math.round(wpm);

    // Doğruluk = (Doğru Karakter / Toplam Vuruş) × 100
    const accuracy =
      state.totalKeystrokes > 0
        ? (state.correctCount / state.totalKeystrokes) * 100
        : 100;
    els.statAccuracy.textContent = Math.round(accuracy) + "%";
  }

  function getElapsedMinutes() {
    if (!state.startTime) return 0;
    return (Date.now() - state.startTime) / 60000;
  }

  function getElapsedSeconds() {
    if (!state.startTime) return 0;
    return Math.floor((Date.now() - state.startTime) / 1000);
  }

  /** Süre sayacı */
  function startTimer() {
    state.timerInterval = setInterval(() => {
      els.statTimer.textContent = getElapsedSeconds() + "s";
      updateStats();
    }, 1000);
  }

  // ══════════════════════════════════════════════════════════════
  //  OYUN BİTİŞİ & SKOR GÖNDERME
  // ══════════════════════════════════════════════════════════════

  function finishGame() {
    state.isFinished = true;

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    const elapsed = getElapsedMinutes();
    const finalWpm = elapsed > 0 ? (state.correctCount / 5) / elapsed : 0;
    const finalAccuracy =
      state.totalKeystrokes > 0
        ? (state.correctCount / state.totalKeystrokes) * 100
        : 100;

    // Sonuç ekranını güncelle
    els.resultWpm.textContent = Math.round(finalWpm * 100) / 100;
    els.resultAccuracy.textContent = Math.round(finalAccuracy * 100) / 100 + "%";
    renderModeBadge(els.resultModeBadge, state.selectedMode);

    // Skoru sunucuya gönder (mod bilgisiyle birlikte)
    socket.emit("game:submit-score", {
      nickname: state.nickname,
      wpm: Math.round(finalWpm * 100) / 100,
      accuracy: Math.round(finalAccuracy * 100) / 100,
      mode: state.selectedMode,
    });

    // Leaderboard sekmesini oynanan moda geçir
    switchLeaderboardTab(state.selectedMode);

    showScreen("result");
  }

  // ── Tekrar Oyna ─────────────────────────────────────────────
  els.btnPlayAgain.addEventListener("click", () => {
    socket.emit("game:request-text", { mode: state.selectedMode });
  });

  // ══════════════════════════════════════════════════════════════
  //  KATEGORİ BAZLI LİDERLİK TABLOSU
  // ══════════════════════════════════════════════════════════════

  /** Leaderboard sekme tıklama */
  els.leaderboardTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchLeaderboardTab(tab.dataset.category);
    });
  });

  /** Aktif sekmeyi değiştir ve ilgili kategoriyi render et */
  function switchLeaderboardTab(category) {
    state.activeCategory = category;

    // Sekme stillerini güncelle
    els.leaderboardTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.category === category);
    });

    // Aktif kategorinin skorlarını render et
    const scores = state.allScores[category] || [];
    renderLeaderboard(scores);
  }

  /** Sunucudan gelen skorları kaydet ve aktif sekmeyi yeniden render et */
  socket.on("leaderboard:update", (allScores) => {
    state.allScores = allScores;
    const scores = allScores[state.activeCategory] || [];
    renderLeaderboard(scores);
  });

  /** Leaderboard tablosunu render et (Top 10) */
  function renderLeaderboard(scores) {
    els.leaderboardBody.innerHTML = "";

    if (!scores || scores.length === 0) {
      els.leaderboardEmpty.style.display = "block";
      return;
    }

    els.leaderboardEmpty.style.display = "none";

    scores.forEach((entry, index) => {
      const tr = document.createElement("tr");

      // Sıra numarası (ilk 3 için madalya)
      const medals = ["🥇", "🥈", "🥉"];
      const rank = index < 3 ? medals[index] : index + 1;

      tr.innerHTML = `
        <td>${rank}</td>
        <td>${escapeHtml(entry.nickname)}</td>
        <td>${entry.wpm}</td>
        <td>${entry.accuracy}%</td>
      `;

      els.leaderboardBody.appendChild(tr);
    });
  }

  /** XSS koruması için HTML escape */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Hata Mesajları ──────────────────────────────────────────
  socket.on("game:error", ({ message }) => {
    alert("Hata: " + message);
  });

  // ── Bağlantı Durumu ────────────────────────────────────────
  socket.on("connect", () => {
    console.log("✅ Sunucuya bağlanıldı:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Sunucu bağlantısı kesildi");
  });
})();
