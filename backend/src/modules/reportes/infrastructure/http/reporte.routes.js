import { Router } from 'express';
import { permitir } from '../../../usuarios/infrastructure/http/auth.middleware.js';

// GET /api/hoteles/:hotelId/reportes?desde=2026-10-01&hasta=2026-10-31 — admin y gerente (RN-72, RN-78)
export const reporteRoutes = ({ generarReporte }) => {
  const router = Router({ mergeParams: true });
  router.get('/reportes', permitir('reportes:ver'), async (req, res, next) => {
    try {
      const r = await generarReporte.ejecutar(req.params.hotelId, req.query);
      res.json({
        ...r,
        ingresoHospedaje: r.ingresoHospedaje.pesos, adr: r.adr.pesos, revpar: r.revpar.pesos,
        cobrado: r.cobrado.pesos, porCobrar: r.porCobrar.pesos,
        cobradoPorMetodo: r.cobradoPorMetodo.map((m) => ({ ...m, monto: m.monto.pesos })),
      });
    } catch (e) { next(e); }
  });
  return router;
};
