// Si el :id de la URL no es un UUID, responde 404 sin consultar la base de datos.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validarUUID = (nombre = 'id') => (req, res, next) =>
  UUID.test(req.params[nombre] ?? '') ? next() : res.status(404).json({ error: 'La reservación no existe' });
