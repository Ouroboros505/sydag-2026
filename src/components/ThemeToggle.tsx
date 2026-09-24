import { useEffect, useState } from 'react'

type Theme = 'auto' | 'light' | 'dark'
const ORDER: Theme[] = ['auto', 'light', 'dark']

function initial(): Theme {
  const q = new URLSearchParams(location.search).get('theme')
  if (q === 'light' || q === 'dark') return q
  try {
    const s = localStorage.getItem('theme')
    if (s === 'light' || s === 'dark') return s
  } catch { /* storage may be unavailable */ }
  return 'auto'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = theme
    try { theme === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', theme) } catch { /* ignore */ }
  }, [theme])
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
  return (
    <button className="theme" onClick={() => setTheme(next)} title={`theme: ${theme} — click for ${next}`}>
      {theme === 'auto' ? 'auto' : theme}
    </button>
  )
}
