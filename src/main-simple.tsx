import React from 'react';
import ReactDOM from 'react-dom/client';

// Minimal app to test if React renders
const MinimalApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Accelerate Content Automation</h1>
      <p>Minimal test version - checking if React renders</p>
      <button onClick={() => alert('Button clicked!')}>
        Test Button
      </button>
    </div>
  );
};

// Simple render without any providers
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MinimalApp />
  </React.StrictMode>
);