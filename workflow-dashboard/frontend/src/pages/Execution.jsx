import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Pause, 
  Play, 
  Square, 
  Copy, 
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Video
} from 'lucide-react'
import useLiveViewStore from '../stores/liveViewStore'
import { liveViewApi, executionsApi } from '../services/api'
import LiveScreencast from '../components/LiveScreencast'

export default function Execution() {
  const { executionId } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const timerRef = useRef(null)
  const logsEndRef = useRef(null)
  
  const {
    status,
    controlStatus,
    steps,
    logs,
    elapsedTime,
    execution,
    connect,
    disconnect,
    setInitialData,
    incrementElapsedTime,
    resetElapsedTime
  } = useLiveViewStore()
  
  useEffect(() => {
    const init = async () => {
      try {
        // ライブビューデータを取得
        const liveResponse = await liveViewApi.getData(executionId)
        setInitialData(liveResponse.data)
        
        // タスク情報を取得
        const execResponse = await executionsApi.get(executionId)
        setTask(execResponse.data.task || { name: `タスク #${execResponse.data.task_id}` })
        
        // WebSocket接続（実行中の場合のみ）
        if (['running', 'pending', 'paused'].includes(liveResponse.data.execution?.status)) {
          connect(executionId)
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('初期化エラー:', error)
        setIsLoading(false)
      }
    }
    
    init()
    
    return () => {
      disconnect()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [executionId])
  
  // 経過時間タイマー
  useEffect(() => {
    if (controlStatus === 'running') {
      // 新しい実行で毎回リセット
      resetElapsedTime()
      timerRef.current = setInterval(() => {
        incrementElapsedTime()
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [controlStatus])
  
  // ログの自動スクロール
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])
  
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  
  const handlePause = async () => {
    setActionLoading('pause')
    try {
      await liveViewApi.pause(executionId)
    } catch (error) {
      alert('一時停止に失敗しました: ' + error.message)
    }
    setActionLoading(null)
  }
  
  const handleResume = async () => {
    setActionLoading('resume')
    try {
      await liveViewApi.resume(executionId)
    } catch (error) {
      alert('再開に失敗しました: ' + error.message)
    }
    setActionLoading(null)
  }
  
  const handleStop = async () => {
    if (!window.confirm('本当に実行を停止しますか？')) return
    
    setActionLoading('stop')
    try {
      await liveViewApi.stop(executionId)
    } catch (error) {
      alert('停止に失敗しました: ' + error.message)
    }
    setActionLoading(null)
  }
  
  const handleCopyLogs = () => {
    const logText = logs.map(l => 
      `[${l.timestamp}] [${l.level}] ${l.message}`
    ).join('\n')
    navigator.clipboard.writeText(logText)
    alert('ログをコピーしました')
  }
  
  const getStatusBadge = () => {
    const statusMap = {
      running: { text: '実行中', color: 'bg-blue-500', icon: Loader2, animate: true },
      paused: { text: '一時停止', color: 'bg-yellow-500', icon: Pause },
      stopping: { text: '停止中...', color: 'bg-orange-500', icon: Loader2, animate: true },
      stopped: { text: '停止', color: 'bg-gray-500', icon: Square },
      completed: { text: '完了', color: 'bg-green-500', icon: CheckCircle },
      failed: { text: '失敗', color: 'bg-red-500', icon: XCircle },
      pending: { text: '待機中', color: 'bg-yellow-500', icon: Clock }
    }
    const s = statusMap[controlStatus] || statusMap.running
    const Icon = s.icon
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm ${s.color}`}>
        <Icon className={`w-4 h-4 ${s.animate ? 'animate-spin' : ''}`} />
        {s.text}
      </span>
    )
  }
  
  const getStepIcon = (stepStatus) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />
    }
  }
  
  const formatDuration = (ms) => {
    if (!ms) return ''
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }
  
  const isRunning = controlStatus === 'running'
  const isPaused = controlStatus === 'paused'
  const canControl = isRunning || isPaused
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="btn-ghost px-3 py-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{task?.name || 'タスク実行'}</h1>
            <p className="text-muted-foreground text-sm">実行 #{executionId}</p>
          </div>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {formatTime(elapsedTime)}
          </span>
          <span className={`text-sm ${status === 'connected' ? 'text-green-400' : 'text-muted-foreground'}`}>
            {status === 'connected' ? '🟢 接続中' : '⚪ 未接続'}
          </span>
        </div>
      </div>
      
      {/* Live Screencast - 実行中は最上部に表示 */}
      {(isRunning || isPaused) && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              リアルタイム画面配信
              {isRunning && <span className="text-xs text-red-400 animate-pulse">● LIVE</span>}
            </h2>
            <p className="text-xs text-muted-foreground">
              「ライブビュー開始」ボタンでブラウザの動きをリアルタイムで確認できます
            </p>
          </div>
          <div className="card-body p-0">
            <LiveScreencast executionId={parseInt(executionId)} isRunning={isRunning || isPaused} />
          </div>
        </div>
      )}
      
      {/* Step Progress */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-foreground">ステップ進捗</h2>
          <span className="text-sm text-muted-foreground">
            {steps.filter(s => s.status === 'completed').length} / {steps.length} 完了
          </span>
        </div>
        <div className="card-body max-h-80 overflow-y-auto">
          {steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ステップを待機中...
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.step_number}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    step.status === 'running' ? 'bg-blue-500/10 border border-blue-500/30' :
                    step.status === 'failed' ? 'bg-red-500/10 border border-red-500/30' :
                    step.status === 'completed' ? 'bg-muted' : 'bg-muted'
                  }`}
                >
                  {getStepIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        Step {step.step_number}: {step.action_type}
                      </span>
                      {step.duration_ms && (
                        <span className="text-sm text-muted-foreground">
                          {formatDuration(step.duration_ms)}
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    )}
                    {step.error_message && (
                      <p className="text-sm text-red-400 mt-1">エラー: {step.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Logs */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-foreground">実行ログ</h2>
          <button onClick={handleCopyLogs} className="btn-ghost px-2 py-1 text-sm">
            <Copy className="w-4 h-4 mr-1" />
            コピー
          </button>
        </div>
        <div className="h-64 bg-muted rounded-b-lg p-3 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              ログを待機中...
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString('ja-JP')}
                  </span>
                  <span className={`ml-2 ${
                    log.level === 'ERROR' ? 'text-red-400' :
                    log.level === 'WARNING' ? 'text-yellow-400' :
                    log.level === 'DEBUG' ? 'text-muted-foreground' : 'text-muted-foreground'
                  }`}>
                    [{log.level}]
                  </span>
                  <span className="text-foreground ml-2">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
      
      {/* Control Panel */}
      <div className="card">
        <div className="p-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">コントロール</h2>
          <div className="flex gap-3">
            {isRunning && (
              <button
                onClick={handlePause}
                disabled={actionLoading === 'pause'}
                className="btn-warning"
              >
                <Pause className="w-4 h-4 mr-2" />
                一時停止
              </button>
            )}
            
            {isPaused && (
              <button
                onClick={handleResume}
                disabled={actionLoading === 'resume'}
                className="btn-success"
              >
                <Play className="w-4 h-4 mr-2" />
                再開
              </button>
            )}
            
            {canControl && (
              <button
                onClick={handleStop}
                disabled={actionLoading === 'stop'}
                className="btn-danger"
              >
                <Square className="w-4 h-4 mr-2" />
                停止
              </button>
            )}
          </div>
        </div>
      </div>
      
    </div>
  )
}

