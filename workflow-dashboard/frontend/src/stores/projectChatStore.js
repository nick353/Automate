import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * プロジェクトチャット履歴を管理するストア
 * 
 * - プロジェクトごとにチャット履歴を保存
 * - ローカルストレージに永続化
 * - パネルを閉じても履歴が保持される
 */
const useProjectChatStore = create(
  persist(
    (set, get) => ({
      // プロジェクトIDをキーとしたチャット履歴のマップ
      // { [projectId]: { chatHistory: [], videoAnalysis: null, webResearchResults: null, createdTasks: [] } }
      projectChats: {},
      
      // チャット履歴を取得
      getChatHistory: (projectId) => {
        const chat = get().projectChats[projectId]
        return chat?.chatHistory || []
      },
      
      // チャット履歴を設定
      setChatHistory: (projectId, chatHistory) => {
        set((state) => ({
          projectChats: {
            ...state.projectChats,
            [projectId]: {
              ...state.projectChats[projectId],
              chatHistory
            }
          }
        }))
      },
      
      // メッセージを追加
      addMessage: (projectId, message) => {
        set((state) => {
          const currentChat = state.projectChats[projectId] || { chatHistory: [] }
          return {
            projectChats: {
              ...state.projectChats,
              [projectId]: {
                ...currentChat,
                chatHistory: [...currentChat.chatHistory, message]
              }
            }
          }
        })
      },
      
      // 動画分析結果を取得
      getVideoAnalysis: (projectId) => {
        return get().projectChats[projectId]?.videoAnalysis || null
      },
      
      // 動画分析結果を設定
      setVideoAnalysis: (projectId, videoAnalysis) => {
        set((state) => ({
          projectChats: {
            ...state.projectChats,
            [projectId]: {
              ...state.projectChats[projectId],
              videoAnalysis
            }
          }
        }))
      },
      
      // Webリサーチ結果を取得
      getWebResearchResults: (projectId) => {
        return get().projectChats[projectId]?.webResearchResults || null
      },
      
      // Webリサーチ結果を設定
      setWebResearchResults: (projectId, webResearchResults) => {
        set((state) => ({
          projectChats: {
            ...state.projectChats,
            [projectId]: {
              ...state.projectChats[projectId],
              webResearchResults
            }
          }
        }))
      },
      
      // 作成されたタスクを取得
      getCreatedTasks: (projectId) => {
        return get().projectChats[projectId]?.createdTasks || []
      },
      
      // 作成されたタスクを追加
      addCreatedTasks: (projectId, tasks) => {
        set((state) => {
          const currentChat = state.projectChats[projectId] || { createdTasks: [] }
          return {
            projectChats: {
              ...state.projectChats,
              [projectId]: {
                ...currentChat,
                createdTasks: [...(currentChat.createdTasks || []), ...tasks]
              }
            }
          }
        })
      },
      
      // プロジェクトのチャット履歴をクリア
      clearChatHistory: (projectId) => {
        set((state) => ({
          projectChats: {
            ...state.projectChats,
            [projectId]: {
              chatHistory: [],
              videoAnalysis: null,
              webResearchResults: null,
              createdTasks: []
            }
          }
        }))
      },
      
      // 全てのチャット履歴をクリア
      clearAllChats: () => {
        set({ projectChats: {} })
      }
    }),
    {
      name: 'project-chat-storage', // ローカルストレージのキー
      partialize: (state) => ({
        projectChats: state.projectChats
      })
    }
  )
)

export default useProjectChatStore



