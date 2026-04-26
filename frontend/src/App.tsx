import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'

const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const Files = lazy(() => import('./pages/Files'))
const Maps = lazy(() => import('./pages/Maps'))
const Research = lazy(() => import('./pages/Research'))
const PDFToolkit = lazy(() => import('./pages/PDFToolkit'))
const VisualBuilder = lazy(() => import('./pages/VisualBuilder'))
const Notes = lazy(() => import('./pages/Notes'))
const Planning = lazy(() => import('./pages/Planning'))
const Writing = lazy(() => import('./pages/Writing'))
const Utilities = lazy(() => import('./pages/Utilities'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="page-loading">Memuat modul...</div>}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="projects" element={<ErrorBoundary><Projects /></ErrorBoundary>} />
                  <Route path="files" element={<ErrorBoundary><Files /></ErrorBoundary>} />
                  <Route path="maps" element={<ErrorBoundary><Maps /></ErrorBoundary>} />
                  <Route path="research" element={<ErrorBoundary><Research /></ErrorBoundary>} />
                  <Route path="pdf" element={<ErrorBoundary><PDFToolkit /></ErrorBoundary>} />
                  <Route path="visual" element={<ErrorBoundary><VisualBuilder /></ErrorBoundary>} />
                  <Route path="notes" element={<ErrorBoundary><Notes /></ErrorBoundary>} />
                  <Route path="planning" element={<ErrorBoundary><Planning /></ErrorBoundary>} />
                  <Route path="writing" element={<ErrorBoundary><Writing /></ErrorBoundary>} />
                  <Route path="utilities" element={<ErrorBoundary><Utilities /></ErrorBoundary>} />
                  <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  )
}
