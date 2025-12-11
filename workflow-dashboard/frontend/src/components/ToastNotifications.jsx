/**
 * トースト通知コンポーネント
 * 画面右下に通知を表示
 */
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X 
} from 'lucide-react'
import useNotificationStore from '../stores/notificationStore'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-500',
    title: 'text-emerald-800 dark:text-emerald-200',
    message: 'text-emerald-600 dark:text-emerald-300',
    progress: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800',
    icon: 'text-rose-500',
    title: 'text-rose-800 dark:text-rose-200',
    message: 'text-rose-600 dark:text-rose-300',
    progress: 'bg-rose-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
    title: 'text-amber-800 dark:text-amber-200',
    message: 'text-amber-600 dark:text-amber-300',
    progress: 'bg-amber-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    title: 'text-blue-800 dark:text-blue-200',
    message: 'text-blue-600 dark:text-blue-300',
    progress: 'bg-blue-500',
  },
}

function ToastItem({ notification }) {
  const { removeNotification } = useNotificationStore()
  const Icon = iconMap[notification.type] || Info
  const colors = colorMap[notification.type] || colorMap.info

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`
        relative overflow-hidden
        w-80 max-w-[calc(100vw-2rem)]
        rounded-lg border shadow-lg
        ${colors.bg} ${colors.border}
      `}
    >
      {/* プログレスバー */}
      {notification.duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: notification.duration / 1000, ease: 'linear' }}
          className={`absolute top-0 left-0 h-1 ${colors.progress}`}
        />
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* アイコン */}
          <div className={`shrink-0 ${colors.icon}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* コンテンツ */}
          <div className="flex-1 min-w-0">
            {notification.title && (
              <h4 className={`font-semibold text-sm ${colors.title}`}>
                {notification.title}
              </h4>
            )}
            {notification.message && (
              <p className={`text-sm mt-0.5 ${colors.message}`}>
                {notification.message}
              </p>
            )}
            
            {/* アクションボタン */}
            {notification.action && (
              <button
                onClick={() => {
                  notification.action.onClick?.()
                  removeNotification(notification.id)
                }}
                className={`mt-2 text-sm font-medium ${colors.icon} hover:underline`}
              >
                {notification.action.label}
              </button>
            )}
          </div>

          {/* 閉じるボタン */}
          <button
            onClick={() => removeNotification(notification.id)}
            className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function ToastNotifications() {
  const { notifications } = useNotificationStore()

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-3">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <ToastItem key={notification.id} notification={notification} />
        ))}
      </AnimatePresence>
    </div>
  )
}
