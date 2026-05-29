/* ============================================================
   RupeeTrack – app.js
   All data stored in localStorage. Zero external dependencies.
   ============================================================ */

'use strict';

// ===== CONSTANTS =====
const KEYS = {
  pin: 'rt_pin',
  sq: 'rt_sq',       // { question, answer }
  theme: 'rt_theme',
  monthly: 'rt_monthly',
  annual: 'rt_annual',
  cards: 'rt_cards',
  investments: 'rt_investments',
  insurance: 'rt_insurance',
};

// ===== STATE =====
let deferredInstallPrompt = null;
let pendingDeleteFn = null;
let setupPinBuffer = '';
let setupConfirmBuffer = '';
let loginPinBuffer = '';
let currentSelectedInvType = 'FD';

// ===== STORAGE HELPERS =====
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function loadObj(key, def = {}) {
  try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initServiceWorker();
  initInstallPrompt();
  checkFirstRun();
  updateDashboardGreeting();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('install-btn-header');
    if (btn) btn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('install-btn-header');
    if (btn) btn.style.display = 'none';
    const note = document.getElementById('install-note');
    if (note) note.textContent = '✅ App installed successfully!';
    showToast('RupeeTrack installed on your device!', 'success');
  });
}

function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') showToast('Installing RupeeTrack…', 'success');
      deferredInstallPrompt = null;
    });
  } else {
    showToast('To install: use your browser\'s "Add to Home Screen" or "Install" option.', 'info');
  }
}

function checkFirstRun() {
  const pin = localStorage.getItem(KEYS.pin);
  if (!pin) {
    // First time – show setup
    document.getElementById('login-flow').style.display = 'none';
    document.getElementById('setup-flow').style.display = 'block';
    buildNumpad('setup-numpad', handleSetupPin);
    buildNumpad('setup-confirm-numpad', handleSetupConfirm);
    renderPinDots('setup-pin-display', 0);
    renderPinDots('setup-confirm-display', 0);
  } else {
    buildNumpad('login-numpad', handleLoginPin);
    renderPinDots('login-pin-display', 0);
  }
}

// ===== THEME =====
function initTheme() {
  const stored = localStorage.getItem(KEYS.theme) || 'system';
  applyTheme(stored);
}

function setTheme(theme, btn) {
  applyTheme(theme);
  save(KEYS.theme, theme);
  // Update all theme buttons
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Also sync settings page buttons
  ['system','light','dark'].forEach(t => {
    const el = document.getElementById('theme-' + t);
    if (el) el.classList.toggle('active', t === theme);
  });
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  // Sync login page theme buttons
  document.querySelectorAll('.theme-btn').forEach(b => {
    const map = { 'Auto': 'system', '☀ Light': 'light', '🌙 Dark': 'dark' };
    b.classList.toggle('active', map[b.textContent] === theme || b.textContent.includes(theme));
  });
}

function cycleTheme() {
  const current = localStorage.getItem(KEYS.theme) || 'system';
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  setTheme(next);
  showToast(`Theme: ${next === 'system' ? 'Auto' : next === 'light' ? '☀ Day Mode' : '🌙 Night Mode'}`);
}

// ===== PIN SETUP =====
function buildNumpad(containerId, handler) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const layout = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  el.innerHTML = '';
  layout.forEach(k => {
    const btn = document.createElement('button');
    if (k === '') {
      btn.className = 'numpad-btn empty';
      btn.disabled = true;
    } else {
      btn.className = 'numpad-btn' + (k === '⌫' ? ' backspace' : '');
      btn.textContent = k;
      btn.type = 'button';
      btn.addEventListener('click', () => handler(k));
    }
    el.appendChild(btn);
  });
}

function handleSetupPin(key) {
  if (key === '⌫') { setupPinBuffer = setupPinBuffer.slice(0,-1); }
  else if (setupPinBuffer.length < 4) { setupPinBuffer += key; }
  renderPinDots('setup-pin-display', setupPinBuffer.length);
  if (setupPinBuffer.length === 4) {
    setTimeout(() => {
      document.getElementById('setup-step-1').style.display = 'none';
      document.getElementById('setup-step-2').style.display = 'block';
    }, 250);
  }
}

function handleSetupConfirm(key) {
  if (key === '⌫') { setupConfirmBuffer = setupConfirmBuffer.slice(0,-1); }
  else if (setupConfirmBuffer.length < 4) { setupConfirmBuffer += key; }
  renderPinDots('setup-confirm-display', setupConfirmBuffer.length);
  if (setupConfirmBuffer.length === 4) {
    setTimeout(() => {
      if (setupPinBuffer !== setupConfirmBuffer) {
        shakeDots('setup-confirm-display');
        setupConfirmBuffer = '';
        renderPinDots('setup-confirm-display', 0);
        showToast('PINs do not match. Try again.', 'error');
      } else {
        document.getElementById('setup-step-2').style.display = 'none';
        document.getElementById('setup-step-3').style.display = 'block';
      }
    }, 250);
  }
}

window.completeSetup = function() {
  const q = document.getElementById('setup-sq-question').value;
  const a = document.getElementById('setup-sq-answer').value.trim();
  if (!q) return showToast('Please select a security question.', 'error');
  if (a.length < 2) return showToast('Please enter your security answer.', 'error');
  localStorage.setItem(KEYS.pin, setupPinBuffer);
  save(KEYS.sq, { question: q, answer: a.toLowerCase() });
  showAppScreen();
  showToast('Welcome to RupeeTrack! 🎉', 'success');
};

// ===== LOGIN =====
function handleLoginPin(key) {
  if (key === '⌫') { loginPinBuffer = loginPinBuffer.slice(0,-1); }
  else if (loginPinBuffer.length < 4) { loginPinBuffer += key; }
  renderPinDots('login-pin-display', loginPinBuffer.length);
  if (loginPinBuffer.length === 4) {
    setTimeout(() => {
      const stored = localStorage.getItem(KEYS.pin);
      if (loginPinBuffer === stored) {
        showAppScreen();
      } else {
        shakeDots('login-pin-display');
        loginPinBuffer = '';
        renderPinDots('login-pin-display', 0);
        document.getElementById('login-heading').textContent = '❌ Wrong PIN. Try again.';
        setTimeout(() => { document.getElementById('login-heading').textContent = 'Enter your PIN'; }, 1500);
      }
    }, 250);
  }
}

function renderPinDots(containerId, filledCount) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length:4}, (_,i) => {
    const f = i < filledCount;
    return `<div class="pin-dot ${f ? 'filled' : ''} ${i === filledCount ? 'active' : ''}">${f ? '●' : ''}</div>`;
  }).join('');
}

function shakeDots(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'none';
  el.style.transform = 'translateX(-8px)';
  setTimeout(() => {
    el.style.transform = 'translateX(8px)';
    setTimeout(() => {
      el.style.transform = 'translateX(-5px)';
      setTimeout(() => { el.style.transform = ''; }, 100);
    }, 100);
  }, 100);
}

// ===== FORGOT PIN =====
window.showForgotPin = function() {
  const sq = loadObj(KEYS.sq);
  if (!sq.question) return showToast('No security question set.', 'error');
  document.getElementById('login-flow').style.display = 'none';
  document.getElementById('forgot-flow').style.display = 'block';
  document.getElementById('forgot-question-label').textContent = sq.question;
};

window.cancelForgot = function() {
  document.getElementById('forgot-flow').style.display = 'none';
  document.getElementById('login-flow').style.display = 'block';
};

window.verifySecurityAnswer = function() {
  const sq = loadObj(KEYS.sq);
  const ans = document.getElementById('forgot-answer').value.trim().toLowerCase();
  if (ans === sq.answer) {
    // Reset PIN
    localStorage.removeItem(KEYS.pin);
    localStorage.removeItem(KEYS.sq);
    setupPinBuffer = '';
    setupConfirmBuffer = '';
    document.getElementById('forgot-flow').style.display = 'none';
    document.getElementById('login-flow').style.display = 'none';
    document.getElementById('setup-flow').style.display = 'block';
    document.getElementById('setup-step-1').style.display = 'block';
    document.getElementById('setup-step-2').style.display = 'none';
    document.getElementById('setup-step-3').style.display = 'none';
    buildNumpad('setup-numpad', handleSetupPin);
    buildNumpad('setup-confirm-numpad', handleSetupConfirm);
    renderPinDots('setup-pin-display', 0);
    renderPinDots('setup-confirm-display', 0);
    showToast('Identity verified. Please set a new PIN.', 'success');
  } else {
    showToast('Incorrect answer. Try again.', 'error');
  }
};

// ===== SCREEN TRANSITIONS =====
function showAppScreen() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  syncSettingsThemeButtons();
  renderDashboard();
  scheduleNotificationCheck();
}

window.confirmLogout = function() { openModal('modal-logout'); };
window.logout = function() {
  closeModal('modal-logout');
  loginPinBuffer = '';
  buildNumpad('login-numpad', handleLoginPin);
  renderPinDots('login-pin-display', 0);
  document.getElementById('login-heading').textContent = 'Enter your PIN';
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
};

function syncSettingsThemeButtons() {
  const t = localStorage.getItem(KEYS.theme) || 'system';
  ['system','light','dark'].forEach(th => {
    const btn = document.getElementById('theme-' + th);
    if (btn) btn.classList.toggle('active', th === t);
  });
}

// ===== NAVIGATION =====
window.showPage = function(pageId, triggerEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
  if (triggerEl) triggerEl.classList.add('active');
  // Render page content
  switch(pageId) {
    case 'dashboard': renderDashboard(); break;
    case 'monthly-bills': renderMonthlyBills(); break;
    case 'annual-bills': renderAnnualBills(); break;
    case 'credit-cards': renderCreditCards(); break;
    case 'investments': renderInvestments(); break;
    case 'insurance': renderInsurance(); break;
    case 'alerts': renderAlerts(); break;
  }
};

// ===== MODALS =====
window.openModal = function(id) {
  document.getElementById(id)?.classList.add('open');
};
window.closeModal = function(id) {
  document.getElementById(id)?.classList.remove('open');
};
// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal(this.id);
  });
});

// ===== TOAST =====
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== FORMATTING HELPERS =====
function fmtINR(val) {
  const n = parseFloat(val) || 0;
  return '₹' + n.toLocaleString('en-IN', {maximumFractionDigits:2});
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
}
function ordinal(n) {
  if (!n) return '—';
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}
function nextMonthlyDate(dayOfMonth) {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), parseInt(dayOfMonth));
  if (d <= now) d = new Date(now.getFullYear(), now.getMonth()+1, parseInt(dayOfMonth));
  return d;
}
function nextAnnualDate(dateStr) {
  if (!dateStr) return null;
  const orig = new Date(dateStr);
  const now = new Date(); now.setHours(0,0,0,0);
  let next = new Date(now.getFullYear(), orig.getMonth(), orig.getDate());
  if (next < now) next = new Date(now.getFullYear()+1, orig.getMonth(), orig.getDate());
  return next;
}
function daysUntilMonthly(dayOfMonth) {
  const next = nextMonthlyDate(dayOfMonth);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((next - now) / 86400000);
}
function statusBadge(days) {
  if (days === null) return '';
  if (days < 0) return `<span class="badge badge-due">Overdue</span>`;
  if (days === 0) return `<span class="badge badge-due">Due Today</span>`;
  if (days <= 5) return `<span class="badge badge-due">Due in ${days}d</span>`;
  if (days <= 30) return `<span class="badge badge-upcoming">In ${days}d</span>`;
  return `<span class="badge badge-ok">In ${days}d</span>`;
}

// ===== DASHBOARD =====
function updateDashboardGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const el = document.getElementById('dash-greeting');
  if (el) el.textContent = `${g}! Here's your financial snapshot.`;
}

function renderDashboard() {
  updateDashboardGreeting();
  const monthly = load(KEYS.monthly);
  const annual = load(KEYS.annual);
  const cards = load(KEYS.cards);
  const investments = load(KEYS.investments);
  const insurance = load(KEYS.insurance);

  // Stats
  const totalMonthly = monthly.reduce((s,b) => s + (parseFloat(b.amount)||0), 0);
  const totalAnnual = annual.reduce((s,b) => s + (parseFloat(b.amount)||0), 0);
  const totalInvested = investments.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
  const totalCover = insurance.reduce((s,i) => s + (parseFloat(i.sum)||0), 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">📅</div>
      <div class="stat-label">Monthly Bills</div>
      <div class="stat-value">${fmtINR(totalMonthly)}</div>
      <div class="stat-sub">${monthly.length} utilities</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📆</div>
      <div class="stat-label">Annual Bills</div>
      <div class="stat-value">${fmtINR(totalAnnual)}</div>
      <div class="stat-sub">${annual.length} bills/year</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📈</div>
      <div class="stat-label">Total Invested</div>
      <div class="stat-value">${fmtINR(totalInvested)}</div>
      <div class="stat-sub">${investments.length} investments</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🛡</div>
      <div class="stat-label">Insurance Cover</div>
      <div class="stat-value">${fmtINR(totalCover)}</div>
      <div class="stat-sub">${insurance.length} policies</div>
    </div>
  `;

  // Alerts
  const alerts = collectAlerts(monthly, annual, cards, investments, insurance);
  const alertCount = alerts.filter(a => a.urgent || a.days <= 7).length;
  const countEl = document.getElementById('alert-count');
  if (countEl) {
    countEl.textContent = alertCount;
    countEl.style.display = alertCount > 0 ? 'inline' : 'none';
  }

  const dashAlerts = document.getElementById('dash-alerts');
  if (alerts.length === 0) {
    dashAlerts.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">All clear!</div><div class="empty-sub">No upcoming payments in the next 30 days.</div></div>`;
  } else {
    dashAlerts.innerHTML = alerts.slice(0,6).map(a => `
      <div class="alert-item ${a.days <= 3 ? 'urgent' : a.days <= 10 ? 'warning' : ''}">
        <span class="alert-icon">${a.icon}</span>
        <div class="alert-text">${a.title}<small>${a.sub}</small></div>
        ${statusBadge(a.days)}
      </div>
    `).join('');
  }

  // Recent
  const recent = [...monthly.map(b => ({...b, _type:'Monthly Bill', _icon:'📅'})),
    ...annual.map(b => ({...b, _type:'Annual Bill', _icon:'📆'})),
    ...cards.map(c => ({...c, _type:'Credit Card', _icon:'💳'})),
    ...investments.map(i => ({...i, _type:'Investment', _icon:'📈'})),
    ...insurance.map(i => ({...i, _type:'Insurance', _icon:'🛡'}))
  ].slice(-4).reverse();

  document.getElementById('dash-recent').innerHTML = recent.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No entries yet</div><div class="empty-sub">Start by adding a bill or investment.</div></div>`
    : recent.map(r => `
        <div class="card" style="margin-bottom:0.6rem;padding:0.9rem 1rem;">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <span style="font-size:1.1rem;">${r._icon}</span>
            <div><div style="font-size:0.88rem;font-weight:600;color:var(--text);">${r.name}</div><div style="font-size:0.75rem;color:var(--text3);">${r._type}</div></div>
            <div style="margin-left:auto;font-size:0.88rem;font-weight:600;color:var(--gold);">${fmtINR(r.amount || r.premium || 0)}</div>
          </div>
        </div>`).join('');
}

function collectAlerts(monthly, annual, cards, investments, insurance) {
  const alerts = [];
  const now = new Date(); now.setHours(0,0,0,0);

  // Monthly bills
  monthly.forEach(b => {
    if (!b.dueDay) return;
    const days = daysUntilMonthly(b.dueDay);
    const remind = parseInt(b.remindDays) || 5;
    if (days <= remind) alerts.push({ icon:'📅', title: b.name, sub: `Monthly bill – Due on ${ordinal(b.dueDay)}`, days, urgent: days <= 2 });
  });

  // Annual bills
  annual.forEach(b => {
    if (!b.dueDate) return;
    const next = nextAnnualDate(b.dueDate);
    if (!next) return;
    const days = Math.round((next - now) / 86400000);
    const remind = parseInt(b.remindDays) || 30;
    if (days <= remind) alerts.push({ icon:'📆', title: b.name, sub: `Annual bill – Due ${fmtDate(next.toISOString())}`, days, urgent: days <= 3 });
  });

  // Credit cards
  cards.forEach(c => {
    if (!c.dueDay) return;
    const days = daysUntilMonthly(c.dueDay);
    const remind = parseInt(c.remindDays) || 5;
    if (days <= remind) alerts.push({ icon:'💳', title: c.name || c.bank, sub: `Credit card due – ${ordinal(c.dueDay)} of month`, days, urgent: days <= 2 });
  });

  // Investments (maturity)
  investments.forEach(i => {
    if (!i.maturityDate) return;
    const days = daysUntil(i.maturityDate);
    const remind = parseInt(i.remindDays) || 30;
    if (days !== null && days <= remind) alerts.push({ icon:'📈', title: i.name, sub: `Investment matures ${fmtDate(i.maturityDate)}`, days, urgent: days <= 7 });
  });

  // Insurance premiums
  insurance.forEach(i => {
    if (!i.nextDue) return;
    const days = daysUntil(i.nextDue);
    const remind = parseInt(i.remindDays) || 30;
    if (days !== null && days <= remind) alerts.push({ icon:'🛡', title: i.name, sub: `Premium due ${fmtDate(i.nextDue)}`, days, urgent: days <= 7 });
  });

  alerts.sort((a,b) => a.days - b.days);
  return alerts;
}

function renderAlerts() {
  const alerts = collectAlerts(load(KEYS.monthly), load(KEYS.annual), load(KEYS.cards), load(KEYS.investments), load(KEYS.insurance));
  const el = document.getElementById('alerts-list');
  if (alerts.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">No alerts!</div><div class="empty-sub">All your dues are more than 30 days away.</div></div>`;
  } else {
    el.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.days <= 3 ? 'urgent' : a.days <= 10 ? 'warning' : ''}">
        <span class="alert-icon">${a.icon}</span>
        <div class="alert-text">${a.title}<small>${a.sub}</small></div>
        ${statusBadge(a.days)}
      </div>
    `).join('');
  }
}

// ===== MONTHLY BILLS =====
window.saveMonthlyBill = function() {
  const name = document.getElementById('mb-name').value.trim();
  if (!name) return showToast('Bill name is required.', 'error');
  const editId = document.getElementById('monthly-bill-edit-id').value;
  const bills = load(KEYS.monthly);
  const bill = {
    id: editId || uid(),
    name, category: document.getElementById('mb-category').value,
    generatedDay: document.getElementById('mb-generated-day').value,
    dueDay: document.getElementById('mb-due-day').value,
    remindDays: document.getElementById('mb-remind-days').value,
    amount: document.getElementById('mb-amount').value,
    lastDate: document.getElementById('mb-last-date').value,
    lastAmount: document.getElementById('mb-last-amount').value,
    paymentMode: document.getElementById('mb-payment-mode').value,
    notes: document.getElementById('mb-notes').value,
    updatedAt: new Date().toISOString()
  };
  if (editId) {
    const idx = bills.findIndex(b => b.id === editId);
    if (idx > -1) bills[idx] = bill;
  } else { bills.push(bill); }
  save(KEYS.monthly, bills);
  closeModal('modal-monthly-bill');
  clearMonthlyForm();
  renderMonthlyBills();
  showToast(editId ? 'Bill updated!' : 'Bill added!', 'success');
};

function clearMonthlyForm() {
  ['mb-name','mb-generated-day','mb-due-day','mb-remind-days','mb-amount','mb-last-date','mb-last-amount','mb-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'mb-remind-days' ? '5' : '';
  });
  document.getElementById('monthly-bill-edit-id').value = '';
  document.getElementById('monthly-bill-modal-title').textContent = 'Add Monthly Bill';
}

function renderMonthlyBills() {
  const bills = load(KEYS.monthly);
  const el = document.getElementById('monthly-bills-list');
  if (bills.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No monthly bills yet</div><div class="empty-sub">Add your electricity, water, rent, or other recurring bills.</div></div>`;
    return;
  }
  el.innerHTML = bills.map(b => {
    const days = b.dueDay ? daysUntilMonthly(b.dueDay) : null;
    return `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📅 ${b.name}</div>
          <div class="card-sub">${b.category}</div>
        </div>
        <div class="card-actions">
          ${statusBadge(days)}
          <button class="btn btn-icon btn-secondary btn-sm" onclick="editMonthlyBill('${b.id}')">✏</button>
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteItem(KEYS.monthly,'${b.id}','Delete this bill?')">🗑</button>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Monthly Amount</div><div class="info-value amount">${fmtINR(b.amount)}</div></div>
        <div class="info-item"><div class="info-label">Due Day</div><div class="info-value">${ordinal(b.dueDay)}</div></div>
        <div class="info-item"><div class="info-label">Bill Generated</div><div class="info-value">${ordinal(b.generatedDay)}</div></div>
        <div class="info-item"><div class="info-label">Remind Before</div><div class="info-value">${b.remindDays} days</div></div>
        <div class="info-item"><div class="info-label">Last Payment</div><div class="info-value">${fmtDate(b.lastDate)}</div></div>
        <div class="info-item"><div class="info-label">Last Amount</div><div class="info-value amount">${fmtINR(b.lastAmount)}</div></div>
        <div class="info-item"><div class="info-label">Payment Mode</div><div class="info-value">${b.paymentMode}</div></div>
        ${b.notes ? `<div class="info-item" style="grid-column:span 2"><div class="info-label">Notes</div><div class="info-value">${b.notes}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.editMonthlyBill = function(id) {
  const b = load(KEYS.monthly).find(x => x.id === id);
  if (!b) return;
  document.getElementById('monthly-bill-edit-id').value = id;
  document.getElementById('monthly-bill-modal-title').textContent = 'Edit Monthly Bill';
  document.getElementById('mb-name').value = b.name;
  document.getElementById('mb-category').value = b.category;
  document.getElementById('mb-generated-day').value = b.generatedDay;
  document.getElementById('mb-due-day').value = b.dueDay;
  document.getElementById('mb-remind-days').value = b.remindDays;
  document.getElementById('mb-amount').value = b.amount;
  document.getElementById('mb-last-date').value = b.lastDate;
  document.getElementById('mb-last-amount').value = b.lastAmount;
  document.getElementById('mb-payment-mode').value = b.paymentMode;
  document.getElementById('mb-notes').value = b.notes;
  openModal('modal-monthly-bill');
};

// ===== ANNUAL BILLS =====
window.saveAnnualBill = function() {
  const name = document.getElementById('ab-name').value.trim();
  if (!name) return showToast('Bill name is required.', 'error');
  const editId = document.getElementById('annual-bill-edit-id').value;
  const bills = load(KEYS.annual);
  const bill = {
    id: editId || uid(),
    name, category: document.getElementById('ab-category').value,
    dueDate: document.getElementById('ab-due-date').value,
    remindDays: document.getElementById('ab-remind-days').value,
    amount: document.getElementById('ab-amount').value,
    paymentMode: document.getElementById('ab-payment-mode').value,
    lastDate: document.getElementById('ab-last-date').value,
    lastAmount: document.getElementById('ab-last-amount').value,
    notes: document.getElementById('ab-notes').value,
    updatedAt: new Date().toISOString()
  };
  if (editId) { const idx = bills.findIndex(b => b.id === editId); if (idx > -1) bills[idx] = bill; }
  else bills.push(bill);
  save(KEYS.annual, bills);
  closeModal('modal-annual-bill');
  clearAnnualForm();
  renderAnnualBills();
  showToast(editId ? 'Bill updated!' : 'Bill added!', 'success');
};

function clearAnnualForm() {
  ['ab-name','ab-due-date','ab-remind-days','ab-amount','ab-last-date','ab-last-amount','ab-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'ab-remind-days' ? '30' : '';
  });
  document.getElementById('annual-bill-edit-id').value = '';
  document.getElementById('annual-bill-modal-title').textContent = 'Add Annual Bill';
}

function renderAnnualBills() {
  const bills = load(KEYS.annual);
  const el = document.getElementById('annual-bills-list');
  if (bills.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📆</div><div class="empty-title">No annual bills yet</div><div class="empty-sub">Add building tax, OTT subscriptions, domain renewals and more.</div></div>`;
    return;
  }
  const now = new Date(); now.setHours(0,0,0,0);
  el.innerHTML = bills.map(b => {
    const next = b.dueDate ? nextAnnualDate(b.dueDate) : null;
    const days = next ? Math.round((next - now) / 86400000) : null;
    return `<div class="card">
      <div class="card-header">
        <div><div class="card-title">📆 ${b.name}</div><div class="card-sub">${b.category}</div></div>
        <div class="card-actions">
          ${statusBadge(days)}
          <button class="btn btn-icon btn-secondary btn-sm" onclick="editAnnualBill('${b.id}')">✏</button>
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteItem(KEYS.annual,'${b.id}','Delete this bill?')">🗑</button>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Annual Amount</div><div class="info-value amount">${fmtINR(b.amount)}</div></div>
        <div class="info-item"><div class="info-label">Due Date</div><div class="info-value">${fmtDate(b.dueDate)}</div></div>
        <div class="info-item"><div class="info-label">Next Due</div><div class="info-value">${next ? fmtDate(next.toISOString()) : '—'}</div></div>
        <div class="info-item"><div class="info-label">Remind Before</div><div class="info-value">${b.remindDays} days</div></div>
        <div class="info-item"><div class="info-label">Last Payment</div><div class="info-value">${fmtDate(b.lastDate)}</div></div>
        <div class="info-item"><div class="info-label">Last Amount</div><div class="info-value amount">${fmtINR(b.lastAmount)}</div></div>
        <div class="info-item"><div class="info-label">Payment Mode</div><div class="info-value">${b.paymentMode}</div></div>
        ${b.notes ? `<div class="info-item" style="grid-column:span 2"><div class="info-label">Notes</div><div class="info-value">${b.notes}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.editAnnualBill = function(id) {
  const b = load(KEYS.annual).find(x => x.id === id);
  if (!b) return;
  document.getElementById('annual-bill-edit-id').value = id;
  document.getElementById('annual-bill-modal-title').textContent = 'Edit Annual Bill';
  document.getElementById('ab-name').value = b.name;
  document.getElementById('ab-category').value = b.category;
  document.getElementById('ab-due-date').value = b.dueDate;
  document.getElementById('ab-remind-days').value = b.remindDays;
  document.getElementById('ab-amount').value = b.amount;
  document.getElementById('ab-payment-mode').value = b.paymentMode;
  document.getElementById('ab-last-date').value = b.lastDate;
  document.getElementById('ab-last-amount').value = b.lastAmount;
  document.getElementById('ab-notes').value = b.notes;
  openModal('modal-annual-bill');
};

// ===== CREDIT CARDS =====
window.saveCreditCard = function() {
  const name = document.getElementById('cc-name').value.trim();
  if (!name) return showToast('Card name is required.', 'error');
  const editId = document.getElementById('cc-edit-id').value;
  const cards = load(KEYS.cards);
  const card = {
    id: editId || uid(),
    name, bank: document.getElementById('cc-bank').value,
    last4: document.getElementById('cc-last4').value,
    limit: document.getElementById('cc-limit').value,
    statementDay: document.getElementById('cc-statement-day').value,
    dueDay: document.getElementById('cc-due-day').value,
    remindDays: document.getElementById('cc-remind-days').value,
    outstanding: document.getElementById('cc-outstanding').value,
    lastDate: document.getElementById('cc-last-date').value,
    lastAmount: document.getElementById('cc-last-amount').value,
    notes: document.getElementById('cc-notes').value,
    updatedAt: new Date().toISOString()
  };
  if (editId) { const idx = cards.findIndex(c => c.id === editId); if (idx > -1) cards[idx] = card; }
  else cards.push(card);
  save(KEYS.cards, cards);
  closeModal('modal-credit-card');
  clearCCForm();
  renderCreditCards();
  showToast(editId ? 'Card updated!' : 'Card added!', 'success');
};

function clearCCForm() {
  ['cc-name','cc-bank','cc-last4','cc-limit','cc-statement-day','cc-due-day','cc-remind-days','cc-outstanding','cc-last-date','cc-last-amount','cc-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'cc-remind-days' ? '5' : '';
  });
  document.getElementById('cc-edit-id').value = '';
  document.getElementById('credit-card-modal-title').textContent = 'Add Credit Card';
}

function renderCreditCards() {
  const cards = load(KEYS.cards);
  const el = document.getElementById('credit-cards-list');
  if (cards.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">No credit cards yet</div><div class="empty-sub">Add your credit cards to track statements and due dates.</div></div>`;
    return;
  }
  el.innerHTML = cards.map(c => {
    const days = c.dueDay ? daysUntilMonthly(c.dueDay) : null;
    const utilPct = c.limit && c.outstanding ? Math.round((parseFloat(c.outstanding)/parseFloat(c.limit))*100) : 0;
    return `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">💳 ${c.name}${c.last4 ? ` ••••${c.last4}` : ''}</div>
          <div class="card-sub">${c.bank || 'Credit Card'}</div>
        </div>
        <div class="card-actions">
          ${statusBadge(days)}
          <button class="btn btn-icon btn-secondary btn-sm" onclick="editCreditCard('${c.id}')">✏</button>
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteItem(KEYS.cards,'${c.id}','Delete this card?')">🗑</button>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Credit Limit</div><div class="info-value amount">${fmtINR(c.limit)}</div></div>
        <div class="info-item"><div class="info-label">Outstanding</div><div class="info-value amount" style="${parseFloat(c.outstanding) > 0 ? 'color:#e05555' : ''}">${fmtINR(c.outstanding)}</div></div>
        <div class="info-item"><div class="info-label">Statement Date</div><div class="info-value">${ordinal(c.statementDay)}</div></div>
        <div class="info-item"><div class="info-label">Payment Due</div><div class="info-value">${ordinal(c.dueDay)}</div></div>
        <div class="info-item"><div class="info-label">Remind Before</div><div class="info-value">${c.remindDays} days</div></div>
        <div class="info-item"><div class="info-label">Last Payment</div><div class="info-value">${fmtDate(c.lastDate)}</div></div>
        <div class="info-item"><div class="info-label">Last Amount</div><div class="info-value amount">${fmtINR(c.lastAmount)}</div></div>
        ${utilPct > 0 ? `<div class="info-item"><div class="info-label">Utilisation</div><div class="info-value" style="color:${utilPct>80?'#e05555':utilPct>40?'#f59e0b':'#22c55e'}">${utilPct}%</div></div>` : ''}
        ${c.notes ? `<div class="info-item" style="grid-column:span 2"><div class="info-label">Notes</div><div class="info-value">${c.notes}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.editCreditCard = function(id) {
  const c = load(KEYS.cards).find(x => x.id === id);
  if (!c) return;
  document.getElementById('cc-edit-id').value = id;
  document.getElementById('credit-card-modal-title').textContent = 'Edit Credit Card';
  ['name','bank','last4','limit','statement-day','due-day','remind-days','outstanding','last-date','last-amount','notes'].forEach(f => {
    const key = f.replace('-','').replace('statement','statementD').replace('due','dueD').replace('remind','remindD').replace('last','lastD').replace('amount','');
    // map field ids to object keys
  });
  document.getElementById('cc-name').value = c.name;
  document.getElementById('cc-bank').value = c.bank;
  document.getElementById('cc-last4').value = c.last4;
  document.getElementById('cc-limit').value = c.limit;
  document.getElementById('cc-statement-day').value = c.statementDay;
  document.getElementById('cc-due-day').value = c.dueDay;
  document.getElementById('cc-remind-days').value = c.remindDays;
  document.getElementById('cc-outstanding').value = c.outstanding;
  document.getElementById('cc-last-date').value = c.lastDate;
  document.getElementById('cc-last-amount').value = c.lastAmount;
  document.getElementById('cc-notes').value = c.notes;
  openModal('modal-credit-card');
};

// ===== INVESTMENTS =====
window.selectInvType = function(btn, type) {
  document.querySelectorAll('#inv-type-grid .inv-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('inv-type').value = type;
  currentSelectedInvType = type;
};

window.saveInvestment = function() {
  const name = document.getElementById('inv-name').value.trim();
  if (!name) return showToast('Investment name is required.', 'error');
  const editId = document.getElementById('inv-edit-id').value;
  const investments = load(KEYS.investments);
  const inv = {
    id: editId || uid(),
    name, type: document.getElementById('inv-type').value,
    institution: document.getElementById('inv-institution').value,
    amount: document.getElementById('inv-amount').value,
    currentValue: document.getElementById('inv-current-value').value,
    startDate: document.getElementById('inv-start-date').value,
    maturityDate: document.getElementById('inv-maturity-date').value,
    rate: document.getElementById('inv-rate').value,
    remindDays: document.getElementById('inv-remind-days').value,
    notes: document.getElementById('inv-notes').value,
    updatedAt: new Date().toISOString()
  };
  if (editId) { const idx = investments.findIndex(i => i.id === editId); if (idx > -1) investments[idx] = inv; }
  else investments.push(inv);
  save(KEYS.investments, investments);
  closeModal('modal-investment');
  clearInvForm();
  renderInvestments();
  showToast(editId ? 'Investment updated!' : 'Investment added!', 'success');
};

function clearInvForm() {
  ['inv-name','inv-institution','inv-amount','inv-current-value','inv-start-date','inv-maturity-date','inv-rate','inv-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('inv-remind-days').value = '30';
  document.getElementById('inv-edit-id').value = '';
  document.getElementById('inv-type').value = 'FD';
  document.querySelectorAll('#inv-type-grid .inv-type-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.getElementById('investment-modal-title').textContent = 'Add Investment';
}

const invTypeIcons = { FD:'🏦', MF:'📊', Stocks:'📈', Bond:'📜', PPF:'🪙', NPS:'🏛', Gold:'🥇', RD:'💰', Other:'📦' };

function renderInvestments() {
  const investments = load(KEYS.investments);
  const el = document.getElementById('investments-list');
  if (investments.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">No investments yet</div><div class="empty-sub">Add FDs, mutual funds, stocks, bonds and more.</div></div>`;
    return;
  }
  const totalInvested = investments.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
  const totalCurrent = investments.reduce((s,i) => s + (parseFloat(i.currentValue)||parseFloat(i.amount)||0), 0);
  const gain = totalCurrent - totalInvested;
  el.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04));border-color:var(--gold);">
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Total Invested</div><div class="info-value amount">${fmtINR(totalInvested)}</div></div>
        <div class="info-item"><div class="info-label">Current Value</div><div class="info-value amount">${fmtINR(totalCurrent)}</div></div>
        <div class="info-item"><div class="info-label">Overall Gain/Loss</div><div class="info-value" style="color:${gain>=0?'#22c55e':'#e05555'}">${gain>=0?'+':''}${fmtINR(gain)}</div></div>
        <div class="info-item"><div class="info-label">No. of Holdings</div><div class="info-value">${investments.length}</div></div>
      </div>
    </div>
  ` + investments.map(i => {
    const days = i.maturityDate ? daysUntil(i.maturityDate) : null;
    const gain = i.currentValue && i.amount ? parseFloat(i.currentValue) - parseFloat(i.amount) : 0;
    return `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${invTypeIcons[i.type]||'📦'} ${i.name}</div>
          <div class="card-sub">${i.type}${i.institution ? ` · ${i.institution}` : ''}</div>
        </div>
        <div class="card-actions">
          ${days !== null ? statusBadge(days) : ''}
          <button class="btn btn-icon btn-secondary btn-sm" onclick="editInvestment('${i.id}')">✏</button>
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteItem(KEYS.investments,'${i.id}','Delete this investment?')">🗑</button>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Invested</div><div class="info-value amount">${fmtINR(i.amount)}</div></div>
        <div class="info-item"><div class="info-label">Current Value</div><div class="info-value amount">${fmtINR(i.currentValue||i.amount)}</div></div>
        ${i.rate ? `<div class="info-item"><div class="info-label">Return Rate</div><div class="info-value">${i.rate}% p.a.</div></div>` : ''}
        <div class="info-item"><div class="info-label">Start Date</div><div class="info-value">${fmtDate(i.startDate)}</div></div>
        ${i.maturityDate ? `<div class="info-item"><div class="info-label">Maturity</div><div class="info-value">${fmtDate(i.maturityDate)}</div></div>` : ''}
        ${gain ? `<div class="info-item"><div class="info-label">Gain/Loss</div><div class="info-value" style="color:${gain>=0?'#22c55e':'#e05555'}">${gain>=0?'+':''}${fmtINR(gain)}</div></div>` : ''}
        ${i.notes ? `<div class="info-item" style="grid-column:span 2"><div class="info-label">Notes</div><div class="info-value">${i.notes}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.editInvestment = function(id) {
  const i = load(KEYS.investments).find(x => x.id === id);
  if (!i) return;
  document.getElementById('inv-edit-id').value = id;
  document.getElementById('investment-modal-title').textContent = 'Edit Investment';
  document.getElementById('inv-type').value = i.type;
  document.querySelectorAll('#inv-type-grid .inv-type-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(i.type) || b.onclick?.toString().includes(`'${i.type}'`));
  });
  document.getElementById('inv-name').value = i.name;
  document.getElementById('inv-institution').value = i.institution;
  document.getElementById('inv-amount').value = i.amount;
  document.getElementById('inv-current-value').value = i.currentValue;
  document.getElementById('inv-start-date').value = i.startDate;
  document.getElementById('inv-maturity-date').value = i.maturityDate;
  document.getElementById('inv-rate').value = i.rate;
  document.getElementById('inv-remind-days').value = i.remindDays;
  document.getElementById('inv-notes').value = i.notes;
  openModal('modal-investment');
};

// ===== INSURANCE =====
window.saveInsurance = function() {
  const name = document.getElementById('ins-name').value.trim();
  if (!name) return showToast('Policy name is required.', 'error');
  const editId = document.getElementById('ins-edit-id').value;
  const insurance = load(KEYS.insurance);
  const policy = {
    id: editId || uid(),
    name, type: document.getElementById('ins-type').value,
    company: document.getElementById('ins-company').value,
    policyNo: document.getElementById('ins-policy-no').value,
    sum: document.getElementById('ins-sum').value,
    premium: document.getElementById('ins-premium').value,
    frequency: document.getElementById('ins-frequency').value,
    remindDays: document.getElementById('ins-remind-days').value,
    nextDue: document.getElementById('ins-next-due').value,
    expiry: document.getElementById('ins-expiry').value,
    startDate: document.getElementById('ins-start-date').value,
    paymentMode: document.getElementById('ins-payment-mode').value,
    notes: document.getElementById('ins-notes').value,
    updatedAt: new Date().toISOString()
  };
  if (editId) { const idx = insurance.findIndex(i => i.id === editId); if (idx > -1) insurance[idx] = policy; }
  else insurance.push(policy);
  save(KEYS.insurance, insurance);
  closeModal('modal-insurance');
  clearInsuranceForm();
  renderInsurance();
  showToast(editId ? 'Policy updated!' : 'Policy added!', 'success');
};

function clearInsuranceForm() {
  ['ins-name','ins-company','ins-policy-no','ins-sum','ins-premium','ins-remind-days','ins-next-due','ins-expiry','ins-start-date','ins-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'ins-remind-days' ? '30' : '';
  });
  document.getElementById('ins-edit-id').value = '';
  document.getElementById('insurance-modal-title').textContent = 'Add Insurance Policy';
}

const insIcons = { 'Life Insurance':'❤', 'Health Insurance':'🏥', 'Term Insurance':'🛡', 'Vehicle Insurance':'🚗', 'Home Insurance':'🏠', 'Travel Insurance':'✈', 'Other':'📋' };

function renderInsurance() {
  const insurance = load(KEYS.insurance);
  const el = document.getElementById('insurance-list');
  if (insurance.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🛡</div><div class="empty-title">No insurance policies yet</div><div class="empty-sub">Add life, health, vehicle or other policies with premium reminders.</div></div>`;
    return;
  }
  el.innerHTML = insurance.map(i => {
    const daysNext = i.nextDue ? daysUntil(i.nextDue) : null;
    const daysExpiry = i.expiry ? daysUntil(i.expiry) : null;
    return `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${insIcons[i.type]||'🛡'} ${i.name}</div>
          <div class="card-sub">${i.type}${i.company ? ` · ${i.company}` : ''}</div>
        </div>
        <div class="card-actions">
          ${daysNext !== null ? statusBadge(daysNext) : ''}
          <button class="btn btn-icon btn-secondary btn-sm" onclick="editInsurance('${i.id}')">✏</button>
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteItem(KEYS.insurance,'${i.id}','Delete this policy?')">🗑</button>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Sum Assured</div><div class="info-value amount">${fmtINR(i.sum)}</div></div>
        <div class="info-item"><div class="info-label">Premium</div><div class="info-value amount">${fmtINR(i.premium)} <span style="font-size:0.72rem;color:var(--text3);">${i.frequency}</span></div></div>
        <div class="info-item"><div class="info-label">Policy No.</div><div class="info-value">${i.policyNo||'—'}</div></div>
        <div class="info-item"><div class="info-label">Next Due</div><div class="info-value">${fmtDate(i.nextDue)}</div></div>
        <div class="info-item"><div class="info-label">Expiry</div><div class="info-value ${daysExpiry!==null&&daysExpiry<90?'text-danger':''}">${fmtDate(i.expiry)}</div></div>
        <div class="info-item"><div class="info-label">Payment Mode</div><div class="info-value">${i.paymentMode}</div></div>
        <div class="info-item"><div class="info-label">Remind Before</div><div class="info-value">${i.remindDays} days</div></div>
        ${i.notes ? `<div class="info-item" style="grid-column:span 2"><div class="info-label">Nominee/Notes</div><div class="info-value">${i.notes}</div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.editInsurance = function(id) {
  const i = load(KEYS.insurance).find(x => x.id === id);
  if (!i) return;
  document.getElementById('ins-edit-id').value = id;
  document.getElementById('insurance-modal-title').textContent = 'Edit Insurance Policy';
  document.getElementById('ins-name').value = i.name;
  document.getElementById('ins-type').value = i.type;
  document.getElementById('ins-company').value = i.company;
  document.getElementById('ins-policy-no').value = i.policyNo;
  document.getElementById('ins-sum').value = i.sum;
  document.getElementById('ins-premium').value = i.premium;
  document.getElementById('ins-frequency').value = i.frequency;
  document.getElementById('ins-remind-days').value = i.remindDays;
  document.getElementById('ins-next-due').value = i.nextDue;
  document.getElementById('ins-expiry').value = i.expiry;
  document.getElementById('ins-start-date').value = i.startDate;
  document.getElementById('ins-payment-mode').value = i.paymentMode;
  document.getElementById('ins-notes').value = i.notes;
  openModal('modal-insurance');
};

// ===== DELETE ITEM =====
window.deleteItem = function(key, id, msg) {
  document.getElementById('delete-item-msg').textContent = msg || 'Delete this entry?';
  pendingDeleteFn = () => {
    const arr = load(key);
    save(key, arr.filter(x => x.id !== id));
    closeModal('modal-delete-item');
    showToast('Entry deleted.', 'success');
    renderDashboard();
    // Re-render current page
    const activePage = document.querySelector('.page.active')?.id?.replace('page-','');
    if (activePage) {
      const map = { 'monthly-bills': renderMonthlyBills, 'annual-bills': renderAnnualBills, 'credit-cards': renderCreditCards, 'investments': renderInvestments, 'insurance': renderInsurance };
      map[activePage]?.();
    }
  };
  openModal('modal-delete-item');
};

window.executeDeleteItem = function() {
  if (pendingDeleteFn) { pendingDeleteFn(); pendingDeleteFn = null; }
};

// ===== SETTINGS: CHANGE PIN =====
window.changePIN = function() {
  const current = document.getElementById('cp-current').value;
  const newPin = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  const stored = localStorage.getItem(KEYS.pin);
  if (current !== stored) return showToast('Current PIN is incorrect.', 'error');
  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return showToast('PIN must be 4 digits.', 'error');
  if (newPin !== confirm) return showToast('PINs do not match.', 'error');
  localStorage.setItem(KEYS.pin, newPin);
  closeModal('modal-change-pin');
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  showToast('PIN updated successfully!', 'success');
};

window.changeSecurityQuestion = function() {
  const pin = document.getElementById('sq-pin-verify').value;
  const q = document.getElementById('sq-question-new').value;
  const a = document.getElementById('sq-answer-new').value.trim();
  if (pin !== localStorage.getItem(KEYS.pin)) return showToast('PIN is incorrect.', 'error');
  if (!a) return showToast('Please enter an answer.', 'error');
  save(KEYS.sq, { question: q, answer: a.toLowerCase() });
  closeModal('modal-change-sq');
  showToast('Security question updated!', 'success');
};

// ===== DELETE ALL =====
window.deleteAllData = function() {
  const typed = document.getElementById('delete-confirm-text').value;
  if (typed !== 'DELETE') return showToast('Please type DELETE to confirm.', 'error');
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  closeModal('modal-delete-all');
  document.getElementById('delete-confirm-text').value = '';
  showToast('All data deleted. Reloading…');
  setTimeout(() => location.reload(), 1500);
};

// ===== BACKUP / RESTORE =====
window.exportData = function() {
  const data = {};
  Object.entries(KEYS).forEach(([k,v]) => {
    if (v !== KEYS.pin && v !== KEYS.sq) {
      data[k] = load(v);
    }
  });
  data._meta = { app: 'RupeeTrack', exportedAt: new Date().toISOString(), version: '1.0' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rupeetrack-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded!', 'success');
};

window.importData = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data._meta || data._meta.app !== 'RupeeTrack') return showToast('Invalid backup file.', 'error');
      if (data.monthly) save(KEYS.monthly, data.monthly);
      if (data.annual) save(KEYS.annual, data.annual);
      if (data.cards) save(KEYS.cards, data.cards);
      if (data.investments) save(KEYS.investments, data.investments);
      if (data.insurance) save(KEYS.insurance, data.insurance);
      showToast('Backup restored successfully!', 'success');
      renderDashboard();
    } catch { showToast('Failed to parse backup file.', 'error'); }
  };
  reader.readAsText(file);
};

// ===== NOTIFICATIONS (Web API) =====
function scheduleNotificationCheck() {
  checkAndNotify();
  // Check every hour
  setInterval(checkAndNotify, 3600000);
}

async function checkAndNotify() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  const monthly = load(KEYS.monthly);
  const annual = load(KEYS.annual);
  const insurance = load(KEYS.insurance);
  const investments = load(KEYS.investments);

  const notifyKey = 'rt_notified_' + new Date().toDateString();
  if (localStorage.getItem(notifyKey)) return; // Notify max once per day

  const urgent = [];

  monthly.forEach(b => {
    if (!b.dueDay) return;
    const days = daysUntilMonthly(b.dueDay);
    if (days <= parseInt(b.remindDays||5) && days >= 0) urgent.push(`📅 ${b.name} due on ${ordinal(b.dueDay)}`);
  });
  annual.forEach(b => {
    if (!b.dueDate) return;
    const next = nextAnnualDate(b.dueDate);
    const now = new Date(); now.setHours(0,0,0,0);
    const days = Math.round((next - now) / 86400000);
    if (days <= parseInt(b.remindDays||30) && days >= 0) urgent.push(`📆 ${b.name} due ${fmtDate(next.toISOString())}`);
  });
  insurance.forEach(i => {
    if (!i.nextDue) return;
    const days = daysUntil(i.nextDue);
    if (days !== null && days <= parseInt(i.remindDays||30) && days >= 0) urgent.push(`🛡 ${i.name} premium due ${fmtDate(i.nextDue)}`);
  });
  investments.forEach(i => {
    if (!i.maturityDate) return;
    const days = daysUntil(i.maturityDate);
    if (days !== null && days <= parseInt(i.remindDays||30) && days >= 0) urgent.push(`📈 ${i.name} matures ${fmtDate(i.maturityDate)}`);
  });

  if (urgent.length > 0) {
    new Notification('RupeeTrack – Payment Reminders', {
      body: urgent.slice(0,3).join('\n') + (urgent.length > 3 ? `\n+${urgent.length-3} more` : ''),
      icon: './icon-192.png',
      badge: './icon-192.png'
    });
    localStorage.setItem(notifyKey, '1');
  }
}

// ===== KEYBOARD SUPPORT FOR NUMPAD =====
document.addEventListener('keydown', (e) => {
  const loginFlow = document.getElementById('login-flow');
  if (loginFlow && loginFlow.style.display !== 'none' && document.getElementById('screen-login').classList.contains('active')) {
    if (/^\d$/.test(e.key)) handleLoginPin(e.key);
    else if (e.key === 'Backspace') handleLoginPin('⌫');
  }
});
