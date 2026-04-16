/**
 * server.js — Backend del Sistema de Gestión de Becas
 * Express + MariaDB + JWT
 *
 * Roles:
 *   admin      — acceso total
 *   financiero — lee beneficiarios, edita campos económicos, accede a Bolsa y Config
 *   operativo  — registra y edita datos personales de beneficiarios, sin acceso a dinero
 */
require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const path    = require('path');

const app        = express();
const PORT       = process.env.PORT       || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cambiar_en_produccion';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ============================================================
   CONEXIÓN A MARIADB
   ============================================================ */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'becas_db',
  waitForConnections: true,
  connectionLimit:    10,
  timezone:           '+00:00'
});

/* ============================================================
   MIDDLEWARES DE AUTENTICACIÓN Y ROLES
   ============================================================ */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Solo admin
function adminOnly(req, res, next) {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  next();
}

// Admin o financiero (operaciones económicas)
function canFinancial(req, res, next) {
  if (req.user.rol !== 'admin' && req.user.rol !== 'financiero') {
    return res.status(403).json({ error: 'Sin permisos para operaciones económicas' });
  }
  next();
}

// Admin u operativo (registrar / editar datos personales)
function canEditRecords(req, res, next) {
  if (req.user.rol !== 'admin' && req.user.rol !== 'operativo') {
    return res.status(403).json({ error: 'Sin permisos para modificar registros' });
  }
  next();
}

/* ============================================================
   HELPER — convierte fila DB a objeto frontend
   ============================================================ */
function mapBeneficiario(row) {
  return {
    id:              row.id,
    folio:           row.folio,
    nombre:          row.nombre,
    curp:            row.curp,
    correo:          row.correo      || '',
    telAlumno:       row.tel_alumno  || '',
    telFam1:         row.tel_fam1    || '',
    telFam2:         row.tel_fam2    || '',
    tipo:            row.tipo,
    estatus:         row.estatus,
    tipoBaja:        row.tipo_baja   || '',
    montoAutorizado: parseFloat(row.monto_autorizado) || 0,
    montoDerogado:   parseFloat(row.monto_derogado)   || 0
  };
}

/* Recalcula monto_derogado como suma de cheques y actualiza la tabla */
async function recalcularMontoDerogado(beneficiarioId) {
  const [rows] = await pool.query(
    'SELECT COALESCE(SUM(cantidad), 0) AS total FROM cheques WHERE beneficiario_id = ?',
    [beneficiarioId]
  );
  const total = parseFloat(rows[0].total) || 0;
  await pool.query(
    'UPDATE beneficiarios SET monto_derogado = ? WHERE id = ?',
    [total, beneficiarioId]
  );
  return total;
}

/* ============================================================
   RUTAS — AUTH
   ============================================================ */

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const user = rows[0];
    const ok   = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, usuario: user.usuario, rol: user.rol });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/auth/password — cualquier usuario puede cambiar su propia contraseña
app.put('/api/auth/password', auth, async (req, res) => {
  const { passActual, passNueva } = req.body;
  if (!passActual || !passNueva || passNueva.length < 6) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const ok = await bcrypt.compare(passActual, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(passNueva, 10);
    await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/* ============================================================
   RUTAS — CONFIGURACIÓN
   Solo financiero y admin pueden leer/escribir
   ============================================================ */

app.get('/api/config', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM config LIMIT 1');
    if (!rows.length) return res.json({ bolsaGlobal: 1150000, periodo: 'Agosto - Diciembre 2025' });
    res.json({ bolsaGlobal: parseFloat(rows[0].bolsa_global), periodo: rows[0].periodo });
  } catch (err) {
    console.error('Config GET error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.put('/api/config', auth, async (req, res) => {
  const rol = req.user.rol;
  if (rol !== 'admin' && rol !== 'financiero' && rol !== 'operativo') {
    return res.status(403).json({ error: 'Sin permisos' });
  }
  const { bolsaGlobal, periodo } = req.body;
  try {
    const [rows] = await pool.query('SELECT id FROM config LIMIT 1');
    const id = rows.length ? rows[0].id : null;

    if (rol === 'financiero') {
      // Solo puede cambiar bolsa global
      if (bolsaGlobal === undefined) return res.status(400).json({ error: 'Falta bolsaGlobal' });
      if (id) {
        await pool.query('UPDATE config SET bolsa_global = ? WHERE id = ?', [bolsaGlobal, id]);
      } else {
        await pool.query('INSERT INTO config (bolsa_global) VALUES (?)', [bolsaGlobal]);
      }
    } else if (rol === 'operativo') {
      // Solo puede cambiar el periodo académico
      if (!periodo) return res.status(400).json({ error: 'Falta periodo' });
      if (id) {
        await pool.query('UPDATE config SET periodo = ? WHERE id = ?', [periodo, id]);
      } else {
        await pool.query('INSERT INTO config (periodo) VALUES (?)', [periodo]);
      }
    } else {
      // admin — actualiza todo
      if (bolsaGlobal === undefined || !periodo) return res.status(400).json({ error: 'Datos incompletos' });
      if (id) {
        await pool.query('UPDATE config SET bolsa_global = ?, periodo = ? WHERE id = ?',
          [bolsaGlobal, periodo, id]);
      } else {
        await pool.query('INSERT INTO config (bolsa_global, periodo) VALUES (?, ?)', [bolsaGlobal, periodo]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Config PUT error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/* ============================================================
   RUTAS — BENEFICIARIOS
   ============================================================ */

// GET — todos los roles pueden leer
app.get('/api/beneficiarios', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM beneficiarios ORDER BY id ASC');
    res.json(rows.map(mapBeneficiario));
  } catch (err) {
    console.error('Beneficiarios GET error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST — admin u operativo pueden registrar nuevos beneficiarios
app.post('/api/beneficiarios', auth, canEditRecords, async (req, res) => {
  const b   = req.body;
  const rol = req.user.rol;
  // Solo admin puede fijar el monto autorizado al registrar
  const montoAutorizado = (rol === 'admin') ? (parseFloat(b.montoAutorizado) || 0) : 0;
  try {
    const [result] = await pool.query(
      `INSERT INTO beneficiarios
         (folio, nombre, curp, correo, tel_alumno, tel_fam1, tel_fam2,
          tipo, estatus, tipo_baja, monto_autorizado, monto_derogado,
          cheque_fecha, cheque_cantidad, cheque_folio)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        b.folio, b.nombre, b.curp, b.correo || '',
        b.telAlumno || '', b.telFam1 || '', b.telFam2 || '',
        b.tipo, b.estatus, b.tipoBaja || '',
        montoAutorizado, 0, null, 0, ''
      ]
    );
    const [rows] = await pool.query('SELECT * FROM beneficiarios WHERE id = ?', [result.insertId]);
    res.status(201).json(mapBeneficiario(rows[0]));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'CURP o folio ya registrado' });
    console.error('Beneficiarios POST error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT — lógica de campos según rol
app.put('/api/beneficiarios/:id', auth, async (req, res) => {
  const rol = req.user.rol;
  // operativo: solo datos personales
  // financiero: solo campos económicos
  // admin: todo
  if (rol !== 'admin' && rol !== 'financiero' && rol !== 'operativo') {
    return res.status(403).json({ error: 'Sin permisos' });
  }

  const id = parseInt(req.params.id);
  const b  = req.body;

  try {
    const [check] = await pool.query('SELECT * FROM beneficiarios WHERE id = ?', [id]);
    if (!check.length) return res.status(404).json({ error: 'Beneficiario no encontrado' });

    if (rol === 'operativo') {
      // Solo actualiza campos personales, tipo y estatus
      await pool.query(
        `UPDATE beneficiarios SET
           nombre=?, curp=?, correo=?, tel_alumno=?, tel_fam1=?, tel_fam2=?,
           tipo=?, estatus=?, tipo_baja=?
         WHERE id=?`,
        [
          b.nombre, b.curp, b.correo || '', b.telAlumno || '', b.telFam1 || '', b.telFam2 || '',
          b.tipo, b.estatus, b.tipoBaja || '',
          id
        ]
      );
    } else if (rol === 'financiero') {
      // Solo actualiza monto_autorizado (monto_derogado se calcula automáticamente de cheques)
      await pool.query(
        `UPDATE beneficiarios SET monto_autorizado=? WHERE id=?`,
        [b.montoAutorizado || 0, id]
      );
    } else {
      // admin — actualiza todo menos monto_derogado (calculado de cheques)
      await pool.query(
        `UPDATE beneficiarios SET
           nombre=?, curp=?, correo=?, tel_alumno=?, tel_fam1=?, tel_fam2=?,
           tipo=?, estatus=?, tipo_baja=?,
           monto_autorizado=?
         WHERE id=?`,
        [
          b.nombre, b.curp, b.correo || '', b.telAlumno || '', b.telFam1 || '', b.telFam2 || '',
          b.tipo, b.estatus, b.tipoBaja || '',
          b.montoAutorizado || 0,
          id
        ]
      );
    }

    const [rows] = await pool.query('SELECT * FROM beneficiarios WHERE id = ?', [id]);
    res.json(mapBeneficiario(rows[0]));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'CURP ya registrada en otro beneficiario' });
    console.error('Beneficiarios PUT error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/* ============================================================
   RUTAS — CHEQUES
   ============================================================ */

// GET — lista cheques de un beneficiario (todos los roles)
app.get('/api/beneficiarios/:id/cheques', auth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cheques WHERE beneficiario_id = ? ORDER BY fecha ASC, id ASC',
      [id]
    );
    res.json(rows.map(r => ({
      id:       r.id,
      fecha:    r.fecha ? new Date(r.fecha).toISOString().slice(0, 10) : '',
      cantidad: parseFloat(r.cantidad) || 0,
      folio:    r.folio || ''
    })));
  } catch (err) {
    console.error('Cheques GET error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST — agrega un cheque y recalcula monto_derogado (financiero y admin)
app.post('/api/beneficiarios/:id/cheques', auth, canFinancial, async (req, res) => {
  const beneficiarioId = parseInt(req.params.id);
  const { fecha, cantidad, folio } = req.body;
  try {
    const [check] = await pool.query('SELECT id, monto_autorizado, monto_derogado FROM beneficiarios WHERE id = ?', [beneficiarioId]);
    if (!check.length) return res.status(404).json({ error: 'Beneficiario no encontrado' });

    const montoAutorizado = parseFloat(check[0].monto_autorizado) || 0;
    const montoDerogado   = parseFloat(check[0].monto_derogado)   || 0;
    const nuevaCantidad   = parseFloat(cantidad) || 0;
    if (montoAutorizado > 0 && montoDerogado + nuevaCantidad > montoAutorizado) {
      return res.status(400).json({
        error: `El total de cheques excedería el monto autorizado. Disponible: $${(montoAutorizado - montoDerogado).toFixed(2)}`
      });
    }

    const [result] = await pool.query(
      'INSERT INTO cheques (beneficiario_id, fecha, cantidad, folio) VALUES (?, ?, ?, ?)',
      [beneficiarioId, fecha || null, parseFloat(cantidad) || 0, folio || '']
    );
    const nuevoMontoDerogado = await recalcularMontoDerogado(beneficiarioId);
    const [rows] = await pool.query('SELECT * FROM cheques WHERE id = ?', [result.insertId]);
    res.status(201).json({
      cheque: {
        id:       rows[0].id,
        fecha:    rows[0].fecha ? new Date(rows[0].fecha).toISOString().slice(0, 10) : '',
        cantidad: parseFloat(rows[0].cantidad) || 0,
        folio:    rows[0].folio || ''
      },
      montoDerogado: nuevoMontoDerogado
    });
  } catch (err) {
    console.error('Cheques POST error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE — eliminación de cheques deshabilitada
app.delete('/api/cheques/:id', auth, (req, res) => {
  res.status(403).json({ error: 'La eliminación de cheques no está permitida.' });
});

/* ============================================================
   FALLBACK
   ============================================================ */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ============================================================
   INICIO DEL SERVIDOR
   ============================================================ */
app.listen(PORT, async () => {
  // Crea la tabla cheques si no existe (migración automática)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        beneficiario_id  INT NOT NULL,
        fecha            DATE          DEFAULT NULL,
        cantidad         DECIMAL(10,2) DEFAULT 0.00,
        folio            VARCHAR(50)   DEFAULT '',
        creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cheque_benef
          FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('✓ Tabla cheques verificada.');
  } catch (err) {
    console.error('Error al verificar tabla cheques:', err.message);
  }

  console.log(`\nServidor corriendo en http://localhost:${PORT}`);
  console.log('Presiona Ctrl+C para detenerlo.\n');
});
