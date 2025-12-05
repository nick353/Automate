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

const steps = [
  { id: 1, title: 'URL', fullTitle: 'TARGET_URL', description: 'Set destination', icon: Globe },
  { id: 2, title: 'ACTIONS', fullTitle: 'ACTIONS', description: 'Define steps', icon: MousePointer },
  { id: 3, title: 'SCHEDULE', fullTitle: 'SCHEDULE', description: 'Set timing', icon: Clock },
  { id: 4, title: 'DEPLOY', fullTitle: 'CONFIRM', description: 'Review', icon: Check },
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
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-cyan-400 mb-1.5 sm:mb-2 tracking-wider">
                TASK_NAME
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="e.g., Daily_Report"
                className="w-full h-10 sm:h-12 px-3 sm:px-4 rounded-sm bg-black/50 border border-gray-800 text-cyan-100 text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-cyan-400 mb-1.5 sm:mb-2 tracking-wider">
                TARGET_URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => updateFormData('url', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-sm bg-black/50 border border-gray-800 text-cyan-100 text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono"
                />
              </div>
            </div>
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <p className="text-[10px] sm:text-xs text-gray-500 font-mono">AUTOMATION_SEQUENCE</p>
              <button
                onClick={addAction}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-sm bg-cyan-500/20 text-cyan-400 text-[10px] sm:text-xs font-bold border border-cyan-500/50 hover:bg-cyan-500/40 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden xs:inline">ADD</span>
              </button>
            </div>
            
            <div className="space-y-2 sm:space-y-3 max-h-[200px] sm:max-h-[300px] overflow-y-auto pr-1 sm:pr-2">
              {formData.actions.map((action, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 sm:p-4 rounded-sm bg-black/30 border border-gray-800 space-y-2 sm:space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-mono text-gray-500">#{index + 1}</span>
                    {formData.actions.length > 1 && (
                      <button
                        onClick={() => removeAction(index)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(index, 'type', e.target.value)}
                      className="h-8 sm:h-10 px-2 sm:px-3 rounded-sm bg-black/50 border border-gray-800 text-cyan-100 text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
                    >
                      <option value="click">CLICK</option>
                      <option value="type">TYPE</option>
                      <option value="wait">WAIT</option>
                      <option value="scroll">SCROLL</option>
                      <option value="screenshot">SCREENSHOT</option>
                    </select>
                    
                    <input
                      type="text"
                      value={action.selector}
                      onChange={(e) => updateAction(index, 'selector', e.target.value)}
                      placeholder="Selector"
                      className="h-8 sm:h-10 px-2 sm:px-3 rounded-sm bg-black/50 border border-gray-800 text-cyan-100 text-xs sm:text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    
                    <input
                      type="text"
                      value={action.value}
                      onChange={(e) => updateAction(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="h-8 sm:h-10 px-2 sm:px-3 rounded-sm bg-black/50 border border-gray-800 text-cyan-100 text-xs sm:text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-cyan-400 mb-1.5 sm:mb-2 tracking-wider">
                CRON_SCHEDULE
              </label>
              <div className="relative">
                <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => updateFormData('schedule', e.target.value)}
                  placeholder="0 9 * * *"
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-sm bg-black/50 border border-gray-800 text-cyan-100 text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono"
                />
              </div>
              <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-600 font-mono">
                Empty = manual only
              </p>
            </div>
            
            <div className="p-3 sm:p-4 rounded-sm bg-cyan-500/5 border border-cyan-500/20">
              <p className="text-[10px] sm:text-xs text-cyan-400 font-bold mb-2">FORMAT</p>
              <div className="grid grid-cols-5 gap-1 sm:gap-2 text-[9px] sm:text-xs font-mono text-gray-500">
                <div className="text-center">
                  <div className="text-cyan-400">*</div>
                  <div>MIN</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400">*</div>
                  <div>HR</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400">*</div>
                  <div>DAY</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400">*</div>
                  <div>MON</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400">*</div>
                  <div>WK</div>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="p-3 sm:p-4 rounded-sm bg-black/30 border border-gray-800 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-[10px] sm:text-xs text-gray-500 font-mono">NAME</span>
                <span className="text-xs sm:text-sm text-cyan-400 font-bold truncate max-w-[150px] sm:max-w-[200px]">{formData.name || 'Unnamed'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-[10px] sm:text-xs text-gray-500 font-mono">URL</span>
                <span className="text-xs sm:text-sm text-cyan-400 font-mono truncate max-w-[150px] sm:max-w-[200px]">{formData.url || '---'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-[10px] sm:text-xs text-gray-500 font-mono">ACTIONS</span>
                <span className="text-xs sm:text-sm text-cyan-400 font-bold">{formData.actions.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[10px] sm:text-xs text-gray-500 font-mono">SCHEDULE</span>
                <span className="text-xs sm:text-sm text-cyan-400 font-mono">{formData.schedule || 'MANUAL'}</span>
              </div>
            </div>
            
            {error && (
              <div className="p-3 sm:p-4 rounded-sm bg-red-500/10 border border-red-500/30 flex items-center gap-2 sm:gap-3">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
                <p className="text-xs sm:text-sm text-red-400 font-mono">{error}</p>
              </div>
            )}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="p-1.5 sm:p-2 rounded-sm bg-purple-500/20 border border-purple-500/50">
            <Wand2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" style={{ filter: 'drop-shadow(0 0 8px #a855f7)' }} />
          </div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight">TASK WIZARD</h1>
        </div>
        <p className="text-gray-500 font-mono text-[10px] sm:text-xs lg:text-sm">&gt; CREATE_AUTOMATION</p>
      </motion.div>

      {/* Progress Steps */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-sm border transition-all ${
                currentStep >= step.id 
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
                  : 'bg-black/30 border-gray-800 text-gray-600'
              }`}>
                <step.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-1 sm:mx-2 transition-all ${
                  currentStep > step.id ? 'bg-cyan-500' : 'bg-gray-800'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5 sm:mt-2">
          {steps.map((step) => (
            <div key={step.id} className="flex-1 text-center px-0.5">
              <p className={`text-[8px] sm:text-[10px] font-bold tracking-wider truncate ${
                currentStep >= step.id ? 'text-cyan-400' : 'text-gray-600'
              }`}>
                <span className="sm:hidden">{step.title}</span>
                <span className="hidden sm:inline">{step.fullTitle}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <motion.div 
        className="rounded-sm border border-cyan-500/20 bg-black/40 backdrop-blur-sm p-4 sm:p-5 lg:p-6"
      >
        <div className="mb-4 sm:mb-6">
          <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white mb-0.5 sm:mb-1">{steps[currentStep - 1].fullTitle}</h2>
          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 font-mono">{steps[currentStep - 1].description}</p>
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
        <div className="flex items-center justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-800">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm text-xs sm:text-sm font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">BACK</span>
          </button>
          
          {currentStep < steps.length ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-sm bg-cyan-500/20 text-cyan-400 text-xs sm:text-sm font-bold uppercase tracking-wider border border-cyan-500/50 hover:bg-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95 transition-all"
            >
              NEXT
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-sm bg-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-bold uppercase tracking-wider border border-emerald-500/50 hover:bg-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-50 active:scale-95 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
                  <span className="hidden xs:inline">DEPLOYING...</span>
                  <span className="xs:hidden">...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  DEPLOY
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
