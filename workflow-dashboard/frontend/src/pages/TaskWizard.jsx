import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wand2, 
  ArrowRight, 
  ArrowLeft, 
  Globe, 
  MousePointer, 
  Clock,
  Check,
  Terminal,
  Zap,
  AlertTriangle,
  Plus,
  Trash2
} from 'lucide-react'
import { tasksApi } from '../services/api'
import { cn } from '../utils/cn'

const steps = [
  { id: 1, title: 'URL', fullTitle: 'Target URL', description: 'Where should the automation run?', icon: Globe },
  { id: 2, title: 'Actions', fullTitle: 'Define Actions', description: 'What should the automation do?', icon: MousePointer },
  { id: 3, title: 'Schedule', fullTitle: 'Schedule', description: 'When should it run?', icon: Clock },
  { id: 4, title: 'Review', fullTitle: 'Review & Deploy', description: 'Ready to launch?', icon: Check },
]

export default function TaskWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    actions: [{ type: 'click', selector: '', value: '' }],
    schedule: '',
    is_active: true
  })

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'click', selector: '', value: '' }]
    }))
  }

  const updateAction = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }))
  }

  const removeAction = (index) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }))
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')
    
    try {
      const taskData = {
        name: formData.name || `Task_${Date.now()}`,
        url: formData.url,
        actions: JSON.stringify(formData.actions),
        schedule: formData.schedule || null,
        is_active: formData.is_active
      }
      
      await tasksApi.create(taskData)
      navigate('/tasks')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Task Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="e.g., Daily Report Scraper"
                className="w-full h-12 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Target URL
              </label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => updateFormData('url', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground font-medium">Automation Sequence</p>
              <button
                onClick={addAction}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </button>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {formData.actions.map((action, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Step {index + 1}</span>
                    {formData.actions.length > 1 && (
                      <button
                        onClick={() => removeAction(index)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(index, 'type', e.target.value)}
                      className="h-10 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-foreground text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="click">Click</option>
                      <option value="type">Type</option>
                      <option value="wait">Wait</option>
                      <option value="scroll">Scroll</option>
                      <option value="screenshot">Screenshot</option>
                    </select>
                    
                    <input
                      type="text"
                      value={action.selector}
                      onChange={(e) => updateAction(index, 'selector', e.target.value)}
                      placeholder="Selector (.class, #id)"
                      className="h-10 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                    />
                    
                    <input
                      type="text"
                      value={action.value}
                      onChange={(e) => updateAction(index, 'value', e.target.value)}
                      placeholder="Value (text to type)"
                      className="h-10 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Cron Schedule
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => updateFormData('schedule', e.target.value)}
                  placeholder="0 9 * * *"
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Leave empty for manual execution only.
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs font-bold text-primary mb-2">CRON FORMAT</p>
              <div className="grid grid-cols-5 gap-2 text-xs font-mono text-muted-foreground">
                <div className="text-center">
                  <div className="text-primary">*</div>
                  <div>MIN</div>
                </div>
                <div className="text-center">
                  <div className="text-primary">*</div>
                  <div>HOUR</div>
                </div>
                <div className="text-center">
                  <div className="text-primary">*</div>
                  <div>DAY</div>
                </div>
                <div className="text-center">
                  <div className="text-primary">*</div>
                  <div>MONTH</div>
                </div>
                <div className="text-center">
                  <div className="text-primary">*</div>
                  <div>WEEK</div>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-bold text-foreground">{formData.name || 'Unnamed Task'}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm text-muted-foreground">URL</span>
                <span className="text-sm font-mono text-foreground truncate max-w-[200px]">{formData.url || '---'}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm text-muted-foreground">Actions</span>
                <span className="text-sm font-bold text-foreground">{formData.actions.length} Steps</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Schedule</span>
                <span className="text-sm font-mono text-foreground">{formData.schedule || 'Manual'}</span>
              </div>
            </div>
            
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">{error}</p>
              </div>
            )}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg">
            <Wand2 className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Task Wizard</h1>
        </div>
        <p className="text-muted-foreground text-lg">Create automation workflows with AI assistance</p>
      </motion.div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {/* Connector Line */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 -z-10" />
          
          {steps.map((step, index) => {
            const isActive = currentStep >= step.id
            const isCompleted = currentStep > step.id
            
            return (
              <div key={step.id} className="flex flex-col items-center bg-background px-2">
                <div 
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                    isActive 
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25" 
                      : "bg-background border-zinc-200 dark:border-zinc-800 text-muted-foreground"
                  )}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-xs font-bold transition-colors duration-300",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {step.fullTitle}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <motion.div 
        className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/40 backdrop-blur-sm p-6 md:p-8 shadow-xl shadow-black/5 dark:shadow-none"
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1">{steps[currentStep - 1].fullTitle}</h2>
          <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          {currentStep < steps.length ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-white text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Terminal className="w-4 h-4 animate-pulse" />
                  <span>Deploying...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Deploy Task</span>
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
