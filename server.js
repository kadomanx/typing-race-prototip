// ============================================================
//  Typing Race – Merkezi Sunucu (server.js)
//  Express + Socket.io ile LAN üzerinde çalışan oyun sunucusu
//  v2: Kategori bazlı skorboard + mod seçimi desteği
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
// Yapı: { SOLO_WORDS: [...], SOLO_TEXT: [...], SOLO_CODE: [...] }
let leaderboard = loadScores();

/**
 * Dosyadan skorları yükle.
 * Eski formatta (düz dizi) gelebilir → onu SOLO_TEXT'e migrate et.
 */
function loadScores() {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SCORES_FILE, "utf-8"));

      // Eski format uyumluluğu: düz dizi → SOLO_TEXT'e ata
      if (Array.isArray(raw)) {
        console.log("📦  Eski skor formatı algılandı, SOLO_TEXT'e taşınıyor…");
        const migrated = createEmptyBoard();
        migrated.SOLO_TEXT = raw.slice(0, MAX_SCORES_PER_CATEGORY);
        return migrated;
      }

      // Eksik kategorileri ekle
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

// ── Socket.io Olayları ──────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✅  Bağlandı: ${socket.id}`);

  // İstemci bağlandığında TÜM kategorilerdeki skorları gönder
  socket.emit("leaderboard:update", leaderboard);

  // İstemci yeni metin istediğinde → mod bilgisine göre uygun havuzdan seç
  socket.on("game:request-text", (data) => {
    const mode = data && VALID_MODES.includes(data.mode) ? data.mode : "SOLO_TEXT";
    const text = getRandomText(mode);
    socket.emit("game:text", { text, mode });
  });

  // Oyun bitince skor gelir → İlgili kategoriye ekle, sırala, herkese yay
  socket.on("game:submit-score", (data) => {
    const { nickname, wpm, accuracy, mode } = data;

    // Temel doğrulama
    if (!nickname || typeof wpm !== "number" || typeof accuracy !== "number") {
      return socket.emit("game:error", { message: "Geçersiz skor verisi." });
    }

    // Geçerli mod kontrolü
    const category = VALID_MODES.includes(mode) ? mode : "SOLO_TEXT";

    const entry = {
      nickname: nickname.trim().substring(0, 20),   // Maks 20 karakter
      wpm: Math.round(wpm * 100) / 100,             // 2 ondalık
      accuracy: Math.round(accuracy * 100) / 100,
      mode: category,
      timestamp: new Date().toISOString(),
    };

    leaderboard[category].push(entry);
    sortCategory(category);

    // Her kategori için Top 10 tut
    if (leaderboard[category].length > MAX_SCORES_PER_CATEGORY) {
      leaderboard[category] = leaderboard[category].slice(0, MAX_SCORES_PER_CATEGORY);
    }

    saveScores();

    // 🔊 Tüm bağlı cihazlara güncellenmiş skor tablosunu yayınla (Broadcast)
    io.emit("leaderboard:update", leaderboard);
    console.log(`🏆  [${category}] Yeni skor: ${entry.nickname} → ${entry.wpm} WPM, %${entry.accuracy}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌  Ayrıldı: ${socket.id}`);
  });
});

// ── Sunucuyu Başlat ─────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   ⌨️  Typing Race Sunucusu Çalışıyor        ║
║   📡  http://0.0.0.0:${PORT}                   ║
║   🌐  LAN'daki cihazlardan bağlanabilir      ║
║   📂  Modlar: ${VALID_MODES.join(", ")}  ║
╚══════════════════════════════════════════════╝
  `);
});
