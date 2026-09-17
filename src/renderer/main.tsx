// [mcp-local harness] feature: scaffold-electron-app | plano: a4f3314a | 2026-09-17 11:02:24
// Entry point React do renderer
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
