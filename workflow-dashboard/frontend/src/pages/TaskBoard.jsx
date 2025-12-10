import { useEffect, useState, useCallback } from 'react'
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
  Globe
} from 'lucide-react'
import useTaskStore from '../stores/taskStore'
import useLanguageStore from '../stores/languageStore'
import TaskForm from '../components/TaskForm'
import ProjectChatPanel from '../components/ProjectChatPanel'
import TaskChatPanel from '../components/TaskChatPanel'

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
  const [showTaskChat, setShowTaskChat] = useState(null) // task_id for individual task chat

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
    
    if (result?.execution_id || result?.status) {
      const executionId = result.execution_id || result.status
      // チャット側でログ表示するのでナビゲーションは任意
      navigate(`/execution/${executionId}`)
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
        {showChat && (() => {
          const project = boardData?.projects?.find(p => p.id === showChat)
          if (!project) return null
          return (
            <ProjectChatPanel
              key={`project-chat-${showChat}`}
              project={project}
              boardData={boardData}
              onClose={() => setShowChat(null)}
              onRefresh={fetchBoardData}
            />
          )
        })()}
        {showTaskChat && (() => {
          const task = boardData?.projects?.flatMap(p => p.tasks || []).find(t => t.id === showTaskChat) ||
                       boardData?.unassigned_tasks?.find(t => t.id === showTaskChat)
          if (!task) return null
          return (
            <TaskChatPanel
              key={`task-chat-${showTaskChat}`}
              task={task}
              onClose={() => setShowTaskChat(null)}
              onRefresh={fetchBoardData}
            />
          )
        })()}
      </AnimatePresence>
    </div>
  )
}

