import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import useAuthStore from '../stores/authStore'
import useLanguageStore from '../stores/languageStore'

export default function AuthGuard({ children }) {
  const location = useLocation()
  const { isAuthenticated, isLoading, initialize, authEnabled } = useAuthStore()
  const { t } = useLanguageStore()
  
  useEffect(() => {
    initialize()
  }, [])
  
  // ローディング中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }
  
  // 未認証の場合はログインページへリダイレクト
  if (!isAuthenticated && authEnabled) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return children
}
