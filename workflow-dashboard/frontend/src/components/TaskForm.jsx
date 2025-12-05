import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Shield, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import useCredentialStore from '../stores/credentialStore'
import useTaskStore from '../stores/taskStore'

const CREDENTIAL_CONFIGS = {
  api_key: {
    anthropic: {
      label: 'Anthropic API Key',
      fields: [
        { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' }
      ]
    },
    google: {
      label: 'Google API Key',
      fields: [
        { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIza...' }
      ]
    },
    openai: {
      label: 'OpenAI API Key',
      fields: [
        { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' }
      ]
    }
  },
  login: {
    custom: {
      label: 'Site Login',
      fields: [
        { name: 'url', label: 'Login URL', type: 'text', placeholder: 'https://example.com/login' },
        { name: 'username', label: 'Username / Email', type: 'text', placeholder: 'user@example.com' },
        { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' }
      ]
    }
  },
  webhook: {
    slack: {
      label: 'Slack Webhook',
      fields: [
        { name: 'webhook_url', label: 'Webhook URL', type: 'password', placeholder: 'https://hooks.slack.com/...' }
      ]
    }
  }
}

export default function TaskForm({ task, onClose }) {
  const { createTask, updateTask } = useTaskStore()
  const { credentials, fetchCredentials } = useCredentialStore()
  const [isLoading, setIsLoading] = useState(false)
  
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
    site_credential_id: task?.site_credential_id || ''
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
      site_credential_id: formData.site_credential_id || null
    }
    
    try {
      if (task) {
        await updateTask(task.id, data)
      } else {
        await createTask(data)
      }
      onClose()
    } catch (error) {
      alert('Failed to save task: ' + error.message)
    }
    
    setIsLoading(false)
  }
  
  const apiKeyCredentials = credentials.filter(c => c.credential_type === 'api_key')
  const loginCredentials = credentials.filter(c => c.credential_type === 'login')
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {task ? 'Edit Task' : 'New Automated Task'}
            </h2>
            <p className="text-sm text-muted-foreground">Configure instructions and schedules for your agent.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Main Info */}
          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Task Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Monthly Sales Report Download"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Briefly describe what this task does..."
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
          
          {/* Prompt Area */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Natural Language Instructions *</label>
            <div className="relative">
              <textarea
                name="task_prompt"
                value={formData.task_prompt}
                onChange={handleChange}
                required
                rows={6}
                placeholder="Describe the workflow step-by-step. Example:&#10;1. Go to rakuten.co.jp&#10;2. Login using saved credentials&#10;3. Navigate to purchase history..."
                className="w-full p-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm resize-none"
              />
              <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-md border border-border">
                Markdown supported
              </div>
            </div>
          </div>
          
          {/* Credentials & Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">LLM Provider</label>
                <select
                  name="llm_credential_id"
                  value={formData.llm_credential_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="">Use System Default</option>
                  {apiKeyCredentials.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.service_name})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Site Login</label>
                <select
                  name="site_credential_id"
                  value={formData.site_credential_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="">None</option>
                  {loginCredentials.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-6">
               <div>
                <label className="block text-sm font-medium text-foreground mb-2">Schedule (Cron)</label>
                <input
                  type="text"
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleChange}
                  placeholder="e.g. 0 9 * * * (Every day at 9am)"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono"
                />
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
                  <span className="text-sm font-medium">Enable Task</span>
                </label>
                
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_on_failure"
                    checked={formData.notify_on_failure}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-primary focus:ring-primary bg-background border-border"
                  />
                  <span className="text-sm font-medium">Notify on Failure</span>
                </label>
              </div>
            </div>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-8 py-6 border-t border-border bg-muted/10 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-border font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            {isLoading ? 'Saving...' : (task ? 'Save Changes' : 'Create Task')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
