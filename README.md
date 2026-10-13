# ⌨️ Typing Race (LAN Multiplayer)

Üniversite kulüp stantları ve etkinlikler için tasarlanmış; yerel ağda (LAN) çalışan, WebSocket tabanlı gerçek zamanlı hızlı yazma klavye oyunu.

---

## 🚀 Oyun Modları

- **📝 Kelime Akışı (`SOLO_WORDS`):** Noktalama işareti içermeyen, en sık kullanılan Türkçe kelimelerle saf yazma hızı testi.
- **📖 Tam Metin (`SOLO_TEXT`):** Noktalama işaretleri ve büyük/küçük harf duyarlılığı barındıran anlamlı cümleler.
- **💻 Kod Snippet (`SOLO_CODE`):** Programlama dili sözdizimleri (`{ }`, `=>`, `if/else`, `;`) içeren monospace mod.
- **🏁 Multiplayer Arena (`MULTIPLAYER_VS`):** Aynı masadaki/odadaki rakiplerle ortak metin üzerinden eş zamanlı 1v1v1 yarış.

---

## 🌟 Öne Çıkan Özellikler

- **🏎️ Canlı Yarış Pisti:** Rakiplerin anlık tamamlanma yüzdelerini (`%`) ve `WPM` değerlerini gösteren canlı ilerleme çubukları.
- **📺 TV / İzleyici Ekranı (`/tv.html`):** Stanttaki büyük monitör ve TV'ler için tasarlanmış; tüm masaların yarışlarını ve dönen liderlik tablosunu yansıtan canlı yayın paneli.
- **🎵 Dahili Ses Motoru (Web Audio API):** Mekanik klavye tıklamaları, hata uyarıları, geri sayım bipleri ve zafer fanfarı (ekstra dosya indirmesi gerektirmez).
- **🛡️ Gelişmiş Hile Koruması (Anti-Cheat):** Kopyala-yapıştır engeli, sekme değiştirme/odak kaybı diskalifiye kontrolü ve 210 WPM üzeri bot sanity check denetimi.
- **🛠️ Gizli Admin Paneli:** `Ctrl + Shift + A` (veya `Alt + Shift + K`) kısayolu ile liderlik tablosunu temizleme, masaları sıfırlama ve test skoru ekleme aracı.

---

## 💻 Kurulum ve Çalıştırma

Projeyi çalıştırmak için bilgisayarınızda **Node.js** yüklü olmalıdır.

```bash
# 1. Repoyu klonlayın
git clone https://github.com/kullanici-adi/typing-race-prototip.git
cd typing-race-prototip

# 2. Bağımlılıkları yükleyin
npm install

# 3. Sunucuyu başlatın
node server.js
```

Sunucu başladıktan sonra:
- **Oyuncu Ekranı:** `http://localhost:3000` *(veya yerel ağdaki IP: `http://192.168.x.x:3000`)*
- **TV İzleyici Ekranı:** `http://localhost:3000/tv.html`

---
---

# ⌨️ Typing Race (LAN Multiplayer) — English

A real-time, WebSocket-based typing competition game running on a Local Area Network (LAN), tailored for university club booths and campus events.

---

## 🚀 Game Modes

- **📝 Word Flow (`SOLO_WORDS`):** Punctuation-free Turkish common words stream for raw typing speed.
- **📖 Full Text (`SOLO_TEXT`):** Case-sensitive, punctuated meaningful sentences.
- **💻 Code Snippet (`SOLO_CODE`):** Monospace programming syntax containing symbols (`{ }`, `=>`, `if/else`, `;`).
- **🏁 Multiplayer Arena (`MULTIPLAYER_VS`):** Synchronized 1v1v1 head-to-head racing with shared seed texts.

---

## 🌟 Key Highlights

- **🏎️ Real-Time Track Stream:** Moving race cars and synchronized progress bars displaying opponents' real-time `%` and `WPM`.
- **📺 TV Spectator Broadcast (`/tv.html`):** Dedicated full-screen broadcast layout for big venue monitors featuring live race lanes and rotating leaderboards.
- **🎵 Built-In Sound Engine (Web Audio API):** Satisfying mechanical clicks, error thuds, countdown chimes, and victory fanfares without external audio downloads.
- **🛡️ Anti-Cheat & Sanity Checks:** Paste/drop blocking, tab-switch/blur auto-disqualification, and server-side human limit checks (max 210 WPM).
- **🛠️ Secret Admin Panel:** Triggered via `Ctrl + Shift + A` (or `Alt + Shift + K`) to wipe leaderboards, close stuck rooms, and inject test scores.

---

## 💻 Installation & Setup

Make sure you have **Node.js** installed on your machine.

```bash
# 1. Clone repository
git clone https://github.com/username/typing-race-prototip.git
cd typing-race-prototip

# 2. Install dependencies
npm install

# 3. Start the server
node server.js
```

Once running:
- **Player Interface:** `http://localhost:3000` *(or LAN IP: `http://192.168.x.x:3000`)*
- **TV Spectator Dashboard:** `http://localhost:3000/tv.html`
