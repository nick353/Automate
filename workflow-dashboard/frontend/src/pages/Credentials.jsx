import { useEffect, useState } from 'react'
import { 
  Plus, 
  Trash2, 
  Edit2,
  TestTube,
  Check,
  X,
  ShieldCheck,
  Lock,
  Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useCredentialStore from '../stores/credentialStore'
import CredentialForm from '../components/CredentialForm'

const SERVICE_ICONS = {
  anthropic: { icon: '🤖', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  google: { icon: '🔍', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  openai: { icon: '🧠', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  slack: { icon: '💬', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  discord: { icon: '🎮', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  email: { icon: '✉️', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  custom: { icon: '🔧', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' }
}

export default function Credentials() {
  const { credentials, isLoading, fetchCredentials, deleteCredential, testCredential } = useCredentialStore()
  const [showForm, setShowForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [testingId, setTestingId] = useState(null)
  
  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])
  
  const handleEdit = (credential) => {
    setEditingCredential(credential)
    setShowForm(true)
  }
  
  const handleDelete = async (credential) => {
    if (window.confirm(`「${credential.name}」を削除してもよろしいですか？この操作は取り消せません。`)) {
      await deleteCredential(credential.id)
    }
  }
  
  const handleTest = async (credential) => {
    setTestingId(credential.id)
    const result = await testCredential(credential.id)
    setTestResults(prev => ({ ...prev, [credential.id]: result }))
    setTestingId(null)
  }
  
  const handleFormClose = () => {
    setShowForm(false)
    setEditingCredential(null)
    fetchCredentials()
  }
  
  const groupedCredentials = credentials.reduce((acc, cred) => {
    const type = cred.credential_type
    if (!acc[type]) acc[type] = []
    acc[type].push(cred)
    return acc
  }, {})

  const typeLabels = {
    api_key: 'APIキー',
    login: 'ログイン情報',
    oauth: 'OAuth認証'
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">認証情報</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">APIキーとログイン情報を安全に管理</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>認証情報を追加</span>
        </button>
      </div>
      
      {/* Security Banner */}
      <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-4">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-medium text-foreground text-sm">エンドツーエンド暗号化</h3>
          <p className="text-sm text-muted-foreground mt-1">
            認証情報はAES-256で暗号化されて保存されます。タスク実行時のみメモリ上で復号されます。
          </p>
        </div>
      </div>
      
      {/* Credentials Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 sm:p-12 text-center bg-muted/10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">認証情報がありません</h3>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">APIキーやログイン情報を追加して自動化を有効にしましょう</p>
          <button 
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            認証情報を追加
          </button>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-6 sm:space-y-8"
        >
          {Object.entries(groupedCredentials).map(([type, creds]) => (
            <div key={type}>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4 pl-1">
                {typeLabels[type] || type}
              </h2>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
                {creds.map((credential) => {
                  const style = SERVICE_ICONS[credential.service_name] || SERVICE_ICONS.custom
                  
                  return (
                    <motion.div 
                      key={credential.id} 
                      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                      className="group relative rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0 ${style.color}`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">{credential.name}</h3>
                            {credential.is_default && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
                                デフォルト
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {credential.service_name} • {credential.description || '説明なし'}
                          </p>
                          
                          {/* Test Result */}
                          {testResults[credential.id] && (
                            <div className="mt-2 space-y-1">
                              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                                testResults[credential.id].success 
                                  ? "text-emerald-600 dark:text-emerald-400" 
                                  : "text-rose-600 dark:text-rose-400"
                              }`}>
                                {testResults[credential.id].success ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                {testResults[credential.id].success ? '接続成功' : '接続失敗'}
                              </div>
                              {testResults[credential.id].message && (
                                <div className={`text-xs ${
                                  testResults[credential.id].success 
                                    ? "text-emerald-600/80 dark:text-emerald-400/80" 
                                    : "text-rose-600/80 dark:text-rose-400/80"
                                }`}>
                                  {testResults[credential.id].message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                          <button
                            onClick={() => handleTest(credential)}
                            disabled={testingId === credential.id}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="接続テスト"
                          >
                            {testingId === credential.id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(credential)}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="編集"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(credential)}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}
      
      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <CredentialForm
            credential={editingCredential}
            onClose={handleFormClose}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
