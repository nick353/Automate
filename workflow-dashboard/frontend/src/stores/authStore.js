import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../services/supabase'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // 状態
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
      authEnabled: false,
      
      // 初期化
      initialize: async () => {
        set({ isLoading: true })
        
        try {
          // バックエンドの認証状態を確認
          const response = await api.get('/auth/status')
          const authEnabled = response.data.auth_enabled
          const devMode = response.data.dev_mode
          
          set({ authEnabled })
          
          if (!authEnabled || devMode) {
            // 認証が無効または開発モードの場合
            console.log('開発モード: 認証をスキップ')
            set({ 
              isAuthenticated: true, 
              user: { id: 'local-dev', email: 'dev@localhost' },
              isLoading: false 
            })
            return
          }
          
          // Supabaseセッションを確認
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session) {
              set({
                user: session.user,
                session,
                isAuthenticated: true,
                isLoading: false
              })
              
              // APIリクエストにトークンを設定
              api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`
            } else {
              set({ isAuthenticated: false, isLoading: false })
            }
            
            // 認証状態の変更を監視
            supabase.auth.onAuthStateChange((event, session) => {
              if (session) {
                set({
                  user: session.user,
                  session,
                  isAuthenticated: true
                })
                api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`
              } else {
                set({
                  user: null,
                  session: null,
                  isAuthenticated: false
                })
                delete api.defaults.headers.common['Authorization']
              }
            })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          console.error('Auth initialization error:', error)
          // エラー時は開発モードとして続行
          set({ 
            authEnabled: false,
            isAuthenticated: true, 
            user: { id: 'local-dev', email: 'dev@localhost' },
            isLoading: false 
          })
        }
      },
      
      // サインアップ
      signUp: async (email, password) => {
        set({ isLoading: true })
        
        try {
          if (supabase) {
            const { data, error } = await supabase.auth.signUp({
              email,
              password
            })
            
            if (error) throw error
            
            set({ isLoading: false })
            return { success: true, message: '確認メールを送信しました' }
          } else {
            // バックエンドAPI経由
            const response = await api.post('/auth/signup', { email, password })
            set({ isLoading: false })
            return response.data
          }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, message: error.message }
        }
      },
      
      // サインイン
      signIn: async (email, password) => {
        set({ isLoading: true })
        
        try {
          if (supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            })
            
            if (error) throw error
            
            set({
              user: data.user,
              session: data.session,
              isAuthenticated: true,
              isLoading: false
            })
            
            api.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`
            
            return { success: true }
          } else {
            // バックエンドAPI経由（開発モード）
            const response = await api.post('/auth/signin', { email, password })
            
            if (response.data.success) {
              set({
                user: response.data.user,
                session: response.data.session,
                isAuthenticated: true,
                isLoading: false
              })
              
              if (response.data.session?.access_token) {
                api.defaults.headers.common['Authorization'] = `Bearer ${response.data.session.access_token}`
              }
            }
            
            return response.data
          }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, message: error.message }
        }
      },
      
      // サインアウト
      signOut: async () => {
        set({ isLoading: true })
        
        try {
          if (supabase) {
            await supabase.auth.signOut()
          }
          
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false
          })
          
          delete api.defaults.headers.common['Authorization']
          
          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, message: error.message }
        }
      },
      
      // パスワードリセット
      resetPassword: async (email) => {
        if (!supabase) {
          return { success: false, message: '認証システムが設定されていません' }
        }
        
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email)
          if (error) throw error
          return { success: true, message: 'パスワードリセットメールを送信しました' }
        } catch (error) {
          return { success: false, message: error.message }
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export default useAuthStore

