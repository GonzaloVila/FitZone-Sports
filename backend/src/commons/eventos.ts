// Nombres de los eventos del bus interno (RF-02). Viven en commons porque los
// emite M1 (que no puede importar M5: el grafo es M5 → M1) y los escucha M5:
// es el único lugar que los dos lados pueden importar sin cerrar un ciclo.
// La carga útil de cada evento está tipada en el módulo que la escucha.

export const EVENTO_SOCIO_ALTA = 'socio.dadoDeAlta';
export const EVENTO_MEMBRESIA_PLAN = 'membresia.planCambiado';