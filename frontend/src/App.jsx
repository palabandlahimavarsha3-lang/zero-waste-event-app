import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import About from './pages/About'
import Dashboard from './pages/Dashboard'
import EcoAlternatives from './pages/EcoAlternatives'
import Events from './pages/Events'
import Feedback from './pages/Feedback'
import WastePrediction from './pages/WastePrediction'
import WasteReports from './pages/WasteReports'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="prediction" element={<WastePrediction />} />
          <Route path="alternatives" element={<EcoAlternatives />} />
          <Route path="reports" element={<WasteReports />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
