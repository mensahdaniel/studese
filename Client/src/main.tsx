import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import SafeAreaProvider from './components/SafeAreaProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SafeAreaProvider>
        {/*<button className="z-[9999999]">Back</button>*/}
        <App />
      </SafeAreaProvider>
    </ThemeProvider>
  </StrictMode>,
)
