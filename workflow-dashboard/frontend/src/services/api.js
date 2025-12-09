import axios from 'axios'

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
        hypothesisId: hypothesisId || 'F'
      })
    }).catch(() => {});
  } catch (e) {}
};
// #endregion

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// リクエストインターセプター
api.interceptors.request.use(
  (config) => {
    // #region agent log
    debugLog('api.js:request', 'API request started', { url: config.url, method: config.method, baseURL: config.baseURL }, 'F');
    // #endregion
    return config
  },
  (error) => {
    // #region agent log
    debugLog('api.js:request', 'API request error', { error: error.message }, 'F');
    // #endregion
    return Promise.reject(error)
  }
)

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => {
    // #region agent log
    debugLog('api.js:response', 'API response success', { url: response.config.url, status: response.status }, 'F');
    // #endregion
    return response
  },
  (error) => {
    // #region agent log
    debugLog('api.js:response', 'API response error', { 
      url: error.config?.url, 
      status: error.response?.status, 
      statusText: error.response?.statusText,
      message: error.message,
      code: error.code
    }, 'F');
    // #endregion
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Projects API
export const projectsApi = {
  getAll: (params) => api.get('/projects', { params }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  // カンバンボード用
  getBoardData: () => api.get('/projects/board/data'),
  getWithTasks: (id) => api.get(`/projects/${id}/with-tasks`),
  // 役割グループ
  createRoleGroup: (projectId, data) => api.post(`/projects/${projectId}/role-groups`, data),
  getRoleGroups: (projectId) => api.get(`/projects/${projectId}/role-groups`),
  updateRoleGroup: (groupId, data) => api.put(`/projects/role-groups/${groupId}`, data),
  deleteRoleGroup: (groupId) => api.delete(`/projects/role-groups/${groupId}`),
  // プロジェクトチャット
  chat: (projectId, message, chatHistory) => api.post(`/projects/${projectId}/chat`, { message, chat_history: chatHistory }),
  executeActions: (projectId, actions) => api.post(`/projects/${projectId}/chat/execute-actions`, { actions }),
  getWorkflowExplanation: (projectId) => api.get(`/projects/${projectId}/workflow-explanation`),
  // ウィザードチャット（空プロジェクト用）
  wizardChat: (projectId, message, chatHistory, videoAnalysis, webResearch) => 
    api.post(`/projects/${projectId}/wizard-chat`, { 
      message, 
      chat_history: chatHistory,
      video_analysis: videoAnalysis,
      web_research: webResearch
    }),
  // Webリサーチ
  webSearch: (projectId, query, numResults = 5) => 
    api.post(`/projects/${projectId}/web-search`, { query, num_results: numResults }),
  // 動画分析
  analyzeVideo: (projectId, file, context = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('context', context)
    return api.post(`/projects/${projectId}/analyze-video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  // 汎用ファイル分析
  analyzeFile: (projectId, file, context = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('context', context)
    return api.post(`/projects/${projectId}/analyze-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  // 認証情報チェック
  checkCredentials: (projectId, taskPrompt, executionLocation = 'server') =>
    api.post(`/projects/${projectId}/check-credentials`, {
      task_prompt: taskPrompt,
      execution_location: executionLocation
    }),
  // task_promptのAIレビュー
  reviewTaskPrompt: (projectId, taskPrompt, taskName) =>
    api.post(`/projects/${projectId}/review-task-prompt`, {
      task_prompt: taskPrompt,
      task_name: taskName
    }),
  // 検証付きタスク作成
  validateAndCreateTask: (projectId, taskData, skipReview = false, autoRunTest = false) =>
    api.post(`/projects/${projectId}/validate-and-create-task`, {
      task_data: taskData,
      skip_review: skipReview,
      auto_run_test: autoRunTest
    })
}

// Tasks API
export const tasksApi = {
  getAll: (params) => api.get('/tasks', { params }),
  get: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  toggle: (id) => api.post(`/tasks/${id}/toggle`),
  run: (id) => api.post(`/tasks/${id}/run`),
  // バッチ更新（ドラッグ&ドロップ用）
  batchUpdate: (tasks) => api.post('/tasks/batch-update', { tasks }),
  // トリガー管理
  getTriggers: (taskId) => api.get(`/tasks/${taskId}/triggers`),
  createTrigger: (taskId, data) => api.post(`/tasks/${taskId}/triggers`, data),
  updateTrigger: (triggerId, data) => api.put(`/tasks/triggers/${triggerId}`, data),
  deleteTrigger: (triggerId) => api.delete(`/tasks/triggers/${triggerId}`),
  // タスク個別チャット
  taskChat: (taskId, message, chatHistory) => api.post(`/tasks/${taskId}/chat`, { message, chat_history: chatHistory }),
  executeTaskActions: (taskId, actions) => api.post(`/tasks/${taskId}/chat/execute-actions`, { actions })
}

// Credentials API
export const credentialsApi = {
  getAll: () => api.get('/credentials'),
  get: (id) => api.get(`/credentials/${id}`),
  getWithData: (id) => api.get(`/credentials/${id}/data`),
  getTypes: () => api.get('/credentials/types'),
  getByType: (type) => api.get(`/credentials/by-type/${type}`),
  create: (data) => api.post('/credentials', data),
  update: (id, data) => api.put(`/credentials/${id}`, data),
  delete: (id) => api.delete(`/credentials/${id}`),
  test: (id) => api.post(`/credentials/${id}/test`)
}

// Executions API
export const executionsApi = {
  getAll: (params) => api.get('/executions', { params }),
  get: (id) => api.get(`/executions/${id}`),
  getLogs: (id) => api.get(`/executions/${id}/logs`),
  delete: (id) => api.delete(`/executions/${id}`),
  downloadResult: (id) => `/api/executions/${id}/result/download`,
  getRunningCount: () => api.get('/executions/running/count')
}

// Live View API
export const liveViewApi = {
  getData: (id) => api.get(`/executions/${id}/live`),
  getSteps: (id) => api.get(`/executions/${id}/steps`),
  getScreenshot: (id) => api.get(`/executions/${id}/screenshot`),
  pause: (id) => api.post(`/executions/${id}/pause`),
  resume: (id) => api.post(`/executions/${id}/resume`),
  stop: (id) => api.post(`/executions/${id}/stop`)
}

// Stats API
export const statsApi = {
  get: () => api.get('/stats')
}

// Wizard API
export const wizardApi = {
  // チャット専用セッションを開始
  startChat: (initialMessage = null) => 
    api.post('/wizard/start-chat', { initial_message: initialMessage }),
  
  // 動画をアップロード
  uploadVideo: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/wizard/upload-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  
  // 動画を分析
  analyzeVideo: (sessionId, additionalContext = '') => {
    const formData = new FormData()
    formData.append('additional_context', additionalContext)
    return api.post(`/wizard/sessions/${sessionId}/analyze`, formData)
  },
  
  // セッション情報を取得
  getSession: (sessionId) => 
    api.get(`/wizard/sessions/${sessionId}`),
  
  // AIとチャット
  chat: (sessionId, message) => 
    api.post(`/wizard/sessions/${sessionId}/chat`, { message }),
  
  // タスクを生成
  generateTask: (sessionId) => 
    api.post(`/wizard/sessions/${sessionId}/generate-task`),
  
  // タスクを作成（DBに保存）
  createTask: (sessionId) => 
    api.post(`/wizard/sessions/${sessionId}/create-task`),
  
  // セッションを削除
  deleteSession: (sessionId) => 
    api.delete(`/wizard/sessions/${sessionId}`)
}

export default api
