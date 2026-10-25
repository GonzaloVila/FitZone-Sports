import { describe, expect, it } from 'vitest'

// Verificación estática, no de renderizado: jsdom no aplica los estilos de los componentes, así que no puede
// ver si una regla llega o no a un elemento. Lo que sí puede vigilar es la causa de la regresión.
//
// Reka dibuja envoltorios propios (el del Popper del menú, la región del Viewport de los avisos). El atributo
// `data-v-…` de un <style scoped> cae en el envoltorio y nuestra clase en el elemento interno, que no lo recibe:
// el CSS no se aplica y el contenido se ve sin estilo. Por eso los componentes que usan Reka llevan su <style>
// sin scoped (con clases de prefijo propio).
const fuentes = import.meta.glob<string>('./**/*.vue', { query: '?raw', import: 'default', eager: true })

const conReka = Object.entries(fuentes).filter(([, codigo]) => /from 'reka-ui'/.test(codigo))

describe('componentes que usan Reka', () => {
  it('se detectan los que hoy lo usan (si cambia la lista, revisar este test)', () => {
    expect(conReka.map(([ruta]) => ruta).sort()).toEqual([
      './moleculas/MenuAccionesFz.vue',
      './organismos/ContenedorAvisosFz.vue',
    ])
  })

  it.each(conReka)('%s no usa <style scoped>', (_ruta, codigo) => {
    expect(codigo).not.toMatch(/<style[^>]*\bscoped\b/)
    expect(codigo).toMatch(/<style[\s>]/)
  })
})
