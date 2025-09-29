// backend/routes/dispositivos.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ========= para PDF =========
const PDFDocument = require('pdfkit');

// ========= ENV / MAIL =========
const nodemailer = require('nodemailer');

// ========= Soporte HTML->PDF (Puppeteer) =========
const fs = require('fs');
const path = require('path');
let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (_) { puppeteer = null; }

// helper: generar PDFKit en Buffer (fallback)
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

function yn(v) { return v ? 'Sí' : 'No'; }
function fmtDate(val){
  if(!val) return '';
  try{
    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val).split('T')[0] || String(val);
    return d.toISOString().slice(0,10);
  }catch{ return String(val).split('T')[0] || String(val); }
}

/* =========================
   CRUD de activos / reportes
   (idéntico a tu versión original)
   ========================= */

// Crear activo
router.post('/activos', async (req, res) => {
  try {
    const {
      remitenteNombre, fechaRecepcionTi, numero, ticket, tipo, estado, origen,
      caracteristicas, notas, iv_carcasa, iv_teclado, iv_pantalla, iv_puertos,
      iv_cargador, iv_sin_danos, iv_otro, fechaCompra, anios
    } = req.body;

    if (!numero || !tipo || !estado || !ticket || !origen) {
      return res.status(400).json({ ok: false, msg: 'Faltan campos obligatorios (N° Activo, Categoría, Estado, N° Ticket y Origen).' });
    }

    const hayInspeccionVisual =
      !!(iv_carcasa || iv_teclado || iv_pantalla || iv_puertos || iv_cargador || iv_sin_danos) ||
      (iv_otro && String(iv_otro).trim() !== '');

    if (!hayInspeccionVisual) {
      return res.status(400).json({ ok: false, msg: 'Debe seleccionar al menos un ítem en Inspección Visual (incluye "Otro" o "Sin daños visibles").' });
    }

    const sql = `
      INSERT INTO activos (
        numero_activo, categoria, estado,
        remitente_nombre, fecha_recepcion_ti, ticket,
        caracteristicas, notas, origen,
        iv_carcasa, iv_teclado, iv_pantalla, iv_puertos, iv_cargador, iv_sin_danos, iv_otro,
        fecha_compra, anios, fase
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    const params = [
      numero, tipo, estado,
      remitenteNombre || null, fechaRecepcionTi || null, ticket || null,
      caracteristicas || null, notas || null, origen || null,
      iv_carcasa ? 1 : 0, iv_teclado ? 1 : 0, iv_pantalla ? 1 : 0, iv_puertos ? 1 : 0,
      iv_cargador ? 1 : 0, iv_sin_danos ? 1 : 0,
      (iv_otro && String(iv_otro).trim() !== '') ? String(iv_otro).trim() : null,
      fechaCompra || null, anios || null, 'Entrada'
    ];
    const [result] = await db.execute(sql, params);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al guardar activo.' });
  }
});

// Listar activos
router.get('/activos', async (req, res) => {
  try {
    const { fase, estado } = req.query;
    const where = []; const params = [];
    if (fase) { where.push('fase = ?'); params.push(fase); }
    if (estado) { where.push('estado = ?'); params.push(estado); }

    const sql = `
      SELECT id, numero_activo AS numero, categoria, estado, fase, origen
        FROM activos
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY id DESC
       LIMIT 100
    `;
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al listar activos.' });
  }
});

// Detalle activo
router.get('/activos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(`SELECT * FROM activos WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Activo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al obtener activo.' });
  }
});

// Actualizar estado (flujo existente)
router.patch('/activos/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const permitidos = ['Disponible','Pendiente','Proceso','Tránsito','Por Retirar','Asignado','Reasignado','Reciclaje','Vendido','Préstamo','Repuesto','Donar'];
    if (!estado || !permitidos.includes(estado)) {
      return res.status(400).json({ ok: false, msg: 'Estado inválido.' });
    }

    const [result] = await db.execute(`UPDATE activos SET estado = ? WHERE id = ?`, [estado, id]);
    if (result.affectedRows === 0) return res.status(404).json({ ok: false, msg: 'Activo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar estado.' });
  }
});

// Actualizar activo completo
router.patch('/activos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const permitidosEstado = ['Disponible','Pendiente','Proceso','Tránsito','Por Retirar','Asignado','Reasignado','Reciclaje','Vendido','Préstamo','Repuesto','Donar'];
    if (body.estado && !permitidosEstado.includes(body.estado)) {
      return res.status(400).json({ ok:false, msg:'Estado inválido.' });
    }

    const sql = `
      UPDATE activos SET
        numero_activo = ?, categoria = ?, ticket = ?, anios = ?,
        remitente_nombre = ?, fecha_recepcion_ti = ?, origen = ?,
        fecha_compra = ?, caracteristicas = ?, notas = ?, estado = ?,
        iv_carcasa = ?, iv_teclado = ?, iv_pantalla = ?, iv_puertos = ?,
        iv_cargador = ?, iv_sin_danos = ?, iv_otro = ?
      WHERE id = ?
    `;
    const params = [
      body.numero_activo ?? null, body.categoria ?? null, body.ticket ?? null, body.anios ?? null,
      body.remitente_nombre ?? null, body.fecha_recepcion_ti ?? null, body.origen ?? null,
      body.fecha_compra ?? null, body.caracteristicas ?? null, body.notas ?? null, body.estado ?? null,
      body.iv_carcasa ? 1 : 0, body.iv_teclado ? 1 : 0, body.iv_pantalla ? 1 : 0, body.iv_puertos ? 1 : 0,
      body.iv_cargador ? 1 : 0, body.iv_sin_danos ? 1 : 0,
      (body.iv_otro && String(body.iv_otro).trim() !== '') ? String(body.iv_otro).trim() : null,
      id
    ];
    const [result] = await db.execute(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ ok:false, msg:'Activo no encontrado' });
    res.json({ ok:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, msg:'Error al actualizar activo.' });
  }
});

// Resumen por categoría
router.get('/resumen', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT categoria, COUNT(*) AS cantidad FROM activos GROUP BY categoria ORDER BY categoria`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al obtener resumen.' });
  }
});

// Crear reporte técnico
router.post('/reportes-tecnicos', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      activo_id, numero_activo, estado_final,
      // Evaluación Inicial
      eval_enciende, eval_inicia_so, eval_puertos, eval_pantalla, eval_bateria, eval_audio,
      eval_teclado, eval_cargador, eval_tiene_tintas, eval_cable_poder, eval_cable_usb, eval_cable_video,
      // Preparación
      prep_instalar_so, prep_cuenta_local_cyd, prep_instalar_drivers, prep_actualizacion_fw_so,
      prep_software_base_cyd, prep_crear_cuenta_admin, prep_quitar_cyd_admins, prep_agregar_cyd_avanzados,
      prep_diag_teclado, prep_diag_memoria, prep_diag_placa, prep_diag_procesador, prep_puertos_ok,
      prep_acond_teclado, prep_acond_pantalla_carcasa, prep_acond_cargador,
      // Upgrade
      parte_cambiada, detalle_parte,
      // Conclusión
      conclusion
    } = body;

    if (!activo_id) return res.status(400).json({ ok: false, msg: 'Falta activo_id.' });

    const [act] = await db.execute(`SELECT id, numero_activo, categoria, remitente_nombre FROM activos WHERE id = ?`, [activo_id]);
    if (!act.length) return res.status(404).json({ ok: false, msg: 'Activo no encontrado.' });

    const sql = `
      INSERT INTO reportes_tecnicos (
        activo_id, numero_activo, estado_final,
        eval_enciende, eval_inicia_so, eval_puertos, eval_pantalla, eval_bateria, eval_audio, eval_teclado, eval_cargador, eval_tiene_tintas, eval_cable_poder, eval_cable_usb, eval_cable_video,
        prep_instalar_so, prep_cuenta_local_cyd, prep_instalar_drivers, prep_actualizacion_fw_so, prep_software_base_cyd, prep_crear_cuenta_admin, prep_quitar_cyd_admins, prep_agregar_cyd_avanzados,
        prep_diag_teclado, prep_diag_memoria, prep_diag_placa, prep_diag_procesador, prep_puertos_ok, prep_acond_teclado, prep_acond_pantalla_carcasa, prep_acond_cargador,
        parte_cambiada, detalle_parte, conclusion
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    const vals = [
      activo_id, numero_activo || act[0].numero_activo || null, estado_final || null,
      !!eval_enciende, !!eval_inicia_so, !!eval_puertos, !!eval_pantalla, !!eval_bateria, !!eval_audio,
      !!eval_teclado, !!eval_cargador, !!eval_tiene_tintas, !!eval_cable_poder, !!eval_cable_usb, !!eval_cable_video,
      !!prep_instalar_so, !!prep_cuenta_local_cyd, !!prep_instalar_drivers, !!prep_actualizacion_fw_so, !!prep_software_base_cyd,
      !!prep_crear_cuenta_admin, !!prep_quitar_cyd_admins, !!prep_agregar_cyd_avanzados,
      !!prep_diag_teclado, !!prep_diag_memoria, !!prep_diag_placa, !!prep_diag_procesador, !!prep_puertos_ok,
      !!prep_acond_teclado, !!prep_acond_pantalla_carcasa, !!prep_acond_cargador,
      !!parte_cambiada, detalle_parte || null, conclusion || null
    ];
    const [result] = await db.execute(sql, vals);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al guardar reporte técnico.' });
  }
});

// Exportar PDF de un reporte (igual que tu versión)
router.get('/reportes-tecnicos/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(`
      SELECT rt.*, a.categoria, a.remitente_nombre
        FROM reportes_tecnicos rt
        JOIN activos a ON a.id = rt.activo_id
       WHERE rt.id = ?
    `, [id]);

    if (!rows.length) return res.status(404).json({ ok:false, msg:'Reporte no encontrado' });
    const rep = rows[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${rep.numero_activo || 'activo'}.pdf`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text('Reporte Técnico', { align: 'center' });
    doc.moveDown();

    doc.fontSize(11)
      .text(`N° Activo: ${rep.numero_activo || ''}`)
      .text(`Categoría: ${rep.categoria || ''}`)
      .text(`Estado final: ${rep.estado_final || ''}`)
      .text(`Remitente: ${rep.remitente_nombre || ''}`);
    doc.moveDown();

    doc.fontSize(12).text('Evaluación Inicial:', { underline: true });
    doc.fontSize(10);
    [
      ['Enciende', rep.eval_enciende], ['Inicia SO', rep.eval_inicia_so], ['Puertos Funcionales', rep.eval_puertos],
      ['Pantalla Funcional', rep.eval_pantalla], ['Batería Funcional', rep.eval_bateria], ['Audio Funcional', rep.eval_audio],
      ['Teclado Funcional', rep.eval_teclado], ['Cargador Funcional', rep.eval_cargador], ['Tiene Tintas', rep.eval_tiene_tintas],
      ['Cable de Poder', rep.eval_cable_poder], ['Cable USB', rep.eval_cable_usb], ['Cable VGA/HDMI', rep.eval_cable_video],
    ].forEach(([t, v]) => doc.text(`• ${t}: ${yn(v)}`));

    if (rep.parte_cambiada) {
      doc.moveDown().fontSize(12).text('Mejora (upgrade):', { underline: true });
      doc.fontSize(10).text(`Parte cambiada: ${rep.detalle_parte || ''}`);
    }

    if (rep.conclusion) {
      doc.moveDown().fontSize(12).text('Conclusión y Recomendaciones:', { underline: true });
      doc.fontSize(10).text(rep.conclusion, { align: 'justify' });
    }

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'Error generando PDF' });
  }
});

// Listar reportes por activo (para el ojo)
router.get('/reportes-tecnicos', async (req, res) => {
  try {
    const { activo_id } = req.query;
    if (!activo_id) return res.status(400).json({ ok:false, msg:'Falta activo_id' });
    const [rows] = await db.execute(
      `SELECT * FROM reportes_tecnicos WHERE activo_id = ? ORDER BY id DESC`,
      [activo_id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'Error al listar reportes' });
  }
});

/* ============================================================
   ENVIAR CORREO CON PDF — MISMO DISEÑO DEL REPORTE TÉCNICO
   - NO incluye "Datos de Entrega"
   - Usa frontend/css/reporte_tecnico.css
   - Logo CyD arriba a la izquierda
   - Origen + Características + Notas en fila de 3 columnas (textareas bajitas)
   ============================================================ */

function buildReporteMailHTML(a, rep){
  // CSS del reporte técnico
  const cssPath = path.join(process.cwd(), 'frontend', 'css', 'reporte_tecnico.css');
  let cssText = '';
  try { cssText = fs.readFileSync(cssPath, 'utf8'); } catch {}

  // Logo CyD (si existe)
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

/* Fila de 3 columnas: Origen | Características | Notas */
.rt-triple-grid{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px 16px; align-items:start; }
.rt-triple-grid .campo input,
.rt-triple-grid .campo textarea{ width:100% !important; box-sizing:border-box; }

/* Textareas con altura baja (1 línea visual) */
.one-line{
  height:36px !important;
  min-height:36px !important;
  max-height:36px !important;
  padding:6px 10px;         /* mismo padding que el input */
  line-height:22px;         /* centra visualmente el texto */
  box-sizing:border-box;
  resize:none;
  overflow:hidden;
}

/* Conclusión: ancho completo y altura bajita (puedes subir/bajar 28px si quieres) */
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

      <!-- PARES: N° de Activo | Categoría ; Estado | Remitente ; Fecha Recepción TI | Ticket -->
      <div class="datos-activo-grid">
        <div class="campo"><label>N° de Activo</label><input value="${a.numero_activo || ''}" readonly></div>
        <div class="campo"><label>Categoría</label><input value="${a.categoria || ''}" readonly></div>

        <div class="campo"><label>Estado</label><input value="${a.estado || ''}" readonly></div>
        <div class="campo"><label>Remitente</label><input value="${a.remitente_nombre || ''}" readonly></div>

        <div class="campo"><label>Fecha Recepción TI</label><input value="${fmtDate(a.fecha_recepcion_ti)}" readonly></div>
        <div class="campo"><label>Ticket</label><input value="${a.ticket || ''}" readonly></div>
      </div>

      <!-- 3 columnas: Origen | Características | Notas -->
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
    ` : `
      <div class="bloque"><em>No hay reporte técnico registrado para este activo.</em></div>
    `}
  </div>
</body>
</html>`;
}

async function renderHTMLtoPDFBuffer(html){
  if (!puppeteer) return null;
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '4mm', right: '4mm', bottom: '4mm', left: '4mm' },
    scale: 0.80,                 // <-- encoge ligeramente para que quepa en 1 hoja
    preferCSSPageSize: true
  });
  await browser.close();
  return buf;
}

// Enviar correo con PDF (diseño idéntico al reporte técnico)
router.post('/entregas/enviar', async (req, res) => {
  try {
    const { activo_id, nombre_quien_retira, correo_quien_retira } = req.body || {};
    if (!activo_id || !nombre_quien_retira || !correo_quien_retira) {
      return res.status(400).json({ ok:false, msg:'Faltan datos (activo_id, nombre y correo de quien retira).' });
    }

    // Activo
    const [acts] = await db.execute(`SELECT * FROM activos WHERE id = ?`, [activo_id]);
    if (!acts.length) return res.status(404).json({ ok:false, msg:'Activo no encontrado.' });
    const a = acts[0];

    // Último reporte técnico (opcional)
    const [reps] = await db.execute(
      `SELECT * FROM reportes_tecnicos WHERE activo_id = ? ORDER BY id DESC LIMIT 1`, [activo_id]
    );
    const rep = reps.length ? reps[0] : null;

    // HTML + CSS (reporte_tecnico.css)
    let pdfBuffer = null;
    try {
      const html = buildReporteMailHTML(a, rep);
      pdfBuffer = await renderHTMLtoPDFBuffer(html);
    } catch (e) {
      console.warn('Puppeteer falló o no disponible. Usando PDFKit fallback:', e?.message);
    }

    // Fallback con PDFKit (también SIN "Datos de Entrega")
    if (!pdfBuffer) {
      pdfBuffer = await pdfToBuffer((doc) => {
        doc.fontSize(16).text('Reporte Técnico', { align: 'center' });
        doc.moveDown();

        // Datos del Activo
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

        if (rep) {
          doc.fontSize(12).text('Evaluación Inicial', { underline: true });
          doc.fontSize(10);
          [
            ['Enciende', rep.eval_enciende], ['Inicia SO', rep.eval_inicia_so], ['Puertos Funcionales', rep.eval_puertos],
            ['Pantalla Funcional', rep.eval_pantalla], ['Batería Funcional', rep.eval_bateria], ['Audio Funcional', rep.eval_audio],
            ['Teclado Funcional', rep.eval_teclado], ['Cargador Funcional', rep.eval_cargador], ['Tiene Tintas', rep.eval_tiene_tintas],
            ['Cable de Poder', rep.eval_cable_poder], ['Cable USB', rep.eval_cable_usb], ['Cable VGA/HDMI', rep.eval_cable_video],
          ].forEach(([t, v]) => doc.text(`• ${t}: ${yn(v)}`));
          doc.moveDown();

          doc.fontSize(12).text('Preparación', { underline: true });
          doc.fontSize(10);
          [
            ['Instalar SO', rep.prep_instalar_so], ['Crear cuenta local CyD', rep.prep_cuenta_local_cyd],
            ['Instalar Drivers (HP, Lenovo, Dell)', rep.prep_instalar_drivers], ['Actualización Firmware y SO', rep.prep_actualizacion_fw_so],
            ['Instalar Software base CyD', rep.prep_software_base_cyd], ['Crear cuenta de administrador', rep.prep_crear_cuenta_admin],
            ['Quitar cuenta CyD de administradores', rep.prep_quitar_cyd_admins], ['Agregar CyD a usuarios avanzados/red', rep.prep_agregar_cyd_avanzados],
            ['Diagnóstico de teclado', rep.prep_diag_teclado], ['Diagnóstico de memoria', rep.prep_diag_memoria],
            ['Diagnóstico de placa lógica', rep.prep_diag_placa], ['Diagnóstico de procesador', rep.prep_diag_procesador],
            ['Puertos funcionan correctamente', rep.prep_puertos_ok], ['Acondicionamiento de teclado', rep.prep_acond_teclado],
            ['Acondicionamiento de pantalla/carcasa', rep.prep_acond_pantalla_carcasa], ['Acondicionamiento del cargador', rep.prep_acond_cargador],
          ].forEach(([t, v]) => doc.text(`• ${t}: ${yn(v)}`));
          doc.moveDown();

          const est = (rep.estado_final || '').toLowerCase();
          doc.fontSize(12).text('Estado', { underline: true });
          doc.fontSize(10)
            .text(`Disponible: ${yn(est==='disponible')}`)
            .text(`Reciclar: ${yn(est==='reciclar' || est==='reciclaje')}`)
            .text(`Préstamo: ${yn(est==='préstamo' || est==='prestamo')}`);
          doc.moveDown();

          doc.fontSize(12).text('Mejora (upgrade)', { underline: true });
          doc.fontSize(10).text(`Parte cambiada: ${rep.parte_cambiada ? (rep.detalle_parte || 'Sí') : 'No'}`);
          if (rep.conclusion) {
            doc.moveDown().fontSize(12).text('Conclusión y Recomendaciones', { underline: true });
            doc.fontSize(10).text(rep.conclusion, { align: 'justify' });
          }
        }
      });
    }

    // Transporter SMTP (Gmail)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const toEmail = process.env.MAIL_TO || 'c.pamelacastillorojas@gmail.com';
    const fromName = process.env.MAIL_FROM_NAME || 'CyD ITI';
    const subject = `Entrega de Activo ${a.numero_activo || ''} — ${nombre_quien_retira}`;

    await transporter.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER || 'ccastillo@cydingenieria.com'}>`,
      to: toEmail,
      subject,
      text: `Se adjunta el PDF con la información del activo.
      
Activo: ${a.numero_activo || ''}
Categoría: ${a.categoria || ''}
Estado: ${a.estado || ''}

Fecha Recepción TI: ${fmtDate(a.fecha_recepcion_ti)}
`,
      attachments: [{ filename: `entrega_${a.numero_activo || 'activo'}.pdf`, content: pdfBuffer }]
    });

    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'No se pudo enviar el correo.' });
  }
});

module.exports = router;
