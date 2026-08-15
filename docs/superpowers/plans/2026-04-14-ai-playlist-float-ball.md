# AI Playlist Float Ball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global draggable AI float ball that opens an AI modal, parses user prompts with a rule engine, recommends playlist drafts, and creates local playlists after user confirmation.

**Architecture:** Implement a renderer-side feature with three layers: UI components (float ball + modal), orchestration store, and provider abstraction (`providerAdapter`) backed by an initial `RuleProvider`. Keep all calling code dependent on the provider interface so migration to a main-process Agent service layer later only swaps provider implementation.

**Tech Stack:** Vue 3 (`<script setup>`), Pinia, existing Electron preload APIs (`window.api.search`, local playlist APIs), existing `playlistStore`.

---

## File Structure

- Create: `src/renderer/src/components/ai/AIFloatBall.vue`
  - Global draggable bubble; remembers dock side and y-position via `localStorage`.
- Create: `src/renderer/src/components/ai/AIPlaylistModal.vue`
  - Prompt input, loading/error states, recommendation list, draft preview, confirm-create flow.
- Create: `src/renderer/src/stores/aiPlaylistStore.js`
  - Feature state and orchestration actions; no direct heavy UI logic.
- Create: `src/renderer/src/services/ai/providerAdapter.js`
  - Single entry: `recommend(prompt, context)`; currently delegates to rule provider.
- Create: `src/renderer/src/services/ai/ruleProvider.js`
  - Prompt parsing, seed keyword generation, search fan-out, scoring, dedupe, draft generation.
- Modify: `src/renderer/src/components/layout/layout.vue`
  - Mount float ball + modal globally and wire modal visibility to store.

No main-process files are required in phase A; migration path is preserved by adapter boundary.

---

### Task 1: Build Provider Contract and Rule Engine (TDD-first)

**Files:**
- Create: `src/renderer/src/services/ai/providerAdapter.js`
- Create: `src/renderer/src/services/ai/ruleProvider.js`
- Test: `src/renderer/src/services/ai/__tests__/ruleProvider.test.js`

- [ ] **Step 1: Write failing tests for rule parsing and output shape**

```js
import { describe, expect, it } from 'vitest'
import { parsePromptToSignals, buildDraftFromSongs } from '../ruleProvider'

describe('ruleProvider', () => {
  it('extracts mood and scene signals from Chinese prompt', () => {
    const signals = parsePromptToSignals('通勤时候想听轻快一点的华语歌')
    expect(signals.moods).toContain('轻快')
    expect(signals.scenes).toContain('通勤')
    expect(signals.languages).toContain('华语')
  })

  it('builds deterministic draft with deduped songs', () => {
    const songs = [
      { id: 1, name: 'A', artist: 'X', album: 'AA', albumCover: '', duration: '03:10', durationMs: 190000 },
      { id: 1, name: 'A', artist: 'X', album: 'AA', albumCover: '', duration: '03:10', durationMs: 190000 },
      { id: 2, name: 'B', artist: 'Y', album: 'BB', albumCover: '', duration: '03:20', durationMs: 200000 }
    ]

    const draft = buildDraftFromSongs('通勤轻快', songs)
    expect(draft.name).toContain('通勤')
    expect(draft.songs).toHaveLength(2)
    expect(draft.songs.map((s) => s.id)).toEqual([1, 2])
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm vitest src/renderer/src/services/ai/__tests__/ruleProvider.test.js`
Expected: FAIL (functions not found yet).

- [ ] **Step 3: Implement minimal rule provider core**

```js
// ruleProvider.js (core signatures)
export function parsePromptToSignals(prompt) {
  const text = (prompt || '').trim()
  const moods = []
  const scenes = []
  const languages = []

  if (/轻快|活力|元气/.test(text)) moods.push('轻快')
  if (/通勤|上班|地铁/.test(text)) scenes.push('通勤')
  if (/华语|中文|国语/.test(text)) languages.push('华语')

  return { prompt: text, moods, scenes, languages }
}

export function buildDraftFromSongs(prompt, songs) {
  const map = new Map()
  for (const s of songs || []) {
    if (!s?.id || map.has(s.id)) continue
    map.set(s.id, s)
  }
  return {
    name: `${prompt.slice(0, 10) || 'AI推荐'}歌单`,
    reason: '根据你的提示词生成',
    songs: Array.from(map.values())
  }
}

export async function recommendByRule(prompt, context) {
  // implemented in next step with search fan-out
  return { recommendations: [], draft: buildDraftFromSongs(prompt, []), debug: { provider: 'rule' } }
}
```

- [ ] **Step 4: Add provider adapter contract**

```js
// providerAdapter.js
import { recommendByRule } from './ruleProvider'

export async function recommend(prompt, context = {}) {
  return recommendByRule(prompt, context)
}
```

- [ ] **Step 5: Expand rule provider with search fan-out**

```js
// in recommendByRule
const seedKeywords = [prompt, ...signals.moods, ...signals.scenes, ...signals.languages]
const uniqueKeywords = Array.from(new Set(seedKeywords.filter(Boolean))).slice(0, 4)
const allSongs = []

for (const keyword of uniqueKeywords) {
  const res = await window.api.search(keyword, 1, 30, 0)
  const songs = res?.body?.result?.songs || []
  for (const item of songs) {
    allSongs.push({
      id: item.id,
      name: item.name,
      artist: item.ar?.map((a) => a.name).join(' / ') || '未知歌手',
      album: item.al?.name || '未知专辑',
      albumCover: item.al?.picUrl || '',
      durationMs: item.dt,
      duration: formatDuration(item.dt)
    })
  }
}

const scored = scoreAndSortSongs(allSongs, signals)
const draft = buildDraftFromSongs(prompt, scored.slice(0, 30))
return {
  recommendations: [{ id: 'primary', title: draft.name, reason: draft.reason, songs: draft.songs.slice(0, 20) }],
  draft,
  debug: { provider: 'rule', keywords: uniqueKeywords }
}
```

- [ ] **Step 6: Run tests to verify GREEN**

Run: `pnpm vitest src/renderer/src/services/ai/__tests__/ruleProvider.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/services/ai/providerAdapter.js src/renderer/src/services/ai/ruleProvider.js src/renderer/src/services/ai/__tests__/ruleProvider.test.js
git commit -m "feat(ai): add rule provider and provider adapter"
```

---

### Task 2: Add AI Playlist Store Orchestration (TDD-first)

**Files:**
- Create: `src/renderer/src/stores/aiPlaylistStore.js`
- Test: `src/renderer/src/stores/__tests__/aiPlaylistStore.test.js`

- [ ] **Step 1: Write failing store tests for core flow**

```js
import { describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiPlaylistStore } from '../aiPlaylistStore'

vi.mock('@/services/ai/providerAdapter', () => ({
  recommend: vi.fn(async () => ({
    recommendations: [{ id: 'primary', title: '通勤轻快歌单', songs: [{ id: 1, name: 'A' }] }],
    draft: { name: '通勤轻快歌单', songs: [{ id: 1, name: 'A' }] }
  }))
}))

describe('aiPlaylistStore', () => {
  it('generates recommendations and draft', async () => {
    setActivePinia(createPinia())
    const store = useAiPlaylistStore()

    await store.generateFromPrompt('通勤轻快')

    expect(store.loading).toBe(false)
    expect(store.recommendations.length).toBeGreaterThan(0)
    expect(store.draftPlaylist?.songs?.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm vitest src/renderer/src/stores/__tests__/aiPlaylistStore.test.js`
Expected: FAIL (store missing).

- [ ] **Step 3: Implement store with state and actions**

```js
import { defineStore } from 'pinia'
import { recommend } from '@/services/ai/providerAdapter'
import { usePlaylistStore } from '@/stores/playlistStore'

export const useAiPlaylistStore = defineStore('aiPlaylist', {
  state: () => ({
    visible: false,
    prompt: '',
    loading: false,
    error: '',
    recommendations: [],
    draftPlaylist: null,
    creating: false,
    floatBall: { x: null, y: 120, dock: 'right' }
  }),
  actions: {
    openModal() { this.visible = true },
    closeModal() { this.visible = false },
    setPrompt(value) { this.prompt = value || '' },
    setFloatBallPosition(payload) { this.floatBall = { ...this.floatBall, ...payload } },

    async generateFromPrompt(prompt) {
      this.loading = true
      this.error = ''
      const text = (prompt ?? this.prompt).trim()
      this.prompt = text
      try {
        const result = await recommend(text, { maxSongs: 30 })
        this.recommendations = result.recommendations || []
        this.draftPlaylist = result.draft || null
      } catch (err) {
        this.error = err?.message || 'AI 推荐失败'
        this.recommendations = []
        this.draftPlaylist = null
      } finally {
        this.loading = false
      }
    },

    async createDraftToLocalPlaylist() {
      if (!this.draftPlaylist?.songs?.length) return { success: false, reason: 'empty' }
      this.creating = true
      try {
        const playlistStore = usePlaylistStore()
        const created = await playlistStore.createLocalPlaylist({
          name: this.draftPlaylist.name,
          description: this.draftPlaylist.reason || 'AI 创建歌单',
          songs: []
        })
        if (!created?.id) return { success: false, reason: 'create_failed' }

        for (const song of this.draftPlaylist.songs) {
          await playlistStore.addSongToLocalPlaylist(created.id, song)
        }

        return { success: true, playlistId: created.id }
      } finally {
        this.creating = false
      }
    }
  }
})
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `pnpm vitest src/renderer/src/stores/__tests__/aiPlaylistStore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/aiPlaylistStore.js src/renderer/src/stores/__tests__/aiPlaylistStore.test.js
git commit -m "feat(ai): add ai playlist orchestration store"
```

---

### Task 3: Implement Global Draggable Float Ball

**Files:**
- Create: `src/renderer/src/components/ai/AIFloatBall.vue`
- Modify: `src/renderer/src/components/layout/layout.vue`
- Test: Manual verification

- [ ] **Step 1: Create float ball component with drag/dock behavior**

```vue
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'

const aiStore = useAiPlaylistStore()
const ballRef = ref(null)
const dragging = ref(false)
const start = ref({ x: 0, y: 0, left: 0, top: 0 })

const styleObject = computed(() => {
  const dock = aiStore.floatBall.dock
  const top = aiStore.floatBall.y ?? 120
  return dock === 'left' ? { left: '12px', top: `${top}px` } : { right: '12px', top: `${top}px` }
})

const onPointerDown = (e) => {
  dragging.value = true
  start.value = { x: e.clientX, y: e.clientY, left: e.clientX, top: e.clientY }
}

const onPointerMove = (e) => {
  if (!dragging.value) return
  const top = Math.max(80, Math.min(window.innerHeight - 140, e.clientY - 24))
  const dock = e.clientX < window.innerWidth / 2 ? 'left' : 'right'
  aiStore.setFloatBallPosition({ y: top, dock })
}

const onPointerUp = () => {
  dragging.value = false
  localStorage.setItem('aiFloatBallPosition', JSON.stringify(aiStore.floatBall))
}

onMounted(() => {
  const saved = localStorage.getItem('aiFloatBallPosition')
  if (saved) {
    try {
      aiStore.setFloatBallPosition(JSON.parse(saved))
    } catch {}
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
</script>
```

- [ ] **Step 2: Add float ball visual and click-open behavior**

```vue
<template>
  <button
    ref="ballRef"
    class="ai-float-ball"
    :style="styleObject"
    @pointerdown="onPointerDown"
    @click="aiStore.openModal"
  >AI</button>
</template>
```

- [ ] **Step 3: Mount float ball globally in layout**

```vue
<!-- layout.vue template -->
<AIFloatBall />
```

```js
// layout.vue script setup
import AIFloatBall from '@/components/ai/AIFloatBall.vue'
```

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`
Expected:
- Ball appears across pages.
- Dragging changes side and vertical position.
- Reload keeps position.
- Click opens modal visibility state (will be wired fully in next task).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ai/AIFloatBall.vue src/renderer/src/components/layout/layout.vue
git commit -m "feat(ai): add global draggable ai float ball"
```

---

### Task 4: Build AI Modal UI and Wire Store Actions

**Files:**
- Create: `src/renderer/src/components/ai/AIPlaylistModal.vue`
- Modify: `src/renderer/src/components/layout/layout.vue`
- Test: Manual verification

- [ ] **Step 1: Build modal shell bound to store visibility**

```vue
<template>
  <n-modal v-model:show="aiStore.visible" preset="card" title="AI 歌单助手" style="width: 760px">
    <div class="ai-modal-body">
      <n-input
        v-model:value="promptInput"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        placeholder="例如：给我一份通勤时听的轻快华语歌单"
      />
      <div class="actions">
        <n-button type="primary" :loading="aiStore.loading" @click="handleGenerate">生成推荐</n-button>
      </div>
    </div>
  </n-modal>
</template>
```

- [ ] **Step 2: Add recommendations list + draft preview section**

```vue
<div v-if="aiStore.recommendations.length" class="recommendations">
  <div v-for="item in aiStore.recommendations" :key="item.id" class="recommend-card">
    <h4>{{ item.title }}</h4>
    <p>{{ item.reason }}</p>
    <small>{{ item.songs.length }} 首</small>
  </div>
</div>

<div v-if="aiStore.draftPlaylist" class="draft-panel">
  <n-input v-model:value="aiStore.draftPlaylist.name" placeholder="歌单名称" />
  <n-scrollbar style="max-height: 280px">
    <div v-for="song in aiStore.draftPlaylist.songs" :key="song.id" class="draft-song-row">
      <span>{{ song.name }}</span>
      <span>{{ song.artist }}</span>
    </div>
  </n-scrollbar>
  <n-button type="primary" :loading="aiStore.creating" @click="handleCreate">确认创建到本地</n-button>
</div>
```

- [ ] **Step 3: Wire handlers**

```js
const promptInput = ref(aiStore.prompt)

const handleGenerate = async () => {
  await aiStore.generateFromPrompt(promptInput.value)
}

const handleCreate = async () => {
  const result = await aiStore.createDraftToLocalPlaylist()
  if (result.success) message.success('已创建本地歌单')
  else message.warning('创建失败，请重试')
}
```

- [ ] **Step 4: Mount modal globally in layout**

```vue
<!-- layout.vue template -->
<AIPlaylistModal />
```

```js
// layout.vue script setup
import AIPlaylistModal from '@/components/ai/AIPlaylistModal.vue'
```

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`
Expected:
- Float ball opens modal.
- Prompt can generate recommendations.
- Draft shows songs and editable title.
- Confirm creates local playlist and appears in local playlist list.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ai/AIPlaylistModal.vue src/renderer/src/components/layout/layout.vue
git commit -m "feat(ai): add ai modal for recommendation and local playlist creation"
```

---

### Task 5: Add Safety Rules and Migration Guardrails

**Files:**
- Modify: `src/renderer/src/services/ai/providerAdapter.js`
- Modify: `src/renderer/src/services/ai/ruleProvider.js`
- Modify: `src/renderer/src/stores/aiPlaylistStore.js`
- Test: `src/renderer/src/services/ai/__tests__/ruleProvider.test.js`

- [ ] **Step 1: Add provider result schema checks in adapter**

```js
function assertProviderResult(result) {
  if (!result || typeof result !== 'object') throw new Error('Invalid provider result')
  if (!Array.isArray(result.recommendations)) throw new Error('Invalid recommendations')
  if (!result.draft || !Array.isArray(result.draft.songs)) throw new Error('Invalid draft')
}

export async function recommend(prompt, context = {}) {
  const result = await recommendByRule(prompt, context)
  assertProviderResult(result)
  return result
}
```

- [ ] **Step 2: Add rule-provider bounds and fallback behavior**

```js
const MAX_SONGS = 30
const SAFE_MIN = 8

if (draft.songs.length < SAFE_MIN) {
  // broaden query once
}

draft.songs = draft.songs.slice(0, MAX_SONGS)
```

- [ ] **Step 3: Add store-level empty-result guard**

```js
if (!this.recommendations.length || !this.draftPlaylist?.songs?.length) {
  this.error = '未生成有效推荐，请尝试更具体的描述'
}
```

- [ ] **Step 4: Re-run targeted tests**

Run: `pnpm vitest src/renderer/src/services/ai/__tests__/ruleProvider.test.js src/renderer/src/stores/__tests__/aiPlaylistStore.test.js`
Expected: PASS.

- [ ] **Step 5: Final verification in app**

Run: `pnpm dev`
Expected:
- Random/空泛 prompt 不崩溃。
- 提示可引导重试。
- 确认创建仍成功。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/services/ai/providerAdapter.js src/renderer/src/services/ai/ruleProvider.js src/renderer/src/stores/aiPlaylistStore.js src/renderer/src/services/ai/__tests__/ruleProvider.test.js
git commit -m "chore(ai): harden rule provider and adapter contract"
```

---

## Test and Verification Checklist

- Unit:
  - `pnpm vitest src/renderer/src/services/ai/__tests__/ruleProvider.test.js`
  - `pnpm vitest src/renderer/src/stores/__tests__/aiPlaylistStore.test.js`
- Manual:
  - Drag float ball, reload app, position persists.
  - Prompt -> recommendations visible.
  - Draft editing works.
  - Confirm creates playlist and songs in local playlist storage.
- Regression:
  - Existing search, playlist detail, and player footer flows remain unaffected.

---

## Migration Notes (A -> Agent Service Layer)

When migrating later, only replace provider implementation under adapter:

- Keep `aiPlaylistStore` API stable (`generateFromPrompt`, `createDraftToLocalPlaylist`).
- Keep UI components unchanged.
- Add `agentProvider.js` implementing same output shape.
- Update `providerAdapter.js` selection logic (feature flag based):

```js
import { recommendByRule } from './ruleProvider'
import { recommendByAgent } from './agentProvider'

export async function recommend(prompt, context = {}) {
  const useAgent = context.useAgent === true
  const result = useAgent ? await recommendByAgent(prompt, context) : await recommendByRule(prompt, context)
  assertProviderResult(result)
  return result
}
```

This preserves backward compatibility and avoids touching UI/store during migration.
