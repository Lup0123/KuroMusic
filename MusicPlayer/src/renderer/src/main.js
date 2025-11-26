import './assets/main.css'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import router  from './router'
import { createApp } from 'vue'
import App from './App.vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'


const pinia = createPinia()
const app = createApp(App)

app.use(ArcoVue)
app.use(pinia)
app.use(router)
app.mount('#app')
