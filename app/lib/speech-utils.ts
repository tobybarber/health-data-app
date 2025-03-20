'use client';

// Check if the browser supports speech synthesis
const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Get available voices
export const getVoices = (): SpeechSynthesisVoice[] => {
  if (!isSpeechSynthesisSupported) return [];
  return window.speechSynthesis.getVoices();
};

// Find the best voice for the given language
export const findBestVoice = (language: string = 'en-US'): SpeechSynthesisVoice | null => {
  if (!isSpeechSynthesisSupported) return null;
  
  const voices = getVoices();
  
  // Try to find a good matching voice (first Google, then any with matching language)
  return (
    voices.find(voice => voice.lang === language && voice.name.includes('Google')) ||
    voices.find(voice => voice.lang === language) ||
    voices.find(voice => voice.lang.startsWith(language.split('-')[0])) ||
    voices[0]
  );
};

// Speak the given text
export const speak = (text: string, options: { 
  language?: string; 
  rate?: number; 
  pitch?: number; 
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
} = {}): void => {
  if (!isSpeechSynthesisSupported) return;
  
  // Stop any current speech
  window.speechSynthesis.cancel();
  
  // Create a new utterance
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set options
  utterance.lang = options.language || 'en-US';
  utterance.rate = options.rate || 1;
  utterance.pitch = options.pitch || 1;
  utterance.volume = options.volume || 1;
  
  // Find the best voice
  const voice = findBestVoice(utterance.lang);
  if (voice) {
    utterance.voice = voice;
  }
  
  // Set event handlers
  if (options.onStart) {
    utterance.onstart = options.onStart;
  }
  
  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }
  
  // Speak the text
  window.speechSynthesis.speak(utterance);
};

// Stop any current speech
export const stopSpeaking = (): void => {
  if (!isSpeechSynthesisSupported) return;
  window.speechSynthesis.cancel();
}; 