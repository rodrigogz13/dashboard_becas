# Manual de Usuario
# Sistema de Gestión de Becas — Dashboard Becas

---

## Tabla de Contenidos

1. [Ficha Técnica](#1-ficha-técnica)
2. [Requisitos del Sistema](#2-requisitos-del-sistema)
3. [Instalación](#3-instalación)
4. [Configuración Inicial](#4-configuración-inicial)
5. [Inicio de Sesión](#5-inicio-de-sesión)
6. [Roles de Usuario](#6-roles-de-usuario)
7. [Módulos del Sistema](#7-módulos-del-sistema)
   - [7.1 Inicio (Dashboard)](#71-inicio-dashboard)
   - [7.2 Registrar Persona](#72-registrar-persona)
   - [7.3 Buscar / Editar](#73-buscar--editar)
   - [7.4 Bolsa de Dinero](#74-bolsa-de-dinero)
   - [7.5 Reportes](#75-reportes)
   - [7.6 Configuración](#76-configuración)
8. [Gestión de Cheques](#8-gestión-de-cheques)
9. [Reglas de Validación](#9-reglas-de-validación)
10. [Lógica Presupuestal](#10-lógica-presupuestal)
11. [Exportación de Datos](#11-exportación-de-datos)
12. [Preguntas Frecuentes](#12-preguntas-frecuentes)

---

## 1. Ficha Técnica

| Campo | Detalle |
|-------|---------|
| **Nombre del sistema** | Dashboard Becas — Sistema de Gestión de Becas |
| **Versión** | 1.0.0 |
| **Tipo de aplicación** | Aplicación web de página única (SPA) |
| **Arquitectura** | Cliente-Servidor (REST API + Frontend Vanilla JS) |
| **Lenguaje backend** | JavaScript — Node.js |
| **Framework backend** | Express.js v4.19.2 |
| **Lenguaje frontend** | JavaScript puro (Vanilla JS), HTML5, CSS3 |
| **Base de datos** | MariaDB / MySQL |
| **Autenticación** | JWT (JSON Web Token) — expiración: 8 horas |
| **Cifrado de contraseñas** | bcrypt (10 rondas) |
| **Puerto por defecto** | 3000 |
| **Licencia** | Consultar archivo `LICENSE` |
| **Repositorio** | https://github.com/rodrigogz13/dashboard_becas |

### Dependencias principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| express | 4.19.2 | Servidor HTTP y enrutamiento |
| mysql2 | 3.9.7 | Conexión a base de datos MariaDB/MySQL |
| jsonwebtoken | 9.0.2 | Autenticación JWT |
| bcrypt | 5.1.1 | Hash seguro de contraseñas |
| dotenv | 16.6.1 | Variables de entorno |
| cors | 2.8.5 | Control de origen cruzado |
| nodemon | 3.1.0 | Recarga automática (solo desarrollo) |

### Estructura de archivos

```
dashboard_becas/
├── server.js          # Servidor Node.js / API REST
├── app.js             # Lógica del frontend (SPA)
├── index.html         # Plantilla HTML principal
├── styles.css         # Estilos CSS
├── database.sql       # Esquema de base de datos
├── setup.js           # Script de usuarios iniciales
├── package.json       # Dependencias del proyecto
└── .env               # Variables de entorno (crear manualmente)
```

---

## 2. Requisitos del Sistema

### Software requerido

| Componente | Versión mínima | Notas |
|-----------|---------------|-------|
| Node.js | 18.x o superior | Incluye npm |
| MariaDB o MySQL | 8.0 / 10.6 o superior | — |
| Navegador web | Moderno (Chrome, Firefox, Edge) | No soporta IE |

### Hardware recomendado (servidor)

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 1 núcleo | 2 núcleos |
| RAM | 512 MB | 1 GB |
| Almacenamiento | 500 MB libres | 2 GB |

---

## 3. Instalación

### Paso 1 — Clonar o descargar el proyecto

```bash
git clone https://github.com/rodrigogz13/dashboard_becas.git
cd dashboard_becas
```

O descomprimir el archivo `.zip` del proyecto en la carpeta deseada.

### Paso 2 — Instalar dependencias de Node.js

```bash
npm install
```

### Paso 3 — Crear la base de datos

Abrir el cliente de MariaDB/MySQL y ejecutar el script incluido:

```bash
mysql -u root -p < database.sql
```

O bien, desde el cliente MySQL:

```sql
SOURCE /ruta/al/proyecto/database.sql;
```

Esto creará la base de datos `becas_db` con todas las tablas necesarias.

### Paso 4 — Crear el archivo de variables de entorno

En la raíz del proyecto, crear un archivo llamado `.env` con el siguiente contenido:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña_de_mysql
DB_NAME=becas_db
JWT_SECRET=una_clave_secreta_segura_aqui
```

> **IMPORTANTE:** Cambia `tu_contraseña_de_mysql` por la contraseña real de tu servidor MySQL, y reemplaza `una_clave_secreta_segura_aqui` por una cadena aleatoria larga. Nunca compartas este archivo.

### Paso 5 — Crear los usuarios iniciales del sistema

Ejecutar el script de configuración **una sola vez**:

```bash
node setup.js
```

Este script crea los tres usuarios predeterminados del sistema (ver sección [Roles de Usuario](#6-roles-de-usuario)).

### Paso 6 — Iniciar el servidor

**Modo producción:**
```bash
npm start
```

**Modo desarrollo** (con recarga automática al guardar cambios):
```bash
npm run dev
```

### Paso 7 — Acceder al sistema

Abrir el navegador y navegar a:

```
http://localhost:3000
```

El sistema mostrará la pantalla de inicio de sesión.

---

## 4. Configuración Inicial

Antes de registrar beneficiarios, el administrador debe configurar:

1. **Bolsa global:** El monto total disponible para becas del período.
2. **Período académico:** Nombre o identificador del período vigente (p. ej. `2025-1`).

Estos valores se configuran en el módulo **Configuración** (ver sección [7.6](#76-configuración)).

---

## 5. Inicio de Sesión

Al ingresar a `http://localhost:3000`, el sistema muestra el formulario de inicio de sesión.

**Credenciales predeterminadas** (creadas por `setup.js`):

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Administrador |
| `financiero` | `financiero123` | Financiero |
| `operativo` | `operativo123` | Operativo |

> **Recomendación de seguridad:** Cambiar las contraseñas predeterminadas inmediatamente después del primer acceso desde el módulo **Configuración → Cambiar contraseña**.

**Comportamiento de sesión:**
- La sesión expira automáticamente después de **8 horas**.
- Si la sesión expira, el sistema redirige automáticamente al login.
- Al cerrar la pestaña del navegador, la sesión se termina.

---

## 6. Roles de Usuario

El sistema cuenta con tres roles, cada uno con permisos distintos:

### Administrador (`admin`)

Acceso total al sistema.

| Acción | ¿Permitido? |
|--------|------------|
| Crear beneficiarios | ✅ |
| Editar datos personales | ✅ |
| Editar monto autorizado | ✅ |
| Registrar cheques | ✅ |
| Cambiar bolsa global | ✅ |
| Cambiar período académico | ✅ |
| Cambiar contraseña | ✅ |

### Financiero (`financiero`)

Especialista en operaciones financieras.

| Acción | ¿Permitido? |
|--------|------------|
| Crear beneficiarios | ❌ |
| Editar datos personales | ❌ |
| Editar monto autorizado | ✅ |
| Registrar cheques | ✅ |
| Cambiar bolsa global | ✅ |
| Cambiar período académico | ❌ |
| Cambiar contraseña | ✅ |

### Operativo (`operativo`)

Encargado del registro y seguimiento administrativo.

| Acción | ¿Permitido? |
|--------|------------|
| Crear beneficiarios | ✅ |
| Editar datos personales | ✅ |
| Editar monto autorizado | ❌ |
| Registrar cheques | ❌ |
| Cambiar bolsa global | ❌ |
| Cambiar período académico | ✅ |
| Cambiar contraseña | ✅ |

---

## 7. Módulos del Sistema

### 7.1 Inicio (Dashboard)

La pantalla principal muestra un resumen general del estado de las becas.

**Tarjetas de resumen:**

| Tarjeta | Descripción |
|---------|-------------|
| Bolsa Global | Monto total asignado para el período |
| Total Asignado | Suma de montos autorizados a beneficiarios activos |
| Disponible | Bolsa global menos lo asignado y lo derogado a bajas |
| Beneficiarios Activos | Número de beneficiarios con estatus "Activo" |

**Tabla de beneficiarios recientes:** Muestra los últimos registros ingresados al sistema con folio, nombre, tipo, monto autorizado, monto derogado y estatus.

---

### 7.2 Registrar Persona

Formulario para dar de alta a un nuevo beneficiario de beca.

**Campos del formulario:**

| Campo | Tipo | Obligatorio | Notas |
|-------|------|------------|-------|
| Folio | Texto (auto) | — | Generado automáticamente |
| Nombre completo | Texto | ✅ | — |
| CURP | Texto | ✅ | 18 caracteres, formato oficial |
| Correo electrónico | Email | ✅ | — |
| Teléfono del alumno | Número | ✅ | 10 dígitos |
| Teléfono familiar 1 | Número | Opcional | 10 dígitos o vacío |
| Teléfono familiar 2 | Número | Opcional | 10 dígitos o vacío |
| Tipo de beca | Selección | ✅ | Ver tabla de tipos |
| Estatus | Selección | ✅ | Activo / Baja / Suspendido |
| Tipo de baja | Selección | Condicional | Solo si estatus = Baja |
| Monto autorizado | Decimal | Solo Admin | En pesos (sin coma) |

**Tipos de beca y códigos de folio:**

| Tipo | Código en folio |
|------|----------------|
| Nuevo ingreso | `NI` |
| Carrera Trunca | `CT` |
| Continuidad | `CI` |
| Titulación | `TI` |
| Titulación Posgrado | `TP` |

**Formato del folio auto-generado:**

```
AA-CÓDIGO-NNNN

Ejemplo:  25-NI-0001  (año 2025, Nuevo Ingreso, primer registro)
          25-CT-0003  (año 2025, Carrera Trunca, tercer registro)
```

**Pasos para registrar un beneficiario:**

1. Ingresar al módulo **Registrar Persona** desde el menú lateral.
2. El campo **Folio** se genera automáticamente; no requiere intervención.
3. Completar todos los campos obligatorios.
4. Si el alumno tiene beca, ingresar el **Monto Autorizado** (solo visible para administrador).
5. Seleccionar el **Estatus**. Si es "Baja", aparecerá el campo **Tipo de Baja**.
6. Hacer clic en **Guardar**.
7. El sistema mostrará una confirmación y limpiará el formulario.

---

### 7.3 Buscar / Editar

Módulo de búsqueda y modificación de beneficiarios existentes.

**Búsqueda:**
- La búsqueda es en tiempo real (sin necesidad de presionar Enter).
- Se puede buscar por: **Folio**, **Nombre** o **CURP**.
- Los resultados aparecen en el panel izquierdo.

**Edición:**

1. Seleccionar un beneficiario de la lista de resultados.
2. En el panel derecho aparecen los datos del beneficiario.
3. Los campos visibles y editables dependen del rol del usuario (ver [sección 6](#6-roles-de-usuario)).
4. Modificar los campos necesarios.
5. Hacer clic en **Guardar cambios**.

**Sección de cheques** (visible dentro del detalle del beneficiario):
- Muestra la lista de cheques registrados para ese beneficiario.
- Permite agregar nuevos cheques (usuarios con rol Admin o Financiero).
- Consultar sección [8](#8-gestión-de-cheques) para más detalles.

---

### 7.4 Bolsa de Dinero

Módulo de visualización del presupuesto y distribución por tipo de beca.

**Tarjetas superiores:**

| Tarjeta | Descripción |
|---------|-------------|
| Bolsa Global | Monto total configurado para el período |
| Total Asignado | Suma de montos autorizados (solo beneficiarios activos) |
| Disponible | Monto libre (bolsa - asignado - derogado en bajas) |
| Total Activos | Cantidad de beneficiarios con estatus "Activo" |

**Barra de progreso:** Muestra visualmente qué porcentaje del presupuesto ha sido asignado.

**Distribución por tipo:** Desglose del monto asignado y número de beneficiarios para cada tipo de beca (NI, CT, CI, TI, TP), representado con barras de colores.

> **Nota:** Solo se contabilizan beneficiarios con estatus **Activo** en este módulo.

---

### 7.5 Reportes

Módulo para visualizar y exportar el padrón de beneficiarios.

**Tarjetas de resumen:**

| Tarjeta | Descripción |
|---------|-------------|
| Total | Total de beneficiarios registrados |
| Activos | Beneficiarios con estatus "Activo" |
| Inactivos | Beneficiarios con estatus "Baja" o "Suspendido" |
| Total Asignado | Suma de montos autorizados de todos los registros |

**Tabla de reportes:**

Columnas: Folio, Nombre, Tipo, Monto Autorizado, Monto Derogado, Folio de Cheque, Estatus.

La fila inferior muestra los **totales** de montos autorizados y derogados.

**Filtros disponibles:**
- Todos
- Activos
- Baja
- Suspendido

**Exportación a CSV:**

1. Aplicar el filtro deseado (opcional).
2. Hacer clic en el botón **Exportar CSV**.
3. El archivo se descarga con el nombre `reporte_becas_YYYY-MM-DD.csv`.
4. Compatible con Microsoft Excel, LibreOffice Calc y Google Sheets.

---

### 7.6 Configuración

Módulo de ajustes del sistema y gestión de contraseñas.

#### Bolsa Global (Admin / Financiero)

Permite actualizar el monto total del presupuesto de becas para el período vigente.

1. Ingresar el nuevo monto en el campo **Bolsa Global**.
2. Hacer clic en **Actualizar Bolsa**.

#### Período Académico (Admin / Operativo)

Permite actualizar el identificador del período académico actual.

1. Ingresar el nuevo período (p. ej. `2025-2`) en el campo **Período**.
2. Hacer clic en **Actualizar Período**.

#### Cambiar Contraseña (Todos los roles)

Todos los usuarios pueden cambiar su propia contraseña.

1. Ingresar la **contraseña actual**.
2. Ingresar la **nueva contraseña** (mínimo 6 caracteres).
3. Confirmar la nueva contraseña.
4. Hacer clic en **Cambiar Contraseña**.

> **Nota:** No existe recuperación automática de contraseña por correo. Si un usuario olvida su contraseña, el administrador debe resetearla directamente en la base de datos o mediante acceso al servidor.

---

## 8. Gestión de Cheques

Los cheques representan los pagos realizados a cada beneficiario.

### Registrar un cheque

Solo los roles **Admin** y **Financiero** pueden registrar cheques.

1. Ir al módulo **Buscar / Editar**.
2. Seleccionar el beneficiario en la lista.
3. En el panel derecho, desplazarse a la sección **Cheques**.
4. Completar los campos:
   - **Fecha:** Fecha del cheque.
   - **Cantidad:** Monto del cheque (en pesos).
   - **Folio del cheque:** Identificador del cheque físico.
5. Hacer clic en **Agregar Cheque**.

**Restricciones:**
- La suma acumulada de cheques **no puede exceder el monto autorizado** del beneficiario.
- El sistema calcula automáticamente el **Monto Derogado** al sumar todos los cheques.
- No es posible eliminar cheques desde la interfaz (medida de control de auditoría).

### Monto Derogado

El **Monto Derogado** es el total pagado al beneficiario y se calcula automáticamente sumando todos sus cheques registrados. Este campo no es editable manualmente.

---

## 9. Reglas de Validación

| Campo | Regla |
|-------|-------|
| CURP | Exactamente 18 caracteres. Formato: `AAAA######XAAAAA#0` |
| Teléfonos | Exactamente 10 dígitos numéricos, o dejar en blanco |
| Monto autorizado | Número decimal positivo |
| Contraseña | Mínimo 6 caracteres |
| Folio de beneficiario | Generado automáticamente; único en el sistema |
| CURP | Única en el sistema (no se permiten duplicados) |
| Cheques | La suma de cheques no debe superar el monto autorizado |

**Formato de CURP válido:**
```
AAAA######XAAAAA##
├─── 4 letras (apellidos + primer nombre)
├─────── 6 dígitos (fecha de nacimiento AAMMDD)
├──────── 1 letra (H/M = sexo)
├───────── 5 letras (estado + consonantes del nombre)
└────────────── 2 caracteres alfanuméricos (dígito verificador)
```

---

## 10. Lógica Presupuestal

### Cálculo del disponible

```
Disponible = Bolsa Global - Total Asignado - Total Derogado en Bajas
```

Donde:
- **Total Asignado:** Suma de `monto_autorizado` de beneficiarios con estatus **Activo**.
- **Total Derogado en Bajas:** Suma de `monto_derogado` de beneficiarios con estatus **Baja** o **Suspendido** (estos montos NO se recuperan).

### Impacto de cambio de estatus

| Cambio de estatus | Efecto presupuestal |
|-------------------|---------------------|
| Activo → Baja | El monto **ya pagado** (derogado) se descuenta de la bolsa permanentemente. El monto no pagado regresa al disponible. |
| Activo → Suspendido | Igual que Baja: el monto derogado queda fuera de la bolsa. |
| Baja → Activo | El beneficiario vuelve a contar en el total asignado. |

---

## 11. Exportación de Datos

El archivo CSV generado por el módulo de **Reportes** contiene las siguientes columnas:

| Columna | Descripción |
|---------|-------------|
| Folio | Código único del beneficiario |
| Nombre | Nombre completo |
| CURP | Clave Única de Registro de Población |
| Correo | Correo electrónico |
| Tel. Alumno | Teléfono del alumno |
| Tel. Fam 1 | Teléfono familiar 1 |
| Tel. Fam 2 | Teléfono familiar 2 |
| Tipo | Tipo de beca |
| Código | Código del tipo (NI, CT, CI, TI, TP) |
| Estatus | Activo / Baja / Suspendido |
| Tipo de Baja | Voluntaria / Tácita (si aplica) |
| Monto Autorizado | Monto asignado al beneficiario |
| Monto Derogado | Total pagado mediante cheques |

El archivo usa codificación **UTF-8 con BOM** para garantizar compatibilidad con Microsoft Excel.

---

## 12. Preguntas Frecuentes

**¿Cómo recupero una contraseña olvidada?**
No existe recuperación automática por correo. El administrador del sistema debe acceder directamente a la base de datos y actualizar el hash de la contraseña, o usar el servidor para resetearla manualmente.

**¿Puedo eliminar un beneficiario?**
No. El sistema no permite la eliminación de registros para preservar la integridad del historial. En su lugar, cambia el estatus del beneficiario a **Baja**.

**¿Se pueden eliminar cheques?**
No. La eliminación de cheques está deshabilitada para garantizar la trazabilidad financiera y la auditoría de pagos.

**¿Qué pasa si la sesión expira mientras estoy trabajando?**
El sistema detecta automáticamente la expiración del token JWT y redirige al formulario de inicio de sesión. Los datos no guardados se perderán.

**¿Puedo usar el sistema desde varios dispositivos al mismo tiempo?**
Sí. El sistema permite sesiones simultáneas desde diferentes navegadores o dispositivos con el mismo usuario.

**¿Cómo agrego nuevos usuarios al sistema?**
Actualmente no existe una interfaz para crear usuarios desde el panel. Un nuevo usuario debe agregarse directamente a la base de datos ejecutando un INSERT en la tabla `usuarios` con la contraseña hasheada mediante bcrypt.

**¿El folio se puede editar manualmente?**
No. El folio es generado automáticamente por el sistema y es único. No puede modificarse una vez asignado.

**¿Qué navegadores son compatibles?**
Cualquier navegador moderno: Google Chrome, Mozilla Firefox, Microsoft Edge, Safari. No es compatible con Internet Explorer.

---

*Versión del manual: 1.0 — Abril 2026*
