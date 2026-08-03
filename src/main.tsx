import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
// `full` carries the SOFT and WONK axes — Fraunces' warmth comes from those,
// not from weight alone. See DESIGN.md §Typography.
import '@fontsource-variable/fraunces/full.css'
import './styles/index.css'

import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
