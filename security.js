/**
 * ============================================================
 * VIVAMOB — security.js
 * Camada de proteção: XSS, Rate-Limit, Anti-Raspagem, Cookies
 * ============================================================
 */

const SEC = {
  // --- 1. CSP REPORT (não bloqueante para arquivo local, mas instrutivo) ---
  initCSP() {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";
    document.head.prepend(meta);
  },

  // --- 2. ANTI-XSS: escape HTML ---
  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Sanitiza objeto antes de exibir
  sanitize(obj) {
    if (typeof obj === 'string') return this.escapeHtml(obj);
    if (Array.isArray(obj)) return obj.map(v => this.sanitize(v));
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k in obj) out[k] = this.sanitize(obj[k]);
      return out;
    }
    return obj;
  },

  // --- 3. RATE LIMITING (login / ações sensíveis) ---
  RATE_KEY: 'vm_rate_limit',
  MAX_ATTEMPTS: 5,
  BLOCK_MINUTES: 15,

  isBlocked() {
    const data = JSON.parse(localStorage.getItem(this.RATE_KEY) || '{}');
    if (!data.blockedUntil) return false;
    if (Date.now() < data.blockedUntil) {
      const min = Math.ceil((data.blockedUntil - Date.now()) / 60000);
      return { blocked: true, minutes: min };
    }
    localStorage.removeItem(this.RATE_KEY);
    return false;
  },

  recordAttempt() {
    const data = JSON.parse(localStorage.getItem(this.RATE_KEY) || '{}');
    data.attempts = (data.attempts || 0) + 1;
    if (data.attempts >= this.MAX_ATTEMPTS) {
      data.blockedUntil = Date.now() + this.BLOCK_MINUTES * 60000;
    }
    localStorage.setItem(this.RATE_KEY, JSON.stringify(data));
    return data.attempts;
  },

  resetAttempts() {
    localStorage.removeItem(this.RATE_KEY);
  },

  // --- 4. COOKIES SEGUROS (simulado + localStorage criptografado) ---
  async deriveKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('VivaMobSalt2026'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async encryptSession(data) {
    const key = await this.deriveKey(navigator.userAgent + screen.width + screen.colorDepth);
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    const blob = new Uint8Array(iv.length + encrypted.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...blob));
  },

  async decryptSession(cipher) {
    try {
      const key = await this.deriveKey(navigator.userAgent + screen.width + screen.colorDepth);
      const raw = Uint8Array.from(atob(cipher), c => c.charCodeAt(0));
      const iv = raw.slice(0, 12);
      const data = raw.slice(12);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      return null;
    }
  },

  // Cookie de flag segura (simulado — em produção use HttpOnly no servidor)
  setSecureCookie(name, value, days = 1) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; Secure; SameSite=Strict`;
  },

  getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },

  deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; SameSite=Strict`;
  },

  // --- 5. ANTI-RASPAGEM ---
  initAntiScrape() {
    // Desabilita clique direito em áreas sensíveis
    document.addEventListener('contextmenu', e => {
      if (e.target.closest('.no-copy, .dash-card, .ride-card, .wallet-balance-card, .profile-info')) {
        e.preventDefault();
        this.warn('Ação bloqueada por segurança');
      }
    });

    // Desabilita seleção em áreas sensíveis
    document.addEventListener('selectstart', e => {
      if (e.target.closest('.no-copy, .dash-card-value, .profile-info, .confirm-row strong')) {
        e.preventDefault();
      }
    });

    // Detecta DevTools (debugger trap leve)
    let devtoolsOpen = false;
    const threshold = 160;
    setInterval(() => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      if ((widthThreshold || heightThreshold) && !devtoolsOpen) {
        devtoolsOpen = true;
        console.clear();
        console.log('%cVivaMob', 'font-size:24px;font-weight:bold;color:#10B981');
        console.log('%cEsta área é protegida. Ações suspeitas foram registradas.', 'color:#EF4444');
      }
    }, 2000);

    // Honeypot: campo invisível nos formulários
    document.querySelectorAll('form').forEach(f => {
      if (!f.querySelector('.hp-field')) {
        const hp = document.createElement('input');
        hp.type = 'text';
        hp.name = 'website';
        hp.className = 'hp-field';
        hp.style.cssText = 'position:absolute;opacity:0;pointer-events:none;height:0;width:0;';
        hp.setAttribute('autocomplete', 'off');
        hp.setAttribute('tabindex', '-1');
        f.prepend(hp);
      }
    });
  },

  checkHoneypot(form) {
    const hp = form.querySelector('.hp-field');
    return hp && hp.value !== '';
  },

  warn(msg) {
    if (window.app && app.showToast) app.showToast(msg, 'warning');
    else alert(msg);
  },

  // --- 6. TOKEN CSRF LOCAL ---
  generateToken() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const token = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('vm_csrf', token);
    return token;
  },

  validateToken(token) {
    return token && token === sessionStorage.getItem('vm_csrf');
  }
};

// Inicializa CSP e proteções assim que o script carrega
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SEC.initAntiScrape());
} else {
  SEC.initAntiScrape();
}
SEC.initCSP();

