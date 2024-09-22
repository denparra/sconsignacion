// server.js

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer'); // Requerir Nodemailer
const session = require('express-session'); // Requerir express-session
const flash = require('connect-flash'); // Requerir connect-flash
const MySQLStore = require('express-mysql-session')(session); // Requerir express-mysql-session
require('dotenv').config(); // Cargar variables de entorno

const app = express();

// Configurar body-parser para manejar datos del formulario
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar Express para confiar en el proxy
app.set('trust proxy', 1);

// Configurar el almacén de sesiones MySQLStore
const sessionStoreOptions = {
    host: process.env.MYSQLHOST,
    port: process.env.MYSQLPORT || 3306,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
};

const sessionStore = new MySQLStore(sessionStoreOptions);

// Configurar express-session para usar MySQLStore
app.use(session({
    secret: process.env.SESSION_SECRET || 'tu_clave_secreta',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Mantener en true en producción
        maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
}));

// Configurar connect-flash
app.use(flash());

// Configurar el motor de vistas a EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Asegúrate de tener una carpeta 'views'

// Middleware para proteger rutas
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.redirect('/login');
    }
}

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

// ===== Función de Formateo =====
function formatNumber(number) {
    return new Intl.NumberFormat('es-CL').format(number);
}

// ===== Definir Rutas Antes de express.static =====

// Ruta GET para la raíz '/'
app.get('/', (req, res) => {
    if (req.session.userId) {
        // Si el usuario está autenticado, redirige a index.html
        res.redirect('/index.html');
    } else {
        // Si no está autenticado, redirige a la página de login
        res.redirect('/login');
    }
});

// Ruta GET para servir la página de login
app.get('/login', (req, res) => {
    res.render('login', { error: req.flash('error') });
});

// Ruta POST para manejar el login
app.post('/login', (req, res) => {
    const { nombre_usuario, contrasena } = req.body;

    // Consultar al usuario en la base de datos
    pool.query('SELECT * FROM usuarios WHERE nombre_usuario = ?', [nombre_usuario], (error, results) => {
        if (error) {
            console.error('Error al consultar al usuario:', error);
            req.flash('error', 'Error en el servidor.');
            return res.redirect('/login');
        }

        if (results.length === 0) {
            // Usuario no encontrado
            req.flash('error', 'Nombre de usuario incorrecto.');
            return res.redirect('/login');
        }

        const usuario = results[0];

        if (usuario.contrasena === contrasena) { // Considera encriptar la contraseña en producción
            // Contraseña correcta, establecer sesión
            req.session.userId = usuario.id_usuario;
            res.redirect('/index.html'); // Redirige a la página protegida
        } else {
            // Contraseña incorrecta
            req.flash('error', 'Contraseña incorrecta.');
            res.redirect('/login');
        }
    });
});

// Ruta de logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error al cerrar sesión.');
        }
        res.redirect('/login');
    });
});

// Ruta para servir el formulario HTML protegido
app.get('/index.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Sirve el archivo HTML del formulario
});

// Ruta para procesar el envío de los datos del formulario protegido
app.post('/agregar-consignacion', isAuthenticated, (req, res) => {
    const {
        rut_cliente, nombre_apellido, direccion, telefono, correo,
        vehiculo, marca, modelo, anio, chasis, num_motor, patente, kilometraje,
        permiso_circulacion, revision_tecnica, seguro_obligatorio,
        fecha_consignacion, precio_publicacion, tipo_venta,
        id_consignadora // Nuevo campo agregado
    } = req.body;

    // Validar que id_consignadora esté presente y sea válido
    if (!id_consignadora) {
        req.flash('error', 'Debe seleccionar una consignadora.');
        return res.redirect('/index.html');
    }

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
            const consignacionSql = `INSERT INTO consignaciones (id_cliente, id_vehiculo, id_consignadora, fecha_consignacion, precio_publicacion, tipo_venta)
                                     VALUES (?, ?, ?, ?, ?, ?)`;
            pool.query(consignacionSql, [clienteId, vehiculoId, id_consignadora, fecha_consignacion, precio_publicacion, tipo_venta], (err, result) => {
                if (err) {
                    console.error('Error al insertar la consignación:', err);
                    return res.status(500).send('Error al insertar la consignación');
                }

                const consignacionId = result.insertId; // Obtener el ID de la consignación insertada

                // Formatear el precio para el correo
                const precioFormateado = formatNumber(precio_publicacion);

                // Enviar correo de confirmación
                const mailOptions = {
                    from: 'infoautorecente@gmail.com',
                    to: correo,  // Enviar al correo del cliente
                    subject: 'Confirmación de Consignación',
                    text: `Estimado ${nombre_apellido},\n\nGracias por consignar su vehículo con nosotros. Los detalles de la consignación son:\n\nVehículo: ${vehiculo}\nPrecio de Publicación: $${precioFormateado}\nTipo de Venta: ${tipo_venta}\nConsignadora: ${id_consignadora}\n\nSaludos,\nQueirolo Autos`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error al enviar el correo:', error);
                        return res.status(500).send('Consignación registrada, pero no se pudo enviar el correo de confirmación.');
                    }
                    console.log('Correo enviado: ' + info.response);

                    // Redirigir a contratos.html con el ID de la consignación
                    res.redirect(`/contratos.html?id_consignacion=${consignacionId}`);
                });
            });
        });
    });
});

// Ruta para mostrar todas las consignaciones con paginación y filtros
app.get('/consultas-consignaciones', isAuthenticated, (req, res) => {
    const limit = 10; // Número de registros por página
    const page = parseInt(req.query.page) || 1; // Página actual
    const offset = (page - 1) * limit; // Cálculo del desplazamiento (offset)

    const { mes, consignadora, patente } = req.query; // Obtener filtros adicionales

    let sql = `SELECT consignaciones.id_consignacion, clientes.nombre_apellido, clientes.rut_cliente, 
               vehiculos.vehiculo, vehiculos.patente, consignaciones.fecha_consignacion, 
               consignaciones.precio_publicacion, consignaciones.tipo_venta, consignadoras.nombre AS consignadora
               FROM consignaciones 
               JOIN clientes ON consignaciones.id_cliente = clientes.id_cliente 
               JOIN vehiculos ON consignaciones.id_vehiculo = vehiculos.id_vehiculo
               JOIN consignadoras ON consignaciones.id_consignadora = consignadoras.id_consignadora
               WHERE 1=1`;
    let queryParams = [];

    if (mes) {
        sql += ` AND MONTH(consignaciones.fecha_consignacion) = ?`;
        queryParams.push(mes);
    }

    if (consignadora) {
        sql += ` AND consignadoras.nombre LIKE ?`;
        queryParams.push(`%${consignadora}%`);
    }

    if (patente) {
        sql += ` AND vehiculos.patente LIKE ?`;
        queryParams.push(`%${patente}%`);
    }

    sql += ` ORDER BY consignaciones.fecha_consignacion DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    pool.query(sql, queryParams, (err, results) => {
        if (err) {
            console.error('Error al consultar las consignaciones:', err);
            return res.status(500).send('Error al consultar las consignaciones');
        }

        // Obtener la lista de consignadoras para el filtro
        pool.query('SELECT nombre FROM consignadoras', (err, consignadoras) => {
            if (err) {
                console.error('Error al obtener consignadoras:', err);
                return res.status(500).send('Error al obtener consignadoras');
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

                                  <label for="consignadora">Consignadora:</label>
                                  <select name="consignadora" id="consignadora">
                                    <option value="">Todas</option>`;

            consignadoras.forEach(consignadoraItem => {
                responseHTML += `<option value="${consignadoraItem.nombre}">${consignadoraItem.nombre}</option>`;
            });

            responseHTML += `</select>

                                  <label for="patente">Patente:</label>
                                  <input type="text" name="patente" id="patente" placeholder="Ingrese patente">

                                  <button type="submit" class="btn btn-primary">Filtrar</button>
                                </form>
                                <table border="1" cellpadding="5" class="mt-4">
                                  <tr>
                                    <th>ID Consignación</th>
                                    <th>Cliente</th>
                                    <th>RUT Cliente</th>
                                    <th>Vehículo</th>
                                    <th>Patente</th>
                                    <th>Fecha</th>
                                    <th>Precio</th>
                                    <th>Tipo de Venta</th>
                                    <th>Consignadora</th>
                                    <th>Acciones</th>
                                  </tr>`;

            results.forEach(consignacion => {
                const precioFormateado = formatNumber(consignacion.precio_publicacion);
                responseHTML += `
                    <tr>
                      <td>${consignacion.id_consignacion}</td>
                      <td>${consignacion.nombre_apellido}</td>
                      <td>${consignacion.rut_cliente}</td>
                      <td>${consignacion.vehiculo}</td>
                      <td>${consignacion.patente}</td>
                      <td>${consignacion.fecha_consignacion}</td>
                      <td>$${precioFormateado}</td>
                      <td>${consignacion.tipo_venta}</td>
                      <td>${consignacion.consignadora}</td>
                      <td><a href="/contratos.html?id_consignacion=${consignacion.id_consignacion}">Ver Contrato</a></td>
                    </tr>`;
            });

            responseHTML += '</table>';

            // Generar botones de paginación
            const nextPage = page + 1;
            const prevPage = page - 1;

            responseHTML += `<div style="margin-top: 20px;">`;
            if (page > 1) {
                responseHTML += `<a href="/consultas-consignaciones?page=${prevPage}&mes=${mes}&consignadora=${consignadora}&patente=${patente}" class="btn btn-primary">Página Anterior</a>`;
            }
            responseHTML += `<a href="/consultas-consignaciones?page=${nextPage}&mes=${mes}&consignadora=${consignadora}&patente=${patente}" class="btn btn-primary" style="margin-left: 10px;">Siguiente Página</a>`;
            responseHTML += `</div>`;

            responseHTML += '<br><a href="/" class="btn btn-secondary btn-block">Volver al Inicio</a>';
            res.send(responseHTML);
        });
    });
});

// Ruta para obtener los datos de una consignación específica
app.get('/api/consignacion/:id', isAuthenticated, (req, res) => {
    const idConsignacion = req.params.id;

    // Consulta para obtener los datos de la consignación, cliente, vehículo y consignadora
    const sql = `SELECT 
        consignaciones.id_consignacion AS consignacion_id,
        consignaciones.fecha_consignacion,
        consignaciones.precio_publicacion,
        consignaciones.tipo_venta,
        clientes.id_cliente AS cliente_id,
        clientes.rut_cliente,
        clientes.nombre_apellido,
        clientes.direccion,
        clientes.telefono,
        clientes.correo,
        vehiculos.id_vehiculo AS vehiculo_id,
        vehiculos.vehiculo,
        vehiculos.marca,
        vehiculos.modelo,
        vehiculos.anio,
        vehiculos.chasis,
        vehiculos.num_motor,
        vehiculos.patente,
        vehiculos.kilometraje,
        vehiculos.permiso_circulacion,
        vehiculos.revision_tecnica,
        vehiculos.seguro_obligatorio,
        consignadoras.id_consignadora,
        consignadoras.nombre AS consignadora_nombre
    FROM consignaciones
    JOIN clientes ON consignaciones.id_cliente = clientes.id_cliente
    JOIN vehiculos ON consignaciones.id_vehiculo = vehiculos.id_vehiculo
    JOIN consignadoras ON consignaciones.id_consignadora = consignadoras.id_consignadora
    WHERE consignaciones.id_consignacion = ?`;

    pool.query(sql, [idConsignacion], (err, results) => {
        if (err) {
            console.error('Error al obtener la consignación:', err);
            return res.status(500).json({ error: 'Error al obtener la consignación' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Consignación no encontrada' });
        }

        const consignacion = results[0];
        // Formatear el precio_publicacion
        consignacion.precio_publicacion = formatNumber(consignacion.precio_publicacion);

        res.json(consignacion);
    });
});

// === Nueva Ruta API para Consignadoras ===
app.get('/api/consignadoras', isAuthenticated, (req, res) => {
    const sql = 'SELECT id_consignadora, nombre FROM consignadoras';  // Asegúrate de incluir 'id_consignadora'

    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al obtener consignadoras:', err);
            return res.status(500).json({ error: 'Error al obtener consignadoras' });
        }

        res.json(results);  // Devuelve también el 'id_consignadora'
    });
});

// Middleware para servir archivos estáticos (después de las rutas específicas)
app.use(express.static(path.join(__dirname)));

// Iniciar el servidor en el puerto asignado por Railway o en el puerto 3000 localmente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});