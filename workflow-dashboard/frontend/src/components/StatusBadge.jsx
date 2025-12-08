import useLanguageStore from '../stores/languageStore'

export default function StatusBadge({ active }) {
  const { t } = useLanguageStore()
  
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 dark:border-emerald-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.2)] tracking-wider">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_5px_currentColor]"></span>
        </span>
        {t('common.active')}
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold bg-muted dark:bg-gray-800/50 text-muted-foreground dark:text-gray-500 border border-border dark:border-gray-700 tracking-wider">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 dark:bg-gray-600" />
      INACTIVE
    </span>
  )
}
