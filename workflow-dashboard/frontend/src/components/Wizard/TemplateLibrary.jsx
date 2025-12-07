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
    name: 'GMAIL_TO_SLACK_NOTIFIER',
    description: 'Auto-forward specific email patterns to Slack channels via Webhook.',
    category: 'notification',
    icon: Mail,
    colorClass: 'text-red-400 bg-red-500/10 border-red-500/30',
    type: 'api',
    popular: true,
    requiredCredentials: ['Gmail API', 'Slack Webhook'],
    schedule: 'EVERY_5_MIN',
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
    name: 'NOTION_DAILY_LOG',
    description: 'Archive daily productivity metrics to Notion database automatically.',
    category: 'productivity',
    icon: FileSpreadsheet,
    colorClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
    type: 'api',
    popular: true,
    requiredCredentials: ['Notion API'],
    schedule: 'DAILY_2300',
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
    name: 'X_KEYWORD_MONITOR',
    description: 'Scan social stream for specific keywords and alert immediately.',
    category: 'monitoring',
    icon: Twitter,
    colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    type: 'api',
    popular: false,
    requiredCredentials: ['X API'],
    schedule: 'EVERY_15_MIN',
    prompt: `以下の自動化タスクを設定してください：

1. X (Twitter) APIを使用
2. 指定したキーワードを含む投稿を検索
3. 新しい投稿があれば通知
4. キーワード: [ユーザーに確認]

15分ごとに監視してください。`
  },
  {
    id: 'github-release-notify',
    name: 'GITHUB_RELEASE_WATCHER',
    description: 'Track repository releases and changelogs.',
    category: 'development',
    icon: Github,
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    type: 'api',
    popular: true,
    requiredCredentials: ['GitHub API'],
    schedule: 'HOURLY',
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
    name: 'CALENDAR_EVENT_SYNC',
    description: 'Pre-meeting alerts via Slack 30 mins before scheduled events.',
    category: 'notification',
    icon: Calendar,
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    type: 'api',
    popular: true,
    requiredCredentials: ['Google Calendar API', 'Slack Webhook'],
    schedule: 'EVERY_5_MIN',
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
    name: 'PRICE_TRACKER_BOT',
    description: 'Monitor e-commerce URLs for price drops and availability.',
    category: 'monitoring',
    icon: ShoppingCart,
    colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    type: 'browser',
    popular: true,
    requiredCredentials: [],
    schedule: 'DAILY_0900',
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
    name: 'GENERIC_SCRAPER',
    description: 'Extract structured data from target websites periodically.',
    category: 'data',
    icon: Database,
    colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    type: 'browser',
    popular: false,
    requiredCredentials: [],
    schedule: 'CUSTOM',
    prompt: `以下の自動化タスクを設定してください：

1. 指定したWebサイトにアクセス
2. 指定した要素からデータを抽出
3. 結果を保存または通知

対象URL: [ユーザーに確認]
取得する情報: [ユーザーに確認]`
  },
  {
    id: 'daily-report',
    name: 'AUTO_REPORT_GENERATOR',
    description: 'Aggregate data from multiple sources into Google Sheets.',
    category: 'productivity',
    icon: FileSpreadsheet,
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    type: 'hybrid',
    popular: false,
    requiredCredentials: ['Google Sheets API'],
    schedule: 'DAILY_1800',
    prompt: `以下の自動化タスクを設定してください：

1. 各種データソースから情報を収集
2. Google Sheetsにデータを記録
3. 日次レポートを生成

毎日18時に実行してください。`
  }
]

const categories = [
  { id: 'all', name: 'ALL_SYSTEMS', icon: Star },
  { id: 'notification', name: 'NOTIFIERS', icon: Bell },
  { id: 'monitoring', name: 'WATCHDOGS', icon: Search },
  { id: 'productivity', name: 'WORKFLOWS', icon: Zap },
  { id: 'development', name: 'DEV_OPS', icon: Code },
  { id: 'data', name: 'DATA_MINING', icon: Database },
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-4xl max-h-[85vh] glass-card rounded-lg border-primary/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-foreground font-mono tracking-tight">TEMPLATE_REPOSITORY</h2>
                <p className="text-sm text-primary/70 font-mono mt-1">Select pre-configured automation protocols</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-sm hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="SEARCH_TEMPLATES..."
                className="w-full h-10 pl-10 pr-4 rounded-sm bg-black/40 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 font-mono text-sm"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold font-mono whitespace-nowrap transition-all border",
                    selectedCategory === cat.id
                      ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                      : "bg-transparent border-white/10 text-muted-foreground hover:text-foreground hover:border-white/30"
                  )}
                >
                  <cat.icon className="w-3 h-3" />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto p-6 bg-black/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template, index) => (
                <motion.button
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(template)}
                  className="group p-5 rounded-sm border border-white/5 hover:border-primary/40 bg-white/5 hover:bg-white/10 transition-all text-left relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent -mr-8 -mt-8 rotate-45" />
                  
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-sm flex items-center justify-center shrink-0 border",
                      template.colorClass || "bg-zinc-800 border-zinc-700 text-zinc-400"
                    )}>
                      <template.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground truncate font-mono text-sm tracking-wide">{template.name}</h3>
                        {template.popular && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-bold font-mono tracking-wider">
                            HOT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{template.description}</p>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono border",
                          template.type === 'api' 
                            ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                            : template.type === 'browser'
                            ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        )}>
                          {template.type === 'api' && <Code className="w-3 h-3" />}
                          {template.type === 'browser' && <Globe className="w-3 h-3" />}
                          {template.type === 'hybrid' && <Zap className="w-3 h-3" />}
                          {template.type.toUpperCase()}
                        </span>
                        
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                          <Clock className="w-3 h-3" />
                          {template.schedule}
                        </span>
                      </div>

                      {template.requiredCredentials.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                          <Key className="w-3 h-3 text-zinc-600" />
                          <span className="text-[10px] text-zinc-500 font-mono truncate">
                            {template.requiredCredentials.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.button>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-mono text-sm">NO_MATCHING_PROTOCOLS_FOUND</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}


