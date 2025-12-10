import { create } from 'zustand'
import { tasksApi, projectsApi } from '../services/api'

const useTaskStore = create((set, get) => ({
  // 状態
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
  executionQueue: [], // { execution_id, label }
  
  // ボード用データ
  boardData: null,
  projects: [],
  
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
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || error.message || '削除に失敗しました'
      set({ error: message, isLoading: false })
      return { success: false, error: message }
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
      // execution_idをキューに積んでチャットで拾えるようにする
      const execId = response.data?.execution_id || response.data?.status
      if (execId) {
        set((state) => ({
          executionQueue: [...state.executionQueue, { execution_id: execId, label: '手動実行' }]
        }))
      }
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // エラーをクリア
  clearError: () => set({ error: null }),

  // 実行キューをデキュー（チャット側が取得する）
  dequeueExecution: () => {
    const queue = get().executionQueue
    if (!queue || queue.length === 0) return null
    const [head, ...rest] = queue
    set({ executionQueue: rest })
    return head
  },
  
  // 現在のタスクをクリア
  clearCurrentTask: () => set({ currentTask: null }),
  
  // ==================== ボード機能 ====================
  
  // ボードデータを取得
  fetchBoardData: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectsApi.getBoardData()
      set({ boardData: response.data, isLoading: false })
      return response.data
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
  
  // プロジェクト一覧を取得
  fetchProjects: async () => {
    try {
      const response = await projectsApi.getAll()
      set({ projects: response.data })
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // プロジェクトを作成
  createProject: async (data) => {
    try {
      const response = await projectsApi.create(data)
      set((state) => ({
        projects: [response.data, ...state.projects]
      }))
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // プロジェクトを更新
  updateProject: async (id, data) => {
    try {
      const response = await projectsApi.update(id, data)
      set((state) => ({
        projects: state.projects.map(p => p.id === id ? response.data : p)
      }))
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // プロジェクトを削除
  deleteProject: async (id) => {
    try {
      await projectsApi.delete(id)
      set((state) => ({
        projects: state.projects.filter(p => p.id !== id)
      }))
      return true
    } catch (error) {
      set({ error: error.message })
      return false
    }
  },
  
  // タスクのバッチ更新（ドラッグ&ドロップ）
  batchUpdateTasks: async (tasks) => {
    try {
      await tasksApi.batchUpdate(tasks)
      return true
    } catch (error) {
      set({ error: error.message })
      return false
    }
  },
  
  // ==================== 役割グループ機能 ====================
  
  // 役割グループを作成
  createRoleGroup: async (projectId, data) => {
    try {
      const response = await projectsApi.createRoleGroup(projectId, data)
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // 役割グループを更新
  updateRoleGroup: async (groupId, data) => {
    try {
      const response = await projectsApi.updateRoleGroup(groupId, data)
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // 役割グループを削除
  deleteRoleGroup: async (groupId) => {
    try {
      await projectsApi.deleteRoleGroup(groupId)
      return true
    } catch (error) {
      set({ error: error.message })
      return false
    }
  },
  
  // ==================== トリガー機能 ====================
  
  // トリガー一覧を取得
  fetchTriggers: async (taskId) => {
    try {
      const response = await tasksApi.getTriggers(taskId)
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // トリガーを作成
  createTrigger: async (taskId, data) => {
    try {
      const response = await tasksApi.createTrigger(taskId, data)
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // トリガーを更新
  updateTrigger: async (triggerId, data) => {
    try {
      const response = await tasksApi.updateTrigger(triggerId, data)
      return response.data
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },
  
  // トリガーを削除
  deleteTrigger: async (triggerId) => {
    try {
      await tasksApi.deleteTrigger(triggerId)
      return true
    } catch (error) {
      set({ error: error.message })
      return false
    }
  }
}))

export default useTaskStore



