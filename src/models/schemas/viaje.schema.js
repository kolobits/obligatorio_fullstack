const mongoose = require("mongoose");

const viajeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    destino: { type: String, required: true },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    presupuesto: { type: Number, required: true },
    descripcion: { type: String },
    categoria: { type: String },
    estado: {
        type: String,
        enum: ["planificado", "en_curso", "finalizado", "cancelado"],
        default: "planificado",
    },
    imagenUrl: { type: String },
},
{
    timestamps: true
}
);

module.exports = viajeSchema;