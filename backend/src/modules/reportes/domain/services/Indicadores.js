// SERVICIO DE DOMINIO: indicadores hoteleros estándar, calculados en centavos para no perder precisión.
//   Ocupación = noches vendidas / noches disponibles
//   ADR       = ingreso de hospedaje / noches vendidas          (tarifa promedio por noche vendida)
//   RevPAR    = ingreso de hospedaje / noches disponibles       (ingreso por habitación disponible)
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

const dividir = (centavos, entre) => (entre > 0 ? new Dinero(Math.round(centavos / entre)) : Dinero.cero());

/**
 * @param {{ habitaciones: number, dias: {fecha: string, ocupadas: number, ingreso: Dinero}[] }} datos
 */
export function calcularIndicadores({ habitaciones, dias }) {
  const disponibles = habitaciones * dias.length;
  const vendidas = dias.reduce((s, d) => s + d.ocupadas, 0);
  const ingreso = dias.reduce((s, d) => s.sumar(d.ingreso), Dinero.cero());
  return {
    nochesDisponibles: disponibles,
    nochesVendidas: vendidas,
    ocupacion: disponibles > 0 ? Math.round((1000 * vendidas) / disponibles) / 10 : 0,   // % con 1 decimal
    ingresoHospedaje: ingreso,
    adr: dividir(ingreso.centavos, vendidas),
    revpar: dividir(ingreso.centavos, disponibles),
    porDia: dias.map((d) => ({ fecha: d.fecha, ocupadas: d.ocupadas,
      ocupacion: habitaciones > 0 ? Math.round((1000 * d.ocupadas) / habitaciones) / 10 : 0 })),
  };
}
