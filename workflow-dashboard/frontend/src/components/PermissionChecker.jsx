import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Monitor, 
  Eye, 
  Key,
  ExternalLink,
  RefreshCw,
  Terminal,
  Copy,
  Check
} from 'lucide-react'
import api from '../services/api'
import useLanguageStore from '../stores/languageStore'

export default function PermissionChecker({ onClose }) {
  const [status, setStatus] = useState(null)
  const [instructions, setInstructions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const { t } = useLanguageStore()
  
  const checkPermissions = async () => {
    setLoading(true)
    try {
      const [permResponse, instructResponse] = await Promise.all([
        api.get('/system/permissions'),
        api.get('/system/permissions/instructions')
      ])
      setStatus(permResponse.data)
      setInstructions(instructResponse.data)
    } catch (error) {
      console.error('Permission check error:', error)
      setStatus({
        message: t('permissions.errorFetch'),
        platform: 'unknown'
      })
    }
    setLoading(false)
  }
  
  useEffect(() => {
    checkPermissions()
  }, [])
  
  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }
  
  const PermissionItem = ({ name, icon: Icon, status: itemStatus, description }) => {
    const getStatusInfo = () => {
      if (itemStatus === true) return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle, label: t('permissions.allowed') }
      if (itemStatus === false) return { color: 'text-rose-500', bg: 'bg-rose-500/10', icon: XCircle, label: t('permissions.denied') }
      return { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: AlertTriangle, label: t('permissions.unknown') }
    }
    
    const { color, bg, icon: StatusIcon, label } = getStatusInfo()
    
    return (
      <div className={`p-4 rounded-xl border ${itemStatus === true ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/20'}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{name}</span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${bg} ${color}`}>
                <StatusIcon className="w-3 h-3" />
                {label}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <Monitor className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{t('permissions.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('permissions.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={checkPermissions}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : status ? (
            <>
              {/* Status Message */}
              {status.message && (
                <div className={`p-4 rounded-xl ${
                  status.screen_recording && status.accessibility && status.oagi_api_key_set
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}>
                  {status.message}
                </div>
              )}
              
              {/* Permission Items */}
              <div className="space-y-3">
                <PermissionItem
                  name={t('permissions.oagiSdk')}
                  icon={Terminal}
                  status={status.oagi_installed}
                  description={t('permissions.oagiSdkDesc')}
                />
                <PermissionItem
                  name={t('permissions.oagiApiKey')}
                  icon={Key}
                  status={status.oagi_api_key_set}
                  description={t('permissions.oagiApiKeyDesc')}
                />
                <PermissionItem
                  name={t('permissions.screenRecording')}
                  icon={Eye}
                  status={status.screen_recording}
                  description={t('permissions.screenRecordingDesc')}
                />
                <PermissionItem
                  name={t('permissions.accessibility')}
                  icon={Monitor}
                  status={status.accessibility}
                  description={t('permissions.accessibilityDesc')}
                />
              </div>
              
              {/* Instructions */}
              {instructions && instructions.platform === 'macOS' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">{t('permissions.instructions')}</h3>
                  
                  {Object.entries(instructions.instructions).map(([key, instruction]) => (
                    <div key={key} className="p-4 rounded-xl bg-muted/30 border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-foreground">{instruction.title}</span>
                        {instruction.command && (
                          <button
                            onClick={() => copyToClipboard(instruction.command, key)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                          >
                            {copied === key ? (
                              <><Check className="w-3 h-3" /> {t('permissions.copied')}</>
                            ) : (
                              <><Copy className="w-3 h-3" /> {t('permissions.copyCommand')}</>
                            )}
                          </button>
                        )}
                      </div>
                      <ol className="space-y-2">
                        {instruction.steps.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {idx + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  
                  {/* CLI Check Command */}
                  {instructions.cli_check && (
                    <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-400">{t('permissions.terminalCheck')}</span>
                        <button
                          onClick={() => copyToClipboard(instructions.cli_check, 'cli')}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors"
                        >
                          {copied === 'cli' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <code className="text-emerald-400">$ {instructions.cli_check}</code>
                    </div>
                  )}
                </div>
              )}
              
              {/* API Key Link */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-purple-500" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{t('permissions.needApiKey')}</p>
                    <p className="text-sm text-muted-foreground">OpenAGI Developer Console</p>
                  </div>
                  <a
                    href="https://developer.agiopen.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
                  >
                    {t('permissions.getIt')} <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t('permissions.errorFetch')}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border font-medium hover:bg-muted transition-colors"
          >
            {t('common.close')}
          </button>
          <button
            onClick={checkPermissions}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('permissions.recheck')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
