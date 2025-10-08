// frontend/js/resumen.js
// Manejo de la tabla resumen con paginación estilo Gmail
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const tbody = document.querySelector('.resumen table tbody');
    const pager = document.getElementById('resumen-pager');
    const btnPrev = document.getElementById('res-pager-prev');
    const btnNext = document.getElementById('res-pager-next');
    const lblRange = document.getElementById('res-pager-range');

    if (!tbody) return;

    // Carga del resumen por categoría (conteos)
    const resp = await fetch('/api/resumen'); // todas las fases
    const data = await resp.json();

    // Si no hay datos, dejamos tabla vacía y ocultamos la paginación
    tbody.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
      if (pager) pager.style.display = 'none';
      return;
    }

    // ---------- Paginación estilo Gmail ----------
    const PAGE_SIZE = 4;
    let currentPage = 1; // 1-indexed
    const totalRows = data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

    function renderPage() {
      // límites de la página actual
      const startIdx = (currentPage - 1) * PAGE_SIZE;         // 0-index
      const endIdxExcl = Math.min(startIdx + PAGE_SIZE, totalRows);

      // Rellenar filas visibles
      tbody.innerHTML = '';
      for (let i = startIdx; i < endIdxExcl; i++) {
        const item = data[i];
        const tr = document.createElement('tr');

        const tdCat = document.createElement('td');
        tdCat.textContent = item.categoria;

        const tdCant = document.createElement('td');
        tdCant.textContent = item.cantidad;

        tr.appendChild(tdCat);
        tr.appendChild(tdCant);
        tbody.appendChild(tr);
      }

      // Actualizar barra "1–4 de 55"
      if (lblRange) {
        const humanStart = startIdx + 1;
        const humanEnd = endIdxExcl;
        lblRange.textContent = `${humanStart}–${humanEnd} de ${totalRows}`;
      }

      // Habilitar/Deshabilitar flechas
      if (btnPrev) btnPrev.disabled = currentPage <= 1;
      if (btnNext) btnNext.disabled = currentPage >= totalPages;

      // Mostrar/ocultar pager si no hace falta
      if (pager) pager.style.display = totalRows > PAGE_SIZE ? '' : 'flex';
    }

    // Listeners de flechas
    btnPrev?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      }
    });
    btnNext?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderPage();
      }
    });

    // Primera renderización
    renderPage();

    // Modal 
    prepararModalFiltro();
  } catch (err) {
    console.error('Error cargando resumen:', err);
  }
});

// ================================================
// Modal y helpers (se mantienen por compatibilidad)
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

// Normaliza tildes y mayúsculas para comparar estados/categorías
function normalizeTxt(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Mantengo estas funciones por si decides reactivar modales más adelante
async function abrirModalCategoria(categoria) {
  await abrirModalCatEstado(categoria, '');
}

async function abrirModalCatEstado(categoria, estado) {
  const overlay = document.getElementById('filtro-modal');
  const titulo  = document.getElementById('filtro-titulo');
  const cont    = document.getElementById('filtro-contenido');
  if (!overlay || !titulo || !cont) return;

  const catTxt = categoria ? categoria : 'Todas las categorías';
  const estTxt = estado ? estado : 'Todos los estados';
  titulo.textContent = `Activos — ${catTxt} — ${estTxt}`;

  try {
    const resp = await fetch('/api/activos?_=' + Date.now());
    let items = await resp.json();
    items = Array.isArray(items) ? items : [];

    let lista = items;

    if (categoria) {
      const nCat = normalizeTxt(categoria);
      lista = lista.filter(a => normalizeTxt(a.categoria) === nCat);
    }

    if (estado) {
      const nEst = normalizeTxt(estado);
      lista = lista.filter(a => normalizeTxt((a.estado || '')) === nEst);
    }

    if (lista.length === 0) {
      cont.innerHTML = `<p>No hay activos para <strong>${escapeHtml(catTxt)}</strong> y <strong>${escapeHtml(estTxt)}</strong>.</p>`;
    } else {
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
    console.error('Error al abrir listado filtrado:', err);
    cont.innerHTML = `<p>Ocurrió un error al cargar los activos.</p>`;
    overlay.classList.remove('hidden');
  }
}

// Utilidad para evitar HTML injection
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
