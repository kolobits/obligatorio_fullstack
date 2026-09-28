require("dotenv").config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();

const privateRouter = require('./routes/private.router');
const publicRouter = require('./routes/public.router');
const authRouter = require('./routes/auth.router');
const uploadsRouter = require("./routes/uploads.router");
const iaRouter = require("./routes/ia.router");
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');
const dbMiddleware = require("./middlewares/db.middleware");
const xssMiddleware = require("./middlewares/xss.middleware");
const { generalLimiter, iaLimiter } = require("./middlewares/rateLimit.middleware");

// En Vercel la app corre detrás de un proxy: así el rate limit toma la IP real del cliente
app.set("trust proxy", 1);

app.use(express.json());
app.use(xssMiddleware);
app.use(loggerMiddleware);
app.use(morgan('dev'));
app.use(cors());
app.use(generalLimiter);

app.use(dbMiddleware);
app.use('/', publicRouter);

app.use('/v1/auth', authRouter);

app.use(authMiddleware);

//Private
app.use('/v1', privateRouter);

app.use("/v1/uploads", uploadsRouter);

app.use("/v1/ai", iaLimiter, iaRouter);


app.use((err, req, res, next) => {
  // Archivo demasiado grande u otro error de Multer
  if (err.name === "MulterError") {
    return res.status(400).json({ message: "La imagen no puede superar los 5 MB" });
  }
  // JSON mal formado en el body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El body no es un JSON válido" });
  }
  console.error("Error no controlado:", err);
  res.status(500).json({ message: "Error interno del servidor" });
})

module.exports = app;

if(require.main === module) {
  const PORT = process.env.PORT;
  app.listen(PORT, () => {
    console.log(`Listen & serve PORT: ${PORT}`);
  });
}
