import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * タスクチャット履歴を管理するストア
 * 
 * - タスクごとにチャット履歴を保存
 * - ローカルストレージに永続化
 * - パネルを閉じても履歴が保持される
 */
const useTaskChatStore = create(
  persist(
    (set, get) => ({
      // タスクIDをキーとしたチャット履歴のマップ
      // { [taskId]: { chatHistory: [] } }
      taskChats: {},
      
      // チャット履歴を取得
      getChatHistory: (taskId) => {
        const chat = get().taskChats[taskId]
        return chat?.chatHistory || []
      },
      
      // チャット履歴を設定
      setChatHistory: (taskId, chatHistory) => {
        set((state) => ({
          taskChats: {
            ...state.taskChats,
            [taskId]: {
              ...state.taskChats[taskId],
              chatHistory
            }
          }
        }))
      },
      
      // メッセージを追加
      addMessage: (taskId, message) => {
        set((state) => {
          const currentChat = state.taskChats[taskId] || { chatHistory: [] }
          return {
            taskChats: {
              ...state.taskChats,
              [taskId]: {
                ...currentChat,
                chatHistory: [...currentChat.chatHistory, message]
              }
            }
          }
        })
      },
      
      // タスクのチャット履歴をクリア
      clearChatHistory: (taskId) => {
        set((state) => ({
          taskChats: {
            ...state.taskChats,
            [taskId]: {
              chatHistory: []
            }
          }
        }))
      },
      
      // 全てのチャット履歴をクリア
      clearAllChats: () => {
        set({ taskChats: {} })
      }
    }),
    {
      name: 'task-chat-storage', // ローカルストレージのキー
      partialize: (state) => ({
        taskChats: state.taskChats
      })
    }
  )
)

export default useTaskChatStore


