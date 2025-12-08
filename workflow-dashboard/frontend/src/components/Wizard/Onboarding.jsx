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
  X,
  Terminal,
  Cpu,
  Network
} from 'lucide-react'
import { cn } from '../../utils/cn'
import useLanguageStore from '../../stores/languageStore'

const ONBOARDING_KEY = 'wizard_onboarding_completed'

export default function Onboarding({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const { t } = useLanguageStore()

  const steps = [
    {
      id: 1,
      title: t('wizard.onboarding.step1.title'),
      subtitle: t('wizard.onboarding.step1.subtitle'),
      description: t('wizard.onboarding.step1.desc'),
      icon: Terminal,
      features: [
        { icon: MessageCircle, text: t('wizard.onboarding.step1.features')[0] },
        { icon: Video, text: t('wizard.onboarding.step1.features')[1] },
        { icon: Zap, text: t('wizard.onboarding.step1.features')[2] },
      ]
    },
    {
      id: 2,
      title: t('wizard.onboarding.step2.title'),
      subtitle: t('wizard.onboarding.step2.subtitle'),
      description: '',
      icon: Cpu,
      methods: [
        {
          icon: MessageCircle,
          title: t('wizard.onboarding.step2.methods')[0].title,
          description: t('wizard.onboarding.step2.methods')[0].desc,
          color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
        },
        {
          icon: Video,
          title: t('wizard.onboarding.step2.methods')[1].title,
          description: t('wizard.onboarding.step2.methods')[1].desc,
          color: 'text-purple-400 border-purple-500/30 bg-purple-500/10'
        }
      ]
    },
    {
      id: 3,
      title: t('wizard.onboarding.step3.title'),
      subtitle: t('wizard.onboarding.step3.subtitle'),
      description: t('wizard.onboarding.step3.desc'),
      icon: Network,
      comparisons: [
        {
          title: t('wizard.onboarding.step3.comparisons')[0].title,
          icon: Code,
          benefits: t('wizard.onboarding.step3.comparisons')[0].benefits,
          color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
        },
        {
          title: t('wizard.onboarding.step3.comparisons')[1].title,
          icon: Globe,
          benefits: t('wizard.onboarding.step3.comparisons')[1].benefits,
          color: 'border-amber-500/50 bg-amber-500/10 text-amber-400'
        }
      ]
    },
    {
      id: 4,
      title: t('wizard.onboarding.step4.title'),
      subtitle: t('wizard.onboarding.step4.subtitle'),
      description: t('wizard.onboarding.step4.desc'),
      icon: CheckCircle,
      tips: [
        { icon: MessageCircle, text: t('wizard.onboarding.step4.tips')[0] },
        { icon: Clock, text: t('wizard.onboarding.step4.tips')[1] },
        { icon: Zap, text: t('wizard.onboarding.step4.tips')[2] },
      ]
    }
  ]

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
        {/* Scanline overlay */}
        <div 
            className="absolute inset-0 z-[0] pointer-events-none opacity-[0.03]"
            style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
            color: '#00FFCC'
            }}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-lg bg-black/90 border border-primary/30 dark:border-cyan-500/30 rounded-sm shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden z-10"
        >
          {/* Top decorative line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary dark:via-cyan-500 to-transparent opacity-50" />

          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 rounded-sm text-muted-foreground hover:text-primary dark:hover:text-cyan-400 hover:bg-primary/10 transition-all z-10 font-mono text-xs tracking-wider"
          >
            [{t('common.skip')}]
          </button>

          {/* Progress */}
          <div className="absolute top-6 left-6 flex gap-1 z-10">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 transition-all duration-300",
                  i <= currentStep ? "w-8 bg-primary dark:bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "w-2 bg-zinc-800"
                )}
              />
            ))}
          </div>

          {/* Header Area */}
          <div className="h-32 flex items-center justify-center bg-zinc-950/50 relative overflow-hidden">
             {/* Background Grid for Header */}
             <div 
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `linear-gradient(rgba(6,182,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.1) 1px, transparent 1px)`,
                    backgroundSize: '20px 20px',
                }}
            />
            
            <motion.div
              key={step.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative z-10 w-16 h-16 rounded-sm border border-primary/50 dark:border-cyan-500/50 bg-black/50 backdrop-blur-md flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            >
              <step.icon className="w-8 h-8 text-primary dark:text-cyan-400" />
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-6 pt-6 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground dark:text-white tracking-tight font-mono">
                    <span className="text-primary dark:text-cyan-400 mr-2">&gt;</span>
                    {step.title}
                  </h2>
                  <p className="text-xs text-primary/70 dark:text-cyan-500/70 font-mono tracking-widest mt-1 uppercase">{step.subtitle}</p>
                </div>

                {step.description && (
                  <p className="text-center text-sm text-muted-foreground font-mono leading-relaxed px-4">
                    {step.description}
                  </p>
                )}

                {/* Step 1: Features */}
                {step.features && (
                  <div className="space-y-2 pt-2">
                    {step.features.map((feature, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-sm border border-zinc-800 bg-zinc-900/50 hover:border-primary/30 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
                          <feature.icon className="w-4 h-4 text-primary dark:text-cyan-400" />
                        </div>
                        <span className="font-mono text-sm text-zinc-300">{feature.text}</span>
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
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className={cn(
                            "p-4 rounded-sm border transition-all hover:bg-opacity-20",
                            method.color
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <method.icon className="w-5 h-5 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm font-mono tracking-wide">{method.title}</h4>
                            <p className="text-xs opacity-80 mt-1 font-mono">{method.description}</p>
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
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                            "p-3 rounded-sm border",
                            comp.color
                        )}
                      >
                        <comp.icon className="w-5 h-5 mb-2" />
                        <h4 className="font-bold text-xs font-mono mb-2 tracking-wide">{comp.title}</h4>
                        <ul className="space-y-1.5">
                          {comp.benefits.map((b, j) => (
                            <li key={j} className="text-[10px] opacity-80 flex items-center gap-1.5 font-mono">
                              <span className="w-1 h-1 bg-current rounded-full" />
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
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 text-xs text-zinc-400 font-mono p-2 border-l-2 border-primary/30 bg-primary/5"
                      >
                        <tip.icon className="w-3 h-3 text-primary dark:text-cyan-400 shrink-0" />
                        <span>{tip.text}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-800">
              <div className="text-[10px] text-zinc-600 font-mono">
                STEP {currentStep + 1}/{steps.length}
              </div>
              <button
                onClick={handleNext}
                className="group flex items-center gap-2 px-6 py-2 rounded-sm bg-primary/20 dark:bg-cyan-500/20 text-primary dark:text-cyan-400 text-xs font-bold font-mono tracking-wider border border-primary/30 dark:border-cyan-500/50 hover:bg-primary/30 dark:hover:bg-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
              >
                {currentStep < steps.length - 1 ? (
                  <>
                    {t('common.next')}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                ) : (
                  <>
                    {t('common.initialize')}
                    <Zap className="w-4 h-4 group-hover:scale-110 transition-transform" />
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
