# Planificador de Viajes — API REST

API para planificar viajes: cada usuario registra sus viajes (destino, fechas, presupuesto, categoría) y, para cada uno, puede consultar el clima esperado, un itinerario por día con lugares de interés reales, la distancia desde su ciudad de origen y una recomendación generada con IA.

Obligatorio 1 de **Desarrollo Full Stack integrado con IA** — Universidad ORT Uruguay.

**Producción:** https://obligatorio1-fullstack.vercel.app

---

## Índice

- [Stack](#stack)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Autenticación](#autenticación)
- [Endpoints](#endpoints)
- [Reglas de negocio](#reglas-de-negocio)
- [Clima, itinerario e IA](#clima-itinerario-e-ia)
- [Servicios externos](#servicios-externos)
- [Caché](#caché)
- [Seguridad](#seguridad)
- [Respuestas de error](#respuestas-de-error)
- [Colección de Postman](#colección-de-postman)
- [Deploy](#deploy)
- [Autores](#autores)

---

## Stack

| Área | Tecnología |
|---|---|
| Runtime y framework | Node.js, Express 5 |
| Base de datos | MongoDB Atlas con Mongoose |
| Autenticación | JSON Web Tokens (`jsonwebtoken`) y `bcryptjs` |
| Validación | Joi |
| Caché | Redis (Upstash) |
| Imágenes | Cloudinary con Multer |
| IA generativa | Groq |
| Seguridad | `xss`, `express-rate-limit`, CORS |
| Deploy | Vercel |
| Documentación y tests | Postman |

---

## Estructura del proyecto

```
src/
├── app.js                  # Configuración de Express, middlewares globales y rutas
├── config/                 # Configuración de Cloudinary
├── controllers/            # Capa HTTP: lee la request, llama a la lógica y responde
├── middlewares/            # Autenticación, admin, validaciones, XSS, rate limit, logger
├── models/
│   ├── schemas/            # Schemas de Mongoose
│   └── mongo.client.js     # Conexión a MongoDB
├── repositories/           # Acceso a datos (MongoDB) y caché (Redis)
├── routes/
│   └── validations/        # Esquemas de Joi
├── services/               # Integraciones externas y lógica del itinerario
└── utils/                  # Logger, subida a Cloudinary, validación de contraseña
```

Una request recorre siempre el mismo camino:

```
router → middlewares (auth, validación) → controller → repository / service → MongoDB, Redis o API externa
```

Los controllers no acceden directamente a la base ni a servicios externos: delegan en los repositories (datos) y en los services (APIs de terceros e itinerario).

---

## Puesta en marcha

### Requisitos

- Node.js 20.19 o superior
- Una base en MongoDB Atlas y cuentas en Upstash, Cloudinary, Groq y Geoapify

### Instalación

```bash
git clone https://github.com/kolobits/obligatorio_fullstack.git
cd obligatorio_fullstack
npm install
```

### Variables de entorno

Crear un archivo `.env` en la raíz con las siguientes variables:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto local (por ejemplo `3000`) |
| `AUTH_SECRET_KEY` | Clave para firmar los JWT |
| `MONGODB_CONNECTION_STRING` | Connection string de MongoDB Atlas |
| `MONGODB_DATABASE_NAME` | Nombre de la base (`planificador-viajes`) |
| `MONGODB_CONNECTION_TIMEOUT` | Timeout de conexión en milisegundos |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `GROQ_API_KEY` | API key de Groq |
| `GEOAPIFY_API_KEY` | API key de Geoapify |
| `REDIS_URL` | URL REST de Upstash |
| `REDIS_TOKEN` | Token REST de Upstash |

### Ejecución

```bash
npm run dev
```

La API queda disponible en `http://localhost:3000`. Para verificar que está levantada: `GET /health` responde `OK`.

---

## Autenticación

Las rutas bajo `/v1`, salvo registro y login, requieren un token JWT en el header `Authorization`. El token se envía tal cual, sin el prefijo `Bearer`:

```
Authorization: <token>
```

El token se obtiene con `POST /v1/auth/login` y vence a la hora.

Los usuarios que se registran quedan con rol `user` y plan `plus`. Los administradores no se registran por la API: están precargados en la base con rol `admin`.

---

## Endpoints

Base: `/v1`. Todos reciben y devuelven JSON, salvo la subida de imágenes (multipart/form-data).

### Públicos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API |
| GET | `/ping` | Responde `pong` |
| POST | `/v1/auth/signup` | Registro de usuario |
| POST | `/v1/auth/login` | Login, devuelve el token |

**Registro**

```json
{
  "name": "Camilo",
  "username": "camilo",
  "email": "camilo@mail.com",
  "password": "Abcd1234"
}
```

`name` y `username` llevan entre 3 y 20 caracteres, y `password` entre 3 y 20 caracteres alfanuméricos. El username y el email no pueden estar registrados.

### Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/usuarios/perfil` | Datos del usuario logueado y su plan |
| PUT | `/v1/usuarios/plan` | Cambia el plan de `plus` a `premium` |

### Viajes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/viajes` | Lista paginada de los viajes del usuario, con filtros |
| GET | `/v1/viajes/:id` | Detalle de un viaje |
| POST | `/v1/viajes` | Alta de un viaje |
| PUT | `/v1/viajes/:id` | Modificación de un viaje (reemplazo completo) |
| DELETE | `/v1/viajes/:id` | Baja de un viaje |
| GET | `/v1/viajes/:id/clima` | Clima, itinerario por día y recomendación de IA |
| GET | `/v1/viajes/:id/distancia?origen=Montevideo` | Distancia y duración en auto desde una ciudad |
| GET | `/v1/viajes/:id/puntos-interes` | Hasta 20 puntos de interés del destino (solo premium) |

**Body de alta y modificación**

```json
{
  "destino": "Madrid",
  "fechaInicio": "2026-12-10",
  "fechaFin": "2026-12-17",
  "presupuesto": 1500,
  "descripcion": "Museos y tapas",
  "categoria": "665f1c2e8b3a4d0012ab34cd",
  "estado": "planificado",
  "imagenUrl": "https://res.cloudinary.com/..."
}
```

Son obligatorios `destino`, `fechaInicio`, `fechaFin` y `presupuesto`. `fechaFin` no puede ser anterior a `fechaInicio`. `estado` acepta `planificado`, `en_curso`, `finalizado` o `cancelado`. El PUT reemplaza el viaje completo, por lo que usa las mismas reglas que el alta.

**Query params del listado**

| Parámetro | Descripción | Por defecto |
|---|---|---|
| `page` | Número de página (desde 1) | `1` |
| `limit` | Resultados por página (1 a 50) | `5` |
| `estado` | Filtra por estado | — |
| `categoria` | Filtra por id de categoría | — |

```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 5,
  "total": 12,
  "totalPages": 3
}
```

### Categorías

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/v1/categorias` | Usuario | Lista de categorías |
| GET | `/v1/categorias/:id` | Usuario | Detalle de una categoría |
| POST | `/v1/categorias` | Admin | Alta |
| PUT | `/v1/categorias/:id` | Admin | Modificación |
| DELETE | `/v1/categorias/:id` | Admin | Baja (solo si no tiene viajes asociados) |

### Imágenes

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/v1/uploads` | Sube una imagen a Cloudinary y devuelve su URL |

Se envía como `multipart/form-data` con el archivo en el campo `imagen` y, opcionalmente, la carpeta de destino en `folder`. Solo acepta imágenes de hasta 5 MB. La URL devuelta se guarda en el campo `imagenUrl` del viaje.

---

## Reglas de negocio

- **Plan plus:** hasta 4 viajes. El quinto alta devuelve `400` hasta que el usuario cambie de plan.
- **Plan premium:** viajes ilimitados y acceso a `/puntos-interes`.
- **Cambio de plan:** solo disponible desde el plan `plus`.
- **Aislamiento entre usuarios:** cada usuario ve, modifica y borra solo sus viajes. Un viaje de otro usuario responde `404`.
- **Categorías:** el nombre es único y no se puede borrar una categoría con viajes asociados.

---

## Clima, itinerario e IA

`GET /v1/viajes/:id/clima` combina varias fuentes en una sola respuesta:

1. Obtiene las coordenadas del destino con Nominatim (OpenStreetMap).
2. Busca lugares de interés cercanos con Geoapify.
3. Obtiene el clima con Open-Meteo:
   - si el viaje termina dentro de los próximos 16 días, usa el **pronóstico** diario;
   - si es más lejano, usa un **promedio histórico** de los últimos 5 años para esas fechas.
4. Reparte los lugares entre los días del viaje. Los días con lluvia pronosticada priorizan lugares bajo techo (museos, teatros, galerías).
5. Envía el clima y el itinerario a Groq, que devuelve una recomendación breve en texto.
6. Calcula el recorrido entre los lugares con OSRM.

Si Groq no responde, el endpoint devuelve igual el clima y el itinerario, con `recomendacion: null`. La IA forma parte del flujo, pero su indisponibilidad no afecta el resto de la respuesta.

Un viaje cuya fecha de inicio ya pasó responde `400`.

---

## Servicios externos

| Servicio | Uso | Requiere clave |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Pronóstico y clima histórico | No |
| [Nominatim](https://nominatim.org) (OpenStreetMap) | Coordenadas de ciudades | No |
| [Geoapify Places](https://apidocs.geoapify.com/docs/places/) | Lugares de interés | Sí |
| [OSRM](https://project-osrm.org) | Rutas y distancias | No |
| [Groq](https://groq.com) | Recomendaciones con IA | Sí |
| [Cloudinary](https://cloudinary.com) | Almacenamiento de imágenes | Sí |
| [Upstash](https://upstash.com) | Redis administrado | Sí |

---

## Caché

Se usa Redis (Upstash) para evitar consultas repetidas:

- **Listado de viajes:** se guarda una entrada por usuario y por combinación de página y filtros, durante una hora.
- **Clima e itinerario:** se guarda una entrada por viaje durante una hora, solo si la IA respondió. Así se evitan llamadas repetidas a Groq y a los servicios externos.

Al crear, modificar o borrar un viaje se invalidan las entradas correspondientes, por lo que el siguiente GET vuelve a leer de MongoDB. Si Redis no está disponible al consultar el clima, el endpoint funciona igual, sin caché.

---

## Seguridad

- Contraseñas hasheadas con bcrypt.
- Rutas privadas protegidas con JWT; las operaciones de categorías requieren rol `admin`.
- Validación de body, query params e ids con Joi antes de llegar a los controllers. Los campos no definidos en los esquemas se rechazan, por lo que no es posible registrarse como admin ni asignarse un plan.
- Sanitización del body contra XSS.
- Rate limiting general y uno más estricto para el endpoint que consume IA.
- Subida de archivos limitada a imágenes de hasta 5 MB.
- Las respuestas de error no exponen detalles internos del servidor.

---

## Respuestas de error

| Código | Cuándo |
|---|---|
| `400` | Datos inválidos, id mal formado, duplicados, límite del plan, reglas de negocio |
| `401` | Token ausente o inválido |
| `403` | Acción de administrador o función premium sin permiso |
| `404` | Recurso inexistente o de otro usuario |
| `429` | Límite de solicitudes superado |
| `500` | Error interno |
| `503` | Base de datos no disponible |

Los errores de validación incluyen el detalle de cada campo:

```json
{
  "error": "Validation error",
  "details": ["\"destino\" is required"]
}
```

El resto de los errores devuelve un mensaje:

```json
{ "message": "Viaje no encontrado" }
```

---

## Colección de Postman

El archivo `Planificador_Viajes.json` contiene la colección completa, organizada en carpetas por recurso, con tests para cada status code implementado. Incluye los flujos de registro (datos inválidos → registro exitoso → usuario duplicado) y de límite del plan (cuatro viajes en plus → error en el quinto → cambio a premium → alta del quinto).

Para correrla:

1. Importar el archivo en Postman.
2. Revisar las variables de colección:
   - `prod_base_url`: URL de la API (por defecto, la de producción).
   - `admin_username` y `admin_password`: credenciales del administrador precargado.
3. En **Uploads → Subir imagen**, seleccionar una imagen en Body → form-data.
4. Ejecutar la colección completa con el Collection Runner, en orden.

---

## Deploy

La API está desplegada en Vercel a partir de la rama `main`. Vercel detecta la aplicación Express en `src/app.js`, que exporta la app con `module.exports`; en local, el mismo archivo levanta el servidor con `app.listen`.

Las variables de entorno se configuran en **Settings → Environment Variables** del proyecto en Vercel, y MongoDB Atlas debe permitir conexiones desde cualquier IP (`0.0.0.0/0`).

---

## Autores

| Nombre | Número de estudiante |
|---|---|
| Camilo Pardo | 200710 |
| Rodrigo Gomez | 306926 |

Universidad ORT Uruguay — Facultad de Ingeniería -
Desarrollo Full Stack integrado con IA, 2026
