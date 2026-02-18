// ===== THEME MANAGEMENT =====
function getStoredTheme() {
  return localStorage.getItem('mediqueue-theme') || 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mediqueue-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

// Apply stored theme on load
document.addEventListener('DOMContentLoaded', () => {
  setTheme(getStoredTheme());
});

// ===== MOBILE MENU =====
function toggleMobileMenu() {
  const navLinks = document.getElementById('navLinks');
  navLinks.classList.toggle('mobile-open');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== MODAL HELPERS =====
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ===== SCROLL NAVBAR EFFECT =====
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    if (window.scrollY > 30) {
      navbar.style.boxShadow = 'var(--shadow-md)';
    } else {
      navbar.style.boxShadow = 'none';
    }
  }
});

// ===== TAB SWITCHING =====
function switchTab(tabGroup, tabName) {
  // Hide all tab content
  document.querySelectorAll(`[data-tab-group="${tabGroup}"]`).forEach(el => {
    el.classList.add('hidden');
  });
  // Show selected
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove('hidden');

  // Update active tab button
  document.querySelectorAll(`[data-tab-btn-group="${tabGroup}"]`).forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

// ===== UTILITY: Format Time =====
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ===== SIDEBAR TOGGLE (for dashboard pages) =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}
