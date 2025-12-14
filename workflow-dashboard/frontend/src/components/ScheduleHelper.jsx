import { useState, useEffect } from 'react'
import { Calendar, Clock, X, Check, Info, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ScheduleHelper({ value, onChange, onClose }) {
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [customCron, setCustomCron] = useState(value || '')
  const [nextRunTime, setNextRunTime] = useState(null)
  
  // プリセットスケジュール
  const PRESETS = [
    {
      id: 'every_minute',
      name: '毎分',
      description: 'テスト用',
      cron: '* * * * *',
      icon: Clock,
      color: 'text-gray-500'
    },
    {
      id: 'every_5min',
      name: '5分ごと',
      description: '頻繁なチェック',
      cron: '*/5 * * * *',
      icon: Zap,
      color: 'text-blue-500'
    },
    {
      id: 'hourly',
      name: '毎時0分',
      description: '毎時間',
      cron: '0 * * * *',
      icon: Clock,
      color: 'text-indigo-500'
    },
    {
      id: 'daily_9am',
      name: '毎日9時',
      description: '朝の定期実行',
      cron: '0 9 * * *',
      icon: Calendar,
      color: 'text-amber-500'
    },
    {
      id: 'daily_noon',
      name: '毎日12時',
      description: '昼の定期実行',
      cron: '0 12 * * *',
      icon: Calendar,
      color: 'text-orange-500'
    },
    {
      id: 'daily_6pm',
      name: '毎日18時',
      description: '夕方の定期実行',
      cron: '0 18 * * *',
      icon: Calendar,
      color: 'text-purple-500'
    },
    {
      id: 'weekday_9am',
      name: '平日9時',
      description: '月〜金',
      cron: '0 9 * * 1-5',
      icon: Calendar,
      color: 'text-green-500'
    },
    {
      id: 'monday_9am',
      name: '毎週月曜9時',
      description: '週次レポート',
      cron: '0 9 * * 1',
      icon: Calendar,
      color: 'text-teal-500'
    }
  ]
  
  // Cron式の説明を生成
  const getCronDescription = (cron) => {
    if (!cron) return ''
    
    const descriptions = {
      '* * * * *': '毎分',
      '*/5 * * * *': '5分ごと',
      '*/10 * * * *': '10分ごと',
      '*/15 * * * *': '15分ごと',
      '*/30 * * * *': '30分ごと',
      '0 * * * *': '毎時0分',
      '0 0 * * *': '毎日0時',
      '0 9 * * *': '毎日9時',
      '0 12 * * *': '毎日12時',
      '0 18 * * *': '毎日18時',
      '0 21 * * *': '毎日21時',
      '0 9 * * 1-5': '平日9時',
      '0 9 * * 1': '毎週月曜9時',
      '0 9 * * 0': '毎週日曜9時',
      '0 9 1 * *': '毎月1日9時'
    }
    
    return descriptions[cron] || 'カスタムスケジュール'
  }
  
  // 次回実行時刻を計算（簡易版）
  useEffect(() => {
    const calculateNextRun = (cronExpr) => {
      if (!cronExpr) return null
      
      try {
        // 簡易的な計算（実際はcronstrue等のライブラリを使用推奨）
        const now = new Date()
        const parts = cronExpr.split(' ')
        
        if (parts.length !== 5) return null
        
        const [minute, hour, , , dayOfWeek] = parts
        
        // 毎分実行
        if (cronExpr === '* * * * *') {
          const next = new Date(now)
          next.setMinutes(next.getMinutes() + 1)
          next.setSeconds(0)
          return next
        }
        
        // N分ごと
        if (minute.startsWith('*/')) {
          const interval = parseInt(minute.slice(2))
          const next = new Date(now)
          const currentMinute = next.getMinutes()
          const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval
          next.setMinutes(nextMinute)
          next.setSeconds(0)
          return next
        }
        
        // 毎時X分
        if (minute !== '*' && hour === '*') {
          const next = new Date(now)
          const targetMinute = parseInt(minute)
          if (now.getMinutes() >= targetMinute) {
            next.setHours(next.getHours() + 1)
          }
          next.setMinutes(targetMinute)
          next.setSeconds(0)
          return next
        }
        
        // 毎日X時Y分
        if (minute !== '*' && hour !== '*') {
          const next = new Date(now)
          const targetHour = parseInt(hour)
          const targetMinute = parseInt(minute)
          
          next.setHours(targetHour)
          next.setMinutes(targetMinute)
          next.setSeconds(0)
          
          if (next <= now) {
            next.setDate(next.getDate() + 1)
          }
          
          return next
        }
        
        return null
      } catch (e) {
        return null
      }
    }
    
    const next = calculateNextRun(customCron)
    setNextRunTime(next)
  }, [customCron])
  
  const handlePresetClick = (preset) => {
    setSelectedPreset(preset.id)
    setCustomCron(preset.cron)
  }
  
  const handleSave = () => {
    onChange(customCron)
    onClose()
  }
  
  const formatNextRun = (date) => {
    if (!date) return 'スケジュール未設定'
    
    const now = new Date()
    const diff = date - now
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    const dateStr = date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    let relativeStr = ''
    if (days > 0) {
      relativeStr = `${days}日後`
    } else if (hours > 0) {
      relativeStr = `${hours}時間後`
    } else if (minutes > 0) {
      relativeStr = `${minutes}分後`
    } else {
      relativeStr = '1分以内'
    }
    
    return `${dateStr} (${relativeStr})`
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
      >
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                スケジュール設定
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                プリセットまたはCron形式で設定
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 本文 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* 次回実行時刻 */}
          {customCron && nextRunTime && (
            <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  次回実行予定
                </span>
              </div>
              <p className="text-blue-700 dark:text-blue-300 font-mono text-lg">
                {formatNextRun(nextRunTime)}
              </p>
            </div>
          )}
          
          {/* プリセット */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              プリセット
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PRESETS.map((preset) => {
                const Icon = preset.icon
                const isSelected = selectedPreset === preset.id || customCron === preset.cron
                
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 mx-auto ${preset.color}`} />
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {preset.name}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      {preset.description}
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex justify-center">
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* カスタムCron */}
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">
              カスタム設定（Cron形式）
            </label>
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="0 9 * * * (毎日9時)"
              className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <div className="mt-2 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="mb-1">
                  <strong>説明:</strong> {getCronDescription(customCron)}
                </p>
                <p className="text-xs">
                  Cron形式: 分 時 日 月 曜日（例: 0 9 * * * = 毎日9時）
                </p>
              </div>
            </div>
          </div>
          
          {/* Cron例 */}
          <div className="mt-6 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300">
            <div className="font-semibold mb-2">例:</div>
            <div className="space-y-1">
              <div><span className="text-blue-600 dark:text-blue-400">*/5 * * * *</span> - 5分ごと</div>
              <div><span className="text-blue-600 dark:text-blue-400">0 * * * *</span> - 毎時0分</div>
              <div><span className="text-blue-600 dark:text-blue-400">0 9 * * *</span> - 毎日9時</div>
              <div><span className="text-blue-600 dark:text-blue-400">0 9 * * 1-5</span> - 平日9時</div>
              <div><span className="text-blue-600 dark:text-blue-400">0 9 * * 1</span> - 毎週月曜9時</div>
            </div>
          </div>
        </div>
        
        {/* フッター */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={() => {
              setCustomCron('')
              setSelectedPreset(null)
            }}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            クリア
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
