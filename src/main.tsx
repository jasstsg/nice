import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Appended after styles.css is already in the DOM (rather than a static
// <link> in index.html) so load order relative to the built-in stylesheet
// is guaranteed regardless of how Vite orders injected asset tags - a
// consumer's overrides (see the "customCss" config option) always win the
// cascade. The route always responds (empty CSS when nothing's configured),
// so this never 404s.
const customCssLink = document.createElement('link');
customCssLink.rel = 'stylesheet';
customCssLink.href = '/custom.css';
document.head.appendChild(customCssLink);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
