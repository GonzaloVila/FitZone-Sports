<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, SelectFz } from '@/ui'
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
</script>

<template>
  <div class="aforo-page">
    <!-- Header moderno con jerarquía y acciones -->
    <header class="aforo-page__encabezado">
      <div class="aforo-page__titulos">
        <h1 class="aforo-page__titulo">Control de Aforo y Ocupación</h1>
        <p class="aforo-page__subtitulo">
          Monitoreo en tiempo real del aforo de la sede y egreso de socios.
        </p>
      </div>

      <!-- Barra de acciones jerarquizada -->
      <div class="aforo-page__acciones">
        <RouterLink to="/acceso/ingreso">
          <BotonFz variante="primario">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 0.375rem;">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Registrar Ingreso
          </BotonFz>
        </RouterLink>

        <RouterLink to="/acceso/historial">
          <BotonFz variante="secundario">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.375rem;">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Historial
          </BotonFz>
        </RouterLink>

        <RouterLink v-if="esGerente" to="/sedes/nueva">
          <BotonFz variante="secundario">
            + Nueva Sede
          </BotonFz>
        </RouterLink>
      </div>
    </header>

    <div v-if="errorSedes" class="aforo-page__error">
      <AvisoFz variante="peligro">{{ errorSedes }}</AvisoFz>
    </div>

    <div v-if="errorAforo" class="aforo-page__error">
      <AvisoFz variante="peligro">{{ errorAforo }}</AvisoFz>
    </div>

    <div v-if="mensajeAccion" class="aforo-page__mensaje-accion">
      <AvisoFz
        :variante="mensajeAccion.tipo === 'exito' ? 'exito' : mensajeAccion.tipo === 'aviso' ? 'advertencia' : 'peligro'"
      >
        {{ mensajeAccion.texto }}
      </AvisoFz>
    </div>

    <!-- Tarjeta de Aforo con selector integrado -->
    <TarjetaAforo
      :aforo="aforo"
      :nombre-sede="sedeSeleccionada ? nombreDeSede(sedeSeleccionada) : undefined"
      :cargando="cargandoAforo"
    >
      <template #selector>
        <!-- Selector integrado en la cabecera sin romper la fila -->
        <div v-if="esGerente" class="aforo-page__selector-integrado">
          <label for="select-sede-aforo" class="aforo-page__selector-label">Sede:</label>
          <SelectFz
            id="select-sede-aforo"
            :model-value="sedeSeleccionada ? String(sedeSeleccionada) : ''"
            :disabled="cargandoSedes"
            class="aforo-page__select"
            @update:model-value="(val) => (sedeSeleccionada = val ? Number(val) : null)"
          >
            <option v-for="s in sedes" :key="s.id" :value="String(s.id)">
              {{ s.nombre }} ({{ s.aforoMaximo }} cap.)
            </option>
          </SelectFz>
        </div>
      </template>
    </TarjetaAforo>

    <!-- Sección de Personas Dentro / Egresos -->
    <section class="aforo-page__seccion-egreso">
      <div class="aforo-page__cabecera-seccion">
        <div>
          <h2 class="aforo-page__titulo-seccion">Socios en la sede</h2>
          <p class="aforo-page__subtitulo-seccion">Listado de ocupantes activos para registro de egreso.</p>
        </div>
      </div>

      <div v-if="errorPersonas" class="aforo-page__error">
        <AvisoFz variante="peligro">{{ errorPersonas }}</AvisoFz>
      </div>

      <TablaPersonasDentro
        :personas="personas"
        :cargando="cargandoPersonas"
        :egresando-id="egresandoId"
        @egresar="registrarEgreso"
        @actualizar="refrescarTodo"
      />
    </section>
  </div>
</template>

<style scoped>
.aforo-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.aforo-page__encabezado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  padding-bottom: var(--fz-espaciado-compacto);
}

.aforo-page__titulos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-minimo);
}

.aforo-page__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.aforo-page__subtitulo {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  color: var(--fz-color-texto-suave);
}

.aforo-page__acciones {
  display: flex;
  gap: var(--fz-espaciado-medio);
  align-items: center;
  flex-wrap: wrap;
}

.aforo-page__selector-integrado {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.aforo-page__selector-label {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto-suave);
}

.aforo-page__select {
  min-width: 15rem;
}

.aforo-page__seccion-egreso {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-medio);
}

.aforo-page__cabecera-seccion {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.aforo-page__titulo-seccion {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  letter-spacing: -0.015em;
  color: var(--fz-color-texto);
}

.aforo-page__subtitulo-seccion {
  margin: 0.125rem 0 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.aforo-page__error,
.aforo-page__mensaje-accion {
  width: 100%;
}
</style>
