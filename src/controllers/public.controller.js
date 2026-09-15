const healthController = (req, res) => {
  res.status(200).send("OK");
};

const pingController = (req, res) => {
  res.status(200).send("pong");
};

module.exports = {
  healthController,
  pingController,
};