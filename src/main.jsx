import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { I18nProvider } from './i18n/I18nContext.jsx' // 🔥 INJETANDO O CÉREBRO
import { CentralDeAvisos } from './components/Avisos.jsx'
import AvisoVersaoNova from './components/AvisoVersaoNova.jsx'
import { limparMarcaDeAtualizacao } from './components/pausaSistema.js'
import ProtecaoTela from './components/ProtecaoTela.jsx'

// Veio de "recarregar na versão mais nova": tira a marca ?atualizado= do endereço
limparMarcaDeAtualizacao()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ProtecaoTela telaInteira>
        <App />
      </ProtecaoTela>
      <CentralDeAvisos />
      <AvisoVersaoNova />
    </I18nProvider>
  </React.StrictMode>,
)