import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Firm from './Firm.tsx'

// `?scripted` opens the original scripted scan-bay demo as a fallback.
const scripted = new URLSearchParams(location.search).has('scripted')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{scripted ? <App /> : <Firm />}</StrictMode>,
)
