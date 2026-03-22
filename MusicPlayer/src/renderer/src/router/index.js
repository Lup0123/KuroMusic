import { createMemoryHistory, createRouter } from 'vue-router'
import { ROUTE_NAMES } from './routeNames'

const routes = [
  {
    path: '/',
    component: () => import('@/components/layout/layout.vue'),
    children: [
      {
        path: '',
        redirect: { name: ROUTE_NAMES.MAIN_PAGE }
      },
      {
        path: 'discover',
        name: ROUTE_NAMES.MAIN_PAGE,
        component: () => import('@/components/content/mainpage/mainpage.vue')
      },
      {
        path: 'my-music',
        name: ROUTE_NAMES.MY_MUSIC,
        component: () => import('@/components/content/my-music/my-music.vue')
      },
      {
        path: 'search',
        name: ROUTE_NAMES.SONG_SEARCH,
        component: () => import('@/components/content/songsearch/songsearch.vue')
      },
      {
        path: 'playlist/:id',
        name: ROUTE_NAMES.PLAYLIST_DETAIL,
        component: () => import('@/components/content/Myplaylist/playlistDetail.vue')
      }
    ]
  }
]
const router = createRouter({
  history: createMemoryHistory(),
  routes
})

export default router
