// ============================================================
//  Typing Race – Merkezi Sunucu (server.js)
//  Express + Socket.io ile LAN üzerinde çalışan oyun sunucusu
//  v4: Otomatik Çoklu Oda Yönetimi + TV / İzleyici Ekranı Desteği
// ============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { VALID_MODES, getRandomText } = require("./texts");

// ── Yapılandırma ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, "scores.json");
const MAX_SCORES_PER_CATEGORY = 10;  // Her kategori için Top 10
const MAX_PLAYERS_PER_ROOM = 4;      // Stand maçları için ideal oda kapasitesi

// ── Anti-Cheat & Sanity Check Sınırları ─────────────────────
const MAX_HUMAN_WPM = 210;           // İnsan biyolojisi ve dünya şampiyonası sınırı
const MIN_HUMAN_WPM = 5;
const MIN_ACCURACY = 40;
const MAX_ACCURACY = 100;

// ── Express & Socket.io Kurulumu ────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },          // LAN'daki tüm cihazlara izin ver
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Statik dosyaları sun (public/ klasörü)
app.use(express.static(path.join(__dirname, "public")));

// ── Skor Yönetimi (Kategori Bazlı) ─────────────────────────
let leaderboard = loadScores();

/**
 * Dosyadan skorları yükle (Eski format uyumluluğu ve eksik kategori kontrolüyle)
 */
function loadScores() {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SCORES_FILE, "utf-8"));

      if (Array.isArray(raw)) {
        console.log("📦  Eski skor formatı algılandı, SOLO_TEXT'e taşınıyor…");
        const migrated = createEmptyBoard();
        migrated.SOLO_TEXT = raw.slice(0, MAX_SCORES_PER_CATEGORY);
        return migrated;
      }

      const board = createEmptyBoard();
      for (const key of VALID_MODES) {
        if (Array.isArray(raw[key])) {
          board[key] = raw[key];
        }
      }
      return board;
    }
  } catch (err) {
    console.error("Skor dosyası okunamadı, sıfırdan başlatılıyor:", err.message);
  }
  return createEmptyBoard();
}

/** Boş kategori bazlı skor objesi oluştur */
function createEmptyBoard() {
  const board = {};
  for (const key of VALID_MODES) {
    board[key] = [];
  }
  return board;
}

/** Skorları dosyaya kalıcı olarak yaz */
function saveScores() {
  try {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(leaderboard, null, 2), "utf-8");
  } catch (err) {
    console.error("Skorlar dosyaya yazılamadı:", err.message);
  }
}

/** Belirli bir kategorideki listeyi sırala: Önce WPM (azalan), eşitlikte doğruluk (azalan) */
function sortCategory(category) {
  if (!leaderboard[category]) return;
  leaderboard[category].sort((a, b) => {
    if (b.wpm !== a.wpm) return b.wpm - a.wpm;
    return b.accuracy - a.accuracy;
  });
}

// ── Multiplayer Odaları (Room Management) ───────────────────
// roomId => { id, hostId, status, text, finishCount, countdownTimer, players: { [socketId]: player } }
const rooms = new Map();

/** İstemcilere ve TV'ye gönderilecek güvenli oda durumu */
function serializeRoomState(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status, // "waiting" | "countdown" | "racing" | "finished"
    finishCount: room.finishCount,
    playerCount: Object.keys(room.players).length,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.id === room.hostId,
      progress: p.progress,
      wpm: p.wpm,
      accuracy: p.accuracy,
      isFinished: p.isFinished,
      rank: p.rank,
    })),
  };
}

/** Tüm odaların özet durumunu TV ekranı ve lobiler için listele */
function getAllRoomsSummary() {
  return Array.from(rooms.values()).map(serializeRoomState);
}

/** TV ve genel izleyicilere odaların son halini yayınla */
function broadcastTvRooms() {
  io.emit("tv:rooms-update", getAllRoomsSummary());
}

/**
 * Dinamik Oda Belirleme (Auto-Match / Boş Masa Bulma)
 * - Eğer özel bir isim istenmişse o kullanılır.
 * - Otomatik modda: Bekleyen ("waiting") ve kapasitesi dolmamış (< 4) ilk oda seçilir.
 * - Yoksa sıradaki MASA-1, MASA-2... şeklinde yeni oda açılır.
 */
function findOrCreateRoomId(customRoomId) {
  if (customRoomId && customRoomId.trim().length > 0) {
    return customRoomId.trim().toUpperCase().substring(0, 15);
  }

  // 1. Bekleyen ve yer olan oda var mı?
  for (const [roomId, room] of rooms.entries()) {
    if (room.status === "waiting" && Object.keys(room.players).length < MAX_PLAYERS_PER_ROOM) {
      return roomId;
    }
  }

  // 2. Yoksa sıradaki MASA-X numarasını bul
  let index = 1;
  while (rooms.has(`MASA-${index}`)) {
    index++;
  }
  return `MASA-${index}`;
}

/** Oyuncu odadan ayrıldığında oda durumunu güncelle veya odayı sil */
function handlePlayerLeave(socket) {
  const roomId = socket.data.currentRoom;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  delete room.players[socket.id];
  socket.leave(roomId);
  socket.data.currentRoom = null;

  const remainingPlayerIds = Object.keys(room.players);
  if (remainingPlayerIds.length === 0) {
    // Oda boşaldı, zamanlayıcı varsa durdur ve odayı sil
    if (room.countdownTimer) clearInterval(room.countdownTimer);
    rooms.delete(roomId);
    console.log(`🚪  Oda silindi (boş): ${roomId}`);
  } else {
    // Host ayrıldıysa bir sonraki oyuncuyu host yap
    if (room.hostId === socket.id) {
      room.hostId = remainingPlayerIds[0];
      console.log(`👑  Yeni oda hostu: ${room.players[room.hostId].nickname} (${roomId})`);
    }
    io.to(roomId).emit("room:state", serializeRoomState(room));
  }

  broadcastTvRooms();
}

// ── Socket.io Olayları ──────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✅  Bağlandı: ${socket.id}`);

  // İstemci bağlandığında TÜM kategorilerdeki güncel liderlik tablosunu ilet
  socket.emit("leaderboard:update", leaderboard);

  // TV / İzleyici ekranı bağlandığında anında tüm odaları gönder
  socket.emit("tv:rooms-update", getAllRoomsSummary());

  // ── Solo Mod Metin İsteği ───────────────────────────────────
  socket.on("game:request-text", (data) => {
    const mode = data && VALID_MODES.includes(data.mode) ? data.mode : "SOLO_TEXT";
    const text = getRandomText(mode);

    // Anti-Cheat: Sunucu tarafı zaman damgası ve metin uzunluğu kaydı
    socket.data.soloGame = {
      textLength: text.length,
      startTime: Date.now(),
      mode,
    };

    socket.emit("game:text", { text, mode });
  });

  // ── Solo Mod Skor Bildirimi (Anti-Cheat Korumalı) ────────────
  socket.on("game:submit-score", (data) => {
    const { nickname, wpm, accuracy, mode } = data;

    if (!nickname || typeof wpm !== "number" || typeof accuracy !== "number") {
      return socket.emit("game:error", { message: "Geçersiz skor verisi." });
    }

    // 1. Mantıksal Sınır Kontrolü (Sanity Check)
    if (wpm > MAX_HUMAN_WPM || wpm < MIN_HUMAN_WPM || accuracy < MIN_ACCURACY || accuracy > MAX_ACCURACY) {
      console.warn(`🚨 [Hile Engellendi] Aşırı WPM / Geçersiz Değer: ${nickname} (WPM: ${wpm}, Acc: ${accuracy}%)`);
      return socket.emit("game:error", {
        message: "Hile Koruması: Skor insan anatomisi sınırlarına aykırı bulundu! (Maks 210 WPM)",
      });
    }

    // 2. Zaman Tutarlılığı Doğrulaması (İmkansız Süre Kontrolü)
    if (socket.data.soloGame && socket.data.soloGame.startTime) {
      const elapsedSec = (Date.now() - socket.data.soloGame.startTime) / 1000;
      const minRequiredSec = socket.data.soloGame.textLength / 22; // Saniyede maks 22 karakter
      if (elapsedSec < minRequiredSec) {
        console.warn(`🚨 [Hile Engellendi] İmkansız yazma süresi! ${nickname} (${elapsedSec.toFixed(2)}s)`);
        return socket.emit("game:error", {
          message: "Hile Koruması: İmkansız yazma süresi tespit edildi!",
        });
      }
    }

    const category = VALID_MODES.includes(mode) ? mode : "SOLO_TEXT";

    const entry = {
      nickname: nickname.trim().substring(0, 20),
      wpm: Math.round(wpm * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      mode: category,
      timestamp: new Date().toISOString(),
    };

    leaderboard[category].push(entry);
    sortCategory(category);

    if (leaderboard[category].length > MAX_SCORES_PER_CATEGORY) {
      leaderboard[category] = leaderboard[category].slice(0, MAX_SCORES_PER_CATEGORY);
    }

    saveScores();
    io.emit("leaderboard:update", leaderboard);
    console.log(`🏆  [${category}] Yeni solo skor: ${entry.nickname} → ${entry.wpm} WPM, %${entry.accuracy}`);
  });

  // ════════════════════════════════════════════════════════════
  //  MULTIPLAYER ARENA (1v1v1) ETKİLEŞİMLERİ
  // ════════════════════════════════════════════════════════════

  // Odaya Katılma / Otomatik Boş Odaya Eşleşme
  socket.on("room:join", ({ roomId, nickname, autoMatch }) => {
    if (!nickname || nickname.trim().length === 0) {
      return socket.emit("room:error", { message: "Lütfen bir rumuz girin." });
    }

    const sanitizedNick = nickname.trim().substring(0, 20);

    // Otomatik eşleşme bayrağı varsa veya oda belirtilmemişse boş oda bul / oluştur
    const targetRoomId = (autoMatch || !roomId || roomId.trim().length === 0)
      ? findOrCreateRoomId(null)
      : findOrCreateRoomId(roomId);

    // Önceden başka odadaysa ayrıl
    handlePlayerLeave(socket);

    let room = rooms.get(targetRoomId);
    if (!room) {
      room = {
        id: targetRoomId,
        hostId: socket.id,
        status: "waiting",
        text: "",
        finishCount: 0,
        countdownTimer: null,
        players: {},
      };
      rooms.set(targetRoomId, room);
      console.log(`🏠  Yeni arena masası kuruldu: ${targetRoomId} (Host: ${sanitizedNick})`);
    } else if (room.status === "racing") {
      // Yarış başlamışsa odaya izleyici olarak girebilir veya yeni odaya yönlendir
      const altRoomId = findOrCreateRoomId(null);
      return socket.emit("room:error", {
        message: `${targetRoomId} şu anda yarışta! Başka bir masaya bağlanın: ${altRoomId}`,
      });
    }

    room.players[socket.id] = {
      id: socket.id,
      nickname: sanitizedNick,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      isFinished: false,
      rank: null,
    };

    socket.join(targetRoomId);
    socket.data.currentRoom = targetRoomId;
    socket.data.nickname = sanitizedNick;

    io.to(targetRoomId).emit("room:state", serializeRoomState(room));
    broadcastTvRooms();
  });

  // Odadan Ayrılma
  socket.on("room:leave", () => {
    handlePlayerLeave(socket);
  });

  // Yarışı Başlatma (Host tetikler)
  socket.on("room:start", () => {
    const roomId = socket.data.currentRoom;
    if (!roomId || !rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    if (room.hostId !== socket.id) {
      return socket.emit("room:error", { message: "Sadece masa kurucusu yarışı başlatabilir." });
    }

    // Ortak yarış metni belirle (Shared Seed)
    room.text = getRandomText("SOLO_TEXT");
    room.status = "countdown";
    room.finishCount = 0;

    // Tüm oyuncu istatistiklerini sıfırla
    Object.values(room.players).forEach((p) => {
      p.progress = 0;
      p.wpm = 0;
      p.accuracy = 100;
      p.isFinished = false;
      p.rank = null;
    });

    // 3 Saniyelik Eş Zamanlı Geri Sayımı Başlat
    let countdown = 3;
    io.to(roomId).emit("room:countdown", {
      count: countdown,
      text: room.text,
      state: serializeRoomState(room),
    });

    broadcastTvRooms();

    if (room.countdownTimer) clearInterval(room.countdownTimer);

    room.countdownTimer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.to(roomId).emit("room:countdown", { count: countdown });
      } else if (countdown === 0) {
        io.to(roomId).emit("room:countdown", { count: 0 }); // "BAŞLA!" sinyali
      } else {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        room.status = "racing";
        io.to(roomId).emit("room:race-start", {
          startTime: Date.now(),
          text: room.text,
          state: serializeRoomState(room),
        });
        broadcastTvRooms();
      }
    }, 1000);
  });

  // Canlı İlerleme Akışı (Real-time Progress Stream)
  socket.on("room:progress", ({ progress, wpm, accuracy }) => {
    const roomId = socket.data.currentRoom;
    if (!roomId || !rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    if (room.status !== "racing") return;

    const player = room.players[socket.id];
    if (!player || player.isFinished) return;

    player.progress = Math.min(100, Math.max(0, Math.round(progress)));
    player.wpm = Math.round(wpm);
    player.accuracy = Math.round(accuracy);

    const updatePayload = {
      roomId,
      playerId: socket.id,
      progress: player.progress,
      wpm: player.wpm,
      accuracy: player.accuracy,
    };

    // Odadaki tüm cihazlara anlık yayınla
    io.to(roomId).emit("room:progress-update", updatePayload);

    // TV / İzleyici ekranlarına da anlık ilerlemeyi yayınla
    io.emit("tv:progress-update", updatePayload);
  });

  // Oyuncu Metni Bitirdi
  socket.on("room:finish", ({ wpm, accuracy }) => {
    const roomId = socket.data.currentRoom;
    if (!roomId || !rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    if (room.status !== "racing") return;

    const player = room.players[socket.id];
    if (!player || player.isFinished) return;

    // Anti-Cheat & Sanity Check (Arena Modu)
    if (wpm > MAX_HUMAN_WPM || wpm < MIN_HUMAN_WPM || accuracy < MIN_ACCURACY || accuracy > MAX_ACCURACY) {
      console.warn(`🚨 [Hile Engellendi - Arena] Aşırı WPM / Değer: ${player.nickname} (${wpm} WPM, %${accuracy})`);
      return socket.emit("room:error", {
        message: "Hile Koruması: Skor insan anatomisi sınırlarına aykırı bulundu! (Maks 210 WPM)",
      });
    }

    if (room.startTime) {
      const elapsedSec = (Date.now() - room.startTime) / 1000;
      const minRequiredSec = room.text.length / 22; // Saniyede maks 22 karakter
      if (elapsedSec < minRequiredSec) {
        console.warn(`🚨 [Hile Engellendi - Arena] İmkansız yarış süresi: ${player.nickname} (${elapsedSec.toFixed(2)}s)`);
        return socket.emit("room:error", {
          message: "Hile Koruması: İmkansız yazma süresi tespit edildi!",
        });
      }
    }

    room.finishCount++;
    player.isFinished = true;
    player.progress = 100;
    player.rank = room.finishCount;
    player.wpm = Math.round(wpm * 100) / 100;
    player.accuracy = Math.round(accuracy * 100) / 100;

    const finishPayload = {
      roomId,
      playerId: socket.id,
      nickname: player.nickname,
      rank: player.rank,
      wpm: player.wpm,
      accuracy: player.accuracy,
    };

    // Oyuncu bitirişini odaya ve TV ekranına duyur
    io.to(roomId).emit("room:player-finished", finishPayload);
    io.emit("tv:player-finished", finishPayload);

    // 🏆 MULTIPLAYER_VS Genel Liderlik Tablosuna Ekle
    const entry = {
      nickname: player.nickname,
      wpm: player.wpm,
      accuracy: player.accuracy,
      rank: player.rank,
      mode: "MULTIPLAYER_VS",
      timestamp: new Date().toISOString(),
    };

    leaderboard.MULTIPLAYER_VS.push(entry);
    sortCategory("MULTIPLAYER_VS");

    if (leaderboard.MULTIPLAYER_VS.length > MAX_SCORES_PER_CATEGORY) {
      leaderboard.MULTIPLAYER_VS = leaderboard.MULTIPLAYER_VS.slice(0, MAX_SCORES_PER_CATEGORY);
    }

    saveScores();
    io.emit("leaderboard:update", leaderboard);
    console.log(`🏁  [${roomId}] Derece #${player.rank}: ${player.nickname} (${player.wpm} WPM)`);

    // Odadaki herkes bitirdi mi kontrolü
    const totalPlayers = Object.keys(room.players).length;
    if (room.finishCount >= totalPlayers) {
      room.status = "finished";
      const podium = Object.values(room.players)
        .slice()
        .sort((a, b) => (a.rank || 999) - (b.rank || 999));

      io.to(roomId).emit("room:match-ended", { podium });
      io.emit("tv:match-ended", { roomId, podium });
    }

    broadcastTvRooms();
  });

  // ════════════════════════════════════════════════════════════
  //  GİZLİ ADMİN PANELİ ETKİLEŞİMLERİ
  // ════════════════════════════════════════════════════════════

  // Skorboard Temizleme (Tek kategori veya hepsi)
  socket.on("admin:clear-scores", ({ category }) => {
    if (category === "ALL") {
      leaderboard = createEmptyBoard();
      console.log("🛠️ [Admin] Tüm skorlar temizlendi.");
    } else if (VALID_MODES.includes(category)) {
      leaderboard[category] = [];
      console.log(`🛠️ [Admin] ${category} skorları temizlendi.`);
    }
    saveScores();
    io.emit("leaderboard:update", leaderboard);
    socket.emit("admin:action-success", { message: "Skorboard başarıyla güncellendi." });
  });

  // Test Verisi Ekleme
  socket.on("admin:add-test-score", ({ nickname, wpm, accuracy, mode }) => {
    const category = VALID_MODES.includes(mode) ? mode : "SOLO_TEXT";
    const entry = {
      nickname: (nickname || "TestOyuncu").trim().substring(0, 20),
      wpm: Math.round(Number(wpm) || 85),
      accuracy: Math.round(Number(accuracy) || 98),
      mode: category,
      timestamp: new Date().toISOString(),
    };
    leaderboard[category].push(entry);
    sortCategory(category);
    if (leaderboard[category].length > MAX_SCORES_PER_CATEGORY) {
      leaderboard[category] = leaderboard[category].slice(0, MAX_SCORES_PER_CATEGORY);
    }
    saveScores();
    io.emit("leaderboard:update", leaderboard);
    socket.emit("admin:action-success", { message: `Test skoru eklendi: ${entry.nickname} (${entry.wpm} WPM)` });
  });

  // Odayı Kapatma / Sıfırlama
  socket.on("admin:close-room", ({ roomId }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.countdownTimer) clearInterval(room.countdownTimer);
      io.to(roomId).emit("room:error", { message: "Masa yönetici tarafından sıfırlandı." });
      io.in(roomId).socketsLeave(roomId);
      rooms.delete(roomId);
      broadcastTvRooms();
      console.log(`🛠️ [Admin] ${roomId} odası kapatıldı.`);
      socket.emit("admin:action-success", { message: `${roomId} masası kapatıldı.` });
    }
  });

  // Bağlantı Kesilme
  socket.on("disconnect", () => {
    handlePlayerLeave(socket);
    console.log(`❌  Ayrıldı: ${socket.id}`);
  });
});

// ── Sunucuyu Başlat ─────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   ⌨️   Typing Race Sunucusu v4 (Multi-Room + TV Modu)  ║
║   📡   http://0.0.0.0:${PORT}                             ║
║   📺   TV / İzleyici: http://0.0.0.0:${PORT}/tv.html      ║
║   📂   Modlar: ${VALID_MODES.join(", ")}    ║
╚════════════════════════════════════════════════════════╝
  `);
});
