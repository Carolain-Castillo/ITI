// backend/routes/dispositivos.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ========= para PDF =========
const PDFDocument = require('pdfkit');

// ========= ENV / MAIL (nuevo) =========
const nodemailer = require('nodemailer');

// helper: generar PDF en Buffer
function pdfToBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      buildFn(doc); // el caller escribe aquí
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function yn(v) { return v ? 'Sí' : 'No'; }

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
        origen
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

// ===== Actualizar activo completo =====
router.patch('/activos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Recibimos TODO (si te interesa, puedes validar obligatorios)
    const body = req.body || {};
    const permitidosEstado = ['Disponible','Pendiente','Proceso','Tránsito',
      'Por Retirar','Asignado','Reasignado','Reciclaje','Vendido','Préstamo','Repuesto','Donar'];

    if (body.estado && !permitidosEstado.includes(body.estado)) {
      return res.status(400).json({ ok:false, msg:'Estado inválido.' });
    }

    const sql = `
      UPDATE activos SET
        numero_activo = ?,
        categoria = ?,
        ticket = ?,
        anios = ?,
        remitente_nombre = ?,
        fecha_recepcion_ti = ?,
        origen = ?,
        fecha_compra = ?,
        caracteristicas = ?,
        notas = ?,
        estado = ?,
        iv_carcasa = ?,
        iv_teclado = ?,
        iv_pantalla = ?,
        iv_puertos = ?,
        iv_cargador = ?,
        iv_sin_danos = ?,
        iv_otro = ?
      WHERE id = ?
    `;

    const params = [
      body.numero_activo ?? null,
      body.categoria ?? null,
      body.ticket ?? null,
      body.anios ?? null,
      body.remitente_nombre ?? null,
      body.fecha_recepcion_ti ?? null,
      body.origen ?? null,
      body.fecha_compra ?? null,
      body.caracteristicas ?? null,
      body.notas ?? null,
      body.estado ?? null,
      body.iv_carcasa ? 1 : 0,
      body.iv_teclado ? 1 : 0,
      body.iv_pantalla ? 1 : 0,
      body.iv_puertos ? 1 : 0,
      body.iv_cargador ? 1 : 0,
      body.iv_sin_danos ? 1 : 0,
      (body.iv_otro && String(body.iv_otro).trim() !== '') ? String(body.iv_otro).trim() : null,
      id
    ];

    const [result] = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok:false, msg:'Activo no encontrado' });
    }

    // NOTA: La fase se sincroniza por TRIGGER cuando cambia "estado".
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
//  Crear reporte técnico
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
//  Exportar PDF de un reporte
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

// ===============================
// Listar reportes por activo (para el ojo)
// ===============================
router.get('/reportes-tecnicos', async (req, res) => {
  try {
    const { activo_id } = req.query;
    if (!activo_id) {
      return res.status(400).json({ ok:false, msg:'Falta activo_id' });
    }
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

// ===============================
//  NUEVO: Enviar correo con PDF de Entrega (+ último reporte si existe)
// ===============================
router.post('/entregas/enviar', async (req, res) => {
  try {
    const {
      activo_id,
      nombre_quien_retira,
      correo_quien_retira
    } = req.body || {};

    if (!activo_id || !nombre_quien_retira || !correo_quien_retira) {
      return res.status(400).json({ ok:false, msg:'Faltan datos (activo_id, nombre y correo de quien retira).' });
    }

    // Traer activo
    const [acts] = await db.execute(`SELECT * FROM activos WHERE id = ?`, [activo_id]);
    if (!acts.length) return res.status(404).json({ ok:false, msg:'Activo no encontrado.' });
    const a = acts[0];

    // Traer último reporte técnico (opcional)
    const [reps] = await db.execute(
      `SELECT * FROM reportes_tecnicos WHERE activo_id = ? ORDER BY id DESC LIMIT 1`,
      [activo_id]
    );
    const rep = reps.length ? reps[0] : null;

    // Construir PDF (Entrega + info de activo + (opcional) bloque de reporte técnico)
    const pdfBuffer = await pdfToBuffer((doc) => {
      // Portada / Encabezado
      doc.fontSize(18).text('Entrega de Activo', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Fecha: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();

      // Datos de quien retira
      doc.fontSize(12).text('Datos de Entrega', { underline: true });
      doc.fontSize(10)
        .text(`Nombre de quien retira: ${nombre_quien_retira}`)
        .text(`Correo de quien retira: ${correo_quien_retira}`);
      doc.moveDown();

      // Info del activo
      doc.fontSize(12).text('Información del Activo', { underline: true });
      doc.fontSize(10)
        .text(`N° Activo: ${a.numero_activo || ''}`)
        .text(`Categoría: ${a.categoria || ''}`)
        .text(`Estado: ${a.estado || ''}`)
        .text(`Fase: ${a.fase || ''}`)
        .text(`Ticket: ${a.ticket || ''}`)
        .text(`Origen: ${a.origen || ''}`)
        .text(`Remitente: ${a.remitente_nombre || ''}`)
        .text(`Fecha Recepción TI: ${a.fecha_recepcion_ti ? String(a.fecha_recepcion_ti).split('T')[0] : ''}`)
        .text(`Fecha Compra: ${a.fecha_compra ? String(a.fecha_compra).split('T')[0] : ''}`)
        .text(`Años: ${a.anios ?? ''}`);
      doc.moveDown();

      if (a.caracteristicas) {
        doc.fontSize(12).text('Características', { underline: true });
        doc.fontSize(10).text(String(a.caracteristicas), { align: 'justify' });
        doc.moveDown();
      }
      if (a.notas) {
        doc.fontSize(12).text('Notas', { underline: true });
        doc.fontSize(10).text(String(a.notas), { align: 'justify' });
        doc.moveDown();
      }

      // Inspección visual
      doc.fontSize(12).text('Inspección Visual', { underline: true });
      doc.fontSize(10);
      const ivs = [
        ['Daños en Carcasa', a.iv_carcasa],
        ['Daños en el Teclado', a.iv_teclado],
        ['Pantalla Rota', a.iv_pantalla],
        ['Puertos Dañados', a.iv_puertos],
        ['Con Cargador', a.iv_cargador],
        ['Sin daños visibles', a.iv_sin_danos]
      ];
      ivs.forEach(([t, v]) => doc.text(`• ${t}: ${yn(!!v)}`));
      if (a.iv_otro) doc.text(`• Otro: ${a.iv_otro}`);
      doc.moveDown();

      // (Opcional) bloque Reporte Técnico
      if (rep) {
        doc.addPage();
        doc.fontSize(16).text('Reporte Técnico', { align: 'center' });
        doc.moveDown();

        doc.fontSize(11)
          .text(`N° Activo: ${rep.numero_activo || a.numero_activo || ''}`)
          .text(`Estado final: ${rep.estado_final || ''}`);
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
          ['Instalar Drivers (HP, Lenovo, Dell)', rep.prep_instalar_drivers],
          ['Actualización Firmware y SO', rep.prep_actualizacion_fw_so],
          ['Instalar Software base CyD', rep.prep_software_base_cyd],
          ['Crear cuenta de administrador', rep.prep_crear_cuenta_admin],
          ['Quitar cuenta CyD de administradores', rep.prep_quitar_cyd_admins],
          ['Agregar CyD a usuarios avanzados/red', rep.prep_agregar_cyd_avanzados],
          ['Diagnóstico de teclado', rep.prep_diag_teclado],
          ['Diagnóstico de memoria', rep.prep_diag_memoria],
          ['Diagnóstico de placa lógica', rep.prep_diag_placa],
          ['Diagnóstico de procesador', rep.prep_diag_procesador],
          ['Puertos funcionan correctamente', rep.prep_puertos_ok],
          ['Acondicionamiento de teclado', rep.prep_acond_teclado],
          ['Acondicionamiento de pantalla/carcasa', rep.prep_acond_pantalla_carcasa],
          ['Acondicionamiento del cargador', rep.prep_acond_cargador],
        ].forEach(([t, v]) => doc.text(`• ${t}: ${yn(v)}`));

        if (rep.parte_cambiada || rep.detalle_parte) {
          doc.moveDown().fontSize(12).text('Mejora (upgrade):', { underline: true });
          doc.fontSize(10).text(`Parte cambiada: ${rep.parte_cambiada ? (rep.detalle_parte || 'Sí') : 'No'}`);
        }

        if (rep.conclusion) {
          doc.moveDown().fontSize(12).text('Conclusión y Recomendaciones:', { underline: true });
          doc.fontSize(10).text(rep.conclusion, { align: 'justify' });
        }
      }
    });

    // Transporter SMTP (Gmail)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true', // true para 465
      auth: {
        user: process.env.SMTP_USER, // ccastillo@cydingenieria.com
        pass: process.env.SMTP_PASS  // App Password
      }
    });

    const toEmail = process.env.MAIL_TO || 'c.pamelacastillorojas@gmail.com';
    const fromName = process.env.MAIL_FROM_NAME || 'CyD ITI';
    const subject = `Entrega de Activo ${a.numero_activo || ''} — ${nombre_quien_retira}`;

    await transporter.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER || 'ccastillo@cydingenieria.com'}>`,
      to: toEmail,
      // puedes añadir copia opcional al retirante:
      // cc: correo_quien_retira,
      subject,
      text: `Se adjunta PDF con la información del activo y los datos de entrega.
      
Activo: ${a.numero_activo || ''}
Categoría: ${a.categoria || ''}
Estado: ${a.estado || ''}

Retira: ${nombre_quien_retira}
Correo quien retira: ${correo_quien_retira}
`,
      attachments: [
        {
          filename: `entrega_${a.numero_activo || 'activo'}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, msg:'No se pudo enviar el correo.' });
  }
});

module.exports = router;
