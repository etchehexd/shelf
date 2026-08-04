import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Three voices, each with a job. See DESIGN.md §Typography.
//
//   Fraunces          the display voice — headlines, titles, numerals you are
//                     meant to feel. `full` rather than `index` because the
//                     SOFT and WONK axes are the whole reason it is here: they
//                     are what make a heading look drawn instead of set.
//   Plus Jakarta Sans everything you read rather than look at.
//   IBM Plex Mono     the catalog voice — eyebrows, counts, timecodes.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles/index.css'

import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
