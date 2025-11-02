import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MicIcon, VideoIcon, StopIcon } from '../constants';

interface MediaRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  mediaType: 'audio' | 'video' | 'audio/video';
}

const MediaRecorderComponent: React.FC<MediaRecorderProps> = ({ onRecordingComplete, mediaType }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // This effect handles attaching the stream to the video element
  // once the stream is ready and the video element is in the DOM.
  useEffect(() => {
    if (isRecording && recordingType === 'video' && stream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = stream;
    }
  }, [isRecording, recordingType, stream]);


  const startRecording = useCallback(async (type: 'audio' | 'video') => {
    try {
      const constraints = type === 'video' 
        ? { audio: true, video: true } 
        : { audio: true, video: false };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set all states that trigger the re-render and the useEffect
      setStream(mediaStream);
      setRecordingType(type);
      setIsRecording(true);
      
      const options = { mimeType: type === 'video' ? 'video/webm' : 'audio/webm' };
      const mediaRecorder = new MediaRecorder(mediaStream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: options.mimeType });
        onRecordingComplete(blob);
        recordedChunksRef.current = [];
      };
      
      mediaRecorder.start();
    } catch (err) {
      console.error("Error starting recording:", err);
      // Reset state on error
      setIsRecording(false);
      setStream(null);
      setRecordingType(null);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsRecording(false);
    setStream(null);
    setRecordingType(null);
  }, [stream]);

  const renderButtons = () => {
    if (isRecording) {
      return (
        <button
          onClick={stopRecording}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-full shadow-lg hover:bg-red-500 transition-colors animate-pulse"
        >
          <StopIcon className="h-6 w-6" />
          Stop Recording
        </button>
      );
    }

    const buttonClasses = "flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105";
    
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        {(mediaType === 'audio' || mediaType === 'audio/video') && (
          <button onClick={() => startRecording('audio')} className={`${buttonClasses} bg-blue-600 hover:bg-blue-500`}>
            <MicIcon className="h-6 w-6" />
            Record Audio
          </button>
        )}
        {(mediaType === 'video' || mediaType === 'audio/video') && (
          <button onClick={() => startRecording('video')} className={`${buttonClasses} bg-purple-600 hover:bg-purple-500`}>
            <VideoIcon className="h-6 w-6" />
            Record Video
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col justify-center items-center p-4 rounded-lg space-y-4">
      {isRecording && recordingType === 'video' && (
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          className="w-full max-w-md rounded-lg shadow-lg bg-black border-2 border-gray-600"
        ></video>
      )}
      <div className="flex justify-center items-center">
        {renderButtons()}
      </div>
    </div>
  );
};

export default MediaRecorderComponent;