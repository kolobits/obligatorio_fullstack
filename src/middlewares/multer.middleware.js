const multer = require("multer");

const storage = multer.memoryStorage();

// Solo aceptamos imágenes de hasta 5 MB
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const esImagen = file.mimetype.startsWith("image/");
    cb(null, esImagen);
  },
});

module.exports = { upload };
