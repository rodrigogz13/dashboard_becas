/* ============================================================
   CONSTANTS
   ============================================================ */
const TIPOS = ['Nuevo ingreso', 'Carrera Trunca', 'Carrera Inconclusa', 'Titulación', 'Titulación Posgrado'];

const TYPE_CODES = {
  'Nuevo ingreso':       'NI',
  'Carrera Trunca':      'CT',
  'Carrera Inconclusa':  'CI',
  'Titulación':          'TI',
  'Titulación Posgrado': 'TP'
};

const TIPO_COLORS = {
  'Nuevo ingreso':       '#10b981',
  'Carrera Trunca':      '#f59e0b',
  'Carrera Inconclusa':  '#ef4444',
  'Titulación':          '#3b82f6',
  'Titulación Posgrado': '#8b5cf6'
};

const TIPOS_BAJA  = ['Voluntaria', 'Tácita'];
const STATUS_LIST = ['Activo', 'Baja', 'Suspendido'];
const AUTH_KEY = 'becas_token';

/* ============================================================
   API HELPER
   ============================================================ */
function getToken() { return sessionStorage.getItem(AUTH_KEY); }
function isLoggedIn() { return !!getToken(); }

async function apiFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (res.status === 401) { logout(); return null; }
  return res;
}

/* ============================================================
   AUTH UI
   ============================================================ */
function showLoginScreen() {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  setTimeout(() => document.getElementById('login-user').focus(), 60);
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-layout').style.display = '';
}

async function handleLogin(e) {
  e.preventDefault();
  const usuario  = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });
    if (!res.ok) {
      document.getElementById('login-error').style.display = '';
      document.getElementById('login-pass').value = '';
      document.getElementById('login-pass').focus();
      return;
    }
    const data = await res.json();
    sessionStorage.setItem(AUTH_KEY, data.token);
    currentUser = { usuario: data.usuario, rol: data.rol };
    await initApp();
  } catch {
    document.getElementById('login-error').style.display = '';
  }
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  currentUser = null;
  showLoginScreen();
}

/* ============================================================
   DATA LOADER
   ============================================================ */
async function loadData() {
  const [bRes, cRes] = await Promise.all([
    apiFetch('/api/beneficiarios'),
    apiFetch('/api/config')
  ]);
  if (!bRes || !cRes) return false;
  db.beneficiarios = await bRes.json();
  cfg = await cRes.json();
  return true;
}

function defaultDB() {
  return { beneficiarios: [] };
}

/* ============================================================
   STATE
   ============================================================ */
let db          = defaultDB();
let cfg         = { bolsaGlobal: 0, periodo: '' };
let currentUser = null;
let buscarEditId  = null;
let buscarQuery   = '';
let reporteFilter = 'Todos';

/* ============================================================
   UTILS
   ============================================================ */
function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function badge(estatus, tipoBaja) {
  const cls = { Activo:'badge-activo', Baja:'badge-baja', Suspendido:'badge-suspendido' };
  const lbl = (estatus === 'Baja' && tipoBaja) ? `${estatus} · ${tipoBaja}` : estatus;
  return `<span class="badge ${cls[estatus] || ''}">${esc(lbl)}</span>`;
}
function folioBadge(f) { return `<span class="folio-code">${esc(f)}</span>`; }

/* Folio auto-generation: YY-XX-NNNN (10 chars) */
function nextFolioByTipo(tipo) {
  if (!tipo) return '';
  const yy   = String(new Date().getFullYear()).slice(-2);
  const code = TYPE_CODES[tipo] || 'XX';
  const pre  = `${yy}-${code}-`;
  const max  = db.beneficiarios
    .filter(b => b.folio && b.folio.startsWith(pre))
    .reduce((m, b) => {
      const n = parseInt(b.folio.replace(pre, ''), 10) || 0;
      return Math.max(m, n);
    }, 0);
  return `${pre}${String(max + 1).padStart(4, '0')}`;
}

/* calcStats — only ACTIVO beneficiaries count toward assigned money.
   Baja/Suspendido return their amount to the bolsa automatically. */
function calcStats() {
  const total     = db.beneficiarios.length;
  const activos   = db.beneficiarios.filter(b => b.estatus === 'Activo').length;
  const bajas     = db.beneficiarios.filter(b => b.estatus === 'Baja').length;
  const totalAsig = db.beneficiarios
    .filter(b => b.estatus === 'Activo')
    .reduce((s, b) => s + (b.montoAutorizado || 0), 0);
  const disponible = (cfg.bolsaGlobal || 0) - totalAsig;
  return { total, activos, bajas, totalAsig, disponible };
}

function showToast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (ok ? '' : ' toast-error');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove('show'), 3400);
}

/* ============================================================
   GLOBAL UI HELPERS  (called from inline onchange handlers)
   ============================================================ */
function toggleBajaGroup(selectEl, groupId) {
  const el = document.getElementById(groupId);
  if (el) el.style.display = (selectEl.value === 'Baja') ? '' : 'none';
}

function updateFolioPreview(tipo, inputId) {
  const input = document.getElementById(inputId);
  if (input) input.value = nextFolioByTipo(tipo);
}

/* ============================================================
   ROUTER
   ============================================================ */
async function navigate(page) {
  buscarEditId = null; buscarQuery = ''; reporteFilter = 'Todos';
  await loadData();
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
  const renderers = { inicio:pageInicio, registrar:pageRegistrar, buscar:pageBuscar, bolsa:pageBolsa, reportes:pageReportes, config:pageConfig };
  document.getElementById('main-content').innerHTML = renderers[page]();
  (afterRender[page] || (() => {}))();
}

const afterRender = {
  registrar() {
    document.getElementById('form-registrar').addEventListener('submit', handleRegistrar);
  },
  buscar() {
    document.getElementById('buscar-search').addEventListener('input', e => {
      buscarQuery = e.target.value;
      updateBuscarTable();
    });
  },
  reportes() {
    document.getElementById('reporte-filter').addEventListener('change', e => {
      reporteFilter = e.target.value;
      updateReporteTable();
    });
    document.getElementById('btn-export').addEventListener('click', exportCSV);
  },
  config() {
    document.getElementById('form-config').addEventListener('submit', handleConfigSave);
    document.getElementById('form-password').addEventListener('submit', handlePasswordChange);
  }
};

/* ============================================================
   SHARED FORM FRAGMENTS
   ============================================================ */
function tiposOpts(selected) {
  return TIPOS.map(t =>
    `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)} (${TYPE_CODES[t]})</option>`
  ).join('');
}
function statusOpts(selected) {
  return STATUS_LIST.map(s =>
    `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');
}
function bajaTipoOpts(selected) {
  return TIPOS_BAJA.map(t =>
    `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)}</option>`
  ).join('');
}

/* ============================================================
   PAGE: INICIO
   ============================================================ */
function pageInicio() {
  const s = calcStats();
  const rows = db.beneficiarios.length
    ? db.beneficiarios.slice().reverse().map(b => `
        <tr>
          <td>${folioBadge(b.folio)}</td>
          <td><strong>${esc(b.nombre)}</strong></td>
          <td><span class="tipo-tag">${esc(b.tipo)} <em>(${TYPE_CODES[b.tipo] || '?'})</em></span></td>
          <td>${badge(b.estatus, b.tipoBaja)}</td>
          <td class="mono">${b.estatus === 'Activo' ? fmt(b.montoAutorizado) : '<span class="monto-baja">—</span>'}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="empty-row">Sin registros aún.</td></tr>`;

  return `
  <div class="page-inner">
    <header class="content-header">
      <div>
        <h1 class="page-title">Inicio</h1>
        <p class="page-subtitle">Bienvenido al sistema &mdash; ${esc(cfg.periodo)}</p>
      </div>
    </header>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon-wrap si-emerald">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div><p class="stat-label">Bolsa Global</p><p class="stat-val">${fmt(cfg.bolsaGlobal)}</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap si-blue">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div><p class="stat-label">Total Asignado</p><p class="stat-val">${fmt(s.totalAsig)}</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap si-red">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
        </div>
        <div><p class="stat-label">Disponible</p><p class="stat-val">${fmt(s.disponible)}</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap si-amber">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div><p class="stat-label">Activos</p><p class="stat-val">${s.activos}<small> / ${s.total}</small></p></div>
      </div>
    </div>

    <div class="content-card">
      <div class="card-header-row">
        <h2 class="card-title">Beneficiarios registrados</h2>
        <span class="record-count">${db.beneficiarios.length} registro(s)</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Folio</th><th>Nombre</th><th>Tipo de Beca</th><th>Estatus</th><th>Monto Asignado</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   PAGE: REGISTRAR PERSONA
   ============================================================ */
function pageRegistrar() {
  return `
  <div class="page-inner">
    <header class="content-header with-icon">
      <div class="header-icon-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
      </div>
      <div>
        <h1 class="page-title">Registrar Persona</h1>
        <p class="page-subtitle">Agregar un nuevo beneficiario al sistema</p>
      </div>
    </header>

    <div class="content-card">
      <h2 class="card-inner-title">Registrar persona</h2>
      <form id="form-registrar" class="reg-form" autocomplete="off">

        <!-- Fila 1: Tipo + Estatus -->
        <div class="form-row-2">
          <div class="form-group">
            <label>Tipo de beca <span class="req">*</span></label>
            <select name="tipo" id="reg-tipo" required
              onchange="updateFolioPreview(this.value,'reg-folio')">
              <option value="" disabled selected>Seleccionar tipo</option>
              ${tiposOpts('')}
            </select>
          </div>
          <div class="form-group">
            <label>Estatus</label>
            <select name="estatus"
              onchange="toggleBajaGroup(this,'reg-baja-group')">
              <option value="Activo" selected>Activo</option>
              <option value="Baja">Baja</option>
              <option value="Suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        <!-- Tipo de Baja (condicional) -->
        <div id="reg-baja-group" class="baja-group" style="display:none">
          <div class="form-group" style="max-width:220px">
            <label>Tipo de Baja</label>
            <select name="tipoBaja">${bajaTipoOpts('')}</select>
          </div>
        </div>

        <!-- Fila 2: Folio + Nombre -->
        <div class="form-row-2">
          <div class="form-group">
            <label>Folio <span class="field-hint">(auto — 10 caracteres)</span></label>
            <input type="text" id="reg-folio" name="folio"
              placeholder="Seleccionar tipo para generar…"
              readonly class="input-readonly folio-input"/>
          </div>
          <div class="form-group">
            <label>Nombre completo <span class="req">*</span></label>
            <input type="text" name="nombre" placeholder="Nombre completo" required/>
          </div>
        </div>

        <!-- Fila 3: CURP + Correo -->
        <div class="form-row-2">
          <div class="form-group">
            <label>CURP <span class="req">*</span></label>
            <input type="text" name="curp" placeholder="CURP" maxlength="18"
              style="text-transform:uppercase" required/>
          </div>
          <div class="form-group">
            <label>Correo electrónico</label>
            <input type="email" name="correo" placeholder="correo@ejemplo.com"/>
          </div>
        </div>

        <!-- Teléfonos -->
        <div class="form-section-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.15 3.45 2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
          Teléfonos
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Alumno</label>
            <input type="tel" name="telAlumno" placeholder="10 dígitos" maxlength="10"/>
          </div>
          <div class="form-group">
            <label>Familiar 1</label>
            <input type="tel" name="telFam1" placeholder="10 dígitos" maxlength="10"/>
          </div>
          <div class="form-group">
            <label>Familiar 2</label>
            <input type="tel" name="telFam2" placeholder="10 dígitos" maxlength="10"/>
          </div>
        </div>

        <!-- Montos -->
        <div class="form-row-2">
          <div class="form-group">
            <label>Monto Autorizado <span class="field-hint">(fijo)</span></label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input type="number" name="montoAutorizado" placeholder="0.00"
                min="0" step="0.01" class="has-prefix"/>
            </div>
          </div>
          <div class="form-group">
            <label>Monto Derogado <span class="field-hint">(actualizable)</span></label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input type="number" name="montoDerogado" placeholder="0.00"
                min="0" step="0.01" class="has-prefix"/>
            </div>
          </div>
        </div>

        <!-- Cheque -->
        <div class="form-section-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Cheque
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" name="chequeFecha"/>
          </div>
          <div class="form-group">
            <label>Cantidad</label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input type="number" name="chequeCantidad" placeholder="0.00"
                min="0" step="0.01" class="has-prefix"/>
            </div>
          </div>
          <div class="form-group">
            <label>Folio del Cheque</label>
            <input type="text" name="chequeFolio" placeholder="CHQ-0001"/>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary btn-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Registrar Beneficiario
          </button>
        </div>
      </form>
    </div>
  </div>`;
}

/* ============================================================
   PAGE: BUSCAR / EDITAR
   ============================================================ */
function pageBuscar() {
  return `
  <div class="page-inner buscar-page">
    <header class="content-header">
      <div>
        <h1 class="page-title">Buscar / Editar</h1>
        <p class="page-subtitle">Encuentra y modifica información de beneficiarios</p>
      </div>
    </header>
    <div class="buscar-layout">
      <div class="buscar-left">
        <div class="search-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="buscar-search"
            placeholder="Buscar por folio, nombre o CURP…" autocomplete="off"/>
        </div>
        <p class="result-count" id="buscar-count">${db.beneficiarios.length} resultado(s)</p>
        <div class="content-card" style="overflow:hidden">
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>FOLIO</th><th>NOMBRE</th><th>CURP</th>
                  <th>TIPO</th><th>ESTATUS</th><th>ACCIONES</th>
                </tr>
              </thead>
              <tbody id="buscar-tbody">${buscarRows(db.beneficiarios)}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="buscar-right" id="buscar-panel">${buscarEmptyState()}</div>
    </div>
  </div>`;
}

function buscarEmptyState() {
  return `<div class="buscar-empty">
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <p>Selecciona un beneficiario para editar</p>
  </div>`;
}

function buscarRows(list) {
  if (!list.length) return `<tr><td colspan="6" class="empty-row">Sin resultados.</td></tr>`;
  return list.map(b => `
    <tr class="${buscarEditId === b.id ? 'row-selected' : ''}">
      <td class="td-folio">${esc(b.folio)}</td>
      <td><strong>${esc(b.nombre)}</strong></td>
      <td class="td-curp">${esc(b.curp)}</td>
      <td><span class="tipo-chip" style="background:${TIPO_COLORS[b.tipo] || '#94a3b8'}22;color:${TIPO_COLORS[b.tipo] || '#64748b'}">${TYPE_CODES[b.tipo] || '?'}</span> ${esc(b.tipo)}</td>
      <td>${badge(b.estatus, b.tipoBaja)}</td>
      <td>
        <button class="icon-btn" onclick="openEditPanel(${b.id})" title="Ver / Editar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </td>
    </tr>`).join('');
}

function updateBuscarTable() {
  const q = buscarQuery.toLowerCase().trim();
  const list = q
    ? db.beneficiarios.filter(b =>
        b.folio.toLowerCase().includes(q) ||
        b.nombre.toLowerCase().includes(q) ||
        b.curp.toLowerCase().includes(q))
    : db.beneficiarios;
  const tbody = document.getElementById('buscar-tbody');
  const count = document.getElementById('buscar-count');
  if (tbody) tbody.innerHTML = buscarRows(list);
  if (count) count.textContent = `${list.length} resultado(s)`;
}

function openEditPanel(id) {
  buscarEditId = id;
  const b = db.beneficiarios.find(x => x.id === id);
  if (!b) return;

  document.getElementById('buscar-panel').innerHTML = `
  <div class="edit-panel-inner">
    <div class="edit-panel-header">
      <h3 class="edit-panel-title">Editar Beneficiario</h3>
      <button class="icon-btn" onclick="closeEditPanel()" title="Cerrar">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <form id="form-edit" class="edit-form" onsubmit="handleEditSave(event,${id})">
      <div class="form-group">
        <label>Folio</label>
        <input type="text" value="${esc(b.folio)}" readonly class="input-readonly folio-input"/>
      </div>
      <div class="form-group">
        <label>Nombre completo</label>
        <input type="text" name="nombre" value="${esc(b.nombre)}" required/>
      </div>
      <div class="form-group">
        <label>CURP</label>
        <input type="text" name="curp" value="${esc(b.curp)}" maxlength="18" style="text-transform:uppercase"/>
      </div>
      <div class="form-group">
        <label>Correo</label>
        <input type="email" name="correo" value="${esc(b.correo)}"/>
      </div>

      <p class="edit-section-label">Teléfonos</p>
      <div class="form-group">
        <label>Alumno</label>
        <input type="tel" name="telAlumno" value="${esc(b.telAlumno)}" maxlength="10"/>
      </div>
      <div class="form-group">
        <label>Familiar 1</label>
        <input type="tel" name="telFam1" value="${esc(b.telFam1)}" maxlength="10"/>
      </div>
      <div class="form-group">
        <label>Familiar 2</label>
        <input type="tel" name="telFam2" value="${esc(b.telFam2)}" maxlength="10"/>
      </div>

      <div class="form-group">
        <label>Tipo de beca</label>
        <select name="tipo">${tiposOpts(b.tipo)}</select>
      </div>

      <div class="form-group">
        <label>Estatus</label>
        <select name="estatus"
          onchange="toggleBajaGroup(this,'edit-baja-group')">
          ${statusOpts(b.estatus)}
        </select>
      </div>

      <!-- Tipo de Baja condicional -->
      <div id="edit-baja-group" class="baja-group"
        style="display:${b.estatus === 'Baja' ? '' : 'none'}">
        <div class="form-group">
          <label>Tipo de Baja</label>
          <select name="tipoBaja">${bajaTipoOpts(b.tipoBaja)}</select>
        </div>
      </div>

      <div class="can-financial">
        <p class="edit-section-label">Montos</p>
        <div class="form-group">
          <label>Monto Autorizado <span class="field-hint">(fijo)</span></label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">$</span>
            <input type="number" name="montoAutorizado" value="${b.montoAutorizado}"
              min="0" step="0.01" class="has-prefix"/>
          </div>
        </div>
        <div class="form-group">
          <label>Monto Derogado <span class="field-hint">(actualizable)</span></label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">$</span>
            <input type="number" name="montoDerogado" value="${b.montoDerogado}"
              min="0" step="0.01" class="has-prefix"/>
          </div>
        </div>

        <p class="edit-section-label">Cheque</p>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" name="chequeFecha" value="${esc(b.chequeFecha)}"/>
        </div>
        <div class="form-group">
          <label>Cantidad</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">$</span>
            <input type="number" name="chequeCantidad" value="${b.chequeCantidad || ''}"
              min="0" step="0.01" class="has-prefix" placeholder="0.00"/>
          </div>
        </div>
        <div class="form-group">
          <label>Folio del Cheque</label>
          <input type="text" name="chequeFolio" value="${esc(b.chequeFolio)}" placeholder="CHQ-0001"/>
        </div>
      </div>

      <div class="edit-form-actions">
        <button type="button" class="btn-secondary" onclick="closeEditPanel()">Cancelar</button>
        <button type="submit" class="btn-primary">Guardar</button>
      </div>
    </form>
  </div>`;

  updateBuscarTable();
}

function closeEditPanel() {
  buscarEditId = null;
  const panel = document.getElementById('buscar-panel');
  if (panel) panel.innerHTML = buscarEmptyState();
  updateBuscarTable();
}

/* ============================================================
   PAGE: BOLSA DE DINERO
   ============================================================ */
function pageBolsa() {
  const s   = calcStats();
  const pct = cfg.bolsaGlobal > 0 ? Math.min(100, (s.totalAsig / cfg.bolsaGlobal) * 100) : 0;

  const byTipo = {};
  TIPOS.forEach(t => { byTipo[t] = { count: 0, monto: 0 }; });
  db.beneficiarios
    .filter(b => b.estatus === 'Activo')  // only activos count
    .forEach(b => {
      if (byTipo[b.tipo]) { byTipo[b.tipo].count++; byTipo[b.tipo].monto += b.montoAutorizado || 0; }
    });
  const maxM = Math.max(...Object.values(byTipo).map(v => v.monto), 1);

  const distRows = TIPOS.filter(t => byTipo[t].count > 0).map(t => {
    const d = byTipo[t];
    const barPct = (d.monto / maxM) * 100;
    const color  = TIPO_COLORS[t];
    return `
    <div class="dist-item">
      <div class="dist-header">
        <div class="dist-dot" style="background:${color}"></div>
        <span class="dist-name">${esc(t)} <em class="dist-code">(${TYPE_CODES[t]})</em></span>
        <span class="dist-count">${d.count} beneficiario${d.count !== 1 ? 's' : ''}</span>
      </div>
      <div class="dist-bar-row">
        <div class="dist-track">
          <div class="dist-bar" style="width:${barPct}%;background:${color}"></div>
        </div>
        <span class="dist-amount">${fmt(d.monto)}</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="page-inner">
    <header class="content-header">
      <div>
        <h1 class="page-title">Bolsa de Dinero</h1>
        <p class="page-subtitle">Resumen financiero del programa de becas &mdash; solo beneficiarios activos</p>
      </div>
    </header>

    <div class="stats-row bolsa-stats">
      <div class="stat-card bolsa-card">
        <div class="bolsa-stat-icon bsi-green">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <div><p class="stat-label">Bolsa Global</p><p class="stat-val">${fmt(cfg.bolsaGlobal)}</p></div>
      </div>
      <div class="stat-card bolsa-card">
        <div class="bolsa-stat-icon bsi-blue">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div><p class="stat-label">Total Asignado</p><p class="stat-val">${fmt(s.totalAsig)}</p></div>
      </div>
      <div class="stat-card bolsa-card">
        <div class="bolsa-stat-icon bsi-red">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
        </div>
        <div><p class="stat-label">Disponible</p><p class="stat-val">${fmt(s.disponible)}</p></div>
      </div>
      <div class="stat-card bolsa-card">
        <div class="bolsa-stat-icon bsi-amber">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div><p class="stat-label">Beneficiarios</p><p class="stat-val">${s.activos}<small> activos</small></p></div>
      </div>
    </div>

    <div class="content-card">
      <div class="presupuesto-header">
        <h2 class="card-title">Uso del Presupuesto</h2>
        <span class="pct-label">${pct.toFixed(1)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-labels"><span>$0</span><span>${fmt(cfg.bolsaGlobal)}</span></div>
    </div>

    <div class="content-card">
      <div style="padding:18px 20px 8px"><h2 class="card-title">Distribución por Tipo de Beca <span class="field-hint">(activos)</span></h2></div>
      <div class="dist-list">
        ${distRows || '<p class="empty-row">Sin beneficiarios activos registrados.</p>'}
      </div>
    </div>
  </div>`;
}

/* ============================================================
   PAGE: REPORTES
   ============================================================ */
function pageReportes() {
  const s = calcStats();
  return `
  <div class="page-inner">
    <header class="content-header">
      <div>
        <h1 class="page-title">Reportes</h1>
        <p class="page-subtitle">Genera y descarga reportes del sistema</p>
      </div>
      <button class="btn-primary" id="btn-export">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exportar CSV
      </button>
    </header>

    <div class="reporte-stats">
      <div class="reporte-mini-card">
        <div class="rmc-icon rmc-gray">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div><p class="rmc-val">${s.total}</p><p class="rmc-label">Total</p></div>
      </div>
      <div class="reporte-mini-card">
        <div class="rmc-icon rmc-green">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div><p class="rmc-val">${s.activos}</p><p class="rmc-label">Activos</p></div>
      </div>
      <div class="reporte-mini-card">
        <div class="rmc-icon rmc-red">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div><p class="rmc-val">${s.bajas}</p><p class="rmc-label">Bajas</p></div>
      </div>
      <div class="reporte-mini-card">
        <div class="rmc-icon rmc-blue">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <div><p class="rmc-val">${fmt(s.totalAsig)}</p><p class="rmc-label">Monto Asignado</p></div>
      </div>
    </div>

    <div class="content-card">
      <div class="card-header-row">
        <h2 class="card-title">Listado para Reporte</h2>
        <select id="reporte-filter" class="filter-select">
          <option value="Todos">Todos</option>
          <option value="Activo">Activo</option>
          <option value="Baja">Baja</option>
          <option value="Suspendido">Suspendido</option>
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Folio</th><th>Nombre</th><th>Tipo</th>
              <th>Monto Aut.</th><th>Monto Der.</th>
              <th>Cheque Folio</th><th>Estatus</th>
            </tr>
          </thead>
          <tbody id="reporte-tbody">${reporteRows(db.beneficiarios)}</tbody>
          <tfoot id="reporte-tfoot">${reporteTotals(db.beneficiarios)}</tfoot>
        </table>
      </div>
    </div>
  </div>`;
}

function reporteRows(list) {
  if (!list.length) return `<tr><td colspan="7" class="empty-row">Sin datos.</td></tr>`;
  return list.map(b => `
    <tr>
      <td>${folioBadge(b.folio)}</td>
      <td>${esc(b.nombre)}</td>
      <td><span class="tipo-chip" style="background:${TIPO_COLORS[b.tipo] || '#94a3b8'}22;color:${TIPO_COLORS[b.tipo] || '#64748b'}">${TYPE_CODES[b.tipo] || '?'}</span></td>
      <td class="mono">${fmt(b.montoAutorizado)}</td>
      <td class="mono">${b.montoDerogado ? fmt(b.montoDerogado) : '—'}</td>
      <td class="td-folio">${esc(b.chequeFolio) || '—'}</td>
      <td>${badge(b.estatus, b.tipoBaja)}</td>
    </tr>`).join('');
}

function reporteTotals(list) {
  const sumAut = list.reduce((s, b) => s + (b.montoAutorizado || 0), 0);
  const sumDer = list.reduce((s, b) => s + (b.montoDerogado  || 0), 0);
  const sumAct = list.filter(b => b.estatus === 'Activo').reduce((s, b) => s + (b.montoAutorizado || 0), 0);
  return `<tr class="tfoot-row">
    <td colspan="3"><strong>Total: ${list.length} registro(s)</strong></td>
    <td class="mono"><strong>${fmt(sumAut)}</strong></td>
    <td class="mono"><strong>${sumDer ? fmt(sumDer) : '—'}</strong></td>
    <td></td>
    <td class="mono" style="font-size:11px;color:#059669"><strong>Activos: ${fmt(sumAct)}</strong></td>
  </tr>`;
}

function updateReporteTable() {
  const list = reporteFilter === 'Todos'
    ? db.beneficiarios
    : db.beneficiarios.filter(b => b.estatus === reporteFilter);
  const tbody = document.getElementById('reporte-tbody');
  const tfoot = document.getElementById('reporte-tfoot');
  if (tbody) tbody.innerHTML = reporteRows(list);
  if (tfoot) tfoot.innerHTML = reporteTotals(list);
}

/* ============================================================
   PAGE: CONFIGURACIÓN
   ============================================================ */
function pageConfig() {
  return `
  <div class="page-inner">
    <header class="content-header with-icon">
      <div class="header-icon-wrap cfg">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </div>
      <div>
        <h1 class="page-title">Configuración</h1>
        <p class="page-subtitle">Ajustes generales del sistema</p>
      </div>
    </header>

    <form id="form-config" autocomplete="off" style="display:flex;flex-direction:column;gap:16px">
      <div class="config-card cfg-presupuesto">
        <div class="config-card-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <div>
            <h3 class="config-card-title">Presupuesto</h3>
            <p class="config-card-sub">Define el monto total disponible para becas</p>
          </div>
        </div>
        <div class="form-group" style="max-width:400px">
          <label>Bolsa Global</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">$</span>
            <input type="number" name="bolsaGlobal" value="${cfg.bolsaGlobal}"
              min="0" step="1000" class="has-prefix"/>
          </div>
        </div>
      </div>

      <div class="config-card cfg-periodo">
        <div class="config-card-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div>
            <h3 class="config-card-title">Periodo Académico</h3>
            <p class="config-card-sub">Indica el periodo activo actual</p>
          </div>
        </div>
        <div class="form-group" style="max-width:400px">
          <label>Periodo Activo</label>
          <input type="text" name="periodo" value="${esc(cfg.periodo)}"
            placeholder="Ej: Agosto - Diciembre 2025"/>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end">
        <button type="submit" class="btn-primary btn-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Guardar Cambios
        </button>
      </div>
    </form>

    <form id="form-password" autocomplete="off" style="display:flex;flex-direction:column;gap:16px">
      <div class="config-card">
        <div class="config-card-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div>
            <h3 class="config-card-title">Cambiar Contraseña</h3>
            <p class="config-card-sub">Actualiza las credenciales de acceso al sistema</p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;max-width:400px">
          <div class="form-group">
            <label>Contraseña actual</label>
            <input type="password" name="passActual" required placeholder="••••••••"/>
          </div>
          <div class="form-group">
            <label>Nueva contraseña <span class="field-hint">(mín. 6 caracteres)</span></label>
            <input type="password" name="passNueva" required minlength="6" placeholder="••••••••"/>
          </div>
          <div class="form-group">
            <label>Confirmar nueva contraseña</label>
            <input type="password" name="passConfirm" required placeholder="••••••••"/>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button type="submit" class="btn-primary btn-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Actualizar Contraseña
        </button>
      </div>
    </form>
  </div>`;
}

/* ============================================================
   HANDLERS
   ============================================================ */
async function handleRegistrar(e) {
  e.preventDefault();
  const fd    = new FormData(e.target);
  const folio = fd.get('folio').trim();
  if (!folio) { showToast('Selecciona un Tipo de beca para generar el folio.', false); return; }

  const estatus = fd.get('estatus');
  const b = {
    folio,
    nombre:          fd.get('nombre').trim(),
    curp:            fd.get('curp').trim().toUpperCase(),
    correo:          fd.get('correo').trim(),
    telAlumno:       fd.get('telAlumno').trim(),
    telFam1:         fd.get('telFam1').trim(),
    telFam2:         fd.get('telFam2').trim(),
    tipo:            fd.get('tipo'),
    estatus,
    tipoBaja:        estatus === 'Baja' ? (fd.get('tipoBaja') || 'Voluntaria') : '',
    montoAutorizado: parseFloat(fd.get('montoAutorizado')) || 0,
    montoDerogado:   parseFloat(fd.get('montoDerogado'))   || 0,
    chequeFecha:     fd.get('chequeFecha') || '',
    chequeCantidad:  parseFloat(fd.get('chequeCantidad'))  || 0,
    chequeFolio:     fd.get('chequeFolio').trim(),
  };
  try {
    const res = await apiFetch('/api/beneficiarios', {
      method: 'POST', body: JSON.stringify(b)
    });
    if (!res) return;
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al registrar.', false); return;
    }
    const nuevo = await res.json();
    showToast(`Beneficiario "${nuevo.nombre}" registrado — Folio: ${nuevo.folio}`);
    navigate('buscar');
  } catch {
    showToast('Error de conexión con el servidor.', false);
  }
}

async function handleEditSave(e, id) {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const idx = db.beneficiarios.findIndex(x => x.id === id);
  if (idx === -1) return;

  const estatusAnterior = db.beneficiarios[idx].estatus;
  const estatusNuevo    = fd.get('estatus');
  const nombreB         = fd.get('nombre').trim();
  const montoAut        = parseFloat(fd.get('montoAutorizado')) || 0;

  const b = {
    nombre:          nombreB,
    curp:            fd.get('curp').trim().toUpperCase(),
    correo:          fd.get('correo').trim(),
    telAlumno:       fd.get('telAlumno').trim(),
    telFam1:         fd.get('telFam1').trim(),
    telFam2:         fd.get('telFam2').trim(),
    tipo:            fd.get('tipo'),
    estatus:         estatusNuevo,
    tipoBaja:        estatusNuevo === 'Baja' ? (fd.get('tipoBaja') || 'Voluntaria') : '',
    montoAutorizado: montoAut,
    montoDerogado:   parseFloat(fd.get('montoDerogado'))   || 0,
    chequeFecha:     fd.get('chequeFecha') || '',
    chequeCantidad:  parseFloat(fd.get('chequeCantidad'))  || 0,
    chequeFolio:     fd.get('chequeFolio').trim(),
  };
  try {
    const res = await apiFetch(`/api/beneficiarios/${id}`, {
      method: 'PUT', body: JSON.stringify(b)
    });
    if (!res) return;
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al guardar.', false); return;
    }
    const actualizado = await res.json();
    db.beneficiarios[idx] = actualizado;

    if (estatusAnterior === 'Activo' && estatusNuevo !== 'Activo' && montoAut > 0) {
      showToast(`Estatus cambiado a "${estatusNuevo}". ${fmt(montoAut)} regresaron a la bolsa.`);
    } else if (estatusAnterior !== 'Activo' && estatusNuevo === 'Activo' && montoAut > 0) {
      showToast(`Beneficiario reactivado. ${fmt(montoAut)} asignados desde la bolsa.`);
    } else {
      showToast(`"${nombreB}" actualizado correctamente.`);
    }
    closeEditPanel();
  } catch {
    showToast('Error de conexión con el servidor.', false);
  }
}

async function handleConfigSave(e) {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const rol = currentUser?.rol;

  // Construye el body según lo que el rol puede modificar
  const body = {};
  if (rol === 'financiero' || rol === 'admin') {
    body.bolsaGlobal = parseFloat(fd.get('bolsaGlobal')) || 0;
  }
  if (rol === 'operativo' || rol === 'admin') {
    body.periodo = (fd.get('periodo') || '').trim();
  }

  try {
    const res = await apiFetch('/api/config', { method: 'PUT', body: JSON.stringify(body) });
    if (!res) return;
    if (!res.ok) { showToast('Error al guardar configuración.', false); return; }
    if (body.bolsaGlobal !== undefined) cfg.bolsaGlobal = body.bolsaGlobal;
    if (body.periodo     !== undefined) cfg.periodo     = body.periodo;
    showToast('Configuración guardada correctamente.');
  } catch {
    showToast('Error de conexión con el servidor.', false);
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const fd      = new FormData(e.target);
  const nueva   = fd.get('passNueva').trim();
  const confirm = fd.get('passConfirm').trim();
  if (nueva.length < 6) {
    showToast('La nueva contraseña debe tener al menos 6 caracteres.', false); return;
  }
  if (nueva !== confirm) {
    showToast('Las contraseñas no coinciden.', false); return;
  }
  try {
    const res = await apiFetch('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ passActual: fd.get('passActual'), passNueva: nueva })
    });
    if (!res) return;
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al cambiar contraseña.', false); return;
    }
    e.target.reset();
    showToast('Contraseña actualizada correctamente.');
  } catch {
    showToast('Error de conexión con el servidor.', false);
  }
}

function exportCSV() {
  const list = reporteFilter === 'Todos'
    ? db.beneficiarios
    : db.beneficiarios.filter(b => b.estatus === reporteFilter);

  const header = [
    'Folio','Nombre','CURP','Correo',
    'Tel. Alumno','Tel. Familiar 1','Tel. Familiar 2',
    'Tipo de Beca','Código','Estatus','Tipo de Baja',
    'Monto Autorizado','Monto Derogado',
    'Cheque Fecha','Cheque Cantidad','Cheque Folio'
  ];
  const rows = list.map(b => [
    b.folio, b.nombre, b.curp, b.correo,
    b.telAlumno, b.telFam1, b.telFam2,
    b.tipo, TYPE_CODES[b.tipo] || '',
    b.estatus, b.tipoBaja || '',
    b.montoAutorizado, b.montoDerogado || 0,
    b.chequeFecha || '', b.chequeCantidad || 0, b.chequeFolio || ''
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv  = [header.join(','), ...rows].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `reporte_becas_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exportado correctamente.');
}

/* ============================================================
   INIT
   ============================================================ */
async function initApp() {
  const token = getToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUser = { usuario: payload.usuario, rol: payload.rol };
    } catch { logout(); return; }
  }

  // Aplica clases de rol al body para control de visibilidad por CSS
  document.body.classList.remove('rol-admin', 'rol-financiero', 'rol-operativo');
  document.body.classList.add(`rol-${currentUser?.rol || 'operativo'}`);

  const ok = await loadData();
  if (!ok) return;

  showApp();
  navigate('inicio');
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
});
document.getElementById('form-login').addEventListener('submit', handleLogin);
document.getElementById('btn-logout').addEventListener('click', logout);

if (isLoggedIn()) {
  initApp();
} else {
  showLoginScreen();
}
