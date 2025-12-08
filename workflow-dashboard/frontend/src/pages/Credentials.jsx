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
import { BentoGrid, BentoItem } from '../components/Bento/BentoGrid'
import useLanguageStore from '../stores/languageStore'

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
  const { t } = useLanguageStore()
  
  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])
  
  const handleEdit = (e, credential) => {
    e.stopPropagation()
    setEditingCredential(credential)
    setShowForm(true)
  }
  
  const handleDelete = async (e, credential) => {
    e.stopPropagation()
    if (window.confirm(t('credentials.confirmDelete').replace('{name}', credential.name))) {
      await deleteCredential(credential.id)
    }
  }
  
  const handleTest = async (e, credential) => {
    e.stopPropagation()
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
    api_key: t('credentials.apiKeys'),
    login: t('credentials.loginCreds'),
    oauth: t('credentials.oauthTokens'),
    webhook: t('credentials.webhook'),
    smtp: t('credentials.smtp')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">{t('credentials.title')}</h1>
          <p className="text-muted-foreground mt-1 text-lg">{t('credentials.subtitle')}</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm bg-black dark:bg-white text-white dark:text-black font-bold shadow-lg hover:scale-105 transition-all w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>{t('credentials.addCredential')}</span>
        </button>
      </div>
      
      {/* Security Banner - Bento Item */}
      <BentoGrid className="md:grid-cols-1">
        <BentoItem 
            className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 md:col-span-1"
            header={null}
            icon={<ShieldCheck className="w-8 h-8 text-blue-500" />}
            title={t('credentials.encryptionTitle')}
            description={t('credentials.encryptionDesc')}
        />
      </BentoGrid>
      
      {/* Credentials Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-sm border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="w-16 h-16 mx-auto mb-4 rounded-sm bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
            <Lock className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('credentials.noCredentials')}</h3>
          <p className="text-muted-foreground mb-6">{t('credentials.addFirst')}</p>
          <button 
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-sm bg-primary text-primary-foreground font-bold hover:scale-105 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('credentials.addCredential')}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedCredentials).map(([type, creds]) => (
            <div key={type}>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 pl-1">
                {typeLabels[type] || type}
              </h2>
              <BentoGrid>
                {creds.map((credential) => {
                  const style = SERVICE_ICONS[credential.service_name] || SERVICE_ICONS.custom
                  
                  return (
                    <BentoItem 
                      key={credential.id}
                      className="md:col-span-1"
                      title={credential.name}
                      description={credential.description || 'No description'}
                      onClick={() => {}}
                      header={
                        <div className={`flex flex-1 w-full h-full min-h-[6rem] items-center justify-center text-4xl ${style.color}`}>
                            {style.icon}
                        </div>
                      }
                    >
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                             <div className="flex items-center gap-2">
                                {credential.is_default && (
                                    <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                        DEFAULT
                                    </span>
                                )}
                                <span className="text-xs text-muted-foreground font-mono">{credential.service_name}</span>
                             </div>
                             
                             {testResults[credential.id] && (
                                <div className={`flex items-center gap-1 text-xs font-bold ${
                                    testResults[credential.id].success 
                                        ? "text-emerald-600" 
                                        : "text-rose-600"
                                }`}>
                                    {testResults[credential.id].success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    {testResults[credential.id].success ? 'OK' : 'ERR'}
                                </div>
                             )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-3">
                             <button
                                onClick={(e) => handleTest(e, credential)}
                                disabled={testingId === credential.id}
                                className="flex-1 p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                             >
                                {testingId === credential.id ? (
                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <TestTube className="w-3 h-3" />
                                        {t('credentials.test')}
                                    </>
                                )}
                             </button>
                             <button
                                onClick={(e) => handleEdit(e, credential)}
                                className="p-2 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-foreground transition-colors"
                             >
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button
                                onClick={(e) => handleDelete(e, credential)}
                                className="p-2 rounded-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 text-zinc-500 hover:text-rose-500 transition-colors"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    </BentoItem>
                  )
                })}
              </BentoGrid>
            </div>
          ))}
        </div>
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
