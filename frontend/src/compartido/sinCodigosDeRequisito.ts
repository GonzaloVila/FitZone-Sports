// Un código de requisito del proyecto: RN-01, RNF-04, RF-12, CU-03.
const CODIGO = String.raw`(?:RNF|RN|RF|CU)-\d+`

// Una referencia entre paréntesis o corchetes formada solo por códigos, solos o unidos por coma, punto y coma, barra,
// "y" o "e": (RN-01), [RNF-04], (RN-01, RN-02), (RN-01/RF-05). Lleva consigo los espacios que la precedían.
// Si adentro hay otra cosa, por ejemplo "(RF-04, QR dinámico)", no se toca: no es solo una referencia.
const REFERENCIA = new RegExp(String.raw`\s*[(\[]\s*${CODIGO}(?:\s*(?:[,;/]|\by\b|\be\b)\s*${CODIGO})*\s*[)\]]`, 'g')

// Los mensajes de la API traen referencias a los requisitos ("... registrado (RN-01).") que no le dicen nada a quien
// usa la app. Las saca y deja el resto tal cual; si no hay ninguna, devuelve el mismo texto.
export function sinCodigosDeRequisito(texto: string): string {
  const limpio = texto.replace(REFERENCIA, '')
  if (limpio === texto) return texto
  // Una referencia al principio deja un espacio de más al comienzo; una al final antes de un punto, un espacio suelto.
  return limpio.replace(/^\s+/, '').replace(/\s+([.,;:!?])/g, '$1')
}
