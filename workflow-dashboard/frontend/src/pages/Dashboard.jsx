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
  Zap
} from 'lucide-react'
import { motion } from 'framer-motion'
import { statsApi, executionsApi } from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentExecutions, setRecentExecutions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
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
          <div className="w-12 h-12 lg:w-16 lg:h-16 border-2 border-primary/30 border-t-primary rounded-sm animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Terminal className="w-5 h-5 lg:w-6 lg:h-6 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    )
  }
  
  const statCards = [
    {
      label: 'ACTIVE',
      fullLabel: 'ACTIVE TASKS',
      value: stats?.tasks?.active || 0,
      subValue: `TOTAL: ${stats?.tasks?.total || 0}`,
      icon: ListTodo,
      color: 'cyan',
      trend: '+2.5%',
      trendUp: true
    },
    {
      label: 'RUNNING',
      fullLabel: 'RUNNING',
      value: stats?.executions?.running || 0,
      subValue: 'REAL-TIME',
      icon: Play,
      color: 'yellow',
      live: true
    },
    {
      label: 'SUCCESS',
      fullLabel: 'SUCCESS RATE',
      value: `${Math.round(((stats?.executions?.completed || 0) / (stats?.executions?.total || 1)) * 100)}%`,
      subValue: `${stats?.executions?.completed || 0} DONE`,
      icon: CheckCircle,
      color: 'green',
      trend: '+4.3%',
      trendUp: true
    },
    {
      label: 'FAILED',
      fullLabel: 'FAILED',
      value: stats?.executions?.failed || 0,
      subValue: 'CHECK',
      icon: XCircle,
      color: 'red',
      trend: '-1.2%',
      trendUp: false
    }
  ]

  const getColorClasses = (color) => {
    const colors = {
      cyan: {
        border: 'border-cyan-500/30 hover:border-cyan-500/60',
        glow: 'hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]',
        icon: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10',
        text: 'text-cyan-600 dark:text-cyan-400',
        gradient: 'via-cyan-500'
      },
      yellow: {
        border: 'border-yellow-500/30 hover:border-yellow-500/60',
        glow: 'hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]',
        icon: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10',
        text: 'text-yellow-600 dark:text-yellow-400',
        gradient: 'via-yellow-500'
      },
      green: {
        border: 'border-emerald-500/30 hover:border-emerald-500/60',
        glow: 'hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]',
        icon: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
        gradient: 'via-emerald-500'
      },
      red: {
        border: 'border-red-500/30 hover:border-red-500/60',
        glow: 'hover:shadow-[0_0_15px_rgba(239,68,68,0.15)]',
        icon: 'text-red-600 dark:text-red-400 bg-red-500/10',
        text: 'text-red-600 dark:text-red-400',
        gradient: 'via-red-500'
      }
    }
    return colors[color] || colors.cyan
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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-current shadow-[0_0_5px_currentColor]"></span>
          </span>
        )}
        <span className="sm:hidden">{c.label}</span>
        <span className="hidden sm:inline">{c.fullLabel}</span>
      </span>
    )
  }
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  }
  
  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } }
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground dark:text-white flex items-center gap-2 sm:gap-3">
            <Zap className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-primary dark:text-cyan-400 shrink-0" style={{ filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.5))' }} />
            <span className="truncate">DASHBOARD</span>
          </h1>
          <p className="text-muted-foreground dark:text-gray-500 mt-0.5 sm:mt-1 text-xs sm:text-sm font-mono truncate">&gt; SYSTEM_OVERVIEW</p>
        </div>
        <Link 
          to="/tasks" 
          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 rounded-sm bg-primary/10 dark:bg-cyan-500/20 text-primary dark:text-cyan-400 text-xs sm:text-sm font-bold uppercase tracking-wider border border-primary/30 dark:border-cyan-500/50 hover:bg-primary/20 dark:hover:bg-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95 transition-all whitespace-nowrap"
        >
          <ListTodo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">TASK </span>MANAGER
        </Link>
      </motion.div>
      
      {/* Stats Grid - 2 cols on mobile, 4 on lg+ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        {statCards.map((stat, index) => {
          const colors = getColorClasses(stat.color)
          return (
            <motion.div 
              key={index}
              variants={item}
              className={`group relative overflow-hidden rounded-sm border bg-card/50 dark:bg-black/40 backdrop-blur-sm p-3 sm:p-4 lg:p-5 transition-all duration-300 ${colors.border} ${colors.glow}`}
            >
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${colors.gradient} to-transparent`} />
              
              <div className="relative flex justify-between items-start mb-2 sm:mb-3 lg:mb-4">
                <div className={`p-1.5 sm:p-2 lg:p-2.5 rounded-sm ${colors.icon}`}>
                  <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                </div>
                {stat.trend && (
                  <div className={`hidden sm:flex items-center gap-1 text-[10px] lg:text-xs font-mono px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-sm bg-muted/50 dark:bg-black/50 border border-border dark:border-white/10 ${
                    stat.trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    <ArrowUpRight className={`w-2.5 h-2.5 lg:w-3 lg:h-3 ${!stat.trendUp && 'rotate-90'}`} />
                    {stat.trend}
                  </div>
                )}
                {stat.live && (
                  <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wider">
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-current animate-pulse shadow-[0_0_5px_#eab308]" />
                    <span className="hidden sm:inline">LIVE</span>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <div className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tight mb-0.5 ${colors.text}`} style={{ textShadow: `0 0 8px currentColor`, opacity: 0.9 }}>
                  {stat.value}
                </div>
                <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground dark:text-gray-400 font-bold tracking-wide">
                  <span className="sm:hidden">{stat.label}</span>
                  <span className="hidden sm:inline">{stat.fullLabel}</span>
                </p>
                <p className="text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground/80 dark:text-gray-600 mt-0.5 font-mono truncate">
                  {stat.subValue}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
      
      {/* Recent Executions */}
      <motion.div variants={item} className="rounded-sm border border-border dark:border-cyan-500/20 bg-card/50 dark:bg-black/40 backdrop-blur-sm overflow-hidden">
        <div className="p-3 sm:p-4 lg:p-6 border-b border-border dark:border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-sm bg-primary/10 dark:bg-cyan-500/10 text-primary dark:text-cyan-400">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground dark:text-white text-sm sm:text-base tracking-wide">ACTIVITY</h2>
              <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-gray-500 font-mono">EXECUTION_LOG</p>
            </div>
          </div>
          <Link 
            to="/history" 
            className="text-xs sm:text-sm font-bold text-primary dark:text-cyan-400 hover:text-primary/80 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors tracking-wide"
          >
            VIEW ALL
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
        
        {recentExecutions.length === 0 ? (
          <div className="p-6 sm:p-8 lg:p-12 flex flex-col items-center justify-center text-muted-foreground dark:text-gray-500">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 mb-3 sm:mb-4 rounded-sm bg-muted dark:bg-gray-900 border border-border dark:border-gray-800 flex items-center justify-center">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-muted-foreground dark:text-gray-600" />
            </div>
            <p className="font-bold text-muted-foreground dark:text-gray-400 text-sm sm:text-base">NO HISTORY</p>
            <p className="text-xs sm:text-sm text-muted-foreground/80 dark:text-gray-600 mt-1 font-mono text-center">Run a task to see logs</p>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-gray-800/50">
            {recentExecutions.map((execution) => (
              <div 
                key={execution.id} 
                className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3 lg:gap-4 hover:bg-muted/50 dark:hover:bg-cyan-500/5 transition-colors group"
              >
                {/* Status indicator bar */}
                <div className="w-0.5 sm:w-1 h-8 sm:h-10 lg:h-12 rounded-sm bg-primary/30 dark:bg-cyan-500/30 group-hover:bg-primary dark:group-hover:bg-cyan-500 group-hover:shadow-[0_0_8px_#06b6d4] transition-all shrink-0" />
                
                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground dark:text-gray-200 text-xs sm:text-sm truncate">
                    {execution.task?.name || `TASK_${execution.task_id}`}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-gray-600 font-mono mt-0.5 truncate">
                    {execution.started_at ? new Date(execution.started_at).toLocaleString('ja-JP') : '---'}
                  </p>
                </div>
                
                {/* Status badge */}
                <div className="shrink-0">
                  {getStatusBadge(execution.status)}
                </div>
                
                {/* Action - hidden on very small screens */}
                <Link 
                  to={`/execution/${execution.id}`}
                  className="hidden xs:flex items-center justify-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-sm text-[10px] sm:text-xs font-bold text-primary dark:text-cyan-400 bg-primary/10 dark:bg-cyan-500/10 border border-primary/30 dark:border-cyan-500/30 hover:bg-primary/20 dark:hover:bg-cyan-500/20 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all shrink-0"
                >
                  <span className="hidden sm:inline">DETAILS</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}