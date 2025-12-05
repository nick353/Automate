import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { 
  LayoutDashboard, 
  ListTodo, 
  Key, 
  History, 
  Workflow,
  LogOut,
  User,
  Sun,
  Moon,
  Zap
} from 'lucide-react'
import useAuthStore from '../stores/authStore'
import useThemeStore from '../stores/themeStore'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
  { path: '/tasks', icon: ListTodo, label: 'TASKS' },
  { path: '/tasks/wizard', icon: Zap, label: 'WIZARD' },
  { path: '/credentials', icon: Key, label: 'CREDENTIALS' },
  { path: '/history', icon: History, label: 'HISTORY' },
]

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { resolvedTheme, toggleTheme, initialize } = useThemeStore()
  
  useEffect(() => {
    initialize()
  }, [initialize])
  
  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }
  
  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate()
    }
  }
  
  return (
    <aside className="w-full h-screen h-[100dvh] flex flex-col bg-background/95 lg:bg-background/80 dark:bg-black/80 dark:lg:bg-black/60 backdrop-blur-lg border-r border-border dark:border-cyan-500/20 overflow-hidden transition-colors duration-300">
      {/* Logo Area */}
      <div className="p-4 lg:p-6 pt-14 lg:pt-6 flex items-center gap-2 lg:gap-3 select-none shrink-0 relative">
         {/* Decorative glow - hidden on mobile for performance */}
        <div className="hidden lg:block absolute top-10 left-10 w-20 h-20 bg-primary/20 dark:bg-cyan-500/20 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative w-9 h-9 lg:w-10 lg:h-10 rounded-sm bg-primary/10 dark:bg-cyan-900/20 border border-primary/50 dark:border-cyan-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
          <Workflow className="w-5 h-5 lg:w-6 lg:h-6 text-primary dark:text-cyan-400" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-black text-lg lg:text-xl tracking-tight text-foreground dark:text-white italic truncate" style={{ textShadow: resolvedTheme === 'dark' ? '0 0 10px rgba(255,255,255,0.3)' : 'none' }}>
            WORKFLOW
          </span>
          <span className="text-[9px] lg:text-[10px] font-bold text-primary dark:text-cyan-400 tracking-[0.15em] lg:tracking-[0.2em]">NEXUS OS v2.0</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 lg:px-4 py-3 lg:py-4 space-y-1.5 lg:space-y-2 overflow-y-auto no-scrollbar">
        <div className="mb-3 lg:mb-4 px-2 flex items-center gap-2">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 dark:via-cyan-900 to-transparent"></div>
             <span className="text-[9px] lg:text-[10px] font-mono text-primary/80 dark:text-cyan-700/80 uppercase tracking-widest whitespace-nowrap">Navigation</span>
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 dark:via-cyan-900 to-transparent"></div>
        </div>

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `group flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-sm text-xs lg:text-sm font-bold transition-all duration-200 relative overflow-hidden border border-transparent ${
                isActive
                  ? "text-primary dark:text-cyan-400 bg-primary/10 dark:bg-cyan-950/40 border-primary/30 dark:border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"
                  : "text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white hover:bg-muted/20 dark:hover:bg-white/5 hover:border-border dark:hover:border-white/10 active:bg-muted/30 dark:active:bg-white/10"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 lg:w-1 bg-primary dark:bg-cyan-400 shadow-[0_0_10px_#06b6d4]"></div>
                )}
                <item.icon className={`w-4 h-4 lg:w-5 lg:h-5 shrink-0 transition-colors duration-200 ${
                  isActive ? "text-primary dark:text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" : "text-muted-foreground dark:text-gray-500 group-hover:text-foreground dark:group-hover:text-white"
                }`} />
                <span className="relative z-10 tracking-wide truncate">{item.label}</span>
                
                {/* Hover decoration - hidden on mobile */}
                <div className="hidden lg:block absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="w-1 h-1 bg-primary dark:bg-cyan-500 rounded-full animate-pulse"></div>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      {/* Footer Actions */}
      <div className="p-3 lg:p-4 border-t border-border dark:border-cyan-500/20 shrink-0 bg-muted/30 dark:bg-black/40 space-y-2">
        
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-sm border border-border/50 dark:border-white/5 hover:border-primary/30 hover:bg-primary/10 dark:hover:bg-cyan-950/20 transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-sm bg-background dark:bg-gray-900 flex items-center justify-center border border-border dark:border-gray-700 group-hover:border-primary/50 dark:group-hover:border-cyan-500/50 transition-colors shrink-0">
            {resolvedTheme === 'dark' ? (
              <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground dark:text-gray-400 group-hover:text-primary dark:group-hover:text-cyan-400" />
            ) : (
              <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground dark:text-gray-400 group-hover:text-primary dark:group-hover:text-cyan-400" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs lg:text-sm font-bold text-foreground dark:text-gray-200 truncate group-hover:text-primary dark:group-hover:text-cyan-200">
              {resolvedTheme === 'dark' ? 'DARK MODE' : 'LIGHT MODE'}
            </p>
            <p className="text-[10px] lg:text-xs text-muted-foreground dark:text-gray-500 group-hover:text-primary/70 dark:group-hover:text-cyan-400/70 font-mono">
              {resolvedTheme === 'dark' ? 'ACTIVE' : 'ACTIVE'}
            </p>
          </div>
        </button>

        {/* User Profile */}
        {user && (
          <div className="flex items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-sm border border-border/50 dark:border-white/5 hover:border-primary/30 dark:hover:border-cyan-500/30 hover:bg-primary/10 dark:hover:bg-cyan-950/20 transition-all cursor-pointer group">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-sm bg-background dark:bg-gray-900 flex items-center justify-center border border-border dark:border-gray-700 group-hover:border-primary/50 dark:group-hover:border-cyan-500/50 transition-colors shrink-0">
              <User className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground dark:text-gray-400 group-hover:text-primary dark:group-hover:text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs lg:text-sm font-bold text-foreground dark:text-gray-200 truncate group-hover:text-primary dark:group-hover:text-cyan-200">{user.email}</p>
              <div className="flex items-center gap-1 lg:gap-1.5">
                  <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></div>
                  <p className="text-[10px] lg:text-xs text-muted-foreground dark:text-gray-500 group-hover:text-primary/70 dark:group-hover:text-cyan-400/70 font-mono">ONLINE</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 lg:p-2 text-muted-foreground dark:text-gray-500 hover:text-destructive dark:hover:text-red-400 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}