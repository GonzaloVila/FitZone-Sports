import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { API_URL } from './compartido/config'
import { crearAlmacenToken } from './compartido/http/almacenToken'
import { crearClienteApi } from './compartido/http/clienteApi'
import { ServiciosKey } from './compartido/servicios'
import { crearServicioSedes } from './features/sedes/services/servicioSedes'
import { crearServicioSesion } from './features/sesion/services/servicioSesion'
import { useSesionStore } from './features/sesion/stores/sesionStore'
import { crearServicioSocios } from './features/socios/services/servicioSocios'
import { crearServicioUsuarios } from './features/usuarios/services/servicioUsuarios'

// Raíz de composición: único lugar que conoce las implementaciones concretas.
const almacenToken = crearAlmacenToken()
const clienteApi = crearClienteApi({
  baseUrl: API_URL,
  almacenToken,
  alExpirarSesion: () => {
    // El store se resuelve acá y no al crear el cliente: todavía no existe Pinia en ese momento.
    useSesionStore().limpiar()
    const actual = router.currentRoute.value
    if (actual.name !== 'login') void router.push({ name: 'login', query: { redirect: actual.fullPath } })
  },
})
const servicios = {
  sesion: crearServicioSesion(clienteApi, almacenToken),
  socios: crearServicioSocios(clienteApi),
  sedes: crearServicioSedes(clienteApi),
  usuarios: crearServicioUsuarios(clienteApi),
}

const app = createApp(App)

app.use(createPinia())
// Los servicios se proveen antes del router: la navegación inicial ejecuta los guards, que usan el store.
app.provide(ServiciosKey, servicios)
app.use(router)

app.mount('#app')
