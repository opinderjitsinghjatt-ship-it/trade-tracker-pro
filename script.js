/**
 * Trade Tracker Pro — script.js
 * Pure vanilla JS: trade logging, P&L calc, position sizer,
 * dashboard stats, canvas charts, CSV import/export, localStorage
 */

'use strict';

/* =====================================================
   DATA STORE
===================================================== */
const STORAGE_KEY   = 'tradeTrackerPro_v1';
const SETTINGS_KEY  = 'tradeTrackerPro_settings';

let trades   = [];    // array of trade objects
let settings = {};    // app settings (daily limit, etc.)

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    trades = raw ? JSON.parse(raw) : [];
  } catch (_) { trades = []; }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    settings = raw ? JSON.parse(raw) : {};
  } catch (_) { settings = {}; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* =====================================================
   TRADE HELPERS
===================================================== */
function calcNetPnL(trade) {
  const direction = trade.type === 'Long' ? 1 : -1;
  const gross = (trade.exit - trade.entry) * trade.qty * direction;
  return gross - (trade.fees || 0);
}

function calcGrossPnL(trade) {
  const direction = trade.type === 'Long' ? 1 : -1;
  return (trade.exit - trade.entry) * trade.qty * direction;
}

function calcReturnPct(trade) {
  const cost = trade.entry * trade.qty;
  if (!cost) return 0;
  return (calcNetPnL(trade) / cost) * 100;
}

function isWin(trade) { return calcNetPnL(trade) > 0; }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* =====================================================
   FORMATTING UTILITIES
===================================================== */
function fmt$(n) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-$' : '$') + str;
}

function fmtPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function colorClass(n) { return n >= 0 ? 'green' : 'red'; }

/* =====================================================
   TOAST NOTIFICATIONS
===================================================== */
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* =====================================================
   TAB NAVIGATION
===================================================== */
function initTabs() {
  const btns   = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      btns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => { p.classList.remove('active'); p.hidden = true; });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(`tab-${target}`);
      if (panel) { panel.classList.add('active'); panel.hidden = false; }

      if (target === 'dashboard') refreshDashboard();
      if (target === 'risk-mgmt') refreshRiskMgmt();
    });
  });
}

function switchTab(name) {
  const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (btn) btn.click();
}

/* =====================================================
   TRADE FORM
===================================================== */
let editingId = null;

function initTradeForm() {
  const form        = document.getElementById('trade-form');
  const cancelBtn   = document.getElementById('btn-cancel-edit');
  const saveBtn     = document.getElementById('btn-save-trade');

  // Live P&L preview
  ['trade-entry', 'trade-exit', 'trade-qty', 'trade-fees', 'trade-type'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateFormPreview);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    saveTradeFromForm();
  });

  cancelBtn.addEventListener('click', () => {
    clearTradeForm();
    cancelBtn.hidden = true;
    document.getElementById('trade-form-title').textContent = 'Log a Trade';
    editingId = null;
  });

  // Set today's date by default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('trade-date').value = today;
}

function updateFormPreview() {
  const entry  = parseFloat(document.getElementById('trade-entry').value) || 0;
  const exit   = parseFloat(document.getElementById('trade-exit').value)  || 0;
  const qty    = parseFloat(document.getElementById('trade-qty').value)   || 0;
  const fees   = parseFloat(document.getElementById('trade-fees').value)  || 0;
  const type   = document.getElementById('trade-type').value || 'Long';
  const preview = document.getElementById('pnl-preview');

  if (entry && exit && qty) {
    const tmpTrade = { entry, exit, qty, fees, type };
    const net  = calcNetPnL(tmpTrade);
    const pct  = calcReturnPct(tmpTrade);

    document.getElementById('preview-pnl').textContent = fmt$(net);
    document.getElementById('preview-pnl').className = `preview-value ${colorClass(net)}`;
    document.getElementById('preview-pct').textContent = fmtPct(pct);
    document.getElementById('preview-pct').className = `preview-value ${colorClass(pct)}`;
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
}

function clearTradeForm() {
  const fields = ['trade-ticker', 'trade-entry', 'trade-exit', 'trade-qty', 'trade-notes'];
  fields.forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('trade-fees').value = '0';
  document.getElementById('trade-type').value = '';
  document.getElementById('trade-strategy').value = '';
  document.getElementById('pnl-preview').hidden = true;
  document.getElementById('edit-id').value = '';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('trade-date').value = today;
}

function saveTradeFromForm() {
  const date     = document.getElementById('trade-date').value;
  const ticker   = document.getElementById('trade-ticker').value.trim().toUpperCase();
  const type     = document.getElementById('trade-type').value;
  const strategy = document.getElementById('trade-strategy').value;
  const entry    = parseFloat(document.getElementById('trade-entry').value);
  const exit     = parseFloat(document.getElementById('trade-exit').value);
  const qty      = parseFloat(document.getElementById('trade-qty').value);
  const fees     = parseFloat(document.getElementById('trade-fees').value) || 0;
  const notes    = document.getElementById('trade-notes').value.trim();

  if (!date || !ticker || !type || !entry || !exit || !qty) {
    toast('Please fill in all required fields.', 'error');
    return;
  }
  if (entry <= 0 || exit <= 0 || qty <= 0) {
    toast('Entry price, exit price and quantity must be positive.', 'error');
    return;
  }

  const trade = { date, ticker, type, strategy, entry, exit, qty, fees, notes };

  if (editingId) {
    const idx = trades.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      trades[idx] = { ...trade, id: editingId };
      toast('Trade updated!', 'success');
    }
    editingId = null;
    document.getElementById('btn-cancel-edit').hidden = true;
    document.getElementById('trade-form-title').textContent = 'Log a Trade';
  } else {
    trade.id = generateId();
    trades.push(trade);
    toast('Trade saved!', 'success');
  }

  saveData();
  clearTradeForm();
  refreshDashboard();
  switchTab('dashboard');
}

/* =====================================================
   DASHBOARD
===================================================== */
let sortField = 'date';
let sortDir   = 'desc';
let activeFilters = {};

function refreshDashboard() {
  const filtered = getFilteredTrades();
  renderStats(filtered);
  renderTradesTable(filtered);
  renderPnLChart(filtered);
}

function getFilteredTrades() {
  let result = [...trades];
  const ticker   = (activeFilters.ticker   || '').toUpperCase();
  const strategy = activeFilters.strategy  || '';
  const from     = activeFilters.from      || '';
  const to       = activeFilters.to        || '';

  if (ticker)   result = result.filter(t => t.ticker.includes(ticker));
  if (strategy) result = result.filter(t => t.strategy === strategy);
  if (from)     result = result.filter(t => t.date >= from);
  if (to)       result = result.filter(t => t.date <= to);

  return sortTrades(result);
}

function sortTrades(list) {
  return [...list].sort((a, b) => {
    let va, vb;
    switch (sortField) {
      case 'date':     va = a.date;       vb = b.date;       break;
      case 'ticker':   va = a.ticker;     vb = b.ticker;     break;
      case 'type':     va = a.type;       vb = b.type;       break;
      case 'strategy': va = a.strategy;   vb = b.strategy;   break;
      case 'entry':    va = a.entry;      vb = b.entry;      break;
      case 'exit':     va = a.exit;       vb = b.exit;       break;
      case 'qty':      va = a.qty;        vb = b.qty;        break;
      case 'fees':     va = a.fees;       vb = b.fees;       break;
      case 'pnl':      va = calcNetPnL(a); vb = calcNetPnL(b); break;
      case 'pct':      va = calcReturnPct(a); vb = calcReturnPct(b); break;
      default:         va = a.date;       vb = b.date;
    }
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });
}

function renderStats(filtered) {
  const total   = filtered.length;
  const wins    = filtered.filter(isWin);
  const losses  = filtered.filter(t => !isWin(t));
  const netPnl  = filtered.reduce((s, t) => s + calcNetPnL(t), 0);
  const winRate = total ? (wins.length / total) * 100 : 0;

  const avgWin  = wins.length  ? wins.reduce((s,t)  => s + calcNetPnL(t), 0) / wins.length  : 0;
  const avgLoss = losses.length ? losses.reduce((s,t) => s + calcNetPnL(t), 0) / losses.length : 0;

  const grossWin  = wins.reduce((s,t)   => s + calcNetPnL(t), 0);
  const grossLoss = losses.reduce((s,t) => s + Math.abs(calcNetPnL(t)), 0);
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : wins.length > 0 ? '∞' : '—';

  const pnlValues = filtered.map(t => ({ v: calcNetPnL(t), t }));
  const best  = pnlValues.length ? pnlValues.reduce((m, x) => x.v > m.v ? x : m, pnlValues[0]) : null;
  const worst = pnlValues.length ? pnlValues.reduce((m, x) => x.v < m.v ? x : m, pnlValues[0]) : null;

  setText('stat-total',   total);
  setColorText('stat-winrate', winRate.toFixed(2) + '%', winRate >= 50 ? 'green' : 'red');
  setColorText('stat-netpnl',  fmt$(netPnl), colorClass(netPnl));
  setText('stat-pf',      pf);
  setColorText('stat-avgwin',  fmt$(avgWin),  'green');
  setColorText('stat-avgloss', fmt$(avgLoss), losses.length ? 'red' : '');
  setColorText('stat-best',    best  ? `${fmt$(best.v)}  ${best.t.ticker}`  : '—', 'green');
  setColorText('stat-worst',   worst ? `${fmt$(worst.v)} ${worst.t.ticker}` : '—', 'red');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setColorText(id, val, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.className = `stat-value ${cls}`;
}

function renderTradesTable(filtered) {
  const tbody = document.getElementById('trades-body');
  tbody.innerHTML = '';

  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="12">No trades match your filters.</td></tr>';
    return;
  }

  filtered.forEach(t => {
    const net  = calcNetPnL(t);
    const pct  = calcReturnPct(t);
    const row  = document.createElement('tr');
    row.dataset.id = t.id;
    row.innerHTML = `
      <td>${t.date}</td>
      <td><strong>${escHtml(t.ticker)}</strong></td>
      <td><span class="badge badge-${t.type.toLowerCase()}">${escHtml(t.type)}</span></td>
      <td>${escHtml(t.strategy || '—')}</td>
      <td>$${(+t.entry).toFixed(4)}</td>
      <td>$${(+t.exit ).toFixed(4)}</td>
      <td>${(+t.qty).toLocaleString()}</td>
      <td>${fmt$(t.fees)}</td>
      <td class="${colorClass(net)}">${fmt$(net)}</td>
      <td class="${colorClass(pct)}">${fmtPct(pct)}</td>
      <td class="notes-cell" title="${escHtml(t.notes || '')}">${escHtml(truncate(t.notes || '', 30))}</td>
      <td class="action-cell">
        <button class="btn-icon edit"   data-id="${t.id}" title="Edit">✏</button>
        <button class="btn-icon delete" data-id="${t.id}" title="Delete">🗑</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Action buttons
  tbody.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.addEventListener('click', () => editTrade(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTrade(btn.dataset.id));
  });
}

function editTrade(id) {
  const trade = trades.find(t => t.id === id);
  if (!trade) return;

  editingId = id;
  document.getElementById('edit-id').value       = id;
  document.getElementById('trade-date').value     = trade.date;
  document.getElementById('trade-ticker').value   = trade.ticker;
  document.getElementById('trade-type').value     = trade.type;
  document.getElementById('trade-strategy').value = trade.strategy || '';
  document.getElementById('trade-entry').value    = trade.entry;
  document.getElementById('trade-exit').value     = trade.exit;
  document.getElementById('trade-qty').value      = trade.qty;
  document.getElementById('trade-fees').value     = trade.fees || 0;
  document.getElementById('trade-notes').value    = trade.notes || '';

  document.getElementById('trade-form-title').textContent = 'Edit Trade';
  document.getElementById('btn-cancel-edit').hidden = false;
  updateFormPreview();
  switchTab('trade-entry');
}

function deleteTrade(id) {
  if (!confirm('Delete this trade? This cannot be undone.')) return;
  trades = trades.filter(t => t.id !== id);
  saveData();
  refreshDashboard();
  toast('Trade deleted.', 'info');
}

/* =====================================================
   SORTING
===================================================== */
function initSorting() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDir   = 'asc';
      }
      // Update UI
      document.querySelectorAll('.sortable').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      refreshDashboard();
    });
  });
}

/* =====================================================
   FILTERS
===================================================== */
function initFilters() {
  document.getElementById('btn-apply-filter').addEventListener('click', () => {
    activeFilters = {
      ticker:   document.getElementById('filter-ticker').value,
      strategy: document.getElementById('filter-strategy').value,
      from:     document.getElementById('filter-from').value,
      to:       document.getElementById('filter-to').value,
    };
    refreshDashboard();
  });

  document.getElementById('btn-clear-filter').addEventListener('click', () => {
    activeFilters = {};
    document.getElementById('filter-ticker').value   = '';
    document.getElementById('filter-strategy').value = '';
    document.getElementById('filter-from').value     = '';
    document.getElementById('filter-to').value       = '';
    refreshDashboard();
  });
}

/* =====================================================
   P&L CHART (Canvas)
===================================================== */
function renderPnLChart(filtered) {
  const canvas = document.getElementById('pnl-chart');
  const emptyMsg = document.getElementById('chart-empty');
  const ctx = canvas.getContext('2d');

  if (!filtered.length) {
    canvas.style.display = 'none';
    emptyMsg.style.display = '';
    return;
  }
  canvas.style.display = '';
  emptyMsg.style.display = 'none';

  // Sort by date for the equity curve
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

  // Cumulative P&L
  let running = 0;
  const points = sorted.map(t => {
    running += calcNetPnL(t);
    return { date: t.date, value: running };
  });

  // Resize canvas to actual pixel dimensions
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = Math.floor(rect.width - 40); // padding offset
  const H = 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const padL = 70, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.map(p => p.value);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const rangeV = maxV - minV || 1;

  function xPx(i) { return padL + (i / Math.max(points.length - 1, 1)) * plotW; }
  function yPx(v) { return padT + (1 - (v - minV) / rangeV) * plotH; }

  ctx.clearRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = 'rgba(48,54,61,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    const v = maxV - (i / 4) * rangeV;
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmt$(v), padL - 6, y + 4);
  }

  // Zero line
  const zeroY = yPx(0);
  ctx.strokeStyle = 'rgba(139,148,158,0.4)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, zeroY);
  ctx.lineTo(W - padR, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (points.length === 1) {
    // Single dot
    ctx.fillStyle = points[0].value >= 0 ? '#3fb950' : '#f85149';
    ctx.beginPath();
    ctx.arc(xPx(0), yPx(points[0].value), 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Fill area
    ctx.beginPath();
    ctx.moveTo(xPx(0), yPx(points[0].value));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(xPx(i), yPx(points[i].value));
    }
    const lastX = xPx(points.length - 1);
    ctx.lineTo(lastX, zeroY);
    ctx.lineTo(xPx(0), zeroY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    const finalVal = points[points.length - 1].value;
    if (finalVal >= 0) {
      gradient.addColorStop(0, 'rgba(63,185,80,0.25)');
      gradient.addColorStop(1, 'rgba(63,185,80,0.02)');
    } else {
      gradient.addColorStop(0, 'rgba(248,81,73,0.02)');
      gradient.addColorStop(1, 'rgba(248,81,73,0.25)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(xPx(0), yPx(points[0].value));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(xPx(i), yPx(points[i].value));
    }
    ctx.strokeStyle = finalVal >= 0 ? '#3fb950' : '#f85149';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(xPx(i), yPx(p.value), 3, 0, Math.PI * 2);
      ctx.fillStyle = p.value >= 0 ? '#3fb950' : '#f85149';
      ctx.fill();
    });
  }

  // X-axis labels (show every Nth label to avoid crowding)
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  const step = Math.ceil(points.length / 8);
  for (let i = 0; i < points.length; i += step) {
    ctx.fillText(points[i].date.slice(5), xPx(i), H - padB + 16);
  }
  // Always show last label
  if (points.length > 1) {
    ctx.fillText(points[points.length-1].date.slice(5), xPx(points.length-1), H - padB + 16);
  }
}

/* =====================================================
   MONTHLY CHART (Bar)
===================================================== */
function renderMonthlyChart() {
  const canvas   = document.getElementById('monthly-chart');
  const emptyMsg = document.getElementById('monthly-chart-empty');
  const ctx = canvas.getContext('2d');

  if (!trades.length) {
    canvas.style.display = 'none';
    emptyMsg.style.display = '';
    return;
  }
  canvas.style.display = '';
  emptyMsg.style.display = 'none';

  // Group by month (YYYY-MM)
  const monthMap = {};
  trades.forEach(t => {
    const mo = t.date.slice(0, 7);
    if (!monthMap[mo]) monthMap[mo] = 0;
    monthMap[mo] += calcNetPnL(t);
  });

  const months = Object.keys(monthMap).sort();
  const values = months.map(m => monthMap[m]);

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = Math.floor(rect.width - 40);
  const H = 180;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const padL = 70, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const rangeV = maxV - minV || 1;

  function yPx(v) { return padT + (1 - (v - minV) / rangeV) * plotH; }
  const zeroY = yPx(0);

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(48,54,61,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const v = maxV - (i / 4) * rangeV;
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmt$(v), padL - 6, y + 4);
  }

  // Zero line
  ctx.strokeStyle = 'rgba(139,148,158,0.4)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(W - padR, zeroY); ctx.stroke();
  ctx.setLineDash([]);

  // Bars
  const barW = Math.max(8, Math.min(40, (plotW / months.length) * 0.65));
  const spacing = plotW / Math.max(months.length, 1);

  months.forEach((mo, i) => {
    const v = values[i];
    const cx = padL + spacing * i + spacing / 2;
    const barTop    = v >= 0 ? yPx(v) : zeroY;
    const barBottom = v >= 0 ? zeroY  : yPx(v);
    const barH = Math.max(2, barBottom - barTop);

    ctx.fillStyle = v >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
    ctx.fillRect(cx - barW / 2, barTop, barW, barH);

    ctx.fillStyle = '#8b949e';
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mo.slice(5), cx, H - padB + 16);
  });
}

/* =====================================================
   P&L CALCULATOR TAB
===================================================== */
function initPnLCalculator() {
  document.getElementById('btn-calc-pnl').addEventListener('click', () => {
    const type  = document.getElementById('calc-type').value;
    const entry = parseFloat(document.getElementById('calc-entry').value);
    const exit  = parseFloat(document.getElementById('calc-exit').value);
    const qty   = parseFloat(document.getElementById('calc-qty').value);
    const fees  = parseFloat(document.getElementById('calc-fees').value) || 0;

    if (!entry || !exit || !qty) { toast('Enter entry, exit and quantity.', 'error'); return; }

    const t = { entry, exit, qty, fees, type };
    const gross = calcGrossPnL(t);
    const net   = calcNetPnL(t);
    const pct   = calcReturnPct(t);
    const cost  = entry * qty;

    document.getElementById('res-gross').textContent = fmt$(gross);
    document.getElementById('res-gross').className = colorClass(gross);
    document.getElementById('res-net').textContent = fmt$(net);
    document.getElementById('res-net').className = colorClass(net);
    document.getElementById('res-pct').textContent = fmtPct(pct);
    document.getElementById('res-pct').className = colorClass(pct);
    document.getElementById('res-cost').textContent = fmt$(cost);
    document.getElementById('pnl-results').hidden = false;
  });

  document.getElementById('btn-calc-rr').addEventListener('click', () => {
    const entry  = parseFloat(document.getElementById('rr-entry').value);
    const stop   = parseFloat(document.getElementById('rr-stop').value);
    const target = parseFloat(document.getElementById('rr-target').value);

    if (!entry || !stop || !target) { toast('Enter entry, stop and target prices.', 'error'); return; }

    const risk   = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    const ratio  = risk > 0 ? (reward / risk) : 0;
    const breakeven = risk > 0 ? (1 / (1 + ratio)) * 100 : 0;

    document.getElementById('res-risk-share').textContent   = fmt$(risk);
    document.getElementById('res-reward-share').textContent = fmt$(reward);
    document.getElementById('res-rr-ratio').textContent     = `1 : ${ratio.toFixed(2)}`;
    document.getElementById('res-rr-ratio').className       = ratio >= 2 ? 'green' : ratio >= 1 ? '' : 'red';
    document.getElementById('res-breakeven').textContent    = breakeven.toFixed(1) + '%';
    document.getElementById('rr-results').hidden = false;
  });
}

/* =====================================================
   POSITION SIZE CALCULATOR TAB
===================================================== */
function initPositionSizeCalc() {
  document.getElementById('btn-calc-pos').addEventListener('click', () => {
    const balance  = parseFloat(document.getElementById('ps-balance').value);
    const riskPct  = parseFloat(document.getElementById('ps-risk-pct').value);
    const entry    = parseFloat(document.getElementById('ps-entry').value);
    const stop     = parseFloat(document.getElementById('ps-stop').value);

    if (!balance || !riskPct || !entry || !stop) {
      toast('Fill in all fields.', 'error'); return;
    }
    if (entry === stop) { toast('Entry and stop loss cannot be the same.', 'error'); return; }

    const dollarRisk     = balance * (riskPct / 100);
    const riskPerShare   = Math.abs(entry - stop);
    const shares         = Math.floor(dollarRisk / riskPerShare);
    const posValue       = shares * entry;
    const acctPct        = (posValue / balance) * 100;

    document.getElementById('res-shares').textContent       = shares.toLocaleString();
    document.getElementById('res-dollar-risk').textContent  = fmt$(dollarRisk);
    document.getElementById('res-pos-value').textContent    = fmt$(posValue);
    document.getElementById('res-acct-pct').textContent     = acctPct.toFixed(2) + '%';
    document.getElementById('res-risk-per-share').textContent = fmt$(riskPerShare);
    document.getElementById('pos-results').hidden = false;
  });
}

/* =====================================================
   RISK MANAGEMENT TAB
===================================================== */
function initRiskMgmt() {
  // Load saved daily limit
  if (settings.dailyLimit) {
    document.getElementById('daily-limit').value = settings.dailyLimit;
  }

  document.getElementById('btn-set-daily').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('daily-limit').value);
    if (isNaN(val) || val <= 0) { toast('Enter a valid daily limit.', 'error'); return; }
    settings.dailyLimit = val;
    saveSettings();
    refreshRiskMgmt();
    toast('Daily limit saved.', 'success');
  });
}

function refreshRiskMgmt() {
  const today     = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const monthStr  = today.slice(0, 7);

  const todayTrades = trades.filter(t => t.date === today);
  const weekTrades  = trades.filter(t => t.date >= weekStart && t.date <= today);
  const monthTrades = trades.filter(t => t.date.startsWith(monthStr));

  // Daily
  const todayPnl = todayTrades.reduce((s,t) => s + calcNetPnL(t), 0);
  document.getElementById('risk-today-pnl').textContent = fmt$(todayPnl);
  document.getElementById('risk-today-pnl').className   = colorClass(todayPnl);

  const limitEl = document.getElementById('risk-daily-limit-display');
  const statusEl = document.getElementById('risk-daily-status');
  if (settings.dailyLimit) {
    limitEl.textContent = fmt$(settings.dailyLimit);
    if (todayPnl <= -settings.dailyLimit) {
      statusEl.textContent = 'LIMIT HIT';
      statusEl.className   = 'badge badge-danger';
    } else if (todayPnl <= -settings.dailyLimit * 0.75) {
      statusEl.textContent = 'WARNING';
      statusEl.className   = 'badge badge-warn';
    } else {
      statusEl.textContent = 'OK';
      statusEl.className   = 'badge badge-ok';
    }
  } else {
    limitEl.textContent   = 'Not set';
    statusEl.textContent  = '—';
    statusEl.className    = 'badge';
  }

  // Streaks
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  let curStreak = 0, maxWin = 0, maxLoss = 0, curType = null;
  sorted.forEach(t => {
    const w = isWin(t);
    if (curType === null) { curType = w; curStreak = 1; }
    else if (w === curType) { curStreak++; }
    else { curType = w; curStreak = 1; }
    if (w)  maxWin  = Math.max(maxWin,  curStreak);
    else    maxLoss = Math.max(maxLoss, curStreak);
  });

  const streakDir = curType ? '🟢 Win' : '🔴 Loss';
  document.getElementById('risk-streak').textContent = sorted.length
    ? `${curStreak} × ${streakDir}` : '—';
  document.getElementById('risk-max-win-streak').textContent  = maxWin  || '—';
  document.getElementById('risk-max-loss-streak').textContent = maxLoss || '—';

  // Weekly
  const wPnl = weekTrades.reduce((s,t) => s + calcNetPnL(t), 0);
  const wWr  = weekTrades.length ? weekTrades.filter(isWin).length / weekTrades.length * 100 : 0;
  document.getElementById('risk-week-trades').textContent = weekTrades.length;
  document.getElementById('risk-week-wr').textContent     = wWr.toFixed(2) + '%';
  setColorEl('risk-week-pnl', fmt$(wPnl), colorClass(wPnl));

  // Monthly
  const mPnl = monthTrades.reduce((s,t) => s + calcNetPnL(t), 0);
  const mWr  = monthTrades.length ? monthTrades.filter(isWin).length / monthTrades.length * 100 : 0;
  document.getElementById('risk-month-trades').textContent = monthTrades.length;
  document.getElementById('risk-month-wr').textContent     = mWr.toFixed(2) + '%';
  setColorEl('risk-month-pnl', fmt$(mPnl), colorClass(mPnl));

  renderMonthlyChart();
}

function setColorEl(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = cls;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();          // 0=Sun
  const diff = (day + 6) % 7;       // Monday = 0
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  return mon.toISOString().split('T')[0];
}

/* =====================================================
   CSV EXPORT
===================================================== */
function exportCSV() {
  if (!trades.length) { toast('No trades to export.', 'info'); return; }

  const headers = ['id','date','ticker','type','strategy','entry','exit','qty','fees','notes','net_pnl','pct_return'];
  const rows = trades.map(t => [
    t.id, t.date, t.ticker, t.type, t.strategy || '',
    t.entry, t.exit, t.qty, t.fees || 0, `"${(t.notes || '').replace(/"/g,'""')}"`,
    calcNetPnL(t).toFixed(4), calcReturnPct(t).toFixed(4),
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${trades.length} trades.`, 'success');
}

/* =====================================================
   CSV IMPORT
===================================================== */
function importCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const lines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast('CSV has no data rows.', 'error'); return; }

      const header = lines[0].split(',').map(h => h.toLowerCase().trim());
      const idxOf = k => header.indexOf(k);

      const iDate  = idxOf('date');
      const iTick  = idxOf('ticker');
      const iType  = idxOf('type');
      const iStrat = idxOf('strategy');
      const iEntry = idxOf('entry');
      const iExit  = idxOf('exit');
      const iQty   = idxOf('qty');
      const iFees  = idxOf('fees');
      const iNotes = idxOf('notes');

      if ([iDate, iTick, iType, iEntry, iExit, iQty].some(i => i === -1)) {
        toast('CSV missing required columns (date, ticker, type, entry, exit, qty).', 'error');
        return;
      }

      let imported = 0, skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const trade = {
          id:       generateId(),
          date:     (cols[iDate]  || '').trim(),
          ticker:   (cols[iTick]  || '').trim().toUpperCase(),
          type:     (cols[iType]  || 'Long').trim(),
          strategy: iStrat >= 0 ? (cols[iStrat] || '').trim() : '',
          entry:    parseFloat(cols[iEntry]) || 0,
          exit:     parseFloat(cols[iExit])  || 0,
          qty:      parseFloat(cols[iQty])   || 0,
          fees:     iFees >= 0 ? parseFloat(cols[iFees]) || 0 : 0,
          notes:    iNotes >= 0 ? (cols[iNotes] || '').replace(/^"|"$/g,'').replace(/""/g,'"') : '',
        };
        if (!trade.date || !trade.ticker || !trade.entry || !trade.exit || !trade.qty) {
          skipped++; continue;
        }
        // Avoid exact duplicates by id-less comparison
        const dup = trades.some(t =>
          t.date === trade.date && t.ticker === trade.ticker &&
          t.entry === trade.entry && t.exit === trade.exit && t.qty === trade.qty
        );
        if (!dup) { trades.push(trade); imported++; }
        else skipped++;
      }

      saveData();
      refreshDashboard();
      toast(`Imported ${imported} trade(s). Skipped ${skipped}.`, 'success');
    } catch (err) {
      toast('Error parsing CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/* =====================================================
   CLEAR ALL
===================================================== */
function initClearAll() {
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!trades.length) { toast('No trades to clear.', 'info'); return; }
    if (!confirm(`Delete all ${trades.length} trade(s)? This cannot be undone.`)) return;
    trades = [];
    saveData();
    refreshDashboard();
    toast('All trades cleared.', 'info');
  });
}

/* =====================================================
   ESCAPE HTML
===================================================== */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/* =====================================================
   BOOTSTRAP
===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initTabs();
  initTradeForm();
  initSorting();
  initFilters();
  initPnLCalculator();
  initPositionSizeCalc();
  initRiskMgmt();
  initClearAll();

  // Export
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Import
  document.getElementById('import-csv').addEventListener('change', e => {
    importCSV(e.target.files[0]);
    e.target.value = '';   // reset input so same file can be re-imported
  });

  // Initial render
  refreshDashboard();

  // Redraw charts on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const activePanel = document.querySelector('.tab-panel.active');
      if (activePanel && activePanel.id === 'tab-dashboard')   refreshDashboard();
      if (activePanel && activePanel.id === 'tab-risk-mgmt')   refreshRiskMgmt();
    }, 150);
  });
});
