// ============================================================
//  Typing Race – Metin Havuzları (texts.js)
//  3 farklı solo mod için ayrıştırılmış Türkçe metin havuzları
// ============================================================

// ── SOLO_WORDS: Kelime Akışı ────────────────────────────────
// Noktalama işareti olmayan, Türkçe'de en sık kullanılan kelimeler.
// Rastgele N kelime seçilerek bir akış oluşturulur.
const SOLO_WORDS_POOL = [
  "bir", "bu", "ve", "için", "ile", "çok", "daha", "de", "da", "ne",
  "gibi", "var", "ben", "ama", "olan", "her", "kadar", "sonra", "bütün", "şey",
  "zaman", "kendi", "büyük", "iyi", "güzel", "yeni", "eski", "küçük", "uzun", "gün",
  "insan", "adam", "kadın", "çocuk", "ev", "su", "yol", "gece", "sabah", "akşam",
  "dünya", "hayat", "okul", "kitap", "yazı", "bilgi", "fikir", "haber", "para", "iş",
  "göz", "el", "baş", "kalp", "ses", "renk", "ışık", "gölge", "rüzgar", "yağmur",
  "araba", "masa", "kapı", "pencere", "bahçe", "sokak", "şehir", "köy", "deniz", "dağ",
  "sevgi", "korku", "umut", "mutlu", "üzgün", "kızgın", "sakin", "hızlı", "yavaş", "doğru",
  "bilmek", "gelmek", "gitmek", "almak", "vermek", "yapmak", "bakmak", "görmek", "duymak", "söylemek",
  "düşünmek", "anlamak", "istemek", "beklemek", "başlamak", "bitmek", "çalışmak", "okumak", "yazmak", "öğrenmek",
  "güneş", "ay", "yıldız", "bulut", "toprak", "ateş", "çiçek", "ağaç", "kuş", "kedi",
  "köpek", "balık", "renk", "müzik", "sanat", "spor", "oyun", "film", "tiyatro", "resim",
  "kahve", "çay", "ekmek", "yemek", "meyve", "sebze", "tatlı", "tuzlu", "acı", "sıcak",
  "soğuk", "güçlü", "zayıf", "zengin", "fakir", "genç", "yaşlı", "sağlık", "hastalık", "enerji",
  "proje", "takım", "hedef", "sonuç", "başarı", "deneyim", "fırsat", "sorun", "çözüm", "gelecek",
];

/**
 * SOLO_WORDS modunda: Havuzdan rastgele N kelime seçerek boşlukla birleştirir.
 * @param {number} wordCount – Üretilecek kelime sayısı (varsayılan 25)
 * @returns {string}
 */
function generateWordFlow(wordCount = 25) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = Math.floor(Math.random() * SOLO_WORDS_POOL.length);
    words.push(SOLO_WORDS_POOL[idx]);
  }
  return words.join(" ");
}

// ── SOLO_TEXT: Tam Metin ────────────────────────────────────
// Büyük/küçük harf duyarlı, noktalama işaretli anlamlı Türkçe cümleler.
const SOLO_TEXT = [
  "Güneş batarken denizin üzerinde altın renkli bir ışık hüzmesi belirdi ve dalga sesleri kulaklarımızda yankılandı.",
  "Kediler pencere kenarında oturarak dışarıdaki kuşları izlemeyi çok severler ve bu onların en sevdiği aktivitedir.",
  "Teknoloji dünyası her geçen gün daha hızlı gelişiyor ve yeni buluşlar hayatımızı köklü bir şekilde değiştiriyor.",
  "Sabah erken kalkıp bir fincan sıcak kahve eşliğinde kitap okumak ruhumu dinlendiren en güzel alışkanlığımdır.",
  "Üniversite kampüsünde sonbahar yaprakları döküldüğünde yürüyüş yapmak inanılmaz bir huzur veriyor insana.",
  "Bilgisayar programlama öğrenmek sabır ve pratik gerektirir ancak sonuçta elde edilen beceri son derece değerlidir.",
  "İstanbul Boğazı gece vakti ışıklarla süslendiğinde dünyanın en güzel manzaralarından birini sunar.",
  "Müzik evrensel bir dildir ve farklı kültürlerden insanları bir araya getirme gücüne sahiptir her zaman.",
  "Doğa yürüyüşleri hem fiziksel sağlığımıza hem de zihinsel huzurumuza büyük katkıda bulunur ve bizi yeniler.",
  "Takım çalışması başarıya ulaşmanın en etkili yollarından biridir ve birlikte çalışmak bireyleri güçlendirir.",
  "Yazılım mühendisliği alanında sürekli öğrenmek ve kendini geliştirmek profesyonel başarının anahtarıdır.",
  "Kütüphanede sessizce çalışırken saatlerin nasıl geçtiğini anlamıyorsun ve bir anda akşam oluveriyor.",
  "Robotik ve yapay zeka alanındaki gelişmeler gelecekte pek çok mesleği dönüştürecek ve yeni fırsatlar yaratacak.",
  "Türk mutfağı dünyanın en zengin mutfaklarından biridir ve her bölgenin kendine özgü lezzetleri vardır.",
  "Düzenli spor yapmak sadece fiziksel sağlığı değil aynı zamanda ruh sağlığını da olumlu yönde etkiler.",
  "Bir projenin başarılı olması için planlama, disiplin ve ekip içi iletişimin güçlü olması şarttır.",
  "Yağmurlu bir günde pencere kenarına oturup çay içmek ve dışarıdaki yağmuru izlemek huzur verici bir deneyimdir.",
  "Açık kaynak yazılımlar topluluk katkısıyla gelişir ve herkesin erişimine açık olması bilgi paylaşımını artırır.",
  "Sanat insanın duygularını ifade etmesinin en güçlü yollarından biridir ve toplumları birbirine bağlar.",
  "Matematik evrendeki düzenin dilini konuşur ve doğadaki örüntüleri anlamamıza yardımcı olan temel bir bilimdir.",
];

// ── SOLO_CODE: Kod Snippet ──────────────────────────────────
// Kısa programlama kod blokları: { }, ;, =>, if/else, print gibi özel karakterler içerir.
const SOLO_CODE = [
  'const greet = (name) => { return "Merhaba, " + name + "!"; };',
  'function topla(a, b) { return a + b; } console.log(topla(3, 5));',
  'if (x > 10) { console.log("Büyük"); } else { console.log("Küçük"); }',
  'const nums = [1, 2, 3, 4, 5]; const sum = nums.reduce((a, b) => a + b, 0);',
  'for (let i = 0; i < 10; i++) { console.log("Sayı: " + i); }',
  'const user = { name: "Ali", age: 25 }; console.log(user.name);',
  'let result = (a >= b) ? "Büyük" : "Küçük"; return result;',
  'async function fetchData(url) { const res = await fetch(url); return res.json(); }',
  'class Araba { constructor(marka) { this.marka = marka; } calistir() { return true; } }',
  'const [first, ...rest] = [10, 20, 30, 40]; console.log(first, rest);',
  'try { JSON.parse(data); } catch (err) { console.error("Hata:", err.message); }',
  'const map = new Map(); map.set("anahtar", 42); console.log(map.get("anahtar"));',
  'document.querySelector("#btn").addEventListener("click", () => { alert("Tıklandı!"); });',
  'const filtrelenmis = dizi.filter((x) => x % 2 === 0).map((x) => x * 2);',
  'switch (renk) { case "kırmızı": return "#ff0000"; case "mavi": return "#0000ff"; default: return "#000"; }',
  'import { useState, useEffect } from "react"; const [count, setCount] = useState(0);',
  'const promise = new Promise((resolve, reject) => { setTimeout(() => resolve("OK"), 1000); });',
  'while (queue.length > 0) { const item = queue.shift(); process(item); }',
  'const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);',
  'Object.keys(obj).forEach((key) => { console.log(key + ": " + obj[key]); });',
];

// ── Geçerli Mod Anahtarları ─────────────────────────────────
const VALID_MODES = ["SOLO_WORDS", "SOLO_TEXT", "SOLO_CODE"];

/**
 * Verilen moda göre rastgele metin döndürür.
 * @param {string} mode – "SOLO_WORDS" | "SOLO_TEXT" | "SOLO_CODE"
 * @returns {string}
 */
function getRandomText(mode) {
  switch (mode) {
    case "SOLO_WORDS":
      return generateWordFlow(25);

    case "SOLO_TEXT": {
      const idx = Math.floor(Math.random() * SOLO_TEXT.length);
      return SOLO_TEXT[idx];
    }

    case "SOLO_CODE": {
      const idx = Math.floor(Math.random() * SOLO_CODE.length);
      return SOLO_CODE[idx];
    }

    default:
      // Bilinmeyen mod → varsayılan olarak tam metin
      return SOLO_TEXT[Math.floor(Math.random() * SOLO_TEXT.length)];
  }
}

module.exports = {
  VALID_MODES,
  getRandomText,
};
