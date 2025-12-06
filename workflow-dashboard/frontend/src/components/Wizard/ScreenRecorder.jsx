import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Video, 
  Square, 
  Play,
  Pause,
  Trash2,
  Upload,
  Monitor,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Download
} from 'lucide-react'
import { cn } from '../../utils/cn'

export default function ScreenRecorder({ onRecordingComplete, onClose }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const videoPreviewRef = useRef(null)

  // 録画開始
  const startRecording = useCallback(async () => {
    try {
      setError('')
      
      // 画面共有を要求
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      })
      
      streamRef.current = stream
      chunksRef.current = []
      
      // MediaRecorder を設定
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      })
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
        
        // プレビュー用URLを設定
        if (videoPreviewRef.current) {
          videoPreviewRef.current.src = URL.createObjectURL(blob)
        }
      }
      
      // 画面共有が停止された時
      stream.getVideoTracks()[0].onended = () => {
        stopRecording()
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // 1秒ごとにデータを収集
      setIsRecording(true)
      setRecordingTime(0)
      
      // タイマー開始
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('画面共有の許可が必要です。もう一度お試しください。')
      } else {
        setError(`録画を開始できませんでした: ${err.message}`)
      }
    }
  }, [])

  // 録画停止
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      setIsRecording(false)
      setIsPaused(false)
    }
  }, [isRecording])

  // 一時停止/再開
  const togglePause = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
      setIsPaused(!isPaused)
    }
  }, [isPaused])

  // 録画を破棄
  const discardRecording = useCallback(() => {
    setRecordedBlob(null)
    chunksRef.current = []
    setRecordingTime(0)
    if (videoPreviewRef.current) {
      videoPreviewRef.current.src = ''
    }
  }, [])

  // アップロード
  const handleUpload = useCallback(async () => {
    if (!recordedBlob) return
    
    setIsUploading(true)
    try {
      // Blobをファイルに変換
      const file = new File([recordedBlob], `screen-recording-${Date.now()}.webm`, {
        type: 'video/webm'
      })
      
      onRecordingComplete(file)
    } catch (err) {
      setError(`アップロードに失敗しました: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }, [recordedBlob, onRecordingComplete])

  // 時間フォーマット
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">スクリーンレコーダー</h3>
            <p className="text-sm text-muted-foreground">ブラウザ上で直接画面を録画</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Recording Area */}
      <div className="relative rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
        {/* Preview / Recording Indicator */}
        <div className="aspect-video flex items-center justify-center">
          {recordedBlob ? (
            <video
              ref={videoPreviewRef}
              controls
              className="w-full h-full object-contain bg-black"
            />
          ) : isRecording ? (
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <div className={cn(
                    "w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center",
                    !isPaused && "animate-pulse"
                  )}>
                    <Monitor className="w-8 h-8 text-white" />
                  </div>
                </div>
                {!isPaused && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {isPaused ? '一時停止中' : '録画中...'}
                </p>
                <p className="text-3xl font-mono font-bold text-rose-500 mt-2">
                  {formatTime(recordingTime)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 p-8">
              <div className="w-20 h-20 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mx-auto">
                <Monitor className="w-10 h-10 text-muted-foreground" />
              </div>
              <div>
                <p className="font-bold text-foreground">画面を録画</p>
                <p className="text-sm text-muted-foreground mt-1">
                  自動化したい操作を録画してください
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  🖥️ 画面全体
                </span>
                <span className="px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  🪟 ウィンドウ
                </span>
                <span className="px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  📑 タブ
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recording Controls Overlay */}
        {isRecording && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-full bg-black/80 backdrop-blur-sm">
            <button
              onClick={togglePause}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              {isPaused ? (
                <Play className="w-5 h-5 text-white" />
              ) : (
                <Pause className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={stopRecording}
              className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors"
            >
              <Square className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!isRecording && !recordedBlob && (
          <button
            onClick={startRecording}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-rose-500/25"
          >
            <Video className="w-5 h-5" />
            録画を開始
          </button>
        )}

        {recordedBlob && (
          <>
            <button
              onClick={discardRecording}
              className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border border-zinc-300 dark:border-zinc-700 text-muted-foreground hover:text-foreground hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
            >
              <Trash2 className="w-5 h-5" />
              破棄
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  この録画を使用
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
        <h4 className="text-sm font-bold text-foreground mb-2">📹 録画のコツ</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• 操作はゆっくり、はっきりと行ってください</li>
          <li>• 入力するテキストは実際の値を使用してください（パスワードは除く）</li>
          <li>• エラー時の対処も録画しておくと精度が上がります</li>
          <li>• 録画時間は5分以内を推奨します</li>
        </ul>
      </div>
    </motion.div>
  )
}

