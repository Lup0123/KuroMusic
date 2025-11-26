import { createMemoryHistory, createRouter } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import LayoutView from '@/components/layout/layout.vue'

const routes = [
  {
    path: '/',
    component: () => import('@/components/layout/layout.vue'),
    children: [
      {
        path: 'lyric',
        name: 'Lyric',
        // component: () => import('@/views/LyricplayerView.vue')
        component: () => import('@/views/PlayerView.vue')
      },
    ]
  }
]
const router = createRouter({
  history: createMemoryHistory(),
  routes
})

export default router
