import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/design-system.css'
import App from './App.jsx'
import { ToastProvider } from './components/Toast'
import { LiveRegionProvider } from './components/ui/LiveRegion'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LiveRegionProvider>
      <ToastProvider position="bottom-right">
        <App />
      </ToastProvider>
    </LiveRegionProvider>
  </React.StrictMode>,
)
