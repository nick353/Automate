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
  Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useTaskStore from '../stores/taskStore'
import TaskForm from '../components/TaskForm'
import StatusBadge from '../components/StatusBadge'

export default function Tasks() {
  const navigate = useNavigate()
  const { tasks, isLoading, fetchTasks, toggleTask, deleteTask, runTask } = useTaskStore()
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [runningTaskId, setRunningTaskId] = useState(null)
  
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])
  
  const handleEdit = (task) => {
    setEditingTask(task)
    setShowForm(true)
  }
  
  const handleDelete = async (task) => {
    if (window.confirm(`「${task.name}」を削除してもよろしいですか？`)) {
      await deleteTask(task.id)
    }
  }
  
  const handleToggle = async (task) => {
    await toggleTask(task.id)
  }
  
  const handleRun = async (task) => {
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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }
  
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  }
  
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">タスク一覧</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">自動化ワークフローの管理と実行</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link 
            to="/tasks/wizard" 
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Wand2 className="w-4 h-4" />
            <span>AIウィザード</span>
          </Link>
          <button 
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>新規タスク</span>
          </button>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
        <input
          type="text"
          placeholder="タスクを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pl-11 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
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
          className="rounded-2xl border-2 border-dashed border-border p-8 sm:p-12 text-center bg-muted/10"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Plus className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">タスクがありません</h3>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">最初の自動化タスクを作成しましょう</p>
          <button 
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            タスクを作成
          </button>
        </motion.div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredTasks.map((task) => (
            <motion.div 
              key={task.id}
              variants={item}
              className="group relative rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300"
            >
              {/* Status & Actions */}
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <StatusBadge active={task.is_active} />
                
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button
                    onClick={() => handleRun(task)}
                    disabled={runningTaskId === task.id}
                    className="p-1.5 sm:p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
                    title="実行"
                  >
                    {runningTaskId === task.id ? (
                      <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(task)}
                    className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="編集"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(task)}
                    className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="mb-4">
                <h3 className="font-semibold text-base sm:text-lg text-foreground truncate mb-1">
                  {task.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {task.description || '説明なし'}
                </p>
              </div>
              
              {/* Footer Info */}
              <div className="flex items-center gap-4 pt-3 sm:pt-4 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{task.schedule || '手動実行'}</span>
                </div>
                <div className="ml-auto font-mono opacity-50">
                  #{task.id}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
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
