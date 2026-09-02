import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { loadConfig, ConfigProvider } from './config/ConfigContext';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // This is a demo platform meant to run on unattended/background screens
      // (a monitor at a booth, a tab behind the presenter's terminal) -- the
      // TanStack Query default of pausing refetchInterval polling once the tab
      // loses OS focus would silently freeze every live widget (transit map,
      // entity maps, flight status) until someone manually reloads the page.
      refetchIntervalInBackground: true,
    },
  },
});

// Load the industry config (served at /config.json in a deployed instance; falls
// back to the baked Meridian City defaults in local dev), then render. Theme +
// favicon are applied inside loadConfig before first paint.
loadConfig().then((config) => {
  document.title = `${config.company.short} Ops Dashboard`;
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
  );
});
