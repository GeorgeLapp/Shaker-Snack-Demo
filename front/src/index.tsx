import { Provider } from 'react-redux';
import { store } from './app/store';
import { BrowserRouter } from 'react-router-dom';
import App from './pages/App';
import './index.css';
import './i18n';

import React from 'react';
import ReactDOM from 'react-dom/client';
import reportWebVitals from './reportWebVitals';

const link = document.createElement('link');
link.rel = 'icon';
link.type = 'image/svg+xml';
link.href = '/favicon-dev.svg';

const existingFavicon = document.querySelector("link[rel*='icon']");
if (existingFavicon) {
  document.head.removeChild(existingFavicon);
}
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
