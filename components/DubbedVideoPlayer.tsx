import React, { useRef, useEffect, useState } from 'react';
import { TimedSegment } from '../types';

interface DubbedVideoPlayerProps {
  videoUrl: string;
  audioUrl: string;
  timedSegments: TimedSegment[];
}

const DubbedVideoPlayer: React.FC<DubbedVideoPlayerProps> = ({ videoUrl, audioUrl, timedSegments }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
        const currentTime = video.currentTime;
        const activeSegment = timedSegments.find(
            segment => currentTime >= segment.startTime && currentTime < segment.endTime
        );
        setCurrentSubtitle(activeSegment ? activeSegment.translatedText : '');
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoUrl, timedSegments]);

  const syncPlay = () => audioRef.current?.play();
  const syncPause = () => audioRef.current?.pause();
  const syncSeek = () => {
    if (videoRef.current && audioRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
    }
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        muted
        onPlay={syncPlay}
        onPause={syncPause}
        onSeeked={syncSeek}
        className="w-full rounded-lg shadow-lg bg-black"
      ></video>
      <audio ref={audioRef} src={audioUrl}></audio>
      {currentSubtitle && (
        <div 
          className="absolute bottom-12 sm:bottom-16 md:bottom-20 left-1/2 -translate-x-1/2 w-full px-4"
          style={{ textShadow: '2px 2px 4px #000000' }}
        >
          <p className="text-center text-lg sm:text-xl md:text-2xl font-semibold text-white bg-black bg-opacity-50 rounded-md px-4 py-2">
            {currentSubtitle}
          </p>
        </div>
      )}
    </div>
  );
};

export default DubbedVideoPlayer;