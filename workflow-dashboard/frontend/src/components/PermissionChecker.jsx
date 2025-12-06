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

export default function PermissionChecker({ onClose }) {
  const [status, setStatus] = useState(null)
  const [instructions, setInstructions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  
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
      console.error('権限チェックエラー:', error)
      setStatus({
        message: 'サーバーに接続できません。バックエンドが起動しているか確認してください。',
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
      if (itemStatus === true) return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle, label: '許可済み' }
      if (itemStatus === false) return { color: 'text-rose-500', bg: 'bg-rose-500/10', icon: XCircle, label: '未許可' }
      return { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: AlertTriangle, label: '確認不可' }
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
                <h2 className="text-xl font-bold text-foreground">デスクトップ権限設定</h2>
                <p className="text-sm text-muted-foreground">Lux (OAGI) を使用するための設定</p>
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
                  name="OAGI SDK"
                  icon={Terminal}
                  status={status.oagi_installed}
                  description="Lux デスクトップ自動化のSDK"
                />
                <PermissionItem
                  name="OAGI API Key"
                  icon={Key}
                  status={status.oagi_api_key_set}
                  description="developer.agiopen.org で取得"
                />
                <PermissionItem
                  name="画面収録"
                  icon={Eye}
                  status={status.screen_recording}
                  description="スクリーンショットの取得に必要"
                />
                <PermissionItem
                  name="アクセシビリティ"
                  icon={Monitor}
                  status={status.accessibility}
                  description="マウス・キーボード操作に必要"
                />
              </div>
              
              {/* Instructions */}
              {instructions && instructions.platform === 'macOS' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">設定手順</h3>
                  
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
                              <><Check className="w-3 h-3" /> コピー済み</>
                            ) : (
                              <><Copy className="w-3 h-3" /> コマンドをコピー</>
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
                        <span className="text-zinc-400">ターミナルで確認:</span>
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
                    <p className="font-medium text-foreground">OAGI API Key が必要です</p>
                    <p className="text-sm text-muted-foreground">OpenAGI Developer Console で取得してください</p>
                  </div>
                  <a
                    href="https://developer.agiopen.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
                  >
                    取得する <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              権限情報を取得できませんでした
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border font-medium hover:bg-muted transition-colors"
          >
            閉じる
          </button>
          <button
            onClick={checkPermissions}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            再チェック
          </button>
        </div>
      </motion.div>
    </div>
  )
}

