const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logRequest = (method, path, status) => {
    const now = new Date();
    const [date, time] = now.toISOString().split("T");
    const logFile = `${logDir}/${date}.log`;
    const logLine= `[${date}${time.split(".")[0]}] METHOD: ${method} ${path} - STATUS: ${status} \n`;
    fs.appendFile(logFile, logLine, (error) => {
        if (error) {
            console.error("Error al escribir el log: ", error);
        }
    })
}

module.exports = {
    logRequest
}
