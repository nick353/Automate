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
import { BentoGrid, BentoItem } from '../components/Bento/BentoGrid'
import useLanguageStore from '../stores/languageStore'

export default function History() {
  const [executions, setExecutions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const { t } = useLanguageStore()
  
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
    if (window.confirm(t('history.confirmDelete'))) {
      try {
        await executionsApi.delete(execution.id)
        setExecutions(executions.filter(e => e.id !== execution.id))
      } catch (error) {
        alert('Failed to delete')
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
  
  const filteredExecutions = filter === 'all' 
    ? executions 
    : executions.filter(e => e.status === filter)

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
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit">
          {filterOptions.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
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
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
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
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={t('history.details')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          {execution.result && (
                            <button
                              onClick={() => handleDownload(execution)}
                              className="p-2 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                              title={t('history.download')}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(execution)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
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
                        className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-foreground text-xs font-bold"
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
    </div>
  )
}
