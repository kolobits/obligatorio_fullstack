const bcrypt = require("bcryptjs");

const isValidPassword = async (password, userPassword) => {
    const result = await bcrypt.compare(password, userPassword);
    return result;
}

module.exports = {
    isValidPassword
}