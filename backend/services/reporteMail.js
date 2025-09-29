// backend/services/reporteMail.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (_) { puppeteer = null; }

// ===== Helpers =====
function yn(v) { return v ? 'Sí' : 'No'; }
function fmtDate(val){
  if(!val) return '';
  try{
    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val).split('T')[0] || String(val);
    return d.toISOString().slice(0,10);
  }catch{ return String(val).split('T')[0] || String(val); }
}

// Fallback PDFKit a Buffer
function pdfToBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      buildFn(doc);
      doc.end();
    } catch (e) { reject(e); }
  });
}

// ===== HTML del reporte para el correo (mismo diseño) =====
function buildReporteMailHTML(a, rep){
  const cssPath = path.join(process.cwd(), 'frontend', 'css', 'reporte_tecnico.css');
  let cssText = '';
  try { cssText = fs.readFileSync(cssPath, 'utf8'); } catch {}

  // Logo (opcional)
  let logoData = '';
  try {
    const logoPath = path.join(process.cwd(), 'frontend', 'logo_cyd.png');
    const buf = fs.readFileSync(logoPath);
    logoData = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {}

  const checked = c => c ? 'checked' : '';
  const est = (rep?.estado_final || '').toLowerCase();

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${cssText}
/* Ajustes para el PDF */
@page { size: A4; margin: 2mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* Header con logo a la izquierda y título centrado */
.rt-header{ position:relative; display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
.rt-header img{ position:absolute; left:0; top:50%; transform:translateY(-50%); height:44px; }

/* 3 columnas: Origen | Características | Notas */
.rt-triple-grid{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px 16px; align-items:start; }
.rt-triple-grid .campo input,
.rt-triple-grid .campo textarea{ width:100% !important; box-sizing:border-box; }

/* Textareas con altura baja (1 línea visual) */
.one-line{
  height:36px !important; min-height:36px !important; max-height:36px !important;
  padding:6px 10px; line-height:22px; box-sizing:border-box; resize:none; overflow:hidden;
}

/* Conclusión bajita */
.conclusion-wide{ width:100% !important; box-sizing:border-box; min-height:28px; height:28px; max-height:28px; }
</style>
<title>Reporte Técnico</title>
</head>
<body>
  <div class="reporte-container">
    <div class="rt-header">
      ${logoData ? `<img src="${logoData}" alt="CyD">` : ``}
      <h2>Reporte Técnico</h2>
    </div>

    <fieldset class="bloque">
      <legend>Datos del Activo</legend>
      <div class="datos-activo-grid">
        <div class="campo"><label>N° de Activo</label><input value="${a.numero_activo || ''}" readonly></div>
        <div class="campo"><label>Categoría</label><input value="${a.categoria || ''}" readonly></div>
        <div class="campo"><label>Estado</label><input value="${a.estado || ''}" readonly></div>
        <div class="campo"><label>Remitente</label><input value="${a.remitente_nombre || ''}" readonly></div>
        <div class="campo"><label>Fecha Recepción TI</label><input value="${fmtDate(a.fecha_recepcion_ti)}" readonly></div>
        <div class="campo"><label>Ticket</label><input value="${a.ticket || ''}" readonly></div>
      </div>

      <div class="rt-triple-grid" style="margin-top:12px">
        <div class="campo"><label>Origen</label><input value="${a.origen || ''}" readonly></div>
        <div class="campo"><label>Características</label><textarea class="one-line" readonly>${a.caracteristicas ? String(a.caracteristicas) : ''}</textarea></div>
        <div class="campo"><label>Notas</label><textarea class="one-line" readonly>${a.notas ? String(a.notas) : ''}</textarea></div>
      </div>
    </fieldset>

    ${rep ? `
    <fieldset class="bloque">
      <legend>Evaluación Inicial</legend>
      <div class="evaluacion-grid">
        <label><input type="checkbox" ${checked(rep.eval_enciende)} disabled> Enciende</label>
        <label><input type="checkbox" ${checked(rep.eval_inicia_so)} disabled> Inicia Sistema Operativo</label>
        <label><input type="checkbox" ${checked(rep.eval_puertos)} disabled> Puertos Funcionales</label>
        <label><input type="checkbox" ${checked(rep.eval_pantalla)} disabled> Pantalla Funcional</label>
        <label><input type="checkbox" ${checked(rep.eval_bateria)} disabled> Batería Funcional</label>
        <label><input type="checkbox" ${checked(rep.eval_audio)} disabled> Audio Funcional</label>
        <label><input type="checkbox" ${checked(rep.eval_teclado)} disabled> Teclado Funcional</label>
        <label><input type="checkbox" ${checked(rep.eval_cargador)} disabled> Cargador Funcional</label>
        <label><input type="checkbox" ${checked(rep.eval_tiene_tintas)} disabled> Tiene Tintas</label>
        <label><input type="checkbox" ${checked(rep.eval_cable_poder)} disabled> Cable de Poder</label>
        <label><input type="checkbox" ${checked(rep.eval_cable_usb)} disabled> Cable USB</label>
        <label><input type="checkbox" ${checked(rep.eval_cable_video)} disabled> Cable VGA/HDMI</label>
      </div>
    </fieldset>

    <fieldset class="bloque">
      <legend>Preparación</legend>
      <div class="preparacion-grid">
        <label><input type="checkbox" ${checked(rep.prep_instalar_so)} disabled> Instalar SO</label>
        <label><input type="checkbox" ${checked(rep.prep_diag_teclado)} disabled> Diagnóstico de teclado</label>

        <label><input type="checkbox" ${checked(rep.prep_cuenta_local_cyd)} disabled> Crear cuenta local CyD</label>
        <label><input type="checkbox" ${checked(rep.prep_diag_memoria)} disabled> Diagnóstico de memoria</label>

        <label><input type="checkbox" ${checked(rep.prep_instalar_drivers)} disabled> Instalar Drivers (HP, Lenovo, Dell)</label>
        <label><input type="checkbox" ${checked(rep.prep_diag_placa)} disabled> Diagnóstico de placa lógica</label>

        <label><input type="checkbox" ${checked(rep.prep_actualizacion_fw_so)} disabled> Actualización Firmware y SO</label>
        <label><input type="checkbox" ${checked(rep.prep_diag_procesador)} disabled> Diagnóstico de procesador</label>

        <label><input type="checkbox" ${checked(rep.prep_software_base_cyd)} disabled> Instalar Software base CyD</label>
        <label><input type="checkbox" ${checked(rep.prep_puertos_ok)} disabled> Puertos funcionan correctamente</label>

        <label><input type="checkbox" ${checked(rep.prep_crear_cuenta_admin)} disabled> Crear cuenta de administrador</label>
        <label><input type="checkbox" ${checked(rep.prep_acond_teclado)} disabled> Acondicionamiento de teclado</label>

        <label><input type="checkbox" ${checked(rep.prep_quitar_cyd_admins)} disabled> Quitar cuenta CyD de administradores</label>
        <label><input type="checkbox" ${checked(rep.prep_acond_pantalla_carcasa)} disabled> Acondicionamiento de pantalla/carcasa</label>

        <label><input type="checkbox" ${checked(rep.prep_agregar_cyd_avanzados)} disabled> Agregar CyD a usuarios avanzados/red</label>
        <label><input type="checkbox" ${checked(rep.prep_acond_cargador)} disabled> Acondicionamiento del cargador</label>
      </div>
    </fieldset>

    <fieldset class="bloque">
      <legend>Estado</legend>
      <div class="estado-grid">
        <label><input type="checkbox" ${(est==='disponible') ? 'checked' : ''} disabled> Disponible</label>
        <label><input type="checkbox" ${(est==='reciclar' || est==='reciclaje') ? 'checked' : ''} disabled> Reciclar</label>
        <label><input type="checkbox" ${(est==='préstamo' || est==='prestamo') ? 'checked' : ''} disabled> Préstamo</label>
      </div>
    </fieldset>

    <fieldset class="bloque">
      <legend>Mejora (upgrade)</legend>
      <div class="parte-cambiada-grid">
        <label><input type="checkbox" ${rep.parte_cambiada ? '' : 'checked'} disabled> No</label>
        <label><input type="checkbox" ${rep.parte_cambiada ? 'checked' : ''} disabled> Sí</label>
        <div class="campo-parte"><input value="${rep.parte_cambiada ? (rep.detalle_parte || '') : ''}" placeholder="Especificar pieza" readonly></div>
      </div>
    </fieldset>

    <fieldset class="bloque">
      <legend>Conclusión y Recomendaciones</legend>
      <textarea class="conclusion-wide" readonly>${rep.conclusion ? rep.conclusion : ''}</textarea>
    </fieldset>
    ` : `<div class="bloque"><em>No hay reporte técnico registrado para este activo.</em></div>`}
  </div>
</body>
</html>`;
}

// Render con Puppeteer (si está disponible)
async function renderHTMLtoPDFBuffer(html){
  if (!puppeteer) return null;
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '4mm', right: '4mm', bottom: '4mm', left: '4mm' },
    scale: 0.80,
    preferCSSPageSize: true
  });
  await browser.close();
  return buf;
}

// Genera el Buffer del PDF (Puppeteer o fallback PDFKit)
async function makeEntregaPDFBuffer(a, rep){
  try {
    const html = buildReporteMailHTML(a, rep);
    const b = await renderHTMLtoPDFBuffer(html);
    if (b) return b;
  } catch (_) {}
  // Fallback texto
  return await pdfToBuffer((doc) => {
    doc.fontSize(16).text('Reporte Técnico', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text('Datos del Activo', { underline: true });
    doc.fontSize(10)
      .text(`N° de Activo: ${a.numero_activo || ''}`)
      .text(`Categoría: ${a.categoria || ''}`)
      .text(`Estado: ${a.estado || ''}`)
      .text(`Remitente: ${a.remitente_nombre || ''}`)
      .text(`Fecha Recepción TI: ${fmtDate(a.fecha_recepcion_ti)}`)
      .text(`Ticket: ${a.ticket || ''}`)
      .text(`Origen: ${a.origen || ''}`);
    if (a.caracteristicas) doc.text(`Características: ${String(a.caracteristicas)}`);
    if (a.notas) doc.text(`Notas: ${String(a.notas)}`);
    doc.moveDown();

    if (rep){
      doc.fontSize(12).text('Evaluación Inicial', { underline: true });
      doc.fontSize(10);
      [
        ['Enciende', rep.eval_enciende], ['Inicia SO', rep.eval_inicia_so], ['Puertos Funcionales', rep.eval_puertos],
        ['Pantalla Funcional', rep.eval_pantalla], ['Batería Funcional', rep.eval_bateria], ['Audio Funcional', rep.eval_audio],
        ['Teclado Funcional', rep.eval_teclado], ['Cargador Funcional', rep.eval_cargador], ['Tiene Tintas', rep.eval_tiene_tintas],
        ['Cable de Poder', rep.eval_cable_poder], ['Cable USB', rep.eval_cable_usb], ['Cable VGA/HDMI', rep.eval_cable_video],
      ].forEach(([t, v]) => doc.text(`• ${t}: ${yn(v)}`));
      doc.moveDown();

      doc.fontSize(12).text('Mejora (upgrade)', { underline: true });
      doc.fontSize(10).text(`Parte cambiada: ${rep.parte_cambiada ? (rep.detalle_parte || 'Sí') : 'No'}`);
      if (rep.conclusion){
        doc.moveDown().fontSize(12).text('Conclusión y Recomendaciones', { underline: true });
        doc.fontSize(10).text(rep.conclusion, { align: 'justify' });
      }
    }
  });
}

// ===== Envía el correo con el PDF adjunto =====
async function sendEntregaEmail(a, rep, { nombre_quien_retira, correo_quien_retira } = {}){
  const pdfBuffer = await makeEntregaPDFBuffer(a, rep);

  // Transporter SMTP (Gmail por defecto)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER || 'ccastillo@cydingenieria.com',
      pass: process.env.SMTP_PASS
    }
  });

  // *** Fuerza el destinatario solicitado ***
  const toEmail   = 'c.pamelacastillorojas@gmail.com';
  const fromName  = process.env.MAIL_FROM_NAME || 'CyD ITI';
  const fromEmail = process.env.SMTP_USER || 'ccastillo@cydingenieria.com';
  const subject   = `Entrega de Activo ${a.numero_activo || ''} — ${nombre_quien_retira || ''}`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    // opcional: deja como "reply-to" el correo que venga del formulario
    ...(correo_quien_retira ? { replyTo: correo_quien_retira } : {}),
    subject,
    text: `Se adjunta el PDF con la información del activo.

Activo: ${a.numero_activo || ''}
Categoría: ${a.categoria || ''}
Estado: ${a.estado || ''}

Fecha Recepción TI: ${fmtDate(a.fecha_recepcion_ti)}
`,
    attachments: [{ filename: `entrega_${a.numero_activo || 'activo'}.pdf`, content: pdfBuffer }]
  });

  return true;
}

module.exports = {
  buildReporteMailHTML,
  renderHTMLtoPDFBuffer,
  makeEntregaPDFBuffer,
  sendEntregaEmail
};
