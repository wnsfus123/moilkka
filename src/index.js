import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

// Kakao 객체를 전역 객체에서 가져옴
if (window.Kakao) {
  window.Kakao.init('72de31a7dace3ee493d27d8b0294d0bf');
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
