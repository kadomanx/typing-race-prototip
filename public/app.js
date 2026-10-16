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
    // Üst Bar
    btnHomeLogo: $("#btn-home-logo"),

    // Hoşgeldin Ekranı
    nicknameInput: $("#nickname-input"),
    nicknameError: $("#nickname-error"),
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
    resultRawWpm: $("#result-raw-wpm"),
    resultConsistency: $("#result-consistency"),
    resultChars: $("#result-chars"),
    resultDuration: $("#result-duration"),
    resultChartSvg: $("#result-chart-svg"),
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
    currentRoomId: null,
    isHost: false,
    roomPlayers: {},                // socketId => playerData
    targetText: "",                 // Yazılacak hedef metin
    charElements: [],               // Metin karakter span referansları
    wordRanges: [],                 // [{ start, end, spaceIdx }] kelime sınırları
    currentWordIdx: 0,              // Aktif kelime indeksi
    currentTypedWord: "",           // Sadece aktif kelimede yazılan metin
    lockedCorrectChars: 0,          // Kilitlenmiş hatasız kelimelerin karakter + boşluk sayısı
    currentIndex: 0,
    correctCount: 0,                // Net WPM için geçerli doğru karakter sayısı
    correctKeystrokes: 0,           // Anlık doğru tuş vuruşu (Backspace ile silinse de düşmez)
    totalKeystrokes: 0,             // Toplam karakter/boşluk tuş vuruşu (Backspace hariç)
    errorCount: 0,
    wpmHistory: [],                 // Saniye bazlı { sec, wpm, rawWpm, errors } kayıtları
    lastSnapshotErrors: 0,
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

  /** Ana sayfaya (Giriş ekranına) güvenli dönüş – zamanlayıcıları ve odayı temizler */
  function navigateToHome() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (state.currentRoomId) {
      socket.emit("room:leave");
      state.currentRoomId = null;
      state.isHost = false;
    }
    if (els.countdownOverlay) els.countdownOverlay.style.display = "none";
    if (els.anticheatModal) els.anticheatModal.style.display = "none";
    resetGameState();
    showScreen("welcome");
  }

  if (els.btnHomeLogo) {
    els.btnHomeLogo.addEventListener("click", navigateToHome);
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
        els.btnStart.textContent = "Başla";
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

  // ── İsim / Rumuz Küfür & XSS Filtresi (Maks 25 Karakter, Boşluk Destekli) ──
  const MAX_NICK_LEN = 25;
  const CLIENT_BAD_WORDS = [
    "amk", "aq", "amq", "oç", "oc", "piç", "pic", "sik", "siktir", "sikeyim",
    "sikerim", "sikik", "sikis", "sikiş", "sokuk", "sokarim", "sokarım", "koyayim",
    "koyayım", "yarrak", "yarak", "göt", "got", "gotveren", "götveren", "orospu",
    "oruspu", "kahpe", "pezevenk", "ibne", "puşt", "pust", "taşak", "tasak",
    "amcık", "amcik", "amina", "amına", "amini", "amını", "kaltak", "fahişe",
    "fahise", "gavat", "lavuk", "gerizekalı", "gerizekali", "aptal", "salak",
    "dangalak", "yavşak", "yavsak", "şerefsiz", "serefsiz", "piçkurusu", "am",
    "mk", "mq", "sg", "skm", "sktr", "bok", "döl", "penis", "vajina", "porno",
    "seks", "sex", "fuck", "shit", "bitch", "dick", "pussy", "asshole", "cunt",
    "nigger", "faggot", "whore", "slut",
  ];

  function normalizeNickForCheck(str) {
    return (str || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/(.)\1{2,}/g, "$1")
      .replace(/(?:^|\s)([a-z0-9])(?:\s+[a-z0-9])+(?=\s|$)/g, (m) => " " + m.replace(/\s+/g, ""));
  }

  function hasProfanity(raw) {
    const norm = normalizeNickForCheck(raw);
    const tokens = norm.split(/\s+/).filter(Boolean);
    return CLIENT_BAD_WORDS.some((bad) => {
      const b = normalizeNickForCheck(bad).trim();
      if (tokens.includes(b)) return true;
      return b.length >= 4 && tokens.some((t) => t.includes(b));
    });
  }

  function cleanXssNick(raw) {
    return String(raw || "")
      .replace(/[<>&"'`\\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, MAX_NICK_LEN);
  }

  function setNicknameWarning(msg) {
    if (!els.nicknameError) return;
    if (msg) {
      els.nicknameError.textContent = msg;
      els.nicknameError.style.display = "block";
      els.nicknameInput.classList.add("input-error");
    } else {
      els.nicknameError.style.display = "none";
      els.nicknameInput.classList.remove("input-error");
    }
  }

  els.nicknameInput.addEventListener("input", () => {
    const cleaned = els.nicknameInput.value.replace(/[<>&"'`\\]/g, "").substring(0, MAX_NICK_LEN);
    if (cleaned !== els.nicknameInput.value) {
      els.nicknameInput.value = cleaned;
    }
    const trimmed = cleaned.replace(/\s+/g, " ").trim();
    if (trimmed && hasProfanity(trimmed)) {
      setNicknameWarning("Uygunsuz bir isim girdiniz, lütfen değiştirin.");
      els.btnStart.disabled = true;
    } else {
      setNicknameWarning("");
      els.btnStart.disabled = trimmed.length === 0;
    }
  });

  els.nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const trimmed = cleanXssNick(els.nicknameInput.value);
      if (trimmed && hasProfanity(trimmed)) {
        e.preventDefault();
        setNicknameWarning("Uygunsuz bir isim girdiniz, lütfen değiştirin.");
        els.btnStart.disabled = true;
        return;
      }
      if (!els.btnStart.disabled) {
        els.btnStart.click();
      }
    }
  });

  els.btnStart.addEventListener("click", () => {
    const cleaned = cleanXssNick(els.nicknameInput.value);
    if (!cleaned) {
      setNicknameWarning("Lütfen geçerli bir isim girin.");
      els.btnStart.disabled = true;
      return;
    }

    if (hasProfanity(cleaned)) {
      setNicknameWarning("Uygunsuz bir isim girdiniz, lütfen değiştirin.");
      els.btnStart.disabled = true;
      els.nicknameInput.focus();
      return;
    }

    setNicknameWarning("");
    state.nickname = cleaned;
    els.nicknameInput.value = cleaned;

    if (state.selectedMode === "MULTIPLAYER_VS") {
      const isAuto = els.radioAutoRoom ? els.radioAutoRoom.checked : true;
      const customRoom = (!isAuto && els.roomInput) ? cleanXssNick(els.roomInput.value) : null;

      socket.emit("room:join", {
        roomId: customRoom,
        nickname: state.nickname,
        autoMatch: isAuto,
      });
    } else {
      // Solo Mod
      socket.emit("game:request-text", { mode: state.selectedMode, nickname: state.nickname });
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

    // Giriş ekranından odaya yeni katıldıysa lobi ekranına geçir
    if (screens.welcome.classList.contains("active")) {
      showScreen("lobby");
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
    state.currentRoomId = null;
    state.isHost = false;
    resetGameState();
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

      // UI ayarları
      renderModeBadge(els.gameModeBadge, "MULTIPLAYER_VS");
      els.arenaTrackContainer.style.display = "block";
      els.textDisplay.classList.remove("code-mode");
      els.typingInput.classList.remove("code-mode");

      // Canlı yarış pisti kulvarlarını oluştur
      if (roomState && roomState.players) {
        initArenaTracks(roomState.players);
      }

      // Önce ekranı görünür yap, sonra metni ve imleci hesapla
      showScreen("game");
      renderText(text);
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

  socket.on("room:race-start", () => {
    els.countdownOverlay.style.display = "none";
    els.typingInput.disabled = false;
    els.typingInput.value = "";
    els.typingInput.focus();

    // Cihazlar arası saat farkı (clock skew) sorununu önlemek için yerel zamanı kullan
    state.startTime = Date.now();
    startTimer();
    requestAnimationFrame(updateCaret);
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

    // Önce ekranı görünür yap, sonra metni ve imleci render et
    showScreen("game");
    renderText(text);
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

  socket.on("room:player-finished", ({ playerId, nickname, rank, wpm, accuracy }) => {
    const fillEl = $(`#track-fill-${playerId}`);
    const carEl = $(`#track-car-${playerId}`);
    const rowEl = $(`#track-${playerId}`);
    const pctEl = $(`#track-pct-${playerId}`);
    const wpmEl = $(`#track-wpm-${playerId}`);

    if (fillEl) fillEl.style.width = "100%";
    if (carEl) carEl.textContent = "";
    if (rowEl) rowEl.classList.add("finished");
    if (wpmEl) wpmEl.textContent = `${Math.round(wpm)} WPM`;
    if (pctEl) pctEl.textContent = `#${rank} BİTTİ`;

    if (rank === 1) {
      els.arenaLiveLeader.textContent = `Lider: ${escapeHtml(nickname)} (${Math.round(wpm)} WPM)`;
    }

    // Kendi bitiş derecemizi anında göster (diğer oyuncuları beklemeden)
    if (playerId === socket.id && els.arenaRankBadge) {
      if (rank === 1) {
        els.arenaRankBadge.textContent = "Şampiyon, 1. oldun!";
        els.arenaRankBadge.style.color = "var(--accent)";
      } else {
        els.arenaRankBadge.textContent = `Yarışı #${rank}. sırada bitirdin`;
        els.arenaRankBadge.style.color = "";
      }
    }

    // Podyum listesine anlık ekle (room:match-ended geldiğinde tam liste yenilenir)
    if (els.arenaPodiumList && !$(`#podium-row-${playerId}`)) {
      const item = document.createElement("div");
      item.id = `podium-row-${playerId}`;
      item.className = `podium-item rank-${rank}`;
      item.innerHTML = `
        <span>${rank}. ${escapeHtml(nickname)}${playerId === socket.id ? " (Sen)" : ""}</span>
        <span><strong>${Math.round(wpm || 0)} WPM</strong> (%${Math.round(accuracy ?? 100)})</span>
      `;
      els.arenaPodiumList.appendChild(item);
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  5. YAZMA MOTORU & ANLIK VERİ AKIŞI
  // ══════════════════════════════════════════════════════════════

  /**
   * Metni kelime > harf hiyerarşisiyle çizer.
   * Kelimeler ayrı .word span'lerinde, boşluklar ise kelimelerin arasında doğal boşluk span'i (.char.space) olarak yer alır.
   * Böylece kelimeler asla yapışmaz ve boşlukta imleç kelimenin bittiği yere pürüzsüzce oturur.
   */
  function renderText(text) {
    els.textDisplay.innerHTML = "";
    state.charElements = [];
    state.wordRanges = [];

    // İmleç elementi #text-display içinde yer alır
    const caretEl = document.createElement("div");
    caretEl.id = "caret";
    caretEl.className = "caret";
    els.textDisplay.appendChild(caretEl);
    els.caret = caretEl;

    let currentWord = null;
    let wordStart = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch;
      state.charElements.push(span);

      if (ch === " ") {
        span.classList.add("char-space");
        span.innerHTML = "&nbsp;";
        if (currentWord) {
          currentWord.appendChild(span);
          state.wordRanges.push({ start: wordStart, end: i, spaceIdx: i });
          currentWord = null;
        } else {
          els.textDisplay.appendChild(span);
        }
        wordStart = i + 1;
      } else {
        if (!currentWord) {
          currentWord = document.createElement("span");
          currentWord.className = "word";
          els.textDisplay.appendChild(currentWord);
          wordStart = i;
        }
        currentWord.appendChild(span);
      }
    }

    if (currentWord) {
      state.wordRanges.push({ start: wordStart, end: text.length, spaceIdx: -1 });
    }

    els.textDisplay.scrollTop = 0;
    requestAnimationFrame(updateCaret);
  }

  /**
   * Özel imleci aktif harfin tam önüne hizalar ve o sırada yazılan kelimeyi vurgular.
   * Hedef span'in #text-display içindeki gerçek offset koordinatlarını alır.
   */
  let caretIdleTimer = null;

  function updateCaret() {
    const chars = state.charElements;
    if (!chars.length || !els.caret) return;

    const idx = Math.min(state.currentIndex, chars.length);
    const atEnd = idx >= chars.length;
    const target = atEnd ? chars[chars.length - 1] : chars[idx];

    // 1. O an yazılan kelimeyi (.word.active-word) vurgula
    const currentActiveWord = target.closest(".word");
    const prevActiveWords = els.textDisplay.querySelectorAll(".word.active-word");
    prevActiveWords.forEach((w) => {
      if (w !== currentActiveWord) w.classList.remove("active-word");
    });
    if (currentActiveWord) {
      currentActiveWord.classList.add("active-word");
    }

    // 2. İmlecin konumu (Hedef karakterin parent zincirindeki koordinatı)
    const wordParent = target.offsetParent;
    const isInsideWord = wordParent && wordParent.classList.contains("word");
    const targetLeft = (isInsideWord ? wordParent.offsetLeft + target.offsetLeft : target.offsetLeft) + (atEnd ? target.offsetWidth : 0);
    const targetTop = isInsideWord ? wordParent.offsetTop + target.offsetTop : target.offsetTop;

    const targetHeight = target.offsetHeight || 38;
    const caretHeight = els.caret.offsetHeight || 30;

    // Hedef satırın scroll durumunu yönet
    const firstChar = chars[0];
    const firstCharTop = firstChar.offsetParent && firstChar.offsetParent.classList.contains("word")
      ? firstChar.offsetParent.offsetTop + firstChar.offsetTop
      : firstChar.offsetTop;

    const currentLineOffset = targetTop - firstCharTop;
    const lineHeight = targetHeight;

    if (currentLineOffset >= lineHeight * 1.5) {
      els.textDisplay.scrollTop = currentLineOffset - lineHeight;
    } else {
      els.textDisplay.scrollTop = 0;
    }

    // İmleç, kaydırılan #text-display'in İÇİNDE (absolute) olduğundan içerikle birlikte
    // kayar; bu yüzden scrollTop çıkarılmaz. Konum: left/top (CSS: transition left 0.1s).
    const topPos = targetTop + (targetHeight - caretHeight) / 2;
    els.caret.style.left = `${targetLeft}px`;
    els.caret.style.top = `${topPos}px`;

    // Yazarken imleç sabit kalsın, durunca yanıp sönsün
    els.caret.classList.add("typing");
    clearTimeout(caretIdleTimer);
    caretIdleTimer = setTimeout(() => els.caret.classList.remove("typing"), 600);
  }

  function resetGameState() {
    state.currentWordIdx = 0;
    state.currentTypedWord = "";
    state.lockedCorrectChars = 0;
    state.currentIndex = 0;
    state.correctCount = 0;
    state.correctKeystrokes = 0;
    state.totalKeystrokes = 0;
    state.errorCount = 0;
    state.wpmHistory = [];
    state.lastSnapshotErrors = 0;
    state.startTime = null;
    state.isFinished = false;
    if (typeof resetChick === "function") resetChick();

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    document.body.classList.remove("focus-mode");

    els.statWpm.textContent = "0";
    els.statAccuracy.textContent = "100%";
    els.statTimer.textContent = "0s";
    if (els.arenaPodiumList) els.arenaPodiumList.innerHTML = "";
    if (els.arenaRankBadge) els.arenaRankBadge.textContent = "";
  }

  /** Aktif ve kilitlenmiş kelimelerden geçerli doğru karakter sayısını hesaplar */
  function computeValidCorrectChars() {
    const range = state.wordRanges[state.currentWordIdx];
    if (!range) return state.lockedCorrectChars;
    const expected = state.targetText.slice(range.start, range.end);
    const typed = state.currentTypedWord;
    // Aktif kelimede şu ana kadar hiç hata yoksa yazılan harfleri anlık WPM'e dahil et
    if (typed.length > 0 && expected.startsWith(typed)) {
      return state.lockedCorrectChars + typed.length;
    }
    return state.lockedCorrectChars;
  }

  /** Multiplayer ilerleme yayını ve istatistik güncellemesi */
  function syncAfterKeystroke() {
    state.correctCount = computeValidCorrectChars();
    lastKeyTime = performance.now();
    updateCaret();
    const stats = updateStats();

    if (state.selectedMode === "MULTIPLAYER_VS" && state.targetText.length > 0) {
      const progress = Math.min(100, (state.correctCount / state.targetText.length) * 100);
      updateTrackProgress(socket.id, progress, stats.wpm);
      socket.emit("room:progress", {
        progress,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
      });
    }
  }

  /** Aktif kelimeyi kilitler ve bir sonraki kelimeye geçer (Masaüstü Space + Mobil Sanal Klavye) */
  function lockActiveWordAndAdvance() {
    if (state.isFinished) return;
    const range = state.wordRanges[state.currentWordIdx];
    if (!range) return;

    // Kelime başında art arda boşluğa basılmasını engelle
    if (state.currentTypedWord.length === 0) {
      els.typingInput.value = "";
      return;
    }

    if (state.selectedMode !== "MULTIPLAYER_VS" && !state.startTime) {
      state.startTime = Date.now();
      startTimer();
    }
    document.body.classList.add("focus-mode");

    const expectedWord = state.targetText.slice(range.start, range.end);
    const typedLen = state.currentTypedWord.length;
    const isWordExact = state.currentTypedWord === expectedWord;

    state.totalKeystrokes++;

    if (typedLen === expectedWord.length) {
      // Boşluk doğru pozisyonda basıldı
      state.correctKeystrokes++;
      if (range.spaceIdx !== -1) {
        state.charElements[range.spaceIdx].classList.add("correct");
      }
      SoundFX.playKeySuccess();
    } else {
      // Kelime eksik bırakılıp boşluğa basıldı: kalan harfleri ve boşluğu hatalı işaretle
      for (let i = range.start + typedLen; i < range.end; i++) {
        state.charElements[i].classList.add("incorrect");
      }
      if (range.spaceIdx !== -1) {
        state.charElements[range.spaceIdx].classList.add("incorrect");
      }
      state.errorCount++;
      SoundFX.playKeyError();
      shakeTextLine();
      triggerChickAlert();
    }

    // Sadece tamamen doğru yazılmış kelimelerin karakter + boşluk sayısı Net WPM'e eklenir
    if (isWordExact) {
      state.lockedCorrectChars += expectedWord.length + (range.spaceIdx !== -1 ? 1 : 0);
    }

    // Sonraki kelimeye geç
    state.currentWordIdx++;
    state.currentTypedWord = "";
    els.typingInput.value = "";

    if (state.currentWordIdx >= state.wordRanges.length) {
      state.currentIndex = state.targetText.length;
      syncAfterKeystroke();
      finishGame();
    } else {
      state.currentIndex = state.wordRanges[state.currentWordIdx].start;
      syncAfterKeystroke();
    }
  }

  // Space ve Backspace için kelime kilitleme kontrolü
  els.typingInput.addEventListener("keydown", (e) => {
    if (state.isFinished) return;
    const range = state.wordRanges[state.currentWordIdx];
    if (!range) return;

    // 1. Backspace: Sadece aktif kelimenin içindeyken silmeye izin ver, önceki kelimeye dönülmesin
    if (e.key === "Backspace") {
      if (state.currentTypedWord.length === 0) {
        e.preventDefault();
      }
      return;
    }

    // 2. Space (Boşluk) veya son kelimede Enter: Kelimeyi kilitle ve sonraki kelimeye geç
    if (e.key === " " || (e.key === "Enter" && state.currentWordIdx === state.wordRanges.length - 1)) {
      e.preventDefault();
      lockActiveWordAndAdvance();
    }
  });

  els.typingInput.addEventListener("input", () => {
    if (state.isFinished) return;
    const range = state.wordRanges[state.currentWordIdx];
    if (!range) return;

    const inputRaw = els.typingInput.value;
    // Mobil sanal klavyelerde (Android/iOS) boşluk tuşu keydown yerine input event'i ile gelebilir
    const hasTrailingSpace = /\s$/.test(inputRaw);

    const expectedWord = state.targetText.slice(range.start, range.end);
    // Boşluk karakterlerini kelime metninden ayıkla
    let rawVal = inputRaw.replace(/\s+/g, "");
    const prevVal = state.currentTypedWord;

    // Solo modda ilk tuşta zamanlayıcıyı başlat
    if (state.selectedMode !== "MULTIPLAYER_VS" && !state.startTime && rawVal.length > 0) {
      state.startTime = Date.now();
      startTimer();
    }
    if (rawVal.length > 0) {
      document.body.classList.add("focus-mode");
    }

    // Kelime uzunluğunu aşan fazladan harf basıldıysa: hata say ama kelime sınırını taşırma
    if (rawVal.length > expectedWord.length) {
      const extraCount = rawVal.length - Math.max(prevVal.length, expectedWord.length);
      if (extraCount > 0) {
        state.totalKeystrokes += extraCount;
        state.errorCount += extraCount;
        SoundFX.playKeyError();
        shakeTextLine();
        triggerChickAlert();
      }
      rawVal = rawVal.slice(0, expectedWord.length);
      els.typingInput.value = rawVal;
    }

    // Yeni karakter(ler) eklendiyse anlık tuş vuruşu (keystroke) kontrolü
    if (rawVal.length > prevVal.length) {
      for (let pos = prevVal.length; pos < rawVal.length; pos++) {
        const ch = rawVal[pos];
        const targetIdx = range.start + pos;
        state.totalKeystrokes++;

        if (ch === state.targetText[targetIdx]) {
          state.correctKeystrokes++;
          SoundFX.playKeySuccess();
        } else {
          state.errorCount++;
          SoundFX.playKeyError();
          shakeTextLine();
          triggerChickAlert();
        }
      }
    }

    state.currentTypedWord = rawVal;

    // Aktif kelimenin DOM span sınıflarını güncelle (kilitli önceki kelimelere dokunulmaz)
    for (let pos = 0; pos < expectedWord.length; pos++) {
      const charEl = state.charElements[range.start + pos];
      charEl.classList.remove("correct", "incorrect");
      if (pos < rawVal.length) {
        if (rawVal[pos] === expectedWord[pos]) {
          charEl.classList.add("correct");
        } else {
          charEl.classList.add("incorrect");
        }
      }
    }

    state.currentIndex = range.start + rawVal.length;
    syncAfterKeystroke();

    // Son kelime hatasız tamamlandıysa boşluk beklemeden bitir
    if (
      state.currentWordIdx === state.wordRanges.length - 1 &&
      rawVal === expectedWord
    ) {
      state.lockedCorrectChars += expectedWord.length;
      state.currentIndex = state.targetText.length;
      syncAfterKeystroke();
      finishGame();
      return;
    }

    // Mobil klavyeden boşluk basıldıysa kelimeyi kilitle ve sonrakine geç
    if (hasTrailingSpace) {
      lockActiveWordAndAdvance();
    }
  });

  /** Hatalı tuşta tüm yazma kutusunu (konuşma balonu) 0.2sn titret */
  function shakeTextLine() {
    els.typingArea.classList.remove("shake");
    void els.typingArea.offsetWidth; // animasyonu yeniden tetikle
    els.typingArea.classList.add("shake");
  }

  els.typingArea.addEventListener("animationend", (e) => {
    if (e.target === els.typingArea) els.typingArea.classList.remove("shake");
  });

  // ══════════════════════════════════════════════════════════════
  //  5b. ETKİLEŞİMLİ CİVCİV (göz takibi + davranış durumları)
  //  Durumlar (#interactive-chick[data-state]):
  //    sleeping : yazmıyor / WPM < 30  → gözler kapalı + yeşil Zzz
  //    active   : normal hızda yazıyor → gözler açık, imleci (.caret) takip eder
  //    alert    : yanlış tuş           → gözler kocaman, "!" ve oyuncuya bakış
  // ══════════════════════════════════════════════════════════════
  const chick = {
    root: $("#interactive-chick"),
    eyes: $$("#interactive-chick .eye-white"),
    pupils: $$("#interactive-chick .pupil"),
  };
  const CHICK_SLEEP_WPM = 30;     // bu hızın altında civciv uyur
  const CHICK_IDLE_MS = 2500;     // bu süre tuşa basılmazsa civciv uyur
  const CHICK_ALERT_MS = 1100;    // yanlış tuş sonrası şok süresi
  let lastKeyTime = 0;
  let chickAlertUntil = 0;

  function setChickState(next) {
    if (chick.root && chick.root.dataset.state !== next) chick.root.dataset.state = next;
  }

  /** Yanlış harfte civciv şok geçirir ve oyuncuya bakar */
  function triggerChickAlert() {
    chickAlertUntil = performance.now() + CHICK_ALERT_MS;
    setChickState("alert");
  }

  function resetChick() {
    lastKeyTime = 0;
    chickAlertUntil = 0;
    setChickState("sleeping");
  }

  function evaluateChickState() {
    const now = performance.now();
    if (now < chickAlertUntil) return setChickState("alert");

    const wpm = Number(els.statWpm.textContent) || 0;
    const typing = !!state.startTime && !state.isFinished;
    const idle = now - lastKeyTime > CHICK_IDLE_MS;
    setChickState(!typing || idle || wpm < CHICK_SLEEP_WPM ? "sleeping" : "active");
  }

  /** Her karede çalışır: durumu günceller, aktifken göz bebeklerini imlece çevirir */
  function chickLoop() {
    requestAnimationFrame(chickLoop);
    if (!chick.root || !screens.game.classList.contains("active")) return;

    evaluateChickState();

    if (chick.root.dataset.state !== "active" || !els.caret) {
      // uyurken / şokta bebekler merkezde (alert = doğrudan oyuncuya bakış)
      chick.pupils.forEach((p) => (p.style.transform = "translate(0px, 0px)"));
      return;
    }

    const c = els.caret.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    const MAX = 3; // göz bebeğinin SVG birimi cinsinden azami kayması

    chick.eyes.forEach((eye, i) => {
      const r = eye.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2);
      const dy = cy - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 40);
      chick.pupils[i].style.transform =
        `translate(${((dx / dist) * MAX * k).toFixed(2)}px, ${((dy / dist) * MAX * k).toFixed(2)}px)`;
    });
  }
  chickLoop();

  // Yazma alanına tıklanınca veya mobilde dokunulunca görünmez input'a odaklan (sanal klavyeyi aç)
  function focusTypingInput() {
    if (!els.typingInput.disabled && !state.isFinished) {
      els.typingInput.focus({ preventScroll: true });
    }
  }
  els.typingArea.addEventListener("click", focusTypingInput);
  els.typingArea.addEventListener("touchend", focusTypingInput);

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
    const wpm = elapsed > 0 ? Math.round((state.correctCount / 5) / elapsed) : 0;
    const accuracy =
      state.totalKeystrokes > 0
        ? Math.round((state.correctKeystrokes / state.totalKeystrokes) * 100)
        : 100;

    els.statWpm.textContent = wpm;
    els.statAccuracy.textContent = accuracy + "%";

    return { wpm, accuracy };
  }

  /** İlk 2 saniyedeki matematiksel WPM sıçramalarını (spike) önlemek için minimum 2sn tabanı uygular */
  function getElapsedMinutes(isFinal = false) {
    if (!state.startTime) return 0;
    const elapsedMs = Date.now() - state.startTime;
    if (!isFinal && elapsedMs < 500) return 0;
    const safeMs = isFinal ? Math.max(elapsedMs, 1000) : Math.max(elapsedMs, 2000);
    return safeMs / 60000;
  }

  function getElapsedSeconds() {
    if (!state.startTime) return 0;
    return Math.floor((Date.now() - state.startTime) / 1000);
  }

  function recordWpmSnapshot() {
    if (!state.startTime) return;
    const elapsedMs = Math.max(1000, Date.now() - state.startTime);
    const elapsedMin = elapsedMs / 60000;
    const sec = Math.max(1, Math.round(elapsedMs / 1000));
    state.correctCount = computeValidCorrectChars();

    const netWpm = Math.round((state.correctCount / 5) / elapsedMin);
    const rawWpm = Math.max(netWpm, Math.round((state.totalKeystrokes / 5) / elapsedMin));
    const deltaErrors = Math.max(0, state.errorCount - state.lastSnapshotErrors);
    state.lastSnapshotErrors = state.errorCount;

    const lastEntry = state.wpmHistory[state.wpmHistory.length - 1];
    if (lastEntry && lastEntry.sec === sec) {
      lastEntry.wpm = netWpm;
      lastEntry.rawWpm = rawWpm;
      lastEntry.errors += deltaErrors;
    } else {
      state.wpmHistory.push({ sec, wpm: netWpm, rawWpm, errors: deltaErrors });
    }
  }

  function startTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }
    state.timerInterval = setInterval(() => {
      els.statTimer.textContent = getElapsedSeconds() + "s";
      updateStats();
      recordWpmSnapshot();
    }, 1000);
  }

  /** Saniye bazlı WPM örneklerinden tutarlılık (consistency %) hesaplar */
  function computeConsistency(history, finalWpm) {
    if (!history || history.length < 2 || finalWpm <= 0) return 100;
    const values = history.map((h) => h.wpm);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) return 100;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    return Math.max(0, Math.min(100, Math.round((1 - cv * 0.85) * 100)));
  }

  /** Monkeytype / 10fastfingers tarzı SVG WPM & Hata Grafiği çizer */
  function renderResultChart(history) {
    const svg = els.resultChartSvg;
    if (!svg) return;

    const points = history && history.length > 0 ? history.slice() : [{ sec: 1, wpm: 0, rawWpm: 0, errors: 0 }];
    if (points.length === 1) {
      points.unshift({ sec: 0, wpm: Math.round(points[0].wpm * 0.7), rawWpm: Math.round(points[0].rawWpm * 0.7), errors: 0 });
    }

    const W = 520;
    const H = 170;
    const padL = 34;
    const padR = 14;
    const padT = 14;
    const padB = 26;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxVal = Math.max(60, ...points.map((p) => Math.max(p.wpm, p.rawWpm)));
    const yMax = Math.ceil(maxVal / 20) * 20;

    const getX = (i) => padL + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
    const getY = (val) => padT + plotH - Math.min(1, Math.max(0, val / yMax)) * plotH;

    let html = "";

    // Yatay kılavuz çizgileri ve Y ekseni etiketleri (0, %50, %100)
    const yTicks = [0, Math.round(yMax / 2), yMax];
    yTicks.forEach((tick) => {
      const y = getY(tick).toFixed(1);
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 3" stroke-width="1" />`;
      html += `<text x="${padL - 6}" y="${Number(y) + 3.5}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)">${tick}</text>`;
    });

    // X ekseni zaman etiketleri (en fazla 6 etiket)
    const step = Math.max(1, Math.ceil((points.length - 1) / 5));
    points.forEach((pt, idx) => {
      if (idx === 0 || idx === points.length - 1 || idx % step === 0) {
        const x = getX(idx).toFixed(1);
        html += `<text x="${x}" y="${H - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)">${pt.sec}s</text>`;
      }
    });

    // Ham WPM (kesikli gri çizgi)
    const rawCoords = points.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.rawWpm).toFixed(1)}`);
    html += `<polyline fill="none" stroke="var(--text-muted)" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.65" points="${rawCoords.join(" ")}" />`;

    // Net WPM (altı hafif dolgulu ana vurgu çizgisi)
    const wpmCoords = points.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.wpm).toFixed(1)}`);
    const areaPoints = [
      `${getX(0).toFixed(1)},${(padT + plotH).toFixed(1)}`,
      ...wpmCoords,
      `${getX(points.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}`,
    ].join(" ");
    html += `<polygon points="${areaPoints}" fill="var(--accent-soft)" />`;
    html += `<polyline fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="${wpmCoords.join(" ")}" />`;

    // Noktalar ve hata işaretleri
    points.forEach((pt, i) => {
      const x = getX(i).toFixed(1);
      const y = getY(pt.wpm).toFixed(1);
      html += `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)">
        <title>${pt.sec}. sn: ${pt.wpm} Net WPM (Ham: ${pt.rawWpm} WPM, Hata: ${pt.errors})</title>
      </circle>`;

      if (pt.errors > 0) {
        const errY = Math.max(padT + 6, Number(y) - 10).toFixed(1);
        html += `<circle cx="${x}" cy="${errY}" r="4" fill="var(--error)">
          <title>${pt.sec}. saniyede ${pt.errors} hata</title>
        </circle>`;
      }
    });

    svg.innerHTML = html;
  }

  // ══════════════════════════════════════════════════════════════
  //  6. OYUN BİTİŞİ & ARENA SKORU
  // ══════════════════════════════════════════════════════════════

  function finishGame() {
    if (state.isFinished) return;
    state.isFinished = true;

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    if (!state.startTime) {
      state.startTime = Date.now() - 1000;
    }

    // Son saniye verisini grafiğe kaydet
    recordWpmSnapshot();

    state.correctCount = computeValidCorrectChars();
    const elapsed = getElapsedMinutes(true);
    const elapsedSecExact = Math.max(0.5, (Date.now() - state.startTime) / 1000);
    const finalWpm = elapsed > 0 ? Math.round((state.correctCount / 5) / elapsed) : 0;
    const finalRawWpm = elapsed > 0 ? Math.max(finalWpm, Math.round((state.totalKeystrokes / 5) / elapsed)) : 0;
    const finalAccuracy =
      state.totalKeystrokes > 0
        ? Math.round((state.correctKeystrokes / state.totalKeystrokes) * 100)
        : 100;
    const consistency = computeConsistency(state.wpmHistory, finalWpm);

    // Ana ve detaylı istatistikleri doldur
    els.resultWpm.textContent = finalWpm;
    els.resultAccuracy.textContent = finalAccuracy + "%";
    if (els.resultRawWpm) els.resultRawWpm.textContent = finalRawWpm;
    if (els.resultConsistency) els.resultConsistency.textContent = consistency + "%";
    if (els.resultChars) {
      els.resultChars.textContent = `${state.correctKeystrokes} / ${state.errorCount} / ${state.totalKeystrokes}`;
    }
    if (els.resultDuration) {
      els.resultDuration.textContent = `${elapsedSecExact.toFixed(1)}s`;
    }

    renderModeBadge(els.resultModeBadge, state.selectedMode);
    renderResultChart(state.wpmHistory);

    // SFX: Zafer / Bitiş Fanfarı
    SoundFX.playVictory();

    if (state.selectedMode === "MULTIPLAYER_VS") {
      // Arena bitişi
      els.resultTitle.textContent = "Yarışı tamamladın";
      els.btnPlayAgain.textContent = "Lobiye dön";
      els.btnReturnLobby.style.display = "block";
      els.btnReturnLobby.textContent = "Ana sayfa";
      els.arenaPodiumContainer.style.display = "block";
      els.arenaRankBadge.style.display = "block";
      if (!els.arenaRankBadge.textContent || els.arenaRankBadge.textContent === "Sıralama hesaplanıyor…") {
        els.arenaRankBadge.textContent = "Sıralama hesaplanıyor…";
      }

      socket.emit("room:finish", {
        wpm: finalWpm,
        accuracy: finalAccuracy,
      });

      switchLeaderboardTab("MULTIPLAYER_VS");
    } else {
      // Solo bitişi
      els.resultTitle.textContent = "Oyun bitti";
      els.btnPlayAgain.textContent = "Tekrar oyna";
      els.btnReturnLobby.style.display = "block";
      els.btnReturnLobby.textContent = "Mod değiştir";
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
      item.id = `podium-row-${p.id}`;
      item.className = `podium-item rank-${rank}`;
      item.innerHTML = `
        <span>${medal} ${escapeHtml(p.nickname)}${p.id === socket.id ? " (Sen)" : ""}</span>
        <span><strong>${p.wpm || 0} WPM</strong> (%${p.accuracy ?? 100})</span>
      `;
      els.arenaPodiumList.appendChild(item);

      if (p.id === socket.id) {
        if (rank === 1) {
          els.arenaRankBadge.textContent = "Şampiyon, 1. oldun!";
          els.arenaRankBadge.style.color = "var(--accent)";
        } else {
          els.arenaRankBadge.textContent = `${medal} Yarışı #${rank}. sırada bitirdin`;
          els.arenaRankBadge.style.color = "";
        }
      }
    });
  });

  els.btnPlayAgain.addEventListener("click", () => {
    resetGameState();
    if (state.selectedMode === "MULTIPLAYER_VS") {
      showScreen("lobby");
    } else {
      socket.emit("game:request-text", { mode: state.selectedMode });
    }
  });

  els.btnReturnLobby.addEventListener("click", () => {
    navigateToHome();
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
    if (screens.welcome.classList.contains("active")) {
      setNicknameWarning(message);
    } else {
      alert("Arena Uyarısı: " + message);
    }
  });

  socket.on("game:error", ({ message }) => {
    if (screens.welcome.classList.contains("active")) {
      setNicknameWarning(message);
    } else {
      alert("Hata: " + message);
    }
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

  // ── Çoklu Tema Yönetimi & Canlı Önizleme (6 Tema) ───────────
  const THEMES = [
    { id: "dark",    label: "Karbon Koyu",       short: "Tema: Karbon" },
    { id: "light",   label: "Fildişi Açık",      short: "Tema: Fildişi" },
    { id: "ocean",   label: "Buzul Okyanus",     short: "Tema: Okyanus" },
    { id: "emerald", label: "Zümrüt Orman",      short: "Tema: Zümrüt" },
    { id: "sunset",  label: "Gün Batımı",        short: "Tema: Gün Batımı" },
    { id: "rainbow", label: "🌈 Gökkuşağı Parti", short: "Tema: 🌈 Gökkuşağı" },
  ];

  const themeChips = $$(".theme-chip");
  const themeActiveLabel = $("#theme-active-label");

  function applyTheme(themeId) {
    const validTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];
    document.documentElement.setAttribute("data-theme", validTheme.id);
    localStorage.setItem("typing_race_theme", validTheme.id);

    if (els.btnToggleTheme) {
      els.btnToggleTheme.textContent = validTheme.short;
    }
    if (themeActiveLabel) {
      themeActiveLabel.textContent = validTheme.label;
    }
    themeChips.forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.themeChoice === validTheme.id);
    });
  }

  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");

  themeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      applyTheme(chip.dataset.themeChoice);
    });
  });

  if (els.btnToggleTheme) {
    els.btnToggleTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const idx = THEMES.findIndex((t) => t.id === current);
      const nextTheme = THEMES[(idx + 1) % THEMES.length];
      applyTheme(nextTheme.id);
    });
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "typing_race_theme" && e.newValue) {
      applyTheme(e.newValue);
    }
  });

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
