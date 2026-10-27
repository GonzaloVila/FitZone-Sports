<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ModalNuevaSede from '@/features/sedes/components/modales/ModalNuevaSede.vue'
import { useSedeActiva } from '@/compartido/composables/useSedeActiva'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz, SelectFz } from '@/ui'
import ModalRegistrarIngreso from '../components/modales/ModalRegistrarIngreso.vue'
import TarjetaAforo from '../components/TarjetaAforo.vue'
import TablaPersonasDentro from '../components/TablaPersonasDentro.vue'
import { useAforo } from '../composables/useAforo'
import { usePersonasDentro } from '../composables/usePersonasDentro'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, cargando: cargandoSedes, error: errorSedes, nombreDeSede, recargar: recargarSedes } = useSedes()

// La sede que se mira se comparte con las otras pantallas del módulo; el RECEPCION trabaja siempre en la suya.
const sedeActiva = useSedeActiva(sedes, () => (esGerente.value ? null : sedeUsuario.value))

const {
  aforo,
  cargando: cargandoAforo,
  error: errorAforo,
  refrescar: refrescarAforo,
} = useAforo(sedeActiva)

const {
  personas,
  cargando: cargandoPersonas,
  error: errorPersonas,
  egresandoId,
  mensajeAccion,
  registrarEgreso,
  recargar: recargarPersonas,
} = usePersonasDentro(sedeActiva, {
  alModificar: () => {
    void refrescarAforo()
  },
})

async function refrescarTodo() {
  await Promise.all([refrescarAforo(), recargarPersonas()])
}

const ingresoAbierto = ref(false)
const sedeNuevaAbierta = ref(false)

const tonoMensaje = computed(() => {
  const tipo = mensajeAccion.value?.tipo
  return tipo === 'exito' ? 'exito' : tipo === 'aviso' ? 'advertencia' : 'peligro'
})
</script>

<template>
  <section class="aforo">
    <EncabezadoPaginaFz titulo="Aforo y ocupación" subtitulo="Cuánta gente hay en la sede y quién está adentro.">
      <template #acciones>
        <BotonFz @click="ingresoAbierto = true">
          <IconoFz nombre="mas" tamano="sm" />
          Registrar ingreso
        </BotonFz>
        <BotonFz v-if="esGerente" variante="secundario" @click="sedeNuevaAbierta = true">
          <IconoFz nombre="mas" tamano="sm" />
          Nueva sede
        </BotonFz>
        <RouterLink v-slot="{ href, navigate }" :to="{ name: 'acceso-historial' }" custom>
          <BotonFz como="a" variante="secundario" :href="href" @click="navigate">
            <IconoFz nombre="reloj" tamano="sm" />
            Historial
          </BotonFz>
        </RouterLink>
      </template>
    </EncabezadoPaginaFz>

    <AvisoFz v-if="errorSedes" variante="peligro">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="errorAforo" variante="peligro">{{ errorAforo }}</AvisoFz>
    <AvisoFz v-if="mensajeAccion" :variante="tonoMensaje">{{ mensajeAccion.texto }}</AvisoFz>

    <TarjetaAforo
      :aforo="aforo"
      :nombre-sede="sedeActiva ? nombreDeSede(sedeActiva) : undefined"
      :cargando="cargandoAforo"
    >
      <template #selector>
        <!-- El GERENTE elige la sede; la etiqueta no se ve, pero el lector de pantalla la lee. -->
        <div v-if="esGerente" class="aforo__selector">
          <SelectFz
            name="sede"
            tamano="sm"
            aria-label="Sede"
            :model-value="sedeActiva ? String(sedeActiva) : ''"
            :disabled="cargandoSedes"
            @update:model-value="(val) => (sedeActiva = val ? Number(val) : null)"
          >
            <option v-for="s in sedes" :key="s.id" :value="String(s.id)">{{ s.nombre }}</option>
          </SelectFz>
        </div>
      </template>
    </TarjetaAforo>

    <section class="aforo__seccion" aria-labelledby="aforo-socios-dentro">
      <h2 id="aforo-socios-dentro" class="aforo__subtitulo">Socios en la sede</h2>

      <AvisoFz v-if="errorPersonas" variante="peligro">{{ errorPersonas }}</AvisoFz>

      <TablaPersonasDentro
        :personas="personas"
        :cargando="cargandoPersonas"
        :egresando-id="egresandoId"
        @egresar="registrarEgreso"
        @actualizar="refrescarTodo"
        @registrar-ingreso="ingresoAbierto = true"
      />
    </section>

    <ModalRegistrarIngreso
      v-model:abierto="ingresoAbierto"
      :sedes="sedes"
      :cargando-sedes="cargandoSedes"
      @registrado="refrescarTodo"
    />

    <ModalNuevaSede v-if="esGerente" v-model:abierto="sedeNuevaAbierta" @creada="recargarSedes" />
  </section>
</template>

<style scoped>
.aforo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.aforo__selector {
  flex: none;
  width: max-content;
  max-width: 100%;
}

.aforo__seccion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.aforo__subtitulo {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-subtitulo);
  font-weight: var(--fz-peso-enfasis);
}
</style>
