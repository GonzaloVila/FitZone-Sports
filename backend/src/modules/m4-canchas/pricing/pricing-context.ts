// El precio se calcula contra estos datos ya leídos: ningún archivo de
// pricing/ consulta la base ni inyecta ningún repositorio (RF-11, lógica de
// dominio pura).
export interface PricingContext {
  costoBase: number;
  socioVigente: boolean;
  inicio: Date;
  fin: Date;
}
