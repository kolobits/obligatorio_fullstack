// Fix: en algunas redes, la consulta DNS tipo SRV que necesita
// "mongodb+srv://" no se resuelve bien (da ECONNREFUSED en querySrv).
// Force a Node a resolver DNS contra Google/Cloudflare en vez del
// DNS que da la red local, solo para este proceso.
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();


require("dotenv").config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();

const privateRouter = require('./routes/private.router');
const publicRouter = require('./routes/public.router');
const authRouter = require('./routes/auth.router');
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');
const { generalLimiter } = require("./middlewares/rateLimit.middleware");
const connectMongoDB = require("./models/mongo.client");

(async () => {
  try {
    await connectMongoDB();
  } catch (error) {
    console.log("Ocurrio un error", error);
    process.exit();
  }
})();

app.use(express.json());
app.use(loggerMiddleware);
app.use(morgan('dev'));
app.use(cors());

app.use(generalLimiter);

app.use('/', publicRouter);
app.use('/v1/auth', authRouter);

app.use(authMiddleware);

app.use('/v1', privateRouter);


const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Listen & serve PORT: ${PORT}`);
});