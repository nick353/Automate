/**
 * スケルトンUIコンポーネント
 * ローディング中のプレースホルダー表示
 */
import { motion } from 'framer-motion'

// 基本スケルトン
export function Skeleton({ className = '', animate = true }) {
  return (
    <div
      className={`bg-zinc-200 dark:bg-zinc-700 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    />
  )
}

// テキスト行スケルトン
export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

// カードスケルトン
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  )
}

// テーブル行スケルトン
export function SkeletonTableRow({ columns = 4 }) {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

// リストアイテムスケルトン
export function SkeletonListItem({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

// タスクカードスケルトン
export function SkeletonTaskCard({ className = '' }) {
  return (
    <div className={`p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <SkeletonText lines={2} className="mb-4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

// 履歴カードスケルトン
export function SkeletonHistoryCard({ className = '' }) {
  return (
    <div className={`p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-2/3 mb-2" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ダッシュボード統計スケルトン
export function SkeletonStat({ className = '' }) {
  return (
    <div className={`p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <Skeleton className="h-4 w-1/3 mb-2" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  )
}

// チャットメッセージスケルトン
export function SkeletonChatMessage({ isUser = false, className = '' }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${className}`}>
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        <Skeleton className={`h-4 w-20 mb-2 ${isUser ? 'ml-auto' : ''}`} />
        <div className={`p-3 rounded-xl ${isUser ? 'bg-zinc-200 dark:bg-zinc-700' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  )
}

// グリッドスケルトン
export function SkeletonGrid({ columns = 3, rows = 2, itemComponent: Item = SkeletonCard, className = '' }) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }
  
  return (
    <div className={`grid ${gridCols[columns] || gridCols[3]} gap-4 ${className}`}>
      {Array.from({ length: columns * rows }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}

// フルページローディング
export function SkeletonPage({ className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`space-y-6 ${className}`}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      
      {/* 統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      
      {/* コンテンツ */}
      <SkeletonGrid columns={3} rows={2} />
    </motion.div>
  )
}

// インラインローディングスピナー
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }
  
  return (
    <svg
      className={`animate-spin ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export default Skeleton
