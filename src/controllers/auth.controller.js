const { saveUser, findUserByUserName, isValidPassword } = require("../models/user.model")
const jwt = require("jsonwebtoken");

const postAuthLogin = async (req, res) => {
    const { body } = req;
    const { username, password } = body;
    const user = findUserByUserName(username);

    if (!user) {
        res.status(400).json({message: "Credenciales invalidas"});
        return;
    }

    const isValidPass = await isValidPassword(password, user.password);

    if(!isValidPass){
        res.status(401).json({message: "Credenciales invalidas"});
        return;
    }

    const token = jwt.sign({ id: user.id, username: user.username },
    process.env.AUTH_SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
}


const postAuthSignup = async (req, res) => {
    const { body } = req;
    const { username, name, password } = body;
    
    if(findUserByUserName(username)){
        res.status(400).json({message: "Nombre de usuario ya en uso"})
        return
    } else {
        const user = await saveUser(name, username, password)
        res.status(201).json({message: "usuario registrado exitosamente:", id: user.id, username: user.username, perfil: user.perfil })
    }
}

module.exports = {
    postAuthLogin,
    postAuthSignup
}