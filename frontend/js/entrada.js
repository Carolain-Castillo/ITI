// js/entrada.js

document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('entrada-lista');
  if (!cont) return;

  // Cargar lista ENTRADA (fase Entrada: Tránsito o Pendiente)
  await cargarEntrada(cont);

  // Preparar modal (compartido con otras columnas)
  prepararModal();

  // Aplicar filtros si ya hay algo seleccionado
  window.aplicarFiltrosTablero?.();
});

async function cargarEntrada(cont) {
  try {
    const url = `/api/activos?fase=${encodeURIComponent('Entrada')}&_=${Date.now()}`;
    const resp = await fetch(url);
    let items = await resp.json();

    if (!Array.isArray(items)) items = [];

    // >>> Contador
    const countEl = document.getElementById('entrada-count');
    if (countEl) countEl.textContent = String(items.length);
    // <<<

    cont.innerHTML = '';
    if (items.length === 0) return;

    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'activo-datos';
      row.dataset.id = it.id; // importante para abrir el detalle
      row.dataset.categoria = it.categoria || '';
      row.dataset.estado = (it.estado || '').trim();
      row.style.cursor = 'pointer';
      row.title = 'Ver detalle';

      row.innerHTML = `
        <span>${it.numero}</span>
        <span>${it.categoria}</span>
        <span>${(it.estado || '').trim()}</span>
      `;

      row.addEventListener('click', () => abrirDetalle(it.id));
      cont.appendChild(row);
    });

    // Reaplicar filtros tras renderizar
    window.aplicarFiltrosTablero?.();
  } catch (err) {
    console.error('No se pudo cargar "Entrada"', err);
  }
}

// -------- Modal --------
function prepararModal() {
  const overlay = document.getElementById('detalle-modal');
  const btnCerrar = document.getElementById('modal-cerrar');
  if (!overlay || !btnCerrar) return;

  btnCerrar.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

// Helpers visuales
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

// Render de un "origen" (checkbox único). Si disabled=false, dejo data-origen para manejar exclusividad
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

// Formatea fecha YYYY-MM-DD si viene con hora tipo ISO
function fmtDate(d) {
  if (!d) return '';
  const s = String(d);
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

// Asegura que el <select id="modal-estado"> tenga todas las opciones requeridas
function ensureEstadoOptions(selectEl) {
  if (!selectEl) return;

  const need = [
    // Entrada
    'Tránsito','Pendiente',
    // En Proceso
    'Proceso',
    // Salida
    'Por Retirar','Asignado','Reasignado','Reciclaje','Vendido',
    // Stock
    'Disponible','Préstamo','Repuesto','Donar'
  ];
  const has = new Set(Array.from(selectEl.options).map(o => o.value.trim()));
  need.forEach(v => {
    if (!has.has(v)) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    }
  });
}

async function abrirDetalle(id) {
  const overlay = document.getElementById('detalle-modal');
  const caja = document.getElementById('modal-detalle');
  const combo = document.getElementById('modal-estado');
  const btnGuardarEstado = document.getElementById('modal-guardar');

  if (!overlay || !caja || !combo || !btnGuardarEstado) return;

  try {
    const resp = await fetch(`/api/activos/${id}`);
    if (!resp.ok) throw new Error('No se pudo obtener el detalle');
    const a = await resp.json();

    // ====== OPCIONES DEL SELECT DE CATEGORÍA (MISMAS QUE EN agregar_activo.html) ======
    const categorias = [
      'Administrativo','Ejecutivo','CAD','BIM','Cámaras','Celulares',
      'Monitores','Router','Tablets','Proyector','BAM','Impresora',
      'Servidor','UPS','Plotter'
    ];
    const optsCat = categorias.map(c =>
      `<option value="${c}" ${a.categoria === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    // ======== CONTENIDO DEL MODAL (inputs deshabilitados por defecto) ========
    caja.innerHTML = `
      <!-- Información de Activo (con OJO para reportes) -->
      <div class="modal-section">
        <h4 style="display:flex;align-items:center;gap:8px;">
          <span>Información de Activo</span>
          <button id="rep-eye" class="eye-toggle" title="Ver reportes" aria-label="Ver reportes" style="display:none;">👁️</button>
        </h4>

        <!-- Panel desplegable de reportes (inicialmente oculto) -->
        <div id="rep-panel" class="rep-panel hidden">
          <div id="rep-contenido" class="rep-acc"></div>
        </div>

        <div class="grid">
          <div class="item">
            <strong>N° Activo:</strong>
            <input id="ed-numero" type="text" value="${a.numero_activo || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Categoría:</strong>
            <select id="ed-categoria" style="width:100%;padding:6px;border:1px solid #e6e6e6;border-radius:6px;background:#fff;" disabled>
              ${optsCat}
            </select>
          </div>
          <div class="item">
            <strong>Estado actual:</strong>
            <input id="ed-estado-mirror" type="text" value="${a.estado || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Fase:</strong>
            <input id="ed-fase" type="text" value="${a.fase || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Ticket:</strong>
            <input id="ed-ticket" type="text" value="${a.ticket || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Años:</strong>
            <input id="ed-anios" type="number" min="0" value="${a.anios ?? ''}" style="width:100%" disabled>
          </div>
        </div>
      </div>

      <!-- Remitente -->
      <div class="modal-section">
        <h4>Remitente</h4>
        <div class="grid">
          <div class="item">
            <strong>Remitente:</strong>
            <input id="ed-remitente" type="text" value="${a.remitente_nombre || ''}" style="width:100%" disabled>
          </div>
          <div class="item">
            <strong>Recepción TI:</strong>
            <input id="ed-fecha-ti" type="date" value="${fmtDate(a.fecha_recepcion_ti)}" style="width:100%" disabled>
          </div>
        </div>
      </div>

      <!-- Origen -->
      <div class="modal-section">
        <h4>Origen</h4>
        <div class="iv-grid" id="ed-origen-contenedor">
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
            <input id="ed-fecha-compra" type="date" value="${fmtDate(a.fecha_compra)}" style="width:100%" disabled>
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
            <textarea id="ed-caracteristicas" rows="2" style="width:100%" disabled>${a.caracteristicas || ''}</textarea>
          </div>
          <div class="item" style="grid-column: 1 / -1;">
            <strong>Notas:</strong>
            <textarea id="ed-notas" rows="2" style="width:100%" disabled>${a.notas || ''}</textarea>
          </div>
        </div>
      </div>

      <!-- Inspección Visual -->
      <div class="modal-section">
        <h4>Inspección Visual</h4>
        <div class="iv-grid" id="ed-iv-contenedor">
          ${renderIVCheck('Daños en Carcasa', a.iv_carcasa, 'ed-iv-carcasa', true)}
          ${renderIVCheck('Daños en el Teclado', a.iv_teclado, 'ed-iv-teclado', true)}
          ${renderIVCheck('Pantalla Rota', a.iv_pantalla, 'ed-iv-pantalla', true)}
          ${renderIVCheck('Puertos Dañados', a.iv_puertos, 'ed-iv-puertos', true)}
          ${renderIVCheck('Con Cargador', a.iv_cargador, 'ed-iv-cargador', true)}
          ${renderIVCheck('Sin daños visibles', a.iv_sin_danos, 'ed-iv-sin-danos', true)}
          <div class="iv-otro" style="grid-column: 1 / -1;">
            <strong>Otro:</strong>
            <input id="ed-iv-otro" type="text" value="${a.iv_otro || ''}" style="width:100%" disabled>
          </div>
        </div>
      </div>

      <!-- Barra de edición completa -->
      <div class="modal-edit" id="edit-barra">
        <button id="btn-editar-activo" class="btn-guardar" type="button">Editar Activo</button>
        <button id="btn-guardar-cambios" class="btn-guardar" type="button" style="display:none;">Guardar Cambios</button>
        <button id="btn-cancelar-edicion" class="btn-guardar" type="button" style="display:none;background:#777;">Cancelar</button>
      </div>
    `;
    // =====================================

    // Aseguramos que el select tenga todas las opciones
    ensureEstadoOptions(combo);

    // Sincronizamos el espejo de estado en la sección "Información"
    const estadoLimpio = (a.estado || '').trim();
    const permitidos = [
      'Tránsito','Pendiente','Proceso',
      'Por Retirar','Asignado','Reasignado','Reciclaje','Vendido',
      'Disponible','Préstamo','Repuesto','Donar'
    ];
    combo.value = permitidos.includes(estadoLimpio) ? estadoLimpio : 'Tránsito';
    const estadoMirror = document.getElementById('ed-estado-mirror');
    combo.addEventListener('change', () => {
      if (estadoMirror) estadoMirror.value = combo.value;
    });

    // Guardar SOLO cambios de Estado (flujo existente tuyo)
    btnGuardarEstado.onclick = async () => {
      try {
        const nuevo = combo.value;
        const r = await fetch(`/api/activos/${id}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevo })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.ok === false) throw new Error(j.msg || 'No se pudo actualizar');
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('No se pudo actualizar el estado.');
      }
    };

    // ====== LÓGICA DE EDICIÓN COMPLETA ======
    const btnEditar = document.getElementById('btn-editar-activo');
    const btnGuardarCambios = document.getElementById('btn-guardar-cambios');
    const btnCancelar = document.getElementById('btn-cancelar-edicion');

    const camposHabilitables = [
      '#ed-numero','#ed-categoria','#ed-ticket','#ed-anios',
      '#ed-remitente','#ed-fecha-ti','#ed-fecha-compra',
      '#ed-caracteristicas','#ed-notas','#ed-iv-otro'
    ];

    function setEditable(enabled) {
      camposHabilitables.forEach(sel => {
        const el = caja.querySelector(sel);
        if (el) el.disabled = !enabled;
      });
      // Checkboxes IV
      ['#ed-iv-carcasa','#ed-iv-teclado','#ed-iv-pantalla','#ed-iv-puertos','#ed-iv-cargador','#ed-iv-sin-danos'].forEach(sel=>{
        const el = caja.querySelector(sel);
        if (el) el.disabled = !enabled;
      });
      // Origen: permitir solo 1 marcado (exclusivo)
      const origenChecks = caja.querySelectorAll('.edit-origen');
      origenChecks.forEach(chk=>{
        chk.disabled = !enabled;
        chk.addEventListener('change', (e)=>{
          if (!e.target.checked) return;
          origenChecks.forEach(o => { if (o !== e.target) o.checked = false; });
        });
      });

      // Botones
      btnEditar.style.display = enabled ? 'none' : '';
      btnGuardarCambios.style.display = enabled ? '' : 'none';
      btnCancelar.style.display = enabled ? '' : 'none';
    }

    btnEditar.addEventListener('click', () => setEditable(true));
    btnCancelar.addEventListener('click', () => setEditable(false));

    btnGuardarCambios.addEventListener('click', async () => {
      try {
        // tomar valores
        const origenSel = (() => {
          const o = caja.querySelector('.edit-origen:checked');
          return o ? o.value : null;
        })();

        const payload = {
          numero_activo: (caja.querySelector('#ed-numero')?.value || '').trim(),
          categoria: (caja.querySelector('#ed-categoria')?.value || '').trim(),
          ticket: (caja.querySelector('#ed-ticket')?.value || '').trim(),
          anios: parseInt(caja.querySelector('#ed-anios')?.value || '0', 10) || null,
          remitente_nombre: (caja.querySelector('#ed-remitente')?.value || '').trim(),
          fecha_recepcion_ti: caja.querySelector('#ed-fecha-ti')?.value || null,
          origen: origenSel,
          fecha_compra: caja.querySelector('#ed-fecha-compra')?.value || null,
          caracteristicas: (caja.querySelector('#ed-caracteristicas')?.value || '').trim(),
          notas: (caja.querySelector('#ed-notas')?.value || '').trim(),
          // Estado se toma desde el combo superior (y actualizará fase por trigger)
          estado: combo.value,
          // IV
          iv_carcasa: !!caja.querySelector('#ed-iv-carcasa')?.checked,
          iv_teclado: !!caja.querySelector('#ed-iv-teclado')?.checked,
          iv_pantalla: !!caja.querySelector('#ed-iv-pantalla')?.checked,
          iv_puertos: !!caja.querySelector('#ed-iv-puertos')?.checked,
          iv_cargador: !!caja.querySelector('#ed-iv-cargador')?.checked,
          iv_sin_danos: !!caja.querySelector('#ed-iv-sin-danos')?.checked,
          iv_otro: (caja.querySelector('#ed-iv-otro')?.value || '').trim()
        };

        const r = await fetch(`/api/activos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await r.json().catch(()=>({}));
        if (!r.ok || j.ok === false) throw new Error(j.msg || 'No se pudo guardar los cambios');

        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('No se pudo guardar los cambios.');
      }
    });

    // ====== cargar reportes y mostrar con el MISMO DISEÑO del reporte ======
    try {
      const eyeBtn = document.getElementById('rep-eye');
      const panel = document.getElementById('rep-panel');
      const contRep = document.getElementById('rep-contenido');

      // Traer todos los reportes del activo
      const rs = await fetch(`/api/reportes-tecnicos?activo_id=${encodeURIComponent(a.id)}`);
      const reportes = await rs.json();

      if (Array.isArray(reportes) && reportes.length > 0) {
        // Mostrar el OJO
        eyeBtn.style.display = 'inline-flex';

        // Helper para checkbox deshabilitado con el mismo look
        const cb = (checked) => `<input type="checkbox" ${checked ? 'checked' : ''} disabled>`;

        // Render acordeón con detalles y fieldsets iguales al reporte
        contRep.innerHTML = reportes.map((r, idx) => {
          const titulo = `Reporte #${r.id || (reportes.length - idx)}${r.estado_final ? ' — ' + r.estado_final : ''}`;

          return `
            <details class="rep-item">
              <summary>${titulo}</summary>
              <div class="rep-body">

                <!-- Bloque: Evaluación Inicial (idéntico a reporte) -->
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

                <!-- Bloque: Preparación (idéntico a reporte) -->
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

                <!-- Bloque: Mejora (upgrade) -->
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

                <!-- Bloque: Conclusión y Recomendaciones -->
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

        // Toggle del panel con el OJO
        let abierto = false;
        eyeBtn.addEventListener('click', () => {
          abierto = !abierto;
          eyeBtn.classList.toggle('open', abierto);
          panel.classList.toggle('hidden', !abierto);
        });
      } else {
        // No hay reportes: el ojo NO aparece
        eyeBtn.style.display = 'none';
      }
    } catch (e) {
      console.error('Error cargando reportes del activo:', e);
    }

    // Mostrar modal
    overlay.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('No se pudo cargar el detalle.');
  }
}
