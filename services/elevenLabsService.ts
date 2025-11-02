import { TimedSegment } from '../types';

const ELEVENLABS_API_KEY = 'sk_000be5f1ca5d0b2cad87cf1c84083f23257b77887e28b275';
const DUBBING_API_URL = 'https://api.elevenlabs.io/v1/dubbing';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export const generateDubbedAudio = async (
    videoBlob: Blob,
    updateLoadingStep: (step: string) => void
): Promise<{ dubbedAudioBlob: Blob, dubbedAudioUrl: string }> => {
    if (!videoBlob) {
        throw new Error("Video file is missing.");
    }

    updateLoadingStep('Uploading video to ElevenLabs for automatic dubbing...');
    
    // 1. Create FormData and initiate dubbing in automatic mode
    const formData = new FormData();
    formData.append('mode', 'automatic');
    formData.append('file', videoBlob, 'source_video.mp4');
    formData.append('target_lang', 'en');
    formData.append('name', `SOSConnect_Dub_${Date.now()}`);
    // source_lang is omitted to allow for automatic detection

    const initialResponse = await fetch(DUBBING_API_URL, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: formData,
    });

    if (!initialResponse.ok) {
        const errorText = await initialResponse.text();
        throw new Error(`Failed to initiate dubbing job: ${errorText}`);
    }
    const { dubbing_id } = await initialResponse.json();

    // 2. Poll for completion
    updateLoadingStep('Polling for dubbing completion...');
    const dubbingStatusUrl = `${DUBBING_API_URL}/${dubbing_id}`;
    
    const inProgressStates = new Set([
        'queued', 'processing', 'transcribing', 'aligning', 
        'dubbing', 'rendering', 'in_progress'
    ]);

    while (true) {
        const statusResponse = await fetch(dubbingStatusUrl, {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        });

        if (!statusResponse.ok) {
            throw new Error('Failed to get dubbing status.');
        }

        const statusData = await statusResponse.json();
        
        if (statusData.status === 'dubbed') {
            break; // Exit loop on success
        } else if (inProgressStates.has(statusData.status)) {
            const statusMessage = statusData.status.charAt(0).toUpperCase() + statusData.status.slice(1);
            updateLoadingStep(`Dubbing status: ${statusMessage}...`);
            await sleep(5000); // Wait 5 seconds before checking again
        } else {
            throw new Error(`Dubbing job failed with status: ${statusData.status}. Reason: ${statusData.error || 'Unknown'}`);
        }
    }
    
    // 3. Fetch the final dubbed audio (MP3)
    updateLoadingStep('Downloading final dubbed audio...');
    const dubbedAudioResponse = await fetch(`${dubbingStatusUrl}/audio/en`, {
         headers: {
             'xi-api-key': ELEVENLABS_API_KEY,
             'Accept': 'audio/mpeg',
         },
    });

    if (!dubbedAudioResponse.ok) {
        const errorText = await dubbedAudioResponse.text();
        console.error("ElevenLabs download error:", errorText);
        throw new Error('Failed to fetch the final dubbed audio.');
    }
    
    const audioBlobResult = await dubbedAudioResponse.blob();
    const dubbedAudioUrl = URL.createObjectURL(audioBlobResult);

    return { dubbedAudioBlob: audioBlobResult, dubbedAudioUrl };
};