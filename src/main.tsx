import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import NfcSnapshot from './components/Public/NfcSnapshot.tsx';
import './index.css';

// Public, unauthenticated landing page opened by an NFC tap on a meter —
// resolved by pathname before the login-gated app ever mounts.
const isNfcSnapshot = window.location.pathname === '/s';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isNfcSnapshot ? <NfcSnapshot /> : <App />}</StrictMode>
);
