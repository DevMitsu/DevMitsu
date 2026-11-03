import '@fontsource-variable/inter';
import '@fontsource/dm-serif-display/400.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, MemoryRouter } from 'react-router-dom';
import { App } from './app/App';
import { AppGate } from './app/AppGate';
import { applyPrefs } from './lib/applyPrefs';
import { getState } from './store/store';

applyPrefs(getState().prefs);

// Hosted previews cannot change the address bar, so they keep the current page in memory.
// Hash addresses (…/#/fines) work on any static host and when the page is opened from a pendrive.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : import.meta.env.PROD ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AppGate><App /></AppGate>
    </Router>
  </StrictMode>,
);
