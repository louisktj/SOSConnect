import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LocationInfo, SosReport, GeneratedContent } from '../types';
import { getCurrentLocation, getLanguageForCountry } from '../services/locationService';
import { generateSosReport, generateFirstAid, fileToGenerativePart } from '../services/geminiService';
import MediaRecorderComponent from './MediaRecorder';
import LoadingSpinner from './LoadingSpinner';
import SosReportCard from './SosReportCard';
import { SendIcon } from '../constants';
import { Part } from '@google/genai';

const SosFeature: React.FC = () => {
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaPart, setMediaPart] = useState<Part | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getCurrentLocation();
        const lang = getLanguageForCountry(loc.countryCode);
        setLocation({ ...loc, localLanguage: lang });
      } catch (err: any) {
        setError(err.message);
      }
    };
    fetchLocation();
  }, []);

  const handleRecordingComplete = async (blob: Blob) => {
    setMediaBlob(blob);
    setGeneratedContent(null);
    setReportSent(false);
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
    setMediaPreviewUrl(URL.createObjectURL(blob));
    const part = await fileToGenerativePart(blob);
    setMediaPart(part);
  };
  
  const handleSendEmergency = (report: SosReport, translation: string) => {
    if (!report) {
        setError('No report content to send.');
        return;
    }
    
    const messageBody = `
🔴 EMERGENCY REPORT 🔴
Location: ${report.location_details}
Danger: ${report.danger_type}
Context: ${report.context}
Needs: ${report.user_needs.join(', ')}

--- Translation for Authorities ---
${translation}
    `.trim().replace(/\n\s+/g, '\n');

    const phoneNumber = '+33764707816';
    const encodedMessage = encodeURIComponent(messageBody);
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const separator = isIOS ? '&' : '?';
    const smsUrl = `sms:${phoneNumber}${separator}body=${encodedMessage}`;

    window.location.href = smsUrl;
    
    setReportSent(true);
  };
  
  const processEmergencyMedia = useCallback(async (isQuickSend: boolean) => {
    if (!mediaBlob || !location || !mediaPart) {
      setError('Media, location, or media part is missing.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setGeneratedContent(null);
    setReportSent(false);
    
    try {
      setLoadingStep('Generating SOS report and translation...');
      const { report, translation } = await generateSosReport(mediaPart, location);

      if (isQuickSend) {
        setLoadingStep('Opening SMS application...');
        handleSendEmergency(report, translation);
        setGeneratedContent({
            sosReport: report,
            fullTranslation: translation,
            firstAidSteps: [],
        });
      } else {
        setLoadingStep('Generating contextual images and first aid instructions...');
        const { firstAidSteps } = await generateFirstAid(report, mediaPart);
        setGeneratedContent({
          sosReport: report,
          fullTranslation: translation,
          firstAidSteps: firstAidSteps,
        });
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to process emergency media. ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [mediaBlob, location, mediaPart]);

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
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaBlob(null);
    setMediaPart(null);
    setMediaPreviewUrl(null);
    setGeneratedContent(null);
    setError('');
    setIsLoading(false);
    setLoadingStep('');
    setReportSent(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
    }
  };


  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-brand-sos mb-2">🔴 SOS Emergency Beacon</h2>
        <p className="text-gray-300">Record a video or audio message. We will translate it and send a report to local authorities based on your location.</p>
        {error && <p className="mt-2 text-red-400 bg-red-900/50 p-2 rounded">{error}</p>}
        {location ? (
          <p className="mt-2 text-sm text-gray-400">
            Location: <span className="font-semibold">{location.city}, {location.country}</span>. Local Language Detected: <span className="font-semibold">{location.localLanguage}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-yellow-400">Fetching your location...</p>
        )}
      </div>

      {!mediaBlob ? (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <MediaRecorderComponent onRecordingComplete={handleRecordingComplete} mediaType='audio/video' />
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
              accept="video/*,audio/*"
              className="hidden"
              aria-label="Upload media file"
            />
            <button
              onClick={handleUploadClick}
              className="flex items-center justify-center mx-auto gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105 hover:bg-indigo-500"
            >
              <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Media
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
            {mediaPreviewUrl && (
                mediaBlob.type.startsWith('video') ? (
                    <video src={mediaPreviewUrl} controls className="w-full max-w-lg mx-auto rounded-lg shadow-lg"></video>
                ) : (
                    <audio src={mediaPreviewUrl} controls className="w-full max-w-lg mx-auto"></audio>
                )
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                    onClick={handleRetake}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gray-600 text-white font-bold text-lg rounded-lg shadow-xl hover:bg-gray-500 transition-colors duration-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M6.828 6.828A8.25 8.25 0 0118.182 18.182" />
                    </svg>
                    Retake / Upload New
                </button>
                <button
                  onClick={() => processEmergencyMedia(false)}
                  disabled={isLoading || !location}
                  className="w-full sm:w-auto px-6 py-3 bg-brand-accent text-white font-bold rounded-lg shadow-lg hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? 'Processing...' : 'Generate Full Report & First Aid'}
                </button>
                <button
                  onClick={() => processEmergencyMedia(true)}
                  disabled={isLoading || !location}
                  className="w-full sm:w-auto px-6 py-3 bg-brand-sos text-white font-bold rounded-lg shadow-lg hover:bg-red-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? 'Processing...' : 'Quick Send Report'}
                </button>
            </div>
        </div>
      )}
      
      {isLoading && <LoadingSpinner message={loadingStep} />}

      {generatedContent && generatedContent.sosReport && (
        <div className="space-y-6 mt-6 animate-fade-in">
          <SosReportCard report={generatedContent.sosReport} translation={generatedContent.fullTranslation} />

          {generatedContent.firstAidSteps.length > 0 && (
            <div>
              <h3 className="text-3xl font-bold mb-4 text-center text-red-300">First Aid Guidance</h3>
              <div className="space-y-6">
                {generatedContent.firstAidSteps.map((step, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-center gap-6 bg-gray-800 p-6 rounded-lg shadow-md">
                    {step.image ? (
                      <img src={step.image} alt={`First aid illustration ${index + 1}`} className="w-full sm:w-64 sm:h-64 h-auto object-cover rounded-lg border-2 border-gray-700" />
                    ) : (
                      <div className="w-full sm:w-64 sm:h-64 h-auto flex items-center justify-center bg-gray-700 rounded-lg text-gray-400">No Image</div>
                    )}
                    <p className="flex-1 text-4xl font-bold text-red-300 text-center sm:text-left">{step.instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-center pt-4">
              {generatedContent.firstAidSteps.length > 0 && !reportSent && (
                <button
                  onClick={() => handleSendEmergency(generatedContent.sosReport!, generatedContent.fullTranslation)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-red-700 text-white font-bold text-lg rounded-lg shadow-xl hover:bg-red-600 transition-colors duration-200 animate-pulse"
                >
                  <SendIcon className="h-6 w-6" />
                  SEND EMERGENCY REPORT NOW
                </button>
              )}
              {reportSent && (
                <p className="mt-4 text-lg text-green-400 font-semibold">
                  📲 Report opened in your messaging app, ready to send!
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SosFeature;