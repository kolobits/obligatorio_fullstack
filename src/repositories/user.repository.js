const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

const findUserByUsername = async (username) => {
    return await User.findOne({ username: username });
};

const saveUser = async (name, username, email, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
        name: name,
        username: username,
        email: email,
        password: hashedPassword
    });

    return await newUser.save();
};

module.exports = {
    findUserByUsername,
    saveUser
};