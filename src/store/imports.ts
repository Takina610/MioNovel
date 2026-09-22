import { create } from 'zustand'
import {
  DuplicateBookError,
  importFile,
  newBookId,
  requestPersistentStorage,
} from '../db/books'

/**
 * 导入队列。
 *
 * 为什么不给每本书各开一个并发任务：一本 30MB 的 txt 加上一本带插图的 epub
 * 同时解析，内存和主线程都会难受。串行导入的代价只是慢一点，
 * 换来的是进度条是真的、界面不会卡。
 *
 * 进度存在这个 store 里（不落库）：卡片每 100ms 写一次 IndexedDB 不值得，
 * 导入结束后 books 表里的 state 字段才是真相。
 */
export interface ImportTask {
  /** 就是书的 id：书架卡片和进度条靠它对应上 */
  bookId: string
  fileName: string
  ratio: number
  note?: string
  /** 失败原因。失败的任务留在列表里让用户看见，而不是无声消失 */
  error?: string
  status: 'waiting' | 'running' | 'done' | 'failed'
}

interface ImportsState {
  tasks: ImportTask[]
  /** 一次性提示（重复导入被跳过之类）。不做成 toast 库，一个字符串够了 */
  notice: string | null
  addFiles: (files: File[]) => void
  dismiss: (bookId: string) => void
  clearFinished: () => void
  notify: (message: string) => void
  dismissNotice: () => void
}

export const useImports = create<ImportsState>()((set) => {
  // 串行队列。用一个模块级的 promise 串起来，避免多个任务同时跑
  let chain: Promise<void> = Promise.resolve()
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  const patchTask = (bookId: string, patch: Partial<ImportTask>) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.bookId === bookId ? { ...task, ...patch } : task)),
    }))
  }

  const showNotice = (message: string) => {
    set({ notice: message })
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => set({ notice: null }), 5000)
  }

  const runOne = async (bookId: string, file: File) => {
    patchTask(bookId, { status: 'running', ratio: 0 })
    try {
      await importFile(file, bookId, (progress) => {
        patchTask(bookId, { ratio: progress.ratio, note: progress.note })
      })
      patchTask(bookId, { status: 'done', ratio: 1, note: '完成' })
    } catch (error) {
      if (error instanceof DuplicateBookError) {
        // 重复导入不是错误，是重复。把这本从队列里去掉，只提示一句
        set((state) => ({ tasks: state.tasks.filter((task) => task.bookId !== bookId) }))
        showNotice(error.message)
        return
      }
      patchTask(bookId, {
        status: 'failed',
        error: error instanceof Error ? error.message : '导入失败',
      })
    }
  }

  return {
    tasks: [],
    notice: null,

    addFiles: (files) => {
      if (files.length === 0) return
      const created: ImportTask[] = files.map((file) => ({
        bookId: newBookId(),
        fileName: file.name,
        ratio: 0,
        status: 'waiting',
      }))
      set((state) => ({ tasks: [...state.tasks, ...created] }))

      // 第一次真正要用存储了，趁机申请持久化
      void requestPersistentStorage()

      files.forEach((file, index) => {
        const { bookId } = created[index]
        chain = chain.then(() => runOne(bookId, file)).catch(() => {})
      })
    },

    dismiss: (bookId) =>
      set((state) => ({ tasks: state.tasks.filter((task) => task.bookId !== bookId) })),

    clearFinished: () =>
      set((state) => ({
        tasks: state.tasks.filter((task) => task.status !== 'done'),
      })),

    notify: showNotice,
    dismissNotice: () => set({ notice: null }),
  }
})

/** 某本书正在导入的话返回它的任务，书架卡片用它显示进度 */
export function selectTask(bookId: string) {
  return (state: ImportsState): ImportTask | undefined =>
    state.tasks.find((task) => task.bookId === bookId)
}

export function activeTaskCount(): number {
  return useImports.getState().tasks.filter((task) => task.status !== 'done').length
}
