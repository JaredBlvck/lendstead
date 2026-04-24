import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { EngineProvider } from './game/engine/EngineContext';
import './index.css';

// Poll-based live updates. 3s keeps the dashboard feeling alive without
// hammering the backend on every render. SSE/websockets would be better
// but this ships today.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 3000,
      refetchOnWindowFocus: false,
      staleTime: 1500,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <EngineProvider>
        <App />
      </EngineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
