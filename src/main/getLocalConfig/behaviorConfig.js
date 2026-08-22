import Store from 'electron-store'

const StoreConstructor = Store.default || Store

const store = new StoreConstructor({
  name: 'music-player-behavior-config',
  defaults: {
    enabled: true,
    promptShown: false
  }
})

const behaviorConfig = {
  getConfig() {
    return {
      enabled: Boolean(store.get('enabled', true)),
      promptShown: Boolean(store.get('promptShown', false))
    }
  },

  getEnabled() {
    return this.getConfig().enabled
  },

  setEnabled(enabled) {
    store.set('enabled', Boolean(enabled))
    return this.getConfig()
  },

  markPromptShown() {
    store.set('promptShown', true)
    return this.getConfig()
  }
}

export { behaviorConfig }
