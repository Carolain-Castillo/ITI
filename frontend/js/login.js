// frontend/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const btn  = document.getElementById('btn-login');
  const err  = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    try {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data?.msg || 'No se pudo iniciar sesión');

      location.href = '/index.html';
    } catch (e2) {
      err.textContent = e2.message || 'Error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
});
