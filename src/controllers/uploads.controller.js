const cloudinary = require("../config/cloudinary.config");
const { uploadBufferToCloudinary } = require("../utils/cloudinary.util");


const subirImagen = async (req, res) => {
    try {
        //req.file
        if(!req.file){
            return res.status(400).json({error: "No se subió ninguna imagen (solo se aceptan archivos de imagen)"});
        }
        const folder = req.body?.folder || "uploads";

        const result = await uploadBufferToCloudinary(cloudinary, req.file.buffer, {
            resource_type: "image",
            folder
        });
        return res.json({url: result.secure_url, folder: result.folder})
    } catch (error) {
        console.error("Error al subir la imagen: ", error);
        return res.status(500).json({error: "Error al subir imagen"})
    }
};

module.exports = { subirImagen };
