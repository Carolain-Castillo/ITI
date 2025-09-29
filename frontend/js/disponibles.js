// frontend/js/disponibles.js
document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('boxd-tbody');
  const totalEl = document.getElementById('boxd-total');
  if (!tbody || !totalEl) return;

  // Colores por categoría (aprox. como tu ejemplo)
  const catPalette = {
    'Administrativo': { bg:'#3b6cf2', fg:'#fff' },
    'Ejecutivo':      { bg:'#ff9800', fg:'#111' },
    'CAD':            { bg:'#ffc107', fg:'#111' },
    'BIM':            { bg:'#27ae60', fg:'#fff' },
    'Cámaras':        { bg:'#9c27b0', fg:'#fff' },
    'Celulares':      { bg:'#795548', fg:'#fff' },
    'Monitores':      { bg:'#673ab7', fg:'#fff' },
    'Router':         { bg:'#607d8b', fg:'#fff' },
    'Tablets':        { bg:'#26a69a', fg:'#fff' },
    'Proyector':      { bg:'#00bcd4', fg:'#111' },
    'BAM':            { bg:'#8bc34a', fg:'#111' },
    'Impresora':      { bg:'#e91e63', fg:'#fff' },
    'Servidor':       { bg:'#009688', fg:'#fff' },
    'UPS':            { bg:'#ff5722', fg:'#fff' },
    'Plotter':        { bg:'#4caf50', fg:'#fff' }
  };

  const colorFor = (cat) => catPalette[cat] || { bg:'#eeeeee', fg:'#222' };

  try {
    // Usamos el mismo endpoint de resumen, ahora con filtro de estado.
    const resp = await fetch('/api/resumen?estado=' + encodeURIComponent('Disponible'));
    const data = await resp.json();

    let total = 0;
    if (Array.isArray(data) && data.length) {
      tbody.innerHTML = data.map(row => {
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
  } catch (e) {
    console.error('No se pudo cargar el resumen de disponibles:', e);
  }
});
