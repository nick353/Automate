import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus,
  Folder,
  FolderPlus,
  MoreVertical,
  Play,
  Edit2,
  Trash2,
  Clock,
  ArrowRight,
  Link2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Calendar,
  Settings,
  X,
  Check,
  GripVertical,
  Users,
  Zap,
  Timer,
  GitBranch,
  MessageSquare,
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  Maximize2,
  Minimize2,
  Video,
  Search,
  Globe
} from 'lucide-react'
import useTaskStore from '../stores/taskStore'
import useLanguageStore from '../stores/languageStore'
import TaskForm from '../components/TaskForm'
import { projectsApi, tasksApi } from '../services/api'

// カラーパレット
const COLORS = [
  { name: 'indigo', value: '#6366f1' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'emerald', value: '#10b981' },
  { name: 'amber', value: '#f59e0b' },
  { name: 'rose', value: '#f43f5e' },
  { name: 'purple', value: '#a855f7' },
  { name: 'cyan', value: '#06b6d4' },
  { name: 'orange', value: '#f97316' },
]

// アイコンオプション
const ICONS = ['folder', 'users', 'zap', 'target', 'briefcase', 'star', 'heart', 'flag']

export default function TaskBoard() {
  const navigate = useNavigate()
  const { t } = useLanguageStore()
  const {
    boardData,
    isLoading,
    fetchBoardData,
    createProject,
    updateProject,
    deleteProject,
    createRoleGroup,
    updateRoleGroup,
    deleteRoleGroup,
    batchUpdateTasks,
    updateTask,
    deleteTask,
    runTask,
    createTrigger,
    fetchTriggers,
    deleteTrigger
  } = useTaskStore()

  // State
  const [expandedProjects, setExpandedProjects] = useState({})
  const [expandedGroups, setExpandedGroups] = useState({})
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showGroupForm, setShowGroupForm] = useState(null) // project_id
  const [editingGroup, setEditingGroup] = useState(null)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [showTriggerModal, setShowTriggerModal] = useState(null) // task_id
  const [taskTriggers, setTaskTriggers] = useState([])
  const [draggedTask, setDraggedTask] = useState(null)
  const [runningTaskId, setRunningTaskId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  
  // チャット関連のState
  const [showChat, setShowChat] = useState(null) // project_id
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [pendingActions, setPendingActions] = useState(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [videoAnalysis, setVideoAnalysis] = useState(null)
  const [webResearchResults, setWebResearchResults] = useState(null)
  const [showTaskChat, setShowTaskChat] = useState(null) // task_id for individual task chat
  const [taskChatHistory, setTaskChatHistory] = useState([])
  const [taskChatInput, setTaskChatInput] = useState('')
  const [taskChatLoading, setTaskChatLoading] = useState(false)
  const [taskPendingActions, setTaskPendingActions] = useState(null)
  const chatEndRef = useRef(null)
  const taskChatEndRef = useRef(null)

  useEffect(() => {
    fetchBoardData()
  }, [fetchBoardData])

  // 全プロジェクトを展開状態に初期化
  useEffect(() => {
    if (boardData?.projects) {
      const expanded = {}
      boardData.projects.forEach(p => {
        expanded[p.id] = true
      })
      setExpandedProjects(expanded)
    }
  }, [boardData?.projects?.length])

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  // ドラッグ&ドロップ処理
  const handleDragStart = (task) => {
    setDraggedTask(task)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
  }

  const handleDropOnProject = async (projectId) => {
    if (!draggedTask) return
    
    await batchUpdateTasks([{
      id: draggedTask.id,
      project_id: projectId || 0,
      role_group_id: 0
    }])
    
    fetchBoardData()
    setDraggedTask(null)
  }

  const handleDropOnGroup = async (projectId, groupId, groupName) => {
    if (!draggedTask) return
    
    await batchUpdateTasks([{
      id: draggedTask.id,
      project_id: projectId,
      role_group_id: groupId || 0,
      role_group: groupName
    }])
    
    fetchBoardData()
    setDraggedTask(null)
  }

  // タスク実行
  const handleRunTask = async (task) => {
    setRunningTaskId(task.id)
    const result = await runTask(task.id)
    setRunningTaskId(null)
    
    if (result?.status) {
      navigate(`/execution/${result.status}`)
    }
  }

  // トリガーモーダルを開く
  const openTriggerModal = async (task) => {
    setShowTriggerModal(task)
    const triggers = await fetchTriggers(task.id)
    setTaskTriggers(triggers || [])
  }

  // タスクカード
  const TaskCard = ({ task, projectId, groupId }) => {
    const [showMenu, setShowMenu] = useState(false)
    
    return (
      <motion.div
        draggable
        onDragStart={() => handleDragStart(task)}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          group relative p-3 rounded-lg bg-white dark:bg-zinc-900 
          border border-zinc-200 dark:border-zinc-800 
          hover:border-primary/50 hover:shadow-md
          cursor-grab active:cursor-grabbing transition-all
          ${draggedTask?.id === task.id ? 'opacity-50' : ''}
        `}
      >
        {/* ドラッグハンドル */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
          <GripVertical className="w-4 h-4 text-zinc-400" />
        </div>
        
        {/* メインコンテンツ */}
        <div className="pl-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground truncate">{task.name}</h4>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
              )}
            </div>
            
            {/* メニュー */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { handleRunTask(task); setShowMenu(false); }}
                      disabled={runningTaskId === task.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Play className="w-4 h-4 text-emerald-500" />
                      {t('taskBoard.run')}
                    </button>
                    <button
                      onClick={() => { setEditingTask(task); setShowTaskForm(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit2 className="w-4 h-4 text-blue-500" />
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => { openTriggerModal(task); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Zap className="w-4 h-4 text-amber-500" />
                      {t('taskBoard.triggers')}
                    </button>
                    <button
                      onClick={() => {
                        setShowTaskChat(task.id)
                        setShowMenu(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {t('taskBoard.taskChat')}
                    </button>
                    <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                    <button
                      onClick={async () => {
                        if (confirm(t('tasks.confirmDelete').replace('{name}', task.name))) {
                          await deleteTask(task.id)
                          fetchBoardData()
                        }
                        setShowMenu(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* メタ情報 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.schedule && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs">
                <Calendar className="w-3 h-3" />
                {task.schedule}
              </span>
            )}
            {task.dependencies && task.dependencies !== '[]' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs">
                <GitBranch className="w-3 h-3" />
                {t('taskBoard.hasDependency')}
              </span>
            )}
            {!task.is_active && (
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs">
                {t('taskBoard.inactive')}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // 役割グループセクション
  const RoleGroupSection = ({ group, projectId, tasks }) => {
    const isExpanded = expandedGroups[group.id] !== false
    const groupTasks = tasks.filter(t => t.role_group_id === group.id || t.role_group === group.name)
    
    return (
      <div 
        className={`
          ml-4 border-l-2 pl-3 py-1
          ${draggedTask ? 'border-dashed border-primary/50' : ''}
        `}
        style={{ borderColor: draggedTask ? undefined : group.color }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDropOnGroup(projectId, group.id, group.name)}
      >
        <div 
          className="flex items-center gap-2 py-1.5 cursor-pointer group"
          onClick={() => toggleGroup(group.id)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <div 
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: group.color }}
          />
          <span className="text-sm font-medium text-foreground">{group.name}</span>
          <span className="text-xs text-muted-foreground">({groupTasks.length})</span>
          
          <div className="flex-1" />
          
          <button
            onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-opacity"
          >
            <Settings className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
        
        {isExpanded && (
          <div className="space-y-2 py-2">
            {groupTasks.map(task => (
              <TaskCard key={task.id} task={task} projectId={projectId} groupId={group.id} />
            ))}
            {groupTasks.length === 0 && (
              <div className="text-xs text-muted-foreground py-2 px-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700">
                {t('taskBoard.dropTaskHere')}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // プロジェクトカード
  const ProjectCard = ({ project }) => {
    const isExpanded = expandedProjects[project.id]
    const ungroupedTasks = project.tasks?.filter(t => !t.role_group_id && (!t.role_group || t.role_group === 'General')) || []
    
    return (
      <motion.div
        layout
        className={`
          bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden
          ${draggedTask ? 'ring-2 ring-primary/30' : ''}
        `}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDropOnProject(project.id)}
      >
        {/* ヘッダー */}
        <div 
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          onClick={() => toggleProject(project.id)}
        >
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20` }}
          >
            <Folder className="w-5 h-5" style={{ color: project.color }} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-muted-foreground truncate">{project.description}</p>
            )}
          </div>
          
          <span className="text-sm text-muted-foreground">
            {project.tasks?.length || 0} {t('taskBoard.tasks')}
          </span>
          
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
          
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowChat(project.id);
              setChatHistory([{
                role: 'assistant',
                content: `こんにちは！プロジェクト「${project.name}」のワークフロー管理をお手伝いします。\n\n**できること:**\n- 📊 ワークフローの説明・解説\n- ✏️ タスクの一括編集\n- ➕ 新規タスクの作成\n- 🔗 依存関係の設定\n- ⏰ トリガーの設定\n\nどのようなお手伝いをしましょうか？`
              }]);
            }}
            className="p-2 rounded-lg hover:bg-primary/10 text-primary"
            title={t('taskBoard.chatWithAI')}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); setEditingProject(project); setShowProjectForm(true); }}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {/* コンテンツ */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-4 space-y-4">
                {/* 役割グループ */}
                {project.role_groups?.map(group => (
                  <RoleGroupSection
                    key={group.id}
                    group={group}
                    projectId={project.id}
                    tasks={project.tasks || []}
                  />
                ))}
                
                {/* グループ未割当タスク */}
                {ungroupedTasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('taskBoard.ungrouped')}
                    </h4>
                    {ungroupedTasks.map(task => (
                      <TaskCard key={task.id} task={task} projectId={project.id} />
                    ))}
                  </div>
                )}
                
                {/* アクション */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setShowGroupForm(project.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    {t('taskBoard.addRoleGroup')}
                  </button>
                  <button
                    onClick={() => { setEditingTask({ project_id: project.id }); setShowTaskForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('taskBoard.addTask')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // プロジェクト作成/編集フォーム
  const ProjectFormModal = () => {
    const [name, setName] = useState(editingProject?.name || '')
    const [description, setDescription] = useState(editingProject?.description || '')
    const [color, setColor] = useState(editingProject?.color || '#6366f1')
    
    const handleSubmit = async (e) => {
      e.preventDefault()
      if (editingProject?.id) {
        await updateProject(editingProject.id, { name, description, color })
      } else {
        await createProject({ name, description, color })
      }
      fetchBoardData()
      setShowProjectForm(false)
      setEditingProject(null)
    }
    
    const handleDelete = async () => {
      if (confirm(t('taskBoard.confirmDeleteProject').replace('{name}', editingProject.name))) {
        await deleteProject(editingProject.id)
        fetchBoardData()
        setShowProjectForm(false)
        setEditingProject(null)
      }
    }
    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-2xl"
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-foreground">
              {editingProject?.id ? t('taskBoard.editProject') : t('taskBoard.newProject')}
            </h3>
            <button
              onClick={() => { setShowProjectForm(false); setEditingProject(null); }}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('taskBoard.projectName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder={t('taskBoard.projectNamePlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('taskBoard.description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('taskBoard.color')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      color === c.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4">
              {editingProject?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  {t('common.delete')}
                </button>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingProject?.id ? t('common.save') : t('taskBoard.create')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    )
  }

  // 役割グループ作成/編集フォーム
  const RoleGroupFormModal = () => {
    const [name, setName] = useState(editingGroup?.name || '')
    const [description, setDescription] = useState(editingGroup?.description || '')
    const [color, setColor] = useState(editingGroup?.color || '#6366f1')
    
    const handleSubmit = async (e) => {
      e.preventDefault()
      if (editingGroup?.id) {
        await updateRoleGroup(editingGroup.id, { name, description, color })
      } else {
        await createRoleGroup(showGroupForm, { name, description, color, project_id: showGroupForm })
      }
      fetchBoardData()
      setShowGroupForm(null)
      setEditingGroup(null)
    }
    
    const handleDelete = async () => {
      if (confirm(t('taskBoard.confirmDeleteGroup').replace('{name}', editingGroup.name))) {
        await deleteRoleGroup(editingGroup.id)
        fetchBoardData()
        setShowGroupForm(null)
        setEditingGroup(null)
      }
    }
    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-2xl"
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-foreground">
              {editingGroup?.id ? t('taskBoard.editRoleGroup') : t('taskBoard.newRoleGroup')}
            </h3>
            <button
              onClick={() => { setShowGroupForm(null); setEditingGroup(null); }}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('taskBoard.groupName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder={t('taskBoard.groupNamePlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('taskBoard.description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('taskBoard.color')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      color === c.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4">
              {editingGroup?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  {t('common.delete')}
                </button>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingGroup?.id ? t('common.save') : t('taskBoard.create')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    )
  }

  // トリガー設定モーダル
  const TriggerModal = () => {
    const task = showTriggerModal
    const [triggerType, setTriggerType] = useState('time')
    const [triggerTime, setTriggerTime] = useState('09:00')
    const [triggerDays, setTriggerDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri'])
    const [dependsOnTaskId, setDependsOnTaskId] = useState('')
    const [triggerOnStatus, setTriggerOnStatus] = useState('completed')
    const [delayMinutes, setDelayMinutes] = useState(0)
    
    const allTasks = [
      ...(boardData?.projects?.flatMap(p => p.tasks) || []),
      ...(boardData?.unassigned_tasks || [])
    ].filter(t => t.id !== task?.id)
    
    const DAYS = [
      { id: 'mon', label: t('taskBoard.days.mon') },
      { id: 'tue', label: t('taskBoard.days.tue') },
      { id: 'wed', label: t('taskBoard.days.wed') },
      { id: 'thu', label: t('taskBoard.days.thu') },
      { id: 'fri', label: t('taskBoard.days.fri') },
      { id: 'sat', label: t('taskBoard.days.sat') },
      { id: 'sun', label: t('taskBoard.days.sun') },
    ]
    
    const handleAddTrigger = async () => {
      const triggerData = {
        task_id: task.id,
        trigger_type: triggerType,
        trigger_time: triggerType === 'time' ? triggerTime : null,
        trigger_days: triggerType === 'time' ? JSON.stringify(triggerDays) : null,
        depends_on_task_id: triggerType === 'dependency' ? parseInt(dependsOnTaskId) : null,
        trigger_on_status: triggerType === 'dependency' ? triggerOnStatus : 'completed',
        delay_minutes: delayMinutes,
        is_active: true
      }
      
      const result = await createTrigger(task.id, triggerData)
      if (result) {
        const triggers = await fetchTriggers(task.id)
        setTaskTriggers(triggers || [])
      }
    }
    
    const handleDeleteTrigger = async (triggerId) => {
      await deleteTrigger(triggerId)
      const triggers = await fetchTriggers(task.id)
      setTaskTriggers(triggers || [])
    }
    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('taskBoard.triggerSettings')}</h3>
              <p className="text-sm text-muted-foreground">{task?.name}</p>
            </div>
            <button
              onClick={() => setShowTriggerModal(null)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 既存のトリガー */}
            {taskTriggers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">{t('taskBoard.activeTriggers')}</h4>
                {taskTriggers.map(trigger => (
                  <div key={trigger.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      {trigger.trigger_type === 'time' && <Timer className="w-4 h-4 text-blue-500" />}
                      {trigger.trigger_type === 'dependency' && <GitBranch className="w-4 h-4 text-purple-500" />}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {trigger.trigger_type === 'time' && `${trigger.trigger_time} (${JSON.parse(trigger.trigger_days || '[]').join(', ')})`}
                          {trigger.trigger_type === 'dependency' && (
                            <>
                              {t('taskBoard.afterTask')}: {allTasks.find(t => t.id === trigger.depends_on_task_id)?.name || `ID: ${trigger.depends_on_task_id}`}
                            </>
                          )}
                        </p>
                        {trigger.delay_minutes > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('taskBoard.delayMinutes').replace('{minutes}', trigger.delay_minutes)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTrigger(trigger.id)}
                      className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* 新しいトリガーを追加 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">{t('taskBoard.addTrigger')}</h4>
              
              {/* トリガータイプ選択 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTriggerType('time')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    triggerType === 'time'
                      ? 'border-primary bg-primary/5'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <Timer className={`w-5 h-5 ${triggerType === 'time' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{t('taskBoard.timeTrigger')}</span>
                </button>
                <button
                  onClick={() => setTriggerType('dependency')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    triggerType === 'dependency'
                      ? 'border-primary bg-primary/5'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <GitBranch className={`w-5 h-5 ${triggerType === 'dependency' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{t('taskBoard.dependencyTrigger')}</span>
                </button>
              </div>
              
              {/* 時間トリガー設定 */}
              {triggerType === 'time' && (
                <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('taskBoard.triggerTime')}
                    </label>
                    <input
                      type="time"
                      value={triggerTime}
                      onChange={(e) => setTriggerTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('taskBoard.triggerDays')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(day => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            setTriggerDays(prev =>
                              prev.includes(day.id)
                                ? prev.filter(d => d !== day.id)
                                : [...prev, day.id]
                            )
                          }}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            triggerDays.includes(day.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-muted-foreground'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* 依存トリガー設定 */}
              {triggerType === 'dependency' && (
                <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('taskBoard.dependsOnTask')}
                    </label>
                    <select
                      value={dependsOnTaskId}
                      onChange={(e) => setDependsOnTaskId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                    >
                      <option value="">{t('taskBoard.selectTask')}</option>
                      {allTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('taskBoard.triggerOnStatus')}
                    </label>
                    <select
                      value={triggerOnStatus}
                      onChange={(e) => setTriggerOnStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                    >
                      <option value="completed">{t('taskBoard.statusCompleted')}</option>
                      <option value="failed">{t('taskBoard.statusFailed')}</option>
                      <option value="any">{t('taskBoard.statusAny')}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('taskBoard.delayAfter')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={delayMinutes}
                        onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                        min={0}
                        className="w-20 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                      />
                      <span className="text-sm text-muted-foreground">{t('taskBoard.minutes')}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleAddTrigger}
                disabled={triggerType === 'dependency' && !dependsOnTaskId}
                className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t('taskBoard.addTrigger')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // プロジェクトチャットパネル
  const ProjectChatPanel = () => {
    const project = boardData?.projects?.find(p => p.id === showChat)
    if (!project) return null
    
    // チャットスクロール
    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatHistory])
    
    const handleSendMessage = async () => {
      if (!chatInput.trim() || isChatLoading) return
      
      const userMessage = chatInput.trim()
      setChatInput('')
      setIsChatLoading(true)
      setPendingActions(null)
      
      // Webリサーチリクエストをチェック
      const webSearchMatch = userMessage.match(/(?:検索|調べて|リサーチ)[：:]\s*(.+)/i) || 
                             userMessage.match(/(?:search|research)[：:]\s*(.+)/i)
      
      try {
        // Webリサーチが必要な場合
        if (webSearchMatch) {
          const searchQuery = webSearchMatch[1]
          setChatHistory(prev => [...prev, {
            role: 'user',
            content: userMessage
          }])
          
          const searchResponse = await projectsApi.webSearch(showChat, searchQuery)
          const results = searchResponse.data.results
          
          setWebResearchResults(results)
          
          const resultsText = results.map((r, i) => 
            `${i + 1}. **${r.title}**\n   ${r.snippet || r.content?.slice(0, 200) || ''}\n   ${r.url ? `🔗 ${r.url}` : ''}`
          ).join('\n\n')
          
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `🔍 **Webリサーチ結果:**\n\n${resultsText}\n\nこの情報を基にワークフローを提案しましょうか？`
          }])
          
          setIsChatLoading(false)
          return
        }
        
        // プロジェクトのタスク数をチェックしてウィザードモードかどうか判断
        const projectTasks = boardData?.projects?.find(p => p.id === showChat)?.tasks || []
        const isWizardMode = projectTasks.length === 0
        
        if (isWizardMode) {
          // ウィザードモード（空プロジェクト用）
          const response = await projectsApi.wizardChat(
            showChat, 
            userMessage, 
            chatHistory,
            videoAnalysis,
            webResearchResults
          )
          setChatHistory(response.data.chat_history || [])
          
          // Webリサーチリクエストがあれば実行
          if (response.data.web_search_request) {
            const { query, reason } = response.data.web_search_request
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: `🔍 Webリサーチを実行中: ${reason || query}`
            }])
            
            const searchResponse = await projectsApi.webSearch(showChat, query)
            setWebResearchResults(searchResponse.data.results)
            
            // リサーチ結果を含めて再度チャット
            const followUp = await projectsApi.wizardChat(
              showChat,
              `リサーチ結果を確認しました。続けてください。`,
              response.data.chat_history,
              videoAnalysis,
              searchResponse.data.results
            )
            setChatHistory(followUp.data.chat_history || [])
            
            if (followUp.data.actions?.actions) {
              setPendingActions(followUp.data.actions.actions)
            }
          } else if (response.data.actions?.actions) {
            setPendingActions(response.data.actions.actions)
          }
        } else {
          // 通常モード（既存タスクがあるプロジェクト）
          const response = await projectsApi.chat(showChat, userMessage, chatHistory)
          setChatHistory(response.data.chat_history || [])
          
          if (response.data.actions?.actions) {
            setPendingActions(response.data.actions.actions)
          }
        }
      } catch (error) {
        console.error('Chat error:', error)
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `エラーが発生しました: ${error.message}`
        }])
      }
      
      setIsChatLoading(false)
    }
    
    const handleExecuteActions = async () => {
      if (!pendingActions) return
      
      setIsChatLoading(true)
      try {
        const response = await projectsApi.executeActions(showChat, pendingActions)
        
        // 成功メッセージを追加
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `✅ **アクションを実行しました！**\n\n${response.data.message}\n\n変更を確認するには、ページを更新してください。`
        }])
        
        setPendingActions(null)
        fetchBoardData()
      } catch (error) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `❌ アクションの実行に失敗しました: ${error.message}`
        }])
      }
      setIsChatLoading(false)
    }
    
    const handleGetExplanation = async () => {
      setIsChatLoading(true)
      try {
        const response = await projectsApi.getWorkflowExplanation(showChat)
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: response.data.explanation
        }])
      } catch (error) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `エラーが発生しました: ${error.message}`
        }])
      }
      setIsChatLoading(false)
    }
    
    // メッセージ内のJSONブロックをパース
    const parseMessage = (content) => {
      const parts = []
      let lastIndex = 0
      const jsonRegex = /```json\n([\s\S]*?)```/g
      let match
      
      while ((match = jsonRegex.exec(content)) !== null) {
        // JSONの前のテキスト
        if (match.index > lastIndex) {
          parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
        }
        
        // JSON部分
        try {
          const jsonData = JSON.parse(match[1])
          parts.push({ type: 'json', content: jsonData })
        } catch {
          parts.push({ type: 'code', content: match[1] })
        }
        
        lastIndex = match.index + match[0].length
      }
      
      // 残りのテキスト
      if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.slice(lastIndex) })
      }
      
      return parts.length > 0 ? parts : [{ type: 'text', content }]
    }
    
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed right-0 top-0 h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col ${
          isExpanded ? 'w-full md:w-2/3' : 'w-full md:w-[450px]'
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20` }}
          >
            <Bot className="w-5 h-5" style={{ color: project.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{t('taskBoard.aiAssistant')}</h3>
            <p className="text-xs text-muted-foreground truncate">{project.name}</p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { setShowChat(null); setChatHistory([]); setPendingActions(null); }}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* クイックアクション */}
        <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={handleGetExplanation}
            disabled={isChatLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {t('taskBoard.explainWorkflow')}
          </button>
          <button
            onClick={() => setChatInput(t('taskBoard.suggestImprovements'))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full whitespace-nowrap hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('taskBoard.suggest')}
          </button>
          <button
            onClick={() => setChatInput(t('taskBoard.addNewTask'))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full whitespace-nowrap hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('taskBoard.addTask')}
          </button>
          <button
            onClick={() => document.getElementById('video-upload')?.click()}
            disabled={isChatLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full whitespace-nowrap hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors"
          >
            <Video className="w-3.5 h-3.5" />
            {t('taskBoard.uploadVideo')}
          </button>
          <button
            onClick={() => setChatInput(t('taskBoard.webSearchPrompt'))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-full whitespace-nowrap hover:bg-cyan-200 dark:hover:bg-cyan-500/30 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            {t('taskBoard.webSearch')}
          </button>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              
              setIsChatLoading(true)
              setChatHistory(prev => [...prev, {
                role: 'user',
                content: `📹 動画をアップロードしました: ${file.name}`
              }])
              
              try {
                const response = await projectsApi.analyzeVideo(showChat, file)
                const analysis = response.data.analysis
                
                setChatHistory(prev => [...prev, {
                  role: 'assistant',
                  content: `🎬 **動画分析完了！**\n\n**概要:** ${analysis.summary || '分析中...'}\n\n**自動化候補:**\n${(analysis.automation_candidates || []).map(c => `- ${c}`).join('\n')}\n\n**提案されたタスク:**\n${(analysis.suggested_tasks || []).map(t => `- **${t.name}**: ${t.description}`).join('\n')}\n\nこの分析結果を基にワークフローを構築しましょうか？`
                }])
                
                // 分析結果を保存してウィザードモードで使用
                setVideoAnalysis(analysis)
              } catch (error) {
                setChatHistory(prev => [...prev, {
                  role: 'assistant',
                  content: `❌ 動画分析に失敗しました: ${error.message}`
                }])
              }
              
              setIsChatLoading(false)
              e.target.value = ''
            }}
          />
        </div>
        
        {/* チャット履歴 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-500'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block p-3 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
                }`}>
                  {parseMessage(msg.content).map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <div key={i} className="whitespace-pre-wrap">
                          {part.content.split('\n').map((line, j) => {
                            // マークダウン風の処理
                            if (line.startsWith('**') && line.endsWith('**')) {
                              return <p key={j} className="font-bold">{line.slice(2, -2)}</p>
                            }
                            if (line.startsWith('- ')) {
                              return <p key={j} className="pl-2">• {line.slice(2)}</p>
                            }
                            return <p key={j}>{line}</p>
                          })}
                        </div>
                      )
                    }
                    if (part.type === 'json' && part.content.actions) {
                      return (
                        <div key={i} className="mt-3 p-3 bg-zinc-200 dark:bg-zinc-700 rounded-lg">
                          <p className="text-xs font-semibold mb-2">{t('taskBoard.proposedActions')}:</p>
                          {part.content.actions.map((action, j) => (
                            <div key={j} className="text-xs flex items-center gap-2 py-1">
                              {action.type === 'update_task' && <Edit2 className="w-3 h-3 text-blue-500" />}
                              {action.type === 'create_task' && <Plus className="w-3 h-3 text-emerald-500" />}
                              {action.type === 'delete_task' && <Trash2 className="w-3 h-3 text-rose-500" />}
                              {action.type === 'create_trigger' && <Zap className="w-3 h-3 text-amber-500" />}
                              <span>{action.type}: {action.task_id || action.data?.name || ''}</span>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              </div>
            </div>
          ))}
          
          {/* ローディング */}
          {isChatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {/* アクション実行ボタン */}
          {pendingActions && pendingActions.length > 0 && (
            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">{t('taskBoard.confirmActions')}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {t('taskBoard.actionsWillExecute').replace('{count}', pendingActions.length)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleExecuteActions}
                  disabled={isChatLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {t('taskBoard.executeActions')}
                </button>
                <button
                  onClick={() => setPendingActions(null)}
                  className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
        
        {/* 入力フィールド */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={t('taskBoard.chatPlaceholder')}
              disabled={isChatLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isChatLoading}
              className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // タスク個別チャットパネル
  const TaskChatPanel = () => {
    const task = boardData?.projects?.flatMap(p => p.tasks || []).find(t => t.id === showTaskChat) ||
                 boardData?.unassigned_tasks?.find(t => t.id === showTaskChat)
    if (!task) return null
    
    useEffect(() => {
      taskChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [taskChatHistory])
    
    const handleTaskChatSend = async () => {
      if (!taskChatInput.trim() || taskChatLoading) return
      
      const userMessage = taskChatInput.trim()
      setTaskChatInput('')
      setTaskChatLoading(true)
      setTaskPendingActions(null)
      
      try {
        const response = await tasksApi.taskChat(showTaskChat, userMessage, taskChatHistory)
        setTaskChatHistory(response.data.chat_history || [])
        
        if (response.data.actions?.actions) {
          setTaskPendingActions(response.data.actions.actions)
        }
      } catch (error) {
        console.error('Task chat error:', error)
        setTaskChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `エラーが発生しました: ${error.message}`
        }])
      }
      
      setTaskChatLoading(false)
    }
    
    const handleTaskExecuteActions = async () => {
      if (!taskPendingActions) return
      
      setTaskChatLoading(true)
      try {
        const response = await tasksApi.executeTaskActions(showTaskChat, taskPendingActions)
        
        setTaskChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `✅ **変更を適用しました！**\n\n${response.data.message}`
        }])
        
        setTaskPendingActions(null)
        fetchBoardData()
      } catch (error) {
        setTaskChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `❌ 変更の適用に失敗しました: ${error.message}`
        }])
      }
      setTaskChatLoading(false)
    }
    
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col"
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
          <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{t('taskBoard.taskChat')}</h3>
            <p className="text-xs text-muted-foreground truncate">{task.name}</p>
          </div>
          <button
            onClick={() => { setShowTaskChat(null); setTaskChatHistory([]); setTaskPendingActions(null); }}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* タスク情報サマリー */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">実行場所:</span>
              <span className={task.execution_location === 'server' ? 'text-emerald-500' : 'text-amber-500'}>
                {task.execution_location === 'server' ? '🖥️ サーバー' : '💻 ローカル'}
              </span>
            </div>
            {task.schedule && (
              <div className="flex items-center gap-2">
                <span className="font-medium">スケジュール:</span>
                <span className="text-blue-500">{task.schedule}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium">ステータス:</span>
              <span className={task.is_active ? 'text-emerald-500' : 'text-zinc-500'}>
                {task.is_active ? '✅ 有効' : '⏸️ 無効'}
              </span>
            </div>
          </div>
        </div>
        
        {/* クイックアクション */}
        <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setTaskChatInput('このタスクの動作を説明してください')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full whitespace-nowrap hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            説明
          </button>
          <button
            onClick={() => setTaskChatInput('このタスクの指示を改善してください')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full whitespace-nowrap hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            改善
          </button>
          <button
            onClick={() => setTaskChatInput('スケジュールを変更したい')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full whitespace-nowrap hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            スケジュール
          </button>
        </div>
        
        {/* チャット履歴 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {taskChatHistory.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">このタスクについて質問してください</p>
              <p className="text-xs mt-1">ロジックの説明、設定の変更などをサポートします</p>
            </div>
          )}
          
          {taskChatHistory.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-500'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          
          {/* ローディング */}
          {taskChatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {/* アクション実行ボタン */}
          {taskPendingActions && taskPendingActions.length > 0 && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-cyan-500" />
                <span className="font-semibold text-foreground">変更の確認</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {taskPendingActions.length}件の変更を適用します
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleTaskExecuteActions}
                  disabled={taskChatLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  適用する
                </button>
                <button
                  onClick={() => setTaskPendingActions(null)}
                  className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
          
          <div ref={taskChatEndRef} />
        </div>
        
        {/* 入力フィールド */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={taskChatInput}
              onChange={(e) => setTaskChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTaskChatSend()}
              placeholder={t('taskBoard.taskChatPlaceholder')}
              disabled={taskChatLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={handleTaskChatSend}
              disabled={!taskChatInput.trim() || taskChatLoading}
              className="px-4 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (isLoading && !boardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {t('taskBoard.title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">{t('taskBoard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProjectForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <FolderPlus className="w-4 h-4" />
            {t('taskBoard.newProject')}
          </button>
        </div>
      </div>
      
      {/* プロジェクト一覧 */}
      <div className="space-y-4">
        {boardData?.projects?.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
        
        {/* 未割り当てタスク */}
        {boardData?.unassigned_tasks?.length > 0 && (
          <div
            className={`
              bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-4
              ${draggedTask ? 'border-primary bg-primary/5' : ''}
            `}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnProject(0)}
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('taskBoard.unassignedTasks')}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {boardData.unassigned_tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
        
        {/* 空状態 */}
        {(!boardData?.projects?.length && !boardData?.unassigned_tasks?.length) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Folder className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{t('taskBoard.empty')}</h3>
            <p className="text-muted-foreground mb-6">{t('taskBoard.emptyDesc')}</p>
            <button
              onClick={() => setShowProjectForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('taskBoard.createFirstProject')}
            </button>
          </motion.div>
        )}
      </div>
      
      {/* モーダル */}
      <AnimatePresence>
        {showProjectForm && <ProjectFormModal />}
        {(showGroupForm || editingGroup) && <RoleGroupFormModal />}
        {showTriggerModal && <TriggerModal />}
        {showTaskForm && (
          <TaskForm
            task={editingTask}
            onClose={() => {
              setShowTaskForm(false)
              setEditingTask(null)
              fetchBoardData()
            }}
          />
        )}
        {showChat && <ProjectChatPanel />}
        {showTaskChat && <TaskChatPanel />}
      </AnimatePresence>
    </div>
  )
}
