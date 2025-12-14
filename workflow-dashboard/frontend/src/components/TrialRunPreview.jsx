import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, 
  Square, 
  RefreshCw, 
  Monitor, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  Maximize2,
  Minimize2,
  Copy,
  Terminal,
  Eye,
  Clock
} from 'lucide-react'
import api from '../services/api'

export default function TrialRunPreview({ 
  taskPrompt, 
  executionType = 'desktop',
  maxSteps = 10,
  onComplete,
  onClose 
}) {
  const [status, setStatus] = useState('idle') // idle, connecting, waiting_agent, running, completed, failed, stopped
  const [trialId, setTrialId] = useState(null)
  const [agentId, setAgentId] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [screenshot, setScreenshot] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [connectedAgents, setConnectedAgents] = useState([])
  
  const wsRef = useRef(null)
  const logsEndRef = useRef(null)
  
  // ログを自動スクロール
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])
  
  // 接続中のエージェントを確認
  const checkAgents = useCallback(async () => {
    try {
      const response = await api.get('/trial-run/agents')
      setConnectedAgents(response.data.agents || [])
      return response.data.agents || []
    } catch (error) {
      console.error('エージェント確認エラー:', error)
      return []
    }
  }, [])
  
  useEffect(() => {
    checkAgents()
    const interval = setInterval(checkAgents, 5000)
    return () => clearInterval(interval)
  }, [checkAgents])
  
  // WebSocket接続
  const connectWebSocket = useCallback((trialId) => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/trial-run/watch/${trialId}`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    
    ws.onopen = () => {
      console.log('試運転監視WebSocket接続')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'initial_state':
          setCurrentStep(data.current_step)
          if (data.screenshots?.length > 0) {
            setScreenshot(data.screenshots[data.screenshots.length - 1].image)
          }
          setLogs(data.logs || [])
          break
          
        case 'screenshot_update':
          setScreenshot(data.image)
          setCurrentStep(data.step)
          break
          
        case 'log_update':
          setLogs(prev => [...prev, { level: data.level, message: data.message, timestamp: data.timestamp }])
          break
          
        case 'step_update':
          setCurrentStep(data.step)
          setLogs(prev => [...prev, { 
            level: 'INFO', 
            message: `ステップ ${data.step}: ${data.description}`,
            timestamp: new Date().toISOString()
          }])
          break
          
        case 'trial_completed':
          setStatus('completed')
          setResult(data.result)
          setLogs(prev => [...prev, { level: 'INFO', message: '✅ 試運転が完了しました', timestamp: new Date().toISOString() }])
          break
          
        case 'trial_failed':
          setStatus('failed')
          setError(data.error)
          setLogs(prev => [...prev, { level: 'ERROR', message: `❌ エラー: ${data.error}`, timestamp: new Date().toISOString() }])
          break
          
        case 'trial_stopped':
          setStatus('stopped')
          setLogs(prev => [...prev, { level: 'WARNING', message: '🛑 試運転が停止されました', timestamp: new Date().toISOString() }])
          break
      }
    }
    
    ws.onclose = () => {
      console.log('試運転監視WebSocket切断')
    }
    
    return ws
  }, [])
  
  // 試運転開始
  const startTrialRun = async () => {
    setStatus('connecting')
    setError(null)
    setLogs([])
    setScreenshot(null)
    setCurrentStep(0)
    setResult(null)
    
    // エージェントを確認
    const agents = await checkAgents()
    if (agents.length === 0) {
      setStatus('waiting_agent')
      setLogs([{ 
        level: 'WARNING', 
        message: 'ローカルエージェントが接続されていません。PCでエージェントを起動してください。',
        timestamp: new Date().toISOString()
      }])
      return
    }
    
    try {
      const response = await api.post('/trial-run/start', {
        task_prompt: taskPrompt,
        execution_type: executionType,
        max_steps: maxSteps,
        agent_id: agents[0].agent_id
      })
      
      const { trial_id, agent_id } = response.data
      setTrialId(trial_id)
      setAgentId(agent_id)
      setStatus('running')
      
      setLogs([{ 
        level: 'INFO', 
        message: `試運転開始 (ID: ${trial_id})`,
        timestamp: new Date().toISOString()
      }])
      
      // WebSocket接続
      connectWebSocket(trial_id)
      
    } catch (error) {
      setStatus('failed')
      setError(error.response?.data?.detail || error.message)
      setLogs([{ 
        level: 'ERROR', 
        message: `エラー: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date().toISOString()
      }])
    }
  }
  
  // 試運転停止
  const stopTrialRun = async () => {
    if (!trialId) return
    
    try {
      await api.post(`/trial-run/${trialId}/stop`)
      setStatus('stopped')
    } catch (error) {
      console.error('停止エラー:', error)
    }
  }
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])
  
  // ステータスバッジ
  const StatusBadge = () => {
    const config = {
      idle: { color: 'text-muted-foreground', bg: 'bg-muted', label: '待機中', icon: Clock },
      connecting: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: '接続中...', icon: RefreshCw },
      waiting_agent: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'エージェント待ち', icon: AlertTriangle },
      running: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: '実行中', icon: Play },
      completed: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: '完了', icon: CheckCircle },
      failed: { color: 'text-rose-500', bg: 'bg-rose-500/10', label: '失敗', icon: XCircle },
      stopped: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: '停止', icon: Square },
    }[status]
    
    const Icon = config.icon
    
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bg} ${config.color}`}>
        <Icon className={`w-4 h-4 ${status === 'connecting' || status === 'running' ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-blue-500/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Eye className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">試運転プレビュー</h2>
              <p className="text-xs text-muted-foreground">タスクを登録する前に動作を確認</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge />
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Screenshot Area */}
          <div className="flex-1 p-4 flex flex-col">
            <div className="flex-1 bg-black rounded-xl overflow-hidden relative">
              {screenshot ? (
                <img 
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="スクリーンショット"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  {status === 'waiting_agent' ? (
                    <div className="text-center p-8">
                      <Monitor className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                      <h3 className="text-lg font-semibold mb-2">ローカルエージェントを起動してください</h3>
                      <p className="text-sm mb-4">PCで以下のコマンドを実行:</p>
                      <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm text-left">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-400"># ローカルエージェントを起動</span>
                          <button
                            onClick={() => navigator.clipboard.writeText('python agent_client.py --server http://localhost:8000')}
                            className="text-xs px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <code className="text-emerald-400">python agent_client.py --server {window.location.origin}</code>
                      </div>
                      <button
                        onClick={checkAgents}
                        className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                      >
                        <RefreshCw className="w-4 h-4 inline mr-2" />
                        再確認
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Monitor className="w-12 h-12 mx-auto mb-2" />
                      <p>試運転を開始すると画面が表示されます</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Step indicator */}
              {status === 'running' && (
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur rounded-lg text-white text-sm">
                  ステップ {currentStep} / {maxSteps}
                </div>
              )}
            </div>
            
            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${(currentStep / maxSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Sidebar - Logs */}
          <div className="w-80 border-l border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">実行ログ</span>
              <span className="ml-auto text-xs text-muted-foreground">{logs.length}件</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
              {logs.map((log, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded-lg ${
                    log.level === 'ERROR' ? 'bg-rose-500/10 text-rose-500' :
                    log.level === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-muted text-foreground'
                  }`}
                >
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
            
            {/* Connected Agents */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Monitor className="w-3 h-3" />
                接続中のエージェント: {connectedAgents.length}
              </div>
              {connectedAgents.length > 0 ? (
                <div className="space-y-1">
                  {connectedAgents.map(agent => (
                    <div key={agent.agent_id} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-mono">{agent.agent_id}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-amber-500">
                  エージェント未接続
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {status === 'completed' && (
              <span className="text-emerald-500">✅ 試運転が正常に完了しました。このタスクを登録できます。</span>
            )}
            {status === 'failed' && error && (
              <span className="text-rose-500">❌ {error}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted transition-colors"
            >
              閉じる
            </button>
            
            {status === 'idle' || status === 'waiting_agent' || status === 'failed' || status === 'stopped' ? (
              <button
                onClick={startTrialRun}
                disabled={connectedAgents.length === 0 && executionType !== 'web'}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                試運転開始
              </button>
            ) : status === 'running' ? (
              <button
                onClick={stopTrialRun}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white font-medium shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                停止
              </button>
            ) : status === 'completed' ? (
              <button
                onClick={() => onComplete && onComplete(result)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                タスクを登録
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  )
}






