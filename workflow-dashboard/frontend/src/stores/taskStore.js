import { create } from 'zustand'
import { tasksApi } from '../services/api'

const useTaskStore = create((set, get) => ({
  // 状態
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
  
  // タスク一覧を取得
  fetchTasks: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const response = await tasksApi.getAll(params)
      set({ tasks: response.data, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },
  
  // タスク詳細を取得
  fetchTask: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const response = await tasksApi.get(id)
      set({ currentTask: response.data, isLoading: false })
      return response.data
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
  
  // タスクを作成
  createTask: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await tasksApi.create(data)
      set((state) => ({
        tasks: [response.data, ...state.tasks],
        isLoading: false
      }))
      return response.data
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
  
  // タスクを更新
  updateTask: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await tasksApi.update(id, data)
      set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? response.data : t),
        currentTask: state.currentTask?.id === id ? response.data : state.currentTask,
        isLoading: false
      }))
      return response.data
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
  
  // タスクを削除
  deleteTask: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await tasksApi.delete(id)
      set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id),
        isLoading: false
      }))
      return true
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return false
    }
  },
  
  // タスクを有効/無効切り替え
  toggleTask: async (id) => {
    try {
      const response = await tasksApi.toggle(id)
      set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? response.data : t)
      }))
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // タスクを実行
  runTask: async (id) => {
    try {
      const response = await tasksApi.run(id)
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // エラーをクリア
  clearError: () => set({ error: null }),
  
  // 現在のタスクをクリア
  clearCurrentTask: () => set({ currentTask: null })
}))

export default useTaskStore



