import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  History as HistoryIcon, 
  Trash2, 
  Download,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import { motion } from 'framer-motion'
import { executionsApi } from '../services/api'

export default function History() {
  const [executions, setExecutions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  
  useEffect(() => {
    fetchExecutions()
  }, [filter])
  
  const fetchExecutions = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const response = await executionsApi.getAll(params)
      setExecutions(response.data)
    } catch (error) {
      console.error('Failed to fetch executions:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleDelete = async (execution) => {
    if (window.confirm('この実行履歴を削除してもよろしいですか？')) {
      try {
        await executionsApi.delete(execution.id)
        setExecutions(executions.filter(e => e.id !== execution.id))
      } catch (error) {
        alert('削除に失敗しました')
      }
    }
  }
  
  const handleDownload = (execution) => {
    window.open(executionsApi.downloadResult(execution.id), '_blank')
  }
  
  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-rose-500" />
      case 'running': return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      default: return <AlertCircle className="w-4 h-4 text-amber-500" />
    }
  }
  
  const getStatusLabel = (status) => {
    const labels = {
      completed: '成功',
      failed: '失敗',
      running: '実行中',
      pending: '待機中',
      paused: '一時停止',
      stopped: '停止'
    }
    return labels[status] || status
  }
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }
  
  const formatDuration = (start, end) => {
    if (!start || !end) return '-'
    const ms = new Date(end) - new Date(start)
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分${seconds % 60}秒`
  }
  
  const filteredExecutions = filter === 'all' 
    ? executions 
    : executions.filter(e => e.status === filter)

  const filterOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'completed', label: '成功' },
    { value: 'failed', label: '失敗' },
    { value: 'running', label: '実行中' }
  ]
  
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03 } }
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">実行履歴</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">過去の実行ログと結果</p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border w-fit overflow-x-auto">
          {filterOptions.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                filter === f.value 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>
        </div>
      ) : filteredExecutions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <HistoryIcon className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">履歴がありません</h3>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">タスクを実行すると履歴が表示されます</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-6 py-4">タスク / ステータス</th>
                    <th className="px-6 py-4">開始日時</th>
                    <th className="px-6 py-4">所要時間</th>
                    <th className="px-6 py-4">ステップ</th>
                    <th className="px-6 py-4 text-right">アクション</th>
                  </tr>
                </thead>
                <motion.tbody 
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-border"
                >
                  {filteredExecutions.map((execution) => (
                    <motion.tr 
                      key={execution.id} 
                      variants={item}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {getStatusIcon(execution.status)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {execution.task?.name || `タスク #${execution.task_id}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getStatusLabel(execution.status)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {formatDate(execution.started_at)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {formatDuration(execution.started_at, execution.completed_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-foreground">{execution.completed_steps || 0}</span>
                          <span className="text-muted-foreground">/ {execution.total_steps || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                            to={`/execution/${execution.id}`}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="詳細を見る"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          {execution.result && (
                            <button
                              onClick={() => handleDownload(execution)}
                              className="p-2 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                              title="結果をダウンロード"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(execution)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </div>
          
          {/* Mobile Cards */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="md:hidden space-y-3"
          >
            {filteredExecutions.map((execution) => (
              <motion.div 
                key={execution.id}
                variants={item}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getStatusIcon(execution.status)}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {execution.task?.name || `タスク #${execution.task_id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getStatusLabel(execution.status)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground mb-3">
                  <div>
                    <span className="block text-muted-foreground/70">開始日時</span>
                    <span className="font-mono">{formatDate(execution.started_at)}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground/70">所要時間</span>
                    <span className="font-mono">{formatDuration(execution.started_at, execution.completed_at)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="text-xs">
                    <span className="font-medium text-foreground">{execution.completed_steps || 0}</span>
                    <span className="text-muted-foreground"> / {execution.total_steps || '-'} ステップ</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link 
                      to={`/execution/${execution.id}`}
                      className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(execution)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
