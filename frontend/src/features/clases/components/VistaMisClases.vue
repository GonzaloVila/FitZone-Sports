<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, PaginacionFz, PestanasFz } from '@/ui'
import { useMisClases } from '../composables/useMisClases'
import { usePestanasMisClases } from '../composables/usePestanasMisClases'
import { paginar } from '../reglas'
import type { FilaReserva } from '../tipos'
import ModalCancelarClase from './ModalCancelarClase.vue'
import TablaMisEsperas from './TablaMisEsperas.vue'
import TablaMisReservas from './TablaMisReservas.vue'

// Reservas y lista de espera del socio. Se monta solo mientras la vista está activa: la actualización periódica de
// useMisClases se corta al volver a la agenda.
const {
  proximas,
  pasadas,
  esperas,
  ahora,
  cargando,
  error,
  accionando,
  errorAccion,
  exitoAccion,
  sinSocio,
  cancelarReserva,
  confirmarCupo,
  salirDeEspera,
} = useMisClases()
const { nombreDeSede } = useSedes()

// La pestaña y la página de las pasadas viven en la dirección (?pestana=, ?pagina-clases=).
const { pestana: pestanaActiva, pagina } = usePestanasMisClases()
const pestanas = [
  { id: 'proximas', etiqueta: 'Próximas' },
  { id: 'pasadas', etiqueta: 'Pasadas' },
]

// "Pasadas" se pagina en el cliente (ya están todas cargadas); "Próximas" no.
const POR_PAGINA_PASADAS = 10
const paginaDePasadas = computed(() => paginar(pasadas.value, pagina.value, POR_PAGINA_PASADAS))
const textoRango = computed(() => {
  const { desde, hasta, total } = paginaDePasadas.value
  return `Mostrando ${desde} a ${hasta} de ${total} ${total === 1 ? 'reserva' : 'reservas'}`
})

// Si la página de la dirección superó el total (se recargó con una página vieja o la lista se achicó) se muestra la última
// válida y se la escribe en la dirección. Recién cuando terminó de cargar: antes no hay reservas y toda página parece de más.
watch([cargando, sinSocio, () => paginaDePasadas.value.pagina, pagina], () => {
  if (cargando.value || sinSocio.value) return
  if (paginaDePasadas.value.pagina !== pagina.value) pagina.value = paginaDePasadas.value.pagina
})

const modalCancelar = ref(false)
const reservaACancelar = ref<FilaReserva | null>(null)

function pedirCancelacion(fila: FilaReserva) {
  errorAccion.value = null
  exitoAccion.value = null
  reservaACancelar.value = fila
  modalCancelar.value = true
}

async function confirmarCancelacion() {
  if (!reservaACancelar.value) return
  const ok = await cancelarReserva(reservaACancelar.value.reserva.id)
  if (ok) modalCancelar.value = false
}
</script>

<template>
  <div class="mis-clases">
    <AvisoFz v-if="sinSocio" variante="advertencia">
      Tu usuario no está asociado a un socio, así que no tiene reservas.
    </AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorAccion && !modalCancelar" variante="peligro">{{ errorAccion }}</AvisoFz>
    <AvisoFz v-if="exitoAccion" variante="exito">{{ exitoAccion }}</AvisoFz>

    <p v-if="cargando" class="mis-clases__estado" role="status">Cargando tus clases…</p>

    <template v-else-if="!sinSocio">
      <section v-if="esperas.length > 0" class="mis-clases__seccion" aria-labelledby="titulo-esperas">
        <h2 id="titulo-esperas" class="mis-clases__seccion-titulo">Listas de espera</h2>
        <TablaMisEsperas
          :filas="esperas"
          :ocupada="accionando"
          @confirmar="(fila) => confirmarCupo(fila.espera.id)"
          @salir="(fila) => salirDeEspera(fila.espera.id)"
        />
      </section>

      <section class="mis-clases__seccion" aria-labelledby="titulo-reservas">
        <h2 id="titulo-reservas" class="mis-clases__seccion-titulo">Reservas</h2>
        <PestanasFz v-model="pestanaActiva" :pestanas="pestanas" etiqueta="Mis reservas de clases">
          <template #panel-proximas>
            <TablaMisReservas
              v-if="proximas.length > 0"
              titulo="Reservas próximas"
              :filas="proximas"
              :nombre-sede="nombreDeSede"
              :ahora="ahora"
              con-acciones
              :ocupada="accionando"
              @cancelar="pedirCancelacion"
            />
            <p v-else class="mis-clases__vacio">No tenés reservas próximas. Mirá la agenda para reservar una clase.</p>
          </template>
          <template #panel-pasadas>
            <div v-if="pasadas.length > 0" class="mis-clases__panel">
              <TablaMisReservas
                titulo="Reservas pasadas"
                :filas="paginaDePasadas.items"
                :nombre-sede="nombreDeSede"
                :ahora="ahora"
              />
              <footer class="mis-clases__pie">
                <p class="mis-clases__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
                <PaginacionFz
                  v-if="paginaDePasadas.totalPaginas > 1"
                  :model-value="paginaDePasadas.pagina"
                  :total-paginas="paginaDePasadas.totalPaginas"
                  etiqueta="Paginación de reservas pasadas"
                  @update:model-value="(numero: number) => (pagina = numero)"
                />
              </footer>
            </div>
            <p v-else class="mis-clases__vacio">Todavía no tenés reservas pasadas.</p>
          </template>
        </PestanasFz>
      </section>
    </template>

    <ModalCancelarClase
      v-model="modalCancelar"
      :clase="reservaACancelar?.clase ?? null"
      :ahora="ahora"
      :cargando="accionando"
      :error="errorAccion"
      @confirmar="confirmarCancelacion"
    />
  </div>
</template>

<style scoped>
.mis-clases {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.mis-clases__estado,
.mis-clases__vacio {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.mis-clases__panel {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.mis-clases__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.mis-clases__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.mis-clases__seccion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.mis-clases__seccion-titulo {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-subtitulo);
  font-weight: var(--fz-peso-enfasis);
}
</style>
