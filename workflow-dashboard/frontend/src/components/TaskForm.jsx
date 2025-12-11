import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Shield, Lock, Monitor, Globe, Layers, Settings, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useCredentialStore from '../stores/credentialStore'
import useTaskStore from '../stores/taskStore'
import PermissionChecker from './PermissionChecker'
import TrialRunPreview from './TrialRunPreview'
import useLanguageStore from '../stores/languageStore'

export default function TaskForm({ task, onClose }) {
  const { createTask, updateTask } = useTaskStore()
  const { credentials, fetchCredentials } = useCredentialStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPermissionChecker, setShowPermissionChecker] = useState(false)
  const [showTrialRun, setShowTrialRun] = useState(false)
  const { t } = useLanguageStore()
  
  // 実行場所の定義（実行タイプと紐づけ）
  const EXECUTION_LOCATIONS = [
    { 
      type: 'server', 
      label: t('tasks.serverExecution'), 
      description: t('tasks.serverDesc'),
      icon: Globe, 
      color: 'text-blue-500',
      executionType: 'web',
      features: t('tasks.serverInfoPoints')
    },
    { 
      type: 'local', 
      label: t('tasks.localExecution'), 
      description: t('tasks.localDesc'),
      icon: Monitor, 
      color: 'text-purple-500',
      executionType: 'desktop',
      features: t('tasks.localWarningPoints')
    },
  ]
  
  const [formData, setFormData] = useState({
    name: task?.name || '',
    description: task?.description || '',
    task_prompt: task?.task_prompt || '',
    schedule: task?.schedule || '',
    is_active: task?.is_active ?? true,
    notify_on_success: task?.notify_on_success ?? false,
    notify_on_failure: task?.notify_on_failure ?? true,
    notification_channel: task?.notification_channel || '',
    llm_credential_id: task?.llm_credential_id || '',
    site_credential_id: task?.site_credential_id || '',
    // 新しいフィールド
    execution_location: task?.execution_location || 'server',
    execution_type: task?.execution_type || 'web',
    max_steps: task?.max_steps || 20,
    lux_credential_id: task?.lux_credential_id || ''
  })
  
  useEffect(() => {
    fetchCredentials()
  }, [])
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    const data = {
      ...formData,
      llm_credential_id: formData.llm_credential_id || null,
      site_credential_id: formData.site_credential_id || null,
      lux_credential_id: formData.lux_credential_id || null,
      max_steps: parseInt(formData.max_steps) || 20
    }
    
    try {
      if (task) {
        await updateTask(task.id, data)
      } else {
        await createTask(data)
      }
      onClose()
    } catch (error) {
      alert(t('common.error') + ': ' + error.message)
    }
    
    setIsLoading(false)
  }
  
  const apiKeyCredentials = credentials.filter(c => c.credential_type === 'api_key')
  const loginCredentials = credentials.filter(c => c.credential_type === 'login')
  const luxCredentials = credentials.filter(c => c.credential_type === 'api_key' && c.service_name === 'oagi')
  
  // ローカル実行の場合はLux認証情報が必要
  const needsLuxCredential = formData.execution_location === 'local'
  
  // 実行場所に応じて実行タイプを自動設定
  const handleLocationChange = (locationType) => {
    const location = EXECUTION_LOCATIONS.find(l => l.type === locationType)
    setFormData(prev => ({
      ...prev,
      execution_location: locationType,
      execution_type: location?.executionType || 'web'
    }))
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col font-mono"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {task ? t('tasks.editTask') : t('tasks.newTaskTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('tasks.configureInstructions')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Main Info */}
          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.taskName')} *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder={t('tasks.taskNamePlaceholder')}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.description')}</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder={t('tasks.descriptionPlaceholder')}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
          
          {/* Execution Location Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">{t('tasks.executionLocation')} *</label>
            <div className="grid grid-cols-2 gap-4">
              {EXECUTION_LOCATIONS.map(({ type, label, description, icon: Icon, color, features }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleLocationChange(type)}
                  className={`relative p-5 rounded-sm border-2 transition-all text-left ${
                    formData.execution_location === type
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : 'border-border hover:border-primary/30 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2.5 rounded-sm ${formData.execution_location === type ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`w-6 h-6 ${formData.execution_location === type ? 'text-primary' : color}`} />
                    </div>
                    <div>
                      <span className="font-bold text-foreground block">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {type === 'server' ? 'Browser Use' : 'Lux (OAGI)'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {features.map((feature, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-sm bg-muted text-xs text-muted-foreground">
                        {feature}
                      </span>
                    ))}
                  </div>
                  {formData.execution_location === type && (
                    <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              ))}
            </div>
            
            {/* ローカル実行の注意事項 */}
            {formData.execution_location === 'local' && (
              <div className="mt-4 p-4 rounded-sm bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-start gap-3">
                  <Monitor className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">{t('tasks.localWarning')}</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {t('tasks.localWarningPoints').map((point, i) => (
                        <li key={i}>• {point}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setShowPermissionChecker(true)}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-purple-500/20 text-purple-500 hover:bg-purple-500/30 transition-colors text-sm font-medium"
                    >
                      <Settings className="w-4 h-4" />
                      {t('tasks.checkPermissions')}
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Execution Type Selection */}
          <div className="grid gap-2">
            <label className="block text-sm font-medium text-foreground">
              実行タイプ（ブラウザ不要なら「api」を選択）
            </label>
            <select
              name="execution_type"
              value={formData.execution_type}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            >
              <option value="api">api（ブラウザ不要のAPI専用）</option>
              <option value="web">web（Browser Useでブラウザ操作）</option>
              <option value="hybrid">hybrid（API前処理後にブラウザ）</option>
              <option value="desktop">desktop（ローカルAgentでデスクトップ操作）</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Drive監視などブラウザ不要タスクは api を選択してください。ブラウザを使うタスクのみ web/hybrid を選択します。
            </p>
          </div>
            
            {/* サーバー実行の説明 */}
            {formData.execution_location === 'server' && (
              <div className="mt-4 p-4 rounded-sm bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t('tasks.serverInfo')}</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {t('tasks.serverInfoPoints').map((point, i) => (
                        <li key={i}>• {point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Prompt Area */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.naturalLanguageInstructions')} *</label>
            <div className="relative">
              <textarea
                name="task_prompt"
                value={formData.task_prompt}
                onChange={handleChange}
                required
                rows={6}
                placeholder={formData.execution_type === 'desktop' 
                  ? t('tasks.instructionsPlaceholderDesktop')
                  : t('tasks.instructionsPlaceholderWeb')}
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-border rounded-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm resize-none"
              />
              <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-sm border border-border">
                {t('tasks.markdownSupported')}
              </div>
            </div>
          </div>
          
          {/* Credentials & Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.llmProvider')}</label>
                <select
                  name="llm_credential_id"
                  value={formData.llm_credential_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="">{t('tasks.useSystemDefault')}</option>
                  {apiKeyCredentials.filter(c => c.service_name !== 'oagi').map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.service_name})</option>
                  ))}
                </select>
              </div>
              
              {/* Lux Credential - only show for desktop/hybrid */}
              {needsLuxCredential && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <span className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-purple-500" />
                      {t('tasks.luxApiKey')}
                    </span>
                  </label>
                  <select
                    name="lux_credential_id"
                    value={formData.lux_credential_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="">{t('tasks.useSystemDefault')}</option>
                    {luxCredentials.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {luxCredentials.length === 0 && (
                    <p className="mt-2 text-xs text-amber-500">
                      {t('tasks.noLuxKey')}
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.siteLogin')}</label>
                <select
                  name="site_credential_id"
                  value={formData.site_credential_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="">{t('tasks.none')}</option>
                  {loginCredentials.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-6">
               <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.schedule')}</label>
                <input
                  type="text"
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleChange}
                  placeholder={t('tasks.schedulePlaceholder')}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('tasks.maxSteps')}</label>
                <input
                  type="number"
                  name="max_steps"
                  value={formData.max_steps}
                  onChange={handleChange}
                  min={1}
                  max={100}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('tasks.maxStepsHelp')}
                </p>
              </div>
              
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-primary focus:ring-primary bg-background border-border"
                  />
                  <span className="text-sm font-medium">{t('tasks.enableTask')}</span>
                </label>
                
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_on_failure"
                    checked={formData.notify_on_failure}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-primary focus:ring-primary bg-background border-border"
                  />
                  <span className="text-sm font-medium">{t('tasks.notifyOnFailure')}</span>
                </label>
              </div>
            </div>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-8 py-6 border-t border-border bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-between gap-4">
          {/* 試運転ボタン（ローカルPC実行時のみ表示） */}
          <div>
            {formData.execution_location === 'local' && formData.task_prompt && (
              <button
                type="button"
                onClick={() => setShowTrialRun(true)}
                className="px-4 py-2.5 rounded-sm bg-purple-500/10 text-purple-500 border border-purple-500/30 font-medium hover:bg-purple-500/20 transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {t('tasks.trialRun')}
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-sm border border-border font-medium hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-sm bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              {isLoading ? t('tasks.saving') : (task ? t('tasks.saveChanges') : t('tasks.createTask'))}
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Permission Checker Modal */}
      <AnimatePresence>
        {showPermissionChecker && (
          <PermissionChecker onClose={() => setShowPermissionChecker(false)} />
        )}
      </AnimatePresence>
      
      {/* Trial Run Preview Modal */}
      <AnimatePresence>
        {showTrialRun && (
          <TrialRunPreview
            taskPrompt={formData.task_prompt}
            executionType={formData.execution_type}
            maxSteps={parseInt(formData.max_steps) || 10}
            onComplete={(result) => {
              setShowTrialRun(false)
              // 試運転成功後、そのまま登録することも可能
            }}
            onClose={() => setShowTrialRun(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
