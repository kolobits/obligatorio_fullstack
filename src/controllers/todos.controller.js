const Joi = require("joi");
const sendEmail = require("../services/mailjet.service");
const { getToDos, createToDo, deleteToDo, upateToDo, findToDo, getToDosPaginated } = require("../repositories/todo.repository")

const getTodosController = async(req, res) => {
  const { id } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  try {
    const result = await getToDosPaginated(id, page, limit)
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({message: "Ha ocurrido un error: ", error});
  }
};

const getTodoController = async (req, res) => {
  const toDoId = req.params.id;
  const { id } = req.user; 
  try {
    const toDo = await findToDo(toDoId, id);
    if (toDo) {
      res.status(200).json(toDo);
    }
  } catch (error) {
    res.status(500).json({message: "Ha ocurrido un error: ", error});
  }
};


const postTodoController = async (req, res) => {
  const { body, user } = req;

  try {
    await createToDo(body.title, user.id);
    res.status(201).json({
    message: "Tarea creada correctamente",
  });
  } catch (error) {
      res.status(500).json({message: "Ha ocurrido un error: ", error});
  }
};

const deleteTodoController = async (req, res) => {
  const toDoId = req.params.id;
  const { id } = req.user;

  try {
    await deleteToDo(toDoId, id);
    res.status(200).json({
    message: "ToDo eliminado correctamente",
    });
  } catch (error) {
      res.status(500).json({message: "Ha ocurrido un error: ", error});
  }
};

const putTodoController = async (req, res) => {
  const toDoId = req.params.id;
  const { body } = req;
  const { id } = req.user;
  try {
    const toDo = await upateToDo(toDoId, id, body);
    res.status(200).json(toDo);
  } catch (error) {
    res.status(500).json({message: "Ha ocurrido un error: ", error});
  }
};

module.exports = {
  getTodosController,
  getTodoController,
  postTodoController,
  putTodoController,
  deleteTodoController,
};
