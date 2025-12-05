import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * ライブスクリーンキャストコンポーネント
 * 
 * オンデマンドでブラウザ画面をリアルタイム配信
 * - ユーザーが「ライブビュー開始」ボタンを押したときのみ配信開始
 * - CDP (Chrome DevTools Protocol) のスクリーンキャストを使用
 */
export default function LiveScreencast({ executionId, isRunning }) {
  const [isViewing, setIsViewing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const wsRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(new Image());

  // スクリーンキャストの利用可否を確認
  useEffect(() => {
    if (!executionId || !isRunning) {
      setIsAvailable(false);
      return;
    }

    const checkStatus = async () => {
      try {
        // APIベースURLを取得（プロキシ経由）
        const apiBase = window.location.origin.replace(/:\d+$/, ':8000');
        const response = await fetch(`${apiBase}/api/screencast/status/${executionId}`);
        const data = await response.json();
        setIsAvailable(data.available);
      } catch (err) {
        console.error('ステータス確認エラー:', err);
        setIsAvailable(false);
      }
    };

    // 初回チェック
    checkStatus();

    // 定期的にチェック
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [executionId, isRunning]);

  // フレームをキャンバスに描画
  const drawFrame = useCallback((frameData) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    
    if (!canvas) return;

    img.onload = () => {
      const ctx = canvas.getContext('2d');
      
      // キャンバスサイズを画像に合わせる
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      ctx.drawImage(img, 0, 0);
    };
    
    img.src = `data:image/jpeg;base64,${frameData}`;
    setFrameCount(prev => prev + 1);
  }, []);

  // WebSocket接続を開始
  const startViewing = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsConnecting(true);
    setError(null);
    setFrameCount(0);

    // WebSocket URLを構築（プロキシ経由でバックエンドに接続）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsUrl = `${protocol}//${host}:8000/ws/screencast/${executionId}`;
    
    console.log('スクリーンキャストWebSocket接続:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('スクリーンキャストWebSocket接続成功');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'started':
            setIsConnecting(false);
            setIsViewing(true);
            break;
          case 'frame':
            drawFrame(message.data);
            break;
          case 'error':
            setError(message.message);
            setIsConnecting(false);
            setIsViewing(false);
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('メッセージ解析エラー:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocketエラー:', event);
      setError('接続エラーが発生しました');
      setIsConnecting(false);
    };

    ws.onclose = () => {
      console.log('スクリーンキャストWebSocket切断');
      setIsViewing(false);
      setIsConnecting(false);
      wsRef.current = null;
    };
  }, [executionId, drawFrame]);

  // WebSocket接続を停止
  const stopViewing = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send('stop');
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsViewing(false);
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 実行が終了したら視聴を停止
  useEffect(() => {
    if (!isRunning && isViewing) {
      stopViewing();
    }
  }, [isRunning, isViewing, stopViewing]);

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isViewing ? 'bg-red-500 animate-pulse' : 'bg-theme-muted'}`} />
          <span className="text-foreground font-medium">ライブビュー</span>
          {isViewing && (
            <span className="text-xs text-muted-foreground">
              {frameCount} frames
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isViewing ? (
            <button
              onClick={startViewing}
              disabled={!isAvailable || isConnecting}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isAvailable && !isConnecting
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  接続中...
                </span>
              ) : (
                '▶ ライブビュー開始'
              )}
            </button>
          ) : (
            <button
              onClick={stopViewing}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              ■ 停止
            </button>
          )}
        </div>
      </div>

      {/* メインエリア */}
      <div className="relative aspect-video bg-black">
        {isViewing ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            {error ? (
              <>
                <svg className="w-12 h-12 mb-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-400">{error}</p>
              </>
            ) : !isRunning ? (
              <>
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>タスクが実行されていません</p>
              </>
            ) : !isAvailable ? (
              <>
                <svg className="w-12 h-12 mb-3 opacity-50 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p>ブラウザ準備中...</p>
                <p className="text-xs mt-1 text-muted-foreground">ブラウザが起動したらライブビューが利用可能になります</p>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>「ライブビュー開始」をクリックして画面を表示</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* フッター情報 */}
      {isViewing && (
        <div className="px-4 py-2 bg-muted border-t border-border text-xs text-muted-foreground">
          <span>リアルタイム配信中 • CDP Screencast</span>
        </div>
      )}
    </div>
  );
}

