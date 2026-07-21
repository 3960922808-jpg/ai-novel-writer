import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, Chapter, Location, LoreEntry } from '@/types'
import * as db from '@/services/db'

export const useProjectStore = defineStore('project', () => {
  const current = ref<Project | null>(null)
  const chapters = ref<Chapter[]>([])
  const locations = ref<Location[]>([])
  const lore = ref<LoreEntry[]>([])

  const totalWords = computed(() =>
    chapters.value.reduce((s, c) => s + (c.wordCount || 0), 0)
  )

  const chapterCount = computed(() => chapters.value.length)

  async function loadProject(id: string) {
    current.value = await db.getProject(id)
    if (!current.value) return false
    await reloadAll()
    return true
  }

  async function reloadAll() {
    if (!current.value) return
    const pid = current.value.id
    const [chs, locs, loreList] = await Promise.all([
      db.Chapters.list(pid),
      db.Locations.list(pid),
      db.Lore.list(pid)
    ])
    chapters.value = chs.sort((a, b) => a.order - b.order)
    locations.value = locs
    lore.value = loreList
  }

  async function reloadChapters() {
    if (!current.value) return
    chapters.value = (await db.Chapters.list(current.value.id)).sort((a, b) => a.order - b.order)
  }

  async function saveProject(patch: Partial<Project>) {
    if (!current.value) return
    const updated = await db.saveProject({ ...current.value, ...patch })
    current.value = updated
    return updated
  }

  function clear() {
    current.value = null
    chapters.value = []
    locations.value = []
    lore.value = []
  }

  return {
    current, chapters, locations, lore,
    totalWords, chapterCount,
    loadProject, reloadAll, reloadChapters, saveProject, clear
  }
})
