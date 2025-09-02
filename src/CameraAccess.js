import React, { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";

export default function CameraAccess() {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [orientation, setOrientation] = useState('portrait');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [showMobileHelp, setShowMobileHelp] = useState(false);
  const webcamRef = useRef(null);

  // Detect if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || isTouchDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Detect device orientation
  useEffect(() => {
    const handleOrientation = () => {
      if (window.innerWidth > window.innerHeight) {
        setOrientation('landscape');
      } else {
        setOrientation('portrait');
      }
    };

    handleOrientation();
    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // Check camera permission status
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permission = await navigator.permissions.query({ name: 'camera' });
          setPermissionStatus(permission.state);
          
          permission.onchange = () => {
            setPermissionStatus(permission.state);
          };
        }
      } catch (err) {
        console.log('Permission API not supported:', err);
      }
    };
    
    checkPermission();
  }, []);

  // Get available camera devices
  useEffect(() => {
    const getCameraDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDevice(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.log('Could not enumerate devices:', err);
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      getCameraDevices();
    }
  }, []);

  // Request camera permission explicitly
  const requestCameraPermission = useCallback(async () => {
    setIsRequestingPermission(true);
    setError(null);
    
    try {
      // Try to get user media to trigger permission request
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus('granted');
      setIsRequestingPermission(false);
      return true;
    } catch (err) {
      console.error('Permission request failed:', err);
      setIsRequestingPermission(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings and refresh the page.');
        setPermissionStatus('denied');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Failed to access camera. Please check your device settings.');
      }
      return false;
    }
  }, []);

  // Camera constraints optimized for mobile and desktop
  const getVideoConstraints = useCallback(() => {
    const baseConstraints = {
      width: { 
        ideal: isMobile ? (orientation === 'landscape' ? 1280 : 640) : 1280,
        min: isMobile ? 320 : 640
      },
      height: { 
        ideal: isMobile ? (orientation === 'landscape' ? 720 : 480) : 720,
        min: isMobile ? 240 : 480
      },
      facingMode: isMobile ? 'environment' : 'user', // Use back camera on mobile by default
    };

    if (selectedDevice) {
      baseConstraints.deviceId = { exact: selectedDevice };
    }

    return baseConstraints;
  }, [isMobile, selectedDevice, orientation]);

  const startCamera = useCallback(async () => {
    setError(null);
    
    // Check if we need to request permission first
    if (permissionStatus === 'denied') {
      const granted = await requestCameraPermission();
      if (!granted) return;
    }
    
    // If permission is unknown, try to request it
    if (permissionStatus === 'unknown') {
      const granted = await requestCameraPermission();
      if (!granted) return;
    }
    
    setIsCameraOn(true);
  }, [permissionStatus, requestCameraPermission]);

  const stopCamera = useCallback(() => {
    setIsCameraOn(false);
    setIsFullscreen(false);
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

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (webcamRef.current && webcamRef.current.video) {
        if (webcamRef.current.video.requestFullscreen) {
          webcamRef.current.video.requestFullscreen();
        } else if (webcamRef.current.video.webkitRequestFullscreen) {
          webcamRef.current.video.webkitRequestFullscreen();
        } else if (webcamRef.current.video.msRequestFullscreen) {
          webcamRef.current.video.msRequestFullscreen();
        }
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleUserMedia = useCallback(() => {
    setError(null);
  }, []);

  const handleUserMediaError = useCallback((err) => {
    console.error("Camera error:", err);
    let errorMessage = "Failed to access camera. Please check permissions.";
    
    if (err.name === 'NotAllowedError') {
      errorMessage = "Camera access denied. Please allow camera permissions in your browser settings.";
      setPermissionStatus('denied');
    } else if (err.name === 'NotFoundError') {
      errorMessage = "No camera found on this device.";
    } else if (err.name === 'NotReadableError') {
      errorMessage = "Camera is already in use by another application.";
    } else if (err.name === 'OverconstrainedError') {
      errorMessage = "Camera doesn't support the requested settings. Trying alternative configuration...";
    } else if (err.name === 'NotSupportedError') {
      errorMessage = "Camera not supported on this device or browser.";
    }
    
    setError(errorMessage);
    setIsCameraOn(false);
  }, []);

  const switchCamera = useCallback(() => {
    if (cameraDevices.length > 1) {
      const currentIndex = cameraDevices.findIndex(device => device.deviceId === selectedDevice);
      const nextIndex = (currentIndex + 1) % cameraDevices.length;
      setSelectedDevice(cameraDevices[nextIndex].deviceId);
    }
  }, [cameraDevices, selectedDevice]);

  const getPermissionButtonText = () => {
    if (isRequestingPermission) return '🔄 Requesting...';
    if (permissionStatus === 'denied') return '🔓 Grant Permission';
    if (permissionStatus === 'unknown') return '🔐 Request Permission';
    return '🎥 Open Camera';
  };

  const getPermissionButtonColor = () => {
    if (permissionStatus === 'denied') return 'bg-red-500 hover:bg-red-600 active:bg-red-700';
    if (permissionStatus === 'unknown') return 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700';
    return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700';
  };

  const MobilePermissionHelp = () => (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
      <h3 className="font-semibold text-yellow-800 mb-2">📱 Mobile Camera Setup Guide</h3>
      <div className="text-sm text-yellow-700 space-y-2">
        <p><strong>For Android:</strong></p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>Tap the camera icon in your browser's address bar</li>
          <li>Select "Allow" when prompted</li>
          <li>If blocked, go to Settings → Apps → Browser → Permissions → Camera</li>
        </ol>
        
        <p><strong>For iPhone/iPad:</strong></p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>Tap "Allow" when camera permission popup appears</li>
          <li>If blocked, go to Settings → Safari → Camera → Allow</li>
        </ol>
        
        <p><strong>General Tips:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Use Chrome or Safari browser</li>
          <li>Make sure you're on HTTPS (secure connection)</li>
          <li>Close other apps that might be using the camera</li>
        </ul>
      </div>
      <button
        onClick={() => setShowMobileHelp(false)}
        className="mt-3 px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
      >
        Got it!
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg max-w-full">
      <h2 className="text-lg font-bold mb-4">📸 Camera Preview</h2>
      
      {/* Permission Status */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p className="text-sm text-blue-800">
          📱 <strong>Mobile Camera Access:</strong> {permissionStatus === 'granted' ? '✅ Ready' : '⏳ Permission Required'}
        </p>
        {permissionStatus === 'denied' && (
          <p className="text-xs text-blue-600 mt-1">
            Camera permission was denied. Please allow camera access in your browser settings.
          </p>
        )}
      </div>
      
      {/* Camera Controls */}
      <div className="mb-4 flex flex-wrap gap-2 justify-center">
        {!isCameraOn ? (
          <button
            onClick={startCamera}
            disabled={isRequestingPermission}
            className={`px-4 py-2 text-white rounded transition-colors ${getPermissionButtonColor()}`}
          >
            {getPermissionButtonText()}
          </button>
        ) : (
          <>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              🛑 Stop Camera
            </button>
            <button
              onClick={captureScreenshot}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 active:bg-green-700 transition-colors"
            >
              📷 Take Photo
            </button>
            {cameraDevices.length > 1 && (
              <button
                onClick={switchCamera}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 active:bg-purple-700 transition-colors"
              >
                🔄 Switch Camera
              </button>
            )}
            {isMobile && (
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 active:bg-orange-700 transition-colors"
              >
                {isFullscreen ? '📱 Exit Fullscreen' : '📱 Fullscreen'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Mobile Help Button */}
      {isMobile && !isCameraOn && (
        <button
          onClick={() => setShowMobileHelp(!showMobileHelp)}
          className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          {showMobileHelp ? '❌ Hide Help' : '❓ Mobile Camera Help'}
        </button>
      )}

      {/* Mobile Permission Help */}
      {showMobileHelp && <MobilePermissionHelp />}

      {/* Camera Selection Dropdown */}
      {cameraDevices.length > 1 && (
        <div className="mb-4 w-full max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Camera:
          </label>
          <select
            value={selectedDevice || ''}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cameraDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Camera Feed */}
      {isCameraOn && (
        <div className="relative w-full max-w-full">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            className={`w-full max-w-md mx-auto rounded-xl shadow-lg object-cover ${
              isMobile ? (orientation === 'landscape' ? 'h-48' : 'h-64') : 'h-72'
            }`}
            videoConstraints={getVideoConstraints()}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            mirrored={!isMobile} // Don't mirror on mobile (back camera)
          />
          {error && (
            <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 rounded-t-xl text-center text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isCameraOn && (
        <div className="text-center text-gray-600 max-w-md">
          <p>Click "Open Camera" to start the camera preview</p>
          <p className="text-sm mt-2">
            {isMobile 
              ? "On mobile, this will use your back camera by default. Tap 'Switch Camera' to use the front camera."
              : "Make sure to allow camera permissions when prompted"
            }
          </p>
          {isMobile && (
            <div className="text-sm mt-1 text-blue-600 space-y-1">
              <p>💡 Tip: Hold your phone horizontally for better photo quality</p>
              <p>💡 Tip: Use fullscreen mode for better mobile experience</p>
              <p>💡 Tip: If camera doesn't work, try refreshing the page</p>
              <p>💡 Tip: Use the Mobile Camera Help button above for detailed instructions</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded max-w-md">
          <p className="font-semibold">Camera Error:</p>
          <p className="text-sm">{error}</p>
          <div className="text-sm mt-2 space-y-1">
            <p>• Try refreshing the page</p>
            <p>• Check browser camera permissions</p>
            {isMobile && (
              <>
                <p>• Ensure no other app is using the camera</p>
                <p>• Try switching between front/back cameras</p>
                <p>• Check if camera is blocked by device settings</p>
                <p>• Try opening in a different browser (Chrome/Safari)</p>
                <p>• Make sure HTTPS is enabled (required for camera access)</p>
                <p>• Use the Mobile Camera Help button for step-by-step instructions</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Device Info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Device: {isMobile ? '📱 Mobile' : '💻 Desktop'}</p>
        <p>Orientation: {orientation === 'landscape' ? '🔄 Landscape' : '📱 Portrait'}</p>
        <p>Permission Status: {permissionStatus}</p>
        <p>Available cameras: {cameraDevices.length}</p>
        {isMobile && (
          <p>Touch-friendly: ✅ Optimized for mobile</p>
        )}
      </div>
    </div>
  );
}
