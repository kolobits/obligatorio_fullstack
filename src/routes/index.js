const express = require('express');
const router = express.Router();
const { getViajes } = require('../models/storage');


router.get('/viajes', (req, res) => {
  res.status(200).json(getViajes());
});

router.post('/viajes', (req, res) => {
  const { nombre, fechaInicio, fechaFin, presupuesto, descripcion, categoria } = req.body;
    if (!nombre || !fechaInicio || !fechaFin || !presupuesto) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const nuevoViaje = createViaje({ nombre, fechaInicio, fechaFin, presupuesto, descripcion, categoria });
    res.status(201).json(nuevoViaje);
});

router.get('/viajes/:id', (req, res) => {
    const viaje = findViaje(req.params.id);
    if (!viaje) {
        return res.status(404).json({ message: 'Viaje not found' });
    }
    res.status(200).json(viaje);
});

router.put('/viajes/:id', (req, res) => {
    const updatedViaje = updateViaje(req.params.id, req.body);
    if (!updatedViaje) {
        return res.status(404).json({ message: 'Viaje not found' });
    }
    res.status(200).json(updatedViaje);
});

router.delete('/viajes/:id', (req, res) => {
    const deleted = deleteViaje(req.params.id);
    if (!deleted) {
        return res.status(404).json({ message: 'Viaje not found' });
    }
    res.status(204).send();
});

module.exports = router;