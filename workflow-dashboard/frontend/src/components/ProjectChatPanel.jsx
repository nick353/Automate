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
  Cpu
} from 'lucide-react'
import { projectsApi, tasksApi, executionsApi, systemApi } from '../services/api'
import useLanguageStore from '../stores/languageStore'
import useProjectChatStore from '../stores/projectChatStore'
import useCredentialStore from '../stores/credentialStore'

export default function ProjectChatPanel({
  project,
  boardData,
  onClose,
  onRefresh
}) {
  const { t } = useLanguageStore()
  const { fetchCredentials, fetchStatus, status } = useCredentialStore()
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
    content: `こんにちは！プロジェクト「${project.name}」の自動化フロー作成をお手伝いします。

まず、自動化を実行するためにAPIキーが必要です。
以下のAPIキーをお持ちでしたら、このチャットに貼り付けてください。自動的に登録されます：

- OpenAI APIキー（sk-で始まる文字列）
- Anthropic APIキー（sk-ant-で始まる文字列）
- Google APIキー（AIzaで始まる文字列）

※APIキーは暗号化して安全に保存されます。
※すでに登録済みの場合はスキップしてください。

その後、以下を教えてください：

1. どんな作業を自動化したいですか？
   （例：毎日のデータ収集、SNS投稿、メール処理など）

2. どのサービスやサイトを使いますか？
   （例：Twitter、Googleスプレッドシート、特定のWebサイトなど）

3. どのくらいの頻度で実行しますか？
   （例：毎日9時、週1回、手動で実行など）`
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
  const [createdTasks, setCreatedTasks] = useState(getCreatedTasks(project.id)) // 作成されたタスクのリスト
  
  // 検証状態の管理
  const [validationResult, setValidationResult] = useState(null) // 検証結果
  const [showTestOption, setShowTestOption] = useState(false) // テスト実行オプション表示
  const testMonitorRef = useRef(null) // { executionId, taskName }
  const testMonitorTimerRef = useRef(null)
  
  // AIモデル選択
  const [availableModels, setAvailableModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [defaultModel, setDefaultModel] = useState('gpt-5.1-codex-max')
  const [showModelSelector, setShowModelSelector] = useState(false)
  
  // チャット履歴が変更されたらストアに保存
  useEffect(() => {
    if (chatHistory.length > 0) {
      setStoreChatHistory(project.id, chatHistory)
    }
  }, [chatHistory, project.id, setStoreChatHistory])
  
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
  
  // AIモデルリストを取得
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await systemApi.getAIModels()
        setAvailableModels(response.data.models || [])
        setDefaultModel(response.data.default || 'gpt-5.1-codex-max')
        setSelectedModel(response.data.default || 'gpt-5.1-codex-max')
      } catch (error) {
        console.error('Failed to fetch AI models:', error)
      }
    }
    fetchModels()
  }, [])
  
  // モデルセレクターを閉じる（外側クリック時）
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showModelSelector && !e.target.closest('[data-model-selector]')) {
        setShowModelSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showModelSelector])
  
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
        const response = await projectsApi.wizardChat(
          project.id, 
          userMessage, 
          chatHistory,
          videoAnalysis,
          webResearchResults,
          selectedModel
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
            searchResponse.data.results,
            selectedModel
          )
          setChatHistory(followUp.data.chat_history || [])
          await handleSavedCredentials(followUp.data.saved_api_keys)
          
          if (followUp.data.actions?.actions) {
            setPendingActions(followUp.data.actions.actions)
          }
        } else if (response.data.actions?.actions) {
          // JSONアクションがある場合は自動実行
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
              return { ...msg, content: content || 'タスクを作成します...' }
            }
            return msg
          })
          setChatHistory(cleanedHistory)
          
          // 自動で実行
          setPendingActions(actions)
          await autoExecuteActions(actions, response.data.actions.creating_info)
        }
        
        await handleSavedCredentials(response.data.saved_api_keys)
      } else {
        // 通常モード（既存タスクがあるプロジェクト）
        const response = await projectsApi.chat(project.id, userMessage, chatHistory, selectedModel)
        
        if (response.data.actions?.actions) {
          // JSONアクションがある場合は自動実行
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
              return { ...msg, content: content || 'タスクを作成します...' }
            }
            return msg
          })
          setChatHistory(cleanedHistory)
          await handleSavedCredentials(response.data.saved_api_keys)
          
          // 自動で実行
          setPendingActions(actions)
          await autoExecuteActions(actions, response.data.actions.creating_info)
        } else {
          setChatHistory(response.data.chat_history || [])
          await handleSavedCredentials(response.data.saved_api_keys)
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
        'エラーが発生しました',
        status ? `ステータス: ${status}` : null,
        detail ? `詳細: ${detail}` : null,
        serializedData ? `レスポンス: ${serializedData}` : null,
        `メッセージ: ${error.message}`
      ].filter(Boolean)
      
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: errorLines.join('\n')
      }])
    }
    
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
          autoRunTest
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
          setIsChatLoading(false)
          return
        }
        
        const task = response.data.task
        const createdTaskInfo = [task]
        setCreatedTasks(prev => [...prev, ...createdTaskInfo])
        addCreatedTasks(project.id, createdTaskInfo)
        
        let successMessage = `タスクを作成しました！\n\n`
        successMessage += `【作成されたタスク】\n`
        successMessage += `名前: ${task.name}\n`
        successMessage += `説明: ${task.description || 'なし'}\n`
        successMessage += `実行場所: ${task.execution_location === 'server' ? 'サーバー' : 'ローカル'}\n`
        successMessage += `スケジュール: ${task.schedule || '手動実行'}\n\n`
        
        if (autoRunTest && response.data.validation?.test_execution) {
          successMessage += `テスト実行を開始しました（実行ID: ${response.data.validation.test_execution.execution_id}）\n`
          successMessage += `履歴画面で進捗を確認できます。`
          const execId = response.data.validation.test_execution.execution_id
          testMonitorRef.current = { executionId: execId, taskName: task.name }
          pollTestExecution(execId, task.name)
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
        
        {/* AIモデル選択 */}
        <div className="relative" data-model-selector>
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:from-purple-200 hover:to-blue-200 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 transition-all border border-purple-200/50 dark:border-purple-700/50"
            title="AIモデルを選択"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="max-w-[150px] truncate">{selectedModel?.replace('gpt-', '') || 'モデル'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
          </button>
          
          {showModelSelector && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-[100] overflow-hidden ring-1 ring-black/5">
              <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 backdrop-blur-sm">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">AIモデルを選択</p>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id)
                      setShowModelSelector(false)
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 ${
                      selectedModel === model.id ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{model.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            model.api === 'responses' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          }`}>
                            {model.api === 'responses' ? 'Responses' : 'Chat'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{model.description}</p>
                      </div>
                      {selectedModel === model.id && (
                        <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
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
        {pendingActions && (pendingActions.length > 0 || pendingActions.actions?.length > 0) && (
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">{t('taskBoard.confirmActions')}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t('taskBoard.actionsWillExecute').replace('{count}', pendingActions.length || pendingActions.actions?.length || 0)}
            </p>
            
            {/* 検証結果がある場合の表示 */}
            {validationResult && (
              <div className="mb-4 p-3 bg-white/50 dark:bg-zinc-800/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-2">
                  {validationResult.credentials?.is_ready ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="font-medium">
                    認証情報: {validationResult.credentials?.is_ready ? '準備OK' : '不足あり'}
                  </span>
                </div>
                {validationResult.review?.reviewed && (
                  <div className="flex items-center gap-2">
                    {validationResult.review.score >= 5 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="font-medium">
                      品質スコア: {validationResult.review.score}/10
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* ボタン群 */}
            {!showTestOption ? (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handlePreValidate}
                  disabled={isChatLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  <Shield className="w-4 h-4" />
                  検証する
                </button>
                <button
                  onClick={() => handleExecuteActions(true, false)}
                  disabled={isChatLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  作成する
                </button>
                <button
                  onClick={() => {
                    setPendingActions(null)
                    setValidationResult(null)
                    setShowTestOption(false)
                  }}
                  className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExecuteActions(true, false)}
                    disabled={isChatLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    作成のみ
                  </button>
                  <button
                    onClick={() => handleExecuteActions(true, true)}
                    disabled={isChatLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <FlaskConical className="w-4 h-4" />
                    テスト実行付きで作成
                  </button>
                </div>
                <button
                  onClick={() => {
                    setPendingActions(null)
                    setValidationResult(null)
                    setShowTestOption(false)
                  }}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
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
