import { Play, Pause, Square, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

export default function ControlPanel({ status, onControl }) {
  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  
  return (
    <div className="flex items-center gap-2 p-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/50">
      {isRunning ? (
        <button
          onClick={() => onControl('pause')}
          className="p-3 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 hover:scale-105 transition-all active:scale-95"
          title="Pause Execution"
        >
          <Pause className="w-5 h-5 fill-current" />
        </button>
      ) : (
        <button
          onClick={() => onControl('resume')}
          disabled={status === 'completed' || status === 'failed' || status === 'stopped'}
          className="p-3 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:bg-zinc-800"
          title="Resume Execution"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>
      )}

      <button
        onClick={() => onControl('stop')}
        disabled={!['running', 'paused'].includes(status)}
        className="p-3 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent disabled:hover:text-rose-400"
        title="Stop Execution"
      >
        <Square className="w-5 h-5 fill-current" />
      </button>
    </div>
  )
}

