// Pasa a texto el valor de un campo de formulario antes de validarlo. Un campo con type="number" entrega un NÚMERO en runtime
// aunque el modelo se declare como texto (v-model lo convierte), y un campo vacío puede quedar null o undefined: llamar
// `.trim()` sobre eso lanza un TypeError. Con esto el valor se mira siempre como texto, sin espacios en los bordes.
export function comoTexto(valor: unknown): string {
  return String(valor ?? '').trim()
}
