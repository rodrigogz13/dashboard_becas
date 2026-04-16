-- ============================================================
-- Sistema de Gestión de Becas — Esquema MariaDB
-- Ejecutar en phpMyAdmin o en la terminal de MySQL/MariaDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS becas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE becas_db;

-- ────────────────────────────────────────────────────────────
-- USUARIOS DEL SISTEMA
-- Las contraseñas se insertan con setup.js (bcrypt)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario    VARCHAR(50)  UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  rol        ENUM('admin','financiero','operativo') NOT NULL DEFAULT 'operativo',
  creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- CONFIGURACIÓN GENERAL
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  bolsa_global    DECIMAL(12,2) NOT NULL DEFAULT 1150000.00,
  periodo         VARCHAR(100)  NOT NULL DEFAULT 'Agosto - Diciembre 2025',
  actualizado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO config (bolsa_global, periodo)
VALUES (1150000.00, 'Agosto - Diciembre 2025');

-- ────────────────────────────────────────────────────────────
-- BENEFICIARIOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beneficiarios (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  folio             VARCHAR(20)  UNIQUE NOT NULL,
  nombre            VARCHAR(150) NOT NULL,
  curp              VARCHAR(18)  UNIQUE NOT NULL,
  correo            VARCHAR(100) DEFAULT '',
  tel_alumno        VARCHAR(20)  DEFAULT '',
  tel_fam1          VARCHAR(20)  DEFAULT '',
  tel_fam2          VARCHAR(20)  DEFAULT '',
  tipo              ENUM(
                      'Nuevo ingreso',
                      'Carrera Trunca',
                      'Carrera Inconclusa',
                      'Titulación',
                      'Titulación Posgrado'
                    ) NOT NULL,
  estatus           ENUM('Activo','Baja','Suspendido') NOT NULL DEFAULT 'Activo',
  tipo_baja         VARCHAR(20)   DEFAULT '',
  monto_autorizado  DECIMAL(10,2) DEFAULT 0.00,
  monto_derogado    DECIMAL(10,2) DEFAULT 0.00,
  cheque_fecha      DATE          DEFAULT NULL,
  cheque_cantidad   DECIMAL(10,2) DEFAULT 0.00,
  cheque_folio      VARCHAR(50)   DEFAULT '',
  creado_en         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- CHEQUES (múltiples por beneficiario)
-- Ejecutar también en instalaciones existentes:
--   CREATE TABLE IF NOT EXISTS cheques (...) ENGINE=InnoDB;
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cheques (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  beneficiario_id  INT NOT NULL,
  fecha            DATE          DEFAULT NULL,
  cantidad         DECIMAL(10,2) DEFAULT 0.00,
  folio            VARCHAR(50)   DEFAULT '',
  creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cheque_benef
    FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
