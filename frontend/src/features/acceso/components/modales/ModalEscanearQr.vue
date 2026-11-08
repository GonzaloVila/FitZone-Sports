<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { AvisoFz, BotonFz, ModalFz, SelectFz } from '@/ui'

const props = defineProps<{
  abierto: boolean
}>()

const emit = defineEmits<{
  (e: 'update:abierto', valor: boolean): void
  (e: 'escaneado', datos: { socioId: number; codigoTotp: string }): void
}>()

interface DispositivoCamara {
  id: string
  label: string
}

const contenedorId = 'lector-qr-acceso'
const camaras = ref<DispositivoCamara[]>([])
const camaraSeleccionada = ref<string>('')
const escaneando = ref(false)
const errorCamara = ref<string | null>(null)
let html5QrCode: Html5Qrcode | null = null

async function cargarCamaras() {
  try {
    const dispositivos = await Html5Qrcode.getCameras()
    if (dispositivos && dispositivos.length > 0) {
      camaras.value = dispositivos.map((d, index) => ({
        id: d.id,
        label: d.label || `Cámara ${index + 1}`,
      }))
      if (!camaraSeleccionada.value && camaras.value.length > 0) {
        // Preferir cámara trasera/ambiente si está disponible
        const trasera = camaras.value.find((c) => /back|rear|trasera|ambiente/i.test(c.label))
        const primera = camaras.value[0]
        camaraSeleccionada.value = trasera ? trasera.id : (primera ? primera.id : '')
      }
    } else {
      errorCamara.value = 'No se detectaron cámaras en este dispositivo.'
    }
  } catch (err) {
    errorCamara.value = 'No se pudo acceder a las cámaras. Verificá los permisos del navegador.'
  }
}

async function iniciarEscaneo() {
  errorCamara.value = null
  if (!camaraSeleccionada.value) {
    await cargarCamaras()
    if (!camaraSeleccionada.value) return
  }

  await nextTick()
  const el = document.getElementById(contenedorId)
  if (!el) return

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode(contenedorId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })
    }

    if (html5QrCode.isScanning) {
      await html5QrCode.stop()
    }

    escaneando.value = true
    await html5QrCode.start(
      camaraSeleccionada.value,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (textoDecodificado) => {
        procesarLectura(textoDecodificado)
      },
      () => {
        // Frame sin QR, ignorar
      },
    )
  } catch (err) {
    escaneando.value = false
    errorCamara.value = 'Error al iniciar la transmisión de video de la cámara.'
  }
}

async function detenerEscaneo() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop()
    } catch {
      // Ignorar si ya estaba detenida
    }
  }
  escaneando.value = false
}

function procesarLectura(texto: string) {
  try {
    // 1. Intentar parsear payload JSON: {"socioId": 1, "codigoTotp": "123456"}
    const payload = JSON.parse(texto)
    if (payload && payload.socioId && payload.codigoTotp) {
      const socioId = Number(payload.socioId)
      const codigoTotp = String(payload.codigoTotp).trim()
      if (!isNaN(socioId) && /^\d{6}$/.test(codigoTotp)) {
        completarYEnviar(socioId, codigoTotp)
        return
      }
    }
  } catch {
    // No es JSON, intentar formato plano "socioId:codigoTotp" o solo código
  }

  if (texto.includes(':')) {
    const partes = texto.split(':')
    const parteSocio = partes[0]
    const parteTotp = partes[1]
    if (parteSocio !== undefined && parteTotp !== undefined) {
      const socioId = Number(parteSocio.trim())
      const codigoTotp = parteTotp.trim()
      if (!isNaN(socioId) && /^\d{6}$/.test(codigoTotp)) {
        completarYEnviar(socioId, codigoTotp)
        return
      }
    }
  }

  errorCamara.value = 'El código QR escaneado no tiene un formato de acceso válido de FitZone Sports.'
}

async function completarYEnviar(socioId: number, codigoTotp: string) {
  await detenerEscaneo()
  emit('escaneado', { socioId, codigoTotp })
  emit('update:abierto', false)
}

async function cambiarCamara(nuevaCamaraId: string) {
  camaraSeleccionada.value = nuevaCamaraId
  if (props.abierto) {
    await detenerEscaneo()
    await iniciarEscaneo()
  }
}

watch(
  () => props.abierto,
  async (abierto) => {
    if (abierto) {
      errorCamara.value = null
      await cargarCamaras()
      await iniciarEscaneo()
    } else {
      await detenerEscaneo()
    }
  },
)

onBeforeUnmount(async () => {
  await detenerEscaneo()
  if (html5QrCode) {
    try {
      html5QrCode.clear()
    } catch {
      // ignore
    }
    html5QrCode = null
  }
})

function cerrarModal() {
  emit('update:abierto', false)
}
</script>

<template>
  <ModalFz
    :model-value="abierto"
    titulo="Escanear QR de acceso"
    descripcion="Apuntá la cámara al carnet digital del socio para registrar su ingreso inmediatamente."
    icono="acceso"
    tono="primario"
    @update:model-value="(val) => emit('update:abierto', val)"
  >
    <div class="escaner-qr">
      <AvisoFz v-if="errorCamara" variante="peligro">{{ errorCamara }}</AvisoFz>

      <div v-if="camaras.length > 1" class="escaner-qr__selector">
        <label for="select-camara" class="escaner-qr__etiqueta">Seleccionar cámara:</label>
        <SelectFz
          id="select-camara"
          name="camara"
          tamano="sm"
          :model-value="camaraSeleccionada"
          @update:model-value="(val) => cambiarCamara(String(val))"
        >
          <option v-for="c in camaras" :key="c.id" :value="c.id">{{ c.label }}</option>
        </SelectFz>
      </div>

      <div class="escaner-qr__visor-marco">
        <div :id="contenedorId" class="escaner-qr__visor"></div>
      </div>

      <p class="escaner-qr__ayuda">
        Al detectar un código QR válido, se validará el ingreso y aforo de forma automática.
      </p>
    </div>

    <template #acciones>
      <BotonFz variante="secundario" @click="cerrarModal">Cerrar</BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.escaner-qr {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.escaner-qr__selector {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.escaner-qr__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
}

.escaner-qr__visor-marco {
  width: 100%;
  min-height: 280px;
  background: #000;
  border-radius: var(--fz-radio-panel);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.escaner-qr__visor {
  width: 100%;
}

.escaner-qr__ayuda {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
  text-align: center;
}
</style>
