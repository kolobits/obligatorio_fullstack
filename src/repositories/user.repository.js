const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

const findUserByUsername = async (username) => {
  return await User.findOne({ username: username });
};

const findUserByEmail = async (email) => {
  return await User.findOne({ email: email });
};

const findUserById = async (userId) => {
  return await User.findById(userId);
};

const saveUser = async (name, username, email, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    name: name,
    username: username,
    email: email,
    password: hashedPassword,
  });

  return await newUser.save();
};

const updatePerfil = async (userId, perfil) => {
  return await User.findByIdAndUpdate(
    userId,
    { perfil: perfil },
    { returnDocument: "after" },
  );
};

module.exports = {
  findUserByUsername,
  findUserByEmail,
  findUserById,
  saveUser,
  updatePerfil,
};
