import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  History as HistoryIcon, 
  Trash2, 
  Download,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { motion } from 'framer-motion'
import { executionsApi } from '../services/api'
import { BentoGrid, BentoItem } from '../components/Bento/BentoGrid'
import useLanguageStore from '../stores/languageStore'
import useNotificationStore from '../stores/notificationStore'
import { SkeletonHistoryCard, SkeletonGrid } from '../components/Skeleton'

const PAGE_SIZE = 20

export default function History() {
  const [executions, setExecutions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const { t } = useLanguageStore()
  const { success: notifySuccess, error: notifyError } = useNotificationStore()
  
  const fetchExecutions = useCallback(async (pageNum = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    
    try {
      const params = {
        skip: pageNum * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(filter !== 'all' ? { status: filter } : {})
      }
      const response = await executionsApi.getPaginated(params)
      const data = response.data
      
      if (data.items) {
        // ページネーション対応レスポンス
        if (append) {
          setExecutions(prev => [...prev, ...data.items])
        } else {
          setExecutions(data.items)
        }
        setTotal(data.total)
        setHasMore(data.has_more)
      } else {
        // 従来のレスポンス（配列直接）
        if (append) {
          setExecutions(prev => [...prev, ...data])
        } else {
          setExecutions(data)
        }
        setHasMore(data.length === PAGE_SIZE)
      }
      setPage(pageNum)
    } catch (error) {
      console.error('Failed to fetch executions:', error)
      notifyError('エラー', '履歴の取得に失敗しました')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [filter, notifyError])
  
  useEffect(() => {
    setPage(0)
    fetchExecutions(0)
  }, [filter])
  
  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchExecutions(page + 1, true)
    }
  }
  
  const handleDelete = async (execution) => {
    if (window.confirm(t('history.confirmDelete'))) {
      try {
        await executionsApi.delete(execution.id)
        setExecutions(executions.filter(e => e.id !== execution.id))
        setTotal(prev => prev - 1)
        notifySuccess('削除完了', '履歴を削除しました')
      } catch (error) {
        notifyError('削除失敗', error.message)
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
      completed: t('history.success'),
      failed: t('history.failed'),
      running: t('history.running'),
      pending: 'Pending',
      paused: 'Paused',
      stopped: 'Stopped'
    }
    return labels[status] || status
  }
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }
  
  const formatDuration = (start, end) => {
    if (!start || !end) return '-'
    const ms = new Date(end) - new Date(start)
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }
  
  // フィルタは既にバックエンドで適用済み
  const filteredExecutions = executions

  const filterOptions = [
    { value: 'all', label: t('history.all') },
    { value: 'completed', label: t('history.success') },
    { value: 'failed', label: t('history.failed') },
    { value: 'running', label: t('history.running') }
  ]
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">{t('history.title')}</h1>
          <p className="text-muted-foreground mt-1 text-lg">{t('history.subtitle')}</p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-sm w-fit">
          {filterOptions.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-sm text-sm font-bold transition-all ${
                filter === f.value 
                  ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm" 
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
        <div className="space-y-4">
          {/* スケルトンUI */}
          <SkeletonGrid columns={1} rows={5} itemComponent={SkeletonHistoryCard} />
        </div>
      ) : filteredExecutions.length === 0 ? (
        <BentoGrid>
          <BentoItem
            title={t('history.noHistory')}
            description={t('history.runToSee')}
            className="md:col-span-3 flex flex-col items-center justify-center py-12 text-center opacity-50"
            icon={<HistoryIcon className="w-12 h-12 mb-4" />}
          />
        </BentoGrid>
      ) : (
        <BentoGrid>
          {/* Desktop Table View wrapped in Bento Item */}
          <BentoItem
            className="hidden md:block md:col-span-3 p-0 overflow-hidden"
            span={3}
            disableHoverEffect={true}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">{t('history.taskStatus')}</th>
                    <th className="px-6 py-4">{t('history.started')}</th>
                    <th className="px-6 py-4">{t('history.duration')}</th>
                    <th className="px-6 py-4">{t('history.steps')}</th>
                    <th className="px-6 py-4 text-right">{t('history.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredExecutions.map((execution) => (
                    <tr 
                      key={execution.id} 
                      className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            {getStatusIcon(execution.status)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground truncate">
                              {execution.task?.name || `Task #${execution.task_id}`}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
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
                          <span className="font-bold text-foreground">{execution.completed_steps || 0}</span>
                          <span className="text-muted-foreground">/ {execution.total_steps || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                            to={`/execution/${execution.id}`}
                            className="p-2 rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={t('history.details')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          {execution.result && (
                            <button
                              onClick={() => handleDownload(execution)}
                              className="p-2 rounded-sm text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                              title={t('history.download')}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(execution)}
                            className="p-2 rounded-sm text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BentoItem>
          
          {/* Mobile Card View - Individual Bento Items */}
          <div className="md:hidden grid grid-cols-1 gap-4 w-full">
             {filteredExecutions.map((execution) => (
               <BentoItem
                 key={execution.id}
                 className="p-4"
                 header={
                   <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                       {getStatusIcon(execution.status)}
                       <span className="font-bold text-sm">{getStatusLabel(execution.status)}</span>
                     </div>
                     <span className="text-xs font-mono text-muted-foreground">{formatDate(execution.started_at)}</span>
                   </div>
                 }
               >
                 <div className="space-y-2">
                   <h3 className="font-bold text-lg">{execution.task?.name || `Task #${execution.task_id}`}</h3>
                   <div className="flex justify-between text-sm text-muted-foreground border-t border-zinc-100 dark:border-zinc-800 pt-2">
                     <span>Duration: {formatDuration(execution.started_at, execution.completed_at)}</span>
                     <span>Steps: {execution.completed_steps || 0} / {execution.total_steps || '-'}</span>
                   </div>
                   <div className="flex justify-end gap-2 pt-2">
                      <Link 
                        to={`/execution/${execution.id}`}
                        className="p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-foreground text-xs font-bold"
                      >
                        {t('history.details')}
                      </Link>
                   </div>
                 </div>
               </BentoItem>
             ))}
          </div>
        </BentoGrid>
      )}
      
      {/* ページネーション */}
      {!isLoading && filteredExecutions.length > 0 && (
        <div className="flex flex-col items-center gap-4 mt-8">
          {/* 件数表示 */}
          <div className="text-sm text-muted-foreground">
            {total > 0 ? (
              <span>{filteredExecutions.length} / {total} 件を表示中</span>
            ) : (
              <span>{filteredExecutions.length} 件を表示中</span>
            )}
          </div>
          
          {/* もっと読み込むボタン */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  読み込み中...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  もっと読み込む
                </>
              )}
            </button>
          )}
          
          {/* 全件読み込み完了 */}
          {!hasMore && filteredExecutions.length > PAGE_SIZE && (
            <div className="text-sm text-muted-foreground">
              すべての履歴を表示しています
            </div>
          )}
        </div>
      )}
    </div>
  )
}
