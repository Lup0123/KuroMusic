import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'

const VECTOR_DIMENSION = 64
const MAX_CHUNK_LENGTH = 420
const CHUNK_OVERLAP = 80

let db = null

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function getDatabasePath() {
  const basePath = typeof app?.getPath === 'function' ? app.getPath('userData') : process.cwd()
  const dbDir = join(basePath, 'rag')
  ensureDir(dbDir)
  return join(dbDir, 'rag.db')
}

function openDatabase() {
  if (db) return db

  db = new Database(getDatabasePath())
  sqliteVec.load(db)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    create virtual table if not exists rag_documents using vec0(
      source_type text,
      source_id text,
      title text,
      content_embedding float[${VECTOR_DIMENSION}],
      +content text,
      +metadata_json text
    );

    create table if not exists rag_sync_state (
      source_type text not null,
      source_id text not null,
      content_hash text not null,
      updated_at integer not null default (strftime('%s','now') * 1000),
      primary key (source_type, source_id)
    );
  `)

  return db
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\d{2}:\d{2}(?:\.\d{2,3})?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return []

  const tokens = normalized.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{2,}/gi) || []
  return tokens.map((item) => item.trim()).filter((item) => item.length >= 2)
}

function hashToken(token) {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function textToVector(text) {
  const vector = new Float32Array(VECTOR_DIMENSION)
  const tokens = tokenize(text)
  if (tokens.length === 0) {
    vector[0] = 1
    return vector
  }

  for (const token of tokens) {
    const index = hashToken(token) % VECTOR_DIMENSION
    vector[index] += 1
  }

  let magnitude = 0
  for (const value of vector) magnitude += value * value
  magnitude = Math.sqrt(magnitude) || 1

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= magnitude
  }

  return vector
}

function vectorToValue(vector) {
  return new Uint8Array(vector.buffer)
}

function hashContent(content) {
  const text = String(content || '')
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index)
  }
  return String(hash >>> 0)
}

function splitIntoChunks(text) {
  const source = normalizeText(text)
  if (!source) return []

  const segments = source.split(/[\n。！？!?；;]+/).map((item) => item.trim()).filter(Boolean)
  const chunks = []
  let buffer = ''

  for (const segment of segments.length > 0 ? segments : [source]) {
    const candidate = buffer ? `${buffer} ${segment}` : segment
    if (candidate.length <= MAX_CHUNK_LENGTH) {
      buffer = candidate
      continue
    }

    if (buffer) chunks.push(buffer)
    if (segment.length <= MAX_CHUNK_LENGTH) {
      buffer = segment
      continue
    }

    for (let start = 0; start < segment.length; start += MAX_CHUNK_LENGTH - CHUNK_OVERLAP) {
      chunks.push(segment.slice(start, start + MAX_CHUNK_LENGTH))
    }
    buffer = ''
  }

  if (buffer) chunks.push(buffer)
  return chunks.filter(Boolean)
}

function readSyncHash(sourceType, sourceId) {
  const database = openDatabase()
  const row = database.prepare(
    'select content_hash from rag_sync_state where source_type = ? and source_id = ?'
  ).get(sourceType, sourceId)
  return row?.content_hash || ''
}

function upsertSyncState(sourceType, sourceId, contentHash) {
  const database = openDatabase()
  database.prepare(
    `
      insert into rag_sync_state (source_type, source_id, content_hash, updated_at)
      values (?, ?, ?, strftime('%s','now') * 1000)
      on conflict(source_type, source_id) do update set
        content_hash = excluded.content_hash,
        updated_at = excluded.updated_at
    `
  ).run(sourceType, sourceId, contentHash)
}

function upsertChunks({ sourceType, sourceId, title, content, metadata = {} }) {
  const database = openDatabase()
  const normalizedContent = normalizeText(content)
  const contentHash = hashContent(`${sourceType}:${sourceId}:${normalizedContent}`)

  if (!normalizedContent) return { inserted: 0, skipped: true, contentHash }
  if (readSyncHash(sourceType, sourceId) === contentHash) {
    return { inserted: 0, skipped: true, contentHash }
  }

  const removeExisting = database.prepare(
    'delete from rag_documents where source_type = ? and source_id = ?'
  )
  const insertChunk = database.prepare(
    `
      insert into rag_documents (
        source_type,
        source_id,
        title,
        content_embedding,
        content,
        metadata_json
      ) values (?, ?, ?, ?, ?, ?)
    `
  )

  const chunks = splitIntoChunks(normalizedContent)
  let inserted = 0

  const transaction = database.transaction(() => {
    removeExisting.run(sourceType, sourceId)

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index].trim()
      if (!chunk) continue

      insertChunk.run(
        sourceType,
        sourceId,
        title || sourceId,
        vectorToValue(textToVector(`${title || ''} ${chunk}`)),
        chunk,
        JSON.stringify({ ...metadata, chunkIndex: index, sourceHash: contentHash })
      )
      inserted += 1
    }

    upsertSyncState(sourceType, sourceId, contentHash)
  })

  transaction()
  return { inserted, skipped: false, contentHash }
}

function buildPlaylistContent(playlist = {}) {
  const tracks = Array.isArray(playlist?.tracks)
    ? playlist.tracks
    : Array.isArray(playlist?.songs)
      ? playlist.songs
      : []

  const trackLines = tracks.slice(0, 60).map((song, index) => {
    const artist = String(
      song?.artist ||
        song?.artists?.map?.((item) => item?.name).filter(Boolean).join(' / ') ||
        ''
    ).trim()
    const name = String(song?.name || '').trim()
    return `${index + 1}. ${name}${artist ? ` - ${artist}` : ''}`
  }).filter((line) => line.trim())

  return normalizeText([playlist?.name || '', playlist?.description || '', trackLines.join('\n')].filter(Boolean).join('\n'))
}

function buildLyricsContent(payload = {}) {
  const lyricText = payload?.lrc?.lyric || payload?.body?.lrc?.lyric || payload?.lyric || ''
  const translText = payload?.tlyric?.lyric || payload?.body?.tlyric?.lyric || ''
  return normalizeText([lyricText, translText].filter(Boolean).join('\n'))
}

function buildPreferenceContent(payload = {}) {
  return normalizeText([
    payload?.title || '用户偏好',
    payload?.summary || payload?.content || '',
    Array.isArray(payload?.keywords) ? payload.keywords.join(' ') : ''
  ].filter(Boolean).join('\n'))
}

function parseJson(value) {
  try {
    return JSON.parse(String(value || '{}'))
  } catch {
    return {}
  }
}

export const ragService = {
  indexLyrics(songId, payload = {}, extra = {}) {
    return upsertChunks({
      sourceType: 'lyrics',
      sourceId: String(songId),
      title: extra?.title || payload?.name || `歌词 ${songId}`,
      content: buildLyricsContent(payload),
      metadata: {
        songId: String(songId),
        songName: extra?.title || payload?.name || '',
        artist:
          extra?.artist ||
          payload?.ar?.map?.((item) => item?.name).filter(Boolean).join(' / ') ||
          ''
      }
    })
  },

  indexPlaylist(playlistId, payload = {}) {
    return upsertChunks({
      sourceType: 'playlist',
      sourceId: String(playlistId),
      title: payload?.name || `歌单 ${playlistId}`,
      content: buildPlaylistContent(payload),
      metadata: {
        playlistId: String(playlistId),
        trackCount: Array.isArray(payload?.tracks)
          ? payload.tracks.length
          : Array.isArray(payload?.songs)
            ? payload.songs.length
            : 0
      }
    })
  },

  indexPreference(preferenceId, payload = {}) {
    return upsertChunks({
      sourceType: 'preference',
      sourceId: String(preferenceId),
      title: payload?.title || `偏好 ${preferenceId}`,
      content: buildPreferenceContent(payload),
      metadata: { preferenceId: String(preferenceId) }
    })
  },

  search(query, limit = 5, sourceTypes = []) {
    const database = openDatabase()
    const normalizedQuery = normalizeText(query)
    if (!normalizedQuery) return []

    const whereClause = Array.isArray(sourceTypes) && sourceTypes.length > 0
      ? `and source_type in (${sourceTypes.map(() => '?').join(',')})`
      : ''
    const params = [vectorToValue(textToVector(normalizedQuery))]
    if (Array.isArray(sourceTypes) && sourceTypes.length > 0) params.push(...sourceTypes)
    params.push(Number(limit) || 5)

    const rows = database.prepare(`
      select
        rowid,
        source_type,
        source_id,
        title,
        content,
        metadata_json,
        distance
      from rag_documents
      where content_embedding match ?
      ${whereClause}
      and k = ?
      order by distance asc
    `).all(...params)

    return rows.map((row) => ({
      id: row.rowid,
      sourceType: row.source_type,
      sourceId: row.source_id,
      title: row.title,
      content: row.content,
      metadata: parseJson(row.metadata_json),
      distance: row.distance
    }))
  },

  buildContext(query, options = {}) {
    const hits = this.search(query, options.limit || 5, options.sourceTypes || ['lyrics', 'playlist', 'preference'])
    if (hits.length === 0) return { hits: [], context: '' }

    const context = hits.map((item, index) => {
      const label = item.sourceType === 'lyrics' ? '歌词片段' : item.sourceType === 'playlist' ? '歌单片段' : '偏好片段'
      return `${index + 1}. ${label} | ${item.title}\n${item.content}`
    }).join('\n\n')

    return { hits, context }
  }
}
