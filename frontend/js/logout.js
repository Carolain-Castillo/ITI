// frontend/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-logout');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      // Si tu backend expone un logout, esto limpia la sesión/COOKIE
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {
      // Si no existe /api/logout, simplemente ignoramos el error
    } finally {
      // Redirige siempre al login
      window.location.href = 'login.html';
    }
  });
});
