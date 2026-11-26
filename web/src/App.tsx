import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import SessionBuilder from './pages/SessionBuilder'
import PreJoin from './pages/PreJoin'
import LiveRoom from './pages/LiveRoom'
import DemoRoom from './pages/DemoRoom'
import Report from './pages/Report'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/session-builder" element={<SessionBuilder />} />
        <Route path="/pre-join" element={<PreJoin />} />
        <Route path="/room/demo" element={<DemoRoom />} />
        <Route path="/room/:roomName" element={<LiveRoom />} />
        <Route path="/report/:sessionId" element={<Report />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

