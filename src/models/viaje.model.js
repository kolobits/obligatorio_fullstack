const mongoose = require("mongoose");
const viajeSchema = require("./schemas/viaje.schema");

const Viaje = mongoose.model("Viaje", viajeSchema);

module.exports = Viaje;