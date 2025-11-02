export type Feature = 'SOS' | 'NEWS';

export interface LocationInfo {
  city: string;
  country: string;
  countryCode: string;
  localLanguage: string;
}

export interface SosReport {
  context: string;
  location_details: string;
  danger_type: string;
  user_needs: string[];
}

export interface FirstAidStep {
  instruction: string;
  image: string;
}

export interface GeneratedContent {
  sosReport: SosReport | null;
  fullTranslation: string;
  firstAidSteps: FirstAidStep[];
}

export interface TimedSegment {
  originalText: string;
  translatedText: string;
  startTime: number;
  endTime: number;
}
