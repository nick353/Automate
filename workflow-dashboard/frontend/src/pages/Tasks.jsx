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
  Monitor,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  X,
  MessageSquare,
  Clock,
  GitBranch,
  GripVertical
} from 'lucide-react'

import { motion, AnimatePresence } from 'framer-motion'
import useTaskStore from '../stores/taskStore'
import TaskForm from '../components/TaskForm'
import StatusBadge from '../components/StatusBadge'
import { BentoGrid, BentoItem } from '../components/Bento/BentoGrid'
import useLanguageStore from '../stores/languageStore'
import ProjectChatPanel from '../components/ProjectChatPanel'
import { projectsApi, tasksApi } from '../services/api'

export default function Tasks() {
  const navigate = useNavigate()
  const { tasks, isLoading, fetchTasks, toggleTask, deleteTask, runTask, fetchBoardData, boardData } = useTaskStore()
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [runningTaskId, setRunningTaskId] = useState(null)
  const { t } = useLanguageStore()
  
  // プロジェクト関連のState
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [expandedProjects, setExpandedProjects] = useState({})
  const [draggedTask, setDraggedTask] = useState(null)
  
  // チャット関連のState
  const [showChat, setShowChat] = useState(null) // project_id
  
  // 実行場所のアイコンと色
  const EXECUTION_LOCATION_CONFIG = {
    server: { icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10', label: t('tasks.server') },
    local: { icon: Monitor, color: 'text-purple-500', bg: 'bg-purple-500/10', label: t('tasks.local') },
  }

  useEffect(() => {
    fetchTasks()
    fetchBoardData()
  }, [fetchTasks, fetchBoardData])
  
  // プロジェクト展開状態の初期化
  useEffect(() => {
    if (boardData?.projects) {
      const expanded = {}
      boardData.projects.forEach(p => {
        expanded[p.id] = true
      })
      setExpandedProjects(prev => ({ ...expanded, ...prev }))
    }
  }, [boardData?.projects])
  
  const handleEdit = (e, task) => {
    e.stopPropagation()
    setEditingTask(task)
    setShowForm(true)
  }
  
  const handleDelete = async (e, task) => {
    e.stopPropagation()
    if (window.confirm(t('tasks.confirmDelete').replace('{name}', task.name))) {
      await deleteTask(task.id)
      fetchBoardData()
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
    fetchBoardData()
  }
  
  // プロジェクト作成
  const handleCreateProject = async (projectData) => {
    try {
      await projectsApi.create(projectData)
      setShowProjectForm(false)
      setEditingProject(null)
      fetchBoardData()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }
  
  // プロジェクト削除
  const handleDeleteProject = async (projectId, projectName) => {
    if (window.confirm(t('taskBoard.confirmDeleteProject').replace('{name}', projectName))) {
      try {
        await projectsApi.delete(projectId)
        fetchBoardData()
      } catch (error) {
        console.error('Failed to delete project:', error)
      }
    }
  }
  
  // ドラッグ&ドロップ
  const handleDragStart = (task) => {
    setDraggedTask(task)
  }
  
  const handleDragEnd = () => {
    setDraggedTask(null)
  }
  
  const handleDropOnProject = async (projectId) => {
    if (!draggedTask) return
    
    try {
      await tasksApi.batchUpdate({
        tasks: [{ id: draggedTask.id, project_id: projectId }]
      })
      fetchBoardData()
      fetchTasks()
    } catch (error) {
      console.error('Failed to move task:', error)
    }
    setDraggedTask(null)
  }
  
  const handleDropOnUnassigned = async () => {
    if (!draggedTask) return
    
    try {
      await tasksApi.batchUpdate({
        tasks: [{ id: draggedTask.id, project_id: 0 }] // 0 = unassigned
      })
      fetchBoardData()
      fetchTasks()
    } catch (error) {
      console.error('Failed to move task:', error)
    }
    setDraggedTask(null)
  }
  
  // フィルター
  const filteredTasks = tasks.filter(task =>
    task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // プロジェクトごとのタスク
  const getProjectTasks = (projectId) => {
    return filteredTasks.filter(task => task.project_id === projectId)
  }
  
  // 未割り当てタスク
  const unassignedTasks = filteredTasks.filter(task => !task.project_id)
  
  // プロジェクト作成モーダル
  const ProjectFormModal = () => {
    const [name, setName] = useState(editingProject?.name || '')
    const [description, setDescription] = useState(editingProject?.description || '')
    const [color, setColor] = useState(editingProject?.color || '#6366f1')
    
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#64748b']
    
    const handleSubmit = async (e) => {
      e.preventDefault()
      await handleCreateProject({ name, description, color })
    }
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => { setShowProjectForm(false); setEditingProject(null) }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-2xl w-full max-w-md p-6 font-mono"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold mb-4">
            {editingProject ? t('taskBoard.editProject') : t('taskBoard.newProject')}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('taskBoard.projectName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('taskBoard.projectNamePlaceholder')}
                className="w-full px-3 py-2 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">{t('taskBoard.description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">{t('taskBoard.color')}</label>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-sm transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowProjectForm(false); setEditingProject(null) }}
                className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20 font-bold"
              >
                {t('taskBoard.create')}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )
  }
  
  // タスクカード（ドラッグ可能）
  const TaskCard = ({ task }) => {
    const config = EXECUTION_LOCATION_CONFIG[task.execution_location] || EXECUTION_LOCATION_CONFIG.server
    const LocationIcon = config.icon
    
    return (
      <motion.div
        draggable
        onDragStart={() => handleDragStart(task)}
        onDragEnd={handleDragEnd}
        className={`group bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 cursor-move hover:shadow-md hover:border-primary/50 transition-all ${
          draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''
        }`}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-start gap-3">
          <GripVertical className="w-4 h-4 text-zinc-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-foreground truncate">{task.name}</h4>
              <StatusBadge active={task.is_active} />
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs ${config.bg} ${config.color}`}>
                <LocationIcon className="w-3 h-3" />
                {config.label}
              </div>
              {task.schedule && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs bg-zinc-100 dark:bg-zinc-800 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {task.schedule}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => handleRun(e, task)}
              disabled={runningTaskId === task.id}
              className="p-2 rounded-sm bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
            >
              {runningTaskId === task.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>
            <button
              onClick={(e) => handleEdit(e, task)}
              className="p-2 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={(e) => handleDelete(e, task)}
              className="p-2 rounded-sm hover:bg-rose-500/10 text-rose-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }
  
  // プロジェクトカード
  const ProjectCard = ({ project }) => {
    const isExpanded = expandedProjects[project.id] !== false
    const projectTasks = getProjectTasks(project.id)
    const [showMenu, setShowMenu] = useState(false)
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white dark:bg-zinc-900 rounded-sm border-2 overflow-hidden transition-all ${
          draggedTask ? 'border-dashed border-primary/50' : 'border-zinc-200 dark:border-zinc-800'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDropOnProject(project.id)}
      >
        {/* プロジェクトヘッダー */}
        <div 
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          style={{ borderLeft: `4px solid ${project.color}` }}
        >
          <button
            onClick={() => setExpandedProjects(prev => ({ ...prev, [project.id]: !isExpanded }))}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-sm transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <div 
            className="w-8 h-8 rounded-sm flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20` }}
          >
            <Folder className="w-4 h-4" style={{ color: project.color }} />
          </div>
          
          <div className="flex-1 min-w-0" onClick={() => setExpandedProjects(prev => ({ ...prev, [project.id]: !isExpanded }))}>
            <h3 className="font-semibold text-foreground">{project.name}</h3>
            <p className="text-xs text-muted-foreground">
              {projectTasks.length} {t('taskBoard.tasks')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowChat(project.id) }}
              className="p-2 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-primary transition-colors"
              title={t('taskBoard.chatWithAI')}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                className="p-2 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 rounded-sm shadow-lg border border-zinc-200 dark:border-zinc-800 py-1 z-20">
                    <button
                      onClick={() => { setEditingProject(project); setShowProjectForm(true); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => { handleDeleteProject(project.id, project.name); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* タスク一覧 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-4 space-y-3">
                {projectTasks.length === 0 ? (
                  <div className={`text-center py-8 rounded-sm border-2 border-dashed ${
                    draggedTask ? 'border-primary bg-primary/5' : 'border-zinc-200 dark:border-zinc-700'
                  }`}>
                    <p className="text-sm text-muted-foreground">
                      {draggedTask ? 'ここにドロップ' : 'タスクをドラッグして追加'}
                    </p>
                  </div>
                ) : (
                  projectTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
  
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
            {/* 新規プロジェクト作成ボタン */}
            <button 
              onClick={() => setShowProjectForm(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg font-bold hover:scale-105 transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{t('taskBoard.newProject')}</span>
            </button>
            <Link 
              to="/tasks/wizard" 
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg font-bold hover:scale-105 transition-all"
            >
              <Wand2 className="w-4 h-4" />
              <span>{t('dashboard.aiWizard')}</span>
            </Link>
            <button 
              onClick={() => setShowForm(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-black dark:bg-white text-white dark:text-black shadow-lg font-bold hover:scale-105 transition-all"
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
          className="w-full h-12 pl-11 pr-4 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm font-mono"
        />
      </div>
      
      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* プロジェクト一覧 */}
          {boardData?.projects?.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
          
          {/* 未割り当てタスク */}
          <div
            className={`bg-zinc-50 dark:bg-zinc-900/50 rounded-sm border-2 border-dashed p-4 transition-all ${
              draggedTask ? 'border-primary bg-primary/5' : 'border-zinc-300 dark:border-zinc-700'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnUnassigned}
          >
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-muted-foreground">{t('taskBoard.unassignedTasks')}</h3>
              <span className="text-xs text-muted-foreground">({unassignedTasks.length})</span>
            </div>
            
            {unassignedTasks.length === 0 ? (
              <div className="text-center py-8">
                <Plus className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="text-sm text-muted-foreground">
                  {t('tasks.noTasks')}
                </p>
                <button 
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary/10 text-primary border border-primary/30 font-medium hover:bg-primary/20"
                >
                  <Plus className="w-4 h-4" />
                  {t('tasks.createTask')}
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {unassignedTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <TaskForm
            task={editingTask}
            onClose={handleFormClose}
          />
        )}
        {showProjectForm && <ProjectFormModal />}
        {showChat && (() => {
          const project = boardData?.projects?.find(p => p.id === showChat)
          if (!project) return null
          return (
            <ProjectChatPanel
              key={`project-chat-${showChat}`}
              project={project}
              boardData={boardData}
              onClose={() => setShowChat(null)}
              onRefresh={() => {
                fetchBoardData()
                fetchTasks()
              }}
            />
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
