require("dotenv").config();
const express = require('express');
const app = express();
const port = 3000;
const router = require('./routes/index');
const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const cors = require('cors');
const morgan = require('morgan');
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(loggerMiddleware);

app.use('/', publicRoutes);
app.use('/v1/auth', authRoutes);

app.use(authMiddleware);

app.use('/v1', router);


app.listen(port, () => {
  console.log(`Listen & serve PORT: ${port}`);
});