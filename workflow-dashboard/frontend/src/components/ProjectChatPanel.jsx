import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Sparkles,
  X,
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  Video,
  Paperclip,
  Search,
  Edit2,
  Trash2,
  Zap,
  Mic,
  MicOff,
  Play,
  Clock,
  Settings,
  Image,
  RotateCcw,
  Shield,
  FlaskConical,
  AlertTriangle,
  ChevronDown,
  Cpu,
  MessageSquare,
  ChevronRight,
  Eye,
  RefreshCw,
  ArrowRight
} from 'lucide-react'
import { projectsApi, tasksApi, executionsApi, systemApi } from '../services/api'
import useLanguageStore from '../stores/languageStore'
import useProjectChatStore from '../stores/projectChatStore'
import useTaskStore from '../stores/taskStore'
import useCredentialStore from '../stores/credentialStore'
import useNotificationStore from '../stores/notificationStore'

export default function ProjectChatPanel({
  project,
  boardData,
  onClose,
  onRefresh
}) {
  const { t } = useLanguageStore()
  const { fetchCredentials, fetchStatus, status } = useCredentialStore()
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotificationStore()
  const chatEndRef = useRef(null)
  
  // ストアからチャット履歴を取得
  const {
    getChatHistory,
    setChatHistory: setStoreChatHistory,
    getVideoAnalysis,
    setVideoAnalysis: setStoreVideoAnalysis,
    getWebResearchResults,
    setWebResearchResults: setStoreWebResearchResults,
    getCreatedTasks,
    addCreatedTasks,
    clearChatHistory
  } = useProjectChatStore()
  
  // 初期メッセージを生成
  const getInitialMessage = () => ({
    role: 'assistant',
    content: `こんにちは！プロジェクト「${project.name}」の自動化をお手伝いします 🤖

━━━━━━━━━━━━━━━━━━━━
📋 できること
━━━━━━━━━━━━━━━━━━━━

✅ タスクの作成
  チャットで「〇〇を自動化したい」と伝えるだけ

✅ テスト実行
  作成したタスクをすぐに動作確認

✅ 編集・調整
  チャットで「スケジュールを変更」「指示を改善」など

━━━━━━━━━━━━━━━━━━━━
🚀 始め方
━━━━━━━━━━━━━━━━━━━━

自動化したい作業を教えてください！

例：
• 「毎朝9時にニュースサイトから最新記事を取得したい」
• 「Amazonの商品価格を定期的にチェックしたい」
• 「Googleスプレッドシートにデータを転記したい」

※APIキー（sk-...）をお持ちの場合は、このチャットに貼り付けると自動登録されます`
  })
  
  // ストアから履歴を取得、なければ初期メッセージを使用
  const storedHistory = getChatHistory(project.id)
  const initialHistory = storedHistory.length > 0 ? storedHistory : [getInitialMessage()]
  
  // ローカルState
  const [chatHistory, setChatHistory] = useState(initialHistory)
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [pendingActions, setPendingActions] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)
  const [videoAnalysis, setVideoAnalysis] = useState(getVideoAnalysis(project.id))
  const [webResearchResults, setWebResearchResults] = useState(getWebResearchResults(project.id))
  
  // 作成状態の管理
  const [creatingInfo, setCreatingInfo] = useState(null) // { current: 1, total: 3, task_name: "..." }
  const [executionWatchers, setExecutionWatchers] = useState({})
  const [createdTasks, setCreatedTasks] = useState(getCreatedTasks(project.id)) // 作成されたタスクのリスト
  const [retryTaskId, setRetryTaskId] = useState(null)
  const [retrySuggestion, setRetrySuggestion] = useState(null)
  const [errorAnalysis, setErrorAnalysis] = useState(null) // { analysis, taskId, executionId }
  const [pendingNotice, setPendingNotice] = useState(null) // { message, subMessage }
  const executionPollerRef = useRef({})
  const pendingNoticeTimerRef = useRef(null)
  
  // 検証状態の管理
  const [validationResult, setValidationResult] = useState(null) // 検証結果
  const [showTestOption, setShowTestOption] = useState(false) // テスト実行オプション表示
  const testMonitorRef = useRef(null) // { executionId, taskName }
  const testMonitorTimerRef = useRef(null)
  const { dequeueExecution } = useTaskStore()
  
  // タスク編集モードの管理
  const [editingTask, setEditingTask] = useState(null) // 編集中のタスク
  const [taskEditChatHistory, setTaskEditChatHistory] = useState([]) // タスク編集用チャット履歴
  const [taskEditPendingActions, setTaskEditPendingActions] = useState(null) // タスク編集用アクション
  
  // ワークフローステップガイド
  const [workflowStep, setWorkflowStep] = useState(null) // 'creating' | 'testing' | 'editing' | 'completed'
  const [expandedTaskId, setExpandedTaskId] = useState(null) // 展開されたタスクカードのID
  
  // 長時間処理中のUI制御
  const startPendingNotice = (message, subMessage = '処理中です。少々お待ちください…') => {
    if (pendingNoticeTimerRef.current) clearTimeout(pendingNoticeTimerRef.current)
    setPendingNotice({ message, subMessage })
    // 12秒経過したら追記メッセージでユーザーに安心感を与える
    pendingNoticeTimerRef.current = setTimeout(() => {
      setPendingNotice((prev) =>
        prev
          ? {
              ...prev,
              subMessage: prev.subMessage || 'まだ処理中です。もう少々お待ちください…'
            }
          : null
      )
    }, 12000)
  }
  
  const updatePendingNotice = (message, subMessage) => {
    setPendingNotice((prev) => {
      if (!prev && !message) return prev
      return {
        message: message || prev?.message,
        subMessage: subMessage ?? prev?.subMessage
      }
    })
  }
  
  const clearPendingNotice = () => {
    if (pendingNoticeTimerRef.current) {
      clearTimeout(pendingNoticeTimerRef.current)
      pendingNoticeTimerRef.current = null
    }
    setPendingNotice(null)
  }
  
  // AIモデル（Claude Sonnet 4.5 固定）
  const selectedModel = 'claude-sonnet-4-5-20250929'
  
  // チャット履歴が変更されたらストアに保存
  useEffect(() => {
    if (chatHistory.length > 0) {
      setStoreChatHistory(project.id, chatHistory)
    }
  }, [chatHistory, project.id, setStoreChatHistory])
  
  // アンマウント時にPending通知をクリア
  useEffect(() => {
    return () => clearPendingNotice()
  }, [])
  
  // 動画分析結果が変更されたらストアに保存
  useEffect(() => {
    if (videoAnalysis) {
      setStoreVideoAnalysis(project.id, videoAnalysis)
    }
  }, [videoAnalysis, project.id, setStoreVideoAnalysis])
  
  // Webリサーチ結果が変更されたらストアに保存
  useEffect(() => {
    if (webResearchResults) {
      setStoreWebResearchResults(project.id, webResearchResults)
    }
  }, [webResearchResults, project.id, setStoreWebResearchResults])

  // テスト監視タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (testMonitorTimerRef.current) {
        clearTimeout(testMonitorTimerRef.current)
      }
    }
  }, [])

  // 認証情報ステータスの初期取得
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])
  
  
  
  // 添付ファイルのState
  const [attachedFile, setAttachedFile] = useState(null) // { file: File, type: 'image'|'video'|'file', preview: string }
  
  // 音声入力のState
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef(null)

  // 音声認識のセットアップ
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'ja-JP'

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
        
        if (event.results[event.results.length - 1].isFinal) {
          setChatInput(prev => prev + transcript)
        }
      }

      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  // 音声入力の開始/停止
  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      const langMap = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' }
      const currentLang = localStorage.getItem('language') || 'ja'
      recognitionRef.current.lang = langMap[currentLang] || 'ja-JP'
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // 実行IDを監視してログをチャットに表示
  const monitorExecution = (executionId, label = 'タスク実行', taskIdForRetry = null) => {
    if (!executionId) return
    setExecutionWatchers((prev) => ({ ...prev, [executionId]: { status: 'pending', label } }))
    setChatHistory((prev) => [
      ...prev,
      { role: 'assistant', content: `${label} (ID: ${executionId}) を開始しました。ログを取得しています...` }
    ])
    startPendingNotice(`ログ取得中… (ID: ${executionId})`, 'このままお待ちください。取得でき次第ここに表示します。')

    const poll = async () => {
      try {
        const execRes = await executionsApi.get(executionId)
        const status = execRes.data?.status
        if (status === 'running' || status === 'pending') {
          executionPollerRef.current[executionId] = setTimeout(poll, 2000)
          return
        }
        // ログ取得（空ならリトライしてできるだけ埋める）
        let logsRes = await executionsApi.getLogs(executionId)
        let logs = logsRes.data?.logs || logsRes.data || []
        if ((!logs || logs.length === 0) && (status === 'completed' || status === 'failed')) {
          try {
            await new Promise((r) => setTimeout(r, 800))
            logsRes = await executionsApi.getLogs(executionId)
            logs = logsRes.data?.logs || logsRes.data || []
          } catch (_) {
            // リトライ失敗は無視
          }
        }
        // ログを整形（詳細ログ形式に対応）
        const formattedLogs = logs.map((l) => {
          if (typeof l === 'string') {
            return { level: 'INFO', message: l, source: 'file' }
          }
          return {
            level: l.level || l.lvl || 'INFO',
            message: l.message || l.text || l || '',
            source: l.source || 'unknown',
            step_number: l.step_number,
            action_type: l.action_type,
            status: l.status
          }
        })
        
        // エラーログを優先的に取得
        const errorLogs = formattedLogs.filter(l => 
          (l.level && l.level.toUpperCase() === 'ERROR') || 
          (l.message && (l.message.toLowerCase().includes('error') || l.message.toLowerCase().includes('失敗') || l.message.toLowerCase().includes('failed')))
        )
        const recentLogs = formattedLogs.slice(-30) // 最新30行
        
        const tail = [...errorLogs, ...recentLogs]
          .slice(0, 30) // 最大30行
          .map((l) => {
            const msg = l.message || ''
            const lvl = l.level ? `[${l.level}]` : ''
            const src = l.source && l.source !== 'unknown' ? `[${l.source}]` : ''
            const step = l.step_number ? `Step${l.step_number}` : ''
            const parts = [src, step, lvl, msg].filter(Boolean)
            return `• ${parts.join(' ')}`
          })
          .filter(Boolean)
          .join('\n')
        
        const error = execRes.data?.error_message
        let msg = `${label} (ID: ${executionId}) が ${status || '完了'} で終了しました。`
        if (tail) msg += `\n\nログ抜粋:\n${tail}`
        if (error) msg += `\n\nエラー: ${error}`
        
        if (status === 'failed') {
          // エラー発生時は自動的に改善案を取得
          const lastTask = createdTasks[createdTasks.length - 1]
          const retryId = taskIdForRetry || lastTask?.id
          
          if (retryId) {
            setRetryTaskId(retryId)
            setRetrySuggestion(error || null)
            
            // 自動的にエラー分析を実行
            try {
              // より詳細なログ情報を取得
              const logsList = formattedLogs.map(l => {
                const parts = []
                if (l.source && l.source !== 'unknown') parts.push(`[${l.source}]`)
                if (l.step_number) parts.push(`[Step${l.step_number}]`)
                if (l.action_type) parts.push(`[${l.action_type}]`)
                if (l.level) parts.push(`[${l.level}]`)
                parts.push(l.message || '')
                return parts.join(' ')
              }).filter(Boolean)
              
              const analysisRes = await projectsApi.analyzeError(
                project.id,
                retryId,
                executionId,
                error || 'エラーが発生しました',
                logsList
              )
              
              if (analysisRes.data?.success && analysisRes.data?.analysis) {
                const analysis = analysisRes.data.analysis
                setErrorAnalysis({
                  analysis,
                  taskId: retryId,
                  executionId
                })
                
                // 改善案をチャットに表示
                let suggestionMsg = `\n\n🔍 エラーを分析しました\n\n`
                suggestionMsg += `【原因】\n${analysis.error_analysis || analysis.root_cause || '不明'}\n\n`
                
                if (analysis.suggestions && analysis.suggestions.length > 0) {
                  const recommended = analysis.suggestions[analysis.recommended_action || 0]
                  suggestionMsg += `【推奨改善案】\n${recommended.title}\n${recommended.description}\n\n`
                  
                  if (analysis.auto_fixable) {
                    suggestionMsg += `この改善案を承認すると、自動的に修正を適用して再実行します。`
                  } else {
                    suggestionMsg += `改善案の詳細を確認して、手動で修正してください。`
                  }
                }
                
                msg += suggestionMsg
              } else {
                msg += `\n\n改善案を提案しましょうか？「再実行」か「提案して」と入力してください。`
              }
            } catch (analysisError) {
              console.error('エラー分析に失敗:', analysisError)
              msg += `\n\n改善案を提案しましょうか？「再実行」か「提案して」と入力してください。`
            }
          } else {
            msg += `\n\n改善案を提案しましょうか？「再実行」か「提案して」と入力してください。`
          }
          // 失敗通知
          notifyError('実行失敗', `${label}でエラーが発生しました`)
        } else {
          msg += `\n\n次のステップがあれば教えてください。`
          // 成功通知
          notifySuccess('実行完了', `${label}が正常に完了しました`)
        }
        
        setChatHistory((prev) => [...prev, { role: 'assistant', content: msg }])
        clearPendingNotice()
      } catch (err) {
        const errorMsg = err.message || '不明なエラー'
        const statusCode = err.response?.status
        const errorData = err.response?.data
        const reason = statusCode ? `HTTP ${statusCode}: ${errorMsg}` : errorMsg
        // エラーボディをわかる範囲で文字列化
        const errorBody = errorData
          ? typeof errorData === 'string'
            ? errorData
            : errorData.detail || errorData.message || JSON.stringify(errorData)
          : null
        
        // HTTPエラー（422など）の場合もエラー分析を実行
        if (statusCode && statusCode >= 400 && taskIdForRetry) {
          try {
            // エラーレスポンスから詳細情報を取得
            const errorDetails = []
            if (errorData) {
              if (typeof errorData === 'string') {
                errorDetails.push(errorData)
              } else if (errorData.detail) {
                errorDetails.push(errorData.detail)
              } else if (errorData.message) {
                errorDetails.push(errorData.message)
              } else {
                errorDetails.push(JSON.stringify(errorData))
              }
            }
            
            // 可能であれば実行ログも取得を試みる
            let additionalLogs = []
            try {
              const logsRes = await executionsApi.getLogs(executionId)
              const logs = logsRes.data?.logs || logsRes.data || []
              additionalLogs = logs.map(l => {
                if (typeof l === 'string') return l
                return l.message || l.text || JSON.stringify(l)
              }).filter(Boolean)
            } catch (logErr) {
              // ログ取得に失敗しても続行
            }
            
            const analysisRes = await projectsApi.analyzeError(
              project.id,
              taskIdForRetry,
              executionId,
              `HTTP ${statusCode}: ${errorMsg}\n${errorDetails.join('\n')}`,
              additionalLogs
            )
            
            if (analysisRes.data?.success && analysisRes.data?.analysis) {
              const analysis = analysisRes.data.analysis
              setErrorAnalysis({
                analysis,
                taskId: taskIdForRetry,
                executionId
              })
              clearPendingNotice()
              
              setChatHistory((prev) => [
                ...prev,
                { role: 'assistant', content: `${label} (ID: ${executionId}) のログ取得に失敗しました: ${errorMsg}\n\n🔍 エラーを分析しました。改善案を表示しています。` }
              ])
              
              setRetryTaskId(taskIdForRetry)
              return
            }
          } catch (analysisError) {
            console.error('エラー分析に失敗:', analysisError)
          }
        }
        
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${label} (ID: ${executionId}) のログ取得に失敗しました: ${reason}${
              errorBody ? `\nエラーメッセージ: ${errorBody}` : ''
            }\n手動実行IDで確認するか、再取得を試してください。`
          }
        ])
        updatePendingNotice(
          'ログ取得に失敗しました',
          `${reason}\n再取得を試すか、管理画面で手動実行IDを指定してログを確認してください。`
        )
      } finally {
        clearPendingNotice()
        setExecutionWatchers((prev) => {
          const next = { ...prev }
          delete next[executionId]
          return next
        })
        if (executionPollerRef.current[executionId]) {
          clearTimeout(executionPollerRef.current[executionId])
          delete executionPollerRef.current[executionId]
        }
      }
    }
    poll()
  }

  // チャットスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // 実行監視タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      Object.values(executionPollerRef.current || {}).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // タスク一覧など他画面から積まれたexecutionを拾って監視
  useEffect(() => {
    const timer = setInterval(() => {
      const item = dequeueExecution()
      if (item?.execution_id) {
        monitorExecution(item.execution_id, item.label || '手動実行')
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [dequeueExecution])

  // 再実行（手動＆提案付き）
  const handleRetryTask = async (taskId, withSuggestion = false) => {
    if (!taskId) return
    setIsChatLoading(true)
    try {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `タスク再実行を開始します (ID: ${taskId})...` }])
      // 提案を適用してから再実行する場合は、task_promptに追記して保存
      if (withSuggestion && retrySuggestion) {
        try {
          const taskRes = await tasksApi.get(taskId)
          const task = taskRes.data
          const patchedPrompt = `${task.task_prompt || ''}\n\n# 提案メモ\n${retrySuggestion}`
          await tasksApi.update(taskId, { task_prompt: patchedPrompt })
          setChatHistory(prev => [...prev, { role: 'assistant', content: '提案をタスクに反映しました。再実行します...' }])
        } catch (e) {
          setChatHistory(prev => [...prev, { role: 'assistant', content: `提案の適用に失敗しました: ${e.message}` }])
        }
      }
      const res = await tasksApi.run(taskId)
      const execId = res.data?.execution_id || res.data?.status
      if (execId) {
        monitorExecution(execId, withSuggestion ? '提案適用後の再実行' : '再実行')
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', content: '実行IDを取得できませんでした。' }])
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `再実行に失敗しました: ${err.message}` }])
    } finally {
      setIsChatLoading(false)
      setRetryTaskId(null)
      setRetrySuggestion(null)
    }
  }

  // タスク編集モードを開始
  const startTaskEdit = async (task) => {
    setEditingTask(task)
    setWorkflowStep('editing')
    setTaskEditChatHistory([{
      role: 'assistant',
      content: `タスク「${task.name}」の編集モードです。

📝 現在の設定:
• 名前: ${task.name}
• 説明: ${task.description || 'なし'}
• 実行場所: ${task.execution_location === 'server' ? 'サーバー' : 'ローカル'}
• スケジュール: ${task.schedule || '手動実行'}

何を変更しますか？
例: 「指示内容を改善して」「スケジュールを毎日9時に変更」「より詳細な手順を追加」`
    }])
    setTaskEditPendingActions(null)
  }

  // タスク編集チャットを送信
  const handleTaskEditChat = async (message) => {
    if (!message.trim() || !editingTask || isChatLoading) return
    
    setIsChatLoading(true)
    setTaskEditPendingActions(null)
    
    // ユーザーメッセージを追加
    const newHistory = [...taskEditChatHistory, { role: 'user', content: message }]
    setTaskEditChatHistory(newHistory)
    
    try {
      const response = await tasksApi.taskChat(editingTask.id, message, taskEditChatHistory)
      setTaskEditChatHistory(response.data.chat_history || newHistory)
      
      if (response.data.actions?.actions) {
        setTaskEditPendingActions(response.data.actions.actions)
      }
    } catch (error) {
      console.error('Task edit chat error:', error)
      setTaskEditChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `エラーが発生しました: ${error.message}`
      }])
    }
    
    setIsChatLoading(false)
  }

  // タスク編集アクションを実行
  const handleTaskEditExecuteActions = async () => {
    if (!taskEditPendingActions || !editingTask) return
    
    setIsChatLoading(true)
    try {
      const response = await tasksApi.executeTaskActions(editingTask.id, taskEditPendingActions)
      
      setTaskEditChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `✅ 変更を適用しました！

${response.data.message}

テスト実行して動作を確認しますか？`
      }])
      
      setTaskEditPendingActions(null)
      
      // タスク情報を更新
      try {
        const updatedTaskRes = await tasksApi.get(editingTask.id)
        setEditingTask(updatedTaskRes.data)
        
        // createdTasksも更新
        setCreatedTasks(prev => prev.map(t => 
          t.id === editingTask.id ? updatedTaskRes.data : t
        ))
      } catch (e) {
        // 更新に失敗しても続行
      }
      
      onRefresh()
    } catch (error) {
      setTaskEditChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ 変更の適用に失敗しました: ${error.message}`
      }])
    }
    setIsChatLoading(false)
  }

  // タスク編集モードを終了
  const closeTaskEdit = () => {
    setEditingTask(null)
    setTaskEditChatHistory([])
    setTaskEditPendingActions(null)
    setWorkflowStep(createdTasks.length > 0 ? 'completed' : null)
  }

  // クイックテスト実行（編集モードから）
  const handleQuickTestRun = async () => {
    if (!editingTask) return
    
    setTaskEditChatHistory(prev => [...prev, {
      role: 'assistant',
      content: `🚀 テスト実行を開始しています...`
    }])
    
    try {
      const res = await tasksApi.run(editingTask.id)
      const execId = res.data?.execution_id || res.data?.executionId || res.data?.execution?.id
      
      if (execId) {
        setTaskEditChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `テスト実行を開始しました（実行ID: ${execId}）

メインチャットでログを監視しています。結果が出たらお知らせします。`
        }])
        monitorExecution(execId, `テスト実行: ${editingTask.name}`, editingTask.id)
      } else {
        setTaskEditChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `実行を開始しました。履歴画面で確認できます。`
        }])
      }
    } catch (error) {
      setTaskEditChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ テスト実行に失敗しました: ${error.message}`
      }])
    }
  }

  const handleSendMessage = async () => {
    if ((!chatInput.trim() && !attachedFile) || isChatLoading) return
    
    const userMessage = chatInput.trim()
    const currentAttachedFile = attachedFile
    setChatInput('')
    setAttachedFile(null)
    setIsChatLoading(true)
    
    // 承認系キーワードをチェック（pendingActionsがある場合は自動実行）
    const approvalKeywords = [
      /^(進めて|すすめて|作成して|作って|実行して|OK|オッケー|おっけー|はい|うん|お願い|よろしく|それで|いいよ|いいです|あっています|合っています|問題ない|大丈夫|了解|りょうかい|承認|確定|決定|go|yes|create|execute)/i,
      /^(この内容で|その内容で|それで)(進めて|作成|実行|OK|お願い)/i,
    ]
    
    // 強制作成キーワード（検証スキップ）
    const forceCreateKeywords = /^(強制作成|強制で作成|そのまま作成|検証スキップ|force|skip)/i
    
    const isApproval = approvalKeywords.some(pattern => pattern.test(userMessage))
    const isForceCreate = forceCreateKeywords.test(userMessage)
    
    if ((isApproval || isForceCreate) && pendingActions) {
      // ユーザーメッセージを追加
      setChatHistory(prev => [...prev, {
        role: 'user',
        content: userMessage
      }])
      
      if (isForceCreate) {
        // 強制作成: 検証スキップで直接実行
        await handleExecuteActions(true, false)
      } else {
        // 通常承認: 検証付きで実行
        await handleExecuteActionsWithValidation()
      }
      return
    }
    
    setPendingActions(null)
    
    // チャット応答内で保存された認証情報をUIに反映する
    const handleSavedCredentials = async (saved) => {
      if (saved && saved.length > 0) {
        await fetchCredentials()
        await fetchStatus()
        setToastMessage('認証情報を更新しました')
        setTimeout(() => setToastMessage(null), 4000)
      }
    }

    // 添付ファイルがある場合の処理
    if (currentAttachedFile) {
      // ユーザーメッセージを追加（画像プレビュー付き）
      setChatHistory(prev => [...prev, {
        role: 'user',
        content: userMessage || `${currentAttachedFile.type === 'image' ? '画像' : currentAttachedFile.type === 'video' ? '動画' : 'ファイル'}を添付しました`,
        image: currentAttachedFile.type === 'image' ? currentAttachedFile.preview : null,
        video: currentAttachedFile.type === 'video' ? currentAttachedFile.file.name : null,
        file: currentAttachedFile.type === 'file' ? currentAttachedFile.file.name : null
      }])
      
      try {
        if (currentAttachedFile.type === 'video') {
          // 動画分析
          const response = await projectsApi.analyzeVideo(project.id, currentAttachedFile.file, userMessage)
          const analysis = response.data.analysis
          
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `動画を確認しました。\n\n概要: ${analysis.summary || '動画を分析中...'}\n\n${userMessage ? 'ご要望を踏まえて' : ''}自動化の提案をさせていただきます。\n\n自動化候補:\n${(analysis.automation_candidates || []).map(c => `- ${c}`).join('\n')}\n\n提案されたタスク:\n${(analysis.suggested_tasks || []).map(t => `- ${t.name}: ${t.description}`).join('\n')}\n\nこの方向で進めてよろしいですか？`
          }])
          setVideoAnalysis(analysis)
        } else if (currentAttachedFile.type === 'image') {
          // 画像の場合
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `画像を確認しました。${userMessage ? '\n\nご要望：' + userMessage + '\n\n' : ''}この画像を参考に、どのような自動化を作成しますか？`
          }])
        } else {
          // その他ファイル
          const response = await projectsApi.analyzeFile(project.id, currentAttachedFile.file, userMessage)
          const analysis = response.data || {}
          const fileInfo = analysis.file || {}
          
          const intentText = (analysis.intent_hints || []).length > 0
            ? `意図の推測: ${(analysis.intent_hints || []).join(' / ')}\n`
            : ''
          const snippetText = analysis.text_preview && typeof analysis.text_preview === 'string'
            ? analysis.text_preview.slice(0, 600)
            : ''
          const snippet = snippetText
            ? `内容の抜粋:\n${snippetText}${analysis.text_preview && analysis.text_preview.length > 600 ? '...' : ''}`
            : ''
          
          const assistantText = `ファイルを確認しました。\n\n種類: ${fileInfo.kind || fileInfo.mime || '不明'}\nサイズ: ${formatBytes(fileInfo.size_bytes)}\n${analysis.summary ? `概要: ${analysis.summary}\n` : ''}${intentText}${snippet ? `\n${snippet}` : ''}\n${userMessage ? '\nご要望：' + userMessage + '\n' : ''}この内容を踏まえて、どのような自動化を進めますか？`
          
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: assistantText
          }])
        }
      } catch (error) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `ファイルを受け取りました。${userMessage ? '\n\nご要望：' + userMessage + '\n\n' : ''}この内容を参考に、どのような自動化を作成しますか？`
        }])
      }
      
      setIsChatLoading(false)
      return
    }
    
    // Webリサーチリクエストをチェック
    const webSearchMatch = userMessage.match(/(?:検索|調べて|リサーチ)[：:]\s*(.+)/i) || 
                           userMessage.match(/(?:search|research)[：:]\s*(.+)/i)
    
    // ワークフロー解説のリクエストをチェック
    const explanationMatch = userMessage.match(/^(?:ワークフロー|workflow)(?:の)?(?:解説|説明|explanation)/i) ||
                             userMessage === t('taskBoard.explainWorkflow')
    
    try {
      // ワークフロー解説の場合
      if (explanationMatch) {
        setChatHistory(prev => [...prev, {
          role: 'user',
          content: userMessage
        }])
        
        setIsChatLoading(true)
        try {
          const response = await projectsApi.getWorkflowExplanation(project.id)
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: response.data.explanation
          }])
        } catch (error) {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `エラーが発生しました: ${error.message}`
          }])
        }
        setIsChatLoading(false)
        return
      }

      // Webリサーチが必要な場合
      if (webSearchMatch) {
        const searchQuery = webSearchMatch[1]
        setChatHistory(prev => [...prev, {
          role: 'user',
          content: userMessage
        }])
        
        const searchResponse = await projectsApi.webSearch(project.id, searchQuery)
        const results = searchResponse.data.results
        
        setWebResearchResults(results)
        
        const resultsText = results.map((r, i) => 
          `${i + 1}. ${r.title}\n   ${r.snippet || r.content?.slice(0, 200) || ''}\n   ${r.url ? r.url : ''}`
        ).join('\n\n')
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `Webリサーチ結果:\n\n${resultsText}\n\nこの情報を基にワークフローを提案しましょうか？`
        }])
        
        setIsChatLoading(false)
        return
      }
      
      // プロジェクトのタスク数をチェックしてウィザードモードかどうか判断
      const projectTasks = boardData?.projects?.find(p => p.id === project.id)?.tasks || []
      const isWizardMode = projectTasks.length === 0
      
      if (isWizardMode) {
        // ウィザードモード（空プロジェクト用）
        let response
        try {
          response = await projectsApi.wizardChat(
            project.id, 
            userMessage, 
            chatHistory,
            videoAnalysis,
            webResearchResults,
            selectedModel
          )
        } catch (error) {
          const apiMsg = error?.response?.data?.error?.message || error?.message || '不明なエラー'
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `❌ ウィザードチャットに失敗しました。\n${apiMsg}\n\nAnthropic残高不足やAPIキー設定を確認してください。OpenAIキーを設定すると自動でそちらに切り替えます。`
          }])
          setIsChatLoading(false)
          return
        }
        
        // Webリサーチリクエストがあれば実行
        if (response.data.web_search_request) {
          setChatHistory(response.data.chat_history || [])
          const { query, reason } = response.data.web_search_request
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `🔍 Webリサーチを実行中: ${reason || query}`
          }])
          
          const searchResponse = await projectsApi.webSearch(project.id, query)
          setWebResearchResults(searchResponse.data.results)
          
          // リサーチ結果を含めて再度チャット
          let followUp
          try {
            followUp = await projectsApi.wizardChat(
              project.id,
              `リサーチ結果を確認しました。続けてください。`,
              response.data.chat_history,
              videoAnalysis,
              searchResponse.data.results,
              selectedModel
            )
          } catch (error) {
            const apiMsg = error?.response?.data?.error?.message || error?.message || '不明なエラー'
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: `❌ ウィザードチャット（リサーチ後）に失敗しました。\n${apiMsg}\n\nAnthropic残高不足やAPIキー設定を確認してください。OpenAIキーを設定すると自動でそちらに切り替えます。`
            }])
            setIsChatLoading(false)
            return
          }
          if (followUp.data.actions?.actions) {
            // JSONアクションがある場合は確認ボタンを表示
            const actions = followUp.data.actions.actions
            // チャット履歴からJSONを除去して表示
            const cleanedHistory = (followUp.data.chat_history || []).map(msg => {
              if (msg.role === 'assistant') {
                let content = msg.content
                if (content.includes('```json')) {
                  const jsonStart = content.indexOf('```json')
                  const jsonEnd = content.indexOf('```', jsonStart + 7)
                  if (jsonStart !== -1 && jsonEnd !== -1) {
                    const beforeJson = content.slice(0, jsonStart).trim()
                    const afterJson = content.slice(jsonEnd + 3).trim()
                    content = beforeJson + (afterJson ? '\n\n' + afterJson : '')
                  }
                }
                const jsonMatch = content.match(/\{\s*"actions"\s*:/s)
                if (jsonMatch) {
                  const jsonStartIdx = content.indexOf(jsonMatch[0])
                  content = content.slice(0, jsonStartIdx).trim()
                }
                return { ...msg, content: content || 'タスクを作成する準備ができました。' }
              }
              return msg
            })
            setChatHistory(cleanedHistory)
            await handleSavedCredentials(followUp.data.saved_api_keys)
            
            // 確認ボタン用にpendingActionsを設定
            setPendingActions(actions)
            setCreatingInfo(followUp.data.actions.creating_info || null)
          } else {
          const history = followUp.data.chat_history || []
          const extracted = extractActionsFromHistory(history)
          setChatHistory(extracted.actions ? extracted.cleanedHistory : history)
          await handleSavedCredentials(followUp.data.saved_api_keys)
          if (extracted.actions) {
            setPendingActions(extracted.actions)
            setCreatingInfo(extracted.creatingInfo || null)
          }
          }
        } else if (response.data.actions?.actions) {
          // JSONアクションがある場合は確認ボタンを表示
          const actions = response.data.actions.actions
          // チャット履歴からJSONを除去して表示
          const cleanedHistory = (response.data.chat_history || []).map(msg => {
            if (msg.role === 'assistant') {
              let content = msg.content
              // ```json ブロックを除去
              if (content.includes('```json')) {
                const jsonStart = content.indexOf('```json')
                const jsonEnd = content.indexOf('```', jsonStart + 7)
                if (jsonStart !== -1 && jsonEnd !== -1) {
                  const beforeJson = content.slice(0, jsonStart).trim()
                  const afterJson = content.slice(jsonEnd + 3).trim()
                  content = beforeJson + (afterJson ? '\n\n' + afterJson : '')
                }
              }
              // { で始まるJSONオブジェクトを除去
              const jsonMatch = content.match(/\{\s*"actions"\s*:/s)
              if (jsonMatch) {
                const jsonStartIdx = content.indexOf(jsonMatch[0])
                content = content.slice(0, jsonStartIdx).trim()
              }
              return { ...msg, content: content || 'タスクを作成する準備ができました。' }
            }
            return msg
          })
          setChatHistory(cleanedHistory)
          
          // 確認ボタン用にpendingActionsを設定
          setPendingActions(actions)
          setCreatingInfo(response.data.actions.creating_info || null)
        } else {
          // actionsがない場合でも、メッセージ内のJSONから抽出を試みる
          const history = response.data.chat_history || []
          const extracted = extractActionsFromHistory(history)
          setChatHistory(extracted.actions ? extracted.cleanedHistory : history)
          if (extracted.actions) {
            setPendingActions(extracted.actions)
            setCreatingInfo(extracted.creatingInfo || null)
          }
        }
        
        await handleSavedCredentials(response.data.saved_api_keys)
      } else {
        // 通常モード（既存タスクがあるプロジェクト）
        let response
        try {
          response = await projectsApi.chat(project.id, userMessage, chatHistory, selectedModel)
        } catch (error) {
          const apiMsg = error?.response?.data?.error || error?.response?.data?.detail || error?.message || '不明なエラー'
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `❌ チャットAPIエラーが発生しました。\n\n${apiMsg}\n\n考えられる原因:\n- Anthropic APIキーの残高不足\n- APIキーが無効\n- ネットワークエラー\n\n設定画面でAPIキーを確認してください。`
          }])
          setIsChatLoading(false)
          return
        }
        
        if (response.data.actions?.actions) {
          // JSONアクションがある場合は確認ボタンを表示
          const actions = response.data.actions.actions
          // チャット履歴からJSONを除去して表示
          const cleanedHistory = (response.data.chat_history || []).map(msg => {
            if (msg.role === 'assistant') {
              let content = msg.content
              // ```json ブロックを除去
              if (content.includes('```json')) {
                const jsonStart = content.indexOf('```json')
                const jsonEnd = content.indexOf('```', jsonStart + 7)
                if (jsonStart !== -1 && jsonEnd !== -1) {
                  const beforeJson = content.slice(0, jsonStart).trim()
                  const afterJson = content.slice(jsonEnd + 3).trim()
                  content = beforeJson + (afterJson ? '\n\n' + afterJson : '')
                }
              }
              // { で始まるJSONオブジェクトを除去
              const jsonMatch = content.match(/\{\s*"actions"\s*:/s)
              if (jsonMatch) {
                const jsonStartIdx = content.indexOf(jsonMatch[0])
                content = content.slice(0, jsonStartIdx).trim()
              }
              return { ...msg, content: content || 'タスクを作成する準備ができました。' }
            }
            return msg
          })
          setChatHistory(cleanedHistory)
          await handleSavedCredentials(response.data.saved_api_keys)
          
          // 確認ボタン用にpendingActionsを設定
          setPendingActions(actions)
          setCreatingInfo(response.data.actions.creating_info || null)
        } else {
          const history = response.data.chat_history || []
          const extracted = extractActionsFromHistory(history)
          setChatHistory(extracted.actions ? extracted.cleanedHistory : history)
          await handleSavedCredentials(response.data.saved_api_keys)
          if (extracted.actions) {
            setPendingActions(extracted.actions)
            setCreatingInfo(extracted.creatingInfo || null)
          } else {
            // JSONが抽出できなかった場合でも、最後のメッセージにJSONが含まれている可能性がある
            const lastMessage = history[history.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              const lastExtracted = extractActionsFromHistory([lastMessage])
              if (lastExtracted.actions) {
                setPendingActions(lastExtracted.actions)
                setCreatingInfo(lastExtracted.creatingInfo || null)
                // 最後のメッセージをクリーンアップ
                setChatHistory(prev => {
                  const newHistory = [...prev]
                  if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'assistant') {
                    newHistory[newHistory.length - 1] = {
                      ...newHistory[newHistory.length - 1],
                      content: lastExtracted.cleanedHistory[0]?.content || 'タスクを作成する準備ができました。下のボタンをクリックして作成してください。'
                    }
                  }
                  return newHistory
                })
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      
      // バックエンドからのエラー内容をできるだけ表示する
      const status = error.response?.status
      const data = error.response?.data
      const detail =
        (data && typeof data === 'object' && (data.response || data.error || data.detail || data.message)) ||
        (typeof data === 'string' ? data : '')
      const serializedData =
        !detail && data && typeof data === 'object' ? JSON.stringify(data, null, 2) : null
      
      const errorLines = [
        '❌ エラーが発生しました',
        '',
        detail ? `詳細: ${detail}` : '',
        serializedData ? `レスポンス:\n\`\`\`json\n${serializedData}\n\`\`\`` : '',
        status ? `HTTPステータス: ${status}` : '',
        '',
        '考えられる原因:',
        '- Anthropic APIキーの残高不足または無効なキー',
        '- ネットワークエラー',
        '- サーバーの一時的な問題',
        '',
        '対処法:',
        '1. 設定画面でAPIキーを確認',
        '2. Anthropicのダッシュボードで残高を確認',
        '3. ページをリロードして再試行'
      ]
      
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: errorLines.filter(Boolean).join('\n')
      }])
    } finally {
    
    setIsChatLoading(false)
  }
  
  // 事前検証（認証情報チェック + AIレビュー）
  const handlePreValidate = async () => {
    if (!pendingActions) return
    
    setIsChatLoading(true)
    setValidationResult(null)
    
    const actions = pendingActions.actions || pendingActions
    const createActions = actions.filter(a => a.type === 'create_task')
    
    if (createActions.length === 0) {
      // タスク作成がない場合は通常実行
      handleExecuteActions(false, false)
      return
    }
    
    try {
      const taskData = createActions[0].data
      
      // 1. 認証情報チェック
      const credCheck = await projectsApi.checkCredentials(
        project.id,
        taskData.task_prompt || '',
        taskData.execution_location || 'server'
      )
      
      // 2. AIレビュー
      const review = await projectsApi.reviewTaskPrompt(
        project.id,
        taskData.task_prompt || '',
        taskData.name || ''
      )
      
      const result = {
        credentials: credCheck.data,
        review: review.data
      }
      setValidationResult(result)
      
      // 結果をチャットに表示
      let validationMessage = '【タスク検証結果】\n\n'
      
      // 認証情報
      if (result.credentials.registered?.length > 0) {
        validationMessage += `✓ 登録済み認証情報: ${result.credentials.registered.join(', ')}\n`
      }
      if (result.credentials.missing?.length > 0) {
        validationMessage += `✗ 不足: ${result.credentials.missing.map(m => m.message).join('\n  ')}\n`
      }
      if (result.credentials.warnings?.length > 0) {
        validationMessage += `⚠ 注意: ${result.credentials.warnings.map(w => w.message).join('\n  ')}\n`
      }
      
      validationMessage += '\n'
      
      // AIレビュー
      if (result.review.reviewed) {
        validationMessage += `【AI品質レビュー】\n`
        validationMessage += `スコア: ${result.review.score}/10\n`
        validationMessage += `実行可能: ${result.review.is_executable ? 'はい' : 'いいえ'}\n`
        
        if (result.review.issues?.length > 0) {
          validationMessage += `問題点:\n${result.review.issues.map(i => `  - ${i}`).join('\n')}\n`
        }
        if (result.review.suggestions?.length > 0) {
          validationMessage += `改善案:\n${result.review.suggestions.map(s => `  - ${s}`).join('\n')}\n`
        }
      }
      
      // 検証結果に基づいて推奨アクションを表示
      const isReady = result.credentials.is_ready && 
                      (!result.review.reviewed || result.review.score >= 5)
      
      if (isReady) {
        validationMessage += '\n検証OK！「作成」または「テスト実行付きで作成」を選択してください。'
        setShowTestOption(true)
      } else {
        validationMessage += '\n問題があります。内容を修正してから再度お試しください。'
        
        // 改善されたプロンプトがあれば提案
        if (result.review.improved_prompt) {
          validationMessage += `\n\n【改善案】\n${result.review.improved_prompt}`
        }
      }
      
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: validationMessage
      }])
      
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `検証中にエラーが発生しました: ${error.message}`
      }])
    }
    
    setIsChatLoading(false)
  }
  
  const handleExecuteActions = async (skipReview = false, autoRunTest = false) => {
    if (!pendingActions) return
    
    setIsChatLoading(true)
    setShowTestOption(false)
    setWorkflowStep('creating')
    
    // 作成情報があれば設定
    if (pendingActions.creating_info) {
      setCreatingInfo(pendingActions.creating_info)
    }
    
    try {
      const actions = pendingActions.actions || pendingActions
      const createActions = actions.filter(a => a.type === 'create_task')
      
      // タスク作成がある場合は検証付き作成APIを使用
      if (createActions.length > 0 && !skipReview) {
        const taskData = createActions[0].data
        const response = await projectsApi.validateAndCreateTask(
          project.id,
          taskData,
          true, // skipReview（既に検証済み）
          autoRunTest  // autoRunTest: 作成と同時にテスト実行
        )
        
        // 即座にタスクボードを更新
        onRefresh()
        
        if (!response.data.success) {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `タスク作成に失敗しました: ${response.data.error}\n\n${response.data.suggestions?.join('\n') || ''}`
          }])
          setPendingActions(null)
          setCreatingInfo(null)
          setValidationResult(null)
          setWorkflowStep(null)
          setIsChatLoading(false)
          return
        }
        
        const task = response.data.task
        const createdTaskInfo = [task]
        setCreatedTasks(prev => [...prev, ...createdTaskInfo])
        addCreatedTasks(project.id, createdTaskInfo)
        setExpandedTaskId(task.id) // 新しく作成されたタスクを展開
        
        // 通知を表示
        notifySuccess('タスク作成完了', `「${task.name}」を作成しました`)
        
        let successMessage = `✅ タスクを作成しました！\n\n`
        
        if (autoRunTest && response.data.validation?.test_execution) {
          successMessage += `🚀 テスト実行を開始しました（実行ID: ${response.data.validation.test_execution.execution_id}）\n\n`
          const execId = response.data.validation.test_execution.execution_id
          testMonitorRef.current = { executionId: execId, taskName: task.name }
          pollTestExecution(execId, task.name)
          setWorkflowStep('testing')
          notifyInfo('テスト実行開始', '結果をお待ちください...')
        } else {
          successMessage += `下のタスクカードから「テスト実行」や「編集」ができます。\n\n`
          setWorkflowStep('completed')
        }
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage,
          createdTasks: createdTaskInfo
        }])
        
        setPendingActions(null)
        setCreatingInfo(null)
        setValidationResult(null)
        setIsChatLoading(false)
        return
      }
      
      // タスク作成以外のアクション（編集、削除など）
      const response = await projectsApi.executeActions(project.id, actions)
      
      // 即座にタスクボードを更新
      onRefresh()
      
      // バリデーションエラーのチェック
      const failedResults = (response.data.results || []).filter(r => !r.success)
      if (failedResults.length > 0) {
        const errorMessages = failedResults.map(r => `- ${r.error || '不明なエラー'}`).join('\n')
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `一部のアクションでエラーが発生しました:\n\n${errorMessages}\n\n内容を確認して、再度お試しください。`
        }])
        setPendingActions(null)
        setCreatingInfo(null)
        setValidationResult(null)
        setIsChatLoading(false)
        return
      }
      
      // 作成されたタスクの情報を取得
      const createdTaskInfo = response.data.created_tasks || []
      if (createdTaskInfo.length > 0) {
        setCreatedTasks(prev => [...prev, ...createdTaskInfo])
        addCreatedTasks(project.id, createdTaskInfo) // ストアにも保存
      }
      
      // 成功メッセージを追加（タスク詳細付き）
      let successMessage = `タスクを作成しました。\n\n`
      
      if (createdTaskInfo.length > 0) {
        createdTaskInfo.forEach(task => {
          successMessage += `【作成されたタスク】\n`
          successMessage += `名前: ${task.name}\n`
          successMessage += `説明: ${task.description || 'なし'}\n`
          successMessage += `実行場所: ${task.execution_location === 'server' ? 'サーバー' : 'ローカル'}\n`
          successMessage += `スケジュール: ${task.schedule || '手動実行'}\n\n`
        })
        
        // 作成情報があれば次のタスクについて確認
        if (pendingActions.creating_info) {
          const info = pendingActions.creating_info
          if (info.current < info.total) {
            successMessage += `(${info.current}/${info.total}個目を作成しました)\n\n次のタスクに進みますか？`
          } else {
            successMessage += `すべてのタスク(${info.total}個)の作成が完了しました。\n\nタスクボードで確認できます。`
          }
        }
      } else {
        successMessage += response.data.message || 'アクションを実行しました。'
      }
      
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: successMessage,
        createdTasks: createdTaskInfo // タスク情報を保存
      }])
      
      setPendingActions(null)
      setCreatingInfo(null)
      setValidationResult(null)
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `アクションの実行に失敗しました: ${error.message}`
      }])
      setCreatingInfo(null)
      setValidationResult(null)
    }
    setIsChatLoading(false)
  }

  // AIがアクションを返したときの自動実行
  const autoExecuteActions = async (actions, creatingInfo) => {
    if (!actions || actions.length === 0) {
      setIsChatLoading(false)
      return
    }
    
    const createActions = actions.filter(a => a.type === 'create_task')
    
    // タスク作成がある場合は事前検証を実行
    if (createActions.length > 0) {
      try {
        const taskData = createActions[0].data
        
        // 検証中メッセージ
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: '🔍 タスクを検証中...'
        }])
        
        // 1. 認証情報チェック
        const credCheck = await projectsApi.checkCredentials(
          project.id,
          taskData.task_prompt || '',
          taskData.execution_location || 'server'
        )
        
        // 2. AIレビュー
        const review = await projectsApi.reviewTaskPrompt(
          project.id,
          taskData.task_prompt || '',
          taskData.name || ''
        )
        
        const hasCredentialIssues = credCheck.data.missing?.length > 0
        const hasQualityIssues = review.data.reviewed && review.data.score < 6
        
        // 問題がある場合は改善案を提示
        if (hasCredentialIssues || hasQualityIssues) {
          let issueMessage = '⚠️ 検証で問題が見つかりました。\n\n'
          
          if (hasCredentialIssues) {
            issueMessage += '📌 認証情報の不足\n\n'
            credCheck.data.missing.forEach(m => {
              issueMessage += `・${m.message}\n`
            })
            issueMessage += '\n'
          }
          
          if (hasQualityIssues) {
            issueMessage += `📌 タスク品質スコア: ${review.data.score}/10\n\n`
            if (review.data.issues?.length > 0) {
              issueMessage += '問題点:\n'
              review.data.issues.forEach(issue => {
                issueMessage += `・${issue}\n`
              })
              issueMessage += '\n'
            }
            if (review.data.suggestions?.length > 0) {
              issueMessage += '改善案:\n'
              review.data.suggestions.forEach(s => {
                issueMessage += `・${s}\n`
              })
              issueMessage += '\n'
            }
          }
          
          issueMessage += '\n🔧 修正してから「進めて」と言っていただくか、このまま作成する場合は「強制作成」と言ってください。'
          
          // 検証中メッセージを削除して問題メッセージを追加
          setChatHistory(prev => {
            const filtered = prev.filter(msg => msg.content !== '🔍 タスクを検証中...')
            return [...filtered, {
              role: 'assistant',
              content: issueMessage
            }]
          })
          
          // pendingActionsを保持（ユーザーが「強制作成」と言えるように）
          setPendingActions(actions)
          setIsChatLoading(false)
          return
        }
        
        // 検証中メッセージを削除
        setChatHistory(prev => prev.filter(msg => msg.content !== '🔍 タスクを検証中...'))
        
      } catch (error) {
        console.error('Validation error:', error)
        // 検証エラーでも作成は続行
        setChatHistory(prev => prev.filter(msg => msg.content !== '🔍 タスクを検証中...'))
      }
    }
    
    // 検証OKまたはタスク作成以外のアクション → 実際に作成
    if (creatingInfo) {
      setCreatingInfo(creatingInfo)
    }
    
    try {
      const createActions = actions.filter(a => a.type === 'create_task')
      
      if (createActions.length > 0) {
        const taskData = createActions[0].data
        const response = await projectsApi.validateAndCreateTask(
          project.id,
          taskData,
          true, // skipReview
          false // autoRunTest
        )
        
        // 即座にタスクボードを更新
        onRefresh()
        
        if (!response.data.success) {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `❌ タスク作成に失敗しました: ${response.data.error}\n\n${response.data.suggestions?.join('\n') || ''}`
          }])
          setPendingActions(null)
          setCreatingInfo(null)
          setIsChatLoading(false)
          return
        }
        
        const task = response.data.task
        const createdTaskInfo = [task]
        setCreatedTasks(prev => [...prev, ...createdTaskInfo])
        addCreatedTasks(project.id, createdTaskInfo)
        
        let successMessage = `✅ タスクを作成しました！\n\n`
        successMessage += `📋 タスク名: ${task.name}\n`
        successMessage += `📝 説明: ${task.description || 'なし'}\n`
        successMessage += `🖥️ 実行場所: ${task.execution_location === 'server' ? 'サーバー' : 'ローカル'}\n`
        successMessage += `⏰ スケジュール: ${task.schedule || '手動実行'}\n\n`
        successMessage += `タスクボードで確認・編集できます。テスト実行しますか？`
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage,
          createdTasks: createdTaskInfo
        }])

        // テスト実行IDがあればログ監視を開始
        const testExecId = response.data.validation?.test_execution?.execution_id
        if (testExecId) {
          monitorExecution(testExecId, 'テスト実行')
        }
      } else {
        // タスク作成以外のアクション
        const response = await projectsApi.executeActions(project.id, actions)
        onRefresh()
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `✅ アクションを実行しました。`
        }])
      }
      
      setPendingActions(null)
      setCreatingInfo(null)
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ 実行に失敗しました: ${error.message}`
      }])
      setCreatingInfo(null)
    }
    setIsChatLoading(false)
  }

  // 承認時の自動実行（検証付き）
  const handleExecuteActionsWithValidation = async () => {
    if (!pendingActions) {
      setIsChatLoading(false)
      return
    }
    
    const actions = pendingActions.actions || pendingActions
    const createActions = actions.filter(a => a.type === 'create_task')
    
    // タスク作成がある場合は事前検証を実行
    if (createActions.length > 0) {
      try {
        const taskData = createActions[0].data
        
        // 検証中メッセージ
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: '🔍 タスクを検証中...'
        }])
        
        // 1. 認証情報チェック
        const credCheck = await projectsApi.checkCredentials(
          project.id,
          taskData.task_prompt || '',
          taskData.execution_location || 'server'
        )
        
        // 2. AIレビュー
        const review = await projectsApi.reviewTaskPrompt(
          project.id,
          taskData.task_prompt || '',
          taskData.name || ''
        )
        
        const hasCredentialIssues = credCheck.data.missing?.length > 0
        const hasQualityIssues = review.data.reviewed && review.data.score < 6
        
        // 問題がある場合は改善案を提示
        if (hasCredentialIssues || hasQualityIssues) {
          let issueMessage = '⚠️ 検証で問題が見つかりました。\n\n'
          
          if (hasCredentialIssues) {
            issueMessage += '📌 認証情報の不足\n\n'
            credCheck.data.missing.forEach(m => {
              issueMessage += `・${m.message}\n`
            })
            issueMessage += '\n'
          }
          
          if (hasQualityIssues) {
            issueMessage += `📌 タスク品質スコア: ${review.data.score}/10\n\n`
            if (review.data.issues?.length > 0) {
              issueMessage += '問題点:\n'
              review.data.issues.forEach(issue => {
                issueMessage += `・${issue}\n`
              })
              issueMessage += '\n'
            }
            if (review.data.suggestions?.length > 0) {
              issueMessage += '改善案:\n'
              review.data.suggestions.forEach(s => {
                issueMessage += `・${s}\n`
              })
              issueMessage += '\n'
            }
          }
          
          issueMessage += '\n🔧 上記を修正してから再度「進めて」と言っていただくか、このまま作成する場合は「強制作成」と言ってください。'
          
          // 検証中メッセージを削除して問題メッセージを追加
          setChatHistory(prev => {
            const filtered = prev.filter(msg => msg.content !== '🔍 タスクを検証中...')
            return [...filtered, {
              role: 'assistant',
              content: issueMessage
            }]
          })
          
          setIsChatLoading(false)
          return
        }
        
        // 検証中メッセージを削除
        setChatHistory(prev => prev.filter(msg => msg.content !== '🔍 タスクを検証中...'))
        
      } catch (error) {
        console.error('Validation error:', error)
        // 検証エラーでも作成は続行
        setChatHistory(prev => prev.filter(msg => msg.content !== '🔍 タスクを検証中...'))
      }
    }
    
    // 検証OKまたはタスク作成以外のアクション → 実行
    await handleExecuteActions(true, false)
  }

  // テスト実行をポーリングして失敗理由をチャットに連携
  const pollTestExecution = async (executionId, taskName) => {
    try {
      const execRes = await executionsApi.get(executionId)
      const execData = execRes.data || {}
      const statusValue = execData.status || execData.execution?.status

      // 実行中は再ポーリング
      if (!statusValue || ['running', 'pending', 'paused', 'starting'].includes(statusValue)) {
        testMonitorTimerRef.current = setTimeout(() => pollTestExecution(executionId, taskName), 5000)
        return
      }

      // 失敗時はログを取得して要約
      let errorHint = ''
      if (statusValue === 'failed') {
        try {
          const logsRes = await executionsApi.getLogs(executionId)
          const logsList = logsRes.data?.logs || logsRes.data || []
          const lastError = [...logsList].reverse().find(l => (l.level || '').toUpperCase() === 'ERROR')
          if (lastError) {
            errorHint = lastError.message || lastError.text || JSON.stringify(lastError)
          } else if (logsList.length > 0) {
            const tail = logsList[logsList.length - 1]
            errorHint = tail.message || tail.text || JSON.stringify(tail)
          }
        } catch (logErr) {
          errorHint = `ログ取得に失敗しました: ${logErr.message}`
        }
      }

      let message = `テスト実行（ID: ${executionId}）が${statusValue === 'completed' ? '完了' : '失敗'}しました。\nタスク: ${taskName || '不明'}`
      if (statusValue === 'failed') {
        message += errorHint ? `\n\n推定エラー: ${errorHint}` : '\n\n推定エラー: 取得できませんでした'
        message += `\n\nよくある対処案:\n- 認証情報や権限の不足を確認\n- 画面要素/セレクタの変更有無を確認\n- 入力値や前提データの有無を確認\n\n修正案を提案しましょうか？`
      } else {
        message += `\n\n結果を踏まえて次のステップを決めましょう。`
      }

      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: message
      }])

      testMonitorRef.current = null
      if (testMonitorTimerRef.current) {
        clearTimeout(testMonitorTimerRef.current)
      }
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `テスト結果の確認に失敗しました: ${error.message}`
      }])
      testMonitorRef.current = null
      if (testMonitorTimerRef.current) {
        clearTimeout(testMonitorTimerRef.current)
      }
    }
  }
  
  // タスクを実行
  const handleRunTask = async (taskId) => {
    try {
      const res = await tasksApi.run(taskId)
      // 実行IDは必ず数値で扱う。status(pending)は誤りなので使わない
      let execId = res.data?.execution_id || res.data?.executionId || res.data?.execution?.id
      // 返却されなかった場合は直近のexecutionを取得して補完
      if (!execId) {
        try {
          const execList = await executionsApi.getAll({ task_id: taskId, limit: 1 })
          execId = execList.data?.[0]?.id
        } catch (_) {
          // 補完できなくても続行
        }
      }

      // チャットに開始メッセージ
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: execId
          ? `タスクの実行を開始しました（実行ID: ${execId}）。このチャット内でも進捗をモニタリングします。`
          : `タスクの実行を開始しました。履歴画面で進捗を確認できます。`
      }])

      // 実行IDがあればポーリングして結果を通知
      if (execId) {
        monitorExecution(execId, '手動実行', taskId)
      }
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `タスクの実行に失敗しました: ${error.message}`
      }])
    }
  }
  
  const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null) return '不明'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
  }
  
  // メッセージ内のJSONブロックをパース
  const parseMessage = (content) => {
    const parts = []
    let lastIndex = 0
    const jsonRegex = /```json\n([\s\S]*?)```/g
    let match
    
    while ((match = jsonRegex.exec(content)) !== null) {
      // JSONの前のテキスト
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
      }
      
      // JSON部分
      try {
        const jsonData = JSON.parse(match[1])
        parts.push({ type: 'json', content: jsonData })
      } catch {
        parts.push({ type: 'code', content: match[1] })
      }
      
      lastIndex = match.index + match[0].length
    }
    
    // 残りのテキスト
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) })
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content }]
  }

  // チャット履歴から JSON の actions 定義を拾い、ボタン表示に利用する
  const extractActionsFromHistory = (history = []) => {
    let actions = null
    let creatingInfo = null

    const cleanedHistory = history.map((msg) => {
      if (msg.role !== 'assistant' || !msg.content) return msg

      let content = msg.content
      let found = false

      // 1) ```json ... ``` ブロックから抽出
      const blockRegex = /```json\s*([\s\S]*?)```/g
      let blockMatch
      while ((blockMatch = blockRegex.exec(content)) !== null) {
        try {
          const data = JSON.parse(blockMatch[1])
          if (data.actions && Array.isArray(data.actions)) {
            actions = data.actions
            creatingInfo = data.creating_info || data.creatingInfo || creatingInfo
            found = true
          }
        } catch (_) {
          // 解析できなければ無視
        }
      }

      // 2) インラインの { "actions": [...] } 形式から抽出（より柔軟なパターン）
      if (!found) {
        const inlineMatch = content.match(/\{\s*"actions"\s*:\s*\[[\s\S]*?\]\s*(?:,\s*"creating_info"\s*:\s*\{[\s\S]*?\}\s*)?\}/)
        if (inlineMatch) {
          try {
            const data = JSON.parse(inlineMatch[0])
            if (data.actions && Array.isArray(data.actions)) {
              actions = data.actions
              creatingInfo = data.creating_info || data.creatingInfo || creatingInfo
              found = true
            }
          } catch (_) {
            // 無視
          }
        }
      }

      // 3) メッセージ全体がJSONオブジェクトの場合
      if (!found) {
        try {
          const stripped = content.trim()
          if (stripped.startsWith('{') && stripped.endsWith('}')) {
            const data = JSON.parse(stripped)
            if (data.actions && Array.isArray(data.actions)) {
              actions = data.actions
              creatingInfo = data.creating_info || data.creatingInfo || creatingInfo
              found = true
            }
          }
        } catch (_) {
          // 無視
        }
      }

      // 抽出できた場合は、表示用に JSON 部分を取り除く
      if (found) {
        // ```json ... ``` を除去
        content = content.replace(/```json\s*[\s\S]*?```/g, '').trim()
        // actions を含む JSON オブジェクト部分を除去
        content = content.replace(/\{\s*"actions"\s*:\s*\[[\s\S]*?\]\s*(?:,\s*"creating_info"\s*:\s*\{[\s\S]*?\}\s*)?\}/g, '').trim()
        // メッセージ全体がJSONだった場合は、代わりにメッセージを表示
        if (!content || content.length < 10) {
          content = 'タスクを作成する準備ができました。下のボタンをクリックして作成してください。'
        }
      }

      return { ...msg, content }
    })

    return { actions, creatingInfo, cleanedHistory }
  }
  
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl z-50 flex flex-col transition-all duration-300 overflow-hidden w-full md:w-2/3"
    >
      {/* トースト */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 px-4 py-3 rounded-lg bg-emerald-100 text-emerald-700 shadow-md border border-emerald-200">
          {toastMessage}
        </div>
      )}

      {/* 長時間処理中の通知 */}
      {pendingNotice && (
        <div className="mx-4 mt-3 mb-0 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 flex items-start gap-3">
          <Loader2 className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-300 animate-spin" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {pendingNotice.message || '処理中です'}
            </div>
            {pendingNotice.subMessage && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                {pendingNotice.subMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5 shrink-0 backdrop-blur-sm">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${project.color}20` }}
        >
          <Bot className="w-5 h-5" style={{ color: project.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{t('taskBoard.aiAssistant')}</h3>
          <p className="text-xs text-muted-foreground truncate">{project.name}</p>
        </div>
        
        {/* AIモデル表示（固定: Claude Sonnet 4.5）*/}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-700 dark:text-orange-300 rounded-lg border border-orange-200/50 dark:border-orange-700/50">
          <Cpu className="w-3.5 h-3.5" />
          <span>Claude Sonnet 4.5</span>
        </div>
        
        <button
          onClick={() => {
            if (confirm('チャット履歴をクリアしますか？')) {
              clearChatHistory(project.id)
              setChatHistory([getInitialMessage()])
              setVideoAnalysis(null)
              setWebResearchResults(null)
              setCreatedTasks([])
              setPendingActions(null)
            }
          }}
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
      
      
      {/* タスク編集モードのオーバーレイ */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-white/98 dark:bg-zinc-900/98 backdrop-blur-sm z-10 flex flex-col"
          >
            {/* タスク編集ヘッダー */}
            <div className="flex items-center gap-3 p-4 border-b border-cyan-200 dark:border-cyan-800 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">タスク編集チャット</h3>
                <p className="text-xs text-muted-foreground truncate">{editingTask.name}</p>
              </div>
              <button
                onClick={closeTaskEdit}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* クイックアクション */}
            <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              <button
                onClick={() => handleTaskEditChat('このタスクの指示を改善してください')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full whitespace-nowrap hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                改善
              </button>
              <button
                onClick={() => handleTaskEditChat('スケジュールを変更したい')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full whitespace-nowrap hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                スケジュール
              </button>
              <button
                onClick={handleQuickTestRun}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full whitespace-nowrap hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                テスト実行
              </button>
              <button
                onClick={() => handleTaskEditChat('実行場所をサーバーに変更して')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                実行場所
              </button>
            </div>

            {/* タスク編集チャット履歴 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {taskEditChatHistory.map((msg, idx) => (
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
              {isChatLoading && (
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

              {/* タスク編集アクション実行ボタン */}
              {taskEditPendingActions && taskEditPendingActions.length > 0 && (
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-cyan-500" />
                    <span className="font-semibold text-foreground">変更の確認</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {taskEditPendingActions.length}件の変更を適用します
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTaskEditExecuteActions}
                      disabled={isChatLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      適用する
                    </button>
                    <button
                      onClick={() => setTaskEditPendingActions(null)}
                      className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* タスク編集入力フィールド */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="タスクの編集内容を入力..."
                  disabled={isChatLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleTaskEditChat(e.target.value)
                      e.target.value = ''
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.target.closest('.flex').querySelector('input')
                    if (input.value.trim()) {
                      handleTaskEditChat(input.value)
                      input.value = ''
                    }
                  }}
                  disabled={isChatLoading}
                  className="px-4 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                <span>💡 「指示を改善して」「スケジュールを変更」などと入力</span>
                <button
                  onClick={closeTaskEdit}
                  className="text-cyan-500 hover:text-cyan-700 font-medium"
                >
                  メインチャットに戻る
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ファイルアップロード用input（非表示） */}
      <div className="hidden">
        {/* 動画アップロード（添付用） */}
        <input
          id="video-upload-chat"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            
            setAttachedFile({
              file,
              type: 'video',
              preview: file.name
            })
            e.target.value = ''
          }}
        />
        {/* 画像アップロード（添付用） */}
        <input
          id="image-upload-chat"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            
            const reader = new FileReader()
            reader.onload = () => {
              setAttachedFile({
                file,
                type: 'image',
                preview: reader.result
              })
            }
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />
        {/* 汎用ファイルアップロード（添付用） */}
        <input
          id="file-upload-chat"
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            
            setAttachedFile({
              file,
              type: 'file',
              preview: file.name
            })
            e.target.value = ''
          }}
        />
      </div>

      {/* エラー分析と改善案カード */}
      {errorAnalysis && errorAnalysis.analysis && (
        <div className="mx-4 mb-3 p-4 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="font-bold text-lg text-foreground">エラー分析結果</div>
          </div>
          
          <div className="mb-4 space-y-3">
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">原因</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {errorAnalysis.analysis.error_analysis || errorAnalysis.analysis.root_cause || '不明'}
              </div>
            </div>
            
            {/* ユーザーに必要な情報 */}
            {errorAnalysis.analysis.user_info_needed && errorAnalysis.analysis.user_info_needed.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                <div className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  必要な設定・情報
                </div>
                {errorAnalysis.analysis.user_info_needed.map((info, idx) => (
                  <div key={idx} className="mb-3 last:mb-0">
                    <div className="font-medium text-foreground mb-1">{info.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">{info.description}</div>
                    <div className="text-xs text-muted-foreground mt-2 p-2 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                      <div className="font-semibold mb-1">設定方法:</div>
                      <div className="whitespace-pre-wrap">{info.how_to_set}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {errorAnalysis.analysis.suggestions && errorAnalysis.analysis.suggestions.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-foreground mb-2">改善案</div>
                {errorAnalysis.analysis.suggestions.map((suggestion, idx) => {
                  const isRecommended = idx === (errorAnalysis.analysis.recommended_action || 0)
                  return (
                    <div
                      key={idx}
                      className={`mb-3 p-3 rounded-lg border ${
                        isRecommended
                          ? 'border-emerald-300 dark:border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          suggestion.priority === 'high'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : suggestion.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}
                        </span>
                        {isRecommended && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            推奨
                          </span>
                        )}
                        <span className="font-semibold text-foreground">{suggestion.title}</span>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                        {suggestion.description}
                      </div>
                      
                      {/* 環境設定が必要な場合 */}
                      {suggestion.environment_setup && (
                        <div className="mb-3 p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                          <div className="text-xs font-semibold text-foreground mb-1">必要な環境設定:</div>
                          {suggestion.environment_setup.variables && suggestion.environment_setup.variables.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {suggestion.environment_setup.variables.map((v, vIdx) => (
                                <div key={vIdx} className="mb-1">
                                  • {v.name} = {v.value} ({v.description})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {errorAnalysis.analysis.auto_fixable && isRecommended && (
                        <button
                          onClick={async () => {
                            setIsChatLoading(true)
                            try {
                              // タスクを更新
                              const updateData = {
                                task_prompt: suggestion.improved_task_prompt
                              }
                              if (suggestion.additional_changes) {
                                Object.assign(updateData, suggestion.additional_changes)
                              }
                              
                              await tasksApi.update(errorAnalysis.taskId, updateData)
                              
                              setChatHistory(prev => [...prev, {
                                role: 'assistant',
                                content: `✅ 改善案を適用しました。タスクを更新して再実行します...`
                              }])
                              
                              // 再実行
                              const res = await tasksApi.run(errorAnalysis.taskId)
                              const execId = res.data?.execution_id || res.data?.status
                              
                              if (execId) {
                                monitorExecution(execId, '改善案適用後の再実行', errorAnalysis.taskId)
                              }
                              
                              // エラー分析をクリア
                              setErrorAnalysis(null)
                              setRetryTaskId(null)
                              setRetrySuggestion(null)
                            } catch (err) {
                              setChatHistory(prev => [...prev, {
                                role: 'assistant',
                                content: `改善案の適用に失敗しました: ${err.message}`
                              }])
                            } finally {
                              setIsChatLoading(false)
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-all"
                          disabled={isChatLoading}
                        >
                          ✓ この改善案を承認して自動修正・再実行
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap pt-2 border-t border-blue-200 dark:border-blue-800">
            <button
              onClick={() => handleRetryTask(errorAnalysis.taskId, false)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={isChatLoading}
            >
              この設定で再実行
            </button>
            <button
              onClick={() => {
                setErrorAnalysis(null)
                setRetryTaskId(null)
                setRetrySuggestion(null)
              }}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              disabled={isChatLoading}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 再実行カード（失敗時、エラー分析がない場合） */}
      {retryTaskId && !errorAnalysis && (
        <div className="mx-4 mb-3 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <div className="font-semibold text-foreground mb-2">実行が失敗しました。再実行しますか？</div>
          {retrySuggestion && (
            <div className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">
              提案: {retrySuggestion}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleRetryTask(retryTaskId, false)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={isChatLoading}
            >
              この設定で再実行
            </button>
            <button
              onClick={() => handleRetryTask(retryTaskId, true)}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
              disabled={isChatLoading}
            >
              提案どおり修正して再実行
            </button>
            <button
              onClick={() => {
                setRetryTaskId(null)
                setRetrySuggestion(null)
              }}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              disabled={isChatLoading}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* チャット履歴 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-500'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className="flex-1 max-w-[85%]">
              {/* 添付画像の表示 */}
              {msg.image && (
                <div className={`mb-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  <img 
                    src={msg.image} 
                    alt="添付画像" 
                    className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                  />
                </div>
              )}
              {/* 添付動画の表示 */}
              {msg.video && (
                <div className={`mb-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                    <Video className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">{msg.video}</span>
                  </div>
                </div>
              )}
              {/* 添付ファイルの表示 */}
              {msg.file && (
                <div className={`mb-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">{msg.file}</span>
                  </div>
                </div>
              )}
              <div className={`inline-block p-3 rounded-2xl text-sm text-left break-all ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
              }`}>
                {parseMessage(msg.content).map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <div key={i} className="whitespace-pre-wrap break-all">
                        {part.content.split('\n').map((line, j) => {
                          // マークダウン風の処理
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <p key={j} className="font-bold">{line.slice(2, -2)}</p>
                          }
                          if (line.startsWith('- ')) {
                            return <p key={j} className="pl-2">• {line.slice(2)}</p>
                          }
                          return <p key={j}>{line}</p>
                        })}
                      </div>
                    )
                  }
                  if (part.type === 'json' && part.content.actions) {
                    return (
                      <div key={i} className="mt-3 p-3 bg-zinc-200 dark:bg-zinc-700 rounded-lg">
                        <p className="text-xs font-semibold mb-2">{t('taskBoard.proposedActions')}:</p>
                        {part.content.actions.map((action, j) => (
                          <div key={j} className="text-xs flex items-center gap-2 py-1">
                            {action.type === 'update_task' && <Edit2 className="w-3 h-3 text-blue-500" />}
                            {action.type === 'create_task' && <Plus className="w-3 h-3 text-emerald-500" />}
                            {action.type === 'delete_task' && <Trash2 className="w-3 h-3 text-rose-500" />}
                            {action.type === 'create_trigger' && <Zap className="w-3 h-3 text-amber-500" />}
                            <span>{action.type}: {action.task_id || action.data?.name || ''}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return null
                })}
              </div>
              
              {/* 作成されたタスクのアクションボタン（改善版） */}
              {msg.createdTasks && msg.createdTasks.length > 0 && (
                <div className="mt-3 space-y-3">
                  {msg.createdTasks.map((task, taskIdx) => {
                    const isExpanded = expandedTaskId === task.id
                    return (
                      <div key={taskIdx} className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl overflow-hidden shadow-sm">
                        {/* タスクヘッダー */}
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-800/30 transition-colors"
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-200">{task.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  task.execution_location === 'server' 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' 
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                }`}>
                                  {task.execution_location === 'server' ? '🖥️ サーバー' : '💻 ローカル'}
                                </span>
                                {task.schedule && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-medium">
                                    ⏰ {task.schedule}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className={`w-5 h-5 text-emerald-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                        
                        {/* 展開時のアクションパネル */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-emerald-200 dark:border-emerald-700"
                            >
                              <div className="p-3 space-y-3">
                                {/* 詳細情報 */}
                                {task.description && (
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2">
                                    📝 {task.description}
                                  </div>
                                )}
                                
                                {/* アクションボタン */}
                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRunTask(task.id)
                                    }}
                                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                                  >
                                    <Play className="w-5 h-5" />
                                    <span className="text-xs font-medium">テスト実行</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      startTaskEdit(task)
                                    }}
                                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors shadow-sm"
                                  >
                                    <MessageSquare className="w-5 h-5" />
                                    <span className="text-xs font-medium">編集チャット</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // 詳細表示（task_promptを表示）
                                      setChatHistory(prev => [...prev, {
                                        role: 'assistant',
                                        content: `📋 タスク「${task.name}」の詳細\n\n【指示内容】\n${task.task_prompt || 'なし'}\n\n【設定】\n• 実行場所: ${task.execution_location === 'server' ? 'サーバー' : 'ローカル'}\n• スケジュール: ${task.schedule || '手動実行'}\n• 役割グループ: ${task.role_group || '未分類'}`
                                      }])
                                    }}
                                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                  >
                                    <Eye className="w-5 h-5" />
                                    <span className="text-xs font-medium">詳細表示</span>
                                  </button>
                                </div>
                                
                                {/* ヒント */}
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
                                  💡 「テスト実行」で動作確認、「編集チャット」で内容を調整できます
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* ワークフローステップガイド */}
        {workflowStep && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">📍 ワークフロー進捗</span>
              <button
                onClick={() => setWorkflowStep(null)}
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                閉じる
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Step 1: 作成 */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                workflowStep === 'creating' 
                  ? 'bg-amber-500 text-white animate-pulse' 
                  : ['testing', 'editing', 'completed'].includes(workflowStep)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              }`}>
                {['testing', 'editing', 'completed'].includes(workflowStep) ? <CheckCircle className="w-3 h-3" /> : <span>1</span>}
                作成
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
              
              {/* Step 2: テスト */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                workflowStep === 'testing' 
                  ? 'bg-amber-500 text-white animate-pulse' 
                  : ['editing', 'completed'].includes(workflowStep)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              }`}>
                {['editing', 'completed'].includes(workflowStep) ? <CheckCircle className="w-3 h-3" /> : <span>2</span>}
                テスト
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
              
              {/* Step 3: 編集/調整 */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                workflowStep === 'editing' 
                  ? 'bg-cyan-500 text-white' 
                  : workflowStep === 'completed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              }`}>
                {workflowStep === 'completed' ? <CheckCircle className="w-3 h-3" /> : <span>3</span>}
                編集
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
              
              {/* Step 4: 完了 */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                workflowStep === 'completed' 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              }`}>
                ✓ 完了
              </div>
            </div>
            <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
              {workflowStep === 'creating' && '🔄 タスクを作成しています...'}
              {workflowStep === 'testing' && '🧪 テスト実行中です。結果をお待ちください...'}
              {workflowStep === 'editing' && '✏️ タスクを編集中です。変更を保存してください。'}
              {workflowStep === 'completed' && '🎉 タスクの作成が完了しました！タスクボードで確認できます。'}
            </div>
          </div>
        )}

        {/* 作成中の表示 */}
        {creatingInfo && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-2xl rounded-bl-md">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                タスクを作成中...
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {creatingInfo.task_name} ({creatingInfo.current}/{creatingInfo.total})
              </p>
            </div>
          </div>
        )}
        
        {/* ローディング */}
        {isChatLoading && !creatingInfo && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
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
        
        {/* 作成されたタスク一覧（サマリー） */}
        {createdTasks.length > 0 && !pendingActions && !editingTask && (
          <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/10 dark:to-cyan-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="font-semibold text-sm text-foreground">作成済みタスク ({createdTasks.length}件)</span>
              </div>
              <button
                onClick={() => setCreatedTasks([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                クリア
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {createdTasks.map((task, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white/70 dark:bg-zinc-800/70 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-600 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-sm text-foreground truncate">{task.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRunTask(task.id)}
                      className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800 text-emerald-600"
                      title="テスト実行"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => startTaskEdit(task)}
                      className="p-1 rounded hover:bg-cyan-100 dark:hover:bg-cyan-800 text-cyan-600"
                      title="編集"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-center text-muted-foreground">
              タスクをクリックして「テスト実行」や「編集」ができます
            </div>
          </div>
        )}

        {/* アクション実行ボタン（簡素化版） */}
        {pendingActions && (Array.isArray(pendingActions) ? pendingActions.length > 0 : true) && (
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-2 border-emerald-500/50 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <span className="font-bold text-lg text-foreground">タスク作成の準備完了</span>
            </div>
            
            {/* タスクプレビュー */}
            {(() => {
              const actions = pendingActions.actions || pendingActions
              const createActions = actions.filter(a => a.type === 'create_task')
              if (createActions.length > 0) {
                const taskData = createActions[0].data
                return (
                  <div className="mb-4 p-3 bg-white/70 dark:bg-zinc-800/70 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span className="font-semibold text-sm text-foreground">{taskData.name || '新規タスク'}</span>
                    </div>
                    {taskData.description && (
                      <p className="text-xs text-muted-foreground mb-2">📝 {taskData.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        taskData.execution_location === 'server' 
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      }`}>
                        {taskData.execution_location === 'server' ? '🖥️ サーバー' : '💻 ローカル'}
                      </span>
                      {taskData.schedule && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-medium">
                          ⏰ {taskData.schedule}
                        </span>
                      )}
                      {taskData.role_group && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 font-medium">
                          📁 {taskData.role_group}
                        </span>
                      )}
                    </div>
                  </div>
                )
              }
              return null
            })()}
            
            {/* 検証結果（簡易表示） */}
            {validationResult && (
              <div className="mb-4 p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    {validationResult.credentials?.is_ready ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className={validationResult.credentials?.is_ready ? 'text-emerald-600' : 'text-amber-600'}>
                      認証: {validationResult.credentials?.is_ready ? 'OK' : '要確認'}
                    </span>
                  </div>
                  {validationResult.review?.reviewed && (
                    <div className="flex items-center gap-1">
                      {validationResult.review.score >= 5 ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span className={validationResult.review.score >= 5 ? 'text-emerald-600' : 'text-amber-600'}>
                        品質: {validationResult.review.score}/10
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* シンプルな2ボタン */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExecuteActions(true, false)}
                  disabled={isChatLoading}
                  className="flex flex-col items-center gap-1.5 px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">作成する</span>
                  <span className="text-[10px] opacity-70">後でテスト実行</span>
                </button>
                <button
                  onClick={() => handleExecuteActions(true, true)}
                  disabled={isChatLoading}
                  className="flex flex-col items-center gap-1.5 px-4 py-3 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-md shadow-emerald-500/20"
                >
                  <FlaskConical className="w-5 h-5" />
                  <span className="text-sm">テスト付き作成</span>
                  <span className="text-[10px] opacity-70">おすすめ</span>
                </button>
              </div>
              <button
                onClick={() => {
                  setPendingActions(null)
                  setValidationResult(null)
                  setShowTestOption(false)
                  setWorkflowStep(null)
                }}
                className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
            
            {/* ヒント */}
            <div className="mt-3 text-[10px] text-center text-muted-foreground">
              💡 「テスト付き作成」で作成後すぐに動作確認できます
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>
      
      {/* 入力フィールド */}
      <div className="p-4 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shrink-0">
        {/* 添付ファイルのプレビュー */}
        {attachedFile && (
          <div className="mb-3 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center gap-3">
            {attachedFile.type === 'image' ? (
              <img 
                src={attachedFile.preview} 
                alt="添付画像" 
                className="w-16 h-16 object-cover rounded-lg"
              />
            ) : attachedFile.type === 'video' ? (
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Video className="w-8 h-8 text-purple-500" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Paperclip className="w-8 h-8 text-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {attachedFile.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {attachedFile.type === 'image' ? '画像' : attachedFile.type === 'video' ? '動画' : 'ファイル'}を添付中
              </p>
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          {/* 画像添付ボタン */}
          <button
            onClick={() => document.getElementById('image-upload-chat')?.click()}
            disabled={isChatLoading}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-pink-50 hover:text-pink-500 dark:hover:bg-pink-500/20 dark:hover:text-pink-400 transition-all disabled:opacity-50 shrink-0"
            title="画像を添付"
          >
            <Image className="w-5 h-5" />
          </button>
          {/* 動画添付ボタン */}
          <button
            onClick={() => document.getElementById('video-upload-chat')?.click()}
            disabled={isChatLoading}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-purple-50 hover:text-purple-500 dark:hover:bg-purple-500/20 dark:hover:text-purple-400 transition-all disabled:opacity-50 shrink-0"
            title="動画を添付"
          >
            <Video className="w-5 h-5" />
          </button>
          {/* 汎用ファイル添付ボタン */}
          <button
            onClick={() => document.getElementById('file-upload-chat')?.click()}
            disabled={isChatLoading}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 transition-all disabled:opacity-50 shrink-0"
            title="ファイルを添付"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative min-w-0">
            <textarea
              rows={1}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={isListening ? t('wizard.voiceListening') : (attachedFile ? 'メッセージを入力...' : t('taskBoard.chatPlaceholder'))}
              disabled={isChatLoading}
              className={`w-full h-10 min-h-[40px] max-h-40 pr-10 pl-4 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 resize-none leading-tight ${
                isListening ? 'border-red-500/50 bg-red-500/5' : ''
              }`}
            />
            {/* 音声入力ボタン (Input内に配置) */}
            {speechSupported && (
              <button
                onClick={toggleListening}
                disabled={isChatLoading}
                className={`absolute right-1 top-1 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  isListening
                    ? 'text-red-500 animate-pulse'
                    : 'text-zinc-400 hover:text-primary hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title={isListening ? t('wizard.voiceStop') : t('wizard.voiceStart')}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>

          <button
            onClick={handleSendMessage}
            disabled={(!chatInput.trim() && !attachedFile) || isChatLoading}
            className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {/* ヒント */}
        {isListening ? (
          <div className="mt-2 text-xs text-red-500 animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            {t('wizard.voiceListeningHint')}
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">
            画像・動画を添付してテキストと一緒に送信できます
          </div>
        )}
      </div>
    </motion.div>
  )
}
