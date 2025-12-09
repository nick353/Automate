import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
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
  Maximize2,
  Minimize2,
  Video,
  Search,
  Edit2,
  Trash2,
  Zap,
  Mic,
  MicOff,
  Play,
  Clock,
  Settings,
  Image
} from 'lucide-react'
import { projectsApi, tasksApi } from '../services/api'
import useLanguageStore from '../stores/languageStore'

export default function ProjectChatPanel({
  project,
  boardData,
  onClose,
  onRefresh
}) {
  const { t } = useLanguageStore()
  const chatEndRef = useRef(null)
  
  // ローカルState（コンポーネント内で管理）
  const [chatHistory, setChatHistory] = useState([{
    role: 'assistant',
    content: `こんにちは！プロジェクト「${project.name}」の自動化フロー作成をお手伝いします。\n\nまず、どんな作業を自動化したいか教えてください。\n\n例えば：\n- 毎日のデータ収集・レポート作成\n- SNSへの投稿\n- メールの自動返信\n- ファイルの整理・バックアップ\n\n現在どのように作業しているかも教えていただけると、最適な自動化フローを提案できます。`
  }])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [pendingActions, setPendingActions] = useState(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [videoAnalysis, setVideoAnalysis] = useState(null)
  const [webResearchResults, setWebResearchResults] = useState(null)
  
  // 作成状態の管理
  const [creatingInfo, setCreatingInfo] = useState(null) // { current: 1, total: 3, task_name: "..." }
  const [createdTasks, setCreatedTasks] = useState([]) // 作成されたタスクのリスト
  
  // 添付ファイルのState
  const [attachedFile, setAttachedFile] = useState(null) // { file: File, type: 'image'|'video', preview: string }
  
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

  // チャットスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSendMessage = async () => {
    if ((!chatInput.trim() && !attachedFile) || isChatLoading) return
    
    const userMessage = chatInput.trim()
    const currentAttachedFile = attachedFile
    setChatInput('')
    setAttachedFile(null)
    setIsChatLoading(true)
    setPendingActions(null)
    
    // 添付ファイルがある場合の処理
    if (currentAttachedFile) {
      // ユーザーメッセージを追加（画像プレビュー付き）
      setChatHistory(prev => [...prev, {
        role: 'user',
        content: userMessage || `${currentAttachedFile.type === 'image' ? '画像' : '動画'}を添付しました`,
        image: currentAttachedFile.type === 'image' ? currentAttachedFile.preview : null,
        video: currentAttachedFile.type === 'video' ? currentAttachedFile.file.name : null
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
        } else {
          // 画像の場合
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `画像を確認しました。${userMessage ? '\n\nご要望：' + userMessage + '\n\n' : ''}この画像を参考に、どのような自動化を作成しますか？`
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
    
    try {
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
        const response = await projectsApi.wizardChat(
          project.id, 
          userMessage, 
          chatHistory,
          videoAnalysis,
          webResearchResults
        )
        setChatHistory(response.data.chat_history || [])
        
        // Webリサーチリクエストがあれば実行
        if (response.data.web_search_request) {
          const { query, reason } = response.data.web_search_request
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `🔍 Webリサーチを実行中: ${reason || query}`
          }])
          
          const searchResponse = await projectsApi.webSearch(project.id, query)
          setWebResearchResults(searchResponse.data.results)
          
          // リサーチ結果を含めて再度チャット
          const followUp = await projectsApi.wizardChat(
            project.id,
            `リサーチ結果を確認しました。続けてください。`,
            response.data.chat_history,
            videoAnalysis,
            searchResponse.data.results
          )
          setChatHistory(followUp.data.chat_history || [])
          
          if (followUp.data.actions?.actions) {
            setPendingActions(followUp.data.actions.actions)
          }
        } else if (response.data.actions?.actions) {
          setPendingActions(response.data.actions.actions)
        }
      } else {
        // 通常モード（既存タスクがあるプロジェクト）
        const response = await projectsApi.chat(project.id, userMessage, chatHistory)
        setChatHistory(response.data.chat_history || [])
        
        if (response.data.actions?.actions) {
          setPendingActions(response.data.actions.actions)
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `エラーが発生しました: ${error.message}`
      }])
    }
    
    setIsChatLoading(false)
  }
  
  const handleExecuteActions = async () => {
    if (!pendingActions) return
    
    setIsChatLoading(true)
    
    // 作成情報があれば設定
    if (pendingActions.creating_info) {
      setCreatingInfo(pendingActions.creating_info)
    }
    
    try {
      const response = await projectsApi.executeActions(project.id, pendingActions.actions || pendingActions)
      
      // 即座にタスクボードを更新
      onRefresh()
      
      // 作成されたタスクの情報を取得
      const createdTaskInfo = response.data.created_tasks || []
      if (createdTaskInfo.length > 0) {
        setCreatedTasks(prev => [...prev, ...createdTaskInfo])
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
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `アクションの実行に失敗しました: ${error.message}`
      }])
      setCreatingInfo(null)
    }
    setIsChatLoading(false)
  }
  
  // タスクを実行
  const handleRunTask = async (taskId) => {
    try {
      await tasksApi.run(taskId)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `タスクの実行を開始しました。履歴画面で進捗を確認できます。`
      }])
    } catch (error) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `タスクの実行に失敗しました: ${error.message}`
      }])
    }
  }
  
  const handleGetExplanation = async () => {
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
  
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`fixed right-0 top-0 bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl z-50 flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-full md:w-2/3' : 'w-full md:w-[450px] max-w-[100vw]'
      }`}
    >
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
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* クイックアクション */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-200/50 dark:border-zinc-800/50 overflow-x-auto shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30 backdrop-blur-sm">
        <button
          onClick={handleGetExplanation}
          disabled={isChatLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {t('taskBoard.explainWorkflow')}
        </button>
        <button
          onClick={() => setChatInput(t('taskBoard.suggestImprovements'))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full whitespace-nowrap hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t('taskBoard.suggest')}
        </button>
        <button
          onClick={() => setChatInput(t('taskBoard.addNewTask'))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full whitespace-nowrap hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('taskBoard.addTask')}
        </button>
        <button
          onClick={() => setChatInput(t('taskBoard.webSearchPrompt'))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-full whitespace-nowrap hover:bg-cyan-200 dark:hover:bg-cyan-500/30 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          {t('taskBoard.webSearch')}
        </button>
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
      </div>
      
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
            <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
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
              <div className={`inline-block p-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
              }`}>
                {parseMessage(msg.content).map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <div key={i} className="whitespace-pre-wrap">
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
              
              {/* 作成されたタスクのアクションボタン */}
              {msg.createdTasks && msg.createdTasks.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.createdTasks.map((task, taskIdx) => (
                    <div key={taskIdx} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-emerald-700 dark:text-emerald-300">{task.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRunTask(task.id)}
                            className="p-1.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                            title="実行"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setChatInput(`タスク「${task.name}」を編集したい`)
                            }}
                            className="p-1.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                            title="編集"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <Settings className="w-3 h-3" />
                          <span>{task.execution_location === 'server' ? 'サーバー実行' : 'ローカル実行'}</span>
                        </div>
                        {task.schedule && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>{task.schedule}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
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
        
        {/* アクション実行ボタン */}
        {pendingActions && pendingActions.length > 0 && (
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">{t('taskBoard.confirmActions')}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('taskBoard.actionsWillExecute').replace('{count}', pendingActions.length)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExecuteActions}
                disabled={isChatLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {t('taskBoard.executeActions')}
              </button>
              <button
                onClick={() => setPendingActions(null)}
                className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t('common.cancel')}
              </button>
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
            ) : (
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Video className="w-8 h-8 text-purple-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {attachedFile.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {attachedFile.type === 'image' ? '画像' : '動画'}を添付中
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
        <div className="flex gap-2">
          {/* 画像添付ボタン */}
          <button
            onClick={() => document.getElementById('image-upload-chat')?.click()}
            disabled={isChatLoading}
            className="px-3 py-3 rounded-xl bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 hover:bg-pink-200 dark:hover:bg-pink-500/30 transition-colors disabled:opacity-50"
            title="画像を添付"
          >
            <Image className="w-5 h-5" />
          </button>
          {/* 動画添付ボタン */}
          <button
            onClick={() => document.getElementById('video-upload-chat')?.click()}
            disabled={isChatLoading}
            className="px-3 py-3 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            title="動画を添付"
          >
            <Video className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder={isListening ? t('wizard.voiceListening') : (attachedFile ? 'メッセージを入力（省略可）...' : t('taskBoard.chatPlaceholder'))}
            disabled={isChatLoading}
            className={`flex-1 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50 ${
              isListening ? 'border-red-500/50 bg-red-500/5' : ''
            }`}
          />
          {/* 音声入力ボタン */}
          {speechSupported ? (
            <button
              onClick={toggleListening}
              disabled={isChatLoading}
              className={`px-3 py-3 rounded-xl transition-colors ${
                isListening
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse'
                  : 'bg-secondary/20 text-secondary hover:bg-secondary/30'
              }`}
              title={isListening ? t('wizard.voiceStop') : `${t('wizard.voiceStart')}\n${t('wizard.voiceMacHint')}`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
            onClick={handleSendMessage}
            disabled={(!chatInput.trim() && !attachedFile) || isChatLoading}
            className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
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
