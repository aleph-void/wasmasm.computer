import { createApp } from 'vue'
import App from './App.vue'
// Bootstrap replaced by custom CSS that matches the alephvoid.com design system.

import MainView from './components/MainView.vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from './i18n'

const routes = [
    { name: "Main", path: '/', component: MainView }
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

const app = createApp(App)
app.use(router)
app.use(i18n)
app.mount('#app')
