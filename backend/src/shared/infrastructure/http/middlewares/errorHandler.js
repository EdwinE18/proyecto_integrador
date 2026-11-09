export const errorHandler = (err, req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Error interno' });
};
