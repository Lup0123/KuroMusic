import { ROUTE_NAMES } from './routeNames'

/**
 * memory history 下浏览器 history.state 为空，vue-router 自身也不暴露可返回标记，
 * 因此自行维护导航栈来判断"能否返回上一页"。
 */
let navStack = []

export function recordNavigation(to, from) {
  const isStart = !from || from.matched.length === 0
  if (isStart) return

  // 一级导航视为根：清空栈
  if (to.name === ROUTE_NAMES.MAIN_PAGE) {
    navStack = []
    return
  }

  // 目标是栈中已有路径 = 回退导航，截断到该位置
  const existing = navStack.findIndex((item) => item.fullPath === to.fullPath)
  if (existing !== -1) {
    navStack = navStack.slice(0, existing)
    return
  }

  navStack.push({ name: to.name, fullPath: to.fullPath })
  if (navStack.length > 50) navStack.shift()
}

export function canGoBack() {
  return navStack.length > 0
}

export function goBackOrHome(router) {
  if (canGoBack()) {
    router.back()
    return
  }
  router.push({ name: ROUTE_NAMES.MAIN_PAGE })
}
