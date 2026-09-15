const bcrypt = require('bcryptjs')

const users = [
  {
    id: 1,
    name: 'Administrador',
    username: 'admin',
    password:'$2b$10$WrwzoSP2bUlV73YH4YoxQuRcDRFX6TIiV43WadpjhWnQKeTMrgcoW',
    rol: 'admin',
    perfil: null
  }
];

const getUsers = () => users;

const isValidPassword = async (password, userPassword) => {
  console.log(password);
  console.log(userPassword);

    const result = await bcrypt.compare(password, userPassword);
  console.log(result);

    return result;
}

const saveUser = async (name, username, password) => {
    const lastUser = users[users.length - 1];
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        name: name,
        username: username,
        password: hashedPassword,
        rol: "user",
        perfil: "plus",
    };
    if (lastUser) {
        newUser.id = lastUser.id + 1;
    } else {
        newUser.id = 1;
    }
    users.push(newUser);

    console.log(newUser);

    return newUser;
}

const findUserByUserName = (username) => {
  const user = users.find((u) => u.username == username);
  return user;
};

module.exports = {
    getUsers,
    saveUser,
    findUserByUserName,
    isValidPassword
};