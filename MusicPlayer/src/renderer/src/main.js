import './assets/main.css'
import { createPinia } from 'pinia'
import router from './router'
import { createApp } from 'vue'
import App from './App.vue'
import naive from 'naive-ui'
import { useSongStore } from './stores/songStore'

const pinia = createPinia()
const app = createApp(App)
const songStore = useSongStore(pinia)

songStore.restorePlaybackState()

app.use(naive)
app.use(pinia)
app.use(router)
app.mount('#app')
