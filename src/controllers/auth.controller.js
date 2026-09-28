const { findUserByUsername, findUserByEmail, saveUser } = require("../repositories/user.repository");
const { isValidPassword } = require("../utils/validatePassword");
const jwt = require("jsonwebtoken");

const postAuthLogin = async (req, res) => {
    const { body } = req;
    const { username, password } = body;

    try {
        const user = await findUserByUsername(username);

        if (!user) {
            return res.status(400).json({ message: "Credenciales invalidas" });
        }

        const isValidPass = await isValidPassword(password, user.password);

        if (!isValidPass) {
            return res.status(400).json({ message: "Credenciales invalidas" });
        }

        const userId = user._id.toString();

        const token = jwt.sign({ id: userId, username: user.username },
            process.env.AUTH_SECRET_KEY, { expiresIn: '1h' });

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ocurrio un error" });
    }
};

const postAuthSignup = async (req, res) => {
    const { body } = req;
    const { username, name, email, password } = body;

    try {
        const user = await findUserByUsername(username);

        if (user) {
            return res.status(400).json({ message: "Nombre de usuario ya en uso" });
        }

        const userConEmail = await findUserByEmail(email);

        if (userConEmail) {
            return res.status(400).json({ message: "Email ya registrado" });
        }

        const nuevoUsuario = await saveUser(name, username, email, password);
        res.status(201).json({
            message: "Usuario registrado con éxito",
            id: nuevoUsuario._id,
            username: nuevoUsuario.username,
            perfil: nuevoUsuario.perfil
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ocurrio un error" });
    }
};

module.exports = {
    postAuthLogin,
    postAuthSignup
};
