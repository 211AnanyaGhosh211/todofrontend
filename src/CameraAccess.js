import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";

export default function CameraAccess() {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState(null);
  const webcamRef = useRef(null);

  const startCamera = useCallback(() => {
    setIsCameraOn(true);
    setError(null);
  }, []);

  const stopCamera = useCallback(() => {
    setIsCameraOn(false);
  }, []);

  const captureScreenshot = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Create download link
        const link = document.createElement('a');
        link.href = imageSrc;
        link.download = `screenshot-${Date.now()}.jpg`;
        link.click();
      }
    }
  }, []);

  const handleUserMedia = useCallback(() => {
    setError(null);
  }, []);

  const handleUserMediaError = useCallback((err) => {
    console.error("Camera error:", err);
    setError("Failed to access camera. Please check permissions.");
    setIsCameraOn(false);
  }, []);

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
      <h2 className="text-lg font-bold mb-4">📸 Camera Preview</h2>
      
      {/* Camera Controls */}
      <div className="mb-4 space-x-2">
        {!isCameraOn ? (
          <button
            onClick={startCamera}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🎥 Open Camera
          </button>
        ) : (
          <>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              🛑 Stop Camera
            </button>
            <button
              onClick={captureScreenshot}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              📷 Take Photo
            </button>
          </>
        )}
      </div>

      {/* Camera Feed */}
      {isCameraOn && (
        <div className="relative">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            className="w-96 h-72 rounded-xl shadow-lg object-cover"
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
          />
          {error && (
            <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 rounded-t-xl text-center">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isCameraOn && (
        <div className="text-center text-gray-600 max-w-md">
          <p>Click "Open Camera" to start the camera preview</p>
          <p className="text-sm mt-2">Make sure to allow camera permissions when prompted</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-semibold">Camera Error:</p>
          <p>{error}</p>
          <p className="text-sm mt-2">
            Try refreshing the page or checking your browser's camera permissions.
          </p>
        </div>
      )}
    </div>
  );
}
