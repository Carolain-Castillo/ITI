// frontend/js/salidas.js

// Cargar la columna "Salida" con los activos de la fase "Salida"
// (Por Retirar, Asignado, Reasignado, Reciclaje, Vendido)
document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('salida-lista');
  if (!cont) return; // si no existe el contenedor, no hacemos nada

  await cargarSalida(cont);

  // Prepara el modal compartido (si ya está listo en otros scripts, no pasa nada)
  if (typeof prepararModal === 'function') {
    prepararModal();
  }

  // Aplicar filtros si ya hay algo seleccionado
  window.aplicarFiltrosTablero?.();
});

async function cargarSalida(cont) {
  try {
    const url = `/api/activos?fase=${encodeURIComponent('Salida')}&_=${Date.now()}`;
    const resp = await fetch(url);
    let items = await resp.json();

    if (!Array.isArray(items)) items = [];

    // >>> Contador
    const countEl = document.getElementById('salida-count');
    if (countEl) countEl.textContent = String(items.length);
    // <<<

    cont.innerHTML = '';
    if (items.length === 0) return;

    items.forEach(it => {
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

      // Reutiliza el mismo modal y función abrirDetalle definida en entrada.js
      row.addEventListener('click', () => {
        if (typeof abrirDetalle === 'function') {
          abrirDetalle(it.id);
        } else {
          console.warn('abrirDetalle no está disponible aún.');
        }
      });

      cont.appendChild(row);
    });

    // Reaplicar filtros tras renderizar
    window.aplicarFiltrosTablero?.();
  } catch (err) {
    console.error('No se pudo cargar "Salida"', err);
  }
}
