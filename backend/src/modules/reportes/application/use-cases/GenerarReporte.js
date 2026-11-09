import { calcularIndicadores } from '../../domain/services/Indicadores.js';
import { ReporteError } from '../../domain/errors/ReporteError.js';
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const sumarDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** RN-78: reporte de ocupación e ingresos de un periodo (solo admin y gerente, máximo un año) */
export class GenerarReporte {
  constructor({ reporteRepository, reloj }) { Object.assign(this, { repo: reporteRepository, reloj }); }

  async ejecutar(hotelId, { desde, hasta } = {}) {
    const hoy = this.reloj.hoy();
    hasta = hasta || hoy;
    desde = desde || sumarDias(hasta, -29);                     // por omisión: últimos 30 días
    if (!ISO.test(desde) || !ISO.test(hasta) || Number.isNaN(dias(desde, hasta)))
      throw new ReporteError('Fechas inválidas, usa AAAA-MM-DD', 'RN-78');
    if (hasta < desde) throw new ReporteError('"Hasta" debe ser igual o posterior a "desde"', 'RN-78');
    if (dias(desde, hasta) > 365) throw new ReporteError('El periodo puede ser de máximo un año', 'RN-78');

    const d = await this.repo.datosDelPeriodo(hotelId, desde, hasta);
    const cobrado = d.cobrado.reduce((s, m) => s.sumar(m.monto), Dinero.cero());
    return {
      desde, hasta, habitaciones: d.habitaciones,
      ...calcularIndicadores(d),
      cobrado,
      cobradoPorMetodo: d.cobrado,
      porCanal: d.porCanal,
      porEstado: d.porEstado,
      cancelaciones: d.cancelaciones,
      porCobrar: d.porCobrar,
    };
  }
}
