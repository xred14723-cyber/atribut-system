/* ============================================================
   APP.JS — Sistem Atribut (Main Application Logic)
   ============================================================ */

// ─────────────────────────────────────────────
// DEMO MODE (aktif otomatis jika SCRIPT_URL belum diisi)
// Gunakan data palsu agar bisa dicoba langsung tanpa Apps Script
// ─────────────────────────────────────────────
const DEMO_STORE = {
  records: [
    { id: '1728640000001', nama: 'Andi Pratama',  nim: '2021001001', noWa: '081234567890', items: ['Pin Enamel','Keychain A','Sticker A'],  status: 'Sudah', waktuAmbil: '11/10/2024 14:30', petugas: 'Rini' },
    { id: '1728640000002', nama: 'Bella Sari',    nim: '2021001002', noWa: '082233445566', items: ['Pin MKP','Keychain B','Sticker B'],     status: 'Belum', waktuAmbil: '', petugas: '' },
    { id: '1728640000003', nama: 'Candra Wijaya', nim: '2021001003', noWa: '083344556677', items: ['Keychain Kain','Pin Enamel'],           status: 'Belum', waktuAmbil: '', petugas: '' },
    { id: '1728640000004', nama: 'Diana Putri',   nim: '2021001004', noWa: '084455667788', items: ['Keychain C','Keychain D','Sticker A'],  status: 'Sudah', waktuAmbil: '11/10/2024 15:10', petugas: 'Budi' },
    { id: '1728640000005', nama: 'Eko Susanto',   nim: '2021001005', noWa: '085566778899', items: ['Pin MKP','Keychain E','Keychain F'],    status: 'Belum', waktuAmbil: '', petugas: '' },
    { id: '1728640000006', nama: 'Fira Ananda',   nim: '2021001006', noWa: '',             items: ['Keychain G','Sticker B'],               status: 'Belum', waktuAmbil: '', petugas: '' },
  ]
};

const isDemoMode = () => !CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes('PASTE_YOUR');
const demoDelay  = (ms = 400) => new Promise(r => setTimeout(r, ms));

async function demoAPI(params) {
  await demoDelay();
  switch (params.action) {
    case 'getAll':
      return { success: true, data: DEMO_STORE.records.map(r => ({ ...r })) };

    case 'getById': {
      const rec = DEMO_STORE.records.find(r => r.id === params.id);
      return rec ? { success: true, data: { ...rec } } : { success: false, error: 'Tidak ditemukan' };
    }
    case 'add': {
      const id    = Date.now().toString();
      const items = JSON.parse(params.items || '[]');
      DEMO_STORE.records.push({ id, nama: params.nama, nim: params.nim, noWa: params.noWa || '', items, status: 'Belum', waktuAmbil: '', petugas: '' });
      return { success: true, id };
    }
    case 'update': {
      const idx = DEMO_STORE.records.findIndex(r => r.id === params.id);
      if (idx === -1) return { success: false, error: 'Tidak ditemukan' };
      const now = new Date();
      const fmt = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      DEMO_STORE.records[idx] = { ...DEMO_STORE.records[idx], status: 'Sudah', waktuAmbil: fmt, petugas: params.petugas || 'Demo' };
      return { success: true };
    }
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const state = {
  data          : [],
  currentScanner: null
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const getOfficer = ()       => localStorage.getItem('officer');
const setOfficer = (name)   => localStorage.setItem('officer', name);
const clearOfficer = ()     => localStorage.removeItem('officer');

/** Format 08xx → 628xx */
function formatPhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if      (p.startsWith('08')) p = '628' + p.slice(2);
  else if (p.startsWith('8'))  p = '62'  + p;
  else if (!p.startsWith('62')) p = '62' + p;
  return p;
}

/** Show toast notification */
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = [
    'fixed top-4 left-4 right-4 z-50 p-4 rounded-2xl font-semibold text-white text-center shadow-xl',
    'transition-opacity duration-300',
    type === 'error'   ? 'bg-red-500'   :
    type === 'warning' ? 'bg-amber-500' : 'bg-green-500'
  ].join(' ');
  el.style.opacity = '1';
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 350);
  }, 2600);
}

/** Show / hide full-screen loading overlay */
function loading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

// ─────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────
function nav(view) {
  stopScanner(); // always stop scanner when leaving scan view

  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

  // Show target view
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.remove('hidden');

  // Bottom nav visibility (hidden on login & confirm)
  const noNav = ['login', 'confirm'];
  document.getElementById('bottom-nav').classList.toggle('hidden', noNav.includes(view));

  // Update active nav highlight
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.querySelector('i')?.classList.toggle('text-indigo-600', active);
    btn.querySelector('i')?.classList.toggle('text-gray-400', !active);
    btn.querySelector('span')?.classList.toggle('text-indigo-600', active);
    btn.querySelector('span')?.classList.toggle('text-gray-400', !active);
  });
}

// ─────────────────────────────────────────────
// API — menggunakan JSONP agar 100% bebas blokir CORS browser
// ─────────────────────────────────────────────
function api(params) {
  if (isDemoMode()) return demoAPI(params);

  return new Promise((resolve, reject) => {
    const callbackName = 'gas_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const query = new URLSearchParams({ ...params, callback: callbackName }).toString();
    const script = document.createElement('script');
    script.src = CONFIG.SCRIPT_URL + '?' + query;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi timeout (Google Apps Script tidak merespon)'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function () {
      cleanup();
      reject(new Error('Gagal menghubungi Google Apps Script'));
    };

    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────
// VIEW: LOGIN
// ─────────────────────────────────────────────
function initLogin() {
  document.getElementById('login-form').onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('officer-name').value.trim();
    if (!name) return;
    setOfficer(name);

    const pendingId = sessionStorage.getItem('pendingId');
    if (pendingId) {
      sessionStorage.removeItem('pendingId');
      nav('confirm');
      loadConfirm(pendingId);
    } else {
      nav('dashboard');
      loadDashboard();
    }
  };
}

// ─────────────────────────────────────────────
// VIEW: DASHBOARD
// ─────────────────────────────────────────────
async function loadDashboard() {
  document.getElementById('officer-display').textContent = getOfficer() || '-';
  try {
    loading(true);
    const res = await api({ action: 'getAll' });
    state.data = res.data || [];

    const total = state.data.length;
    const sudah = state.data.filter(d => d.status === 'Sudah').length;
    const belum = total - sudah;
    const pct   = total > 0 ? Math.round((sudah / total) * 100) : 0;

    document.getElementById('d-total').textContent = total;
    document.getElementById('d-sudah').textContent = sudah;
    document.getElementById('d-belum').textContent = belum;
    document.getElementById('d-pct').textContent   = pct + '%';
    document.getElementById('d-bar').style.width   = pct + '%';
  } catch (err) {
    toast('Gagal memuat data: ' + err.message, 'error');
  } finally {
    loading(false);
  }
}

// ─────────────────────────────────────────────
// VIEW: INPUT DATA
// ─────────────────────────────────────────────
function initInput() {
  // Populate item checkboxes from CONFIG
  const box = document.getElementById('items-box');
  box.innerHTML = '';
  CONFIG.ITEMS.forEach(item => {
    const label = document.createElement('label');
    label.className = [
      'flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer',
      'border border-transparent hover:border-indigo-200 hover:bg-indigo-50 transition'
    ].join(' ');
    label.innerHTML = `
      <input type="checkbox" value="${item}" class="item-cb w-4 h-4 rounded shrink-0">
      <span class="text-sm font-medium text-gray-700 leading-tight">${item}</span>
    `;
    box.appendChild(label);
  });

  // Select-all toggle
  document.getElementById('select-all').onchange = function () {
    document.querySelectorAll('.item-cb').forEach(cb => (cb.checked = this.checked));
  };

  // Form submit
  document.getElementById('input-form').onsubmit = async (e) => {
    e.preventDefault();
    const nama  = document.getElementById('f-nama').value.trim();
    const nim   = document.getElementById('f-nim').value.trim();
    const noWa  = document.getElementById('f-nowa').value.trim();
    const items = [...document.querySelectorAll('.item-cb:checked')].map(cb => cb.value);

    if (!nama || !nim)   return toast('Nama dan NIM wajib diisi!', 'error');
    if (!items.length)   return toast('Pilih minimal 1 item atribut!', 'error');

    try {
      loading(true);
      const res = await api({ action: 'add', nama, nim, noWa, items: JSON.stringify(items) });
      if (res.success) {
        toast('Data berhasil disimpan! ✅');
        showQRModal(res.id, nama, items);
        e.target.reset();
        document.querySelectorAll('.item-cb').forEach(cb => (cb.checked = false));
        document.getElementById('select-all').checked = false;
      } else {
        toast('Gagal menyimpan: ' + (res.error || 'Error'), 'error');
      }
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    } finally {
      loading(false);
    }
  };
}

// ─────────────────────────────────────────────
// QR CODE MODAL
// ─────────────────────────────────────────────
function showQRModal(id, nama, items) {
  const qrUrl = `${CONFIG.SITE_URL}?id=${id}`;
  document.getElementById('qr-m-nama').textContent  = nama;
  document.getElementById('qr-m-items').textContent = items.join(', ');
  document.getElementById('qr-m-url').textContent   = qrUrl;

  const box = document.getElementById('qr-m-code');
  box.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(box, {
    text        : qrUrl,
    width       : 200,
    height      : 200,
    colorDark   : '#3730a3',
    colorLight  : '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  document.getElementById('qr-modal').classList.remove('hidden');
}

// ─────────────────────────────────────────────
// VIEW: DAFTAR PESERTA
// ─────────────────────────────────────────────
async function loadList() {
  try {
    loading(true);
    const res  = await api({ action: 'getAll' });
    state.data = res.data || [];
    renderList();
  } catch (err) {
    toast('Gagal memuat: ' + err.message, 'error');
  } finally {
    loading(false);
  }
}

function renderList() {
  const filter = document.getElementById('list-filter').value;
  const search = document.getElementById('list-search').value.toLowerCase();

  let items = state.data;
  if (filter === 'belum') items = items.filter(d => d.status !== 'Sudah');
  if (filter === 'sudah') items = items.filter(d => d.status === 'Sudah');
  if (search) items = items.filter(d =>
    d.nama.toLowerCase().includes(search) ||
    String(d.nim).toLowerCase().includes(search)
  );

  const box = document.getElementById('list-container');
  if (!items.length) {
    box.innerHTML = `
      <div class="text-center py-14 text-gray-300">
        <i class="fas fa-search text-5xl block mb-3"></i>
        <p class="text-gray-400">Tidak ada data</p>
      </div>`;
    return;
  }

  box.innerHTML = items.map(p => {
    const waPhone = formatPhone(p.noWa);
    const qrUrl   = `${CONFIG.SITE_URL}?id=${p.id}`;
    const taken   = p.status === 'Sudah';
    return `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-gray-800">${p.nama}</span>
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold
                ${taken ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
                ${taken ? '✓ Sudah' : '⏳ Belum'}
              </span>
            </div>
            <p class="text-sm text-gray-500 mt-0.5">${p.nim}</p>
            <p class="text-xs text-gray-400 mt-1 leading-relaxed">${(p.items || []).join(' · ')}</p>
            ${taken ? `
              <p class="text-xs text-green-600 mt-1">
                <i class="fas fa-clock mr-1"></i>${p.waktuAmbil}
                &nbsp;·&nbsp;
                <i class="fas fa-user mr-1"></i>${p.petugas}
              </p>` : ''}
          </div>
          <div class="flex flex-col gap-2 shrink-0">
            ${p.noWa ? `
              <a href="https://wa.me/${waPhone}" target="_blank"
                class="w-9 h-9 flex items-center justify-center bg-green-500 text-white rounded-xl hover:bg-green-600 transition">
                <i class="fab fa-whatsapp text-sm"></i>
              </a>` : ''}
            <button onclick="toggleQR('${p.id}','${qrUrl}')"
              class="w-9 h-9 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition">
              <i class="fas fa-qrcode text-sm"></i>
            </button>
          </div>
        </div>
        <!-- QR expand area -->
        <div id="qr-wrap-${p.id}" class="hidden mt-3 pt-3 border-t border-gray-100 flex flex-col items-center gap-2">
          <div id="qr-box-${p.id}"></div>
          <p class="text-xs text-gray-400 break-all text-center">${qrUrl}</p>
        </div>
      </div>`;
  }).join('');
}

function toggleQR(id, url) {
  const wrap = document.getElementById(`qr-wrap-${id}`);
  if (!wrap) return;
  wrap.classList.toggle('hidden');
  if (!wrap.classList.contains('hidden')) {
    const box = document.getElementById(`qr-box-${id}`);
    if (box && !box.querySelector('img,canvas')) {
      // eslint-disable-next-line no-undef
      new QRCode(box, { text: url, width: 160, height: 160, colorDark: '#3730a3', colorLight: '#fff' });
    }
  }
}

// ─────────────────────────────────────────────
// VIEW: SCAN QR (camera)
// ─────────────────────────────────────────────
function startScanner() {
  const btnStart = document.getElementById('scan-start-btn');
  const btnStop  = document.getElementById('scan-stop-btn');
  const reader   = document.getElementById('scan-reader');

  reader.innerHTML = '';
  btnStart.classList.add('hidden');
  btnStop.classList.remove('hidden');

  // eslint-disable-next-line no-undef
  state.currentScanner = new Html5Qrcode('scan-reader');
  state.currentScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    (decoded) => {
      stopScanner();
      // Extract ?id= from scanned URL
      let scanId = null;
      try {
        const u = new URL(decoded);
        scanId   = u.searchParams.get('id');
      } catch {
        scanId = decoded; // fallback: treat raw string as ID
      }

      if (scanId) {
        nav('confirm');
        loadConfirm(scanId);
      } else {
        toast('QR tidak dikenal, coba lagi!', 'warning');
        startScanner();
      }
    },
    () => {} // per-frame error — silently ignored
  ).catch(err => {
    toast('Kamera tidak bisa diakses. Izinkan akses kamera!', 'error');
    console.error(err);
    stopScanner();
  });
}

function stopScanner() {
  if (state.currentScanner) {
    state.currentScanner.stop().catch(() => {});
    state.currentScanner = null;
  }
  const btnStart = document.getElementById('scan-start-btn');
  const btnStop  = document.getElementById('scan-stop-btn');
  const reader   = document.getElementById('scan-reader');
  if (btnStart) btnStart.classList.remove('hidden');
  if (btnStop)  btnStop.classList.add('hidden');
  if (reader)   reader.innerHTML = `
    <div class="flex flex-col items-center justify-center h-60 text-gray-300">
      <i class="fas fa-camera text-6xl mb-3"></i>
      <p class="text-sm">Kamera tidak aktif</p>
    </div>`;
}

// ─────────────────────────────────────────────
// VIEW: KONFIRMASI (after QR scan)
// ─────────────────────────────────────────────
async function loadConfirm(id) {
  const box = document.getElementById('confirm-box');
  box.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 gap-3">
      <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm text-gray-400">Mengambil data...</p>
    </div>`;

  try {
    const res = await api({ action: 'getById', id });

    if (!res.success || !res.data) {
      box.innerHTML = `
        <div class="text-center py-12 px-4">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-exclamation text-red-500 text-2xl"></i>
          </div>
          <p class="font-bold text-red-600 text-lg">Data tidak ditemukan</p>
          <p class="text-sm text-gray-400 mt-1 break-all">ID: ${id}</p>
          <button onclick="nav('scan')"
            class="mt-6 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-2xl transition">
            <i class="fas fa-arrow-left mr-2"></i>Kembali Scan
          </button>
        </div>`;
      return;
    }

    const p     = res.data;
    const taken = p.status === 'Sudah';
    const waPhone = formatPhone(p.noWa);

    box.innerHTML = `
      <!-- Avatar + nama -->
      <div class="text-center mb-5">
        <div class="w-20 h-20 ${taken ? 'bg-green-100' : 'bg-indigo-100'} rounded-full
          flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-user text-${taken ? 'green' : 'indigo'}-500 text-3xl"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">${p.nama}</h2>
        <p class="text-gray-500">${p.nim}</p>
      </div>

      <!-- Items -->
      <div class="bg-gray-50 rounded-2xl p-4 mb-4">
        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          <i class="fas fa-box mr-1"></i>Atribut
        </p>
        <ul class="space-y-1.5">
          ${(p.items || []).map(item => `
            <li class="flex items-center gap-2 text-gray-700 text-sm">
              <span class="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <i class="fas fa-tag text-indigo-500 text-xs"></i>
              </span>
              ${item}
            </li>`).join('')}
        </ul>
      </div>

      ${taken ? `
        <!-- Already taken -->
        <div class="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center mb-4">
          <i class="fas fa-check-circle text-green-500 text-4xl block mb-2"></i>
          <p class="font-bold text-green-700 text-xl">Sudah Diambil</p>
          <p class="text-sm text-green-600 mt-1">${p.waktuAmbil}</p>
          <p class="text-sm text-gray-500 mt-0.5">Petugas: <span class="font-semibold">${p.petugas}</span></p>
        </div>
        <button onclick="nav('scan')"
          class="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-2xl transition active:scale-95">
          <i class="fas fa-camera mr-2"></i>Scan Berikutnya
        </button>
      ` : `
        <!-- WA link -->
        ${p.noWa ? `
          <a href="https://wa.me/${waPhone}" target="_blank"
            class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-3 mb-4 hover:bg-green-100 transition">
            <i class="fab fa-whatsapp text-green-500 text-2xl"></i>
            <div>
              <p class="text-xs text-gray-400">Hubungi Peserta</p>
              <p class="font-semibold text-green-700">${p.noWa}</p>
            </div>
          </a>` : ''}

        <!-- Action buttons -->
        <div class="flex gap-3">
          <button onclick="doTake('${id}')"
            class="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-lg transition active:scale-95 shadow-lg shadow-indigo-200">
            <i class="fas fa-check mr-2"></i>Ambil
          </button>
          <button onclick="nav('scan')"
            class="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-2xl text-lg transition active:scale-95">
            <i class="fas fa-times mr-2"></i>Batal
          </button>
        </div>
      `}
    `;
  } catch (err) {
    box.innerHTML = `
      <p class="text-center text-red-500 py-8">
        <i class="fas fa-wifi-slash text-3xl block mb-2"></i>
        Error: ${err.message}
      </p>`;
  }
}

async function doTake(id) {
  const officer = getOfficer() || 'Unknown';
  try {
    loading(true);
    const res = await api({ action: 'update', id, petugas: officer });
    if (res.success) {
      toast('Berhasil diupdate! ✅');
      // Reload confirm view to show "sudah" state
      setTimeout(() => loadConfirm(id), 800);
    } else {
      toast('Gagal update: ' + (res.error || 'Error'), 'error');
    }
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    loading(false);
  }
}

// ─────────────────────────────────────────────
// VIEW: BELUM AMBIL
// ─────────────────────────────────────────────
async function loadPending() {
  try {
    loading(true);
    const res  = await api({ action: 'getAll' });
    state.data = res.data || [];

    const pending = state.data.filter(d => d.status !== 'Sudah');
    document.getElementById('pending-count').textContent = pending.length;

    const box = document.getElementById('pending-box');
    if (!pending.length) {
      box.innerHTML = `
        <div class="text-center py-16 px-4">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check-circle text-green-500 text-4xl"></i>
          </div>
          <p class="text-green-700 font-bold text-xl">Semua sudah ambil!</p>
          <p class="text-gray-400 mt-1">🎉 Kerja bagus!</p>
        </div>`;
      return;
    }

    const defaultMsg = (nama) =>
      encodeURIComponent(`Hei ${nama}! Jangan lupa ambil atributmu ya 😊`);

    box.innerHTML = pending.map(p => `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-800 truncate">${p.nama}</p>
            <p class="text-sm text-gray-500">${p.nim}</p>
            <p class="text-xs text-gray-400 mt-1">${(p.items || []).join(' · ')}</p>
          </div>
          ${p.noWa ? `
            <a href="https://wa.me/${formatPhone(p.noWa)}?text=${defaultMsg(p.nama)}"
              target="_blank"
              class="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-semibold text-sm">
              <i class="fab fa-whatsapp"></i>
              <span>Hubungi</span>
            </a>
          ` : `<span class="text-xs text-gray-300 shrink-0">No WA</span>`}
        </div>
      </div>`).join('');
  } catch (err) {
    toast('Gagal memuat: ' + err.message, 'error');
  } finally {
    loading(false);
  }
}

// ─────────────────────────────────────────────
// INIT — runs on DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Setup all static event listeners
  initLogin();
  initInput();

  // Bottom nav buttons
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      nav(v);
      if (v === 'dashboard') loadDashboard();
      else if (v === 'list')    loadList();
      else if (v === 'pending') loadPending();
    });
  });

  // Scan nav special button
  document.getElementById('scan-nav-btn').addEventListener('click', () => nav('scan'));

  // Scan view buttons
  document.getElementById('scan-start-btn').addEventListener('click', startScanner);
  document.getElementById('scan-stop-btn').addEventListener('click', stopScanner);

  // List — search & filter (live)
  document.getElementById('list-search').addEventListener('input', renderList);
  document.getElementById('list-filter').addEventListener('change', renderList);
  document.getElementById('list-refresh').addEventListener('click', loadList);

  // Dashboard refresh
  document.getElementById('dash-refresh').addEventListener('click', loadDashboard);

  // Change officer (logout)
  document.getElementById('change-officer').addEventListener('click', () => {
    clearOfficer();
    location.href = location.pathname; // reload without ?id
  });

  // QR Modal close
  document.getElementById('qr-modal-close').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.add('hidden');
  });

  // QR Modal print
  document.getElementById('qr-modal-print').addEventListener('click', () => {
    const name  = document.getElementById('qr-m-nama').textContent;
    const items = document.getElementById('qr-m-items').textContent;
    const url   = document.getElementById('qr-m-url').textContent;
    const qr    = document.getElementById('qr-m-code').innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>QR - ${name}</title>
      <style>body{font-family:sans-serif;display:flex;justify-content:center;padding:30px}
        .card{border:2px solid #4F46E5;border-radius:16px;padding:24px;text-align:center;max-width:300px}
        h2{margin:0 0 4px;font-size:18px} p{color:#555;font-size:13px;margin:4px 0}
        .url{font-size:10px;color:#aaa;word-break:break-all;margin-top:8px}
      </style></head><body>
      <div class="card">
        <h2>${name}</h2>
        <p>${items}</p>
        <div style="margin:16px 0">${qr}</div>
        <p class="url">${url}</p>
      </div>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    w.document.close();
  });

  // 2. Check URL params — did someone scan a QR?
  const urlParams = new URLSearchParams(window.location.search);
  const scanId    = urlParams.get('id');

  if (scanId) {
    // Opened via QR scan
    if (getOfficer()) {
      nav('confirm');
      loadConfirm(scanId);
    } else {
      sessionStorage.setItem('pendingId', scanId);
      // Show login, hide nav
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      document.getElementById('view-login').classList.remove('hidden');
      document.getElementById('bottom-nav').classList.add('hidden');
    }
  } else {
    // Normal startup
    if (getOfficer()) {
      nav('dashboard');
      loadDashboard();
    } else {
      document.getElementById('view-login').classList.remove('hidden');
      document.getElementById('bottom-nav').classList.add('hidden');
    }
  }

  // Show demo banner if Apps Script not configured
  if (isDemoMode()) {
    document.getElementById('demo-banner').classList.remove('hidden');
    // Offset body top so banner doesn't cover content
    document.body.style.paddingTop = '28px';
  }
});
