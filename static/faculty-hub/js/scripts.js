/* ============================================================
   FACULTY HUB — GLOBAL SCRIPTS
   ============================================================ */

// Custom cursor removed: using normal system cursor.

// ── Theme Management ─────────────────────────────────────────
const themeToggle  = document.getElementById('theme-toggle');
const rootElement  = document.documentElement;

const applyThemeIcon = (isDark) => {
    if (!themeToggle) return;
    themeToggle.innerHTML = isDark
        ? '<i data-lucide="moon" style="width:20px;height:20px;"></i>'
        : '<i data-lucide="sun"  style="width:20px;height:20px;"></i>';
    lucide.createIcons();
};

const savedTheme   = localStorage.getItem('theme');
const isDarkInitial = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

function applyTheme(dark) {
    if (dark) {
        rootElement.classList.add('dark');
        document.body.classList.add('dark');
        rootElement.setAttribute('data-bs-theme', 'dark');
    } else {
        rootElement.classList.remove('dark');
        document.body.classList.remove('dark');
        rootElement.setAttribute('data-bs-theme', 'light');
    }
}

applyTheme(isDarkInitial);

document.addEventListener('DOMContentLoaded', () => {
    applyThemeIcon(isDarkInitial);
});

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = !rootElement.classList.contains('dark');
        applyTheme(isDark);
        applyThemeIcon(isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

// ── Sidebar Logic ────────────────────────────────────────────
const sidebar      = document.getElementById('app-sidebar');
const mainContent  = document.querySelector('.main-content');
const toggleBtn    = document.getElementById('sidebar-toggle');

// Create overlay for mobile
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('sidebar-open');
    if (mainContent) mainContent.classList.add('sidebar-open');
    overlay.classList.add('active');
}

function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('sidebar-open');
    if (mainContent) mainContent.classList.remove('sidebar-open');
    overlay.classList.remove('active');
}

if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    });
}

overlay.addEventListener('click', closeSidebar);

// Close sidebar on ESC
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
});

// ── Logout Handler ───────────────────────────────────────────
document.querySelectorAll('.logout').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            // In a real app: window.location.href = 'login.html';
            alert('Logging out…');
        }
    });
});

// ── Global State (stub) ──────────────────────────────────────
const globalState = {
    deptFilter: 'all',
    yearFilter: 0
};
