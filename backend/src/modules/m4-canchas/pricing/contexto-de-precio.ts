// Datos ya leidos para cotizar el precio (RF-11): pricing/ es dominio puro y no
// consulta la base ni inyecta repositorios.
export interface ContextoDePrecio {
  costoBase: number;
  socioVigente: boolean;
  inicio: Date;
  fin: Date;
}
