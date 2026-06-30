import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { loadConfig, ConfigProvider } from './config/ConfigContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

// Load the industry config (served at /config.json in a deployed instance; falls
// back to the baked Meridian City defaults in local dev), then render. Theme +
// favicon are applied inside loadConfig before first paint.
loadConfig().then((config) => {
  document.title = `${config.company.name} Portal`
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ConfigProvider value={config}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </React.StrictMode>
  )
})
