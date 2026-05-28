let pin = localStorage.getItem('pin');
let securityQ = localStorage.getItem('securityQ') || "What is your mother's maiden name?";
let securityA = localStorage.getItem('securityA');

if (!securityA) {
  securityA = prompt("Set security answer (one time):");
  localStorage.setItem('securityA', securityA);
}

function login() {
  const input = document.getElementById('pinInput').value;
  if (!pin) {
    pin = input;
    localStorage.setItem('pin', pin);
  }
  if (input === pin) {
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
  } else {
    alert("Wrong PIN");
  }
}

function showForgotPin() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('forgotScreen').classList.remove('hidden');
  document.getElementById('securityQuestion').textContent = securityQ;
}

function verifySecurity() {
  if (document.getElementById('securityAnswer').value.toLowerCase() === securityA.toLowerCase()) {
    pin = prompt("Enter new 4-digit PIN:");
    localStorage.setItem('pin', pin);
    alert("PIN updated. Please login again.");
    location.reload();
  } else {
    alert("Wrong answer");
  }
}

function backToLogin() {
  location.reload();
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => deferredPrompt = e);

function installApp() {
  if (deferredPrompt) deferredPrompt.prompt();
}

// Data functions
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function load(key) { return JSON.parse(localStorage.getItem(key)) || []; }

// Delete data
function deleteAllData() {
  if (confirm("Delete ALL data permanently?")) {
    localStorage.clear();
    location.reload();
  }
}

// Section navigation (simplified for brevity)
function showSection(section) {
  document.getElementById('mainApp').classList.add('hidden');
  const div = document.getElementById('sections');
  div.classList.remove('hidden');
  div.innerHTML = `<h2>${section.toUpperCase()}</h2><button onclick="backToHome()">Back</button>`;
  // Add forms for each section here (monthly, annual, credit, invest)
  if (section === 'monthly') div.innerHTML += '<p>Monthly Utilities form coming in next update.</p>';
  // Repeat similar for other sections
}

function backToHome() {
  document.getElementById('sections').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
}

// System theme
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-theme', 'dark');
}
