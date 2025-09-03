import React from 'react';
import CameraRecorder from './CameraRecorder';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🎥 Video Recorder & Uploader</h1>
        <p>Record videos and upload them to the database!</p>
      </header>
      <main>
        <CameraRecorder />
      </main>
    </div>
  );
}

export default App;
