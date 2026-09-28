const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const esImagen = file.mimetype.startsWith("image/");
    cb(null, esImagen);
  },
});

module.exports = { upload };
