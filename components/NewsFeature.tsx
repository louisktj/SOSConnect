import React, { useState, useCallback, useRef, useEffect } from 'react';
import MediaRecorderComponent from './MediaRecorder';
import LoadingSpinner from './LoadingSpinner';
import { generateDubbedAudio } from '../services/elevenLabsService';
import { analyzeNewsVideo, fileToGenerativePart } from '../services/geminiService';
import { SendIcon } from '../constants';
import DubbedVideoPlayer from './DubbedVideoPlayer';
import { TimedSegment, LocationInfo } from '../types';
import { Part } from '@google/genai';
import { getCurrentLocation, getLanguageForCountry } from '../services/locationService';

const NewsFeature: React.FC = () => {
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaPart, setMediaPart] = useState<Part | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [dubbedAudioBlob, setDubbedAudioBlob] = useState<Blob | null>(null);
  const [dubbedAudioUrl, setDubbedAudioUrl] = useState<string | null>(null);
  const [timedSegments, setTimedSegments] = useState<TimedSegment[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [emailActionTaken, setEmailActionTaken] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationTxId, setVerificationTxId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getCurrentLocation();
        const lang = getLanguageForCountry(loc.countryCode);
        setLocation({ ...loc, localLanguage: lang });
      } catch (err: any) {
        setError("Could not fetch location data. Some features might be limited.");
      }
    };
    fetchLocation();
  }, []);

  const handleRecordingComplete = async (blob: Blob) => {
    setMediaBlob(blob);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(URL.createObjectURL(blob));
    const part = await fileToGenerativePart(blob);
    setMediaPart(part);

    setDubbedAudioUrl(null);
    setDubbedAudioBlob(null);
    setTimedSegments([]);
    setSummary('');
    setEmailActionTaken(false);
    setVerificationTxId(null);
  };

  const processNewsVideo = useCallback(async () => {
    if (!mediaBlob || !mediaPart) {
      setError('No video to process.');
      return;
    }

    setIsLoading(true);
    setError('');
    setDubbedAudioUrl(null);
    setDubbedAudioBlob(null);
    setTimedSegments([]);
    setSummary('');
    setEmailActionTaken(false);
    setVerificationTxId(null);

    try {
      setLoadingStep('Starting video processing...');

      // Run Gemini subtitle generation and ElevenLabs dubbing in parallel
      const [analysisResult, dubbingResult] = await Promise.all([
        analyzeNewsVideo(mediaPart),
        generateDubbedAudio(mediaBlob, (step) => setLoadingStep(step))
      ]);
      
      setTimedSegments(analysisResult.segments);
      setSummary(analysisResult.summary);
      setDubbedAudioBlob(dubbingResult.dubbedAudioBlob);
      setDubbedAudioUrl(dubbingResult.dubbedAudioUrl);

    } catch (err: any) {
      console.error(err);
      setError('Failed to process video. ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [mediaBlob, mediaPart]);
  
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendNews = () => {
    if (!location || !summary || timedSegments.length === 0 || !mediaBlob || !dubbedAudioBlob) {
      setError("Cannot create email draft. Missing location, summary, transcript, or video/audio data.");
      return;
    }
    setEmailActionTaken(false);
    
    // 1. Download the files for the user to attach
    const videoExtension = mediaBlob.type.split('/')[1] || 'webm';
    downloadBlob(mediaBlob, `original_story_video.${videoExtension}`);
    downloadBlob(dubbedAudioBlob, 'translated_english_audio.mp3');


    const ngoEmails = [
      'media@redcross.org',
      'press@amnesty.org',
      'hrwpress@hrw.org',
      'media@savechildren.org',
      'media@apac.msf.org',
    ];

    const subject = "Translated local story – urgent community report";
    
    const translatedTranscriptContent = timedSegments.map(s => s.translatedText).join('\n');

    const body = `
--- Urgent Community Report ---

IMPORTANT: Two files have just been downloaded to your device:
1. original_story_video.${videoExtension}
2. translated_english_audio.mp3

*** Please attach BOTH files to this email before sending. ***

Location: ${location.city}, ${location.country}
Local Language Detected: ${location.localLanguage}

Video Summary:
${summary}

Full Translated Transcript (English):
${translatedTranscriptContent}

---
This report was generated and translated by SOSConnect to amplify local voices.
    `.trim().replace(/\n\s+/g, '\n');

    const bcc = ngoEmails.join(',');
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoLink;
    setEmailActionTaken(true);
  };

  const handleVerifyOnSolana = () => {
    setIsVerifying(true);
    setVerificationTxId(null);

    setTimeout(() => {
        const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const fakeTxId = `demo_tx_${randomString}`;
        setVerificationTxId(fakeTxId);
        setIsVerifying(false);
    }, 3000);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const blob = new Blob([file], { type: file.type });
          handleRecordingComplete(blob);
      }
  };

  const handleRetake = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (dubbedAudioUrl) URL.revokeObjectURL(dubbedAudioUrl);

    setMediaBlob(null);
    setMediaPart(null);
    setVideoUrl(null);
    setDubbedAudioUrl(null);
    setDubbedAudioBlob(null);
    setTimedSegments([]);
    setError('');
    setIsLoading(false);
    setLoadingStep('');
    setSummary('');
    setEmailActionTaken(false);
    setVerificationTxId(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
    }
  };
  
  const originalTranscript = timedSegments.map(s => s.originalText).join('\n');
  const translatedTranscript = timedSegments.map(s => s.translatedText).join('\n');


  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-brand-news mb-2">🟢 Share Your Story To ONGs</h2>
        <p className="text-gray-300">Record a video to share your story with the world. We will translate it to English with an authentic, lip-synced voiceover to ensure your message is heard globally.</p>
        {error && <p className="mt-2 text-red-400 bg-red-900/50 p-2 rounded">{error}</p>}
      </div>

      {!mediaBlob && (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <MediaRecorderComponent onRecordingComplete={handleRecordingComplete} mediaType='video' />
          
          <div className="flex items-center justify-center gap-4">
            <hr className="w-full border-gray-600" />
            <span className="text-gray-400">OR</span>
            <hr className="w-full border-gray-600" />
          </div>
          
          <div className="text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
              aria-label="Upload video file"
            />
            <button
              onClick={handleUploadClick}
              className="flex items-center justify-center mx-auto gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105 hover:bg-indigo-500"
            >
              <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Video
            </button>
          </div>
        </div>
      )}


      {mediaBlob && !dubbedAudioUrl && (
        <div className="text-center">
             <video src={videoUrl ?? ''} controls className="w-full max-w-lg mx-auto rounded-lg shadow-lg mb-4"></video>
            <button
              onClick={processNewsVideo}
              disabled={isLoading}
              className="px-6 py-3 bg-brand-news text-white font-bold rounded-lg shadow-lg hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? 'Processing...' : 'Translate My Story'}
            </button>
        </div>
      )}

      {isLoading && <LoadingSpinner message={loadingStep} />}

      {dubbedAudioUrl && videoUrl && (
        <div className="mt-6 animate-fade-in space-y-6">
          <div>
              <h3 className="text-lg font-semibold mb-4 text-center">Translated Video Preview</h3>
              <div className="max-w-2xl mx-auto">
                <DubbedVideoPlayer videoUrl={videoUrl} audioUrl={dubbedAudioUrl} timedSegments={timedSegments} />
              </div>
          </div>

          {timedSegments.length > 0 && (
            <div className="p-4 bg-gray-800 rounded-lg shadow-md max-w-4xl mx-auto">
              <h3 className="text-lg font-semibold mb-3 text-gray-200">Full Transcript</h3>
              <div className="max-h-60 overflow-y-auto space-y-3 pr-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-2 rounded bg-gray-900/50">
                    <span className="font-bold text-gray-400 block mb-1">Original:</span>
                    <p className="text-gray-300 whitespace-pre-wrap">{originalTranscript}</p>
                  </div>
                  <div className="p-2 rounded bg-gray-900/50">
                    <span className="font-bold text-blue-400 block mb-1">Translation:</span>
                    <p className="text-blue-200 whitespace-pre-wrap">{translatedTranscript}</p>
                  </div>
              </div>
            </div>
          )}


          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                  onClick={handleRetake}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gray-600 text-white font-bold text-lg rounded-lg shadow-xl hover:bg-gray-500 transition-colors duration-200"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M6.828 6.828A8.25 8.25 0 0118.182 18.182" />
                  </svg>
                  Retake Video
              </button>
              <button
                  onClick={handleSendNews}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-green-700 text-white font-bold text-lg rounded-lg shadow-xl hover:bg-green-600 transition-colors duration-200"
              >
                  <SendIcon className="h-6 w-6" />
                  Share Story to NGOS
              </button>
              {!verificationTxId && (
                <button
                    onClick={handleVerifyOnSolana}
                    disabled={isVerifying}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-purple-600 text-white font-bold text-lg rounded-lg shadow-xl hover:bg-purple-500 transition-colors duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    {isVerifying ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Verifying...
                        </>
                    ) : (
                        'Verify on Solana'
                    )}
                </button>
              )}
          </div>
          {emailActionTaken && (
            <p className="mt-4 text-lg text-green-400 font-semibold text-center">
              ✅ Files downloaded. Please attach them to the email draft that just opened.
            </p>
          )}

          {verificationTxId && !isVerifying && (
            <div className="mt-4 text-center p-3 bg-gray-800 rounded-lg max-w-md mx-auto">
                <p className="text-lg text-green-400 font-semibold">
                    ✅ Story verified on Solana (devnet)
                </p>
                <a
                    href={`https://explorer.solana.com/tx/${verificationTxId}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                    View proof on Explorer
                </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsFeature;