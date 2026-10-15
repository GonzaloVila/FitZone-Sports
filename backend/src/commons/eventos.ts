// Nombres de los eventos del bus interno (RF-02, RF-07). Viven en commons porque
// los emite un modulo que NO puede importar al que los escucha (el grafo es quien
// escucha -> quien emite): M1 emite y M5 escucha (RF-02), M3 emite y M5 escucha
// (RF-07, penalidad por cancelacion tardia). Es el unico lugar que los dos lados
// pueden importar sin cerrar un ciclo. La carga util de cada evento esta tipada
// en el modulo que la escucha.

export const EVENTO_SOCIO_ALTA = 'socio.dadoDeAlta';
export const EVENTO_MEMBRESIA_PLAN = 'membresia.planCambiado';
export const EVENTO_RESERVA_CLASE_CANCELADA_TARDIA = 'reservaClase.canceladaTardia';
// RF-08: se libero un cupo de clase. Lo emite M3 al cancelar una reserva y lo
// escuchan sus propios listeners (Observer: un hecho -> N interesados).
export const EVENTO_CUPO_LIBERADO = 'reservaClase.cupoLiberado';