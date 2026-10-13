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

## 💻 Kolay Kurulum ve Çalıştırma

> ⚠️ **Önemli:** Bu proje gerçek zamanlı WebSocket (Socket.io) ve Node.js sunucusu kullandığı için **VS Code Live Server ile ÇALIŞMAZ**. Aşağıdaki 3 basit adımla kendi bilgisayarınızda başlatabilirsiniz:

### 1. Hazırlık
Bilgisayarınızda [Node.js](https://nodejs.org/) kurulu olduğundan emin olun.

### 2. Başlatma Adımları
Proje klasöründe bir terminal açın ve şu komutları çalıştırın:

```bash
# 1. Gerekli paketleri yükleyin (yalnızca ilk seferde gerekir)
npm install

# 2. Sunucuyu başlatın
node server.js
```

### 3. Oyuna Giriş
Terminalde sunucunun çalıştığı yazısını gördükten sonra tarayıcınızı açın:

- **Kendi bilgisayarınızdan oynamak için:**  
  👉 [http://localhost:3000](http://localhost:3000)
- **Büyük ekran / TV izleyici modu için:**  
  👉 [http://localhost:3000/tv.html](http://localhost:3000/tv.html)
- **Aynı Wi-Fi ağındaki arkadaşlarınızın katılması için:**  
  Kendi yerel IP adresinizi verin:  
  👉 `http://192.168.x.x:3000` *(Örn: `http://192.168.1.35:3000`)*

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

## 💻 Simple Installation & Setup

> ⚠️ **Note:** This project relies on a real-time WebSocket (Socket.io) and Node.js server, so it **will NOT work with VS Code Live Server**. Follow these quick steps:

### 1. Prerequisite
Ensure [Node.js](https://nodejs.org/) is installed on your computer.

### 2. Run the App
Open a terminal in the project directory and run:

```bash
# 1. Install dependencies (only needed the first time)
npm install

# 2. Start the server
node server.js
```

### 3. Open in Browser
Once you see the server running message in the terminal, open your browser:

- **Play on your own computer:**  
  👉 [http://localhost:3000](http://localhost:3000)
- **Big screen / TV spectator mode:**  
  👉 [http://localhost:3000/tv.html](http://localhost:3000/tv.html)
- **Invite friends on the same Wi-Fi network:**  
  Share your local LAN IP address:  
  👉 `http://192.168.x.x:3000` *(e.g. `http://192.168.1.35:3000`)*
