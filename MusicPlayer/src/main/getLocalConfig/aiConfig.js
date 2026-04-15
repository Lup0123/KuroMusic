import Store from 'electron-store'

const StoreConstructor = Store.default || Store

const store = new StoreConstructor({
  name: 'music-player-ai-config',
  defaults: {
    provider: {
      apiKey: '',
      model: 'qwen-plus',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    }
  }
})

const aiConfig = {
  getProviderConfig() {
    const provider = store.get('provider', {})
    return {
      apiKey: String(provider.apiKey || ''),
      model: String(provider.model || 'qwen-plus'),
      baseUrl: String(provider.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    }
  },

  setProviderConfig(payload = {}) {
    const current = this.getProviderConfig()
    const next = {
      ...current,
      ...payload
    }
    store.set('provider', {
      apiKey: String(next.apiKey || '').trim(),
      model: String(next.model || 'qwen-plus').trim() || 'qwen-plus',
      baseUrl:
        String(next.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1').trim() ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
    })
    return this.getProviderConfig()
  }
}

export { aiConfig }
