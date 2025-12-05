import { useState, useEffect, useRef } from 'react'
import { liveViewApi } from '../services/api'

export default function useLiveView(executionId) {
  const [steps, setSteps] = useState([])
  const [currentStepId, setCurrentStepId] = useState(null)
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('pending')
  const [screenshot, setScreenshot] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  
  const connect = async () => {
    if (!executionId) return
    
    try {
      // 初期データを取得
      const response = await liveViewApi.getData(executionId)
      const data = response.data
      
      setStatus(data.execution?.status || 'pending')
      setSteps(data.steps || [])
      setCurrentStepId(data.steps?.find(s => s.status === 'running')?.id || null)
      setScreenshot(data.screenshot)
      setLogs(data.logs || [])
      
      // WebSocket接続
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/live/${executionId}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('Live view WebSocket connected')
        setStatus('running')
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          switch (message.type) {
            case 'step_update':
              setSteps(prev => {
                const updated = [...prev]
                const index = updated.findIndex(s => s.step_number === message.data.step_number)
                if (index >= 0) {
                  updated[index] = { ...updated[index], ...message.data }
                } else {
                  updated.push({ id: Date.now(), ...message.data })
                }
                return updated.sort((a, b) => a.step_number - b.step_number)
              })
              if (message.data.status === 'running') {
                setCurrentStepId(message.data.step_number)
              }
              break
              
            case 'screenshot_update':
              setScreenshot(message.data.screenshot)
              break
              
            case 'log':
              setLogs(prev => [...prev, message.data].slice(-100))
              break
              
            case 'progress_update':
              // Progress updates handled by step updates
              break
              
            case 'execution_complete':
              setStatus(message.data.status)
              break
              
            case 'control_update':
              // Control updates (pause/resume) handled by status
              break
              
            case 'initial_logs':
              setLogs(message.data.logs || [])
              break
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      ws.onclose = () => {
        console.log('Live view WebSocket disconnected')
        // 再接続（実行中の場合のみ）
        if (status === 'running' || status === 'pending') {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }
      
    } catch (error) {
      console.error('Failed to connect live view:', error)
    }
  }
  
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }
  
  const control = async (action) => {
    if (!executionId) return
    
    try {
      switch (action) {
        case 'pause':
          await liveViewApi.pause(executionId)
          setStatus('paused')
          break
        case 'resume':
          await liveViewApi.resume(executionId)
          setStatus('running')
          break
        case 'stop':
          await liveViewApi.stop(executionId)
          setStatus('stopped')
          disconnect()
          break
      }
    } catch (error) {
      console.error(`Control action ${action} failed:`, error)
    }
  }
  
  useEffect(() => {
    if (executionId) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [executionId])
  
  return {
    steps,
    currentStepId,
    logs,
    status,
    screenshot,
    connect,
    disconnect,
    control
  }
}
