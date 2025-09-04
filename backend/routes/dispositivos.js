// backend/routes/dispositivos.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ========= NUEVO para PDF =========
const PDFDocument = require('pdfkit');

// Crear activo
router.post('/activos', async (req, res) => {
  try {
    const {
      remitenteNombre,
      fechaRecepcionTi,
      numero,
      ticket,
      tipo,
      estado,
      origen,
      caracteristicas,   
      notas, 
      iv_carcasa,
      iv_teclado,
      iv_pantalla,
      iv_puertos,
      iv_cargador,
      iv_sin_danos,
      iv_otro,
      fechaCompra,
      anios
    } = req.body;

    // === Validaciones ===
    if (!numero || !tipo || !estado || !ticket || !origen) {
      return res.status(400).json({
        ok: false,
        msg: 'Faltan campos obligatorios (N° Activo, Categoría, Estado, N° Ticket y Origen).'
      });
    }

    // Debe haber al menos un check en Inspección Visual (incluye "Otro" con texto o "Sin daños visibles")
    const hayInspeccionVisual =
      !!(iv_carcasa || iv_teclado || iv_pantalla || iv_puertos || iv_cargador || iv_sin_danos) ||
      (iv_otro && String(iv_otro).trim() !== '');

    if (!hayInspeccionVisual) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe seleccionar al menos un ítem en Inspección Visual (incluye "Otro" o "Sin daños visibles").'
      });
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
      caracteristicas || null,
      notas || null, origen || null,
      iv_carcasa ? 1 : 0,
      iv_teclado ? 1 : 0,
      iv_pantalla ? 1 : 0,
      iv_puertos ? 1 : 0,
      iv_cargador ? 1 : 0,
      iv_sin_danos ? 1 : 0,               
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

    const where = [];
    const params = [];

    if (fase) { where.push('fase = ?'); params.push(fase); }
    if (estado) { where.push('estado = ?'); params.push(estado); }

    const sql = `
      SELECT
        id,
        numero_activo AS numero,
        categoria,
        estado,
        fase,
        origen            -- <==== agregado para que el modal muestre Origen
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

// Actualizar estado
router.patch('/activos/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const permitidos = ['Disponible','Pendiente','Proceso','Tránsito',
  'Por Retirar','Asignado','Reasignado','Reciclaje','Vendido','Préstamo','Repuesto','Donar'];
    if (!estado || !permitidos.includes(estado)) {
      return res.status(400).json({ ok: false, msg: 'Estado inválido.' });
    }

    const [result] = await db.execute(
      `UPDATE activos SET estado = ? WHERE id = ?`,
      [estado, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: 'Activo no encontrado' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar estado.' });
  }
});

// Resumen por categoría
router.get('/resumen', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT categoria, COUNT(*) AS cantidad
         FROM activos
        GROUP BY categoria
        ORDER BY categoria`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al obtener resumen.' });
  }
});

// ===============================
// NUEVO: Crear reporte técnico
// ===============================
router.post('/reportes-tecnicos', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      activo_id,
      numero_activo,
      estado_final,
      // Evaluación Inicial
      eval_enciende,
      eval_inicia_so,
      eval_puertos,
      eval_pantalla,
      eval_bateria,
      eval_audio,
      eval_teclado,
      eval_cargador,
      eval_tiene_tintas,
      eval_cable_poder,
      eval_cable_usb,
      eval_cable_video,
      // Preparación izquierda
      prep_instalar_so,
      prep_cuenta_local_cyd,
      prep_instalar_drivers,
      prep_actualizacion_fw_so,
      prep_software_base_cyd,
      prep_crear_cuenta_admin,
      prep_quitar_cyd_admins,
      prep_agregar_cyd_avanzados,
      // Preparación derecha
      prep_diag_teclado,
      prep_diag_memoria,
      prep_diag_placa,
      prep_diag_procesador,
      prep_puertos_ok,
      prep_acond_teclado,
      prep_acond_pantalla_carcasa,
      prep_acond_cargador,
      // Upgrade
      parte_cambiada,
      detalle_parte,
      // Conclusión
      conclusion
    } = body;

    if (!activo_id) {
      return res.status(400).json({ ok: false, msg: 'Falta activo_id.' });
    }

    const [act] = await db.execute(`SELECT id, numero_activo, categoria, remitente_nombre FROM activos WHERE id = ?`, [activo_id]);
    if (!act.length) {
      return res.status(404).json({ ok: false, msg: 'Activo no encontrado.' });
    }

    const sql = `
      INSERT INTO reportes_tecnicos (
        activo_id, numero_activo, estado_final,
        eval_enciende, eval_inicia_so, eval_puertos, eval_pantalla, eval_bateria, eval_audio, eval_teclado, eval_cargador, eval_tiene_tintas, eval_cable_poder, eval_cable_usb, eval_cable_video,
        prep_instalar_so, prep_cuenta_local_cyd, prep_instalar_drivers, prep_actualizacion_fw_so, prep_software_base_cyd, prep_crear_cuenta_admin, prep_quitar_cyd_admins, prep_agregar_cyd_avanzados,
        prep_diag_teclado, prep_diag_memoria, prep_diag_placa, prep_diag_procesador, prep_puertos_ok, prep_acond_teclado, prep_acond_pantalla_carcasa, prep_acond_cargador,
        parte_cambiada, detalle_parte,
        conclusion
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const vals = [
      activo_id,
      numero_activo || act[0].numero_activo || null,
      estado_final || null,

      !!eval_enciende, !!eval_inicia_so, !!eval_puertos, !!eval_pantalla, !!eval_bateria, !!eval_audio, !!eval_teclado, !!eval_cargador, !!eval_tiene_tintas, !!eval_cable_poder, !!eval_cable_usb, !!eval_cable_video,

      !!prep_instalar_so, !!prep_cuenta_local_cyd, !!prep_instalar_drivers, !!prep_actualizacion_fw_so, !!prep_software_base_cyd, !!prep_crear_cuenta_admin, !!prep_quitar_cyd_admins, !!prep_agregar_cyd_avanzados,

      !!prep_diag_teclado, !!prep_diag_memoria, !!prep_diag_placa, !!prep_diag_procesador, !!prep_puertos_ok, !!prep_acond_teclado, !!prep_acond_pantalla_carcasa, !!prep_acond_cargador,

      !!parte_cambiada,
      detalle_parte || null,

      conclusion || null
    ];

    const [result] = await db.execute(sql, vals);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al guardar reporte técnico.' });
  }
});

// ===============================
// NUEVO: Exportar PDF de un reporte
// ===============================
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

    const yn = (v) => v ? 'Sí' : 'No';

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
      ['Enciende', rep.eval_enciende],
      ['Inicia SO', rep.eval_inicia_so],
      ['Puertos Funcionales', rep.eval_puertos],
      ['Pantalla Funcional', rep.eval_pantalla],
      ['Batería Funcional', rep.eval_bateria],
      ['Audio Funcional', rep.eval_audio],
      ['Teclado Funcional', rep.eval_teclado],
      ['Cargador Funcional', rep.eval_cargador],
      ['Tiene Tintas', rep.eval_tiene_tintas],
      ['Cable de Poder', rep.eval_cable_poder],
      ['Cable USB', rep.eval_cable_usb],
      ['Cable VGA/HDMI', rep.eval_cable_video],
    ].forEach(([t, v]) => doc.text(`• ${t}: ${yn(v)}`));

    doc.moveDown().fontSize(12).text('Preparación:', { underline: true });
    doc.fontSize(10);
    [
      ['Instalar SO', rep.prep_instalar_so],
      ['Crear cuenta local CyD', rep.prep_cuenta_local_cyd],
      ['Instalar Drivers', rep.prep_instalar_drivers],
      ['Actualización FW/SO', rep.prep_actualizacion_fw_so],
      ['Software base CyD', rep.prep_software_base_cyd],
      ['Crear cuenta admin', rep.prep_crear_cuenta_admin],
      ['Quitar CyD de admins', rep.prep_quitar_cyd_admins],
      ['Agregar CyD a usuarios avanzados/red', rep.prep_agregar_cyd_avanzados],
      ['Diag. teclado', rep.prep_diag_teclado],
      ['Diag. memoria', rep.prep_diag_memoria],
      ['Diag. placa lógica', rep.prep_diag_placa],
      ['Diag. procesador', rep.prep_diag_procesador],
      ['Puertos OK', rep.prep_puertos_ok],
      ['Acond. teclado', rep.prep_acond_teclado],
      ['Acond. pantalla/carcasa', rep.prep_acond_pantalla_carcasa],
      ['Acond. cargador', rep.prep_acond_cargador],
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

module.exports = router;
