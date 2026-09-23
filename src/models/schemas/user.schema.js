const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rol: { type: String, default: "user" },
    perfil: { type: String, default: "plus" },
},
{
    timestamps: true
}
);

module.exports = userSchema;