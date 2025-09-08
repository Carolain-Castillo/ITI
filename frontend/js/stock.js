// Cargar la columna "Stock Activos" con estados: Disponible, Préstamo, Repuesto, Donar
document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('stock-lista');
  if (!cont) return;

  await cargarStock(cont);

  if (typeof prepararModal === 'function') {
    prepararModal();
  }

  // Aplicar filtros si ya hay algo seleccionado
  window.aplicarFiltrosTablero?.();
});

async function cargarStock(cont) {
  try {
    // Para no tocar backend, traemos todo (limit 100) y filtramos en el cliente
    const url = `/api/activos?_=${Date.now()}`;
    const resp = await fetch(url);
    let items = await resp.json();
    if (!Array.isArray(items)) items = [];

    const objetivo = new Set(['disponible','préstamo','prestamo','repuesto','donar']);
    const filtrados = items.filter(it => objetivo.has((it.estado || '').trim().toLowerCase()));

    // Contador
    const countEl = document.getElementById('stock-count');
    if (countEl) countEl.textContent = String(filtrados.length);

    cont.innerHTML = '';
    if (filtrados.length === 0) return;

    filtrados.forEach(it => {
      const row = document.createElement('div');
      row.className = 'activo-datos';
      row.dataset.id = it.id;
      row.dataset.categoria = it.categoria || '';
      row.dataset.estado = (it.estado || '').trim();
      row.style.cursor = 'pointer';
      row.title = 'Ver detalle';

      row.innerHTML = `
        <span>${it.numero}</span>
        <span>${it.categoria}</span>
        <span>${(it.estado || '').trim()}</span>
      `;

      row.addEventListener('click', () => {
        if (typeof abrirDetalle === 'function') {
          abrirDetalle(it.id);
        }
      });

      cont.appendChild(row);
    });

    // Reaplicar filtros tras renderizar
    window.aplicarFiltrosTablero?.();
  } catch (err) {
    console.error('No se pudo cargar "Stock Activos"', err);
  }
}
