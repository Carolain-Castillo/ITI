// frontend/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('login-form');
  const btn    = document.getElementById('btn-login');
  const errBox = document.getElementById('alert');
  const errTxt = document.getElementById('login-error');
  const email  = document.getElementById('email');
  email.addEventListener('input', (e) => {
  const el = e.target;
  const i = el.selectionStart;
  const j = el.selectionEnd;
  el.value = el.value.toLowerCase();
  // restaura la posición del cursor
  try { el.setSelectionRange(i, j); } catch {}
});
  const pass   = document.getElementById('password');
  const toggle = document.getElementById('toggle-pass');
  const caps   = document.getElementById('caps-msg');
  const remember = document.getElementById('remember');

  // Año en el footer
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // Prefil de correo si lo guardamos antes
  const savedEmail = localStorage.getItem('iti.login.email');
  if (savedEmail) {
    email.value = savedEmail;
    remember.checked = true;
    pass.focus();
  }

  // Mostrar / ocultar contraseña
  if (toggle) {
    toggle.addEventListener('click', () => {
      const isPwd = pass.type === 'password';
      pass.type = isPwd ? 'text' : 'password';
      toggle.setAttribute('aria-label', isPwd ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  // Aviso de Bloq Mayús
  const updateCaps = (e) => {
    const on = e.getModifierState && e.getModifierState('CapsLock');
    caps.hidden = !on;
  };
  pass.addEventListener('keydown', updateCaps);
  pass.addEventListener('keyup', updateCaps);

  // ===== utilidades de error =====
  function showError(message){
    errTxt.textContent = message || 'Ha ocurrido un error.';
    errBox.hidden = false;          // <-- mostrar banner
  }
  function clearError(){
    errTxt.textContent = '';
    errBox.hidden = true;           // <-- ocultar banner
  }

  // Ocultar el error si el usuario empieza a escribir
  email.addEventListener('input', clearError);
  pass.addEventListener('input', clearError);

  // ===== submit =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const eVal = email.value.trim().toLowerCase();
    const pVal = pass.value;

    // Falta correo o contraseña
    if (!eVal || !pVal) {
      showError('Completa correo y contraseña.');
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: eVal, password: pVal })
      });

      // Puede fallar el .json() si hay error de red; por eso lo envolvemos
      let data = null;
      try { data = await r.json(); } catch {}

      if (!r.ok || !data?.ok) {
        const msg = data?.msg || (r.status === 401 ? 'Credenciales inválidas.' : 'No se pudo iniciar sesión.');
        throw new Error(msg);
      }

      // Guardar / limpiar "Recordarme"
      if (remember.checked) {
        localStorage.setItem('iti.login.email', eVal);
      } else {
        localStorage.removeItem('iti.login.email');
      }

      // Pequeño delay para que se vea el spinner
      setTimeout(() => { location.replace('/index.html'); }, 200);
    } catch (e2) {
      // Muestra:
      // - "Completa correo y contraseña." (si faltan datos) -> arriba
      // - "Credenciales inválidas." (401 del backend)
      // - "No se pudo iniciar sesión." (red/servidor)
      showError(e2.message || 'No se pudo iniciar sesión.');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
});
