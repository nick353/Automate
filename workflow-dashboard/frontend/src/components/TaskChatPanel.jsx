import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  Sparkles,
  Clock,
  Mic,
  MicOff,
  RotateCcw
} from 'lucide-react'
import { tasksApi } from '../services/api'
import useLanguageStore from '../stores/languageStore'
import useTaskChatStore from '../stores/taskChatStore'

export default function TaskChatPanel({
  task,
  onClose,
  onRefresh
}) {
  const { t } = useLanguageStore()
  const taskChatEndRef = useRef(null)
  
  // ストアからチャット履歴を取得
  const {
    getChatHistory,
    setChatHistory: setStoreChatHistory,
    clearChatHistory
  } = useTaskChatStore()
  
  // ストアから履歴を取得
  const storedHistory = getChatHistory(task.id)
  
  // ローカルState
  const [taskChatHistory, setTaskChatHistory] = useState(storedHistory)
  const [taskChatInput, setTaskChatInput] = useState('')
  const [taskChatLoading, setTaskChatLoading] = useState(false)
  const [taskPendingActions, setTaskPendingActions] = useState(null)
  
  // チャット履歴が変更されたらストアに保存
  useEffect(() => {
    if (taskChatHistory.length > 0) {
      setStoreChatHistory(task.id, taskChatHistory)
    }
  }, [taskChatHistory, task.id, setStoreChatHistory])
  
  // 履歴をクリアする関数
  const handleClearHistory = () => {
    if (confirm('チャット履歴をクリアしますか？')) {
      clearChatHistory(task.id)
      setTaskChatHistory([])
      setTaskPendingActions(null)
    }
  }
  
  // 音声入力のState
  const [isTaskChatListening, setIsTaskChatListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const taskRecognitionRef = useRef(null)

  // 音声認識のセットアップ
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      
      const taskRecognition = new SpeechRecognition()
      taskRecognition.continuous = false
      taskRecognition.interimResults = true
      taskRecognition.lang = 'ja-JP'

      taskRecognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
        
        if (event.results[event.results.length - 1].isFinal) {
          setTaskChatInput(prev => prev + transcript)
        }
      }

      taskRecognition.onerror = () => setIsTaskChatListening(false)
      taskRecognition.onend = () => setIsTaskChatListening(false)
      taskRecognitionRef.current = taskRecognition
    }

    return () => {
      if (taskRecognitionRef.current) taskRecognitionRef.current.abort()
    }
  }, [])

  // 音声入力の開始/停止
  const toggleTaskChatListening = () => {
    if (!taskRecognitionRef.current) return

    if (isTaskChatListening) {
      taskRecognitionRef.current.stop()
      setIsTaskChatListening(false)
    } else {
      const langMap = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' }
      const currentLang = localStorage.getItem('language') || 'ja'
      taskRecognitionRef.current.lang = langMap[currentLang] || 'ja-JP'
      taskRecognitionRef.current.start()
      setIsTaskChatListening(true)
    }
  }

  useEffect(() => {
    taskChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [taskChatHistory])
  
  const handleTaskChatSend = async () => {
    if (!taskChatInput.trim() || taskChatLoading) return
    
    const userMessage = taskChatInput.trim()
    setTaskChatInput('')
    setTaskChatLoading(true)
    setTaskPendingActions(null)
    
    try {
      const response = await tasksApi.taskChat(task.id, userMessage, taskChatHistory)
      setTaskChatHistory(response.data.chat_history || [])
      
      if (response.data.actions?.actions) {
        setTaskPendingActions(response.data.actions.actions)
      }
    } catch (error) {
      console.error('Task chat error:', error)
      setTaskChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `エラーが発生しました: ${error.message}`
      }])
    }
    
    setTaskChatLoading(false)
  }
  
  const handleTaskExecuteActions = async () => {
    if (!taskPendingActions) return
    
    setTaskChatLoading(true)
    try {
      const response = await tasksApi.executeTaskActions(task.id, taskPendingActions)
      
      setTaskChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `✅ **変更を適用しました！**\n\n${response.data.message}`
      }])
      
      setTaskPendingActions(null)
      onRefresh()
    } catch (error) {
      setTaskChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ 変更の適用に失敗しました: ${error.message}`
      }])
    }
    setTaskChatLoading(false)
  }
  
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col"
    >
      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
        <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{t('taskBoard.taskChat')}</h3>
          <p className="text-xs text-muted-foreground truncate">{task.name}</p>
        </div>
        <button
          onClick={handleClearHistory}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
          title="履歴をクリア"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* タスク情報サマリー */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">実行場所:</span>
            <span className={task.execution_location === 'server' ? 'text-emerald-500' : 'text-amber-500'}>
              {task.execution_location === 'server' ? '🖥️ サーバー' : '💻 ローカル'}
            </span>
          </div>
          {task.schedule && (
            <div className="flex items-center gap-2">
              <span className="font-medium">スケジュール:</span>
              <span className="text-blue-500">{task.schedule}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium">ステータス:</span>
            <span className={task.is_active ? 'text-emerald-500' : 'text-zinc-500'}>
              {task.is_active ? '✅ 有効' : '⏸️ 無効'}
            </span>
          </div>
        </div>
      </div>
      
      {/* クイックアクション */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setTaskChatInput('このタスクの動作を説明してください')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          説明
        </button>
        <button
          onClick={() => setTaskChatInput('このタスクの指示を改善してください')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full whitespace-nowrap hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          改善
        </button>
        <button
          onClick={() => setTaskChatInput('スケジュールを変更したい')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full whitespace-nowrap hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          スケジュール
        </button>
      </div>
      
      {/* チャット履歴 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {taskChatHistory.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">このタスクについて質問してください</p>
            <p className="text-xs mt-1">ロジックの説明、設定の変更などをサポートします</p>
          </div>
        )}
        
        {taskChatHistory.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-500'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {/* ローディング */}
        {taskChatLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
            </div>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        {/* アクション実行ボタン */}
        {taskPendingActions && taskPendingActions.length > 0 && (
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-cyan-500" />
              <span className="font-semibold text-foreground">変更の確認</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {taskPendingActions.length}件の変更を適用します
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleTaskExecuteActions}
                disabled={taskChatLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                適用する
              </button>
              <button
                onClick={() => setTaskPendingActions(null)}
                className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
        
        <div ref={taskChatEndRef} />
      </div>
      
      {/* 入力フィールド */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={taskChatInput}
            onChange={(e) => setTaskChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTaskChatSend()}
            placeholder={isTaskChatListening ? t('wizard.voiceListening') : t('taskBoard.taskChatPlaceholder')}
            disabled={taskChatLoading}
            className={`flex-1 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all disabled:opacity-50 ${
              isTaskChatListening ? 'border-red-500/50 bg-red-500/5' : ''
            }`}
          />
          {/* 音声入力ボタン */}
          {speechSupported ? (
            <button
              onClick={toggleTaskChatListening}
              disabled={taskChatLoading}
              className={`px-3 py-3 rounded-xl transition-colors ${
                isTaskChatListening
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse'
                  : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30'
              }`}
              title={isTaskChatListening ? t('wizard.voiceStop') : `${t('wizard.voiceStart')}\n${t('wizard.voiceMacHint')}`}
            >
              {isTaskChatListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : (
            <div 
              className="px-3 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-help"
              title={t('wizard.voiceNotSupported')}
            >
              <Mic className="w-5 h-5" />
            </div>
          )}
          <button
            onClick={handleTaskChatSend}
            disabled={!taskChatInput.trim() || taskChatLoading}
            className="px-4 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {/* 音声入力のヒント */}
        {isTaskChatListening ? (
          <div className="mt-2 text-xs text-red-500 animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            {t('wizard.voiceListeningHint')}
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <span className="opacity-60">💡</span>
            {t('wizard.voiceMacHint')}
          </div>
        )}
      </div>
    </motion.div>
  )
}
