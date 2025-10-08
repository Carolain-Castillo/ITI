// frontend/js/disponibles.js
document.addEventListener('DOMContentLoaded', async () => {
  const tbody   = document.getElementById('boxd-tbody');
  const totalEl = document.getElementById('boxd-total');
  if (!tbody || !totalEl) return;

  // === Colores iguales a "Distribución de Activos" ===
  // Trae el mismo set de categorías y genera la misma paleta que usa el gráfico
  async function buildChartColorMap() {
    try {
      const r = await fetch('/api/resumen'); // mismo endpoint del gráfico (sin filtro)
      const arr = await r.json();
      const labels = Array.isArray(arr) ? arr.map(d => d.categoria) : [];
      const n = Math.max(labels.length, 1);

      
      const bg = [];
      for (let i = 0; i < n; i++) {
        const hue = Math.round((360 / n) * i);
        bg.push(`hsl(${hue} 70% 55%)`);
      }

      // mapa categoría → color
      const map = new Map();
      labels.forEach((cat, i) => map.set(cat, bg[i]));
      return map;
    } catch (e) {
      console.error('No se pudo construir el mapa de colores del gráfico:', e);
      return new Map();
    }
  }

  const chartColorMap = await buildChartColorMap();
  const colorFor = (cat) => {
    const bg = chartColorMap.get(cat) || '#eeeeee';
    // Texto blanco para buen contraste con la paleta HSL usada
    return { bg, fg: '#fff' };
  };

  // Orden deseado para que queden visibles primero
  const priorityOrder = { 'Administrativo':0, 'Ejecutivo':1, 'CAD':2, 'BIM':3 };
  const prio = (cat) => (cat in priorityOrder) ? priorityOrder[cat] : 999;

  try {
    // Resumen filtrado por estado Disponible
    const resp = await fetch('/api/resumen?estado=' + encodeURIComponent('Disponible'));
    const data = await resp.json();

    // Ordenamos para que los 4 de interés queden arriba
    const rows = Array.isArray(data) ? [...data] : [];
    rows.sort((a, b) => {
      const pa = prio(a.categoria), pb = prio(b.categoria);
      if (pa !== pb) return pa - pb;
      return String(a.categoria).localeCompare(String(b.categoria));
    });

    // Render
    let total = 0;
    if (rows.length) {
      tbody.innerHTML = rows.map(row => {
        const n = Number(row.cantidad) || 0;
        total += n;
        const { bg, fg } = colorFor(row.categoria);
        return `
          <tr>
            <td class="cat" style="background:${bg};color:${fg}">${row.categoria}</td>
            <td class="num">${n}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td class="cat" style="background:#eeeeee;color:#222">—</td>
          <td class="num">0</td>
        </tr>`;
    }
    totalEl.textContent = String(total);

    // === Scroll: envolver la TABLA completa (no el tbody) para no desalinear encabezado ===
    const table = tbody.closest('table');       // usamos la tabla que contiene ese tbody
    if (table && !document.getElementById('boxd-scroll-wrap')) {
      const wrap = document.createElement('div');
      wrap.id = 'boxd-scroll-wrap';
      wrap.style.overflowY = 'auto';
      wrap.style.overflowX = 'hidden';
      wrap.style.width = '100%';

      // Insertar el wrapper y mover la tabla adentro
      const parent = table.parentElement;
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);


      // Dejar el thead fijo (sticky) para que no baje con el scroll
      const thead = table.querySelector('thead');
      if (thead) {
        thead.style.position = 'sticky';
        thead.style.top = '0';          // pegado arriba del contenedor con scroll
        thead.style.zIndex = '3';       // por encima de las filas
        
        thead.style.background = thead.style.background || '#d33';
      }


      // Calcular alto = encabezado + 4 filas
      requestAnimationFrame(() => {
        const thead = table.querySelector('thead');
        const headerH = thead ? thead.offsetHeight : 0;
        const firstRow = tbody.querySelector('tr');
        const rowH = firstRow ? firstRow.offsetHeight : 36;  // fallback
        const maxH = headerH + (rowH * 6);
        wrap.style.maxHeight = maxH + 'px';
      });

      // Recalcular si cambia el tamaño (opcional, por si hay fuentes responsivas)
      window.addEventListener('resize', () => {
        const thead = table.querySelector('thead');
        const headerH = thead ? thead.offsetHeight : 0;
        const firstRow = tbody.querySelector('tr');
        const rowH = firstRow ? firstRow.offsetHeight : 36;
        wrap.style.maxHeight = (headerH + rowH * 4) + 'px';
      });
    }
  } catch (e) {
    console.error('No se pudo cargar el resumen de disponibles:', e);
  }
});
