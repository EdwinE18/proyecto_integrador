// SERVICIO DE DOMINIO (RN-61): calcula el precio de una estancia NOCHE POR NOCHE.
// Cada noche cobra la tarifa de temporada que la cubra; si no hay, el precio base.
// Ejemplo: 19→22 dic con Navidad desde el 20 → 19: base, 20 y 21: Navidad.
import { Dinero } from '../../../pagos/domain/value-objects/Dinero.js';

const DIA_MS = 86_400_000;

/**
 * @param {{ rango: import('../value-objects/RangoFechas.js').RangoFechas,
 *           precioBase: Dinero,
 *           temporadas: { nombre: string, inicio: string, fin: string, precio: Dinero }[] }} datos
 *        inicio/fin en 'YYYY-MM-DD'; fin NO incluido (igual que en la BD: '[)')
 */
export function cotizar({ rango, precioBase, temporadas = [] }) {
  const noches = [];
  for (let t = rango.entrada.getTime(); t < rango.salida.getTime(); t += DIA_MS) {
    const fecha = new Date(t).toISOString().slice(0, 10);
    const temporada = temporadas.find((s) => s.inicio <= fecha && fecha < s.fin);
    noches.push({ fecha, precio: temporada ? temporada.precio : precioBase, temporada: temporada?.nombre ?? null });
  }
  const total = noches.reduce((suma, n) => suma.sumar(n.precio), Dinero.cero());
  // Promedio redondeado al centavo (se guarda en reservaciones.precio_noche)
  const promedioNoche = new Dinero(Math.round(total.centavos / noches.length));
  return { noches, total, promedioNoche };
}
