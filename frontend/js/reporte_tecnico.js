// js/reporte_tecnico.js
// ===============================
// BÚSQUEDA Y AUTOCOMPLETADO
// ===============================
const $ = (sel) => document.querySelector(sel);
const numeroInput      = $('#rt-numero');
const btnBuscar        = $('#rt-buscar');

const outCategoria       = $('#rt-categoria');
const outEstado          = $('#rt-estado');
const outRemitente       = $('#rt-remitente');
const outFechaRecep      = $('#rt-fecha-recepcion');
const outTicket          = $('#rt-ticket');
const outOrigen          = $('#rt-origen');
const outCaracteristicas = $('#rt-caracteristicas');
const outNotas           = $('#rt-notas');

//salida de solo lectura para que aparezca en el PDF
const outNumeroView     = $('#rt-numero-view');


// 🔹 NUEVO: refs Inspección Visual (solo lectura)
const ivCarcasa   = $('#iv_carcasa');
const ivTeclado   = $('#iv_teclado');
const ivPantalla  = $('#iv_pantalla');
const ivPuertos   = $('#iv_puertos');
const ivCargador  = $('#iv_cargador');
const ivSinDanos  = $('#iv_sin_danos');
const ivOtro      = $('#iv_otro');



// IDs existentes para "Estado" y "Upgrade"
const parteSi = document.getElementById('parteSi');
const parteNo = document.getElementById('parteNo');
const detalleParte = document.getElementById('detalleParte');

const estadoDisponible = document.getElementById('estadoDisponible');
const estadoReciclar   = document.getElementById('estadoReciclar');
const estadoPrestamo   = document.getElementById('estadoPrestamo');

const conclusionEl = document.getElementById('conclusion');

// Botón Exportar PDF
const btnExportarPdf = document.getElementById('rt-exportar-pdf');

// ===== Modal "Reporte Guardado" =====
const modalGuardado      = document.getElementById('rt-guardado-modal');
const modalGuardadoOk    = document.getElementById('rt-guardado-ok');
const modalGuardadoClose = document.getElementById('rt-guardado-cerrar');

function abrirModalGuardado(){
  modalGuardado?.classList.remove('rt-hidden');
  modalGuardadoOk?.focus();
}
function cerrarModalGuardado(){
  modalGuardado?.classList.add('rt-hidden');
}
modalGuardadoOk?.addEventListener('click', cerrarModalGuardado);
modalGuardadoClose?.addEventListener('click', cerrarModalGuardado);
modalGuardado?.addEventListener('click', (e)=>{ if(e.target === modalGuardado) cerrarModalGuardado(); });

// ===== Toast helper (auto-instalable, sin tocar HTML/CSS externos) =====
function ensureToast() {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.className = 'toast hidden';
    box.setAttribute('role','status');
    box.setAttribute('aria-live','polite');
    const span = document.createElement('span');
    span.id = 'toast-text';
    box.appendChild(span);
    document.body.appendChild(box);
  }
  // estilos mínimos si no existen
  if (!document.getElementById('rt-toast-styles')) {
    const st = document.createElement('style');
    st.id = 'rt-toast-styles';
    st.textContent = `
      .toast{
        position: fixed;
        left: 50%;
        top: 16px;
        transform: translateX(-50%);
        background: #e53935;
        color: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        box-shadow: 0 6px 18px rgba(0,0,0,.2);
        z-index: 2000;
        font-weight: 600;
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease, transform .2s ease;
      }
      .toast.show{
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }
      .hidden{ display:none; }
    `;
    document.head.appendChild(st);
  }
}

function showToast(msg) {
  ensureToast();
  const box = document.getElementById('toast');
  const txt = document.getElementById('toast-text');
  if (!box || !txt) return;
  txt.textContent = msg || '';
  box.classList.remove('hidden');
  box.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => box.classList.remove('show'), 3000);
}

// Referencias actuales
let currentActivoId = null;
let currentNumeroActivo = null;
let lastReporteId = null; 

const REQUIRED_MSG = 'Completa este campo';

function fmtDate(d) {
  if (!d) return '';
  const s = String(d);
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

function limpiarCamposActivo() {
  [outCategoria, outEstado, outRemitente, outFechaRecep, outTicket, outOrigen].forEach(el => { if (el) el.value = ''; });
  if (outCaracteristicas) outCaracteristicas.value = '';
  if (outNotas) outNotas.value = '';
  if (outNumeroView) outNumeroView.value = '';
  currentActivoId = null;
  currentNumeroActivo = null;
}

function limpiarFormularioReporteCompleto() {
  // Buscar
  if (numeroInput) numeroInput.value = '';
  limpiarCamposActivo();

  // Evaluación + Preparación
  document.querySelectorAll('.evaluacion-grid input[type="checkbox"], .preparacion-grid input[type="checkbox"]').forEach(ch => ch.checked = false);

  // Estado
  [estadoDisponible, estadoReciclar, estadoPrestamo].forEach(cb => { if (cb) cb.checked = false; });

  // Upgrade
  if (parteSi) parteSi.checked = false;
  if (parteNo) parteNo.checked = false;
  if (detalleParte) { detalleParte.value = ''; detalleParte.disabled = true; }

  // Conclusión
  if (conclusionEl) conclusionEl.value = '';

  // Reporte
  lastReporteId = null;
  if (btnExportarPdf) btnExportarPdf.disabled = true;
}

async function buscarYCompletar() {
  // limpiar mensaje de error del campo al intentar buscar
  if (numeroInput) numeroInput.setCustomValidity('');

  const numero = (numeroInput?.value || '').trim();
  
  if (!numero) {
    return; 
  }

  try {
    const resp = await fetch('/api/activos?_=' + Date.now());
    const lista = await resp.json();

    if (!Array.isArray(lista)) throw new Error('Respuesta inesperada');

    const item = lista.find(it => String(it.numero || '').trim().toLowerCase() === numero.toLowerCase());
    if (!item) {
      limpiarCamposActivo();
      showToast('No se encontró un activo con ese N°.');
      return;
    }

    const detResp = await fetch(`/api/activos/${item.id}`);
    if (!detResp.ok) throw new Error('No se pudo obtener el detalle del activo.');
    const a = await detResp.json();

    if (outCategoria)        outCategoria.value        = a.categoria || '';
    if (outEstado)           outEstado.value           = a.estado || '';
    if (outRemitente)        outRemitente.value        = a.remitente_nombre || '';
    if (outFechaRecep)       outFechaRecep.value       = fmtDate(a.fecha_recepcion_ti) || '';
    if (outTicket)           outTicket.value           = a.ticket || '';
    if (outOrigen)           outOrigen.value           = a.origen || '';
    if (outCaracteristicas)  outCaracteristicas.value  = a.caracteristicas || '';
    if (outNotas)            outNotas.value            = a.notas || '';


    // 🔹 NUEVO: Inspección Visual
    if (ivCarcasa)  ivCarcasa.checked  = !!a.iv_carcasa;
    if (ivTeclado)  ivTeclado.checked  = !!a.iv_teclado;
    if (ivPantalla) ivPantalla.checked = !!a.iv_pantalla;
    if (ivPuertos)  ivPuertos.checked  = !!a.iv_puertos;
    if (ivCargador) ivCargador.checked = !!a.iv_cargador;
    if (ivSinDanos) ivSinDanos.checked = !!a.iv_sin_danos;
    if (ivOtro)     ivOtro.value       = a.iv_otro || '';



    // Mostrar el número del activo si existe el campo de solo lectura
    currentNumeroActivo = (a.numero_activo || item.numero || numero).trim();
    if (outNumeroView) outNumeroView.value = currentNumeroActivo;

    currentActivoId = item.id;

    // como está todo ok, limpiar cualquier error previo del campo
    if (numeroInput) numeroInput.setCustomValidity('');
  } catch (err) {
    console.error(err);
    showToast('Ocurrió un error al buscar el activo.');
  }
}

btnBuscar?.addEventListener('click', buscarYCompletar);
numeroInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    buscarYCompletar();
  }
});
// si el usuario edita el campo, limpiamos el error
numeroInput?.addEventListener('input', () => numeroInput.setCustomValidity(''));

// ===============================
// LÓGICA EXISTENTE
// ===============================
function actualizarCampoParte() {
  if (parteSi && detalleParte) {
    if (parteSi.checked) {
      detalleParte.disabled = false;
    } else {
      detalleParte.disabled = true;
      detalleParte.value = '';
    }
  }
}

if (parteSi && parteNo) {
  parteSi.addEventListener('change', () => {
    if (parteSi.checked) parteNo.checked = false;
    actualizarCampoParte();
  });
  parteNo.addEventListener('change', () => {
    if (parteNo.checked) parteSi.checked = false;
    actualizarCampoParte();
  });
}

function seleccionarSoloUno(clicked) {
  [estadoDisponible, estadoReciclar, estadoPrestamo].forEach(cb => {
    if (cb && cb !== clicked) cb.checked = false;
  });
  // Si el usuario selecciona alguno, limpiamos mensaje de requerido
  [estadoDisponible, estadoReciclar, estadoPrestamo].forEach(cb => cb?.setCustomValidity(''));
}

[estadoDisponible, estadoReciclar, estadoPrestamo].forEach(cb => {
  if (!cb) return;
  cb.addEventListener('change', () => {
    if (cb.checked) seleccionarSoloUno(cb);
  });
});

actualizarCampoParte();


// ===============================
// GUARDAR REPORTE EN BD
// ===============================
function getEvaluacionInicialFlags() {
  const checks = document.querySelectorAll('.evaluacion-grid input[type="checkbox"]');
  const vals = Array.from(checks).map(ch => ch.checked);
  const safe = (i) => !!(vals[i]);
  return {
    eval_enciende:        safe(0),
    eval_inicia_so:       safe(1),
    eval_puertos:         safe(2),
    eval_pantalla:        safe(3),
    eval_bateria:         safe(4),
    eval_audio:           safe(5),
    eval_teclado:         safe(6),
    eval_cargador:        safe(7),
    eval_tiene_tintas:    safe(8),
    eval_cable_poder:     safe(9),
    eval_cable_usb:       safe(10),
    eval_cable_video:     safe(11)
  };
}

function getPreparacionFlags() {
  const col1 = document.querySelectorAll('.preparacion-grid > div:nth-child(1) input[type="checkbox"]');
  const col2 = document.querySelectorAll('.preparacion-grid > div:nth-child(2) input[type="checkbox"]');

  const v1 = Array.from(col1).map(ch => ch.checked);
  const v2 = Array.from(col2).map(ch => ch.checked);

  const s1 = (i) => !!(v1[i]);
  const s2 = (i) => !!(v2[i]);

  return {
    prep_instalar_so:           s1(0),
    prep_cuenta_local_cyd:      s1(1),
    prep_instalar_drivers:      s1(2),
    prep_actualizacion_fw_so:   s1(3),
    prep_software_base_cyd:     s1(4),
    prep_crear_cuenta_admin:    s1(5),
    prep_quitar_cyd_admins:     s1(6),
    prep_agregar_cyd_avanzados: s1(7),

    prep_diag_teclado:           s2(0),
    prep_diag_memoria:           s2(1),
    prep_diag_placa:             s2(2),
    prep_diag_procesador:        s2(3),
    prep_puertos_ok:             s2(4),
    prep_acond_teclado:          s2(5),
    prep_acond_pantalla_carcasa: s2(6),
    prep_acond_cargador:         s2(7)
  };
}

function getEstadoFinalValue() {
  if (estadoDisponible?.checked) return 'Disponible';
  if (estadoReciclar?.checked)   return 'Reciclar';
  if (estadoPrestamo?.checked)   return 'Préstamo';
  return null;
}

const form = document.querySelector('form.reporte-grid');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // 1) Validar que haya un activo seleccionado -> mensaje en el campo
  if (!currentActivoId) {
    if (numeroInput) {
      numeroInput.focus(); // <-- asegura que el globito salga aquí primero
      numeroInput.setCustomValidity('Primero busca y selecciona el N° de Activo.');
      numeroInput.reportValidity();
    }
    return;
  } else {
    numeroInput?.setCustomValidity('');
  }

  // 2) Validar ESTADO (al menos una casilla)
  const estadoFinal = getEstadoFinalValue();
  if (!estadoFinal) {
    const anchor = estadoDisponible || estadoReciclar || estadoPrestamo;
    if (anchor) {
      anchor.setCustomValidity(REQUIRED_MSG);
      anchor.reportValidity();
    }
    return;
  } else {
    [estadoDisponible, estadoReciclar, estadoPrestamo].forEach(cb => cb?.setCustomValidity(''));
  }

  // 3) Validar CONCLUSIÓN
  if (!conclusionEl?.value?.trim()) {
    conclusionEl.setCustomValidity(REQUIRED_MSG);
    conclusionEl.reportValidity();
    return;
  } else {
    conclusionEl.setCustomValidity('');
  }

  const evalFlags = getEvaluacionInicialFlags();
  const prepFlags = getPreparacionFlags();

  const body = {
    activo_id: currentActivoId,
    numero_activo: currentNumeroActivo || (numeroInput?.value || '').trim() || null,
    estado_final: estadoFinal,
    ...evalFlags,
    ...prepFlags,
    parte_cambiada: !!(parteSi && parteSi.checked),
    detalle_parte: detalleParte?.value?.trim() || null,
    conclusion: conclusionEl?.value?.trim() || null
  };

  try {
    const resp = await fetch('/api/reportes-tecnicos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.ok === false) {
      throw new Error(json.msg || 'No se pudo guardar el reporte técnico.');
    }

    lastReporteId = json.id;                
    if (btnExportarPdf) btnExportarPdf.disabled = false;

    // Mostrar modal de confirmación
    abrirModalGuardado();

    // No limpiamos aquí.
  } catch (err) {
    console.error(err);
    showToast('❌ Error al guardar el reporte técnico.');
  }
});

// limpiar mensaje de requerido de conclusión al teclear
conclusionEl?.addEventListener('input', () => conclusionEl.setCustomValidity(''));

// ===============================
// EXPORTAR PDF 
// ===============================
btnExportarPdf?.addEventListener('click', async () => {
  if (!btnExportarPdf || btnExportarPdf.disabled) {
    showToast('Primero guarda el reporte para habilitar la exportación.');
    return;
  }

  // 1) Elementos que ocultamos solo para el PDF
  const campoNumero  = document.getElementById('rt-numero')?.closest('.campo');
  const campoBuscar  = document.getElementById('rt-buscar')?.closest('.campo');
  const barraBotones = document.querySelector('.botonera');

  const originalDisplays = new Map();
  [campoNumero, campoBuscar, barraBotones].forEach(el => {
    if (el) {
      originalDisplays.set(el, el.style.display);
      el.style.display = 'none';
    }
  });

  // === Estilos temporales SOLO para exportar ===
  const style = document.createElement('style');
  style.id = 'pdf-tweaks';
  style.textContent = `
    body.pdf-exporting input[type="text"]{padding-top:6px;padding-bottom:6px;line-height:1.25;}
    body.pdf-exporting textarea{line-height:1.35;}
    body.pdf-exporting .logo-container,
    body.pdf-exporting .reporte-header{ display:none !important; }
    body.pdf-exporting .pdf-header-row{
      display:flex; align-items:center; gap:10px;
      margin:0 0 6px 0;
    }
    body.pdf-exporting .pdf-header-row img{ max-width:90px; height:auto; display:block; }
    body.pdf-exporting .pdf-header-row .pdf-title{
      flex:1; text-align:center; font-size:18px; font-weight:700; color:var(--burdeo);
    }
    body.pdf-exporting .reporte-container{ padding:14px 16px !important; }
    body.pdf-exporting .bloque{ padding:8px !important; border-width:1px !important; }
    body.pdf-exporting .bloque legend{ padding:0 6px !important; }
    body.pdf-exporting .campo{ margin-bottom:5px !important; gap:4px !important; }
    body.pdf-exporting .datos-activo-grid{ gap:8px 12px !important; }
    body.pdf-exporting .evaluacion-grid{ gap:6px 12px !important; }
    body.pdf-exporting .preparacion-grid{ gap:6px 18px !important; }
    body.pdf-exporting .estado-grid{ gap:6px !important; }
    body.pdf-exporting .parte-cambiada-grid{ gap:8px !important; }
    body.pdf-exporting #rt-caracteristicas,
    body.pdf-exporting #rt-notas{
      min-height:30px !important;
      height:30px !important;
      max-height:30px !important;
      resize:none !important;
    }


     /* ✅ NUEVO: baja la altura de Conclusión */
  body.pdf-exporting #conclusion{
    min-height:28px !important;
    height:28px !important;
    max-height:28px !important;
    resize:none !important;
    overflow:hidden !important;
  }
  `;
  document.head.appendChild(style);
  document.body.classList.add('pdf-exporting');

  const pdfHeader = document.createElement('div');
  pdfHeader.className = 'pdf-header-row';
  pdfHeader.innerHTML = `
    <img src="logo_cyd.png" alt="Logo CyD">
    <div class="pdf-title">Reporte Técnico</div>
  `;
  document.querySelector('.reporte-container')?.prepend(pdfHeader);

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const sideMargin   = 8;
    const topMargin    = 4;
    const bottomMargin = 8;
    const gap          = 2;

   const pageW = pdf.internal.pageSize.getWidth();
const pageH = pdf.internal.pageSize.getHeight();

// 
const contentScale = 0.92; 
const baseDrawW = pageW - sideMargin * 2;
const drawW = baseDrawW * contentScale;
const left  = sideMargin + (baseDrawW - drawW) / 2;

let y = topMargin;

const headCanvas = await html2canvas(pdfHeader, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
const headH = (headCanvas.height * drawW) / headCanvas.width;
pdf.addImage(headCanvas.toDataURL('image/png'), 'PNG', left, y, drawW, headH);
y += headH + gap;

const bloques = Array.from(document.querySelectorAll('fieldset.bloque'));
for (const bloque of bloques) {
  const can = await html2canvas(bloque, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgH = (can.height * drawW) / can.width;

  if (y + imgH > pageH - bottomMargin) { pdf.addPage(); y = topMargin; }
  pdf.addImage(can.toDataURL('image/png'), 'PNG', left, y, drawW, imgH);
  y += imgH + gap;
}

    pdf.save(`reporte_${(currentNumeroActivo || 'activo')}.pdf`);
    limpiarFormularioReporteCompleto();

  } catch (e) {
    console.error(e);
    showToast('❌ Error al exportar el PDF.');
  } finally {
    pdfHeader.remove();
    [campoNumero, campoBuscar, barraBotones].forEach(el => {
      if (el && originalDisplays.has(el)) el.style.display = originalDisplays.get(el);
    });
    document.body.classList.remove('pdf-exporting');
    document.getElementById('pdf-tweaks')?.remove();
  }
});

// ===============================
// AUTOCOMPLETAR SI LLEGA ?numero=...
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const numeroFromUrl = params.get('numero');
  if (numeroFromUrl && numeroInput) {
    numeroInput.value = numeroFromUrl;
    buscarYCompletar();
  }
});
