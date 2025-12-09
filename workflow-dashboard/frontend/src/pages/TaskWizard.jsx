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
  MonitorPlay,
  Mic,
  MicOff,
  Image
} from 'lucide-react'
import { wizardApi, tasksApi } from '../services/api'
import { cn } from '../utils/cn'

// 新しいコンポーネントをインポート
import Onboarding from '../components/Wizard/Onboarding'
import TemplateLibrary from '../components/Wizard/TemplateLibrary'
import ScreenRecorder from '../components/Wizard/ScreenRecorder'
import TrialRunPreview from '../components/Wizard/TrialRunPreview'
import ErrorHelper from '../components/Wizard/ErrorHelper'
import useLanguageStore from '../stores/languageStore'

// テキスト内の**強調**をパースしてReact要素に変換
function parseMarkdownBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2)
      return <strong key={index} className="font-bold text-primary">{boldText}</strong>
    }
    return part
  })
}

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
        "w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border",
        isUser 
          ? "bg-primary/10 border-primary/30 text-primary" 
          : "bg-secondary/10 border-secondary/30 text-secondary"
      )}>
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>
      <div className={cn(
        "flex-1 max-w-[85%]",
        isUser ? "ml-auto" : ""
      )}>
        {/* 添付画像の表示 */}
        {message.image && (
          <div className={`mb-2 ${isUser ? 'flex justify-end' : ''}`}>
            <img 
              src={message.image} 
              alt="添付画像" 
              className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
            />
          </div>
        )}
        {/* 添付動画の表示 */}
        {message.video && (
          <div className={`mb-2 ${isUser ? 'flex justify-end' : ''}`}>
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg border border-purple-300 dark:border-purple-600">
              <Video className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-purple-700 dark:text-purple-300 font-mono">{message.video}</span>
            </div>
          </div>
        )}
        <div className={cn(
          "rounded-sm px-4 py-3 text-sm leading-relaxed border",
          isUser 
            ? "bg-primary/5 border-primary/20 text-foreground" 
            : "bg-secondary/5 border-secondary/20 text-foreground"
        )}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.content.split('\n').map((line, i) => {
              if (!line.trim()) {
                return <br key={i} />
              }
              if (line.match(/^[-•]/)) {
                return <p key={i} className="ml-2 my-0.5">{parseMarkdownBold(line)}</p>
              }
              if (line.match(/^[📧📊🔄💡✅❌🤖]/)) {
                return <p key={i} className="font-medium mt-2 text-primary">{parseMarkdownBold(line)}</p>
              }
              return <p key={i} className="my-1">{parseMarkdownBold(line)}</p>
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// モード選択カード
function ModeCard({ icon: Icon, title, description, onClick, colorClass, badge }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex-1 p-6 glass-card group text-left relative overflow-hidden h-full flex flex-col",
        "hover:border-primary/50 transition-all duration-300"
      )}
    >
      {badge && (
        <span className={cn(
          "absolute top-3 right-3 px-2 py-0.5 rounded-sm text-xs font-bold font-mono tracking-wider",
          "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
        )}>
          {badge}
        </span>
      )}
      <div className={cn(
        "w-12 h-12 rounded-sm flex items-center justify-center mb-4 border transition-colors",
        colorClass || "bg-primary/10 border-primary/30 text-primary"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1 font-mono tracking-wide">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      
      {/* Decorative corner */}
      <div className="absolute bottom-0 right-0 w-8 h-8 opacity-20">
         <div className="absolute bottom-2 right-2 w-2 h-2 bg-primary/50" />
         <div className="absolute bottom-2 right-5 w-1 h-1 bg-primary/30" />
         <div className="absolute bottom-5 right-2 w-1 h-1 bg-primary/30" />
      </div>
      
      <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </motion.button>
  )
}

// 生成されたタスクプレビュー
function TaskPreview({ task, onConfirm, onEdit, isCreating }) {
  const { t } = useLanguageStore()
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-primary/30 bg-primary/5 rounded-lg p-6 space-y-4 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/50" />
      
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="w-5 h-5" />
        <span className="font-bold font-mono tracking-wider">{t('wizard.taskGenerated')}</span>
      </div>
      
      <div className="space-y-4 pl-2">
        <div>
          <label className="text-xs font-bold text-primary/70 uppercase tracking-widest font-mono">{t('tasks.taskName')}</label>
          <p className="text-foreground font-bold text-lg mt-1 tracking-wide">{task.task_name}</p>
        </div>
        
        <div>
          <label className="text-xs font-bold text-primary/70 uppercase tracking-widest font-mono">{t('tasks.description')}</label>
          <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{task.task_description}</p>
        </div>
        
        <div>
          <label className="text-xs font-bold text-primary/70 uppercase tracking-widest font-mono">{t('wizard.executionType')}</label>
          <div className="flex items-center gap-2 mt-1">
            {task.task_type === 'api' ? (
              <>
                <Code className="w-4 h-4 text-cyan-500" />
                <span className="text-sm text-cyan-400 font-mono">{t('wizard.apiCall')}</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-400 font-mono">{t('wizard.browserAutomation')}</span>
              </>
            )}
          </div>
        </div>
        
        {task.required_credentials && task.required_credentials.length > 0 && (
          <div>
            <label className="text-xs font-bold text-primary/70 uppercase tracking-widest font-mono">{t('wizard.requiredCredentials')}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {task.required_credentials.map((cred, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-mono">
                  <Key className="w-3 h-3" />
                  {cred}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {task.schedule && (
          <div>
            <label className="text-xs font-bold text-primary/70 uppercase tracking-widest font-mono">{t('tasks.schedule')}</label>
            <p className="text-foreground/80 text-sm font-mono mt-1">{task.schedule}</p>
          </div>
        )}
      </div>
      
      <div className="flex gap-3 pt-4">
        <button
          onClick={onConfirm}
          disabled={isCreating}
          className="flex-1 btn btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5" />
              {t('tasks.createTask')}
            </>
          )}
        </button>
        <button
          onClick={onEdit}
          className="btn btn-secondary px-4"
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
  const { t } = useLanguageStore()
  
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
  
  // 音声入力のState
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef(null)
  
  // 添付ファイルのState
  const [attachedFile, setAttachedFile] = useState(null) // { file: File, type: 'image'|'video', preview: string }

  // チャットを最下部にスクロール
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // 音声認識のセットアップ
  useEffect(() => {
    // Web Speech APIのサポートチェック
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'ja-JP' // デフォルトは日本語

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
        
        setInputMessage(prev => {
          // 最終結果の場合のみ追加（interim resultsは上書き）
          if (event.results[event.results.length - 1].isFinal) {
            return prev + transcript
          }
          // interim results用の一時表示（最後のスペース以降を置換）
          const lastSpaceIndex = prev.lastIndexOf(' ')
          if (lastSpaceIndex === -1) {
            return transcript
          }
          return prev.substring(0, lastSpaceIndex + 1) + transcript
        })
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  // 音声入力の開始/停止
  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      // 言語設定を取得（日本語/英語/中国語に対応）
      const langMap = {
        ja: 'ja-JP',
        en: 'en-US',
        zh: 'zh-CN'
      }
      const currentLang = localStorage.getItem('language') || 'ja'
      recognitionRef.current.lang = langMap[currentLang] || 'ja-JP'
      
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

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
      setError(t('common.error') + ': ' + (err.response?.data?.detail || err.message))
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
      setError(t('common.error') + ': ' + (err.response?.data?.detail || err.message))
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
    if ((!inputMessage.trim() && !attachedFile) || isSending || !sessionId) return
    
    const userMessage = inputMessage.trim()
    const currentAttachedFile = attachedFile
    setInputMessage('')
    setAttachedFile(null)
    setIsSending(true)
    setError('')
    
    // メッセージを追加（添付ファイルがある場合はその情報も含める）
    const userMessageContent = currentAttachedFile 
      ? (userMessage || `${currentAttachedFile.type === 'image' ? '画像' : '動画'}を添付しました`)
      : userMessage
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessageContent,
      image: currentAttachedFile?.type === 'image' ? currentAttachedFile.preview : null,
      video: currentAttachedFile?.type === 'video' ? currentAttachedFile.file.name : null
    }])
    
    try {
      // 添付ファイルがある場合は動画分析を実行
      if (currentAttachedFile?.type === 'video') {
        const uploadResponse = await wizardApi.uploadVideo(currentAttachedFile.file)
        const videoSessionId = uploadResponse.data.session_id
        const analyzeResponse = await wizardApi.analyzeVideo(videoSessionId, userMessage)
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `動画を確認しました。\n\n${userMessage ? 'ご要望：' + userMessage + '\n\n' : ''}この動画を参考に自動化フローを作成できます。どのような処理を自動化したいですか？` 
        }])
      } else if (currentAttachedFile?.type === 'image') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `画像を確認しました。\n\n${userMessage ? 'ご要望：' + userMessage + '\n\n' : ''}この画像を参考に、どのような自動化を作成しますか？` 
        }])
      } else {
        // テキストのみの場合は通常のチャット
        const response = await wizardApi.chat(sessionId, userMessage)
        
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])
        
        if (response.data.is_ready_to_create) {
          const taskResponse = await wizardApi.generateTask(sessionId)
          setGeneratedTask(taskResponse.data.task)
          setShowTrialRun(true)
        }
      }
    } catch (err) {
      setError(t('common.error') + ': ' + (err.response?.data?.detail || err.message))
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
      setError(t('common.error') + ': ' + (err.response?.data?.detail || err.message))
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
      content: 'OK. Please tell me more details. Do you have any changes or additional information?' 
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
          <div className="p-3 rounded-sm bg-primary/10 border border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Wand2 className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-foreground tracking-tight mb-2 font-mono">
          {t('wizard.title')} <span className="text-primary text-sm align-top">{t('common.beta')}</span>
        </h1>
        <p className="text-muted-foreground text-lg font-mono">
          {t('wizard.subtitle')}
        </p>
      </motion.div>

      {/* Mode Selection */}
      {!mode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <p className="text-center text-muted-foreground font-mono text-xs tracking-widest uppercase">
            {t('wizard.selectMethod')}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
            <ModeCard
              icon={MessageCircle}
              title={t('wizard.chatInterface')}
              description={t('wizard.chatDesc')}
              onClick={() => startChatSession()}
              colorClass="bg-cyan-500/10 border-cyan-500/30 text-cyan-500"
            />
            <ModeCard
              icon={LayoutGrid}
              title={t('wizard.templateLibrary')}
              description={t('wizard.templateDesc')}
              onClick={() => setShowTemplateLibrary(true)}
              colorClass="bg-amber-500/10 border-amber-500/30 text-amber-500"
              badge="RECOMMENDED"
            />
            <ModeCard
              icon={MonitorPlay}
              title={t('wizard.screenRecording')}
              description={t('wizard.screenDesc')}
              onClick={startRecordMode}
              colorClass="bg-pink-500/10 border-pink-500/30 text-pink-500"
              badge="NEW"
            />
            <ModeCard
              icon={Video}
              title={t('wizard.videoAnalysis')}
              description={t('wizard.videoDesc')}
              onClick={startVideoMode}
              colorClass="bg-purple-500/10 border-purple-500/30 text-purple-500"
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
            className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            ← {t('common.back')}
          </button>
          
          <ScreenRecorder 
            onRecordingComplete={handleRecordingComplete}
            onClose={() => setMode(null)}
          />
          
          {isAnalyzing && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="font-medium text-foreground font-mono">{t('wizard.analyzingRecording')}</p>
              <p className="text-sm text-muted-foreground font-mono">{t('wizard.processingData')}</p>
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
            className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            ← {t('common.back')}
          </button>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "glass-card border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all",
              isAnalyzing 
                ? "border-primary bg-primary/5" 
                : "border-zinc-700 hover:border-primary hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]"
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
                <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
                <p className="text-lg font-medium text-foreground font-mono">{t('wizard.analyzingVideo')}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {t('wizard.extractingVectors')}
                </p>
              </div>
            ) : videoFile ? (
              <div className="space-y-4">
                <FileVideo className="w-16 h-16 mx-auto text-primary" />
                <p className="text-lg font-medium text-foreground font-mono">{videoFile.name}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {t('wizard.clickToReselect')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium text-foreground font-mono">
                  {t('wizard.dropVideo')}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {t('wizard.supportedFormats')}
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
          className="flex flex-col h-[calc(100dvh-140px)] min-h-[500px] glass-card rounded-lg overflow-hidden border border-primary/20 shadow-2xl"
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5 shrink-0 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground font-mono">{t('wizard.aiAssistant')}</h3>
                <p className="text-xs text-muted-foreground font-mono">{t('wizard.onlineReady')}</p>
              </div>
            </div>
            <button
              onClick={resetSession}
              className="p-2 rounded-sm hover:bg-destructive/10 hover:text-destructive transition-all"
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
                <div className="w-8 h-8 rounded-sm bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-mono animate-pulse">{t('auth.processing')}</span>
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
            <div className="p-4 border-t border-primary/10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md shrink-0">
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
                    <p className="text-sm font-medium text-foreground truncate font-mono">
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
              <div className="flex gap-3">
                {/* 画像添付ボタン */}
                <button
                  onClick={() => document.getElementById('wizard-image-upload')?.click()}
                  disabled={isSending}
                  className="w-12 h-12 rounded-sm bg-pink-500/20 border border-pink-500/50 text-pink-500 hover:bg-pink-500/30 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="画像を添付"
                >
                  <Image className="w-5 h-5" />
                </button>
                {/* 動画添付ボタン */}
                <button
                  onClick={() => document.getElementById('wizard-video-upload')?.click()}
                  disabled={isSending}
                  className="w-12 h-12 rounded-sm bg-purple-500/20 border border-purple-500/50 text-purple-500 hover:bg-purple-500/30 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="動画を添付"
                >
                  <Video className="w-5 h-5" />
                </button>
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isListening ? t('wizard.voiceListening') : (attachedFile ? 'メッセージを入力（省略可）...' : t('wizard.enterInstructions'))}
                  rows={1}
                  className={cn(
                    "flex-1 input resize-none min-h-[48px] max-h-[120px] font-mono text-sm bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 focus:border-primary/60",
                    isListening && "border-red-500/50 bg-red-500/5"
                  )}
                />
                {/* 音声入力ボタン */}
                {speechSupported ? (
                  <button
                    onClick={toggleListening}
                    className={cn(
                      "w-12 h-12 rounded-sm border flex items-center justify-center transition-all",
                      isListening
                        ? "bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30 animate-pulse"
                        : "bg-secondary/20 border-secondary/50 text-secondary hover:bg-secondary/30 hover:shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                    )}
                    title={isListening ? t('wizard.voiceStop') : `${t('wizard.voiceStart')}\n${t('wizard.voiceMacHint')}`}
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>
                ) : (
                  /* Mac音声入力のみ対応の案内 */
                  <div 
                    className="w-12 h-12 rounded-sm border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 cursor-help"
                    title={t('wizard.voiceNotSupported')}
                  >
                    <Mic className="w-5 h-5" />
                  </div>
                )}
                <button
                  onClick={sendMessage}
                  disabled={(!inputMessage.trim() && !attachedFile) || isSending}
                  className="w-12 h-12 rounded-sm bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              {/* 隠しファイル入力 */}
              <input
                id="wizard-image-upload"
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
              <input
                id="wizard-video-upload"
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
              {/* ヒント */}
              {isListening ? (
                <div className="mt-2 text-xs text-red-500 font-mono animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  {t('wizard.voiceListeningHint')}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground font-mono">
                  画像・動画を添付してテキストと一緒に送信できます
                </div>
              )}
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
          className="mt-6 p-4 rounded-sm border border-dashed border-primary/30 bg-primary/5"
        >
          <h4 className="text-sm font-bold text-foreground mb-2 font-mono flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t('wizard.tipsTitle')}
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 font-mono">
            {t('wizard.tipsList').map((tip, i) => (
              <li key={i}>• {tip}</li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  )
}
