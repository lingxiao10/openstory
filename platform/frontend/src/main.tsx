import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #0f172a; }
  button { font-family: inherit; }
  input, select, textarea { font-family: inherit; }
  a { color: inherit; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0f172a; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

  /* Mobile header */
  @media (max-width: 600px) {
    .site-header { padding: 0 12px !important; height: auto !important; min-height: 52px; }
    .site-header .header-logo { font-size: 16px !important; }
    .site-header .header-nav { gap: 6px !important; }
    .site-header .header-username { display: none !important; }
    .site-header .header-create { display: none !important; }
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
