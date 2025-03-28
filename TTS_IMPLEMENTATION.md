# OpenAI Text-to-Speech Implementation

This document outlines the implementation of OpenAI's Text-to-Speech (TTS) API in the Health Data App.

## Overview

The implementation adds voice capabilities to the chat interface, allowing AI responses to be spoken aloud. This provides a more natural and accessible interaction mode for users.

## Features

- **Text-to-Speech Conversion**: Converts AI responses to audio using OpenAI's TTS API
- **Cost Optimization**: Implements TTS only when needed, with cost tracking
- **Streaming Support**: Enables audio to start playing before the entire response is generated

## Components

1. **TTS Utility Module** (`app/utils/ttsUtils.ts`)
   - `generateSpeech()`: Converts text to speech using OpenAI's TTS API
   - `generateStreamingSpeech()`: Streaming version of the TTS function
   - `calculateTTSCost()`: Estimates the cost of TTS conversion

2. **Updated API Endpoint** (`app/api/question/route.ts`)
   - Added TTS generation to the question-answering endpoint
   - Includes cost estimation and tracking

3. **SpeakText Component** (`app/components/SpeakText.tsx`)
   - Renders text with audio playback capabilities
   - Handles audio controls and playback state

## Voice Configuration

The application uses OpenAI's 'alloy' voice, which is a neutral and versatile voice that works well for health-related content. This voice provides a clear and professional tone that enhances the user experience.

## Cost Analysis

The TTS API has the following pricing:
- $0.015 per 1,000 characters

For a 10-minute conversation:
- An average of 5 minutes of AI responses (about 750 words or 3,750 characters)
- Approximate cost: $0.056

This is significantly more cost-effective than the Realtime API, which would cost approximately $1.50 for the same conversation.

## Usage Instructions

1. **Audio Playback**: Audio will automatically play when an AI response is received
2. **Manual Control**: If autoplay fails (common on mobile), audio controls will appear
3. **Toggle Playback**: Click the speaker icon to pause/resume audio

## Potential Future Improvements

1. **Audio Speed Control**: Add options to adjust playback speed
2. **Advanced Streaming**: Implement better chunking for longer responses
3. **Voice Options**: Add the ability to select from different voice options

## Troubleshooting

- **Audio Not Playing**: Some mobile browsers restrict autoplay. Click the audio controls to manually play.
- **High Latency**: For long responses, consider disabling TTS temporarily. 