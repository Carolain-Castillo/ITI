// frontend/js/salidas_registro.js
// SOLO para registro-salidas.html

document.addEventListener('DOMContentLoaded', async () => {
  const cont = document.getElementById('salida-lista');
  if (!cont) return;

  await cargarSalidaRegistro(cont);
  setInterval(() => cargarSalidaRegistro(cont), 5000);
});

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d);
  if (s.includes('T')) return s.split('T')[0];
  return s;
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
      // Tarjeta única con encabezado (N°/Categoría/Estado) + detalles
      const card = document.createElement('div');
      card.className = 'salida-card';
      card.style.margin = '8px 0 12px';
      card.style.background = '#fff';
      card.style.border = '1px solid #e6e6e6';
      card.style.borderRadius = '6px';
      card.style.overflow = 'hidden';

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

      // Cuerpo con los detalles
      const body = document.createElement('div');
      body.className = 'salida-card-body';
      body.style.padding = '8px 10px';
      body.style.fontSize = '.95rem';
      body.style.lineHeight = '1.35';
      body.textContent = 'Cargando datos…';

      // Traer detalle del activo
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
            <div style="grid-column:1 / -1;"><strong>Características:</strong> ${a.caracteristicas || '—'}</div>
            <div style="grid-column:1 / -1;"><strong>Notas:</strong> ${a.notas || '—'}</div>
          </div>
        `;
      } catch (e) {
        console.error(e);
        body.textContent = 'No se pudo cargar la información del activo.';
      }

      card.appendChild(header);
      card.appendChild(body);
      cont.appendChild(card);
    }
  } catch (err) {
    console.error('No se pudo cargar "Salida" (registro-salidas)', err);
  }
}
