# 📦 Sistem Atribut — Setup Guide

Website manajemen pengambilan atribut dengan QR Code, terintegrasi dengan Google Sheets.

## 🗂 Struktur File

```
atribut-system/
├── index.html     → Aplikasi utama (SPA)
├── config.js      → ⚙️ Konfigurasi (URL Apps Script & item list)
├── app.js         → Logic aplikasi
├── style.css      → Custom styles
├── Code.gs        → Script untuk Google Apps Script (backend)
└── README.md      → Panduan ini
```

---

## 🚀 Langkah Setup (Urutan Penting!)

### Langkah 1 — Setup Google Sheets & Apps Script

1. Buka [Google Sheets](https://sheets.google.com) → buat spreadsheet baru
2. Di menu: **Extensions → Apps Script**
3. Hapus semua kode default
4. Copy-paste seluruh isi file `Code.gs` ke editor Apps Script
5. Klik **Save** (ikon disket / Ctrl+S)
6. Klik **Deploy → New deployment**
7. Isi konfigurasi:
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Klik **Deploy** → izinkan akses Google
9. **Copy URL** yang muncul (format: `https://script.google.com/macros/s/...`)

> ⚠️ **Penting:** Setiap kali mengubah Code.gs, kamu harus membuat **New Deployment** (bukan update), agar URL-nya tetap valid.

---

### Langkah 2 — Edit `config.js`

Buka file `config.js` dan isi dua nilai ini:

```js
const CONFIG = {
  // Paste URL dari langkah 1
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby.../exec',

  // URL GitHub Pages kamu (lihat langkah 3)
  SITE_URL: 'https://johndoe.github.io/atribut-system',

  ITEMS: [ ... ] // sudah terisi, tidak perlu diubah
};
```

---

### Langkah 3 — Deploy ke GitHub Pages

1. Buat repository baru di GitHub (misal: `atribut-system`)
2. Upload semua file ke repository tersebut
3. Masuk ke **Settings → Pages**
4. Source: **Branch: main**, Folder: **/ (root)**
5. Klik **Save**
6. Tunggu beberapa menit → URL akan muncul:
   `https://USERNAME.github.io/atribut-system`
7. Copy URL ini → paste ke `SITE_URL` di `config.js`
8. Commit & push perubahan `config.js`

---

## 📱 Cara Pakai

### Input Data Peserta
- Buka web → login dengan nama petugas
- Klik **Input** → isi Nama, NIM, No. WA, centang item atribut
- Klik **Simpan & Generate QR** → QR Code muncul → bisa di-print

### Scan QR (Saat Pengambilan)
- Petugas buka web di HP → klik **Scan**
- Klik **Mulai Scan** → arahkan kamera ke QR peserta
- Halaman konfirmasi muncul: nama, NIM, item atribut
- Klik **✅ Ambil** untuk konfirmasi, atau **❌ Batal**

### Cek Siapa Belum Ambil
- Klik **Pending** di bottom nav
- Daftar peserta yang belum ambil muncul
- Klik **Hubungi** → langsung buka WhatsApp dengan pesan otomatis

### Input via Google Sheet
Bisa tambah data langsung di Google Sheet dengan format kolom:
| id | nama | nim | noWa | items | status | waktuAmbil | petugas |
|----|------|-----|------|-------|--------|------------|---------|
| (kosongkan, isi manual atau pakai timestamp) | Budi | 2021001 | 081234567890 | `["Pin Enamel","Keychain A"]` | Belum | | |

**Catatan:** kolom `items` harus dalam format JSON array seperti contoh di atas.

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Data tidak muncul | Cek `SCRIPT_URL` di config.js, pastikan Apps Script sudah di-deploy |
| QR scan tidak bisa | Pastikan akses kamera di-allow di browser HP |
| URL QR salah | Pastikan `SITE_URL` di config.js sudah diisi dengan URL GitHub Pages yang benar |
| Halaman tidak update | Google Apps Script di-cache; deploy ulang jika ada perubahan |

---

## 📞 Teknologi yang Digunakan

- **Frontend**: HTML + Tailwind CSS + Vanilla JS (GitHub Pages)
- **QR Generator**: [qrcode.js](https://github.com/davidshimjs/qrcodejs)
- **QR Scanner**: [html5-qrcode](https://github.com/mebjas/html5-qrcode)
- **Backend**: Google Apps Script (REST API)
- **Database**: Google Sheets
