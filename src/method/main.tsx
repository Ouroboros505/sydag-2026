import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MethodPage from './MethodPage'
import '../index.css'
import '../learn/learn.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MethodPage />
  </StrictMode>,
)
