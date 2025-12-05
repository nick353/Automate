import { Globe, Lock, WifiOff } from 'lucide-react'

export default function BrowserPreview({ screenshot, status }) {
  if (!screenshot && status === 'running') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-zinc-900">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-zinc-700 border-t-primary rounded-full animate-spin" />
          <Globe className="absolute inset-0 m-auto w-6 h-6 text-zinc-500" />
        </div>
        <p className="mt-4 text-sm font-mono animate-pulse">Connecting to remote browser...</p>
      </div>
    )
  }

  if (status === 'failed' || status === 'stopped') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-950">
        <WifiOff className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">Session Disconnected</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-white">
      {/* Fake Browser Chrome */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-zinc-100 border-b border-zinc-200 flex items-center px-3 gap-2 z-10">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-2">
          <div className="bg-white h-5 rounded-md border border-zinc-200 flex items-center px-2 text-[10px] text-zinc-400 font-mono w-2/3 mx-auto">
            <Lock className="w-2.5 h-2.5 mr-1" />
            secure-browser-agent.internal
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full h-full pt-8">
        {screenshot ? (
          <img 
            src={screenshot} 
            alt="Browser View" 
            className="w-full h-full object-contain bg-zinc-50"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-50">
            <div className="w-12 h-12 rounded-full border-2 border-zinc-200 border-t-zinc-400 animate-spin" />
          </div>
        )}
      </div>
      
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[5] bg-[length:100%_2px,3px_100%] opacity-20" />
    </div>
  )
}

