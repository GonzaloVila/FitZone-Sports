<script setup lang="ts">
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { InsigniaFz } from '@/ui'
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_PLAN,
  VARIANTES_ESTADO,
  formatearFecha,
  formatearVigencia,
} from '../presentacion'
import type { Membresia, Socio } from '../services/servicioSocios'
import type { Opcional } from '../tipos'

defineProps<{
  socio: Socio
  usuario: Opcional<Usuario>
  membresia: Opcional<Membresia>
  nombreSede: string
}>()
</script>

<template>
  <div class="ficha">
    <section class="ficha__seccion" aria-labelledby="ficha-datos">
      <h2 id="ficha-datos" class="ficha__titulo">Datos del socio</h2>
      <dl class="ficha__lista">
        <div class="ficha__dato">
          <dt>Nombre</dt>
          <dd>{{ socio.nombre }}</dd>
        </div>
        <div class="ficha__dato">
          <dt>Email</dt>
          <dd>{{ socio.email }}</dd>
        </div>
        <div class="ficha__dato">
          <dt>DNI</dt>
          <dd>
            <template v-if="usuario.situacion === 'disponible'">{{ usuario.valor.dni }}</template>
            <span v-else class="ficha__tenue">{{ usuario.situacion === 'cargando' ? 'Cargando…' : 'No disponible' }}</span>
          </dd>
        </div>
        <div class="ficha__dato">
          <dt>Teléfono</dt>
          <dd>
            <template v-if="usuario.situacion === 'disponible'">
              {{ usuario.valor.telefono || 'Sin teléfono' }}
            </template>
            <span v-else class="ficha__tenue">{{ usuario.situacion === 'cargando' ? 'Cargando…' : 'No disponible' }}</span>
          </dd>
        </div>
        <div class="ficha__dato">
          <dt>Sede de origen</dt>
          <dd>{{ nombreSede }}</dd>
        </div>
        <div class="ficha__dato">
          <dt>Fecha de alta</dt>
          <dd>{{ formatearFecha(socio.fechaAlta) }}</dd>
        </div>
      </dl>
    </section>

    <section class="ficha__seccion" aria-labelledby="ficha-membresia">
      <h2 id="ficha-membresia" class="ficha__titulo">Membresía</h2>
      <p v-if="membresia.situacion !== 'disponible'" class="ficha__tenue">
        {{ membresia.situacion === 'cargando' ? 'Cargando…' : 'No disponible' }}
      </p>
      <dl v-else class="ficha__lista">
        <div class="ficha__dato">
          <dt>Plan</dt>
          <dd>{{ ETIQUETAS_PLAN[membresia.valor.plan] }}</dd>
        </div>
        <div class="ficha__dato">
          <dt>Estado</dt>
          <dd>
            <InsigniaFz :variante="VARIANTES_ESTADO[membresia.valor.estado]">
              {{ ETIQUETAS_ESTADO[membresia.valor.estado] }}
            </InsigniaFz>
          </dd>
        </div>
        <div class="ficha__dato">
          <dt>Vigencia</dt>
          <dd>{{ formatearVigencia(membresia.valor.fechaInicio, membresia.valor.fechaFin) }}</dd>
        </div>
        <div class="ficha__dato">
          <dt>Renovación automática</dt>
          <dd>{{ membresia.valor.renuevaAutomatica ? 'Sí' : 'No' }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.ficha {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--fz-espaciado-amplio);
}

.ficha__seccion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.ficha__titulo {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}

.ficha__lista {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
  margin: 0;
}

.ficha__dato {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-compacto);
  font-size: var(--fz-texto-pequeno);
}

.ficha__dato dt {
  min-width: 10rem;
  color: var(--fz-color-texto-suave);
}

.ficha__dato dd {
  margin: 0;
  color: var(--fz-color-texto);
}

.ficha__tenue {
  margin: 0;
  color: var(--fz-color-texto-suave);
}
</style>
