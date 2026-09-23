const fs = require("fs");
const path = require("path");

const logRequest = (req) => {
  const now = new Date();
  const [date] = now.toISOString().split("T");
  const logDir = path.join(__dirname, "logs");
  const logFile = path.join(logDir, `${date}.log`);

  const logMessage = `[${now.toISOString()}] METHOD: ${req.method} ${
    req.url
  } \n`;

  fs.appendFile(logFile, logMessage, (err) => {
    if (err) console.error("Error writing log: ", err);
  });
};

module.exports = logRequest;
