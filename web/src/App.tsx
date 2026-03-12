import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import SessionBuilder from './pages/SessionBuilder'
import PreJoin from './pages/PreJoin'
import LiveRoom from './pages/LiveRoom'
import Report from './pages/Report'

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/session-builder" element={<SessionBuilder />} />
        <Route path="/pre-join" element={<PreJoin />} />
        <Route path="/room/:roomName" element={<LiveRoom />} />
        <Route path="/report/:sessionId" element={<Report />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

