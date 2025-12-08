import { useEffect, useRef } from 'react'
import useLanguageStore from '../../stores/languageStore'

export default function LogStream({ logs = [] }) {
  const scrollRef = useRef(null)
  const { t } = useLanguageStore()
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div 
      ref={scrollRef}
      className="h-full w-full overflow-y-auto font-mono text-xs space-y-1 pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
    >
      {logs.length === 0 && (
        <div className="text-zinc-500 italic py-2 opacity-50">
          {t('liveView.waitingLogs')}
        </div>
      )}
      
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2 text-zinc-300 break-all hover:bg-white/5 px-1 rounded transition-colors">
          <span className="text-zinc-500 shrink-0 select-none">
            {log.timestamp || new Date().toLocaleTimeString()}
          </span>
          <span className={
            log.level === 'ERROR' ? 'text-rose-400' :
            log.level === 'WARN' ? 'text-amber-400' :
            log.level === 'SUCCESS' ? 'text-emerald-400' :
            'text-zinc-300'
          }>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  )
}
