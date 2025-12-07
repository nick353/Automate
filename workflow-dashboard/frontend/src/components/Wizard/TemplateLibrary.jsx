import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, 
  MessageSquare, 
  FileSpreadsheet,
  Calendar,
  Twitter,
  Github,
  ShoppingCart,
  Database,
  Bell,
  Search,
  X,
  ArrowRight,
  Zap,
  Code,
  Globe,
  Star,
  Clock,
  Key
} from 'lucide-react'
import { cn } from '../../utils/cn'

// テンプレートデータ
const templates = [
  {
    id: 'gmail-to-slack',
    name: 'Gmail → Slack通知',
    description: '新着メールをSlackチャンネルに自動転送',
    category: 'notification',
    icon: Mail,
    color: 'from-red-500 to-orange-500',
    type: 'api',
    popular: true,
    requiredCredentials: ['Gmail API', 'Slack Webhook'],
    schedule: '毎5分',
    prompt: `以下の自動化タスクを設定してください：

1. Gmail APIを使用して新着メールを監視
2. 新しいメールが届いたら、以下の情報をSlackに送信:
   - 送信者
   - 件名
   - 受信日時
   - 本文の最初の100文字

Slack Webhookを使用して通知してください。`
  },
  {
    id: 'notion-daily-summary',
    name: 'Notion日次サマリー',
    description: '毎日のタスクをNotionページに自動記録',
    category: 'productivity',
    icon: FileSpreadsheet,
    color: 'from-zinc-700 to-zinc-900',
    type: 'api',
    popular: true,
    requiredCredentials: ['Notion API'],
    schedule: '毎日 23:00',
    prompt: `以下の自動化タスクを設定してください：

1. Notion APIを使用
2. 指定したデータベースに日次エントリを作成
3. 以下の情報を記録:
   - 日付
   - 完了タスク数
   - 作業時間
   - メモ

毎日23時に自動実行してください。`
  },
  {
    id: 'twitter-monitor',
    name: 'X(Twitter)監視',
    description: '特定キーワードの投稿を監視・通知',
    category: 'monitoring',
    icon: Twitter,
    color: 'from-sky-400 to-blue-500',
    type: 'api',
    popular: false,
    requiredCredentials: ['X API'],
    schedule: '毎15分',
    prompt: `以下の自動化タスクを設定してください：

1. X (Twitter) APIを使用
2. 指定したキーワードを含む投稿を検索
3. 新しい投稿があれば通知
4. キーワード: [ユーザーに確認]

15分ごとに監視してください。`
  },
  {
    id: 'github-release-notify',
    name: 'GitHubリリース通知',
    description: 'リポジトリの新しいリリースを通知',
    category: 'development',
    icon: Github,
    color: 'from-gray-700 to-gray-900',
    type: 'api',
    popular: true,
    requiredCredentials: ['GitHub API'],
    schedule: '毎時間',
    prompt: `以下の自動化タスクを設定してください：

1. GitHub APIを使用
2. 指定したリポジトリの新しいリリースを監視
3. 新しいリリースがあれば通知:
   - リポジトリ名
   - バージョン
   - リリースノート

毎時間チェックしてください。`
  },
  {
    id: 'google-calendar-reminder',
    name: 'Googleカレンダーリマインダー',
    description: '予定の30分前にSlackで通知',
    category: 'notification',
    icon: Calendar,
    color: 'from-blue-500 to-indigo-500',
    type: 'api',
    popular: true,
    requiredCredentials: ['Google Calendar API', 'Slack Webhook'],
    schedule: '毎5分',
    prompt: `以下の自動化タスクを設定してください：

1. Google Calendar APIを使用
2. 今後30分以内の予定を取得
3. 予定があればSlackに通知:
   - 予定名
   - 開始時刻
   - 場所（あれば）
   - 参加者

5分ごとにチェックしてください。`
  },
  {
    id: 'ec-price-monitor',
    name: 'ECサイト価格監視',
    description: '商品の価格変動を監視・通知',
    category: 'monitoring',
    icon: ShoppingCart,
    color: 'from-emerald-500 to-teal-500',
    type: 'browser',
    popular: true,
    requiredCredentials: [],
    schedule: '毎日 9:00',
    prompt: `以下の自動化タスクを設定してください：

1. 指定したECサイトのURLにアクセス
2. 商品価格を取得
3. 前回の価格と比較
4. 価格が下がっていたら通知

毎日9時に実行してください。
対象URL: [ユーザーに確認]`
  },
  {
    id: 'web-scraping',
    name: 'Webスクレイピング',
    description: 'Webサイトから定期的にデータ収集',
    category: 'data',
    icon: Database,
    color: 'from-violet-500 to-purple-600',
    type: 'browser',
    popular: false,
    requiredCredentials: [],
    schedule: 'カスタム',
    prompt: `以下の自動化タスクを設定してください：

1. 指定したWebサイトにアクセス
2. 指定した要素からデータを抽出
3. 結果を保存または通知

対象URL: [ユーザーに確認]
取得する情報: [ユーザーに確認]`
  },
  {
    id: 'daily-report',
    name: '日次レポート自動生成',
    description: '毎日のデータを収集してレポート作成',
    category: 'productivity',
    icon: FileSpreadsheet,
    color: 'from-orange-500 to-amber-500',
    type: 'hybrid',
    popular: false,
    requiredCredentials: ['Google Sheets API'],
    schedule: '毎日 18:00',
    prompt: `以下の自動化タスクを設定してください：

1. 各種データソースから情報を収集
2. Google Sheetsにデータを記録
3. 日次レポートを生成

毎日18時に実行してください。`
  }
]

const categories = [
  { id: 'all', name: 'すべて', icon: Star },
  { id: 'notification', name: '通知', icon: Bell },
  { id: 'monitoring', name: '監視', icon: Search },
  { id: 'productivity', name: '生産性', icon: Zap },
  { id: 'development', name: '開発', icon: Code },
  { id: 'data', name: 'データ', icon: Database },
]

export default function TemplateLibrary({ isOpen, onClose, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleSelect = (template) => {
    onSelectTemplate(template)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">テンプレートライブラリ</h2>
                <p className="text-sm text-muted-foreground mt-1">よく使う自動化タスクをワンクリックで設定</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="テンプレートを検索..."
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2 -mb-2 no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template, index) => (
                <motion.button
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(template)}
                  className="group p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-primary/50 bg-white dark:bg-zinc-900 hover:shadow-lg hover:shadow-primary/5 transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0",
                      template.color
                    )}>
                      <template.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground truncate">{template.name}</h3>
                        {template.popular && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            人気
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                      
                      <div className="flex items-center gap-3 mt-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          template.type === 'api' 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : template.type === 'browser'
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        )}>
                          {template.type === 'api' && <Code className="w-3 h-3" />}
                          {template.type === 'browser' && <Globe className="w-3 h-3" />}
                          {template.type === 'hybrid' && <Zap className="w-3 h-3" />}
                          {template.type === 'api' ? 'API' : template.type === 'browser' ? 'ブラウザ' : 'ハイブリッド'}
                        </span>
                        
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {template.schedule}
                        </span>
                      </div>

                      {template.requiredCredentials.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <Key className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {template.requiredCredentials.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.button>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">該当するテンプレートが見つかりません</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}


