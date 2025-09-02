// frontend/js/resumen.js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const tbody = document.querySelector('.resumen table tbody');
    const sel   = document.getElementById('resumen-select');
    const btn   = document.getElementById('resumen-filtrar');

    if (!tbody) return;

    // Carga del resumen por categoría
    const resp = await fetch('/api/resumen'); // todas las fases
    const data = await resp.json();

    // Limpiamos y rellenamos filas reales
    tbody.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
      // Si no hay datos, no agregamos filas (la tabla queda vacía)
      // y dejamos el select vacío
      if (sel) sel.innerHTML = '<option value="">— Sin categorías —</option>';
      return;
    }

    // Poblar tabla y preparar botón "Ir" para abrir modal con la categoría
    data.forEach(item => {
      const tr = document.createElement('tr');

      const tdCat = document.createElement('td');
      tdCat.textContent = item.categoria;

      const tdCant = document.createElement('td');
      tdCant.textContent = item.cantidad;

      const tdBtn = document.createElement('td');
      const go = document.createElement('button');
      go.textContent = 'Ir';
      go.addEventListener('click', () => abrirModalCategoria(item.categoria));
      tdBtn.appendChild(go);

      tr.appendChild(tdCat);
      tr.appendChild(tdCant);
      tr.appendChild(tdBtn);
      tbody.appendChild(tr);
    });

    // Poblar SELECT del filtro
    if (sel) {
      sel.innerHTML = [
        '<option value="" selected>— Selecciona —</option>',
        ...data.map(d => `<option value="${escapeHtml(d.categoria)}">${escapeHtml(d.categoria)}</option>`)
      ].join('');
    }

    // Acción del botón "Ver"
    btn?.addEventListener('click', () => {
      const cat = sel?.value || '';
      if (!cat) return;
      abrirModalCategoria(cat);
    });

    prepararModalFiltro();
  } catch (err) {
    console.error('Error cargando resumen:', err);
  }
});

// ================================================
// Modal de listado por categoría (nuevo)
// ================================================
function prepararModalFiltro() {
  const overlay = document.getElementById('filtro-modal');
  const btnCerrar = document.getElementById('filtro-cerrar');
  if (!overlay || !btnCerrar) return;

  btnCerrar.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

async function abrirModalCategoria(categoria) {
  const overlay = document.getElementById('filtro-modal');
  const titulo  = document.getElementById('filtro-titulo');
  const cont    = document.getElementById('filtro-contenido');
  if (!overlay || !titulo || !cont) return;

  titulo.textContent = `Activos - ${categoria}`;

  try {
    // Tomamos todos los activos y filtramos por categoría en el cliente,
    // para no depender de cambios en el backend.
    const resp = await fetch('/api/activos?_=' + Date.now());
    let items = await resp.json();
    items = Array.isArray(items) ? items : [];

    const lista = items.filter(a => (a.categoria || '').trim() === categoria);

    // Render simple tipo tabla
    if (lista.length === 0) {
      cont.innerHTML = `<p>No hay activos para <strong>${escapeHtml(categoria)}</strong>.</p>`;
    } else {
      // Usamos el mismo estilo de tabla de la página
      const rows = lista.map(a => `
        <tr>
          <td>${escapeHtml(a.numero)}</td>
          <td>${escapeHtml(a.categoria || '')}</td>
          <td>${escapeHtml((a.estado || '').trim())}</td>
          <td>${escapeHtml(a.origen || '')}</td>
        </tr>
      `).join('');

      cont.innerHTML = `
        <div class="tabla-scroll" style="max-height:350px;">
          <table>
            <thead>
              <tr>
                <th>N° Activo</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    overlay.classList.remove('hidden');
  } catch (err) {
    console.error('Error al abrir listado de categoría:', err);
    cont.innerHTML = `<p>Ocurrió un error al cargar los activos.</p>`;
    overlay.classList.remove('hidden');
  }
}

// Utilidad pequeña para evitar HTML injection en textos
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
