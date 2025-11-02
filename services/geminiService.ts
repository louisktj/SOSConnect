import { GoogleGenAI, Type, Part, Modality } from "@google/genai";
import { LocationInfo, SosReport, FirstAidStep, TimedSegment } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Extracts a JSON string from a larger string that may contain markdown or other text,
 * and then parses it.
 * @param text The text response from the AI.
 * @returns The parsed JSON object.
 */
function cleanAndParseJson(text: string): any {
    // Find the first occurrence of '{' or '[' to determine the start of the JSON.
    const firstBracket = text.indexOf('[');
    const firstBrace = text.indexOf('{');
    let startIndex = -1;

    if (firstBracket === -1 && firstBrace === -1) {
        // If no JSON object/array is found, try to parse the whole string.
        // This will throw an error if it's not valid JSON, which is the expected behavior.
        return JSON.parse(text);
    }
    
    if (firstBracket === -1) {
        startIndex = firstBrace;
    } else if (firstBrace === -1) {
        startIndex = firstBracket;
    } else {
        startIndex = Math.min(firstBracket, firstBrace);
    }

    // Find the last occurrence of '}' or ']' to determine the end of the JSON.
    const lastBracket = text.lastIndexOf(']');
    const lastBrace = text.lastIndexOf('}');
    const endIndex = Math.max(lastBracket, lastBrace);

    if (endIndex === -1) {
        // This case is unlikely if a start was found, but for safety, try parsing the whole text.
        return JSON.parse(text);
    }

    // Extract the substring that looks like a JSON object or array.
    const jsonText = text.substring(startIndex, endIndex + 1);
    
    return JSON.parse(jsonText);
}


export async function fileToGenerativePart(file: Blob): Promise<Part> {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}


export async function generateSosReport(mediaPart: Part, location: LocationInfo): Promise<{ report: SosReport; translation: string }> {
  const translationPrompt = `Transcribe the following audio/video and translate the transcription into ${location.localLanguage}. The original language can be anything.`;
  const reportPrompt = `
    Based on the following audio/video, analyze the content and generate a structured SOS report in JSON format.
    The user is located in ${location.city}, ${location.country}.
    The JSON object must conform to this schema. Do not include any markdown formatting.
  `;
  const sosReportSchema = {
    type: Type.OBJECT,
    properties: {
        context: { type: Type.STRING, description: "A brief summary of the situation." },
        location_details: { type: Type.STRING, description: `The user's location. Default to: ${location.city}, ${location.country}`},
        danger_type: { type: Type.STRING, description: "Categorize the emergency (e.g., Medical, Fire, Accident, Natural Disaster, Crime)." },
        user_needs: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of specific needs mentioned (e.g., 'Ambulance', 'Police', 'Medical supplies')." },
    },
    required: ["context", "location_details", "danger_type", "user_needs"],
  };

  const [translationResponse, reportResponse] = await Promise.all([
    ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [ {text: translationPrompt}, mediaPart ] }
    }),
    ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{text: reportPrompt}, mediaPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: sosReportSchema
        }
    })
  ]);

  const translation = translationResponse.text;
  const reportJson = cleanAndParseJson(reportResponse.text);
  
  return { report: reportJson as SosReport, translation };
}

export async function generateFirstAid(report: SosReport, mediaPart: Part): Promise<{ firstAidSteps: FirstAidStep[] }> {
    // 1. Detect the language from the user's media first.
    const languageDetectionPrompt = `
        Detect the primary language spoken in the provided audio/video.
        Return only the name of the language (e.g., "Spanish", "French", "German").
        If no language is detected, default to "English".
    `;

    const languageDetectionResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: languageDetectionPrompt }, mediaPart] },
    });
    const detectedLanguage = languageDetectionResponse.text.trim();

    // 2. Generate instructions and image prompts, with instructions pre-translated
    //    and image prompts specifying the language for any text.
    const generationPrompt = `
        An emergency has been reported with the following context: "${report.context}".
        The emergency is categorized as "${report.danger_type}" and the immediate needs are "${report.user_needs.join(', ')}".
        The user's language is ${detectedLanguage}.

        Based on this specific situation, generate a JSON array with 3 to 5 objects. Each object must represent a critical first-aid step and have two keys:
        1. "instruction": A very short, simple, and clear first-aid instruction, directly translated into ${detectedLanguage}. This text should be what the user reads.
        2. "image_prompt": A detailed prompt in ENGLISH for an AI image generator. The prompt should describe a clear, simple instructional image for the step. CRITICAL: Any text that appears inside the generated image MUST be in ${detectedLanguage}. Example prompt: "A clear, simple instructional image for a first-aid manual showing how to apply pressure to a deep cut on an arm, with the label 'Apply Pressure' written in ${detectedLanguage}."

        Do not provide complex medical advice. Focus on immediate, life-preserving actions.
        Return only the JSON array without markdown formatting.
    `;

    const instructionAndImagePromptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: generationPrompt }] },
        config: { responseMimeType: "application/json" }
    });

    const generatedPairs: { instruction: string; image_prompt: string }[] = cleanAndParseJson(instructionAndImagePromptResponse.text);
    
    // 3. Generate the images based on the prompts.
    const imageGenerationPromises = generatedPairs.map(pair => 
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: pair.image_prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        })
    );
    const imageResponses = await Promise.all(imageGenerationPromises);
    
    const images: string[] = imageResponses.map(response => {
        const part = response.candidates[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        return '';
    });

    // 4. Assemble the final steps. The instructions are already in the correct language.
    const firstAidSteps: FirstAidStep[] = generatedPairs.map((pair, index) => ({
        instruction: pair.instruction,
        image: images[index] || '',
    }));

    return { firstAidSteps };
}

export async function analyzeNewsVideo(mediaPart: Part): Promise<{ segments: TimedSegment[]; summary: string; }> {
    const prompt = `
    Analyze the provided video. Perform two tasks:
    1. Create a synchronized transcript and translation. The original language can be anything, but the translated text MUST be in English.
    2. Write a short, one-paragraph summary of the story in English.

    The output must be a single, valid JSON object with two keys:
    - "summary": A string containing the summary.
    - "segments": An array of objects, where each object represents a segment of speech and has the following keys:
      - "originalText" (the transcription in the original language)
      - "translatedText" (the English translation)
      - "startTime" (the start time in seconds, e.g., 1.23)
      - "endTime" (the end time in seconds, e.g., 3.45)
    
    Ensure the timestamps are accurate and cover all spoken parts.
    Do not include any markdown formatting or other text outside of the JSON object.
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A short, one-paragraph summary of the story in English." },
        segments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    originalText: { type: Type.STRING, description: "The transcribed text in the original language." },
                    translatedText: { type: Type.STRING, description: "The translated text in English." },
                    startTime: { type: Type.NUMBER, description: "The start time of the segment in seconds." },
                    endTime: { type: Type.NUMBER, description: "The end time of the segment in seconds." },
                },
                required: ["originalText", "translatedText", "startTime", "endTime"],
            }
        }
    },
    required: ["summary", "segments"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: { parts: [{ text: prompt }, mediaPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    }
  });

  const result = cleanAndParseJson(response.text);
  return result as { segments: TimedSegment[], summary: string };
}
