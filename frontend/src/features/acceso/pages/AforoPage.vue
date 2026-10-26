<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz, SelectFz } from '@/ui'
import TarjetaAforo from '../components/TarjetaAforo.vue'
import TablaPersonasDentro from '../components/TablaPersonasDentro.vue'
import { useAforo } from '../composables/useAforo'
import { usePersonasDentro } from '../composables/usePersonasDentro'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, cargando: cargandoSedes, error: errorSedes, nombreDeSede } = useSedes()

const sedeSeleccionada = ref<number | null>(sedeUsuario.value ?? null)

watch(
  () => sedeUsuario.value,
  (val) => {
    if (!esGerente.value && val) {
      sedeSeleccionada.value = val
    }
  },
  { immediate: true },
)

watch(
  sedes,
  (lista) => {
    if (esGerente.value && !sedeSeleccionada.value && lista.length > 0 && lista[0]) {
      sedeSeleccionada.value = lista[0].id
    }
  },
  { immediate: true },
)

const {
  aforo,
  cargando: cargandoAforo,
  error: errorAforo,
  refrescar: refrescarAforo,
} = useAforo(sedeSeleccionada)

const {
  personas,
  cargando: cargandoPersonas,
  error: errorPersonas,
  egresandoId,
  mensajeAccion,
  registrarEgreso,
  recargar: recargarPersonas,
} = usePersonasDentro(sedeSeleccionada, {
  alModificar: () => {
    void refrescarAforo()
  },
})

async function refrescarTodo() {
  await Promise.all([refrescarAforo(), recargarPersonas()])
}

const tonoMensaje = computed(() => {
  const tipo = mensajeAccion.value?.tipo
  return tipo === 'exito' ? 'exito' : tipo === 'aviso' ? 'advertencia' : 'peligro'
})
</script>

<template>
  <section class="aforo">
    <EncabezadoPaginaFz titulo="Aforo y ocupación" subtitulo="Cuánta gente hay en la sede y quién está adentro.">
      <template #acciones>
        <RouterLink v-slot="{ href, navigate }" :to="{ name: 'acceso-ingreso' }" custom>
          <BotonFz como="a" :href="href" @click="navigate">
            <IconoFz nombre="mas" tamano="sm" />
            Registrar ingreso
          </BotonFz>
        </RouterLink>
        <RouterLink v-slot="{ href, navigate }" :to="{ name: 'acceso-historial' }" custom>
          <BotonFz como="a" variante="secundario" :href="href" @click="navigate">Historial</BotonFz>
        </RouterLink>
        <RouterLink v-if="esGerente" v-slot="{ href, navigate }" :to="{ name: 'sedes-nueva' }" custom>
          <BotonFz como="a" variante="secundario" :href="href" @click="navigate">Nueva sede</BotonFz>
        </RouterLink>
      </template>
    </EncabezadoPaginaFz>

    <AvisoFz v-if="errorSedes" variante="peligro">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="errorAforo" variante="peligro">{{ errorAforo }}</AvisoFz>
    <AvisoFz v-if="mensajeAccion" :variante="tonoMensaje">{{ mensajeAccion.texto }}</AvisoFz>

    <TarjetaAforo
      :aforo="aforo"
      :nombre-sede="sedeSeleccionada ? nombreDeSede(sedeSeleccionada) : undefined"
      :cargando="cargandoAforo"
    >
      <template #selector>
        <!-- El GERENTE elige la sede; la etiqueta no se ve, pero el lector de pantalla la lee. -->
        <div v-if="esGerente" class="aforo__selector">
          <SelectFz
            name="sede"
            tamano="sm"
            aria-label="Sede"
            :model-value="sedeSeleccionada ? String(sedeSeleccionada) : ''"
            :disabled="cargandoSedes"
            @update:model-value="(val) => (sedeSeleccionada = val ? Number(val) : null)"
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
      />
    </section>
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
