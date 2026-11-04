// Cómo se muestra cada estado. Los nombres coinciden con los ENUM de PostgreSQL.
export const ESTADOS_RESERVACION = {
  pendiente:  { texto: 'Pendiente',   tono: 'ambar' },
  confirmada: { texto: 'Confirmada',  tono: 'azul' },
  check_in:   { texto: 'Hospedado',   tono: 'verde' },
  check_out:  { texto: 'Salió',       tono: 'gris' },
  cancelada:  { texto: 'Cancelada',   tono: 'rojo' },
  no_show:    { texto: 'No llegó',    tono: 'rojo' },
};

export const ESTADOS_HABITACION = {
  disponible:     { texto: 'Disponible',       tono: 'verde' },
  ocupada:        { texto: 'Ocupada',          tono: 'azul' },
  limpieza:       { texto: 'Por limpiar',      tono: 'ambar' },
  mantenimiento:  { texto: 'Mantenimiento',    tono: 'rojo' },
  fuera_servicio: { texto: 'Fuera de servicio', tono: 'gris' },
};

export const METODOS_PAGO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', deposito: 'Depósito' };
export const CANALES = { mostrador: 'Mostrador', telefono: 'Teléfono', whatsapp: 'WhatsApp', telegram: 'Telegram', web: 'Web', ota: 'Agencia en línea' };
export const ROLES = { admin: 'Administrador', gerente: 'Gerente', recepcion: 'Recepción', limpieza: 'Limpieza' };
export const TIPOS_DOCUMENTO = { INE: 'INE', pasaporte: 'Pasaporte', licencia: 'Licencia', otro: 'Otro' };

// RN-24: a qué estados se puede pasar a mano desde cada uno (igual que en el backend)
export const CAMBIOS_HABITACION = {
  disponible:     ['limpieza', 'mantenimiento', 'fuera_servicio'],
  limpieza:       ['disponible', 'mantenimiento'],
  mantenimiento:  ['disponible', 'limpieza', 'fuera_servicio'],
  fuera_servicio: ['disponible', 'mantenimiento'],
  ocupada:        [],
};
export const requiereServicio = (de, a) => [de, a].some((e) => e === 'mantenimiento' || e === 'fuera_servicio');
