import { CheckCircle2, Circle, Loader2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function StepProgress({ steps, currentStepId }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No steps recorded yet</p>
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {/* Connecting Line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border z-0" />

      {steps.map((step, index) => {
        const isCurrent = step.id === currentStepId
        const isCompleted = step.status === 'completed'
        const isPending = step.status === 'pending'
        const isFailed = step.status === 'failed'

        return (
          <motion.div 
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={clsx(
              "relative z-10 flex gap-4 p-3 rounded-lg transition-colors duration-200",
              isCurrent ? "bg-primary/5 border border-primary/10" : "hover:bg-muted/50"
            )}
          >
            {/* Status Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {isCompleted ? (
                <CheckCircle2 className="w-10 h-10 p-2 rounded-full bg-background border border-emerald-500/20 text-emerald-500" />
              ) : isCurrent ? (
                <div className="w-10 h-10 p-2 rounded-full bg-background border border-primary/20 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : isFailed ? (
                <div className="w-10 h-10 p-2 rounded-full bg-background border border-rose-500/20 flex items-center justify-center">
                  <span className="text-rose-500 font-bold text-lg">!</span>
                </div>
              ) : (
                <div className="w-10 h-10 p-2 rounded-full bg-background border border-border flex items-center justify-center">
                  <Circle className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Step Info */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className={clsx(
                  "text-xs font-bold uppercase tracking-wider",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  Step {step.step_number}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : ''}
                </span>
              </div>
              
              <p className={clsx(
                "text-sm font-medium leading-snug",
                isPending ? "text-muted-foreground" : "text-foreground"
              )}>
                {step.description}
              </p>
              
              {step.input_value && (
                <div className="mt-2 px-2 py-1 bg-muted/50 rounded text-xs font-mono text-muted-foreground border border-border truncate">
                  Input: <span className="text-foreground">{step.input_value}</span>
                </div>
              )}
              
              {step.error_message && (
                <div className="mt-2 p-2 bg-rose-500/10 rounded text-xs text-rose-500 border border-rose-500/20">
                  {step.error_message}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

