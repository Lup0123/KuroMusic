import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { behaviorConfig } from '../getLocalConfig/behaviorConfig'
import { aggregateBehaviorEvents } from './behaviorAggregator'
import { ragService } from './ragService'

export const EVENT_WEIGHTS = {
  play: 1,
  finish: 3,
  like: 5,
  unlike: -5,
  skip: -2
}

const FLUSH_INTERVAL_MS = 30000
const FLUSH_BATCH_SIZE = 10
const PROFILE_REINDEX_INTERVAL_MS = 5 * 60 * 1000

let db = null
let eventBuffer = []
let flushTimer = null
let lastProfileIndexAt = 0
let profileIndexInFlight = false

function getUserDataDir() {
  try {
    if (typeof app?.getPath === 'function') return app.getPath('userData')
  } catch {
    // ignore
  }
  return process.cwd()
}

function getDbPath() {
  const base = getUserDataDir()
  const dir = join(base, 'ai')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'behavior.db')
}

function openDatabase() {
  if (db) return db

  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.exec(`
    create table if not exists behavior_events (
      id integer primary key autoincrement,
      event_type text not null,
      song_id text,
      song_name text,
      artist text,
      weight integer not null,
      created_at integer not null
    );

    create table if not exists behavior_profile (
      kind text not null,
      value text not null,
      score integer not null default 0,
      updated_at integer not null,
      primary key (kind, value)
    );
  `)
  return db
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_INTERVAL_MS)
}

export function recordEvent({ type, song = {} } = {}) {
  if (!behaviorConfig.getEnabled()) {
    return { success: false, reason: 'disabled' }
  }
  const weight = EVENT_WEIGHTS[type]
  if (weight === undefined) {
    return { success: false, reason: 'unknown_type' }
  }
  const songId = String(song?.id ?? '')
  if (!songId) {
    return { success: false, reason: 'missing_song_id' }
  }

  eventBuffer.push({
    event_type: type,
    song_id: songId,
    song_name: String(song?.name || ''),
    artist: String(song?.artist || ''),
    weight,
    created_at: Date.now()
  })

  if (eventBuffer.length >= FLUSH_BATCH_SIZE) {
    flush()
  } else {
    scheduleFlush()
  }
  return { success: true }
}

export function flush() {
  if (eventBuffer.length === 0) return { flushed: 0 }
  if (!behaviorConfig.getEnabled()) {
    eventBuffer = []
    return { flushed: 0, dropped: true }
  }

  const database = openDatabase()
  const events = eventBuffer
  eventBuffer = []

  const insertEvent = database.prepare(`
    insert into behavior_events (event_type, song_id, song_name, artist, weight, created_at)
    values (?, ?, ?, ?, ?, ?)
  `)
  const upsertProfile = database.prepare(`
    insert into behavior_profile (kind, value, score, updated_at)
    values (?, ?, ?, ?)
    on conflict(kind, value) do update set
      score = score + excluded.score,
      updated_at = excluded.updated_at
  `)

  const profile = aggregateBehaviorEvents(events)
  const now = Date.now()

  database.transaction(() => {
    for (const event of events) {
      insertEvent.run(
        event.event_type,
        event.song_id,
        event.song_name,
        event.artist,
        event.weight,
        event.created_at
      )
    }
    for (const artist of profile.artists) {
      upsertProfile.run('artist', artist.value, artist.score, now)
    }
    for (const tag of profile.tags) {
      upsertProfile.run('tag', tag.value, tag.score, now)
    }
  })()

  maybeReindexProfile()
  return { flushed: events.length }
}

export function getProfileSummary(limit = 8) {
  const database = openDatabase()
  const rows = database
    .prepare(`
      select kind, value, score
      from behavior_profile
      where score <> 0
      order by score desc, updated_at desc
      limit ?
    `)
    .all(Number(limit) || 8)

  return {
    artists: rows
      .filter((row) => row.kind === 'artist')
      .map((row) => ({ value: row.value, score: row.score })),
    tags: rows
      .filter((row) => row.kind === 'tag')
      .map((row) => ({ value: row.value, score: row.score }))
  }
}

function maybeReindexProfile() {
  const now = Date.now()
  if (now - lastProfileIndexAt < PROFILE_REINDEX_INTERVAL_MS) return
  if (profileIndexInFlight) return
  lastProfileIndexAt = now
  profileIndexInFlight = true
  try {
    indexProfileToRag()
  } finally {
    profileIndexInFlight = false
  }
}

export function indexProfileToRag() {
  const { artists, tags } = getProfileSummary(10)
  if (artists.length === 0 && tags.length === 0) {
    return { indexed: false }
  }

  const artistText = artists
    .map((item, index) => `${index + 1}. ${item.value}（偏好分 ${item.score}）`)
    .join('\n')
  const tagText = tags.map((item) => item.value).join('、')

  return ragService.indexPreference('behavior-profile', {
    title: '用户行为偏好画像',
    summary: `近期常听：\n${artistText}${tagText ? `\n风格倾向：${tagText}` : ''}`,
    keywords: [...artists.map((item) => item.value), ...tags.map((item) => item.value)]
  })
}

export function disableAndClear() {
  eventBuffer = []
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}
