const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

const findUserByUsername = async (username) => {
  return await User.findOne({ username: username });
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
    { new: true },
  );
};

module.exports = {
  findUserByUsername,
  findUserById,
  saveUser,
  updatePerfil,
};
