// La sesión se guarda en sessionStorage: sobrevive a recargar la página,
// pero se borra al cerrar la pestaña (más seguro que localStorage en una computadora compartida de recepción).
const CLAVE = 'pms.sesion';

export const sesionStorage = {
  leer() {
    try { const s = JSON.parse(sessionStorage.getItem(CLAVE)); return s && new Date(s.expiraEn) > new Date() ? s : null; }
    catch { return null; }
  },
  guardar(sesion) { try { sessionStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch { /* modo privado */ } },
  borrar() { try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ } },
};
