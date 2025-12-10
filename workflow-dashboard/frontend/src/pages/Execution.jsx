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
import { liveViewApi, executionsApi, tasksApi } from '../services/api'
import LiveScreencast from '../components/LiveScreencast'
import useLanguageStore from '../stores/languageStore'

export default function Execution() {
  const { executionId } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [auxLoading, setAuxLoading] = useState(null)
  const timerRef = useRef(null)
  const logsEndRef = useRef(null)
  const { t, language } = useLanguageStore()
  
  const {
    status,
    controlStatus,
    steps,
    logs,
    elapsedTime,
    execution,
    screenshot,
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
        setTask(execResponse.data.task || { name: `Task #${execResponse.data.task_id}` })
        
        // WebSocket接続（実行中の場合のみ）
        if (['running', 'pending', 'paused'].includes(liveResponse.data.execution?.status)) {
          connect(executionId)
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Initialization error:', error)
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
      alert(t('common.error') + ': ' + error.message)
    }
    setActionLoading(null)
  }
  
  const handleResume = async () => {
    setActionLoading('resume')
    try {
      await liveViewApi.resume(executionId)
    } catch (error) {
      alert(t('common.error') + ': ' + error.message)
    }
    setActionLoading(null)
  }
  
  const handleStop = async () => {
    if (!window.confirm(t('execution.confirmStop'))) return
    
    setActionLoading('stop')
    try {
      await liveViewApi.stop(executionId)
    } catch (error) {
      alert(t('common.error') + ': ' + error.message)
    }
    setActionLoading(null)
  }
  
  const handleCopyLogs = () => {
    const logText = logs.map(l => 
      `[${l.timestamp}] [${l.level}] ${l.message}`
    ).join('\n')
    navigator.clipboard.writeText(logText)
    alert(t('common.copied'))
  }

  const handleRerun = async () => {
    if (!execution?.task_id) return
    setAuxLoading('rerun')
    try {
      await tasksApi.run(execution.task_id)
      alert('再実行を開始しました（新しい実行が作成されます）')
    } catch (error) {
      alert(t('common.error') + ': ' + (error.message || '再実行に失敗しました'))
    }
    setAuxLoading(null)
  }
  
  const getStatusBadge = () => {
    const statusMap = {
      running: { text: t('execution.status.running'), color: 'bg-blue-500', icon: Loader2, animate: true },
      paused: { text: t('execution.status.paused'), color: 'bg-yellow-500', icon: Pause },
      stopping: { text: t('execution.status.stopping'), color: 'bg-orange-500', icon: Loader2, animate: true },
      stopped: { text: t('execution.status.stopped'), color: 'bg-gray-500', icon: Square },
      completed: { text: t('execution.status.completed'), color: 'bg-green-500', icon: CheckCircle },
      failed: { text: t('execution.status.failed'), color: 'bg-red-500', icon: XCircle },
      pending: { text: t('execution.status.pending'), color: 'bg-yellow-500', icon: Clock }
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
  const latestStep = steps.length > 0 ? steps[steps.length - 1] : null
  const progressTotal = totalSteps || steps.length
  const progressCurrent = currentStep || steps.filter(s => s.status === 'completed').length
  const progressPct = progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0
  
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
            <h1 className="text-xl font-bold text-foreground">{task?.name || t('execution.title')}</h1>
            <p className="text-muted-foreground text-sm">{t('execution.executionId').replace('{id}', executionId)}</p>
          </div>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {formatTime(elapsedTime)}
          </span>
          <span className={`text-sm ${status === 'connected' ? 'text-green-400' : 'text-muted-foreground'}`}>
            {status === 'connected' ? t('execution.status.connected') : t('execution.status.disconnected')}
          </span>
        </div>
      </div>
      
      {/* Live Screencast - 実行中は最上部に表示 */}
      {(isRunning || isPaused) && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              {t('execution.liveView')}
              {isRunning && <span className="text-xs text-red-400 animate-pulse">● {t('execution.live')}</span>}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('execution.liveViewDesc')}
            </p>
          </div>
          <div className="card-body p-0">
            <LiveScreencast executionId={parseInt(executionId)} isRunning={isRunning || isPaused} />
          </div>
        </div>
      )}

      {/* ステータスパネル（進行状況＋最新ステップ＋スクショサムネ） */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            進行状況
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{progressCurrent}/{progressTotal || '??'} steps</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{progressPct}%</span>
          </div>
        </div>
        <div className="card-body space-y-3">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-2 bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">最新ステップ</p>
              {latestStep ? (
                <div className="p-3 rounded-lg border border-border bg-muted">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Step {latestStep.step_number}: {latestStep.action_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{latestStep.status}</span>
                  </div>
                  {latestStep.description && (
                    <p className="text-sm text-muted-foreground mt-1">{latestStep.description}</p>
                  )}
                  {latestStep.error_message && (
                    <p className="text-sm text-red-500 mt-1">{latestStep.error_message}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  ステップの受信を待機中…
                </div>
              )}
            </div>
            <div className="w-full md:w-56">
              <p className="text-xs text-muted-foreground mb-1">最新スクリーンショット</p>
              {status === 'connected' && screenshot ? (
                <div className="rounded-lg overflow-hidden border border-border bg-black/80">
                  <img
                    src={`data:image/png;base64,${screenshot}`}
                    alt="Latest screenshot"
                    className="w-full h-36 object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-36 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                  スクリーンショットなし
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Step Progress */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-foreground">{t('execution.stepProgress')}</h2>
          <span className="text-sm text-muted-foreground">
            {t('execution.stepCount')
              .replace('{completed}', steps.filter(s => s.status === 'completed').length)
              .replace('{total}', steps.length)}
          </span>
        </div>
        <div className="card-body max-h-80 overflow-y-auto">
          {steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('execution.waitingSteps')}
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
                      <p className="text-sm text-red-400 mt-1">{t('common.error')}: {step.error_message}</p>
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
          <h2 className="font-semibold text-foreground">{t('execution.logs')}</h2>
          <button onClick={handleCopyLogs} className="btn-ghost px-2 py-1 text-sm">
            <Copy className="w-4 h-4 mr-1" />
            {t('common.copy')}
          </button>
        </div>
        <div className="h-64 bg-muted rounded-b-lg p-3 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              {t('execution.waitingLogs')}
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US')}
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
          <h2 className="font-semibold text-foreground">{t('execution.control')}</h2>
          <div className="flex gap-3">
            {!isRunning && !isPaused && (
              <button
                onClick={handleRerun}
                disabled={auxLoading === 'rerun'}
                className="btn-primary"
              >
                <Play className="w-4 h-4 mr-2" />
                再実行
              </button>
            )}
            {isRunning && (
              <button
                onClick={handlePause}
                disabled={actionLoading === 'pause'}
                className="btn-warning"
              >
                <Pause className="w-4 h-4 mr-2" />
                {t('execution.pause')}
              </button>
            )}
            
            {isPaused && (
              <button
                onClick={handleResume}
                disabled={actionLoading === 'resume'}
                className="btn-success"
              >
                <Play className="w-4 h-4 mr-2" />
                {t('execution.resume')}
              </button>
            )}
            
            {canControl && (
              <button
                onClick={handleStop}
                disabled={actionLoading === 'stop'}
                className="btn-danger"
              >
                <Square className="w-4 h-4 mr-2" />
                {t('execution.stop')}
              </button>
            )}
          </div>
        </div>
      </div>
      
    </div>
  )
}
