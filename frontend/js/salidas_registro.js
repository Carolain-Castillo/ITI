// SOLO para registro-salidas.html

let _currentActivoId = null; // NUEVO: guardamos el id del activo abierto en el modal

document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('salida-lista');
  if (!cont) return;

  // Cargar una sola vez (sin auto-refresh para evitar parpadeo)
  await cargarSalidaRegistro(cont);

  // Preparar modal (mismo patrón que en index)
  prepararModal();

  // >>> Modal de mensajes (inyecta HTML+CSS si no existe) <<<
  ensureMsgModalExists();
  prepararMsgModal();
});

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d);
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

// Helpers visuales (mismos que usamos en index/entrada)
function renderIVCheck(label, value, id, disabled = true) {
  const checked = value ? 'checked' : '';
  const dis = disabled ? 'disabled' : '';
  return `
    <label class="iv-check">
      <input type="checkbox" id="${id}" ${checked} ${dis}>
      <span>${label}</span>
    </label>
  `;
}
function renderOrigenCheck(label, origenDb, disabled = true) {
  const checked = ((origenDb || '').trim() === label) ? 'checked' : '';
  const dis = disabled ? 'disabled' : '';
  return `
    <label class="iv-check">
      <input type="checkbox" class="edit-origen" value="${label}" ${checked} ${dis}>
      <span>${label}</span>
    </label>
  `;
}

// -------- Modal básico (abrir/cerrar) --------
function prepararModal() {
  const overlay = document.getElementById('detalle-modal');
  const btnCerrar = document.getElementById('modal-cerrar');
  if (!overlay || !btnCerrar) return;

  btnCerrar.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

/* ============================
   Modal de Mensajes (genérico)
   - Se crea/injecta automáticamente
   - Reemplaza alert(...)
   ============================ */
function ensureMsgModalExists(){
  if (document.getElementById('msg-modal')) return;

  // CSS inline para el modal
  const style = document.createElement('style');
  style.textContent = `
    .msg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999}
    .msg-overlay.hidden{display:none}
    .msg-dialog{width:min(380px,92vw);background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden}
    .msg-header{background:#7b2325;color:#fff;padding:10px 14px;font-weight:700}
    .msg-body{padding:16px 14px;color:#333;font-weight:600;text-align:center;white-space:pre-wrap}
    .msg-actions{padding:0 14px 16px;display:flex;justify-content:center}
    .msg-actions .btn-ok{background:#7b2325;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:700}
    .msg-actions .btn-ok:hover{background:#5a1a1b}
  `;
  document.head.appendChild(style);

  // HTML del modal
  const html = `
    <div id="msg-modal" class="msg-overlay hidden" aria-hidden="true">
      <div class="msg-dialog" role="dialog" aria-modal="true" aria-labelledby="msg-title">
        <div class="msg-header" id="msg-title">Mensaje</div>
        <div class="msg-body" id="msg-text">...</div>
        <div class="msg-actions">
          <button id="msg-ok" class="btn-ok" type="button">Aceptar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

function prepararMsgModal(){
  const overlay = document.getElementById('msg-modal');
  const btn = document.getElementById('msg-ok');
  if (!overlay || !btn) return;

  const close = () => overlay.classList.add('hidden');

  btn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('hidden') && (e.key === 'Escape' || e.key === 'Enter')) {
      e.preventDefault();
      close();
    }
  });
}

function showMsgModal(text){
  ensureMsgModalExists();
  const overlay = document.getElementById('msg-modal');
  const textEl = document.getElementById('msg-text');
  const btn = document.getElementById('msg-ok');
  if (!overlay || !textEl) return;
  textEl.textContent = text;
  overlay.classList.remove('hidden');
  btn?.focus();
}

async function cargarSalidaRegistro(cont) {
  try {
    const url = `/api/activos?estado=${encodeURIComponent('Por Retirar')}&_=${Date.now()}`;
    const resp = await fetch(url);
    let items = await resp.json();

    items = Array.isArray(items)
      ? items.filter(it => (it.estado || '').trim().toLowerCase() === 'por retirar')
      : [];

    // contador
    const countEl = document.getElementById('salida-count');
    if (countEl) countEl.textContent = String(items.length);

    cont.innerHTML = '';
    if (items.length === 0) return;

    for (const it of items) {
      // Tarjeta única con encabezado (N°/Categoría/Estado) + detalles breves
      const card = document.createElement('div');
      card.className = 'salida-card';
      card.style.margin = '8px 0 12px';
      card.style.background = '#fff';
      card.style.border = '1px solid #e6e6e6';
      card.style.borderRadius = '6px';
      card.style.overflow = 'hidden';
      card.style.cursor = 'pointer';
      card.title = 'Ver detalle';

      // Header dentro del recuadro
      const header = document.createElement('div');
      header.className = 'salida-card-header';
      header.style.background = '#eef5fb';
      header.style.borderBottom = '1px solid #e6e6e6';
      header.style.padding = '6px 8px';
      header.style.display = 'grid';
      header.style.gridTemplateColumns = 'repeat(3, 1fr)';
      header.style.textAlign = 'center';
      header.style.fontWeight = '700';
      header.innerHTML = `
        <span>${it.numero}</span>
        <span>${it.categoria}</span>
        <span>${(it.estado || '').trim()}</span>
      `;

      // Cuerpo corto
      const body = document.createElement('div');
      body.className = 'salida-card-body';
      body.style.padding = '8px 10px';
      body.style.fontSize = '.95rem';
      body.style.lineHeight = '1.35';
      body.textContent = 'Cargando datos…';

      // Traer detalle del activo (para el preview en la tarjeta)
      try {
        const detResp = await fetch(`/api/activos/${it.id}`);
        if (!detResp.ok) throw new Error('Detalle no disponible');
        const a = await detResp.json();

        body.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 16px;">
            <div><strong>Remitente:</strong> ${a.remitente_nombre || '—'}</div>
            <div><strong>Recepción TI:</strong> ${fmtDate(a.fecha_recepcion_ti)}</div>
            <div><strong>Ticket:</strong> ${a.ticket || '—'}</div>
            <div><strong>Origen:</strong> ${a.origen || '—'}</div>
            <div style="grid-column:1 / -1;"><em>Haz clic para ver toda la información y reportes…</em></div>
          </div>
        `;
      } catch (e) {
        console.error(e);
        body.textContent = 'No se pudo cargar la información del activo.';
      }

      // Abrir modal a detalle al hacer clic
      card.addEventListener('click', () => abrirDetalleSalida(it.id));

      card.appendChild(header);
      card.appendChild(body);
      cont.appendChild(card);
    }
  } catch (err) {
    console.error('No se pudo cargar "Salida" (registro-salidas)', err);
  }
}

async function abrirDetalleSalida(id) {
  const overlay = document.getElementById('detalle-modal');
  const caja = document.getElementById('modal-detalle');
  const titulo = document.getElementById('modal-titulo');
  if (!overlay || !caja) return;

  try {
    const resp = await fetch(`/api/activos/${id}`);
    if (!resp.ok) throw new Error('No se pudo obtener el detalle');
    const a = await resp.json();

    _currentActivoId = a.id; // NUEVO: recordamos el id del activo abierto

    // ====== CATEGORÍAS (para mostrar en un select deshabilitado) ======
    const categorias = [
      'Administrativo','Ejecutivo','CAD','BIM','Cámaras','Celulares',
      'Monitores','Router','Tablets','Proyector','BAM','Impresora',
      'Servidor','UPS','Plotter'
    ];
    const optsCat = categorias.map(c =>
      `<option value="${c}" ${a.categoria === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    // -------- Título del modal --------
    if (titulo) titulo.textContent = `Detalle del Activo ${a.numero_activo || a.numero || ''}`;

    // =========================================================
    // === NUEVO: Sección "Entrega" con botón Enviar (opera API)
    // =========================================================
    caja.innerHTML = `
      <div class="modal-section">
        <h4>Entrega</h4>
        <div class="entrega-row">
          <input id="entrega-nombre" type="text" placeholder="Nombre de quien retira">
          <input id="entrega-correo" type="email" placeholder="Correo de quien retira">
          <button type="button" id="entrega-enviar" class="btn-enviar">Enviar</button>
        </div>
      </div>

      <!-- Información de Activo (con OJO para reportes) -->
      <div class="modal-section">
        <h4 style="display:flex;align-items:center;gap:8px;">
          <span>Información de Activo</span>
          <button id="rep-eye" class="eye-toggle" title="Ver reportes" aria-label="Ver reportes" style="display:none;">👁️</button>
        </h4>

        <!-- Panel de reportes -->
        <div id="rep-panel" class="rep-panel hidden">
          <div id="rep-contenido" class="rep-acc"></div>
        </div>

        <div class="grid">
          <div class="item">
            <strong>N° Activo:</strong>
            <input type="text" value="${a.numero_activo || a.numero || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Categoría:</strong>
            <select style="width:100%;padding:6px;border:1px solid #e6e6e6;border-radius:6px;background:#fff;" disabled>
              ${optsCat}
            </select>
          </div>
          <div class="item">
            <strong>Estado actual:</strong>
            <input type="text" value="${a.estado || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Fase:</strong>
            <input type="text" value="${a.fase || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Ticket:</strong>
            <input type="text" value="${a.ticket || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Años:</strong>
            <input type="number" min="0" value="${a.anios ?? ''}" style="width:100%" disabled>
          </div>
        </div>
      </div>

      <!-- Remitente -->
      <div class="modal-section">
        <h4>Remitente</h4>
        <div class="grid">
          <div class="item">
            <strong>Remitente:</strong>
            <input type="text" value="${a.remitente_nombre || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Recepción TI:</strong>
            <input type="date" value="${fmtDate(a.fecha_recepcion_ti)}" style="width:100%" disabled>
          </div>
        </div>
      </div>

      <!-- Origen -->
      <div class="modal-section">
        <h4>Origen</h4>
        <div class="iv-grid">
          ${renderOrigenCheck('Desmovilización', a.origen, true)}
          ${renderOrigenCheck('Nuevo', a.origen, true)}
          ${renderOrigenCheck('Mesa de ayuda', a.origen, true)}
          ${renderOrigenCheck('Usuario directo', a.origen, true)}
        </div>
      </div>

      <!-- Fechas -->
      <div class="modal-section">
        <h4>Fechas</h4>
        <div class="grid">
          <div class="item">
            <strong>Fecha compra:</strong>
            <input type="date" value="${fmtDate(a.fecha_compra)}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Creado:</strong>
            <input type="text" value="${fmtDate(a.created_at)}" style="width:100%" disabled>
          </div>
        </div>
      </div>

      <!-- Características / Notas -->
      <div class="modal-section">
        <h4>Características y Notas</h4>
        <div class="grid">
          <div class="item" style="grid-column: 1 / -1;">
            <strong>Características:</strong>
            <textarea rows="2" style="width:100%" disabled>${a.caracteristicas || ''}</textarea>
          </div>
          <div class="item" style="grid-column: 1 / -1;">
            <strong>Notas:</strong>
            <textarea rows="2" style="width:100%" disabled>${a.notas || ''}</textarea>
          </div>
        </div>
      </div>

      <!-- Inspección Visual -->
      <div class="modal-section">
        <h4>Inspección Visual</h4>
        <div class="iv-grid">
          ${renderIVCheck('Daños en Carcasa', a.iv_carcasa, 'ed-iv-carcasa', true)}
          ${renderIVCheck('Daños en el Teclado', a.iv_teclado, 'ed-iv-teclado', true)}
          ${renderIVCheck('Pantalla Rota', a.iv_pantalla, 'ed-iv-pantalla', true)}
          ${renderIVCheck('Puertos Dañados', a.iv_puertos, 'ed-iv-puertos', true)}
          ${renderIVCheck('Con Cargador', a.iv_cargador, 'ed-iv-cargador', true)}
          ${renderIVCheck('Sin daños visibles', a.iv_sin_danos, 'ed-iv-sin-danos', true)}
          <div class="iv-otro" style="grid-column: 1 / -1;">
            <strong>Otro:</strong>
            <input type="text" value="${a.iv_otro || ''}" style="width:100%" disabled>
          </div>
        </div>
      </div>
    `;

    // ====== Cargar reportes (mismo acordeón que en index) ======
    try {
      const eyeBtn = document.getElementById('rep-eye');
      const panel = document.getElementById('rep-panel');
      const contRep = document.getElementById('rep-contenido');

      const rs = await fetch(`/api/reportes-tecnicos?activo_id=${encodeURIComponent(a.id)}`);
      const reportes = await rs.json();

      if (Array.isArray(reportes) && reportes.length > 0) {
        eyeBtn.style.display = 'inline-flex';
        const cb = (checked) => `<input type="checkbox" ${checked ? 'checked' : ''} disabled>`;

        contRep.innerHTML = reportes.map((r, idx) => {
          const titulo = `Reporte #${r.id || (reportes.length - idx)}${r.estado_final ? ' — ' + r.estado_final : ''}`;
          const est = String(r.estado_final || '').toLowerCase();
          return `
            <details class="rep-item">
              <summary>${titulo}</summary>
              <div class="rep-body">
                <fieldset class="bloque bloque-colspan">
                  <legend>Evaluación Inicial</legend>
                  <div class="evaluacion-grid">
                    <label>${cb(!!r.eval_enciende)} Enciende</label>
                    <label>${cb(!!r.eval_inicia_so)} Inicia Sistema Operativo</label>
                    <label>${cb(!!r.eval_puertos)} Puertos Funcionales</label>
                    <label>${cb(!!r.eval_pantalla)} Pantalla Funcional</label>
                    <label>${cb(!!r.eval_bateria)} Batería Funcional</label>
                    <label>${cb(!!r.eval_audio)} Audio Funcional</label>
                    <label>${cb(!!r.eval_teclado)} Teclado Funcional</label>
                    <label>${cb(!!r.eval_cargador)} Cargador Funcional</label>
                    <label>${cb(!!r.eval_tiene_tintas)} Tiene Tintas</label>
                    <label>${cb(!!r.eval_cable_poder)} Cable de Poder</label>
                    <label>${cb(!!r.eval_cable_usb)} Cable USB</label>
                    <label>${cb(!!r.eval_cable_video)} Cable VGA/HDMI</label>
                  </div>
                </fieldset>

                <fieldset class="bloque bloque-colspan" style="margin-top:10px;">
                  <legend>Preparación</legend>
                  <div class="preparacion-grid">
                    <div>
                      <label>${cb(!!r.prep_instalar_so)} Instalar SO</label>
                      <label>${cb(!!r.prep_cuenta_local_cyd)} Crear cuenta local CyD</label>
                      <label>${cb(!!r.prep_instalar_drivers)} Instalar Drivers (HP, Lenovo, Dell)</label>
                      <label>${cb(!!r.prep_actualizacion_fw_so)} Actualización Firmware y SO</label>
                      <label>${cb(!!r.prep_software_base_cyd)} Instalar Software base CyD</label>
                      <label>${cb(!!r.prep_crear_cuenta_admin)} Crear cuenta de administrador</label>
                      <label>${cb(!!r.prep_quitar_cyd_admins)} Quitar cuenta CyD de administradores</label>
                      <label>${cb(!!r.prep_agregar_cyd_avanzados)} Agregar CyD a usuarios avanzados/red</label>
                    </div>
                    <div>
                      <label>${cb(!!r.prep_diag_teclado)} Diagnóstico de teclado</label>
                      <label>${cb(!!r.prep_diag_memoria)} Diagnóstico de memoria</label>
                      <label>${cb(!!r.prep_diag_placa)} Diagnóstico de placa lógica</label>
                      <label>${cb(!!r.prep_diag_procesador)} Diagnóstico de procesador</label>
                      <label>${cb(!!r.prep_puertos_ok)} Puertos funcionan correctamente</label>
                      <label>${cb(!!r.prep_acond_teclado)} Acondicionamiento de teclado</label>
                      <label>${cb(!!r.prep_acond_pantalla_carcasa)} Acondicionamiento de pantalla/carcasa</label>
                      <label>${cb(!!r.prep_acond_cargador)} Acondicionamiento del cargador</label>
                    </div>
                  </div>
                </fieldset>


                 <!--  Bloque Estado (idéntico a reporte) -->
                <fieldset class="bloque bloque-colspan" style="margin-top:10px;">
                  <legend>Estado</legend>
                  <div style="display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:8px 16px;align-items:center;">
                    <label>${cb(est === 'disponible')} Disponible</label>
                    <label>${cb(est === 'reciclar' || est === 'reciclaje')} Reciclar</label>
                    <label>${cb(est === 'préstamo' || est === 'prestamo')} Préstamo</label>
                  </div>
                </fieldset>
                


                <fieldset class="bloque bloque-colspan" style="margin-top:10px;">
                  <legend>Mejora (upgrade)</legend>
                  <div class="parte-cambiada-grid">
                    <label>${cb(!r.parte_cambiada)} No</label>
                    <label>${cb(!!r.parte_cambiada)} Sí</label>
                    <div class="campo-parte">
                      <label>Parte cambiada:</label>
                      <input type="text" value="${r.detalle_parte ? String(r.detalle_parte).replace(/"/g,'&quot;') : ''}" disabled>
                    </div>
                  </div>
                </fieldset>

                <fieldset class="bloque bloque-colspan" style="margin-top:10px;">
                  <legend>Conclusión y Recomendaciones</legend>
                  <div class="campo">
                    <textarea rows="4" readonly>${(r.conclusion || '').toString()}</textarea>
                  </div>
                </fieldset>
              </div>
            </details>
          `;
        }).join('');

        let abierto = false;
        eyeBtn.addEventListener('click', () => {
          abierto = !abierto;
          eyeBtn.classList.toggle('open', abierto);
          panel.classList.toggle('hidden', !abierto);
        });
      } else {
        // No hay reportes: el ojo NO aparece
        document.getElementById('rep-eye').style.display = 'none';
      }
    } catch (e) {
      console.error('Error cargando reportes del activo:', e);
    }

    // NUEVO: wire del botón "Enviar" para mandar el correo con PDF
    const btnEnviar = document.getElementById('entrega-enviar');
    const inpNom = document.getElementById('entrega-nombre');
    const inpMail = document.getElementById('entrega-correo');
    if (btnEnviar && inpNom && inpMail) {
      btnEnviar.addEventListener('click', async () => {
        const nombre = (inpNom.value || '').trim();
        const correo = (inpMail.value || '').trim();

        // Validaciones súper básicas -> ahora con modal
        if (!nombre) { showMsgModal('Ingresa el nombre de quien retira.'); return; }
        if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
          showMsgModal('Ingresa un correo válido de quien retira.');
          return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Enviando...';

        try {
          const r = await fetch('/api/entregas/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activo_id: _currentActivoId,
              nombre_quien_retira: nombre,
              correo_quien_retira: correo
            })
          });
          const data = await r.json();
          if (!r.ok || !data.ok) {
            throw new Error(data?.msg || 'No se pudo enviar el correo.');
          }
          showMsgModal('Correo enviado correctamente.');
        } catch (e) {
          console.error(e);
          showMsgModal('No se pudo enviar el correo.');
        } finally {
          btnEnviar.disabled = false;
          btnEnviar.textContent = 'Enviar';
        }
      });
    }

    // Mostrar modal
    overlay.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    // Sin alert para mantener consistencia con tus modales
  }
}
