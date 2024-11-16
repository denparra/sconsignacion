
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

// ===== Configuraciones Básicas =====

// Configurar body-parser para manejar datos del formulario y JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Agregar esta línea

// Ruta para verificar si un RUT ya existe
app.post('/verificar-rut', (req, res) => {
    const { rut_cliente } = req.body;

    if (!rut_cliente) {
        return res.status(400).json({ error: 'RUT es requerido.' });
    }

    // Consulta a la base de datos para verificar el RUT
    pool.query('SELECT * FROM clientes WHERE rut_cliente = ?', [rut_cliente], (error, results) => {
        if (error) {
            console.error('Error al verificar el RUT:', error);
            return res.status(500).json({ error: 'Error en el servidor.' });
        }

        if (results.length > 0) {
            // RUT existe
            const cliente = results[0];
            return res.json({ existe: true, cliente });
        } else {
            // RUT no existe
            return res.json({ existe: false });
        }
    });
});

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

// Middleware para agregar variables globales a todas las vistas
app.use((req, res, next) => {
    res.locals.formatNumber = formatNumber;
    res.locals.iniciales = req.session.iniciales; // Para el navbar y otras vistas
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});


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
        // Si el usuario está autenticado, redirige a index.ejs
        res.redirect('/index');
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
            req.session.iniciales = usuario.iniciales; // Almacenar 'iniciales' en la sesión
            // console.log(`Usuario autenticado: ${usuario.nombre_usuario}, Iniciales: ${usuario.iniciales}`); // Verificación
            res.redirect('/index'); // Redirige a la página protegida
        } else {
            // Contraseña incorrecta
            req.flash('error', 'Contraseña incorrecta.');
            res.redirect('/login');
        }
    });
});

// Middleware para verificar si el usuario es administrador
function isAdmin(req, res, next) {
    if (req.session.iniciales === 'ADM') {
        return next(); // El usuario es administrador, continuar con la siguiente función
    } else {
        res.status(403).send('Acceso denegado. No tienes permisos para realizar esta acción.');
    }
}


// Ruta de logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error al cerrar sesión.');
        }
        res.redirect('/login');
    });
});

// Ruta para servir la vista principal protegida
app.get('/index', isAuthenticated, (req, res) => {
    res.render('index', { 
        iniciales: req.session.iniciales 
        // Puedes pasar otros datos si es necesario
    }); // Renderiza 'index.ejs' con los datos de la sesión
});

// ===== Paso 3: Crear la Ruta para la Vista de Administración =====

app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    // Consultar consignaciones, clientes y vehículos
    const consignacionesSql = `
        SELECT 
            consignaciones.id_consignacion,
            clientes.nombre_apellido AS cliente,
            vehiculos.vehiculo,
            vehiculos.marca,
            vehiculos.modelo,
            vehiculos.anio,
            vehiculos.patente,
            consignaciones.fecha_consignacion,
            consignaciones.precio_publicacion,
            consignaciones.tipo_venta,
            consignaciones.estado,
            consignadoras.nombre AS consignadora
        FROM consignaciones
        JOIN clientes ON consignaciones.id_cliente = clientes.id_cliente
        JOIN vehiculos ON consignaciones.id_vehiculo = vehiculos.id_vehiculo
        JOIN consignadoras ON consignaciones.id_consignadora = consignadoras.id_consignadora
    `;

    const clientesSql = `
        SELECT 
            id_cliente,
            rut_cliente,
            nombre_apellido,
            direccion,
            telefono,
            correo
        FROM clientes
    `;

    const vehiculosSql = `
        SELECT 
            id_vehiculo,
            vehiculo,
            marca,
            modelo,
            anio,
            chasis,
            num_motor,
            patente,
            kilometraje,
            permiso_circulacion,
            revision_tecnica,
            seguro_obligatorio
        FROM vehiculos
    `;

    // Ejecutar consultas en paralelo
    Promise.all([
        new Promise((resolve, reject) => {
            pool.query(consignacionesSql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            pool.query(clientesSql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            pool.query(vehiculosSql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        })
    ]).then(([consignaciones, clientes, vehiculos]) => {
        res.render('admin', { 
            consignaciones, 
            clientes, 
            vehiculos, 
            formatNumber: formatNumber // Pasar la función al contexto de EJS
        });
    }).catch(err => {
        console.error('Error al obtener datos para la administración:', err);
        res.status(500).send('Error al obtener datos para la administración.');
    });
});


//AGREGAR CONSIGNACION
// Ruta para procesar el envío de los datos del formulario protegido
app.post('/agregar-consignacion', isAuthenticated, (req, res) => {
    const {
        rut_cliente, nombre_apellido, direccion, telefono, correo,
        vehiculo, marca, modelo, anio, chasis, num_motor, patente, kilometraje,
        permiso_circulacion, revision_tecnica, seguro_obligatorio,
        fecha_consignacion, precio_publicacion, tipo_venta,
        id_consignadora
    } = req.body;

    // Validar que id_consignadora esté presente y sea válido
    if (!id_consignadora) {
        req.flash('error', 'Debe seleccionar una consignadora.');
        return res.redirect('/index');
    }

    // Comprobar si el cliente ya existe
    const checkClienteSql = `SELECT id_cliente FROM clientes WHERE rut_cliente = ?`;
    pool.query(checkClienteSql, [rut_cliente], (err, results) => {
        if (err) {
            console.error('Error al verificar el cliente:', err);
            return res.status(500).send('Error al verificar el cliente');
        }

        if (results.length > 0) {
            // El cliente ya existe
            const clienteId = results[0].id_cliente;
            // Continuar con la inserción del vehículo y la consignación
            insertarVehiculoYConsignacion(clienteId);
        } else {
            // El cliente no existe, insertar nuevo cliente
            const clienteSql = `INSERT INTO clientes (rut_cliente, nombre_apellido, direccion, telefono, correo) 
                                VALUES (?, ?, ?, ?, ?)`;
            pool.query(clienteSql, [rut_cliente, nombre_apellido, direccion, telefono, correo], (err, result) => {
                if (err) {
                    console.error('Error al insertar los datos del cliente:', err);
                    return res.status(500).send('Error al insertar los datos del cliente');
                }

                const clienteId = result.insertId; // Obtener el ID del cliente insertado

                // Continuar con la inserción del vehículo y la consignación
                insertarVehiculoYConsignacion(clienteId);
            });
        }
    });

    function insertarVehiculoYConsignacion(clienteId) {
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
            const consignacionSql = `INSERT INTO consignaciones (id_cliente, id_vehiculo, id_consignadora, fecha_consignacion, precio_publicacion, tipo_venta, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'DISPONIBLE')`;
            pool.query(consignacionSql, [clienteId, vehiculoId, id_consignadora, fecha_consignacion, precio_publicacion, tipo_venta], (err, result) => {
                if (err) {
                    console.error('Error al insertar la consignación:', err);
                    return res.status(500).send('Error al insertar la consignación');
                }

                const consignacionId = result.insertId; // Obtener el ID de la consignación insertada

                // Después de insertar la consignación, obtenemos el nombre de la consignadora
                pool.query('SELECT nombre FROM consignadoras WHERE id_consignadora = ?', [id_consignadora], (err, result) => {
                    if (err) {
                        console.error('Error al obtener el nombre de la consignadora:', err);
                        return res.status(500).send('Error al obtener la consignadora');
                    }

                    // Aquí tienes el nombre de la consignadora
                    const consignadora_nombre = result[0].nombre;

                    // Formatear el precio para el correo
                    const precioFormateado = formatNumber(precio_publicacion);

                    // Enviar correo de confirmación
                    const mailOptions = {
                        from: 'infoautorecente@gmail.com',
                        to: correo,  // Enviar al correo del cliente
                        cc: ['dparra@queirolo.cl'],  // Correos en copia
                        subject: 'Confirmación de Consignación de su Vehículo',
                        text: `Buen día, estimado/a ${nombre_apellido}, Agradecemos sinceramente la confianza depositada en Queirolo Autos para gestionar la consignación de su vehículo. Nos complace informarle que su ${vehiculo} ${marca} ${modelo} ${anio} ha sido ingresado exitosamente en nuestro sistema y actualmente se encuentra en proceso de preparación para su pronta publicación en nuestras instalaciones.


Detalles de la Consignación: 
- Nombre Consignadora: ${consignadora_nombre}     
- Tipo de Venta: ${tipo_venta} 
- Precio de Publicación: $${precioFormateado} 


Puede visitar nuestra página web Queirolo.cl para más información o contactarnos directamente en nuestras oficinas. 


Dirección: 
Av. Las Condes 12461, Local 4, Showroom -3, Las Condes, Santiago. 


Estamos a su disposición para cualquier consulta o solicitud adicional. Gracias nuevamente por elegir Queirolo Autos. Nos aseguraremos de que su experiencia con nosotros sea satisfactoria y profesional. 


Atentamente, Queirolo Autos.`
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
    }
});

                     // Ruta para mostrar todas las consignaciones con paginación y filtros
app.get('/consultas-consignaciones', isAuthenticated, (req, res) => {
    const limit = 10; // Número de registros por página
    const page = parseInt(req.query.page) || 1; // Página actual
    const offset = (page - 1) * limit; // Cálculo del desplazamiento (offset)

    const { mes, consignadora, patente, estado } = req.query; // Agregar 'estado' a los filtros

    let sql = `SELECT consignaciones.id_consignacion, clientes.nombre_apellido, clientes.rut_cliente, 
        vehiculos.vehiculo, vehiculos.patente, consignaciones.fecha_consignacion, 
        consignaciones.precio_publicacion, consignaciones.tipo_venta, consignaciones.estado, 
        consignadoras.nombre AS consignadora
        FROM consignaciones 
        JOIN clientes ON consignaciones.id_cliente = clientes.id_cliente 
        JOIN vehiculos ON consignaciones.id_vehiculo = vehiculos.id_vehiculo
        JOIN consignadoras ON consignaciones.id_consignadora = consignadoras.id_consignadora
        WHERE 1=1`;

    let queryParams = [];

    // Agregar condiciones opcionales si se seleccionan filtros
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

    // Filtro por estado
    if (estado) {
        sql += ` AND consignaciones.estado = ?`;
        queryParams.push(estado);
    }

    // Agregar ordenamiento y paginación
    sql += ` ORDER BY consignaciones.fecha_consignacion DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    // Ejecutar la consulta principal
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

            res.render('consultas-consignaciones', { 
                consignaciones: results, 
                consignadoras: consignadoras, 
                page: page, 
                limit: limit, 
                mes: mes || '', 
                consignadora: consignadora || '', 
                estado: estado || '', 
                patente: patente || '',
                formatNumber: formatNumber // Pasar la función al contexto de EJS
            });
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
app.use(express.static(path.join(__dirname))); // Servir desde raíz

// Iniciar el servidor en el puerto asignado por Railway o en el puerto 3000 localmente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});