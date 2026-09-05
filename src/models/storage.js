const viajes = [
    {
        id: 1,
        destino: "Paris",
        fechaInicio: "2023-10-01",
        fechaFin: "2023-10-07",
        presupuesto: 1000,
        descripcion: "Viaje de placer",
        categoria: "Turismo",
        estado: "planificado"
    }
];
let currentId = 2;

const getViajes = () => viajes;

const findViaje = (id) => viajes.find((v) => v.id == id);

const createViaje = ({ destino, fechaInicio, fechaFin, presupuesto, descripcion, categoria }) => {
    const nuevoViaje = {
        id: currentId++,
        destino,
        fechaInicio,
        fechaFin,
        presupuesto,
        descripcion: descripcion || null,
        categoria: categoria || null,
        estado: "planificado"
    };
    viajes.push(nuevoViaje);
    return nuevoViaje;
};

const updateViaje = (id, body) => {
    const index = viajes.findIndex((v) => v.id == id);
    if (index === -1) return null;

    viajes[index] = { ...viajes[index], ...body };
    return viajes[index];
};

const deleteViaje = (id) => {
    const indexToBeDeleted = viajes.findIndex((v) => v.id == id);
    if (indexToBeDeleted === -1) return false;

    viajes.splice(indexToBeDeleted, 1);
    return true;
};

module.exports = {
    getViajes,
    findViaje,
    createViaje,
    updateViaje,
    deleteViaje
};