import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(
  persist(
    (set, get) => ({
      // 'light' | 'dark' | 'system'
      // デフォルトを 'light' に変更
      theme: 'light',
      
      // 実際に適用されているテーマ
      resolvedTheme: 'light',
      
      // テーマを設定
      setTheme: (theme) => {
        set({ theme })
        get().applyTheme(theme)
      },
      
      // テーマを切り替え
      toggleTheme: () => {
        const { theme } = get()
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        get().setTheme(newTheme)
      },
      
      // テーマを適用
      applyTheme: (theme) => {
        let resolvedTheme = theme
        
        if (theme === 'system') {
          resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
            ? 'dark' 
            : 'light'
        }
        
        // HTMLにクラスを適用
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(resolvedTheme)
        
        set({ resolvedTheme })
      },
      
      // 初期化（アプリ起動時に呼び出す）
      initialize: () => {
        const { theme, applyTheme } = get()
        applyTheme(theme)
        
        // システムテーマの変更を監視
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addEventListener('change', (e) => {
          if (get().theme === 'system') {
            applyTheme('system')
          }
        })
      }
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme })
    }
  )
)

export default useThemeStore
