import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

export const EMBEDDING_DIMENSION = 512
const MAX_CHARS_PER_TEXT = 400

let pipeline = null
let loadPromise = null
let prewarmStarted = false
const taskQueue = []
let processing = false

function getUserDataDir() {
  try {
    if (typeof app?.getPath === 'function') return app.getPath('userData')
  } catch {
    // ignore
  }
  return process.cwd()
}

function resolveModelPath() {
  const envDir = process.env.AI_EMBED_MODEL_DIR
  if (envDir && existsSync(envDir)) return envDir

  try {
    const isPackaged = Boolean(app?.isPackaged)
    const appPath =
      typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd()
    const base = isPackaged ? process.resourcesPath : join(appPath, 'resources')
    const local = join(base, 'models', 'bge-small-zh-v1.5')
    if (existsSync(local)) return local
  } catch {
    // ignore
  }

  return 'onnx-community/bge-small-zh-v1.5-ONNX'
}

async function loadModel() {
  if (pipeline) return pipeline
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const transformers = await import('@huggingface/transformers')
    try {
      transformers.env.cacheDir = join(getUserDataDir(), 'huggingface')
      transformers.env.allowRemoteModels = true
    } catch {
      // ignore env configuration errors
    }

    const modelPath = resolveModelPath()
    return transformers.pipeline('feature-extraction', modelPath, {
      device: 'cpu'
    })
  })()
    .then((loaded) => {
      pipeline = loaded
      return loaded
    })
    .catch((error) => {
      loadPromise = null
      console.error(
        '[AI][embedding] model load failed, fallback to hash vectors:',
        error?.message || error
      )
      return null
    })

  return loadPromise
}

function l2Normalize(vector) {
  let magnitude = 0
  for (const value of vector) magnitude += value * value
  magnitude = Math.sqrt(magnitude) || 1
  const normalized = new Float32Array(vector.length)
  for (let index = 0; index < vector.length; index += 1) {
    normalized[index] = vector[index] / magnitude
  }
  return normalized
}

function extractVectors(output, expectedCount) {
  const dims = Array.isArray(output?.dims) ? output.dims : []
  const rows = dims[0] || expectedCount
  const cols = dims[1] || EMBEDDING_DIMENSION
  const data = output?.data || []
  const vectors = []

  for (let row = 0; row < rows; row += 1) {
    const raw = data.slice(row * cols, (row + 1) * cols)
    if (raw.length === 0) continue
    vectors.push(l2Normalize(raw))
  }
  return vectors
}

async function drainQueue() {
  if (processing) return
  const task = taskQueue.shift()
  if (!task) return

  processing = true
  try {
    if (!pipeline) {
      task.resolve(null)
      return
    }
    const output = await pipeline(task.texts, {
      pooling: 'mean',
      normalize: true
    })
    task.resolve(extractVectors(output, task.texts.length))
  } catch (error) {
    console.error('[AI][embedding] inference failed:', error?.message || error)
    task.resolve(null)
  } finally {
    processing = false
    drainQueue()
  }
}

/**
 * Embed texts into normalized vectors.
 * Resolves to null when the model is unavailable (callers should fall back).
 */
export async function embed(texts) {
  const items = (Array.isArray(texts) ? texts : [texts])
    .map((item) => String(item ?? '').trim().slice(0, MAX_CHARS_PER_TEXT))
    .filter(Boolean)
  if (items.length === 0) return []

  const loaded = await loadModel()
  if (!loaded) return null

  return new Promise((resolve) => {
    taskQueue.push({ texts: items, resolve })
    drainQueue()
  })
}

/** Kick off model loading once. Returns a promise resolving to the pipeline or null. */
export function prewarm() {
  if (prewarmStarted || pipeline || loadPromise) return loadPromise || Promise.resolve(pipeline || null)
  prewarmStarted = true
  return loadModel()
}

export function getEmbeddingStatus() {
  return {
    loaded: Boolean(pipeline),
    loading: Boolean(loadPromise),
    dimension: EMBEDDING_DIMENSION,
    queueLength: taskQueue.length,
    modelPath: resolveModelPath()
  }
}

export { l2Normalize }
