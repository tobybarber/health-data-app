'use client';

// Check if the browser supports speech synthesis
const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Detect if the device is running iOS (iPhone, iPad, iPod)
 */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Get available voices
export const getVoices = (): SpeechSynthesisVoice[] => {
  if (!isSpeechSynthesisSupported) return [];
  return window.speechSynthesis.getVoices();
};

// Find the best voice for the given language
export const findBestVoice = (language: string = 'en-US'): SpeechSynthesisVoice | null => {
  if (!isSpeechSynthesisSupported) return null;
  
  const voices = getVoices();
  const isOnIOS = isIOS();
  
  // First, look for enhanced or premium voices on iOS
  if (isOnIOS) {
    // On iOS, look for voices with "Enhanced" in the name
    const enhancedVoice = voices.find(voice => 
      voice.lang === language && 
      (voice.name.includes('Enhanced') || voice.name.includes('Premium'))
    );
    if (enhancedVoice) return enhancedVoice;
  }
  
  // Then try to find the best quality voice with matching language
  // Prioritize voices with these quality indicators in name
  const qualityVoice = voices.find(voice => 
    voice.lang === language && 
    (voice.name.includes('Neural') || 
     voice.name.includes('Premium') || 
     voice.name.includes('Enhanced'))
  );
  if (qualityVoice) return qualityVoice;
  
  // Try to find a good matching voice from major providers
  return (
    // First try Google voices (usually good quality)
    voices.find(voice => voice.lang === language && voice.name.includes('Google')) ||
    // Then try Apple voices
    voices.find(voice => voice.lang === language && voice.name.includes('Apple')) ||
    // Then try Microsoft voices
    voices.find(voice => voice.lang === language && voice.name.includes('Microsoft')) ||
    // Then any with matching language
    voices.find(voice => voice.lang === language) ||
    // Then any with matching language prefix (e.g., 'en' for 'en-US')
    voices.find(voice => voice.lang.startsWith(language.split('-')[0])) ||
    // Last resort: first available voice
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
  
  // Check if we're on iOS
  const deviceIsIOS = isIOS();
  
  // Set language
  utterance.lang = options.language || 'en-US';
  
  // Optimize parameters based on device
  if (deviceIsIOS) {
    // iOS-specific optimizations (values tested to sound natural on iPhone)
    utterance.rate = options.rate !== undefined ? options.rate : 0.9;  // Slightly slower for clarity
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1.1; // Slightly higher pitch sounds better on iOS
    utterance.volume = options.volume !== undefined ? options.volume : 1.0; // Full volume
  } else {
    // Default parameters for other devices
    utterance.rate = options.rate !== undefined ? options.rate : 1.0;
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
    utterance.volume = options.volume !== undefined ? options.volume : 1.0;
  }
  
  // Find the best voice
  const voice = findBestVoice(utterance.lang);
  if (voice) {
    utterance.voice = voice;
    console.log(`Using voice: ${voice.name}, quality parameters: rate=${utterance.rate}, pitch=${utterance.pitch}`);
  }
  
  // Set event handlers
  if (options.onStart) {
    utterance.onstart = options.onStart;
  }
  
  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }
  
  // Log any errors that occur during speech synthesis
  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event);
  };
  
  // Speak the text
  window.speechSynthesis.speak(utterance);
};

// Stop any current speech
export const stopSpeaking = (): void => {
  if (!isSpeechSynthesisSupported) return;
  window.speechSynthesis.cancel();
}; 