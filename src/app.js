require("dotenv").config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();

const privateRouter = require('./routes/private.router');
const publicRouter = require('./routes/public.router');
const authRouter = require('./routes/auth.router');
const uploadsRouter = require("./routes/uploads.router");
const loggerMiddleware = require('./middlewares/logger.middleware');
const authMiddleware = require('./middlewares/auth.middleware');
const dbMiddleware = require("./middlewares/db.middleware");
const xssMiddleware = require("./middlewares/xss.middleware");
const { generalLimiter } = require("./middlewares/rateLimit.middleware");

app.use(express.json());
app.use(xssMiddleware);
app.use(loggerMiddleware);
app.use(morgan('dev'));
app.use(cors());

app.use(generalLimiter);

app.use('/', publicRouter);

app.use(dbMiddleware);

app.use('/v1/auth', authRouter);

app.use(authMiddleware);


app.use('/v1', privateRouter);

app.use("/v1/uploads", uploadsRouter);

app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  if (err.name === "MulterError") {
    return res.status(400).json({ message: "La imagen no puede superar los 5 MB" });
  }
  const status = err.status || 500;
  res.status(status).json({ message: status === 500 ? "Error interno del servidor" : "Solicitud inválida" });
})

module.exports = app;

if(require.main === module) {
  const PORT = process.env.PORT;
  app.listen(PORT, () => {
    console.log(`Listen & serve on Vercel: https://obligatorio1-fullstack.vercel.app`);
  });
}