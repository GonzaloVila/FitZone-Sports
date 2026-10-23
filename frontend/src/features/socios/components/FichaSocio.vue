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
      <div class="ficha__cabecera-seccion">
        <h2 id="ficha-datos" class="ficha__titulo">Datos del socio</h2>
        <span class="ficha__badge-id">ID Socio: #{{ socio.id }}</span>
      </div>

      <dl class="ficha__lista">
        <div class="ficha__dato ficha__dato--destacado">
          <dt>ID Socio (para control de acceso)</dt>
          <dd class="ficha__id-grande">{{ socio.id }}</dd>
        </div>
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
      <h2 id="ficha-membresia" class="ficha__titulo">Membresía actual</h2>
      <p v-if="membresia.situacion === 'cargando'" class="ficha__tenue">Cargando membresía…</p>
      <p v-else-if="membresia.situacion === 'no-disponible'" class="ficha__tenue">
        No se pudo obtener la membresía.
      </p>
      <dl v-else class="ficha__lista">
        <div class="ficha__dato">
          <dt>Plan</dt>
          <dd>
            <InsigniaFz>{{ ETIQUETAS_PLAN[membresia.valor.plan] }}</InsigniaFz>
          </dd>
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
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.ficha__seccion {
  padding: 1.25rem;
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
  box-shadow: var(--fz-sombra-tarjeta);
}

.ficha__cabecera-seccion {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.ficha__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.ficha__badge-id {
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  background: var(--fz-color-hover);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  color: var(--fz-color-texto);
}

.ficha__lista {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 0;
}

.ficha__dato {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ficha__dato--destacado {
  grid-column: 1 / -1;
  background: var(--fz-color-hover);
  padding: 0.75rem 1rem;
  border-radius: var(--fz-radio-control);
  border: 1px solid var(--fz-color-borde);
}

.ficha__id-grande {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--fz-color-primario);
}

.ficha__dato dt {
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.ficha__dato dd {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.ficha__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
