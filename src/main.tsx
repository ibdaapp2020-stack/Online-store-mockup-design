import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadA11yPrefs } from './lib/accessibility'
import './styles.css'

loadA11yPrefs()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
