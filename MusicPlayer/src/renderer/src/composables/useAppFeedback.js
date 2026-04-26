import { useMessage } from 'naive-ui'

function resolveErrorMessage(error, fallback = '操作失败，请稍后重试') {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object' && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  return fallback
}

export function useAppFeedback() {
  const message = useMessage()

  return {
    success(text) {
      message.success(String(text || '操作成功'))
    },
    warning(text) {
      message.warning(String(text || '请检查输入'))
    },
    info(text) {
      message.info(String(text || '提示'))
    },
    error(text) {
      message.error(String(text || '操作失败，请稍后重试'))
    },
    errorWith(error, fallback = '操作失败，请稍后重试') {
      message.error(resolveErrorMessage(error, fallback))
    },
    resolveErrorMessage
  }
}
