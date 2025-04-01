'use client';

import OpenAI from 'openai';

// Remove the direct OpenAI client initialization
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY, // Ensure this is correct
//   dangerouslyAllowBrowser: true // Allow client-side usage
// });

// Remove the console.log that exposes the API key
// console.log('OpenAI API Key:', process.env.OPENAI_API_KEY); // For debugging only

// Cache for API key validation
let apiKeyValidationCache: {
  isValid: boolean | null;
  timestamp: number;
  promise: Promise<boolean> | null;
} = {
  isValid: null,
  timestamp: 0,
  promise: null,
};

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Export a function to check if the API key is valid
// This function is safe to call from client components
export async function isApiKeyValid(): Promise<boolean> {
  const now = Date.now();
  
  // If we have a cached result that's still valid, return it
  if (apiKeyValidationCache.isValid !== null && 
      now - apiKeyValidationCache.timestamp < CACHE_DURATION) {
    return apiKeyValidationCache.isValid;
  }
  
  // If we already have a validation in progress, return its promise
  if (apiKeyValidationCache.promise) {
    return apiKeyValidationCache.promise;
  }
  
  // Create a new validation promise
  apiKeyValidationCache.promise = (async () => {
    try {
      const response = await fetch('/api/check-api-key');
      const data = await response.json();
      
      // Update cache
      apiKeyValidationCache.isValid = data.valid;
      apiKeyValidationCache.timestamp = now;
      
      return data.valid;
    } catch (error) {
      console.error('Error checking API key:', error);
      
      // Cache the error state
      apiKeyValidationCache.isValid = false;
      apiKeyValidationCache.timestamp = now;
      
      return false;
    } finally {
      // Clear the promise
      apiKeyValidationCache.promise = null;
    }
  })();
  
  return apiKeyValidationCache.promise;
}

// Create a client-side helper function to call the OpenAI API via our server route
export async function callOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, systemPrompt }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

// Export a mock OpenAI client for backward compatibility
// This will throw an error if used directly
export const openai = {
  chat: {
    completions: {
      create: () => {
        throw new Error('Direct OpenAI client usage is not supported in client components. Use the callOpenAI function instead.');
      }
    }
  }
}; 