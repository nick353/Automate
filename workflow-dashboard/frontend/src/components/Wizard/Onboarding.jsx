import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  MessageCircle, 
  Video, 
  Zap, 
  ArrowRight,
  CheckCircle,
  Bot,
  Code,
  Globe,
  Clock,
  X
} from 'lucide-react'
import { cn } from '../../utils/cn'

const ONBOARDING_KEY = 'wizard_onboarding_completed'

const steps = [
  {
    id: 1,
    title: 'ようこそ！',
    subtitle: 'AIタスク作成ウィザードへ',
    description: 'このウィザードでは、AIがあなたの自動化タスク作成をお手伝いします。難しい設定は不要です。',
    icon: Sparkles,
    color: 'from-indigo-500 to-purple-600',
    features: [
      { icon: MessageCircle, text: 'チャットで相談するだけ' },
      { icon: Video, text: '画面録画から自動生成' },
      { icon: Zap, text: 'AIが最適な方法を提案' },
    ]
  },
  {
    id: 2,
    title: '2つの作成方法',
    subtitle: '好きな方法を選べます',
    description: '',
    icon: Bot,
    color: 'from-cyan-500 to-emerald-500',
    methods: [
      {
        icon: MessageCircle,
        title: 'チャットで相談',
        description: '「毎日Gmailをチェックしたい」など、やりたいことを自由に話すだけ。AIが質問しながら最適な方法を提案します。',
        color: 'bg-cyan-500'
      },
      {
        icon: Video,
        title: '画面録画から作成',
        description: '普段の操作を録画してアップロード。AIが操作内容を分析して自動化タスクを生成します。',
        color: 'bg-purple-500'
      }
    ]
  },
  {
    id: 3,
    title: 'API優先アプローチ',
    subtitle: '最適な方法を自動選択',
    description: 'AIは利用可能なAPIを調べ、ブラウザ操作より効率的な方法があれば提案します。',
    icon: Code,
    color: 'from-emerald-500 to-cyan-500',
    comparisons: [
      {
        title: 'API利用（推奨）',
        icon: Code,
        benefits: ['高速で安定', 'エラーが少ない', '24時間稼働向け'],
        color: 'border-emerald-500 bg-emerald-500/10'
      },
      {
        title: 'ブラウザ自動化',
        icon: Globe,
        benefits: ['APIがない場合に', '複雑な操作も可能', 'スクショ取得可'],
        color: 'border-purple-500 bg-purple-500/10'
      }
    ]
  },
  {
    id: 4,
    title: '準備完了！',
    subtitle: 'さっそく始めましょう',
    description: 'チャットで相談するか、画面録画をアップロードして、あなただけの自動化タスクを作成しましょう。',
    icon: CheckCircle,
    color: 'from-emerald-400 to-cyan-400',
    tips: [
      { icon: MessageCircle, text: 'できるだけ詳しく説明すると精度UP' },
      { icon: Clock, text: '実行頻度も教えてください' },
      { icon: Zap, text: 'APIキーがあれば設定しておくと便利' },
    ]
  }
]

export default function Onboarding({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY)
    if (!completed) {
      setIsVisible(true)
    }
  }, [])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setIsVisible(false)
    onComplete?.()
  }

  if (!isVisible) return null

  const step = steps[currentStep]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Progress */}
          <div className="absolute top-4 left-4 flex gap-1.5 z-10">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i <= currentStep ? "w-6 bg-primary" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
                )}
              />
            ))}
          </div>

          {/* Header with gradient */}
          <div className={cn(
            "h-40 flex items-center justify-center bg-gradient-to-br",
            step.color
          )}>
            <motion.div
              key={step.id}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
            >
              <step.icon className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-6 pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">{step.title}</h2>
                  <p className="text-sm text-primary font-medium mt-1">{step.subtitle}</p>
                </div>

                {step.description && (
                  <p className="text-center text-muted-foreground">{step.description}</p>
                )}

                {/* Step 1: Features */}
                {step.features && (
                  <div className="space-y-3 pt-2">
                    {step.features.map((feature, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <feature.icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{feature.text}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Step 2: Methods */}
                {step.methods && (
                  <div className="grid gap-3 pt-2">
                    {step.methods.map((method, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", method.color)}>
                            <method.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-foreground">{method.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Step 3: Comparisons */}
                {step.comparisons && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {step.comparisons.map((comp, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn("p-4 rounded-xl border-2", comp.color)}
                      >
                        <comp.icon className="w-6 h-6 mb-2 text-foreground" />
                        <h4 className="font-bold text-sm text-foreground mb-2">{comp.title}</h4>
                        <ul className="space-y-1">
                          {comp.benefits.map((b, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Step 4: Tips */}
                {step.tips && (
                  <div className="space-y-2 pt-2">
                    {step.tips.map((tip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <tip.icon className="w-4 h-4 text-primary shrink-0" />
                        <span>{tip.text}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                スキップ
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25"
              >
                {currentStep < steps.length - 1 ? (
                  <>
                    次へ
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    始める
                    <Zap className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// オンボーディングをリセットする関数（開発用）
export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY)
}


