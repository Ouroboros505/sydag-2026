import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DataPage from './DataPage'
import '../index.css'
import '../learn/learn.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataPage />
  </StrictMode>,
)
