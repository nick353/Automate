import { create } from 'zustand'
import { credentialsApi } from '../services/api'

const useCredentialStore = create((set, get) => ({
  // 状態
  credentials: [],
  credentialTypes: [],
  isLoading: false,
  error: null,
  
  // 認証情報一覧を取得
  fetchCredentials: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await credentialsApi.getAll()
      set({ credentials: response.data, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },
  
  // タイプ一覧を取得
  fetchCredentialTypes: async () => {
    try {
      const response = await credentialsApi.getTypes()
      set({ credentialTypes: response.data })
    } catch (error) {
      console.error('Failed to fetch credential types:', error)
    }
  },
  
  // タイプ別に取得
  fetchByType: async (type) => {
    try {
      const response = await credentialsApi.getByType(type)
      return response.data
    } catch (error) {
      console.error('Failed to fetch credentials by type:', error)
      return []
    }
  },
  
  // 認証情報を作成
  createCredential: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await credentialsApi.create(data)
      set((state) => ({
        credentials: [response.data, ...state.credentials],
        isLoading: false
      }))
      return response.data
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
  
  // 認証情報を更新
  updateCredential: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await credentialsApi.update(id, data)
      set((state) => ({
        credentials: state.credentials.map(c => c.id === id ? response.data : c),
        isLoading: false
      }))
      return response.data
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
  
  // 認証情報を削除
  deleteCredential: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await credentialsApi.delete(id)
      set((state) => ({
        credentials: state.credentials.filter(c => c.id !== id),
        isLoading: false
      }))
      return true
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return false
    }
  },
  
  // 認証情報をテスト
  testCredential: async (id) => {
    try {
      const response = await credentialsApi.test(id)
      return response.data
    } catch (error) {
      // エラーレスポンスからメッセージを取得
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.detail || 
                          error.message || 
                          'テスト実行中にエラーが発生しました'
      return { success: false, message: errorMessage }
    }
  },
  
  // エラーをクリア
  clearError: () => set({ error: null })
}))

export default useCredentialStore

