// Permitir solo un checkbox en "Origen" + Fecha Recepción TI automática
// + Validación Nativa (sin alertas) + Envío del formulario
document.addEventListener('DOMContentLoaded', () => {
  // --- Refuerza obligatorios por si faltan en el HTML ---
  const setReq = (id) => { const el = document.getElementById(id); if (el) el.required = true; };
  setReq('info-numero');   // N° Activo
  setReq('info-ticket');   // N° Ticket
  setReq('estado');        // Estado
  setReq('tipo');          // Categoría

  // ===== Modal de error  =====
  const errorOverlay = document.getElementById('af-error-modal');
  const errorClose   = document.getElementById('af-error-close');
  const errorOk      = document.getElementById('af-error-ok');
  const errorMsgEl   = document.getElementById('af-error-msg');

  function abrirModalError(msg = 'No se pudo guardar el activo.') {
    if (errorMsgEl) errorMsgEl.textContent = msg;
    errorOverlay?.classList.remove('af-hidden');
    errorOk?.focus();
  }
  function cerrarModalError() {
    errorOverlay?.classList.add('af-hidden');
  }
  errorClose?.addEventListener('click', cerrarModalError);
  errorOk?.addEventListener('click', cerrarModalError);
  errorOverlay?.addEventListener('click', (e) => { if (e.target === errorOverlay) cerrarModalError(); });

  // --- Fecha Recepción TI automática (hoy) ---
  const fechaInput = document.getElementById('remitente-fecha');
  if (fechaInput) {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const hoyStr = `${yyyy}-${mm}-${dd}`;
    if (!fechaInput.value) fechaInput.value = hoyStr;
    fechaInput.setAttribute('max', hoyStr);
  }

  // --- Solo un checkbox en "Origen" ---
  const origenChecks = document.querySelectorAll('.origen-group input[type="checkbox"]');
  if (origenChecks.length) {
    origenChecks.forEach(chk => {
      chk.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        origenChecks.forEach(other => { if (other !== e.target) other.checked = false; });
        validarGrupoOrigen(); // actualiza burbuja nativa
      });
    });
  }

  // === VALIDACIONES NATIVAS (sin alertas) ===
  // 1) Origen obligatorio (al menos uno)
  const origenSentinela = document.getElementById('origen-sentinela');

  function validarGrupoOrigen() {
  const alguno = Array.from(origenChecks).some(c => c.checked);

  if (!origenSentinela) return;

  if (alguno) {
    // Si hay alguno marcado, quitamos la obligación y limpiamos el mensaje
    origenSentinela.required = false;
    origenSentinela.setCustomValidity('');
  } else {
    // Si no hay ninguno, marcamos como requerido y ponemos texto personalizado
    origenSentinela.required = true;
    origenSentinela.setCustomValidity('Marca alguna de estas casillas si quieres continuar.');
  }
}

  validarGrupoOrigen();

  // 2) Inspección Visual obligatoria (algún check o texto en "Otro")
  const ivIds = ['iv-carcasa','iv-teclado','iv-pantalla','iv-puertos','iv-cargador','iv-sin-danos'];
  const ivChecks = ivIds.map(id => document.getElementById(id)).filter(Boolean);
  const ivOtro = document.getElementById('iv-otro');
  const ivSentinela = document.getElementById('iv-carcasa'); 

  function validarInspeccionVisual() {
    const alguno = ivChecks.some(el => el.checked);
    const hayOtro = (ivOtro && ivOtro.value.trim().length > 0);
    const ok = (alguno || hayOtro);
    if (ivSentinela) ivSentinela.required = !ok; 
  }
  validarInspeccionVisual();

  // Actualizar validación nativa al interactuar
  ivChecks.forEach(el => el.addEventListener('change', validarInspeccionVisual));
  if (ivOtro) ivOtro.addEventListener('input', validarInspeccionVisual);

  // --- Envío del formulario para crear activo ---
  const form = document.querySelector('form.formulario-grid');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Actualizamos los "required" de grupos antes de verificar
    validarGrupoOrigen();
    validarInspeccionVisual();

    // Deja que HTML5 muestre los globitos nativos si algo falta
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const origenSel = document.querySelector('.origen-group input[type="checkbox"]:checked');

    const data = {
      remitenteNombre: document.getElementById('remitente-nombre').value.trim(),
      fechaRecepcionTi: document.getElementById('remitente-fecha').value || null,

      // Obligatorios
      numero: document.getElementById('info-numero').value.trim(),
      ticket: document.getElementById('info-ticket').value.trim(),
      tipo: document.getElementById('tipo').value,
      estado: document.getElementById('estado').value,
      origen: origenSel ? origenSel.value : null,

      // Opcionales  (características)
      caracteristicas: (document.getElementById('caracteristicas')?.value || '').trim(),
      notas: (document.getElementById('notas')?.value || '').trim(),

      // Inspección Visual
      iv_carcasa: document.getElementById('iv-carcasa').checked,
      iv_teclado: document.getElementById('iv-teclado').checked,
      iv_pantalla: document.getElementById('iv-pantalla').checked,
      iv_puertos: document.getElementById('iv-puertos').checked,
      iv_cargador: document.getElementById('iv-cargador').checked,
      iv_sin_danos: !!(document.getElementById('iv-sin-danos') && document.getElementById('iv-sin-danos').checked),
      iv_otro: (ivOtro ? ivOtro.value.trim() : ''),

      // Otros
      fechaCompra: document.getElementById('fecha').value || null,
      anios: parseInt(document.getElementById('anios').value, 10) || null
    };

    try {
      const resp = await fetch('/api/activos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.msg || 'Error al guardar');

      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      // Modal de error
      abrirModalError('Este activo ya existe.');
    }
  });
});
