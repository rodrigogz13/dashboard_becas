/**
 * setup.js — Ejecutar UNA SOLA VEZ para crear los usuarios iniciales
 * Comando: node setup.js
 */
require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function setup() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'becas_db'
  });

  console.log('Conectado a MariaDB. Creando usuarios...\n');

  const usuarios = [
    { usuario: 'admin',      password: 'admin123',      rol: 'admin' },
    { usuario: 'financiero', password: 'financiero123', rol: 'financiero' },
    { usuario: 'operativo',  password: 'operativo123',  rol: 'operativo' },
  ];

  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.password, 10);
    await conn.query(
      'INSERT IGNORE INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)',
      [u.usuario, hash, u.rol]
    );
  }

  console.log('Usuarios creados exitosamente:');
  console.log('  admin      / admin123      — Rol: admin      (acceso total)');
  console.log('  financiero / financiero123 — Rol: financiero (solo dinero)');
  console.log('  operativo  / operativo123  — Rol: operativo  (solo registros)');
  console.log('\nIMPORTANTE: Cambia las contraseñas desde Configuración una vez que inicies sesión.');

  await conn.end();
}

setup().catch(err => {
  console.error('Error en setup:', err.message);
  process.exit(1);
});
