import { createApp } from 'vue'
import App from './App.vue'
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap"

import MainView from './components/MainView.vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const routes = [
    { name: "Main", path: '/', component: MainView }
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

const app = createApp(App);
app.use(router)
app.mount("#app") 
