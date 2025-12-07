import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wand2, 
  Send,
  MessageCircle,
  Video,
  Upload,
  Loader2,
  Bot,
  User,
  Sparkles,
  ArrowRight,
  Check,
  X,
  FileVideo,
  Trash2,
  RefreshCw,
  Zap,
  Key,
  Globe,
  Code,
  LayoutGrid,
  MonitorPlay
} from 'lucide-react'
import { wizardApi, tasksApi } from '../services/api'
import { cn } from '../utils/cn'

// 新しいコンポーネントをインポート
import Onboarding from '../components/Wizard/Onboarding'
import TemplateLibrary from '../components/Wizard/TemplateLibrary'
import ScreenRecorder from '../components/Wizard/ScreenRecorder'
import TrialRunPreview from '../components/Wizard/TrialRunPreview'
import ErrorHelper from '../components/Wizard/ErrorHelper'

// チャットメッセージコンポーネント
function ChatMessage({ message, isUser }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : ""
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
        isUser 
          ? "bg-gradient-to-br from-indigo-500 to-purple-600" 
          : "bg-gradient-to-br from-emerald-400 to-cyan-500"
      )}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>
      <div className={cn(
        "flex-1 max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser 
          ? "bg-indigo-500/10 dark:bg-indigo-500/20 text-foreground ml-auto" 
          : "bg-zinc-100 dark:bg-zinc-800/50 text-foreground"
      )}>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {message.content.split('\n').map((line, i) => {
            if (line.match(/^\*\*(.+)\*\*$/)) {
              const text = line.replace(/\*\*/g, '')
              return <p key={i} className="font-bold text-primary mt-2 mb-1">{text}</p>
            }
            if (line.match(/^[-•]/)) {
              return <p key={i} className="ml-2 my-0.5">{line}</p>
            }
            if (line.match(/^[📧📊🔄💡✅❌🤖]/)) {
              return <p key={i} className="font-medium mt-2">{line}</p>
            }
            if (!line.trim()) {
              return <br key={i} />
            }
            return <p key={i} className="my-1">{line}</p>
          })}
        </div>
      </div>
    </motion.div>
  )
}

// モード選択カード
function ModeCard({ icon: Icon, title, description, onClick, color, badge }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="flex-1 p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-primary/50 transition-all text-left relative overflow-hidden group"
    >
      {badge && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
          {badge}
        </span>
      )}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br",
        color
      )}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </motion.button>
  )
}

// 生成されたタスクプレビュー
function TaskPreview({ task, onConfirm, onEdit, isCreating }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-6 space-y-4"
    >
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <Sparkles className="w-5 h-5" />
        <span className="font-bold">タスクを生成しました</span>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">タスク名</label>
          <p className="text-foreground font-medium mt-1">{task.task_name}</p>
        </div>
        
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">説明</label>
          <p className="text-foreground/80 text-sm mt-1">{task.task_description}</p>
        </div>
        
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">実行タイプ</label>
          <div className="flex items-center gap-2 mt-1">
            {task.task_type === 'api' ? (
              <>
                <Code className="w-4 h-4 text-cyan-500" />
                <span className="text-sm text-cyan-600 dark:text-cyan-400">API呼び出し</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-600 dark:text-purple-400">ブラウザ自動化</span>
              </>
            )}
          </div>
        </div>
        
        {task.required_credentials && task.required_credentials.length > 0 && (
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">必要な認証情報</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {task.required_credentials.map((cred, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <Key className="w-3 h-3" />
                  {cred}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {task.schedule && (
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">スケジュール</label>
            <p className="text-foreground/80 text-sm font-mono mt-1">{task.schedule}</p>
          </div>
        )}
      </div>
      
      <div className="flex gap-3 pt-4">
        <button
          onClick={onConfirm}
          disabled={isCreating}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5" />
              タスクを作成
            </>
          )}
        </button>
        <button
          onClick={onEdit}
          className="px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-muted-foreground hover:text-foreground hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  )
}

export default function TaskWizard() {
  const navigate = useNavigate()
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  
  // State
  const [mode, setMode] = useState(null) // 'chat' | 'video' | 'record' | 'template'
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [videoFile, setVideoFile] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [generatedTask, setGeneratedTask] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  
  // 新機能のState
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)
  const [showTrialRun, setShowTrialRun] = useState(false)

  // チャットを最下部にスクロール
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // チャットセッションを開始
  const startChatSession = async (initialMessage = null) => {
    setIsLoading(true)
    setError('')
    try {
      // イベントオブジェクトやDOM要素が渡された場合は無視
      const message = (typeof initialMessage === 'string') ? initialMessage : null
      const response = await wizardApi.startChat(message)
      setSessionId(response.data.session_id)
      setMessages(response.data.chat_history || [])
      setMode('chat')
    } catch (err) {
      setError('セッションの開始に失敗しました: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsLoading(false)
    }
  }

  // テンプレートを選択
  const handleSelectTemplate = async (template) => {
    setShowTemplateLibrary(false)
    await startChatSession(template.prompt)
  }

  // 動画モードを開始
  const startVideoMode = () => {
    setMode('video')
  }

  // スクリーンレコーダーモードを開始
  const startRecordMode = () => {
    setMode('record')
  }

  // 録画完了時
  const handleRecordingComplete = async (file) => {
    setVideoFile(file)
    setIsAnalyzing(true)
    setError('')
    
    try {
      const uploadResponse = await wizardApi.uploadVideo(file)
      const sid = uploadResponse.data.session_id
      setSessionId(sid)
      
      const analyzeResponse = await wizardApi.analyzeVideo(sid)
      
      const sessionResponse = await wizardApi.getSession(sid)
      setMessages(sessionResponse.data.chat_history || [])
      
      setMode('chat')
    } catch (err) {
      setError('動画の分析に失敗しました: ' + (err.response?.data?.detail || err.message))
      setVideoFile(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 動画をアップロード
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleRecordingComplete(file)
  }

  // メッセージを送信
  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending || !sessionId) return
    
    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsSending(true)
    setError('')
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    
    try {
      const response = await wizardApi.chat(sessionId, userMessage)
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])
      
      if (response.data.is_ready_to_create) {
        const taskResponse = await wizardApi.generateTask(sessionId)
        setGeneratedTask(taskResponse.data.task)
        setShowTrialRun(true)
      }
    } catch (err) {
      setError('メッセージの送信に失敗しました: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsSending(false)
    }
  }

  // タスクを作成
  const createTask = async () => {
    if (!sessionId || isCreating) return
    
    setIsCreating(true)
    try {
      await wizardApi.createTask(sessionId)
      navigate('/tasks')
    } catch (err) {
      setError('タスクの作成に失敗しました: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsCreating(false)
    }
  }

  // タスク生成をやり直し
  const regenerateTask = async () => {
    setGeneratedTask(null)
    setShowTrialRun(false)
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '了解しました。もう少し詳しく教えていただけますか？何か変更したい点や追加情報はありますか？' 
    }])
  }

  // セッションをリセット
  const resetSession = () => {
    setMode(null)
    setSessionId(null)
    setMessages([])
    setGeneratedTask(null)
    setVideoFile(null)
    setError('')
    setShowTrialRun(false)
  }

  // エラーをリトライ
  const handleRetry = () => {
    setError('')
    if (mode === 'chat' && inputMessage) {
      sendMessage()
    }
  }

  // Enterキーで送信
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* オンボーディング */}
      <Onboarding onComplete={() => setShowOnboarding(false)} />
      
      {/* テンプレートライブラリ */}
      <TemplateLibrary 
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-purple-500/25">
            <Wand2 className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
          タスク作成ウィザード
        </h1>
        <p className="text-muted-foreground text-lg">
          AIがあなたの自動化タスク作成をお手伝いします
        </p>
      </motion.div>

      {/* Mode Selection */}
      {!mode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <p className="text-center text-muted-foreground">
            作成方法を選んでください
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModeCard
              icon={MessageCircle}
              title="チャットで相談"
              description="AIと会話しながらタスクを作成。やりたいことを説明するだけ！"
              onClick={() => startChatSession()}
              color="from-cyan-400 to-emerald-500"
            />
            <ModeCard
              icon={LayoutGrid}
              title="テンプレートから選択"
              description="よく使う自動化タスクをワンクリックで設定"
              onClick={() => setShowTemplateLibrary(true)}
              color="from-amber-400 to-orange-500"
              badge="おすすめ"
            />
            <ModeCard
              icon={MonitorPlay}
              title="画面を録画"
              description="ブラウザ上で操作を録画。AIが分析して自動化"
              onClick={startRecordMode}
              color="from-rose-500 to-pink-600"
              badge="新機能"
            />
            <ModeCard
              icon={Video}
              title="動画をアップロード"
              description="録画済みの動画をアップロードして分析"
              onClick={startVideoMode}
              color="from-purple-500 to-indigo-600"
            />
          </div>
          
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
        </motion.div>
      )}

      {/* Screen Recorder Mode */}
      {mode === 'record' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <button
            onClick={() => setMode(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 戻る
          </button>
          
          <ScreenRecorder 
            onRecordingComplete={handleRecordingComplete}
            onClose={() => setMode(null)}
          />
          
          {isAnalyzing && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              <p className="font-medium text-foreground">動画を分析中...</p>
              <p className="text-sm text-muted-foreground">AIが操作内容を解析しています</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Video Upload */}
      {mode === 'video' && !sessionId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <button
            onClick={() => setMode(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 戻る
          </button>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
              isAnalyzing 
                ? "border-purple-500 bg-purple-500/5" 
                : "border-zinc-300 dark:border-zinc-700 hover:border-purple-500 hover:bg-purple-500/5"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
            
            {isAnalyzing ? (
              <div className="space-y-4">
                <Loader2 className="w-16 h-16 mx-auto text-purple-500 animate-spin" />
                <p className="text-lg font-medium text-foreground">動画を分析中...</p>
                <p className="text-sm text-muted-foreground">
                  AIが操作内容を解析しています。少々お待ちください。
                </p>
              </div>
            ) : videoFile ? (
              <div className="space-y-4">
                <FileVideo className="w-16 h-16 mx-auto text-purple-500" />
                <p className="text-lg font-medium text-foreground">{videoFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  クリックして別の動画を選択
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">
                  動画をドロップまたはクリックして選択
                </p>
                <p className="text-sm text-muted-foreground">
                  MP4, WebM, MOV形式に対応
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Chat Interface */}
      {mode === 'chat' && sessionId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col h-[600px] rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/40 backdrop-blur-sm overflow-hidden shadow-xl"
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">AIアシスタント</h3>
                <p className="text-xs text-muted-foreground">タスク作成をお手伝いします</p>
              </div>
            </div>
            <button
              onClick={resetSession}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto"
          >
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} isUser={msg.role === 'user'} />
            ))}
            
            {isSending && (
              <div className="flex gap-3 p-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">考え中...</span>
                </div>
              </div>
            )}
            
            {/* Generated Task */}
            {generatedTask && (
              <div className="p-4 space-y-4">
                <TaskPreview 
                  task={generatedTask}
                  onConfirm={createTask}
                  onEdit={regenerateTask}
                  isCreating={isCreating}
                />
                
                {/* Trial Run Preview */}
                <TrialRunPreview
                  task={generatedTask}
                  onConfirm={createTask}
                  onEdit={regenerateTask}
                  isVisible={showTrialRun}
                />
              </div>
            )}
          </div>

          {/* Input */}
          {!generatedTask && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex gap-3">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="メッセージを入力..."
                  rows={1}
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isSending}
                  className="w-12 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Error with Helper */}
      {error && (
        <div className="mt-4">
          <ErrorHelper 
            error={error}
            onRetry={handleRetry}
            onRestart={resetSession}
          />
        </div>
      )}

      {/* Tips */}
      {mode === 'chat' && !generatedTask && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800"
        >
          <h4 className="text-sm font-bold text-foreground mb-2">💡 ヒント</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 自動化したいことをできるだけ詳しく説明してください</li>
            <li>• 対象のサイトやサービス名を教えてください</li>
            <li>• 実行頻度（毎日、毎週など）があれば教えてください</li>
            <li>• APIが使えるサービスの場合、AIがAPIの利用を提案します</li>
          </ul>
        </motion.div>
      )}
    </div>
  )
}
