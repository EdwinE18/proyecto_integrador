// Rutas anidadas: /api/reservaciones/:id/pagos
import { Router } from 'express';

const aPagoJSON = (p) => ({
  id: p.id, monto: p.monto.pesos, metodo: p.metodo, referencia: p.referencia,
  esAnticipo: p.esAnticipo, fechaPago: p.fechaPago,
});
export const aCuentaJSON = (c) => ({
  reservacionId: c.reservacionId, codigo: c.codigo, estado: c.estado,
  total: c.total.pesos, pagado: c.pagado.pesos, saldo: c.saldo.pesos, liquidada: c.liquidada,
  pagos: c.pagos.map(aPagoJSON),
});

export const pagoRoutes = ({ registrarPago, consultarCuenta }) => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res, next) => {
    try { res.json(aCuentaJSON(await consultarCuenta.ejecutar(req.params.id))); } catch (e) { next(e); }
  });

  // body: { monto, metodo, referencia?, esAnticipo? }
  router.post('/', async (req, res, next) => {
    try {
      const { pago, cuenta } = await registrarPago.ejecutar(req.params.id, req.body);
      res.status(201).json({ pago: aPagoJSON(pago), cuenta: aCuentaJSON(cuenta) });
    } catch (e) { next(e); }
  });

  return router;
};
