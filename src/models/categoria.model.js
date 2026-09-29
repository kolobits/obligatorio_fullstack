const mongoose = require("mongoose");
const categoriaSchema = require("./schemas/categoria.schema");

module.exports = mongoose.model("Categoria", categoriaSchema);