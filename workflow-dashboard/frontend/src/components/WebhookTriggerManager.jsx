import { useState, useEffect } from 'react'
import { X, Link as LinkIcon, Copy, Check, Webhook, Zap, AlertCircle, Plus, Trash2, Power, Globe, MessageSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { tasksApi } from '../services/api'

export default function WebhookTriggerManager({ taskId, taskName, onClose }) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [lineWebhookUrl, setLineWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState(null)
  
  useEffect(() => {
    fetchWebhookUrls()
  }, [])
  
  const fetchWebhookUrls = async () => {
    try {
      setLoading(true)
      
      // 汎用Webhook URL
      const genericResponse = await tasksApi.getWebhookUrl(taskId, 'generic')
      setWebhookUrl(genericResponse.data.webhook_url)
      
      // LINE Webhook URL
      const lineResponse = await tasksApi.getWebhookUrl(taskId, 'line')
      setLineWebhookUrl(lineResponse.data.webhook_url)
      
    } catch (error) {
      console.error('Webhook URL取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('コピーエラー:', error)
    }
  }
  
  const testWebhook = async (url) => {
    try {
      setTestResult({ status: 'testing', message: 'テスト中...' })
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Webhook test from dashboard',
          timestamp: new Date().toISOString()
        })
      })
      
      if (response.ok) {
        setTestResult({
          status: 'success',
          message: 'Webhookが正常にトリガーされました！タスクが実行されます。'
        })
      } else {
        setTestResult({
          status: 'error',
          message: `エラー: ${response.status} ${response.statusText}`
        })
      }
    } catch (error) {
      setTestResult({
        status: 'error',
        message: `接続エラー: ${error.message}`
      })
    }
    
    setTimeout(() => setTestResult(null), 5000)
  }
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">読み込み中...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
      >
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Webhookトリガー設定
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {taskName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 本文 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {/* テスト結果 */}
          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-lg border ${
                  testResult.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : testResult.status === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.status === 'success' && <Check className="w-5 h-5 text-green-600" />}
                  {testResult.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                  {testResult.status === 'testing' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  )}
                  <span className="font-semibold">{testResult.message}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* 汎用Webhook */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                汎用Webhook
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              任意のサービスやツールからこのURLにPOSTリクエストを送信すると、タスクがトリガーされます。
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, 'generic')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                {copied === 'generic' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'generic' ? 'コピー済み' : 'コピー'}
              </button>
            </div>
            
            <button
              onClick={() => testWebhook(webhookUrl)}
              className="w-full px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Zap className="w-4 h-4" />
              テスト実行
            </button>
            
            {/* 使用例 */}
            <div className="mt-4 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">使用例（cURL）:</p>
              <code className="text-xs text-zinc-600 dark:text-zinc-400 font-mono block overflow-x-auto">
                {`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Triggered from external source"}'`}
              </code>
            </div>
          </div>
          
          {/* LINE Webhook */}
          <div className="space-y-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                LINE Webhook
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              LINE Notifyと連携して、LINE通知を受け取ったときにタスクを自動実行できます。
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={lineWebhookUrl}
                readOnly
                className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(lineWebhookUrl, 'line')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                {copied === 'line' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'line' ? 'コピー済み' : 'コピー'}
              </button>
            </div>
            
            {/* LINE設定手順 */}
            <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                LINE Notifyの設定方法:
              </p>
              <ol className="text-sm text-green-800 dark:text-green-200 space-y-1 list-decimal list-inside">
                <li>
                  <a
                    href="https://notify-bot.line.me/my/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-600"
                  >
                    LINE Notify
                  </a>
                  にアクセス
                </li>
                <li>「マイページ」→「トークンを発行する」</li>
                <li>上記のURLをWebhook URLとして登録</li>
                <li>LINE通知を受け取ると自動でタスクが実行されます</li>
              </ol>
            </div>
          </div>
          
          {/* 注意事項 */}
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">セキュリティに関する注意:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Webhook URLは外部に公開しないでください</li>
                  <li>信頼できるサービスからのみ呼び出してください</li>
                  <li>タスクが無効化されている場合、Webhookも動作しません</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* フッター */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </motion.div>
    </div>
  )
}
