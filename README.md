# Proyecto Consignación

Aplicación web en Node.js para gestionar consignaciones de vehículos para la concesionaria **Queirolo Autos**.

## Requisitos
- Node.js 16+
- MySQL 8+

## Configuración
1. Copia `.env.example` a `.env` y completa los valores requeridos.

```
cp .env.example .env
```

2. Instala las dependencias:

```
npm install
```

3. Inicia la aplicación:

```
npm start
```

El archivo `server.js` únicamente arranca la aplicación expuesta en
`src/app.js`, donde se encuentran configuradas las rutas y la lógica del
servidor.

## Variables de entorno
- `MYSQLHOST` – Host de la base de datos.
- `MYSQLUSER` – Usuario MySQL.
- `MYSQLPASSWORD` – Contraseña MySQL.
- `MYSQLDATABASE` – Base de datos.
- `MYSQLPORT` – Puerto (opcional).
- `SESSION_SECRET` – Secreto para las sesiones.
- `GMAIL_USER` – Cuenta Gmail para enviar correos.
- `GMAIL_PASS` – Contraseña de aplicación de Gmail.

## Descripción
El servidor Express define rutas para registrar consignaciones, realizar
consultas y generar contratos en PDF. Las vistas están desarrolladas con
EJS y el envío de correos se realiza mediante Nodemailer.
