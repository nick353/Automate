import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import TaskWizard from './pages/TaskWizard'
import Credentials from './pages/Credentials'
import History from './pages/History'
import Execution from './pages/Execution'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ImmersiveDemo from './pages/ImmersiveDemo'

export default function App() {
  return (
    <Routes>
      {/* Immersive Demo Route (Public) */}
      <Route path="/immersive" element={<ImmersiveDemo />} />

      {/* 認証ページ（ガードなし） */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* 保護されたルート */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/wizard" element={<TaskWizard />} />
        <Route path="credentials" element={<Credentials />} />
        <Route path="history" element={<History />} />
        <Route path="execution/:executionId" element={<Execution />} />
      </Route>
    </Routes>
  )
}
