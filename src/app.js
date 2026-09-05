const express = require('express');
const app = express();
const port = 3000;
const router = require('./routes/index');
const cors = require('cors');
const morgan = require('morgan');
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(loggerMiddleware);
// app.use(authMiddleware);

app.use('/v1', router);


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});