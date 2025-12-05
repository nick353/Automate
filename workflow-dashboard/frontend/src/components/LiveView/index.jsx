import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2, Radio, Activity } from 'lucide-react'
import BrowserPreview from './BrowserPreview'
import StepProgress from './StepProgress'
import ControlPanel from './ControlPanel'
import LogStream from './LogStream'
import useLiveView from '../../hooks/useLiveView'
import clsx from 'clsx'

export default function LiveView({ executionId }) {
  const { 
    steps, 
    currentStepId, 
    logs, 
    status, 
    screenshot, 
    connect, 
    disconnect,
    control 
  } = useLiveView(executionId)
  
  const [isFullWidth, setIsFullWidth] = useState(false)
  
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [executionId])

  return (
    <div className={clsx(
      "grid gap-6 transition-all duration-500",
      isFullWidth ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"
    )}>
      {/* Main View (Browser + Controls) */}
      <div className={clsx(
        "space-y-6 flex flex-col",
        isFullWidth ? "lg:col-span-1" : "lg:col-span-2"
      )}>
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-2.5 h-2.5 rounded-full animate-pulse",
              status === 'running' ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-slate-400"
            )} />
            <span className="font-mono text-sm font-medium text-foreground">
              {status === 'running' ? 'LIVE SESSION' : 'SESSION ENDED'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
              HD
            </span>
          </div>
          
          <button
            onClick={() => setIsFullWidth(!isFullWidth)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={isFullWidth ? "Show Sidebar" : "Expand View"}
          >
            {isFullWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Browser Screen */}
        <motion.div 
          layout
          className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border shadow-2xl shadow-black/20 group"
        >
          <BrowserPreview screenshot={screenshot} status={status} />
          
          {/* Overlay Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ControlPanel status={status} onControl={control} />
          </div>
        </motion.div>

        {/* Current Action (Subtitles) */}
        <div className="p-6 rounded-xl bg-card/50 backdrop-blur-md border border-border">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary mt-1">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">CURRENT ACTION</h3>
              <p className="text-lg font-medium text-foreground leading-relaxed">
                {steps.find(s => s.id === currentStepId)?.description || "Initializing agent..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar (Logs & Steps) */}
      <AnimatePresence>
        {!isFullWidth && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 h-[calc(100vh-140px)] sticky top-6 flex flex-col"
          >
            <div className="flex-1 min-h-0 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-sm">Execution Steps</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <StepProgress steps={steps} currentStepId={currentStepId} />
              </div>
            </div>

            <div className="h-1/3 min-h-[200px] flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-black text-white flex justify-between items-center">
                <h3 className="font-mono text-xs font-bold text-green-400">$ TERMINAL_OUTPUT</h3>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
              </div>
              <div className="flex-1 bg-black p-4 overflow-hidden">
                <LogStream logs={logs} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

