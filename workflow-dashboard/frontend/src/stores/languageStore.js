import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from '../utils/translations'

const useLanguageStore = create(
  persist(
    (set, get) => ({
      // 'en' | 'ja' | 'zh'
      language: 'ja', // デフォルトを日本語に設定
      
      setLanguage: (language) => {
        set({ language })
      },
      
      // テキストを取得するヘルパー関数
      t: (key) => {
        const { language } = get()
        const keys = key.split('.')
        let value = translations[language]
        
        for (const k of keys) {
          if (value && value[k]) {
            value = value[k]
          } else {
            // フォールバック: 英語
            let fallbackValue = translations['en']
            for (const fk of keys) {
              if (fallbackValue && fallbackValue[fk]) {
                fallbackValue = fallbackValue[fk]
              } else {
                return key // 見つからない場合はキーを返す
              }
            }
            return fallbackValue
          }
        }
        
        return value
      }
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({ language: state.language })
    }
  )
)

export default useLanguageStore

