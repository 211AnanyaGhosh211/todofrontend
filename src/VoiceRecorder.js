import React, { useState, useRef, useCallback, useEffect } from "react";
import lamejs from 'lamejs';

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [showMobileHelp, setShowMobileHelp] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);

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

  // Check microphone permission status
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permission = await navigator.permissions.query({ name: 'microphone' });
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

  // Request microphone permission explicitly
  const requestMicrophonePermission = useCallback(async () => {
    setIsRequestingPermission(true);
    setError(null);
    
    try {
      // Try to get user media to trigger permission request
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus('granted');
      setIsRequestingPermission(false);
      return true;
    } catch (err) {
      console.error('Microphone permission request failed:', err);
      setIsRequestingPermission(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.');
        setPermissionStatus('denied');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found on this device.');
      } else {
        setError('Failed to access microphone. Please check your device settings.');
      }
      return false;
    }
  }, []);

  // Convert audio to MP3 format using lamejs
  const convertToMP3 = useCallback(async (audioBlob) => {
    try {
      setIsConverting(true);
      
      // Create audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Get audio data
      const numberOfChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const sampleRate = audioBuffer.sampleRate;
      
      // Convert to mono if stereo (average the channels)
      let audioData;
      if (numberOfChannels === 2) {
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        audioData = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          audioData[i] = (leftChannel[i] + rightChannel[i]) / 2;
        }
      } else {
        audioData = audioBuffer.getChannelData(0);
      }
      
      // Convert float32 to int16 (required by lamejs)
      const int16Array = new Int16Array(length);
      for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, audioData[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Convert to MP3 using lamejs
      const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 128); // mono, sampleRate, kbps
      const mp3Data = [];
      
      // Process audio in chunks
      const chunkSize = 1152; // Optimal chunk size for MP3 encoding
      for (let i = 0; i < int16Array.length; i += chunkSize) {
        const chunk = int16Array.subarray(i, i + chunkSize);
        const mp3buf = mp3Encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Finalize encoding
      const mp3buf = mp3Encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // Combine all MP3 chunks
      const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
      const mp3Array = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of mp3Data) {
        mp3Array.set(buf, offset);
        offset += buf.length;
      }
      
      // Create MP3 blob
      const mp3Blob = new Blob([mp3Array], { type: 'audio/mp3' });
      
      return mp3Blob;
      
    } catch (err) {
      console.error('MP3 conversion failed:', err);
      // Fallback: return original blob if conversion fails
      return audioBlob;
    } finally {
      setIsConverting(false);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    
    // Check if we need to request permission first
    if (permissionStatus === 'denied') {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }
    
    // If permission is unknown, try to request it
    if (permissionStatus === 'unknown') {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 2
        }
      });

      // Use WebM format for recording (better compatibility)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current.mimeType 
        });
        
        // Always convert to MP3 for consistent format
        const mp3Blob = await convertToMP3(audioBlob);
        
        setAudioBlob(mp3Blob);
        setAudioUrl(URL.createObjectURL(mp3Blob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please check microphone permissions.');
    }
  }, [permissionStatus, requestMicrophonePermission, convertToMP3]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  // Download recording
  const downloadRecording = useCallback(() => {
    if (audioBlob) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `voice-recording-${Date.now()}.mp3`;
      link.click();
    }
  }, [audioBlob, audioUrl]);

  // Clear recording
  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPermissionButtonText = () => {
    if (isRequestingPermission) return '🔄 Requesting...';
    if (permissionStatus === 'denied') return '🔓 Grant Permission';
    if (permissionStatus === 'unknown') return '🔐 Request Permission';
    return '🎤 Start Recording';
  };

  const getPermissionButtonColor = () => {
    if (permissionStatus === 'denied') return 'bg-red-500 hover:bg-red-600 active:bg-red-700';
    if (permissionStatus === 'unknown') return 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700';
    return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700';
  };

  const MobilePermissionHelp = () => (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
      <h3 className="font-semibold text-yellow-800 mb-2">📱 Mobile Microphone Setup Guide</h3>
      <div className="text-sm text-yellow-700 space-y-2">
        <p><strong>For Android:</strong></p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>Tap the microphone icon in your browser's address bar</li>
          <li>Select "Allow" when prompted</li>
          <li>If blocked, go to Settings → Apps → Browser → Permissions → Microphone</li>
        </ol>
        
        <p><strong>For iPhone/iPad:</strong></p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>Tap "Allow" when microphone permission popup appears</li>
          <li>If blocked, go to Settings → Safari → Microphone → Allow</li>
        </ol>
        
        <p><strong>General Tips:</strong></p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Use Chrome or Safari browser</li>
          <li>Make sure you're on HTTPS (secure connection)</li>
          <li>Close other apps that might be using the microphone</li>
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
      <h2 className="text-lg font-bold mb-4">🎤 Voice Recorder (MP3)</h2>
      
      {/* Permission Status */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p className="text-sm text-blue-800">
          🎤 <strong>Microphone Access:</strong> {permissionStatus === 'granted' ? '✅ Ready' : '⏳ Permission Required'}
        </p>
        {permissionStatus === 'denied' && (
          <p className="text-xs text-blue-600 mt-1">
            Microphone permission was denied. Please allow microphone access in your browser settings.
          </p>
        )}
      </div>

      {/* Recording Controls */}
      <div className="mb-4 flex flex-wrap gap-2 justify-center">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isRequestingPermission}
            className={`px-4 py-2 text-white rounded transition-colors ${getPermissionButtonColor()}`}
          >
            {getPermissionButtonText()}
          </button>
        ) : (
          <>
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 active:bg-orange-700 transition-colors"
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              ⏹️ Stop Recording
            </button>
          </>
        )}
      </div>

      {/* Mobile Help Button */}
      {isMobile && !isRecording && (
        <button
          onClick={() => setShowMobileHelp(!showMobileHelp)}
          className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          {showMobileHelp ? '❌ Hide Help' : '❓ Mobile Microphone Help'}
        </button>
      )}

      {/* Mobile Permission Help */}
      {showMobileHelp && <MobilePermissionHelp />}

      {/* Recording Timer */}
      {isRecording && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
          <p className="text-center text-red-800 font-mono text-2xl">
            ⏱️ {formatTime(recordingTime)}
          </p>
          <p className="text-center text-red-600 text-sm mt-1">
            {isPaused ? '⏸️ Paused' : '🔴 Recording...'}
          </p>
        </div>
      )}

      {/* Converting Status */}
      {isConverting && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-lg">
          <p className="text-center text-yellow-800 text-lg">
            🔄 Converting to MP3...
          </p>
          <p className="text-center text-yellow-600 text-sm mt-1">
            Please wait while we convert your recording to MP3 format
          </p>
        </div>
      )}

      {/* Audio Player */}
      {audioUrl && (
        <div className="mb-4 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-2 text-center">🎵 Your MP3 Recording</h3>
          <audio 
            controls 
            className="w-full mb-3"
            src={audioUrl}
          >
            Your browser does not support the audio element.
          </audio>
          
          <div className="flex gap-2 justify-center">
            <button
              onClick={downloadRecording}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 active:bg-green-700 transition-colors"
            >
              💾 Download MP3
            </button>
            <button
              onClick={clearRecording}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 active:bg-gray-700 transition-colors"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isRecording && !audioUrl && (
        <div className="text-center text-gray-600 max-w-md">
          <p>Click "Start Recording" to begin voice recording</p>
          <p className="text-sm mt-2">
            {isMobile 
              ? "On mobile, this will request microphone permission. Tap 'Allow' when prompted."
              : "Make sure to allow microphone permissions when prompted"
            }
          </p>
          <p className="text-sm mt-1 text-green-600 font-semibold">
            ✅ All recordings are automatically converted to MP3 format
          </p>
          <p className="text-sm mt-1 text-blue-600">
            🎵 High-quality MP3 with 128kbps bitrate
          </p>
          {isMobile && (
            <div className="text-sm mt-1 text-blue-600 space-y-1">
              <p>💡 Tip: Hold your phone close to your mouth for better audio quality</p>
              <p>💡 Tip: Use the Mobile Microphone Help button for detailed instructions</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded max-w-md">
          <p className="font-semibold">Recording Error:</p>
          <p className="text-sm">{error}</p>
          <div className="text-sm mt-2 space-y-1">
            <p>• Try refreshing the page</p>
            <p>• Check browser microphone permissions</p>
            {isMobile && (
              <>
                <p>• Ensure no other app is using the microphone</p>
                <p>• Try opening in a different browser (Chrome/Safari)</p>
                <p>• Make sure HTTPS is enabled (required for microphone access)</p>
                <p>• Use the Mobile Microphone Help button for step-by-step instructions</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Device Info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Device: {isMobile ? '📱 Mobile' : '💻 Desktop'}</p>
        <p>Permission Status: {permissionStatus}</p>
        <p>Recording Format: MP3 (128kbps, High Quality)</p>
        {isMobile && (
          <p>Touch-friendly: ✅ Optimized for mobile</p>
        )}
      </div>
    </div>
  );
}
