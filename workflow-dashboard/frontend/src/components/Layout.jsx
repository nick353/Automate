import React, { useState, useEffect, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { CyberpunkBackground } from './Immersive/CyberpunkBackground'
import Sidebar from './Sidebar'
import useThemeStore from '../stores/themeStore'
import useLanguageStore from '../stores/languageStore'

// Fallback CSS Background for when WebGL is not available
const CSSFallbackBackground = () => (
  <div className="fixed inset-0 z-0">
    {/* Base gradient */}
    <div className="absolute inset-0 bg-background transition-colors duration-300" />
    
    {/* Animated gradient orbs - responsive sizes - Only visible in dark mode or adjusted for light */}
    <div className="dark:block hidden">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-cyan-500/10 rounded-full blur-[60px] sm:blur-[80px] lg:blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-purple-500/10 rounded-full blur-[60px] sm:blur-[80px] lg:blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-red-500/5 rounded-full blur-[50px] sm:blur-[60px] lg:blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
    
    {/* Light mode simple gradient */}
    <div className="dark:hidden block absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />
    
    {/* Grid pattern */}
    <div 
      className="absolute inset-0 opacity-20 dark:opacity-20 opacity-5"
      style={{
        backgroundImage: `
          linear-gradient(currentColor 1px, transparent 1px),
          linear-gradient(90deg, currentColor 1px, transparent 1px)
        `,
        backgroundSize: '30px 30px',
        color: 'var(--primary)'
      }}
    />
    
    {/* Scanlines - reduced opacity in light mode */}
    <div 
      className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-5 opacity-[0.02]"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
        color: 'var(--primary)'
      }}
    />
  </div>
)

// Error Boundary for Canvas
class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.log('WebGL Canvas Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)
  const { resolvedTheme } = useThemeStore()
  const { t } = useLanguageStore()

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) {
        setWebglSupported(false)
      }
    } catch (e) {
      setWebglSupported(false)
    }

    const checkMobile = () => {
      const width = window.innerWidth
      setIsMobile(width < 1024)
      if (width >= 1024) {
        setIsSidebarOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="min-h-screen min-h-[100dvh] relative overflow-x-hidden bg-background text-foreground transition-colors duration-300">
      {/* Immersive Background Layer */}
      {webglSupported && resolvedTheme === 'dark' ? (
        <CanvasErrorBoundary fallback={<CSSFallbackBackground />}>
          <div className="fixed inset-0 z-0 pointer-events-none">
            <Canvas 
                camera={{ position: [0, 0, 20], fov: 60 }} 
                gl={{ antialias: false }}
                dpr={[1, 1.5]}
                onCreated={({ gl }) => {
                  gl.setClearColor('#050505')
                }}
            >
              <Suspense fallback={null}>
                <CyberpunkBackground />
              </Suspense>
            </Canvas>
          </div>
        </CanvasErrorBoundary>
      ) : (
        <CSSFallbackBackground />
      )}

      <div className="relative z-10 flex min-h-screen min-h-[100dvh]">
        {/* Mobile Overlay */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={closeSidebar}
          />
        )}
        
        {/* Sidebar - Hidden on mobile, shown on lg+ */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          w-64 lg:w-64 xl:w-72 shrink-0
          ${isMobile ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}>
          <Sidebar onNavigate={closeSidebar} />
        </div>
        
        {/* Mobile Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="fixed top-3 left-3 z-[60] lg:hidden p-2.5 rounded-sm bg-background/70 dark:bg-black/70 backdrop-blur-sm border border-primary/50 dark:border-cyan-500/50 shadow-md hover:bg-primary/10 dark:hover:bg-cyan-900/20 active:scale-95 transition-all text-primary dark:text-cyan-400"
          aria-label={t('common.toggleSidebar')}
        >
          {isSidebarOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
        
        {/* Main Content */}
        <main className="flex-1 min-h-screen min-h-[100dvh] overflow-y-auto overflow-x-hidden w-full">
          <div className="p-3 pt-16 sm:p-4 sm:pt-16 lg:p-6 lg:pt-6 xl:p-8 w-full max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}