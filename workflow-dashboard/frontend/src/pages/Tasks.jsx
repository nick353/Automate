import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Plus, 
  Play, 
  Trash2, 
  Edit2,
  Search,
  Wand2,
  Calendar,
  Sparkles,
  Globe,
  Monitor
} from 'lucide-react'

import { motion, AnimatePresence } from 'framer-motion'
import useTaskStore from '../stores/taskStore'
import TaskForm from '../components/TaskForm'
import StatusBadge from '../components/StatusBadge'
import { BentoGrid, BentoItem } from '../components/Bento/BentoGrid'
import useLanguageStore from '../stores/languageStore'

export default function Tasks() {
  const navigate = useNavigate()
  const { tasks, isLoading, fetchTasks, toggleTask, deleteTask, runTask } = useTaskStore()
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [runningTaskId, setRunningTaskId] = useState(null)
  const { t } = useLanguageStore()
  
  // 実行場所のアイコンと色
  const EXECUTION_LOCATION_CONFIG = {
    server: { icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10', label: t('tasks.server') },
    local: { icon: Monitor, color: 'text-purple-500', bg: 'bg-purple-500/10', label: t('tasks.local') },
  }

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])
  
  const handleEdit = (e, task) => {
    e.stopPropagation()
    setEditingTask(task)
    setShowForm(true)
  }
  
  const handleDelete = async (e, task) => {
    e.stopPropagation()
    if (window.confirm(t('tasks.confirmDelete').replace('{name}', task.name))) {
      await deleteTask(task.id)
    }
  }
  
  const handleToggle = async (task) => {
    await toggleTask(task.id)
  }
  
  const handleRun = async (e, task) => {
    e.stopPropagation()
    setRunningTaskId(task.id)
    const result = await runTask(task.id)
    setRunningTaskId(null)
    
    if (result) {
      const executionId = result.status
      if (executionId) {
        navigate(`/execution/${executionId}`)
      }
    }
  }
  
  const handleFormClose = () => {
    setShowForm(false)
    setEditingTask(null)
    fetchTasks()
  }
  
  const filteredTasks = tasks.filter(task =>
    task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{t('tasks.title')}</h1>
            <p className="text-muted-foreground mt-1 text-lg">{t('tasks.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link 
                to="/tasks/wizard" 
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold shadow-lg hover:scale-105 transition-all"
            >
                <Wand2 className="w-4 h-4" />
                <span>{t('dashboard.aiWizard')}</span>
            </Link>
            <button 
                onClick={() => setShowForm(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold shadow-lg hover:scale-105 transition-all"
            >
                <Plus className="w-4 h-4" />
                <span>{t('dashboard.newTask')}</span>
            </button>
            </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
        <input
          type="text"
          placeholder={t('tasks.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm"
        />
      </div>
      
      {/* Task Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center bg-zinc-50 dark:bg-zinc-900/50"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
            <Plus className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('tasks.noTasks')}</h3>
          <p className="text-muted-foreground mb-6">{t('tasks.createFirst')}</p>
          <button 
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold hover:scale-105 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('tasks.createTask')}
          </button>
        </motion.div>
      ) : (
        <BentoGrid>
          {filteredTasks.map((task) => (
            <BentoItem 
              key={task.id}
              title={task.name}
              description={task.description || 'No description'}
              header={
                  <div className="flex flex-1 w-full h-full min-h-[8rem] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 p-4 relative group-hover:scale-105 transition-transform duration-500">
                      <div className="absolute top-3 right-3 flex gap-2">
                           <StatusBadge active={task.is_active} />
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                           {/* Execution Location */}
                           {(() => {
                                const config = EXECUTION_LOCATION_CONFIG[task.execution_location] || EXECUTION_LOCATION_CONFIG.server
                                const LocationIcon = config.icon
                                return (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-black/50 backdrop-blur-sm shadow-sm ${config.color}`}>
                                    <LocationIcon className="w-3.5 h-3.5" />
                                    <span>{config.label}</span>
                                </div>
                                )
                            })()}
                           <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono bg-white/80 dark:bg-black/50 px-2 py-1 rounded-full">
                               <Calendar className="w-3 h-3" />
                               {task.schedule || t('tasks.manual')}
                           </div>
                      </div>
                  </div>
              }
              className="md:col-span-1 cursor-default"
              onClick={() => {}}
            >
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                        onClick={(e) => handleRun(e, task)}
                        disabled={runningTaskId === task.id}
                        className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-bold text-sm transition-colors disabled:opacity-50"
                    >
                        {runningTaskId === task.id ? (
                            <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                <span>{t('tasks.run')}</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={(e) => handleEdit(e, task)}
                        className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => handleDelete(e, task)}
                        className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </BentoItem>
          ))}
        </BentoGrid>
      )}
      
      {/* Task Form Modal */}
      <AnimatePresence>
        {showForm && (
          <TaskForm
            task={editingTask}
            onClose={handleFormClose}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
