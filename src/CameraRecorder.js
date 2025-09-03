import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const CameraRecorder = () => {
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [facingMode, setFacingMode] = useState("user"); // "user" for front, "environment" for back

  const videoConstraints = {
    width: 720,
    height: 480,
    facingMode: facingMode
  };

  const webcamConstraints = {
    ...videoConstraints,
    mirrored: facingMode === "user"  // Only mirror front camera
  };

  const handleDataAvailable = useCallback(({ data }) => {
    if (data.size > 0) {
      setRecordedChunks((prev) => prev.concat(data));
    }
  }, []);

  const handleStartCaptureClick = useCallback(() => {
    setRecordedChunks([]);
    setRecordedVideo(null);
    setUploadStatus('');
    
    const stream = webcamRef.current.video.srcObject;
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm"
      });
      mediaRecorderRef.current.addEventListener(
        "dataavailable",
        handleDataAvailable
      );
      mediaRecorderRef.current.start();
      setCapturing(true);
    }
  }, [webcamRef, setCapturing, handleDataAvailable]);

  const handleStopCaptureClick = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setCapturing(false);
      
      // Create video URL from recorded chunks
      if (recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, {
          type: "video/webm"
        });
        const url = URL.createObjectURL(blob);
        setRecordedVideo(url);
      }
    }
  }, [mediaRecorderRef, setCapturing, recordedChunks]);

  const handleDownload = useCallback(() => {
    if (recordedChunks.length) {
      const blob = new Blob(recordedChunks, {
        type: "video/webm"
      });
      
      // Create video element to flip the actual video data
      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob);
      video.muted = true;
      
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw flipped video frame by frame
        const processFrame = () => {
          if (video.currentTime < video.duration) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0);
            ctx.restore();
            
            video.currentTime += 1/30; // 30 fps
            requestAnimationFrame(processFrame);
          } else {
            // Video processing complete, download the flipped version
            canvas.toBlob((flippedBlob) => {
              const url = URL.createObjectURL(flippedBlob);
              const a = document.createElement("a");
              document.body.appendChild(a);
              a.style = "display: none";
              a.href = url;
              a.download = "react-webcam-stream-capture.webm";
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }, 'video/webm');
          }
        };
        
        video.currentTime = 0;
        processFrame();
      };
    }
  }, [recordedChunks]);

  const handleUpload = async () => {
    if (recordedChunks.length === 0) {
      setUploadStatus('No video to upload');
      return;
    }

    setUploading(true);
    setUploadStatus('Uploading...');

    try {
      const blob = new Blob(recordedChunks, {
        type: "video/webm"
      });

      const formData = new FormData();
      formData.append('video', blob, 'recording.webm');

      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadStatus('Video uploaded successfully!');
      console.log('Upload response:', response.data);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleGetVideos = async () => {
    setLoadingVideos(true);
    try {
      const response = await axios.get('http://localhost:5000/api/upload');
      setVideos(response.data.videos);
      setUploadStatus(`Found ${response.data.count} videos in database`);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setUploadStatus('Failed to fetch videos: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleDownloadVideo = (videoId) => {
    const downloadUrl = `http://localhost:5000/api/upload/${videoId}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `video_${videoId}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleCamera = () => {
    setFacingMode(prevMode => prevMode === "user" ? "environment" : "user");
    // Clear any existing recording when switching cameras
    setRecordedChunks([]);
    setRecordedVideo(null);
    setUploadStatus('');
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>🎥 Camera Recorder</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <Webcam
          audio={true}
          ref={webcamRef}
          videoConstraints={webcamConstraints}
          mirrored={facingMode === "user"}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={toggleCamera}
          disabled={capturing}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: capturing ? '#cccccc' : '#9c27b0',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: capturing ? 'not-allowed' : 'pointer',
            margin: '0 10px'
          }}
        >
          {facingMode === "user" ? "📷 Switch to Back Camera" : "🤳 Switch to Front Camera"}
        </button>

        {capturing ? (
          <button 
            onClick={handleStopCaptureClick}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              margin: '0 10px'
            }}
          >
            Stop Recording
          </button>
        ) : (
          <button 
            onClick={handleStartCaptureClick}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#44ff44',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              margin: '0 10px'
            }}
          >
            Start Recording
          </button>
        )}

        {recordedChunks.length > 0 && (
          <>
            <button 
              onClick={handleDownload}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4444ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                margin: '0 10px'
              }}
            >
              Download Video
            </button>
            
            <button 
              onClick={handleUpload}
              disabled={uploading}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: uploading ? '#cccccc' : '#ff8800',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                margin: '0 10px'
              }}
            >
              {uploading ? 'Uploading...' : 'Upload to Database'}
            </button>
          </>
        )}

        <button 
          onClick={handleGetVideos}
          disabled={loadingVideos}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: loadingVideos ? '#cccccc' : '#9932cc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loadingVideos ? 'not-allowed' : 'pointer',
            margin: '0 10px'
          }}
        >
          {loadingVideos ? 'Loading...' : 'Get Videos from Database'}
        </button>
      </div>

      {uploadStatus && (
        <div style={{
          padding: '10px',
          backgroundColor: uploadStatus.includes('successfully') ? '#d4edda' : '#f8d7da',
          color: uploadStatus.includes('successfully') ? '#155724' : '#721c24',
          border: `1px solid ${uploadStatus.includes('successfully') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '5px',
          margin: '10px 0'
        }}>
          {uploadStatus}
        </div>
      )}

      {recordedChunks.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Recorded Video Preview:</h3>
          <video
            controls
            style={{ 
              maxWidth: '100%', 
              height: 'auto'
            }}
            src={recordedVideo}
          />
        </div>
      )}

      {videos.length > 0 && (
        <div style={{ marginTop: '30px', textAlign: 'left' }}>
          <h3>📹 Videos in Database:</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '20px',
            marginTop: '20px'
          }}>
            {videos.map((video) => (
              <div key={video.id} style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: '#f9f9f9'
              }}>
                <h4>Video ID: {video.id}</h4>
                <p>Size: {(video.size / 1024 / 1024).toFixed(2)} MB</p>
                <button 
                  onClick={() => handleDownloadVideo(video.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  Download Video
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraRecorder;
