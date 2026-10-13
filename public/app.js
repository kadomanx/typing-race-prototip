// ============================================================
//  Typing Race – İstemci Tarafı (app.js)
//  v3: Solo Modlar + Multiplayer Arena (1v1v1) Canlı Yarış Motoru
// ============================================================

(() => {
  "use strict";

  // ── Socket.io Bağlantısı ────────────────────────────────────
  const socket = io();

  // ── DOM Seçicileri ──────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    welcome: $("#screen-welcome"),
    lobby: $("#screen-lobby"),
    game: $("#screen-game"),
    result: $("#screen-result"),
  };

  const els = {
    // Hoşgeldin Ekranı
    nicknameInput: $("#nickname-input"),
    btnStart: $("#btn-start"),
    modeBtns: $$(".mode-btn"),
    arenaRoomGroup: $("#arena-room-group"),
    roomInput: $("#room-input"),
    radioAutoRoom: $("#radio-auto-room"),
    radioCustomRoom: $("#radio-custom-room"),

    // Lobi Ekranı
    lobbyRoomName: $("#lobby-room-name"),
    lobbyPlayerList: $("#lobby-player-list"),
    btnStartRace: $("#btn-start-race"),
    lobbyWaitingMsg: $("#lobby-waiting-msg"),
    btnLeaveLobby: $("#btn-leave-lobby"),

    // Oyun Ekranı
    countdownOverlay: $("#countdown-overlay"),
    countdownNumber: $("#countdown-number"),
    gameModeBadge: $("#game-mode-badge"),
    arenaTrackContainer: $("#arena-track-container"),
    arenaTracks: $("#arena-tracks"),
    arenaLiveLeader: $("#arena-live-leader"),
    textDisplay: $("#text-display"),
    typingInput: $("#typing-input"),
    statWpm: $("#stat-wpm"),
    statAccuracy: $("#stat-accuracy"),
    statTimer: $("#stat-timer"),

    // Sonuç Ekranı
    resultTitle: $("#result-title"),
    resultModeBadge: $("#result-mode-badge"),
    arenaRankBadge: $("#arena-rank-badge"),
    resultWpm: $("#result-wpm"),
    resultAccuracy: $("#result-accuracy"),
    arenaPodiumContainer: $("#arena-podium-container"),
    arenaPodiumList: $("#arena-podium-list"),
    btnPlayAgain: $("#btn-play-again"),
    btnReturnLobby: $("#btn-return-lobby"),

    // Skorboard
    leaderboardTabs: $$(".lb-tab"),
    leaderboardBody: $("#leaderboard-body"),
    leaderboardEmpty: $("#leaderboard-empty"),

    // Ses, tema ve Anti-Cheat
    btnToggleSound: $("#btn-toggle-sound"),
    btnToggleTheme: $("#btn-toggle-theme"),
    typingArea: $("#typing-area"),
    caret: $("#caret"),
    anticheatModal: $("#anticheat-modal"),
    btnAnticheatDismiss: $("#btn-anticheat-dismiss"),

    // Gizli Admin Paneli
    adminModal: $("#admin-modal"),
    btnAdminClose: $("#btn-admin-close"),
    btnAdminClearAll: $("#btn-admin-clear-all"),
    adminRoomsList: $("#admin-rooms-list"),
    adminTestNick: $("#admin-test-nick"),
    adminTestWpm: $("#admin-test-wpm"),
    adminTestMode: $("#admin-test-mode"),
    btnAdminAddTest: $("#btn-admin-add-test"),
  };

  // ── Mod Etiketleri ──────────────────────────────────────────
  const MODE_LABELS = {
    SOLO_WORDS:     { icon: "", name: "Kelime akışı" },
    SOLO_TEXT:      { icon: "", name: "Tam metin" },
    SOLO_CODE:      { icon: "", name: "Kod snippet" },
    MULTIPLAYER_VS: { icon: "", name: "Multiplayer arena" },
  };

  // ── Oyun Durumu (State) ─────────────────────────────────────
  let state = {
    nickname: "",
    selectedMode: "SOLO_WORDS",     // "SOLO_WORDS" | "SOLO_TEXT" | "SOLO_CODE" | "MULTIPLAYER_VS"
    activeCategory: "SOLO_WORDS",   // Leaderboard aktif sekmesi
    currentRoomId: "ARENA-1",
    isHost: false,
    roomPlayers: {},                // socketId => playerData
    targetText: "",                 // Yazılacak hedef metin
    charElements: [],               // Metin karakter span referansları
    currentIndex: 0,
    correctCount: 0,
    totalKeystrokes: 0,
    startTime: null,
    timerInterval: null,
    isFinished: false,
    allScores: {},                  // Tüm kategorilerin Top 10 listesi
  };

  // ── Ekran Geçiş Yardımcısı ──────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    if (screens[name]) screens[name].classList.add("active");

    // Odak modu yalnızca oyun ekranında geçerlidir
    if (name !== "game") {
      document.body.classList.remove("focus-mode");
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  1. MOD & GİRİŞ SEÇİMİ
  // ══════════════════════════════════════════════════════════════

  els.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedMode = btn.dataset.mode;

      // Multiplayer seçildiğinde oda girişi alanını göster
      if (state.selectedMode === "MULTIPLAYER_VS") {
        els.arenaRoomGroup.style.display = "block";
        els.btnStart.textContent = "Lobiye katıl";
      } else {
        els.arenaRoomGroup.style.display = "none";
        els.btnStart.textContent = "Oyuna Başla";
      }
    });
  });

  // Masa Seçimi Toggles
  if (els.radioAutoRoom && els.radioCustomRoom) {
    els.radioAutoRoom.addEventListener("change", () => {
      els.roomInput.style.display = "none";
    });
    els.radioCustomRoom.addEventListener("change", () => {
      els.roomInput.style.display = "block";
      els.roomInput.focus();
    });
  }

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

    if (state.selectedMode === "MULTIPLAYER_VS") {
      const isAuto = els.radioAutoRoom ? els.radioAutoRoom.checked : true;
      const customRoom = (!isAuto && els.roomInput) ? els.roomInput.value.trim() : null;

      socket.emit("room:join", {
        roomId: customRoom,
        nickname: state.nickname,
        autoMatch: isAuto,
      });
      showScreen("lobby");
    } else {
      // Solo Mod
      socket.emit("game:request-text", { mode: state.selectedMode });
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  2. MULTIPLAYER LOBİ YÖNETİMİ
  // ══════════════════════════════════════════════════════════════

  socket.on("room:state", (room) => {
    state.currentRoomId = room.id;
    state.isHost = (room.hostId === socket.id);
    els.lobbyRoomName.textContent = room.id;

    // Oyuncu listesini kaydet ve lobi arayüzünü güncelle
    state.roomPlayers = {};
    room.players.forEach((p) => {
      state.roomPlayers[p.id] = p;
    });

    renderLobbyPlayers(room.players);

    // Host kontrolleri
    if (state.isHost) {
      els.btnStartRace.style.display = "block";
      els.lobbyWaitingMsg.style.display = "none";
    } else {
      els.btnStartRace.style.display = "none";
      els.lobbyWaitingMsg.style.display = "block";
    }
  });

  function renderLobbyPlayers(players) {
    els.lobbyPlayerList.innerHTML = "";
    players.forEach((p) => {
      const item = document.createElement("div");
      item.className = "lobby-player-item";
      if (p.id === socket.id) item.classList.add("is-self");

      item.innerHTML = `
        <span>${escapeHtml(p.nickname)}${p.id === socket.id ? " (Sen)" : ""}</span>
        ${p.isHost ? '<span class="host-tag">host</span>' : ""}
      `;
      els.lobbyPlayerList.appendChild(item);
    });
  }

  els.btnStartRace.addEventListener("click", () => {
    socket.emit("room:start");
  });

  els.btnLeaveLobby.addEventListener("click", () => {
    socket.emit("room:leave");
    showScreen("welcome");
  });

  // ══════════════════════════════════════════════════════════════
  //  3. SENKRONİZE GERİ SAYIM & BAŞLANGIÇ
  // ══════════════════════════════════════════════════════════════

  socket.on("room:countdown", ({ count, text, state: roomState }) => {
    // İlk adımda hazırlıkları yap
    if (text) {
      state.targetText = text;
      state.selectedMode = "MULTIPLAYER_VS";
      resetGameState();
      renderText(text);

      // UI ayarları
      renderModeBadge(els.gameModeBadge, "MULTIPLAYER_VS");
      els.arenaTrackContainer.style.display = "block";
      els.textDisplay.classList.remove("code-mode");
      els.typingInput.classList.remove("code-mode");

      // Canlı yarış pisti kulvarlarını oluştur
      if (roomState && roomState.players) {
        initArenaTracks(roomState.players);
      }

      showScreen("game");
      els.typingInput.value = "";
      els.typingInput.disabled = true; // Geri sayım bitene kadar kilitli
    }

    // Geri sayım overlay'ini göster
    els.countdownOverlay.style.display = "flex";
    els.countdownNumber.classList.remove("go");

    // SFX: Geri sayım bipi veya başlama zili çal
    SoundFX.playCountdownTick(count);

    if (count > 0) {
      els.countdownNumber.textContent = count;
      // Animasyonu yeniden tetikle
      els.countdownNumber.style.animation = "none";
      void els.countdownNumber.offsetWidth;
      els.countdownNumber.style.animation = "count-pop 0.5s ease-out";
    } else if (count === 0) {
      els.countdownNumber.textContent = "BAŞLA";
      els.countdownNumber.classList.add("go");
    }
  });

  socket.on("room:race-start", ({ startTime, text }) => {
    els.countdownOverlay.style.display = "none";
    els.typingInput.disabled = false;
    els.typingInput.value = "";
    els.typingInput.focus();

    state.startTime = startTime || Date.now();
    startTimer();
  });

  // ── Solo Metin Geldiğinde ───────────────────────────────────
  socket.on("game:text", ({ text, mode }) => {
    resetGameState();
    state.targetText = text;
    state.selectedMode = mode;

    renderModeBadge(els.gameModeBadge, mode);
    els.arenaTrackContainer.style.display = "none"; // Solo modda yarış pisti gizlenir
    els.countdownOverlay.style.display = "none";

    if (mode === "SOLO_CODE") {
      els.textDisplay.classList.add("code-mode");
      els.typingInput.classList.add("code-mode");
    } else {
      els.textDisplay.classList.remove("code-mode");
      els.typingInput.classList.remove("code-mode");
    }

    renderText(text);
    showScreen("game");
    els.typingInput.disabled = false;
    els.typingInput.value = "";
    els.typingInput.focus();
  });

  // ══════════════════════════════════════════════════════════════
  //  4. CANLI YARIŞ PİSTİ (ARENA TRACKS)
  // ══════════════════════════════════════════════════════════════

  function initArenaTracks(players) {
    els.arenaTracks.innerHTML = "";
    els.arenaLiveLeader.textContent = "Yarış Başlıyor…";

    players.forEach((p) => {
      const row = document.createElement("div");
      row.className = "track-row";
      row.id = `track-${p.id}`;
      if (p.id === socket.id) row.classList.add("is-self");

      row.innerHTML = `
        <div class="track-info">
          <span class="track-user-name">${escapeHtml(p.nickname)}${p.id === socket.id ? " (Sen)" : ""}</span>
          <div class="track-stats">
            <span class="track-wpm" id="track-wpm-${p.id}">0 WPM</span>
            <span class="track-pct" id="track-pct-${p.id}">%0</span>
          </div>
        </div>
        <div class="track-line">
          <div class="track-progress-fill" id="track-fill-${p.id}">
            <span class="track-car" id="track-car-${p.id}">🏎️</span>
          </div>
          
        </div>
      `;
      els.arenaTracks.appendChild(row);
    });
  }

  function updateTrackProgress(playerId, progress, wpm) {
    const fillEl = $(`#track-fill-${playerId}`);
    const wpmEl = $(`#track-wpm-${playerId}`);
    const pctEl = $(`#track-pct-${playerId}`);

    const cleanPct = Math.min(100, Math.max(0, Math.round(progress)));

    if (fillEl) fillEl.style.width = `${cleanPct}%`;
    if (wpmEl) wpmEl.textContent = `${Math.round(wpm)} WPM`;
    if (pctEl) pctEl.textContent = `%${cleanPct}`;
  }

  socket.on("room:progress-update", ({ playerId, progress, wpm }) => {
    updateTrackProgress(playerId, progress, wpm);
  });

  socket.on("room:player-finished", ({ playerId, nickname, rank, wpm }) => {
    const carEl = $(`#track-car-${playerId}`);
    const rowEl = $(`#track-${playerId}`);
    const pctEl = $(`#track-pct-${playerId}`);

    if (carEl) carEl.textContent = "";
    if (rowEl) rowEl.classList.add("finished");
    if (pctEl) pctEl.textContent = `#${rank} BİTTİ`;

    if (rank === 1) {
      els.arenaLiveLeader.textContent = `Lider: ${escapeHtml(nickname)} (${Math.round(wpm)} WPM)`;
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  5. YAZMA MOTORU & ANLIK VERİ AKIŞI
  // ══════════════════════════════════════════════════════════════

  /**
   * Metni kelime > harf hiyerarşisiyle çizer.
   * state.charElements, metindeki karakter indeksiyle birebir eşleşir
   * (boşluklar da ayrı bir .char span'idir), böylece skor mantığı değişmez.
   */
  function renderText(text) {
    els.textDisplay.innerHTML = "";
    els.textDisplay.scrollTop = 0;
    state.charElements = [];

    let wordEl = null;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch;
      state.charElements.push(span);

      if (ch === " ") {
        // Boşluk kelimeyi kapatır ve satır kırılabilecek tek yerdir
        wordEl = null;
        els.textDisplay.appendChild(span);
      } else {
        if (!wordEl) {
          wordEl = document.createElement("span");
          wordEl.className = "word";
          els.textDisplay.appendChild(wordEl);
        }
        wordEl.appendChild(span);
      }
    }

    // Yeni metinde imleç başa döner (font yüklenmesini de beklemek için bir kare ertele)
    requestAnimationFrame(updateCaret);
  }

  /**
   * Özel imleci aktif harfin önüne taşır. CSS transition (left 0.1s) sayesinde
   * harf geçişlerinde pürüzsüzce kayar. Metin 3 satırdan uzunsa satırlar kayar.
   */
  let caretIdleTimer = null;

  function updateCaret() {
    const chars = state.charElements;
    if (!chars.length || !els.caret) return;

    const idx = Math.min(state.currentIndex, chars.length);
    const atEnd = idx >= chars.length;
    const target = atEnd ? chars[chars.length - 1] : chars[idx];

    const display = els.textDisplay;
    const lineHeight = parseFloat(getComputedStyle(display).lineHeight) || 38;
    const baseTop = chars[0].offsetTop;

    // Aktif satırı bul; 2. satırdan sonrasında metni yukarı kaydır
    const lineIndex = Math.round((target.offsetTop - baseTop) / lineHeight);
    display.scrollTop = lineIndex >= 2 ? (lineIndex - 1) * lineHeight : 0;

    const caretHeight = els.caret.offsetHeight || 30;
    const left = target.offsetLeft + (atEnd ? target.offsetWidth : 0);
    const top = target.offsetTop - display.scrollTop + (target.offsetHeight - caretHeight) / 2;

    els.caret.style.left = `${left}px`;
    els.caret.style.top = `${top}px`;

    // Yazarken imleç sabit, durunca yanıp söner
    els.caret.classList.add("typing");
    clearTimeout(caretIdleTimer);
    caretIdleTimer = setTimeout(() => els.caret.classList.remove("typing"), 600);
  }

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

    // Yeni tur: arayüz normale döner
    document.body.classList.remove("focus-mode");

    els.statWpm.textContent = "0";
    els.statAccuracy.textContent = "100%";
    els.statTimer.textContent = "0s";
  }

  els.typingInput.addEventListener("input", () => {
    if (state.isFinished) return;

    const inputVal = els.typingInput.value;
    const inputLen = inputVal.length;
    const prevLen = state.currentIndex;

    // Solo modda ilk tuşta zamanlayıcıyı başlat (Arena'da senkron başlar)
    if (state.selectedMode !== "MULTIPLAYER_VS") {
      if (!state.startTime && inputLen > 0) {
        state.startTime = Date.now();
        startTimer();
      }
    }

    // Odak Modu: ilk harfle birlikte yazma alanı dışındaki her şey soluklaşır
    if (inputLen > 0) {
      document.body.classList.add("focus-mode");
    }

    let correctSoFar = 0;

    for (let i = 0; i < state.charElements.length; i++) {
      const charEl = state.charElements[i];
      charEl.classList.remove("correct", "incorrect");

      if (i < inputLen) {
        if (inputVal[i] === state.targetText[i]) {
          charEl.classList.add("correct");
          correctSoFar++;
        } else {
          charEl.classList.add("incorrect");
        }
      }
    }

    state.currentIndex = inputLen;
    state.correctCount = correctSoFar;
    state.totalKeystrokes = inputLen;

    // SFX + titreme: yalnızca yeni eklenen karakter için
    const lastCharIdx = inputLen - 1;
    if (inputLen > prevLen && lastCharIdx >= 0 && lastCharIdx < state.targetText.length) {
      if (inputVal[lastCharIdx] === state.targetText[lastCharIdx]) {
        SoundFX.playKeySuccess();
      } else {
        SoundFX.playKeyError();
        shakeTextLine();
      }
    }

    updateCaret();
    const stats = updateStats();

    // ── Multiplayer Arena: Canlı İlerleme Yayını ───────────────
    if (state.selectedMode === "MULTIPLAYER_VS" && state.targetText.length > 0) {
      const progress = (state.correctCount / state.targetText.length) * 100;
      updateTrackProgress(socket.id, progress, stats.wpm);

      socket.emit("room:progress", {
        progress,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
      });
    }

    // Metin tamamlandı mı?
    if (inputLen >= state.targetText.length) {
      finishGame();
    }
  });

  /** Hatalı tuşta tüm yazma satırını 0.2sn titret */
  function shakeTextLine() {
    els.textDisplay.classList.remove("shake");
    void els.textDisplay.offsetWidth; // animasyonu yeniden tetikle
    els.textDisplay.classList.add("shake");
  }

  els.textDisplay.addEventListener("animationend", () => {
    els.textDisplay.classList.remove("shake");
  });

  // Yazma alanına tıklanınca görünmez input'a odaklan
  els.typingArea.addEventListener("click", () => {
    if (!els.typingInput.disabled) els.typingInput.focus();
  });

  // Oyun ekranındayken herhangi bir tuş input'a yönlendirilir
  window.addEventListener("keydown", (e) => {
    if (!screens.game.classList.contains("active")) return;
    if (els.typingInput.disabled || state.isFinished) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement === els.typingInput) return;

    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    els.typingInput.focus();
  });

  window.addEventListener("resize", updateCaret);

  // ── Anti-Cheat: Kopyala-Yapıştır ve Sürükle-Bırak Engeli ─────
  ["paste", "copy", "cut", "drop", "dragstart"].forEach((evtName) => {
    els.typingInput.addEventListener(evtName, (e) => {
      e.preventDefault();
      SoundFX.playKeyError();
    });
  });

  function updateStats() {
    const elapsed = getElapsedMinutes();
    const wpm = elapsed > 0 ? (state.correctCount / 5) / elapsed : 0;
    const accuracy =
      state.totalKeystrokes > 0
        ? (state.correctCount / state.totalKeystrokes) * 100
        : 100;

    els.statWpm.textContent = Math.round(wpm);
    els.statAccuracy.textContent = Math.round(accuracy) + "%";

    return { wpm, accuracy };
  }

  function getElapsedMinutes() {
    if (!state.startTime) return 0;
    return (Date.now() - state.startTime) / 60000;
  }

  function getElapsedSeconds() {
    if (!state.startTime) return 0;
    return Math.floor((Date.now() - state.startTime) / 1000);
  }

  function startTimer() {
    state.timerInterval = setInterval(() => {
      els.statTimer.textContent = getElapsedSeconds() + "s";
      updateStats();
    }, 1000);
  }

  // ══════════════════════════════════════════════════════════════
  //  6. OYUN BİTİŞİ & ARENA SKORU
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

    els.resultWpm.textContent = Math.round(finalWpm * 100) / 100;
    els.resultAccuracy.textContent = Math.round(finalAccuracy * 100) / 100 + "%";
    renderModeBadge(els.resultModeBadge, state.selectedMode);

    // SFX: Zafer / Bitiş Fanfarı
    SoundFX.playVictory();

    if (state.selectedMode === "MULTIPLAYER_VS") {
      // Arena bitişi
      els.resultTitle.textContent = "Yarışı tamamladın";
      els.btnReturnLobby.style.display = "block";
      els.arenaPodiumContainer.style.display = "block";
      els.arenaRankBadge.style.display = "block";
      els.arenaRankBadge.textContent = "Sıralama hesaplanıyor…";

      socket.emit("room:finish", {
        wpm: finalWpm,
        accuracy: finalAccuracy,
      });

      switchLeaderboardTab("MULTIPLAYER_VS");
    } else {
      // Solo bitişi
      els.resultTitle.textContent = "Oyun bitti";
      els.btnReturnLobby.style.display = "none";
      els.arenaPodiumContainer.style.display = "none";
      els.arenaRankBadge.style.display = "none";

      socket.emit("game:submit-score", {
        nickname: state.nickname,
        wpm: Math.round(finalWpm * 100) / 100,
        accuracy: Math.round(finalAccuracy * 100) / 100,
        mode: state.selectedMode,
      });

      switchLeaderboardTab(state.selectedMode);
    }

    showScreen("result");
  }

  // Maç Tamamlandı (Podyum)
  socket.on("room:match-ended", ({ podium }) => {
    els.arenaPodiumList.innerHTML = "";
    podium.forEach((p, idx) => {
      const rank = p.rank || idx + 1;
      const medals = ["1.", "2.", "3."];
      const medal = rank <= 3 ? medals[rank - 1] : `#${rank}`;

      const item = document.createElement("div");
      item.className = `podium-item rank-${rank}`;
      item.innerHTML = `
        <span>${medal} ${escapeHtml(p.nickname)}${p.id === socket.id ? " (Sen)" : ""}</span>
        <span><strong>${p.wpm || 0} WPM</strong> (%${p.accuracy || 100})</span>
      `;
      els.arenaPodiumList.appendChild(item);

      if (p.id === socket.id) {
        if (rank === 1) {
          els.arenaRankBadge.textContent = "Şampiyon, 1. oldun";
          els.arenaRankBadge.style.color = "#ffd700";
        } else {
          els.arenaRankBadge.textContent = `${medal} Yarışı #${rank}. Sırada Bitirdin`;
        }
      }
    });
  });

  els.btnPlayAgain.addEventListener("click", () => {
    if (state.selectedMode === "MULTIPLAYER_VS") {
      showScreen("lobby");
    } else {
      socket.emit("game:request-text", { mode: state.selectedMode });
    }
  });

  els.btnReturnLobby.addEventListener("click", () => {
    showScreen("lobby");
  });

  // ══════════════════════════════════════════════════════════════
  //  7. KATEGORİ BAZLI LİDERLİK TABLOSU
  // ══════════════════════════════════════════════════════════════

  els.leaderboardTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchLeaderboardTab(tab.dataset.category);
    });
  });

  function switchLeaderboardTab(category) {
    state.activeCategory = category;

    els.leaderboardTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.category === category);
    });

    const scores = state.allScores[category] || [];
    renderLeaderboard(scores);
  }

  socket.on("leaderboard:update", (allScores) => {
    state.allScores = allScores;
    const scores = allScores[state.activeCategory] || [];
    renderLeaderboard(scores);
  });

  function renderLeaderboard(scores) {
    els.leaderboardBody.innerHTML = "";

    if (!scores || scores.length === 0) {
      els.leaderboardEmpty.style.display = "block";
      return;
    }

    els.leaderboardEmpty.style.display = "none";

    scores.forEach((entry, index) => {
      const tr = document.createElement("tr");
      const medals = ["1.", "2.", "3."];
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

  function renderModeBadge(containerEl, mode) {
    const label = MODE_LABELS[mode] || MODE_LABELS.SOLO_TEXT;
    containerEl.textContent = `${label.name}`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  socket.on("room:error", ({ message }) => {
    alert("Arena Uyarısı: " + message);
  });

  socket.on("game:error", ({ message }) => {
    alert("Hata: " + message);
  });

  // ══════════════════════════════════════════════════════════════
  //  8. ODAK KAYBI KORUMASI (ANTI-CHEAT) & SES KONTROLÜ
  // ══════════════════════════════════════════════════════════════

  function triggerFocusCheatDisqualification() {
    // Sadece oyun aktifken, henüz bitmemişken ve yazma başlamışken
    if (screens.game.classList.contains("active") && !state.isFinished && state.startTime) {
      state.isFinished = true;

      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }

      els.typingInput.disabled = true;

      // Hile uyarı sesi
      SoundFX.playWarning();

      // Uyarı modalını aç
      if (els.anticheatModal) {
        els.anticheatModal.style.display = "flex";
      }

      // Multiplayer'daysa masadan çıkar
      if (state.selectedMode === "MULTIPLAYER_VS") {
        socket.emit("room:leave");
      }
    }
  }

  // Başka sekmeye geçildiğinde (document.hidden)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      triggerFocusCheatDisqualification();
    }
  });

  // Pencereden odak çıkıldığında (window.blur)
  window.addEventListener("blur", () => {
    triggerFocusCheatDisqualification();
  });

  // Modal kapatma
  if (els.btnAnticheatDismiss) {
    els.btnAnticheatDismiss.addEventListener("click", () => {
      if (els.anticheatModal) els.anticheatModal.style.display = "none";
      if (state.selectedMode === "MULTIPLAYER_VS") {
        showScreen("lobby");
      } else {
        showScreen("welcome");
      }
    });
  }

  // ── Ses Aç/Kapat Butonu Arayüzü ──────────────────────────────
  function updateSoundButtonUI() {
    if (els.btnToggleSound) {
      els.btnToggleSound.textContent = SoundFX.isMuted ? "Ses: kapalı" : "Ses: açık";
    }
  }
  updateSoundButtonUI();

  if (els.btnToggleSound) {
    els.btnToggleSound.addEventListener("click", () => {
      SoundFX.toggleMute();
      updateSoundButtonUI();
    });
  }

  // ── Tema Geçişi (Light / Dark) ───────────────────────────────
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("typing_race_theme", theme);
    if (els.btnToggleTheme) {
      // Buton, geçilecek temayı gösterir
      els.btnToggleTheme.textContent = theme === "dark" ? "Açık tema" : "Koyu tema";
    }
  }

  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");

  if (els.btnToggleTheme) {
    els.btnToggleTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
      // Tema değişince imleç konumu aynı kalır, yalnızca renk değişir
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  9. GİZLİ ADMİN PANELİ (HOTKEY: Ctrl+Shift+A veya Alt+Shift+K)
  // ══════════════════════════════════════════════════════════════

  let activeRoomsCache = [];

  function openAdminModal() {
    if (els.adminModal) {
      els.adminModal.style.display = "flex";
      renderAdminRooms();
    }
  }

  function closeAdminModal() {
    if (els.adminModal) {
      els.adminModal.style.display = "none";
    }
  }

  // Gizli Kısayol Dinleyicisi
  window.addEventListener("keydown", (e) => {
    // Ctrl + Shift + A (veya Mac'te Cmd + Shift + A) ya da Alt + Shift + K
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if ((isCtrlOrCmd && e.shiftKey && (e.key === "A" || e.key === "a")) ||
        (e.altKey && e.shiftKey && (e.key === "K" || e.key === "k"))) {
      e.preventDefault();
      if (els.adminModal && els.adminModal.style.display === "flex") {
        closeAdminModal();
      } else {
        openAdminModal();
      }
    } else if (e.key === "Escape" && els.adminModal && els.adminModal.style.display === "flex") {
      closeAdminModal();
    }
  });

  if (els.btnAdminClose) {
    els.btnAdminClose.addEventListener("click", closeAdminModal);
  }

  // Kategori Bazlı Skor Sıfırlama Butonları
  $$(".btn-admin-action[data-action='clear-cat']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      if (confirm(`${cat} skorboardı sıfırlansın mı?`)) {
        socket.emit("admin:clear-scores", { category: cat });
      }
    });
  });

  // Tüm Skorları Sıfırlama Butonu
  if (els.btnAdminClearAll) {
    els.btnAdminClearAll.addEventListener("click", () => {
      if (confirm("DİKKAT! Tüm liderlik tablosu tamamen silinecek. Emin misiniz?")) {
        socket.emit("admin:clear-scores", { category: "ALL" });
      }
    });
  }

  // Test Verisi Ekleme
  if (els.btnAdminAddTest) {
    els.btnAdminAddTest.addEventListener("click", () => {
      const nick = els.adminTestNick.value.trim() || "TestYarışçı";
      const wpm = Number(els.adminTestWpm.value) || 85;
      const mode = els.adminTestMode.value;

      socket.emit("admin:add-test-score", {
        nickname: nick,
        wpm,
        accuracy: 98,
        mode,
      });

      els.adminTestNick.value = "";
    });
  }

  // Aktif Odaları Dinleme & Listeleme
  socket.on("tv:rooms-update", (rooms) => {
    activeRoomsCache = rooms || [];
    renderAdminRooms();
  });

  function renderAdminRooms() {
    if (!els.adminRoomsList) return;
    if (!activeRoomsCache || activeRoomsCache.length === 0) {
      els.adminRoomsList.innerHTML = '<p class="admin-muted">Açık masa bulunmuyor.</p>';
      return;
    }

    els.adminRoomsList.innerHTML = "";
    activeRoomsCache.forEach((room) => {
      const row = document.createElement("div");
      row.className = "admin-room-item";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(room.id)}</strong>
          <span style="color: var(--text-muted); font-size: 0.8rem;">(${room.playerCount} Oyuncu - Durum: ${room.status})</span>
        </div>
        <button class="btn-room-close" data-room="${escapeHtml(room.id)}">Masayı Kapat</button>
      `;
      row.querySelector(".btn-room-close").addEventListener("click", () => {
        if (confirm(`${room.id} masası zorla kapatılsın mı?`)) {
          socket.emit("admin:close-room", { roomId: room.id });
        }
      });
      els.adminRoomsList.appendChild(row);
    });
  }

  socket.on("admin:action-success", ({ message }) => {
    alert("Yönetici Bildirimi: " + message);
  });

  socket.on("connect", () => {
    console.log("✅ Sunucuya bağlanıldı:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Sunucu bağlantısı kesildi");
  });
})();
