import { ref, watch } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { useUsuarioSesion } from './useUsuarioSesion'

// Nombre, email y sede del usuario autenticado, para mostrarlos en el armazón. Es decorativo: si una consulta
// falla (o la sede no aparece) no se avisa nada, el dato queda en null y el armazón se las arregla sin él.
export function usePerfilSesion() {
  const servicios = useServicios()
  const { usuarioId, sedeId } = useUsuarioSesion()

  const nombre = ref<string | null>(null)
  const email = ref<string | null>(null)
  const nombreSede = ref<string | null>(null)
  const cargando = ref(false)

  // Una consulta por usuarioId; el cleanup la aborta al cambiar el id y al desmontar.
  watch(
    usuarioId,
    async (id, _anterior, alLimpiar) => {
      nombre.value = null
      email.value = null
      cargando.value = false
      if (id === null) return

      const control = new AbortController()
      alLimpiar(() => control.abort())
      cargando.value = true
      try {
        const usuario = await servicios.usuarios.obtener(id, control.signal)
        if (control.signal.aborted) return
        nombre.value = usuario.nombre
        email.value = usuario.email
      } catch {
        // Sin aviso: el armazón se las arregla con el rol.
      } finally {
        if (!control.signal.aborted) cargando.value = false
      }
    },
    { immediate: true },
  )

  // Una consulta por sedeId. El contrato no tiene "sede por id": se pide el listado y se busca la que coincide.
  watch(
    sedeId,
    async (id, _anterior, alLimpiar) => {
      nombreSede.value = null
      if (id === null) return

      const control = new AbortController()
      alLimpiar(() => control.abort())
      try {
        const sedes = await servicios.sedes.listar(control.signal)
        if (control.signal.aborted) return
        nombreSede.value = sedes.find((sede) => sede.id === id)?.nombre ?? null
      } catch {
        // Sin aviso: simplemente no se muestra la sede.
      }
    },
    { immediate: true },
  )

  return { nombre, email, nombreSede, cargando }
}
