<script setup lang="ts">
import { useId } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, CampoFormularioFz, SelectFz } from '@/ui'
import { useAltaSocio } from '../composables/useAltaSocio'
import { ETIQUETAS_PLAN, PLANES } from '../presentacion'

const router = useRouter()

const {
  modo,
  busqueda,
  resultados,
  hayMasResultados,
  buscando,
  busquedaHecha,
  errorBusqueda,
  seleccionado,
  creadoAhora,
  datosNuevo,
  sede,
  plan,
  enviando,
  errores,
  errorGeneral,
  seleccionar,
  quitarSeleccion,
  enviar,
} = useAltaSocio()
const { sedes, error: errorSedes } = useSedes()

const idSede = useId()
const idPlan = useId()
const idErrorSede = useId()
const idErrorPlan = useId()
const idResultados = useId()

async function alEnviar() {
  const id = await enviar()
  if (id !== null) {
    // El aviso de éxito se muestra en el detalle (el parámetro se consume una sola vez).
    await router.push({ name: 'socio-detalle', params: { socioId: id }, query: { alta: '1' } })
  }
}

function mensajeBusqueda(): string {
  if (buscando.value) return 'Buscando…'
  if (errorBusqueda.value) return ''
  if (busquedaHecha.value && resultados.value.length === 0) return 'No se encontraron usuarios sin membresía con esa búsqueda.'
  if (busquedaHecha.value) return `${resultados.value.length} ${resultados.value.length === 1 ? 'resultado' : 'resultados'}`
  return ''
}
</script>

<template>
  <section class="alta">
    <RouterLink :to="{ name: 'socios' }" class="alta__volver">Volver a socios</RouterLink>
    <h1 class="alta__titulo">Nuevo socio</h1>

    <AvisoFz v-if="errorGeneral" variante="peligro">{{ errorGeneral }}</AvisoFz>
    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>

    <form class="alta__formulario" novalidate @submit.prevent="alEnviar">
      <fieldset class="alta__grupo">
        <legend class="alta__leyenda">Paso 1: usuario</legend>

        <div class="alta__opciones" role="radiogroup" aria-label="Cómo elegir el usuario">
          <label class="alta__opcion">
            <input v-model="modo" type="radio" name="modo" value="existente" />
            Usuario existente
          </label>
          <label class="alta__opcion">
            <input v-model="modo" type="radio" name="modo" value="nuevo" :disabled="enviando" />
            Crear usuario nuevo
          </label>
        </div>

        <template v-if="modo === 'existente'">
          <div v-if="seleccionado" class="alta__elegido">
            <p class="alta__texto">
              <strong>{{ seleccionado.nombre }}</strong> ({{ seleccionado.email }})
              <template v-if="creadoAhora"> — usuario creado recién.</template>
            </p>
            <BotonFz variante="secundario" tamano="sm" :disabled="enviando" @click="quitarSeleccion">
              Elegir otro
            </BotonFz>
          </div>

          <template v-else>
            <CampoFormularioFz
              v-model="busqueda"
              etiqueta="Buscar usuario por nombre o email"
              ayuda="Escribí al menos 2 caracteres. Si escribís un email, se busca el email exacto."
              tipo="search"
              name="busqueda"
              autocomplete="off"
            />

            <p class="alta__estado" aria-live="polite">{{ mensajeBusqueda() }}</p>
            <AvisoFz v-if="errorBusqueda" variante="peligro">{{ errorBusqueda }}</AvisoFz>

            <fieldset v-if="resultados.length > 0" :id="idResultados" class="alta__resultados">
              <legend class="alta__leyenda-chica">Resultados</legend>
              <label v-for="usuario in resultados" :key="usuario.id" class="alta__opcion">
                <input type="radio" name="usuario" :value="usuario.id" @change="seleccionar(usuario)" />
                {{ usuario.nombre }} ({{ usuario.email }})
              </label>
            </fieldset>
            <p v-if="hayMasResultados" class="alta__estado">Hay más resultados: afiná la búsqueda para verlos.</p>
          </template>

          <p v-if="errores.usuario" class="alta__error" role="alert">{{ errores.usuario }}</p>
        </template>

        <template v-else>
          <div class="alta__campos">
            <CampoFormularioFz
              v-model="datosNuevo.dni"
              etiqueta="DNI"
              ayuda="Entre 7 y 20 dígitos, sin puntos ni espacios."
              name="dni"
              inputmode="numeric"
              autocomplete="off"
              :error="errores.dni"
            />
            <CampoFormularioFz
              v-model="datosNuevo.nombre"
              etiqueta="Nombre y apellido"
              name="nombre"
              autocomplete="name"
              :error="errores.nombre"
            />
            <CampoFormularioFz
              v-model="datosNuevo.email"
              etiqueta="Email"
              tipo="email"
              name="email"
              autocomplete="off"
              :error="errores.email"
            />
            <CampoFormularioFz
              v-model="datosNuevo.contrasenia"
              etiqueta="Contraseña"
              ayuda="Al menos 8 caracteres."
              tipo="password"
              name="contrasenia"
              autocomplete="new-password"
              :error="errores.contrasenia"
            />
            <CampoFormularioFz
              v-model="datosNuevo.telefono"
              etiqueta="Teléfono (opcional)"
              tipo="tel"
              name="telefono"
              autocomplete="off"
              :error="errores.telefono"
            />
          </div>
        </template>
      </fieldset>

      <fieldset class="alta__grupo">
        <legend class="alta__leyenda">Paso 2: membresía</legend>
        <div class="alta__campos">
          <div class="alta__campo">
            <label :for="idSede" class="alta__etiqueta">Sede de origen</label>
            <SelectFz
              :id="idSede"
              v-model="sede"
              name="sede"
              :invalido="Boolean(errores.sede)"
              :aria-describedby="errores.sede ? idErrorSede : undefined"
            >
              <option value="">Elegí una sede</option>
              <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
            </SelectFz>
            <p v-if="errores.sede" :id="idErrorSede" class="alta__error" role="alert">{{ errores.sede }}</p>
          </div>

          <div class="alta__campo">
            <label :for="idPlan" class="alta__etiqueta">Plan</label>
            <SelectFz
              :id="idPlan"
              v-model="plan"
              name="plan"
              :invalido="Boolean(errores.plan)"
              :aria-describedby="errores.plan ? idErrorPlan : undefined"
            >
              <option value="">Elegí un plan</option>
              <option v-for="valor in PLANES" :key="valor" :value="valor">{{ ETIQUETAS_PLAN[valor] }}</option>
            </SelectFz>
            <p v-if="errores.plan" :id="idErrorPlan" class="alta__error" role="alert">{{ errores.plan }}</p>
          </div>
        </div>
      </fieldset>

      <div class="alta__envio">
        <BotonFz tipo="submit" :cargando="enviando">Dar de alta</BotonFz>
      </div>
    </form>
  </section>
</template>

<style scoped>
.alta {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  max-width: 40rem;
}

.alta__volver {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 1.5rem;
  color: var(--fz-color-primario);
}

.alta__volver:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.alta__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
}

.alta__formulario {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-amplio);
}

.alta__grupo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  min-width: 0;
  margin: 0;
  padding: var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
}

.alta__leyenda {
  padding: 0 var(--fz-espaciado-compacto);
  font-weight: var(--fz-peso-enfasis);
}

.alta__leyenda-chica {
  padding: 0;
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
}

.alta__opciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-base);
}

.alta__opcion {
  display: inline-flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
  min-height: 1.5rem;
}

.alta__opcion input {
  accent-color: var(--fz-color-primario);
}

.alta__resultados {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
  margin: 0;
  padding: 0;
  border: 0;
}

.alta__elegido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.alta__texto {
  margin: 0;
}

.alta__estado {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.alta__campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.alta__campo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.alta__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
}

.alta__error {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-peligro);
}

.alta__envio {
  display: flex;
}
</style>
