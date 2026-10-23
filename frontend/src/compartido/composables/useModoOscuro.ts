import { ref } from 'vue'

const temaOscuro = ref(false)

// Cargar preferencia persistida o detectar media query del sistema
function inicializarTema() {
  if (typeof window === 'undefined') return
  const guardado = localStorage.getItem('fitzone_tema')
  if (guardado) {
    temaOscuro.value = guardado === 'oscuro'
  } else {
    temaOscuro.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  aplicarTema()
}

function aplicarTema() {
  if (typeof document === 'undefined') return
  if (temaOscuro.value) {
    document.documentElement.classList.add('modo-oscuro')
  } else {
    document.documentElement.classList.remove('modo-oscuro')
  }
}

function alternarTema() {
  temaOscuro.value = !temaOscuro.value
  localStorage.setItem('fitzone_tema', temaOscuro.value ? 'oscuro' : 'claro')
  aplicarTema()
}

export function useModoOscuro() {
  return {
    temaOscuro,
    alternarTema,
    inicializarTema,
  }
}
