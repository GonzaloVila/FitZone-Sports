import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { API_URL } from './compartido/config'
import { crearAlmacenToken } from './compartido/http/almacenToken'
import { crearClienteApi } from './compartido/http/clienteApi'
import { ServiciosKey } from './compartido/servicios'
import { crearServicioSesion } from './features/sesion/services/servicioSesion'

// Raíz de composición: único lugar que conoce las implementaciones concretas.
const almacenToken = crearAlmacenToken()
const clienteApi = crearClienteApi({
  baseUrl: API_URL,
  almacenToken,
  alExpirarSesion: () => {
    if (router.currentRoute.value.name !== 'login') void router.push({ name: 'login' })
  },
})
const sesion = crearServicioSesion(clienteApi, almacenToken)

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.provide(ServiciosKey, { sesion })

app.mount('#app')
