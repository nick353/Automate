/**
 * 通知ストア - グローバルなトースト通知を管理
 */
import { create } from 'zustand'

const useNotificationStore = create((set, get) => ({
  notifications: [],
  
  // 通知を追加
  addNotification: (notification) => {
    const id = Date.now() + Math.random()
    const newNotification = {
      id,
      type: notification.type || 'info', // 'success' | 'error' | 'warning' | 'info'
      title: notification.title || '',
      message: notification.message || '',
      duration: notification.duration || 5000, // 表示時間（ms）
      action: notification.action || null, // { label: string, onClick: () => void }
      createdAt: new Date(),
    }
    
    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }))
    
    // 自動削除
    if (newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id)
      }, newNotification.duration)
    }
    
    return id
  },
  
  // 通知を削除
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },
  
  // 全通知をクリア
  clearAll: () => {
    set({ notifications: [] })
  },
  
  // ショートカットメソッド
  success: (title, message, options = {}) => {
    return get().addNotification({ type: 'success', title, message, ...options })
  },
  
  error: (title, message, options = {}) => {
    return get().addNotification({ type: 'error', title, message, duration: 8000, ...options })
  },
  
  warning: (title, message, options = {}) => {
    return get().addNotification({ type: 'warning', title, message, ...options })
  },
  
  info: (title, message, options = {}) => {
    return get().addNotification({ type: 'info', title, message, ...options })
  },
}))

export default useNotificationStore

