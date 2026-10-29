import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { I18nProvider } from './i18n/I18nContext.jsx' // 🔥 INJETANDO O CÉREBRO
import { CentralDeAvisos } from './components/Avisos.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
      <CentralDeAvisos />
    </I18nProvider>
  </React.StrictMode>,
)