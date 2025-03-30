export interface Message {
  user: string;
  ai: string;
  responseId?: string;
  audioData?: string;
  wasVoiceInput?: boolean;
} 