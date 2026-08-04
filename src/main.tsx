import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// One sans for the whole product, one mono for the catalog voice — eyebrows,
// index numbers, counts, timecodes. See DESIGN.md §Typography.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/index.css'

import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
