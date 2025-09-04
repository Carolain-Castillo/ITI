//js/entrada.js

document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('entrada-lista');
  if (!cont) return;

  // Cargar lista ENTRADA (fase Entrada: Tránsito o Pendiente)
  await cargarEntrada(cont);

  // Preparar modal (compartido con otras columnas)
  prepararModal();
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
function renderIVCheck(label, value) {
  const checked = value ? 'checked' : '';
  return `
    <label class="iv-check">
      <input type="checkbox" ${checked} disabled>
      <span>${label}</span>
    </label>
  `;
}

// Render de un checkbox de Origen, marcado si coincide con el valor en BD
function renderOrigenCheck(label, origenDb) {
  const checked = ((origenDb || '').trim() === label) ? 'checked' : '';
  return `
    <label class="iv-check">
      <input type="checkbox" ${checked} disabled>
      <span>${label}</span>
    </label>
  `;
}

// Formatea fecha YYYY-MM-DD si viene con hora tipo ISO
function fmtDate(d) {
  if (!d) return '—';
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
  const btnGuardar = document.getElementById('modal-guardar');

  if (!overlay || !caja || !combo || !btnGuardar) return;

  try {
    const resp = await fetch(`/api/activos/${id}`);
    if (!resp.ok) throw new Error('No se pudo obtener el detalle');
    const a = await resp.json();

    const fmt = (v) => (v ? v : '—');

    // ======== CONTENIDO DEL MODAL ========
    caja.innerHTML = `
      <!-- Información de Activo -->
      <div class="modal-section">
        <h4>Información de Activo</h4>
        <div class="grid">
          <div class="item"><strong>N° Activo:</strong> ${fmt(a.numero_activo)}</div>
          <div class="item"><strong>Categoría:</strong> ${fmt(a.categoria)}</div>
          <div class="item"><strong>Estado actual:</strong> ${fmt(a.estado)}</div>
          <div class="item"><strong>Fase:</strong> ${fmt(a.fase)}</div>
          <div class="item"><strong>Ticket:</strong> ${fmt(a.ticket)}</div>
          <div class="item"><strong>Años:</strong> ${fmt(a.anios)}</div>
        </div>
      </div>

      <!-- Remitente -->
      <div class="modal-section">
        <h4>Remitente</h4>
        <div class="grid">
          <div class="item"><strong>Remitente:</strong> ${fmt(a.remitente_nombre)}</div>
          <div class="item"><strong>Recepción TI:</strong> ${fmtDate(a.fecha_recepcion_ti)}</div>
        </div>
      </div>

      <!-- Origen -->
      <div class="modal-section">
        <h4>Origen</h4>
        <div class="iv-grid">
          ${renderOrigenCheck('Desmovilización', a.origen)}
          ${renderOrigenCheck('Nuevo', a.origen)}
          ${renderOrigenCheck('Mesa de ayuda', a.origen)}
          ${renderOrigenCheck('Usuario directo', a.origen)}
        </div>
      </div>

      <!-- Fechas -->
      <div class="modal-section">
        <h4>Fechas</h4>
        <div class="grid">
          <div class="item"><strong>Fecha compra:</strong> ${fmtDate(a.fecha_compra)}</div>
          <div class="item"><strong>Creado:</strong> ${fmtDate(a.created_at)}</div>
        </div>
      </div>

      <!-- Características / Notas -->
      <div class="modal-section">
        <h4>Características y Notas</h4>
        <div class="grid">
          <div class="item" style="grid-column: 1 / -1;"><strong>Características:</strong> ${fmt(a.caracteristicas)}</div>
          <div class="item" style="grid-column: 1 / -1;"><strong>Notas:</strong> ${fmt(a.notas)}</div>
        </div>
      </div>

      <!-- Inspección Visual -->
      <div class="modal-section">
        <h4>Inspección Visual</h4>
        <div class="iv-grid">
          ${renderIVCheck('Daños en Carcasa', a.iv_carcasa)}
          ${renderIVCheck('Daños en el Teclado', a.iv_teclado)}
          ${renderIVCheck('Pantalla Rota', a.iv_pantalla)}
          ${renderIVCheck('Puertos Dañados', a.iv_puertos)}
          ${renderIVCheck('Con Cargador', a.iv_cargador)}
          ${renderIVCheck('Sin daños visibles', a.iv_sin_danos)}
          <div class="iv-otro"><strong>Otro:</strong> ${fmt(a.iv_otro)}</div>
        </div>
      </div>
    `;
    // =====================================

    // Aseguramos que el select tenga todas las opciones
    ensureEstadoOptions(combo);

    // Seleccionamos el estado actual si está en la lista, si no, por defecto "Tránsito"
    const estadoLimpio = (a.estado || '').trim();
    const permitidos = [
      'Tránsito','Pendiente','Proceso',
      'Por Retirar','Asignado','Reasignado','Reciclaje','Vendido',
      'Disponible','Préstamo','Repuesto','Donar'
    ];
    combo.value = permitidos.includes(estadoLimpio) ? estadoLimpio : 'Tránsito';

    // Guardar cambios de Estado
    btnGuardar.onclick = async () => {
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

    overlay.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('No se pudo cargar el detalle.');
  }
}
