// Convierte los errores en respuestas JSON. Los del dominio incluyen la regla que se rompió.
export const errorHandler = (err, req, res, _next) => {
  if (!err.status) console.error(err);
  const cuerpo = { error: err.status ? err.message : 'Error interno' };
  if (err.regla) cuerpo.regla = err.regla;
  res.status(err.status ?? 500).json(cuerpo);
};
