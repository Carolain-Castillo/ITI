// frontend/js/proceso.js
document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('proceso-lista');
  if (!cont) return;

  // Cargamos "En Proceso": fase "En Proceso" (estado Proceso)
  await cargarEnProceso(cont);

  // Prepara el mismo modal que usa Entrada (si ya está, no pasa nada)
  if (typeof prepararModal === 'function') {
    prepararModal();
  }

  // Aplicar filtros si ya hay algo seleccionado
  window.aplicarFiltrosTablero?.();
});

async function cargarEnProceso(cont) {
  try {
    const url = `/api/activos?fase=${encodeURIComponent('En Proceso')}&_=${Date.now()}`;
    const resp = await fetch(url);
    let items = await resp.json();

    if (!Array.isArray(items)) items = [];

    // >>> Contador
    const countEl = document.getElementById('proceso-count');
    if (countEl) countEl.textContent = String(items.length);
    // <<<

    cont.innerHTML = '';
    if (items.length === 0) return;

    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'activo-datos';
      row.dataset.id = it.id;       // necesario para abrir el detalle
      row.dataset.categoria = it.categoria || '';
      row.dataset.estado = (it.estado || '').trim();
      row.style.cursor = 'pointer';
      row.title = 'Ver detalle';

      // Mantenemos 3 columnas. El botón va dentro de la 3ª celda.
      row.innerHTML = `
        <span>${it.numero}</span>
        <span>${it.categoria}</span>
        <span style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <span>${(it.estado || '').trim()}</span>
          <button class="btn-reporte" title="Abrir reporte técnico"
            style="padding:4px 8px;border:1px solid #7b2325;background:#7b2325;color:#fff;border-radius:4px;cursor:pointer;">
            Reporte
          </button>
        </span>
      `;

      // Click de fila: abre modal detalle (igual que Entrada)
      row.addEventListener('click', () => {
        if (typeof abrirDetalle === 'function') {
          abrirDetalle(it.id);
        } else {
          console.warn('abrirDetalle no está disponible aún.');
        }
      });

      // Click del botón: ir a reporte_tecnico con el número en la URL
      const btn = row.querySelector('.btn-reporte');
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation(); // para que no abra el modal
        window.location.href = `reporte_tecnico.html?numero=${encodeURIComponent(it.numero)}`;
      });

      cont.appendChild(row);
    });

    // Reaplicar filtros tras renderizar
    window.aplicarFiltrosTablero?.();
  } catch (err) {
    console.error('No se pudo cargar "En Proceso"', err);
  }
}
