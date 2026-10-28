<script setup lang="ts">
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import ListaPagos from '../components/ListaPagos.vue'

// El mismo id de la sesión con el que "Mis reservas" de canchas filtra las suyas. El filtro es del front: el backend hoy no
// valida que el pago sea del usuario (ver README).
const { usuarioId } = useUsuarioSesion()
</script>

<template>
  <ListaPagos
    titulo="Mis pagos"
    subtitulo="Tus pagos y comprobantes."
    :usuario-id="usuarioId"
    :mostrar-usuario="false"
    :puede-anular="false"
    vacio-sin-filtros="Todavía no tenés pagos."
  />
</template>
