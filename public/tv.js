// ============================================================
//  Typing Race – TV / İzleyici Ekranı İstemcisi (tv.js)
//  Tüm masaların canlı yarışlarını ve skorboardu ekrana yansıtır
// ============================================================

(() => {
  "use strict";

  const socket = io();

  // ── DOM Referansları ────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    clock: $("#tv-clock"),
    hostIp: $("#tv-host-ip"),
    activeRoomsStat: $("#stat-active-rooms"),
    activePlayersStat: $("#stat-active-players"),
    roomsContainer: $("#tv-rooms-container"),
    emptyRoomsBanner: $("#tv-empty-rooms"),
    categoryBadgeTitle: $("#category-badge-title"),
    tabs: $$(".tv-tab"),
    leaderboardBody: $("#tv-leaderboard-body"),
    tableEmpty: $("#tv-table-empty"),
    tickerContent: $("#tv-ticker-content"),
  };

  // ── Kategori Bilgileri ──────────────────────────────────────
  const CATEGORIES = [
    { key: "MULTIPLAYER_VS", name: "🏁 ARENA (VS)" },
    { key: "SOLO_WORDS",     name: "📝 KELİME AKIŞI" },
    { key: "SOLO_TEXT",      name: "📖 TAM METİN" },
    { key: "SOLO_CODE",      name: "💻 KOD SNIPPET" },
  ];

  let currentCatIndex = 0;
  let allScores = {};
  let currentRooms = [];
  let autoRotateInterval = null;

  // ── Dijital Saat & Host IP Bilgisi ─────────────────────────
  function updateClock() {
    const now = new Date();
    els.clock.textContent = now.toTimeString().split(" ")[0];
  }
  setInterval(updateClock, 1000);
  updateClock();

  if (window.location.hostname) {
    els.hostIp.textContent = `${window.location.hostname}:${window.location.port || "3000"}`;
  }

  // ══════════════════════════════════════════════════════════════
  //  1. CANLI ARENA MASALARI (ROOMS) RENDER
  // ══════════════════════════════════════════════════════════════

  socket.on("tv:rooms-update", (rooms) => {
    currentRooms = rooms || [];
    renderRooms(currentRooms);
    updateQuickStats(currentRooms);
  });

  function updateQuickStats(rooms) {
    let totalPlayers = 0;
    rooms.forEach((r) => (totalPlayers += r.playerCount || 0));
    els.activeRoomsStat.textContent = rooms.length;
    els.activePlayersStat.textContent = totalPlayers;
  }

  function renderRooms(rooms) {
    if (!rooms || rooms.length === 0) {
      els.roomsContainer.innerHTML = "";
      els.emptyRoomsBanner.style.display = "flex";
      return;
    }

    els.emptyRoomsBanner.style.display = "none";
    els.roomsContainer.innerHTML = "";

    rooms.forEach((room) => {
      const card = document.createElement("div");
      card.className = `tv-room-card ${room.status}`;
      card.id = `tv-room-${room.id}`;

      const statusMap = {
        waiting:   { label: "Beklemede", cls: "status-waiting" },
        countdown: { label: "Geri Sayım", cls: "status-countdown" },
        racing:    { label: "⚡ CANLI YARIŞ", cls: "status-racing" },
        finished:  { label: "Bitti", cls: "status-finished" },
      };

      const st = statusMap[room.status] || statusMap.waiting;

      card.innerHTML = `
        <div class="tv-room-card-header">
          <div class="room-title-badge">
            <span>🏟️ ${escapeHtml(room.id)}</span>
            <small style="color: var(--tv-muted); font-size: 0.8rem;">(${room.players.length} Oyuncu)</small>
          </div>
          <span class="room-status-badge ${st.cls}">${st.label}</span>
        </div>
        <div class="tv-tracks-list" id="tv-tracks-${room.id}">
          <!-- Oyuncu kulvarları -->
        </div>
      `;

      const tracksList = card.querySelector(`#tv-tracks-${room.id}`);

      room.players.forEach((p) => {
        const row = document.createElement("div");
        row.className = "tv-track-item";
        row.id = `tv-track-${room.id}-${p.id}`;

        const cleanPct = Math.min(100, Math.max(0, Math.round(p.progress || 0)));

        row.innerHTML = `
          <div class="tv-track-info">
            <span class="tv-player-name">
              ${p.isHost ? "👑" : "👤"} ${escapeHtml(p.nickname)}
              <span id="tv-rank-tag-${room.id}-${p.id}"></span>
            </span>
            <div class="tv-track-stats">
              <span class="tv-wpm" id="tv-wpm-${room.id}-${p.id}">${Math.round(p.wpm || 0)} WPM</span>
              <span class="tv-pct" id="tv-pct-${room.id}-${p.id}">%${cleanPct}</span>
            </div>
          </div>
          <div class="tv-track-line">
            <div class="tv-progress-fill" id="tv-fill-${room.id}-${p.id}" style="width: ${cleanPct}%">
              <span class="tv-track-car" id="tv-car-${room.id}-${p.id}">🏎️</span>
            </div>
            <span class="tv-finish-flag">🏁</span>
          </div>
        `;
        tracksList.appendChild(row);
      });

      els.roomsContainer.appendChild(card);
    });
  }

  // ── Anlık İlerleme Akışı (TV Stream) ─────────────────────────
  socket.on("tv:progress-update", ({ roomId, playerId, progress, wpm }) => {
    const fillEl = $(`#tv-fill-${roomId}-${playerId}`);
    const wpmEl  = $(`#tv-wpm-${roomId}-${playerId}`);
    const pctEl  = $(`#tv-pct-${roomId}-${playerId}`);

    const cleanPct = Math.min(100, Math.max(0, Math.round(progress)));

    if (fillEl) fillEl.style.width = `${cleanPct}%`;
    if (wpmEl)  wpmEl.textContent = `${Math.round(wpm)} WPM`;
    if (pctEl)  pctEl.textContent = `%${cleanPct}`;
  });

  socket.on("tv:player-finished", ({ roomId, playerId, rank, nickname }) => {
    const carEl = $(`#tv-car-${roomId}-${playerId}`);
    const tagEl = $(`#tv-rank-tag-${roomId}-${playerId}`);
    const medals = ["🥇 1.", "🥈 2.", "🥉 3."];
    const badge = rank <= 3 ? medals[rank - 1] : `#${rank}`;

    if (carEl) carEl.textContent = rank === 1 ? "🥇" : "🏁";
    if (tagEl) {
      tagEl.textContent = ` (${badge})`;
      tagEl.style.color = rank === 1 ? "#ffd700" : "#00d2d3";
      tagEl.style.fontWeight = "800";
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  2. SKORBOARD (LEADERBOARD) & OTOMATİK DÖNGÜ
  // ══════════════════════════════════════════════════════════════

  socket.on("leaderboard:update", (scores) => {
    allScores = scores || {};
    renderCurrentCategoryLeaderboard();
    updateTickerBar();
  });

  function renderCurrentCategoryLeaderboard() {
    const activeCat = CATEGORIES[currentCatIndex];
    els.categoryBadgeTitle.textContent = activeCat.name;

    // Sekme butonlarını güncelle
    els.tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.cat === activeCat.key);
    });

    const scores = allScores[activeCat.key] || [];
    els.leaderboardBody.innerHTML = "";

    if (scores.length === 0) {
      els.tableEmpty.style.display = "block";
      return;
    }

    els.tableEmpty.style.display = "none";

    scores.forEach((entry, index) => {
      const tr = document.createElement("tr");
      const medals = ["🥇", "🥈", "🥉"];
      const rank = index < 3 ? medals[index] : index + 1;

      tr.innerHTML = `
        <td class="col-rank">${rank}</td>
        <td class="col-nick">${escapeHtml(entry.nickname)}</td>
        <td class="col-wpm">${entry.wpm}</td>
        <td class="col-acc">%${entry.accuracy}</td>
      `;
      els.leaderboardBody.appendChild(tr);
    });
  }

  // Sekme tıklamaları
  els.tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      currentCatIndex = idx;
      renderCurrentCategoryLeaderboard();
      restartAutoRotateTimer();
    });
  });

  // Otomatik Döngü Zamanlayıcısı (Her 7 saniyede bir kategori değişir)
  function startAutoRotateTimer() {
    autoRotateInterval = setInterval(() => {
      currentCatIndex = (currentCatIndex + 1) % CATEGORIES.length;
      renderCurrentCategoryLeaderboard();
    }, 7000);
  }

  function restartAutoRotateTimer() {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
    startAutoRotateTimer();
  }

  startAutoRotateTimer();

  // ── Alt Kayan Yazı (Ticker) Güncelleme ───────────────────────
  function updateTickerBar() {
    const topArena = (allScores.MULTIPLAYER_VS && allScores.MULTIPLAYER_VS[0])
      ? `${allScores.MULTIPLAYER_VS[0].nickname} (${allScores.MULTIPLAYER_VS[0].wpm} WPM)`
      : "Henüz yok";

    const topWord = (allScores.SOLO_WORDS && allScores.SOLO_WORDS[0])
      ? `${allScores.SOLO_WORDS[0].nickname} (${allScores.SOLO_WORDS[0].wpm} WPM)`
      : "Henüz yok";

    const topText = (allScores.SOLO_TEXT && allScores.SOLO_TEXT[0])
      ? `${allScores.SOLO_TEXT[0].nickname} (${allScores.SOLO_TEXT[0].wpm} WPM)`
      : "Henüz yok";

    const topCode = (allScores.SOLO_CODE && allScores.SOLO_CODE[0])
      ? `${allScores.SOLO_CODE[0].nickname} (${allScores.SOLO_CODE[0].wpm} WPM)`
      : "Henüz yok";

    els.tickerContent.textContent =
      `🏆 GÜNÜN LİDERLERİ: [Arena Şampiyonu]: ${topArena}  |  [Kelime Rekoru]: ${topWord}  |  [Metin Lideri]: ${topText}  |  [Kod Canavarı]: ${topCode}  •  Stant masalarına oturup yarışa katılabilirsiniz!`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }
})();
