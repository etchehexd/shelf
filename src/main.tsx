import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// One family, self-hosted: Creato Display. The @font-face block lives in
// styles/fonts.css, which index.css imports, so the faces and the tokens that
// reference them are never more than one file apart.
import './styles/index.css'

import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
