import { useState, useEffect, Suspense } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { Workflow, Mail, Lock, Loader2, AlertCircle, ArrowRight, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '../stores/authStore'
import useThemeStore from '../stores/themeStore'
import { CyberpunkBackground } from '../components/Immersive/CyberpunkBackground'

// Glitch Text Effect Component
const GlitchText = ({ children, className }) => {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <span className="absolute top-0 left-0.5 text-primary dark:text-cyan-400 opacity-70 animate-pulse" aria-hidden="true">{children}</span>
      <span className="absolute top-0 -left-0.5 text-red-500 opacity-70 animate-pulse" style={{ animationDelay: '0.1s' }} aria-hidden="true">{children}</span>
    </span>
  )
}

// CSS Fallback Background
const CSSBackground = () => (
  <div className="fixed inset-0 z-0">
    <div className="absolute inset-0 bg-background transition-colors duration-300" />
    
    {/* Dark mode orbs */}
    <div className="dark:block hidden">
      <div className="absolute top-1/4 left-1/4 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-cyan-500/10 rounded-full blur-[60px] sm:blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-purple-500/10 rounded-full blur-[60px] sm:blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
    </div>

    {/* Light mode gradient */}
    <div className="dark:hidden block absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />

    <div 
      className="absolute inset-0 opacity-20 dark:opacity-20 opacity-5"
      style={{
        backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
        color: 'var(--primary)'
      }}
    />
  </div>
)

export default function Signup() {
  const navigate = useNavigate()
  const { signUp, isLoading } = useAuthStore()
  const { resolvedTheme } = useThemeStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setWebglSupported(false)
    } catch (e) {
      setWebglSupported(false)
    }
  }, [])
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      setError('Password mismatch')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    const result = await signUp(email, password)
    
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.message || 'Registration failed')
    }
  }
  
  if (success) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {webglSupported && resolvedTheme === 'dark' ? (
          <div className="fixed inset-0 z-0">
            <Canvas camera={{ position: [0, 0, 20], fov: 60 }} gl={{ antialias: false }} dpr={[1, 1.5]} onCreated={({ gl }) => gl.setClearColor('#050505')}>
              <Suspense fallback={null}>
                <CyberpunkBackground />
              </Suspense>
            </Canvas>
          </div>
        ) : (
          <CSSBackground />
        )}
        
        {/* Scanline overlay */}
        <div 
          className="fixed inset-0 z-[1] pointer-events-none opacity-10 dark:opacity-10 opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
            color: 'var(--primary)'
          }}
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center relative z-10 bg-card/80 dark:bg-black/60 backdrop-blur-md border border-border dark:border-cyan-500/20 rounded-sm p-8 shadow-xl dark:shadow-[0_0_30px_rgba(6,182,212,0.1)]"
        >
          {/* Top border glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary dark:via-cyan-500 to-transparent" />

          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-primary/20 dark:bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/50 dark:border-cyan-500/50"
          >
            <Check className="w-10 h-10 text-primary dark:text-cyan-400" />
          </motion.div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground dark:text-white mb-4 tracking-tight">
             <GlitchText>REGISTRATION COMPLETE</GlitchText>
          </h2>
          <p className="text-muted-foreground dark:text-gray-400 mb-8 font-mono text-sm">
            Verification email sent.
            <br />
            Please activate your account.
          </p>
          <Link 
            to="/login" 
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm bg-primary/10 dark:bg-cyan-500/20 text-primary dark:text-cyan-400 font-bold uppercase tracking-wider border border-primary/30 dark:border-cyan-500/50 hover:bg-primary/20 dark:hover:bg-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-200"
          >
            PROCEED TO LOGIN
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-3 sm:p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background */}
      {webglSupported && resolvedTheme === 'dark' ? (
        <div className="fixed inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 20], fov: 60 }} gl={{ antialias: false }} dpr={[1, 1.5]} onCreated={({ gl }) => gl.setClearColor('#050505')}>
            <Suspense fallback={null}>
              <CyberpunkBackground />
            </Suspense>
          </Canvas>
        </div>
      ) : (
        <CSSBackground />
      )}

      {/* Scanline overlay */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none opacity-10 dark:opacity-10 opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
          color: 'var(--primary)'
        }}
      />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm sm:max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-card/50 dark:bg-black/50 border border-primary/50 dark:border-cyan-500/50 rounded-sm flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_20px_rgba(6,182,212,0.3)] sm:shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-sm"
          >
            <Workflow className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-primary dark:text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.5))' }} />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground dark:text-white tracking-tight"
          >
            <GlitchText>INITIALIZE</GlitchText>
            <span className="block text-primary dark:text-cyan-400 text-sm sm:text-base lg:text-lg font-mono tracking-[0.2em] sm:tracking-[0.3em] mt-1">NEW USER PROTOCOL</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-muted-foreground dark:text-gray-500 mt-3 sm:mt-4 font-mono text-xs sm:text-sm"
          >
            &gt; CREATE_NEW_ACCOUNT_
          </motion.p>
        </div>
        
        {/* Signup Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-card/80 dark:bg-black/60 backdrop-blur-md border border-border dark:border-cyan-500/20 rounded-sm p-4 sm:p-6 lg:p-8 shadow-xl dark:shadow-[0_0_30px_rgba(6,182,212,0.1)] relative"
        >
          {/* Top border glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary dark:via-cyan-500 to-transparent" />
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 border border-destructive/30 rounded-sm p-3 sm:p-4 mb-4 sm:mb-6"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive shrink-0" />
                <p className="text-xs sm:text-sm text-destructive font-mono">{error}</p>
              </div>
            </motion.div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-primary dark:text-cyan-400 mb-1.5 sm:mb-2 tracking-wider">
                USER_ID (EMAIL)
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground dark:text-gray-600 group-focus-within:text-primary dark:group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@nexus.io"
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-sm bg-muted/50 dark:bg-black/50 border border-border dark:border-gray-800 text-foreground dark:text-cyan-100 text-sm sm:text-base placeholder:text-muted-foreground dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-primary dark:text-cyan-400 mb-1.5 sm:mb-2 tracking-wider">
                ACCESS_KEY (PASSWORD)
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground dark:text-gray-600 group-focus-within:text-primary dark:group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 chars"
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-sm bg-muted/50 dark:bg-black/50 border border-border dark:border-gray-800 text-foreground dark:text-cyan-100 text-sm sm:text-base placeholder:text-muted-foreground dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-primary dark:text-cyan-400 mb-1.5 sm:mb-2 tracking-wider">
                CONFIRM_KEY
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground dark:text-gray-600 group-focus-within:text-primary dark:group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-sm bg-muted/50 dark:bg-black/50 border border-border dark:border-gray-800 text-foreground dark:text-cyan-100 text-sm sm:text-base placeholder:text-muted-foreground dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 sm:h-12 flex items-center justify-center gap-2 rounded-sm bg-primary/10 dark:bg-cyan-500/20 text-primary dark:text-cyan-400 text-xs sm:text-sm font-bold uppercase tracking-wider border border-primary/30 dark:border-cyan-500/50 hover:bg-primary/20 dark:hover:bg-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden xs:inline">PROCESSING...</span>
                  <span className="xs:hidden">...</span>
                </>
              ) : (
                <>
                  <span className="hidden xs:inline">CREATE </span>ACCOUNT
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border dark:border-gray-800 text-center">
            <p className="text-muted-foreground dark:text-gray-500 text-xs sm:text-sm font-mono">
              ALREADY REGISTERED?{' '}
              <Link 
                to="/login" 
                className="text-primary dark:text-cyan-400 hover:text-primary/80 dark:hover:text-cyan-300 font-bold transition-colors"
              >
                LOGIN
              </Link>
            </p>
          </div>
        </motion.div>
        
        {/* Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-center text-[10px] sm:text-xs text-muted-foreground dark:text-gray-600 mt-6 sm:mt-8 font-mono"
        >
          NEXUS_OS v2.0 // © 2025
        </motion.p>
      </motion.div>
    </div>
  )
}
