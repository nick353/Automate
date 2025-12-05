import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// #region agent log
const debugLog = (location, message, data = null, hypothesisId = null) => {
  try {
    fetch('http://127.0.0.1:7242/ingest/8177f6f9-bb3b-423b-ae2e-b3e291c71be2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: location,
        message: message,
        data: data || {},
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: hypothesisId || 'D'
      })
    }).catch(() => {});
  } catch (e) {}
};
// #endregion

// #region agent log
debugLog('main.jsx', 'React app initialization started', { hasRoot: !!document.getElementById('root') }, 'D');
// #endregion

try {
  const rootElement = document.getElementById('root');
  // #region agent log
  debugLog('main.jsx', 'Root element check', { exists: !!rootElement, tagName: rootElement?.tagName }, 'D');
  // #endregion
  
  if (!rootElement) {
    // #region agent log
    debugLog('main.jsx', 'Root element not found', {}, 'D');
    // #endregion
    throw new Error('Root element not found');
  }
  
  // #region agent log
  debugLog('main.jsx', 'Before ReactDOM.createRoot', {}, 'D');
  // #endregion
  
  const root = ReactDOM.createRoot(rootElement);
  
  // #region agent log
  debugLog('main.jsx', 'Before render', {}, 'D');
  // #endregion
  
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
  
  // #region agent log
  debugLog('main.jsx', 'React app rendered successfully', {}, 'D');
  // #endregion
} catch (error) {
  // #region agent log
  debugLog('main.jsx', 'React app initialization failed', { error: error.message, stack: error.stack }, 'D');
  // #endregion
  console.error('Failed to initialize React app:', error);
}

