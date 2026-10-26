<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, SelectFz } from '@/ui'
import FormularioIngreso from '../components/FormularioIngreso.vue'
import ResultadoIngreso from '../components/ResultadoIngreso.vue'
import { useRegistroIngreso } from '../composables/useRegistroIngreso'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, cargando: cargandoSedes, error: errorSedes } = useSedes()

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
  socioIdInput,
  codigoTotpInput,
  procesando,
  resultado,
  registrar,
} = useRegistroIngreso(sedeSeleccionada)
</script>

<template>
  <div class="registrar-ingreso-page">
    <header class="registrar-ingreso-page__encabezado">
      <div>
        <h1 class="registrar-ingreso-page__titulo">Registrar Ingreso de Socio</h1>
        <p class="registrar-ingreso-page__subtitulo">
          Valida la membresía y aforo mediante código QR o número de socio.
        </p>
      </div>

      <div class="registrar-ingreso-page__acciones">
        <RouterLink to="/acceso/aforo">
          <BotonFz variante="secundario">Ver Aforo y Ocupación</BotonFz>
        </RouterLink>
        <RouterLink to="/acceso/historial">
          <BotonFz variante="secundario">Historial</BotonFz>
        </RouterLink>
      </div>
    </header>

    <div v-if="errorSedes" class="registrar-ingreso-page__alerta">
      <AvisoFz variante="peligro">{{ errorSedes }}</AvisoFz>
    </div>

    <!-- Selector de sede para GERENTE -->
    <div v-if="esGerente" class="registrar-ingreso-page__selector-sede">
      <label for="select-sede-ingreso" class="registrar-ingreso-page__label-sede">
        Sede de acceso:
      </label>
      <SelectFz
        id="select-sede-ingreso"
        :model-value="sedeSeleccionada ? String(sedeSeleccionada) : ''"
        :deshabilitado="cargandoSedes || procesando"
        @update:model-value="(val) => (sedeSeleccionada = val ? Number(val) : null)"
      >
        <option v-for="s in sedes" :key="s.id" :value="String(s.id)">
          {{ s.nombre }}
        </option>
      </SelectFz>
    </div>

    <!-- Resultado visual del último intento -->
    <ResultadoIngreso :resultado="resultado" />

    <!-- Formulario de carga de datos -->
    <FormularioIngreso
      v-model:socio-id="socioIdInput"
      v-model:codigo-totp="codigoTotpInput"
      :procesando="procesando"
      :bloqueado="!sedeSeleccionada"
      @enviar="registrar"
    />
  </div>
</template>

<style scoped>
.registrar-ingreso-page {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-amplio);
  max-width: 48rem;
  margin: 0 auto;
  width: 100%;
}

.registrar-ingreso-page__encabezado {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--fz-espaciado-base);
  flex-wrap: wrap;
}

.registrar-ingreso-page__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.registrar-ingreso-page__subtitulo {
  margin: var(--fz-espaciado-minimo) 0 0;
  color: var(--fz-color-texto-suave);
}

.registrar-ingreso-page__acciones {
  display: flex;
  gap: var(--fz-espaciado-medio);
  align-items: center;
}

.registrar-ingreso-page__selector-sede {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-medio);
  background: var(--fz-color-fondo);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  padding: var(--fz-espaciado-medio) var(--fz-espaciado-base);
}

.registrar-ingreso-page__label-sede {
  font-weight: var(--fz-peso-enfasis);
  font-size: var(--fz-texto-cuerpo);
  white-space: nowrap;
}

.registrar-ingreso-page__alerta {
  width: 100%;
}
</style>
