const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer'); // Requerir Nodemailer
require('dotenv').config(); // Cargar variables de entorno

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a la base de datos MySQL utilizando el pool de conexiones
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,          // Host proporcionado por Railway
  user: process.env.MYSQLUSER,          // Usuario de la base de datos
  password: process.env.MYSQLPASSWORD,  // Contraseña de la base de datos
  database: process.env.MYSQLDATABASE,  // Nombre de la base de datos
  port: process.env.MYSQLPORT || 3306,  // Puerto de MySQL (usualmente 3306)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificar la conexión
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MySQL en Railway');
  connection.release(); // Liberar la conexión
});

// Configurar Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'infoautorecente@gmail.com',  // Tu correo
    pass: 'yfpo kbpd egyh nehh',        // Contraseña de aplicación generada
  },
});

// Ruta para servir el formulario HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Sirve el archivo HTML del formulario
});

// Ruta para procesar el envío de los datos del formulario
app.post('/agregar-consignacion', (req, res) => {
  const {
    rut_cliente, nombre_apellido, direccion, telefono, correo,
    vehiculo, marca, modelo, anio, chasis, num_motor, patente, kilometraje,
    permiso_circulacion, revision_tecnica, seguro_obligatorio,
    fecha_consignacion, precio_publicacion, tipo_venta
  } = req.body;

  // Insertar datos en la tabla `clientes`
  const clienteSql = `INSERT INTO clientes (rut_cliente, nombre_apellido, direccion, telefono, correo) 
                      VALUES (?, ?, ?, ?, ?)`;
  pool.query(clienteSql, [rut_cliente, nombre_apellido, direccion, telefono, correo], (err, result) => {
    if (err) {
      console.error('Error al insertar los datos del cliente:', err);
      return res.status(500).send('Error al insertar los datos del cliente');
    }

    const clienteId = result.insertId; // Obtener el ID del cliente insertado

    // Insertar datos en la tabla `vehiculos`
    const vehiculoSql = `INSERT INTO vehiculos (vehiculo, marca, modelo, anio, chasis, num_motor, patente, kilometraje, permiso_circulacion, revision_tecnica, seguro_obligatorio)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    pool.query(vehiculoSql, [vehiculo, marca, modelo, anio, chasis, num_motor, patente, kilometraje, permiso_circulacion, revision_tecnica, seguro_obligatorio], (err, result) => {
      if (err) {
        console.error('Error al insertar los datos del vehículo:', err);
        return res.status(500).send('Error al insertar los datos del vehículo');
      }

      const vehiculoId = result.insertId; // Obtener el ID del vehículo insertado

      // Insertar datos en la tabla `consignaciones`
      const consignacionSql = `INSERT INTO consignaciones (id_cliente, id_vehiculo, fecha_consignacion, precio_publicacion, tipo_venta)
                               VALUES (?, ?, ?, ?, ?)`;
      pool.query(consignacionSql, [clienteId, vehiculoId, fecha_consignacion, precio_publicacion, tipo_venta], (err) => {
        if (err) {
          console.error('Error al insertar la consignación:', err);
          return res.status(500).send('Error al insertar la consignación');
        }

        // Enviar correo de confirmación
        const mailOptions = {
          from: 'infoautorecente@gmail.com',
          to: correo,  // Enviar al correo del cliente
          subject: 'Confirmación de Consignación',
          text: `Estimado ${nombre_apellido},\n\nGracias por consignar su vehículo con nosotros. Los detalles de la consignación son:\n\nVehículo: ${vehiculo}\nPrecio de Publicación: ${precio_publicacion}\nTipo de Venta: ${tipo_venta}\n\nSaludos,\nQueirolo Autos`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error al enviar el correo:', error);
            return res.status(500).send('Consignación registrada, pero no se pudo enviar el correo de confirmación.');
          }
          console.log('Correo enviado: ' + info.response);

          // Redirigir a contratos.html con los datos pasados por la URL
          res.redirect(`/contratos.html?vehiculo=${vehiculo}&marca=${marca}&modelo=${modelo}&anio=${anio}&chasis=${chasis}&num_motor=${num_motor}&patente=${patente}&kilometraje=${kilometraje}&permiso_circulacion=${permiso_circulacion}&revision_tecnica=${revision_tecnica}&seguro_obligatorio=${seguro_obligatorio}&precio_publicacion=${precio_publicacion}&rut_cliente=${rut_cliente}&nombre_apellido=${nombre_apellido}&direccion=${direccion}&telefono=${telefono}&correo=${correo}&fecha_consignacion=${fecha_consignacion}&tipo_venta=${tipo_venta}`);
        });
      });
    });
  });
});

// Ruta para mostrar todas las consignaciones con paginación y filtro por mes
app.get('/consultas-consignaciones', (req, res) => {
  const limit = 10; // Número de registros por página
  const page = parseInt(req.query.page) || 1; // Página actual
  const offset = (page - 1) * limit; // Cálculo del desplazamiento (offset)

  // Filtrar por mes si se proporciona
  let filtroMes = req.query.mes || ''; // Captura el mes del query string
  let sql = `SELECT consignaciones.id_consignacion, clientes.nombre_apellido, vehiculos.vehiculo, vehiculos.patente, consignaciones.fecha_consignacion, consignaciones.precio_publicacion, consignaciones.tipo_venta 
             FROM consignaciones 
             JOIN clientes ON consignaciones.id_cliente = clientes.id_cliente 
             JOIN vehiculos ON consignaciones.id_vehiculo = vehiculos.id_vehiculo
             WHERE 1=1`;

  // Si se proporciona un mes, agregar condición a la consulta SQL
  if (filtroMes) {
    sql += ` AND MONTH(consignaciones.fecha_consignacion) = ?`; // Filtrar por el mes proporcionado
  }

  sql += ` ORDER BY consignaciones.fecha_consignacion DESC LIMIT ? OFFSET ?`;

  // Ejecutar la consulta, pasando el mes si se especificó
const queryParams = filtroMes ? [filtroMes, limit, offset] : [limit, offset];

pool.query(sql, queryParams, (err, results) => {
  if (err) {
    console.error('Error al consultar las consignaciones:', err);
    return res.status(500).send('Error al consultar las consignaciones');
  }

  let responseHTML = `<h1>Listado de Consignaciones</h1>
                      <form method="GET" action="/consultas-consignaciones">
                        <label for="mes">Filtrar por mes:</label>
                        <select name="mes" id="mes">
                          <option value="">Todos</option>
                          <option value="1">Enero</option>
                          <option value="2">Febrero</option>
                          <option value="3">Marzo</option>
                          <option value="4">Abril</option>
                          <option value="5">Mayo</option>
                          <option value="6">Junio</option>
                          <option value="7">Julio</option>
                          <option value="8">Agosto</option>
                          <option value="9">Septiembre</option>
                          <option value="10">Octubre</option>
                          <option value="11">Noviembre</option>
                          <option value="12">Diciembre</option>
                        </select>
                        <button type="submit" class="btn btn-primary">Filtrar</button>
                      </form>
                      <table border="1" cellpadding="5" class="mt-4">
                        <tr>
                          <th>ID Consignación</th>
                          <th>Cliente</th>
                          <th>Vehículo</th>
                          <th>Patente</th>
                          <th>Fecha</th>
                          <th>Precio</th>
                          <th>Tipo de Venta</th>
                        </tr>`;

  results.forEach(consignacion => {
    responseHTML += `
      <tr>
        <td>${consignacion.id_consignacion}</td>
        <td>${consignacion.nombre_apellido}</td>
        <td>${consignacion.vehiculo}</td>
        <td>${consignacion.patente}</td>
        <td>${consignacion.fecha_consignacion}</td>
        <td>${consignacion.precio_publicacion}</td>
        <td>${consignacion.tipo_venta}</td>
      </tr>`;
  });

  responseHTML += '</table>';

  // Generar botones de paginación
  const nextPage = page + 1;
  const prevPage = page - 1;

  responseHTML += `<div style="margin-top: 20px;">`;
  if (page > 1) {
    responseHTML += `<a href="/consultas-consignaciones?page=${prevPage}&mes=${filtroMes}" class="btn btn-primary">Página Anterior</a>`;
  }
  responseHTML += `<a href="/consultas-consignaciones?page=${nextPage}&mes=${filtroMes}" class="btn btn-primary" style="margin-left: 10px;">Siguiente Página</a>`;
  responseHTML += `</div>`;

  responseHTML += '<br><a href="/">Volver al formulario</a>';
  res.send(responseHTML);
  });
});

// Ruta para servir contratos.html
app.get('/contratos.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'contratos.html')); // Sirve el archivo contratos.html
});

// Iniciar el servidor en el puerto asignado por Railway o en el puerto 3000 localmente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

