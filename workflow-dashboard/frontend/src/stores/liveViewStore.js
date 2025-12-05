import { create } from 'zustand'

const useLiveViewStore = create((set, get) => ({
  // 状態
  executionId: null,
  status: 'idle', // idle, connecting, connected, disconnected
  controlStatus: 'running', // running, paused, stopping, stopped, completed, failed
  steps: [],
  currentStep: 0,
  totalSteps: 0,
  logs: [],
  screenshot: null,
  elapsedTime: 0,
  error: null,
  execution: null,
  
  // WebSocket接続
  ws: null,
  
  // アクション
  connect: (executionId) => {
    const { ws: existingWs } = get()
    if (existingWs) {
      existingWs.close()
    }
    
    // WebSocket URLを構築（バックエンドのポート8000に直接接続）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const wsUrl = `${protocol}//${host}:8000/ws/live/${executionId}`
    console.log('ライブビューWebSocket接続:', wsUrl)
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      set({ status: 'connected', executionId, error: null })
    }
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      const { type, data } = message
      
      switch (type) {
        case 'step_update':
          set((state) => {
            const steps = [...state.steps]
            const existingIndex = steps.findIndex(s => s.step_number === data.step_number)
            
            if (existingIndex >= 0) {
              steps[existingIndex] = { ...steps[existingIndex], ...data }
            } else {
              steps.push(data)
            }
            
            return {
              steps: steps.sort((a, b) => a.step_number - b.step_number),
              currentStep: data.status === 'running' ? data.step_number : state.currentStep
            }
          })
          break
          
        case 'screenshot_update':
          set({ screenshot: data.screenshot })
          break
          
        case 'log':
          set((state) => ({
            logs: [...state.logs, data].slice(-100) // 最新100件を保持
          }))
          break
          
        case 'initial_logs':
          set({ logs: data.logs || [] })
          break
          
        case 'control_update':
          set({ controlStatus: data.status })
          break
          
        case 'progress_update':
          set({
            currentStep: data.current_step,
            totalSteps: data.total_steps
          })
          break
          
        case 'execution_complete':
          set({ 
            controlStatus: data.status,
            error: data.error 
          })
          break
      }
    }
    
    ws.onclose = () => {
      set({ status: 'disconnected' })
    }
    
    ws.onerror = (error) => {
      set({ error: 'WebSocket接続エラー', status: 'disconnected' })
    }
    
    set({ ws, status: 'connecting' })
    
    // Ping/Pongで接続維持
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping')
      }
    }, 30000)
    
    return () => {
      clearInterval(pingInterval)
      ws.close()
    }
  },
  
  disconnect: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
    }
    set({
      ws: null,
      executionId: null,
      status: 'idle',
      steps: [],
      logs: [],
      screenshot: null,
      error: null
    })
  },
  
  setInitialData: (data) => {
    set({
      execution: data.execution,
      steps: data.steps || [],
      controlStatus: data.execution?.status || 'running',
      screenshot: data.screenshot,
      totalSteps: data.execution?.total_steps || 0,
      currentStep: data.execution?.completed_steps || 0,
      logs: data.logs || [],
      elapsedTime: 0
    })
  },
  
  clearLogs: () => set({ logs: [] }),
  
  updateElapsedTime: (time) => set({ elapsedTime: time }),
  incrementElapsedTime: () => set((state) => ({ elapsedTime: state.elapsedTime + 1 })),
  resetElapsedTime: () => set({ elapsedTime: 0 }),
  
  reset: () => set({
    executionId: null,
    status: 'idle',
    controlStatus: 'running',
    steps: [],
    currentStep: 0,
    totalSteps: 0,
    logs: [],
    screenshot: null,
    elapsedTime: 0,
    error: null,
    execution: null,
    ws: null
  })
}))

export default useLiveViewStore

