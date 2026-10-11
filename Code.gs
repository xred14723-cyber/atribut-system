/**
 * ============================================================
 * GOOGLE APPS SCRIPT BACKEND — Sistem Atribut
 * ============================================================
 * CARA PAKAI:
 *  1. Buka Google Sheets baru → Extensions → Apps Script
 *  2. Hapus konten default, paste seluruh isi file ini
 *  3. Deploy: Deploy → New deployment → Web App
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4. Copy URL deployment → paste ke config.js (SCRIPT_URL)
 * ============================================================
 */

const SHEET_NAME = 'Data';

// ─────────────────────────────────────────────
// ENTRY POINT (semua request pakai GET agar
// bebas CORS preflight)
// ─────────────────────────────────────────────
function doGet(e) {
  const p = e.parameter;

  // Ambil / buat sheet
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initSheet(sheet);
  } else if (sheet.getLastRow() === 0) {
    initSheet(sheet);
  }

  let result;
  switch (p.action) {
    case 'getAll':  result = getAllData(sheet);              break;
    case 'getById': result = getById(sheet, p.id);          break;
    case 'add':     result = addRecord(sheet, p);           break;
    case 'update':  result = updateRecord(sheet, p.id, p.petugas); break;
    default:        result = { success: false, error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// INISIALISASI HEADER SHEET
// ─────────────────────────────────────────────
function initSheet(sheet) {
  const headers = ['id', 'nama', 'nim', 'noWa', 'items', 'status', 'waktuAmbil', 'petugas'];
  sheet.appendRow(headers);
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold')
       .setBackground('#4F46E5')
       .setFontColor('#ffffff')
       .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  // Lebarkan kolom items
  sheet.setColumnWidth(5, 300);
}

// ─────────────────────────────────────────────
// GET ALL DATA
// ─────────────────────────────────────────────
function getAllData(sheet) {
  const lr = sheet.getLastRow();
  if (lr < 2) return { success: true, data: [] };

  const rows = sheet.getRange(2, 1, lr - 1, 8).getValues();
  const data = rows
    .filter(r => r[0] !== '')
    .map(r => ({
      id         : String(r[0]),
      nama       : r[1],
      nim        : r[2],
      noWa       : r[3],
      items      : safeJSON(r[4]),
      status     : r[5] || 'Belum',
      waktuAmbil : r[6] ? Utilities.formatDate(new Date(r[6]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '',
      petugas    : r[7]
    }));

  return { success: true, data };
}

// ─────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────
function getById(sheet, id) {
  const lr = sheet.getLastRow();
  if (lr < 2 || !id) return { success: false, error: 'Not found' };

  const rows = sheet.getRange(2, 1, lr - 1, 8).getValues();
  const row  = rows.find(r => String(r[0]) === String(id));
  if (!row) return { success: false, error: 'Data tidak ditemukan' };

  return {
    success: true,
    data: {
      id         : String(row[0]),
      nama       : row[1],
      nim        : row[2],
      noWa       : row[3],
      items      : safeJSON(row[4]),
      status     : row[5] || 'Belum',
      waktuAmbil : row[6] ? Utilities.formatDate(new Date(row[6]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '',
      petugas    : row[7]
    }
  };
}

// ─────────────────────────────────────────────
// ADD RECORD
// ─────────────────────────────────────────────
function addRecord(sheet, p) {
  if (!p.nama || !p.nim) return { success: false, error: 'Nama dan NIM wajib diisi' };

  const id    = new Date().getTime().toString();
  let   items = [];
  try   { items = JSON.parse(p.items || '[]'); }
  catch { items = []; }

  sheet.appendRow([
    id,
    p.nama  || '',
    p.nim   || '',
    p.noWa  || '',
    JSON.stringify(items),
    'Belum',
    '',
    ''
  ]);

  return { success: true, id };
}

// ─────────────────────────────────────────────
// UPDATE STATUS → SUDAH
// ─────────────────────────────────────────────
function updateRecord(sheet, id, petugas) {
  if (!id) return { success: false, error: 'ID diperlukan' };

  const lr  = sheet.getLastRow();
  if (lr < 2) return { success: false, error: 'No data' };

  const ids = sheet.getRange(2, 1, lr - 1, 1).getValues().flat().map(String);
  const idx = ids.findIndex(r => r === String(id));
  if (idx === -1) return { success: false, error: 'ID tidak ditemukan' };

  const sheetRow = idx + 2; // +2 karena header di row 1, data mulai row 2
  sheet.getRange(sheetRow, 6).setValue('Sudah');
  sheet.getRange(sheetRow, 7).setValue(new Date());
  sheet.getRange(sheetRow, 8).setValue(petugas || 'Unknown');

  return { success: true };
}

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────
function safeJSON(str) {
  if (!str) return [];
  try { return JSON.parse(str); } catch { return []; }
}
