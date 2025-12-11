/**
 * エラー表示コンポーネント
 * 詳細なエラー情報を見やすく表示
 */
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  AlertCircle,
  Search,
  History,
  Key,
  Clock,
  Globe,
  Brain,
  Shield,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw
} from 'lucide-react'
import { useState } from 'react'
import useNotificationStore from '../stores/notificationStore'

const iconMap = {
  'search': Search,
  'history': History,
  'key': Key,
  'clock': Clock,
  'globe': Globe,
  'brain': Brain,
  'shield': Shield,
  'wifi-off': WifiOff,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
}

const codeColors = {
  'TASK_NOT_FOUND': 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  'EXECUTION_NOT_FOUND': 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  'CREDENTIAL_NOT_FOUND': 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
  'EXECUTION_TIMEOUT': 'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
  'BROWSER_ERROR': 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  'AI_MODEL_ERROR': 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  'VALIDATION_ERROR': 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  'RATE_LIMIT_EXCEEDED': 'text-red-500 bg-red-50 dark:bg-red-900/20',
  'NETWORK_ERROR': 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20',
  'UNKNOWN_ERROR': 'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
}

export default function ErrorDisplay({
  error,
  onRetry,
  className = '',
  compact = false
}) {
  const [showDetails, setShowDetails] = useState(false)
  const { success: notifySuccess } = useNotificationStore()
  
  // エラーオブジェクトを解析
  const parseError = (err) => {
    if (typeof err === 'string') {
      return {
        message: err,
        code: 'UNKNOWN_ERROR',
        details: null,
        suggestion: null
      }
    }
    
    if (err?.response?.data) {
      // Axiosエラー
      const data = err.response.data
      return {
        message: data.error || data.detail || data.message || '不明なエラー',
        code: data.code || 'UNKNOWN_ERROR',
        details: data.details || null,
        suggestion: data.suggestion || null
      }
    }
    
    return {
      message: err?.message || err?.error || String(err),
      code: err?.code || 'UNKNOWN_ERROR',
      details: err?.details || null,
      suggestion: err?.suggestion || null
    }
  }
  
  const parsed = parseError(error)
  const Icon = iconMap[getIconForCode(parsed.code)] || AlertTriangle
  const colorClass = codeColors[parsed.code] || codeColors['UNKNOWN_ERROR']
  
  const copyError = () => {
    const text = `エラーコード: ${parsed.code}\nメッセージ: ${parsed.message}\n${parsed.details ? '詳細: ' + JSON.stringify(parsed.details) : ''}`
    navigator.clipboard.writeText(text)
    notifySuccess('コピーしました', 'エラー情報をクリップボードにコピーしました')
  }
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg ${colorClass} ${className}`}>
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-sm flex-1 truncate">{parsed.message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${colorClass.replace('text-', 'border-').split(' ')[0]}/30 overflow-hidden ${className}`}
    >
      {/* ヘッダー */}
      <div className={`p-4 ${colorClass}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/10">
                {parsed.code}
              </span>
            </div>
            <p className="font-medium">{parsed.message}</p>
          </div>
        </div>
      </div>
      
      {/* 提案 */}
      {parsed.suggestion && (
        <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-zinc-500">💡 提案:</span>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{parsed.suggestion}</p>
          </div>
        </div>
      )}
      
      {/* 詳細（展開可能） */}
      {parsed.details && Object.keys(parsed.details).length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <span>詳細情報</span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showDetails && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              className="px-4 pb-3 overflow-hidden"
            >
              <pre className="text-xs font-mono p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-x-auto">
                {JSON.stringify(parsed.details, null, 2)}
              </pre>
            </motion.div>
          )}
        </div>
      )}
      
      {/* アクション */}
      <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <button
          onClick={copyError}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Copy className="w-4 h-4" />
          コピー
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            再試行
          </button>
        )}
      </div>
    </motion.div>
  )
}

function getIconForCode(code) {
  const iconMapping = {
    'TASK_NOT_FOUND': 'search',
    'EXECUTION_NOT_FOUND': 'history',
    'CREDENTIAL_NOT_FOUND': 'key',
    'EXECUTION_TIMEOUT': 'clock',
    'BROWSER_ERROR': 'globe',
    'AI_MODEL_ERROR': 'brain',
    'VALIDATION_ERROR': 'alert-circle',
    'RATE_LIMIT_EXCEEDED': 'shield',
    'NETWORK_ERROR': 'wifi-off',
    'UNKNOWN_ERROR': 'alert-triangle'
  }
  return iconMapping[code] || 'alert-triangle'
}
