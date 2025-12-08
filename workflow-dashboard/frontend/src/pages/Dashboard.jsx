import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ListTodo, 
  Play, 
  CheckCircle, 
  XCircle,
  Clock,
  Activity,
  ArrowUpRight,
  Terminal,
  ExternalLink,
  Zap,
  Plus
} from 'lucide-react'
import { motion } from 'framer-motion'
import { statsApi, executionsApi } from '../services/api'
import { BentoGrid, BentoItem } from '../components/Bento/BentoGrid'
import useLanguageStore from '../stores/languageStore'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentExecutions, setRecentExecutions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useLanguageStore()
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, execRes] = await Promise.all([
          statsApi.get(),
          executionsApi.getAll({ limit: 5 })
        ])
        setStats(statsRes.data)
        setRecentExecutions(execRes.data)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="relative">
          <div className="w-12 h-12 lg:w-16 lg:h-16 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Terminal className="w-5 h-5 lg:w-6 lg:h-6 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status) => {
    const config = {
      running: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30', label: 'RUN', fullLabel: 'RUNNING', glow: true },
      pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/30', label: 'WAIT', fullLabel: 'PENDING' },
      completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', label: 'OK', fullLabel: 'SUCCESS' },
      failed: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30', label: 'ERR', fullLabel: 'FAILED' },
      paused: { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-500/30', label: 'PAUSE', fullLabel: 'PAUSED' },
      stopped: { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-500', border: 'border-gray-500/30', label: 'STOP', fullLabel: 'STOPPED' }
    }
    
    const c = config[status] || config.stopped
    
    return (
      <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-sm text-[10px] sm:text-xs font-bold border tracking-wider ${c.bg} ${c.text} ${c.border}`}>
        {c.glow && (
          <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-sm h-1.5 w-1.5 sm:h-2 sm:w-2 bg-current shadow-[0_0_5px_currentColor]"></span>
          </span>
        )}
        <span className="sm:hidden">{c.label}</span>
        <span className="hidden sm:inline">{c.fullLabel}</span>
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-8"
      >
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground dark:text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <span className="truncate">{t('dashboard.title')}</span>
          </h1>
          <p className="text-muted-foreground dark:text-gray-500 mt-1 text-lg font-medium">{t('dashboard.subtitle')}</p>
        </div>
        <Link 
          to="/tasks" 
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm bg-black dark:bg-white text-white dark:text-black text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <ListTodo className="w-4 h-4" />
          <span>{t('dashboard.manageTasks')}</span>
        </Link>
      </motion.div>
      
      <BentoGrid>
        {/* Active Tasks */}
        <BentoItem
          title={t('dashboard.activeTasks')}
          description={t('dashboard.activeTasksDesc')}
          header={
            <div className="flex flex-1 w-full h-full min-h-[6rem] bg-cyan-500/10 items-center justify-center">
               <div className="text-6xl font-black text-cyan-500">{stats?.tasks?.active || 0}</div>
            </div>
          }
          icon={<ListTodo className="h-4 w-4 text-cyan-500" />}
          className="md:col-span-1"
        >
             <div className="flex items-center gap-2 mt-2 text-xs font-mono text-muted-foreground">
                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                <span>{t('dashboard.total')}: {stats?.tasks?.total || 0}</span>
             </div>
        </BentoItem>

        {/* Running Executions */}
        <BentoItem
          title={t('dashboard.runningNow')}
          description={t('dashboard.runningNowDesc')}
          header={
            <div className="flex flex-1 w-full h-full min-h-[6rem] bg-yellow-500/10 items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-yellow-500/5 animate-pulse" />
                <div className="text-6xl font-black text-yellow-500 relative z-10">{stats?.executions?.running || 0}</div>
            </div>
          }
          icon={<Play className="h-4 w-4 text-yellow-500" />}
          className="md:col-span-1"
        />

        {/* Success Rate */}
        <BentoItem
          title={t('dashboard.successRate')}
          description={t('dashboard.successRateDesc')}
          header={
            <div className="flex flex-1 w-full h-full min-h-[6rem] bg-emerald-500/10 items-center justify-center">
                <div className="text-6xl font-black text-emerald-500">
                    {Math.round(((stats?.executions?.completed || 0) / (stats?.executions?.total || 1)) * 100)}%
                </div>
            </div>
          }
          icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
          className="md:col-span-1"
        >
             <div className="flex items-center justify-between mt-2">
                 <div className="flex items-center gap-1 text-xs font-mono text-emerald-600">
                    <CheckCircle className="w-3 h-3" />
                    <span>{stats?.executions?.completed || 0}</span>
                 </div>
                 <div className="flex items-center gap-1 text-xs font-mono text-rose-600">
                    <XCircle className="w-3 h-3" />
                    <span>{stats?.executions?.failed || 0}</span>
                 </div>
             </div>
        </BentoItem>

        {/* Recent Activity - Large Card */}
        <BentoItem
          title={t('dashboard.recentActivity')}
          description={t('dashboard.recentActivityDesc')}
          span={2}
          rowSpan={2}
          header={null}
          className="md:col-span-2 row-span-2"
        >
            <div className="flex-1 overflow-hidden flex flex-col gap-2 mt-4">
                {recentExecutions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Clock className="w-12 h-12 mb-2" />
                        <p>{t('dashboard.noActivity')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentExecutions.map((execution) => (
                            <div key={execution.id} className="flex items-center justify-between p-3 rounded-sm bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-2 h-10 rounded-sm shrink-0 ${
                                        execution.status === 'completed' ? 'bg-emerald-500' :
                                        execution.status === 'failed' ? 'bg-rose-500' :
                                        execution.status === 'running' ? 'bg-yellow-500' : 'bg-gray-500'
                                    }`} />
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate">{execution.task?.name || `Task #${execution.task_id}`}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{execution.started_at ? new Date(execution.started_at).toLocaleTimeString() : '-'}</p>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    {getStatusBadge(execution.status)}
                                    <Link to={`/execution/${execution.id}`} className="p-2 rounded-sm hover:bg-background/50 text-muted-foreground hover:text-primary transition-colors">
                                        <ExternalLink className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-auto pt-4 text-center">
                    <Link to="/history" className="text-sm font-bold text-primary hover:underline">{t('dashboard.viewHistory')} &rarr;</Link>
                </div>
            </div>
        </BentoItem>

        {/* Quick Actions */}
        <BentoItem
          title={t('dashboard.quickActions')}
          description={t('dashboard.quickActionsDesc')}
          className="md:col-span-1"
          icon={<Zap className="h-4 w-4 text-purple-500" />}
        >
            <div className="grid grid-cols-1 gap-2 mt-4">
                <Link to="/tasks/wizard" className="flex items-center gap-3 p-3 rounded-sm bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/20 transition-colors group">
                    <div className="p-2 rounded-sm bg-indigo-500 text-white shadow-lg group-hover:scale-110 transition-transform">
                        <Zap className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">{t('dashboard.aiWizard')}</p>
                        <p className="text-xs text-muted-foreground">{t('dashboard.createWithAi')}</p>
                    </div>
                </Link>
                <button 
                  onClick={() => window.location.href='/tasks'} 
                  className="flex items-center gap-3 p-3 rounded-sm bg-muted/50 hover:bg-muted border border-border transition-colors group"
                >
                    <div className="p-2 rounded-sm bg-primary text-white shadow-lg group-hover:scale-110 transition-transform">
                        <Plus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm">{t('dashboard.newTask')}</p>
                        <p className="text-xs text-muted-foreground">{t('dashboard.createManually')}</p>
                    </div>
                </button>
            </div>
        </BentoItem>
      </BentoGrid>
    </div>
  )
}
