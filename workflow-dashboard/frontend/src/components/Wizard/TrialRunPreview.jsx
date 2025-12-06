import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Eye,
  Code,
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap
} from 'lucide-react'
import { cn } from '../../utils/cn'

// シミュレートされたステップ（実際のAPIと連携する場合は置き換え）
const simulateTrialRun = async (task, onStepUpdate) => {
  const steps = [
    { id: 1, name: '環境チェック', description: '必要な設定を確認中...', duration: 800 },
    { id: 2, name: '認証情報確認', description: 'APIキー・ログイン情報をチェック...', duration: 1000 },
    { id: 3, name: '接続テスト', description: '対象サービスへの接続を確認...', duration: 1200 },
    { id: 4, name: 'アクション検証', description: 'タスクの実行可能性を検証...', duration: 1500 },
    { id: 5, name: '完了', description: 'すべてのチェックが完了しました', duration: 500 },
  ]

  const results = []
  
  for (const step of steps) {
    onStepUpdate({ ...step, status: 'running' })
    await new Promise(resolve => setTimeout(resolve, step.duration))
    
    // ランダムで警告を生成（デモ用）
    const hasWarning = Math.random() > 0.8
    const result = {
      ...step,
      status: 'completed',
      warning: hasWarning ? '軽微な問題が検出されましたが、実行可能です' : null
    }
    
    results.push(result)
    onStepUpdate(result)
  }
  
  return {
    success: true,
    results,
    summary: {
      totalSteps: steps.length,
      warnings: results.filter(r => r.warning).length,
      estimatedDuration: '約30秒'
    }
  }
}

export default function TrialRunPreview({ task, onConfirm, onEdit, isVisible }) {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [completedSteps, setCompletedSteps] = useState([])
  const [result, setResult] = useState(null)
  const [isExpanded, setIsExpanded] = useState(true)

  const runTrial = async () => {
    setIsRunning(true)
    setCompletedSteps([])
    setResult(null)

    try {
      const trialResult = await simulateTrialRun(task, (step) => {
        setCurrentStep(step)
        if (step.status === 'completed') {
          setCompletedSteps(prev => [...prev, step])
        }
      })
      
      setResult(trialResult)
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setIsRunning(false)
      setCurrentStep(null)
    }
  }

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-amber-500/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">実行プレビュー</h3>
            <p className="text-xs text-muted-foreground">タスクを作成する前にテスト実行</p>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {/* Task Summary */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold text-foreground mb-3">タスク概要</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">タイプ</span>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      task?.task_type === 'api' 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    )}>
                      {task?.task_type === 'api' ? (
                        <>
                          <Code className="w-3 h-3" />
                          API
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3" />
                          ブラウザ
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">タスク名</span>
                    <span className="font-medium text-foreground">{task?.task_name || '未設定'}</span>
                  </div>
                  {task?.schedule && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">スケジュール</span>
                      <span className="font-mono text-foreground">{task.schedule}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Steps Progress */}
              {(isRunning || completedSteps.length > 0) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground">検証ステップ</h4>
                  <div className="space-y-2">
                    {completedSteps.map((step, index) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          step.warning 
                            ? "bg-amber-500/10 text-amber-500" 
                            : "bg-emerald-500/10 text-emerald-500"
                        )}>
                          {step.warning ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{step.name}</p>
                          {step.warning && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{step.warning}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    
                    {currentStep && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{currentStep.name}</p>
                          <p className="text-xs text-muted-foreground">{currentStep.description}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl border-2",
                    result.success 
                      ? "bg-emerald-500/5 border-emerald-500/30" 
                      : "bg-rose-500/5 border-rose-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      result.success ? "bg-emerald-500/20" : "bg-rose-500/20"
                    )}>
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className={cn(
                        "font-bold",
                        result.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {result.success ? 'テスト成功！' : 'テスト失敗'}
                      </h4>
                      {result.success ? (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>✅ {result.summary.totalSteps}ステップすべて完了</p>
                          {result.summary.warnings > 0 && (
                            <p>⚠️ {result.summary.warnings}件の警告あり（実行可能）</p>
                          )}
                          <p>⏱️ 推定実行時間: {result.summary.estimatedDuration}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{result.error}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {!isRunning && !result && (
                  <button
                    onClick={runTrial}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all"
                  >
                    <Play className="w-5 h-5" />
                    テスト実行
                  </button>
                )}

                {result?.success && (
                  <>
                    <button
                      onClick={onEdit}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-muted-foreground hover:text-foreground transition-all"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={onConfirm}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all"
                    >
                      <Zap className="w-5 h-5" />
                      タスクを作成
                    </button>
                  </>
                )}

                {result && !result.success && (
                  <button
                    onClick={() => { setResult(null); setCompletedSteps([]); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <RefreshCw className="w-5 h-5" />
                    再試行
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

