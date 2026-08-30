/**
 * ============================================================
 * VIVAMOB — auth-guard.js
 * Proteção de rota: só permite acesso com sessão válida
 * ============================================================
 */

(async function guard() {
  // Bloqueia se não houver cookie de sessão
  const cookieSessao = SEC.getCookie('vm_session');
  const storageSessao = localStorage.getItem('vm_session_enc');

  if (!cookieSessao || !storageSessao) {
    redirectToLogin('Sessão não iniciada');
    return;
  }

  // Descriptografa sessão
  const sessao = await SEC.decryptSession(storageSessao);
  if (!sessao || !sessao.id || !sessao.exp || Date.now() > sessao.exp) {
    SEC.deleteCookie('vm_session');
    localStorage.removeItem('vm_session_enc');
    redirectToLogin('Sessão expirada');
    return;
  }

  // Valida fingerprint básico
  const fp = navigator.userAgent + screen.width + screen.colorDepth;
  if (sessao.fp && sessao.fp !== fp) {
    SEC.deleteCookie('vm_session');
    localStorage.removeItem('vm_session_enc');
    redirectToLogin('Dispositivo não reconhecido');
    return;
  }

  // Tudo OK: expõe sessão globalmente para app.js
  window.__VM_SESSAO = sessao;

  function redirectToLogin(motivo) {
    console.warn('[VivaMob Guard]', motivo);
    window.location.replace('../index.html?erro=' + encodeURIComponent(motivo));
  }
})();

