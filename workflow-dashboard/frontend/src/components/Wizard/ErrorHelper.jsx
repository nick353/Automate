import { motion } from 'framer-motion'
import { 
  AlertTriangle, 
  Key, 
  Wifi,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Lightbulb,
  Settings,
  HelpCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import useLanguageStore from '../../stores/languageStore'

// エラーメッセージからエラータイプを判定
function detectErrorType(errorMessage) {
  const message = errorMessage.toLowerCase()
  
  if (message.includes('anthropic') || message.includes('claude')) {
    return 'Anthropic'
  }
  if (message.includes('google') || message.includes('gemini')) {
    return 'Google'
  }
  if (message.includes('api') || message.includes('apiキー')) {
    return 'API'
  }
  if (message.includes('network') || message.includes('connection') || message.includes('refused')) {
    return 'network'
  }
  if (message.includes('timeout') || message.includes('タイムアウト')) {
    return 'timeout'
  }
  if (message.includes('session') || message.includes('セッション')) {
    return 'session'
  }
  
  return 'default'
}

export default function ErrorHelper({ error, onRetry, onRestart }) {
  const { t } = useLanguageStore()

  if (!error) return null

  // エラータイプと解決策のマッピング
  const errorSolutions = {
    // API関連
    'API': {
      icon: Key,
      color: 'amber',
      title: t('error.api.title'),
      solutions: [
        { text: t('error.api.checkKey'), action: 'credentials' },
        { text: t('error.api.checkLimit'), action: 'link', url: 'https://console.anthropic.com' },
        { text: t('error.api.checkPermissions'), action: 'info' }
      ]
    },
    'Anthropic': {
      icon: Key,
      color: 'purple',
      title: 'Anthropic ' + t('error.api.title'),
      solutions: [
        { text: t('error.api.checkKey'), action: 'credentials' },
        { text: 'APIキーが有効期限切れでないか確認', action: 'info' },
        { text: t('error.api.checkLimit'), action: 'link', url: 'https://console.anthropic.com' }
      ]
    },
    'Google': {
      icon: Key,
      color: 'blue',
      title: 'Google ' + t('error.api.title'),
      solutions: [
        { text: t('error.api.checkKey'), action: 'credentials' },
        { text: 'APIが有効化されているか確認', action: 'link', url: 'https://console.cloud.google.com/apis' },
        { text: t('error.api.checkPermissions'), action: 'info' }
      ]
    },
    // ネットワーク関連
    'network': {
      icon: Wifi,
      color: 'rose',
      title: t('error.network.title'),
      solutions: [
        { text: t('error.network.checkConn'), action: 'info' },
        { text: t('error.network.checkServer'), action: 'info' },
        { text: t('error.network.waitRetry'), action: 'retry' }
      ]
    },
    'timeout': {
      icon: RefreshCw,
      color: 'orange',
      title: t('error.timeout.title'),
      solutions: [
        { text: t('error.timeout.wait'), action: 'info' },
        { text: t('error.timeout.retry'), action: 'retry' }
      ]
    },
    // セッション関連
    'session': {
      icon: RefreshCw,
      color: 'gray',
      title: t('error.session.title'),
      solutions: [
        { text: t('error.session.reload'), action: 'reload' },
        { text: t('error.session.restart'), action: 'restart' }
      ]
    },
    // デフォルト
    'default': {
      icon: AlertTriangle,
      color: 'rose',
      title: t('error.title'),
      solutions: [
        { text: t('error.reload'), action: 'reload' },
        { text: t('error.contactAdmin'), action: 'info' }
      ]
    }
  }

  const errorType = detectErrorType(error)
  const errorInfo = errorSolutions[errorType] || errorSolutions.default
  const Icon = errorInfo.icon

  const colorClasses = {
    amber: 'border-amber-500/30 bg-amber-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    rose: 'border-rose-500/30 bg-rose-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    gray: 'border-gray-500/30 bg-gray-500/5'
  }

  const iconColorClasses = {
    amber: 'bg-amber-500/20 text-amber-500',
    purple: 'bg-purple-500/20 text-purple-500',
    blue: 'bg-blue-500/20 text-blue-500',
    rose: 'bg-rose-500/20 text-rose-500',
    orange: 'bg-orange-500/20 text-orange-500',
    gray: 'bg-gray-500/20 text-gray-500'
  }

  const handleAction = (action, url) => {
    switch (action) {
      case 'retry':
        onRetry?.()
        break
      case 'restart':
        onRestart?.()
        break
      case 'reload':
        window.location.reload()
        break
      case 'link':
        window.open(url, '_blank')
        break
      default:
        break
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border-2 overflow-hidden",
        colorClasses[errorInfo.color]
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          iconColorClasses[errorInfo.color]
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground">{errorInfo.title}</h4>
          <p className="text-sm text-muted-foreground mt-1 break-words">{error}</p>
        </div>
      </div>

      {/* Solutions */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-foreground">{t('error.solution')}</span>
        </div>
        
        <div className="space-y-2">
          {errorInfo.solutions.map((solution, index) => (
            <button
              key={index}
              onClick={() => handleAction(solution.action, solution.url)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                solution.action === 'credentials' 
                  ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-primary/50"
                  : solution.action === 'info'
                  ? "bg-zinc-100 dark:bg-zinc-800/50"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-primary/50"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                {solution.action === 'credentials' && <Key className="w-4 h-4 text-primary" />}
                {solution.action === 'link' && <ExternalLink className="w-4 h-4 text-primary" />}
                {solution.action === 'retry' && <RefreshCw className="w-4 h-4 text-primary" />}
                {solution.action === 'reload' && <RefreshCw className="w-4 h-4 text-primary" />}
                {solution.action === 'restart' && <RefreshCw className="w-4 h-4 text-primary" />}
                {solution.action === 'info' && <HelpCircle className="w-4 h-4 text-muted-foreground" />}
              </div>
              <span className="flex-1 text-sm text-foreground">{solution.text}</span>
              {solution.action === 'credentials' && (
                <Link 
                  to="/credentials" 
                  className="text-primary hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
              {solution.action === 'link' && (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-4 flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            {t('error.retry')}
          </button>
        )}
        <Link
          to="/credentials"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
        >
          <Settings className="w-4 h-4" />
          {t('error.settings')}
        </Link>
      </div>
    </motion.div>
  )
}
