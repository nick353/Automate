import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Shield, Key } from 'lucide-react'
import { motion } from 'framer-motion'
import useCredentialStore from '../stores/credentialStore'

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
    },
    discord: {
      label: 'Discord Webhook',
      fields: [
        { name: 'webhook_url', label: 'Webhook URL', type: 'password', placeholder: 'https://discord.com/api/webhooks/...' }
      ]
    }
  }
}

export default function CredentialForm({ credential, onClose }) {
  const { createCredential, updateCredential } = useCredentialStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState({})
  
  const [formData, setFormData] = useState({
    name: credential?.name || '',
    credential_type: credential?.credential_type || 'api_key',
    service_name: credential?.service_name || 'anthropic',
    description: credential?.description || '',
    is_default: credential?.is_default ?? false,
    data: {}
  })
  
  const currentConfig = CREDENTIAL_CONFIGS[formData.credential_type]?.[formData.service_name]
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }
  
  const handleDataChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      data: { ...prev.data, [name]: value }
    }))
  }
  
  const handleTypeChange = (e) => {
    const type = e.target.value
    const services = Object.keys(CREDENTIAL_CONFIGS[type] || {})
    setFormData(prev => ({
      ...prev,
      credential_type: type,
      service_name: services[0] || '',
      data: {}
    }))
  }
  
  const handleServiceChange = (e) => {
    setFormData(prev => ({
      ...prev,
      service_name: e.target.value,
      data: {}
    }))
  }
  
  const togglePasswordVisibility = (fieldName) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      if (credential) {
        await updateCredential(credential.id, formData)
      } else {
        await createCredential(formData)
      }
      onClose()
    } catch (error) {
      alert('Failed to save: ' + error.message)
    }
    
    setIsLoading(false)
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/10">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {credential ? 'Edit Credential' : 'Add Credential'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Secure vault for keys & passwords</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g. Production OpenAI Key"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
          
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Type</label>
              <select
                name="credential_type"
                value={formData.credential_type}
                onChange={handleTypeChange}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                <option value="api_key">API Key</option>
                <option value="login">Site Login</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Service</label>
              <select
                name="service_name"
                value={formData.service_name}
                onChange={handleServiceChange}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                {Object.entries(CREDENTIAL_CONFIGS[formData.credential_type] || {}).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Dynamic Fields */}
          <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border">
            {currentConfig?.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-2 tracking-wider">{field.label}</label>
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showPasswords[field.name] ? 'password' : 'text'}
                    name={field.name}
                    value={formData.data[field.name] || ''}
                    onChange={handleDataChange}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all pr-10"
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.name)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Options */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_default"
                checked={formData.is_default}
                onChange={handleChange}
                className="w-4 h-4 rounded text-primary focus:ring-primary bg-background border-border"
              />
              <span className="text-sm text-foreground">Set as Default</span>
            </label>
          </div>
          
          {/* Footer */}
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              {isLoading ? 'Saving...' : (
                <><Shield className="w-4 h-4" /> {credential ? 'Update' : 'Secure Save'}</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
