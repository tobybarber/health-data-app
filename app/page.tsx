'use client';

import { useAuth } from './lib/AuthContext';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { FaUpload, FaComments, FaWatchmanMonitoring, FaClipboardList, FaHeartbeat, FaPaperPlane, FaPlus } from 'react-icons/fa';
import Navigation from './components/Navigation';
import { useBackgroundLogo } from './layout';
import MicrophoneButton from './components/MicrophoneButton';
import SpeakText from './components/SpeakText';

// Updated Message interface with responseId and audioData
interface Message {
  user: string;
  ai: string;
  responseId?: string; // Added to track OpenAI response IDs
  audioData?: string; // Added for TTS audio data
  wasVoiceInput?: boolean; // Track if this message was input via voice
}

export default function Home() {
  const { currentUser, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showBackgroundLogo, setShowBackgroundLogo } = useBackgroundLogo();
  const [lastInputWasVoice, setLastInputWasVoice] = useState(false);

  // Generate a new session ID on app load
  useEffect(() => {
    // Only execute this on the client side
    if (typeof window !== 'undefined') {
      // Check if this is a fresh app load
      if (!sessionStorage.getItem('app_session_id')) {
        // Generate a new session ID
        const sessionId = `session_${Date.now()}`;
        sessionStorage.setItem('app_session_id', sessionId);
        
        // Clear any existing messages in memory (not in storage)
        setMessages([]);
        console.log('New app session started:', sessionId);

        // Automatically start a new chat session
        if (currentUser) {
          localStorage.removeItem(`chat_messages_${currentUser.uid}`);
          sessionStorage.setItem('messages_loaded', 'true');
          
          // Set welcome message that doesn't require API call
          setMessages([{
            user: "",
            ai: "Welcome back! Ask me anything about your health records or how I can help you today."
          }]);
        }
      }
    }
  }, [currentUser]);

  // Load messages from localStorage when component mounts
  useEffect(() => {
    if (currentUser) {
      // Only load saved messages if we're in the same session (navigating between pages)
      // and messages have been previously loaded in this session
      if (sessionStorage.getItem('app_session_id') && sessionStorage.getItem('messages_loaded') === 'true') {
        const savedMessages = localStorage.getItem(`chat_messages_${currentUser.uid}`);
        if (savedMessages) {
          try {
            const parsedMessages = JSON.parse(savedMessages);
            if (parsedMessages.length > 0) {
              setMessages(parsedMessages);
            }
          } catch (e) {
            console.error('Error parsing saved messages:', e);
          }
        }
      } else if (sessionStorage.getItem('app_session_id')) {
        // Mark that we've handled the messages loading decision for this session
        sessionStorage.setItem('messages_loaded', 'true');
      }
    }
  }, [currentUser]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (currentUser && messages.length > 0) {
      localStorage.setItem(`chat_messages_${currentUser.uid}`, JSON.stringify(messages));
    }
  }, [messages, currentUser]);

  // Function to manually scroll to the bottom - keep this for programmatic scrolling
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Hide background logo when messages are present
  useEffect(() => {
    if (messages.length > 0) {
      setShowBackgroundLogo(false);
    } else {
      setShowBackgroundLogo(true);
    }
  }, [messages, setShowBackgroundLogo]);

  // Scroll to bottom of messages when a new user message is added (but not for AI responses)
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].ai === '') {
      scrollToBottom();
    }
  }, [messages]);

  // Function to clear the chat history
  const handleNewChat = () => {
    setMessages([]);
    setUserInput('');
    // Update localStorage
    if (currentUser) {
      localStorage.removeItem(`chat_messages_${currentUser.uid}`);
    }
    // Reset the session flag so it behaves like a fresh app load for chat purposes
    sessionStorage.removeItem('messages_loaded');
    console.log('Chat history cleared');
  };

  // Function to process AI chat responses and remove XML tags
  const processChatResponse = (response: string) => {
    if (!response) return '';
    
    // Extract content from XML-like tags
    const extractTagContent = (text: string, tagName: string) => {
      const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    // Check if the text contains XML-like tags
    const hasXmlTags = /<[A-Z_]+>[\s\S]*?<\/[A-Z_]+>/i.test(response);
    
    if (hasXmlTags) {
      // Extract content from each section
      const answer = extractTagContent(response, 'ANSWER') || '';
      const relevantRecords = extractTagContent(response, 'RELEVANT_RECORDS');
      const additionalContext = extractTagContent(response, 'ADDITIONAL_CONTEXT');
      
      // Combine sections with proper formatting
      let formattedResponse = answer;
      
      if (relevantRecords) {
        formattedResponse += '\n\nRelevant Records:\n' + relevantRecords;
      }
      
      if (additionalContext) {
        formattedResponse += '\n\nAdditional Context:\n' + additionalContext;
      }
      
      return formattedResponse;
    }
    
    // If no XML tags, return the original response
    return response;
  };

  // Update the handleSendMessage function to support audio generation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !currentUser || isAiResponding) return;

    // Track if this was a voice input for the response
    const wasVoiceInput = lastInputWasVoice;
    // Reset the flag for next message
    setLastInputWasVoice(false);

    // Add user message to chat with voice input flag
    setMessages((prev) => [...prev, { 
      user: userInput, 
      ai: '',
      wasVoiceInput: wasVoiceInput 
    }]);
    
    // Clear input field immediately
    const question = userInput;
    setUserInput('');
    
    // Set loading state
    setIsAiResponding(true);

    // Find the most recent message with a responseId (if any)
    let previousResponseId = undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].responseId) {
        previousResponseId = messages[i].responseId;
        break;
      }
    }

    // Add debug logs
    console.log('Sending question to API with user ID:', currentUser.uid);
    console.log('Current user object:', JSON.stringify({
      uid: currentUser.uid,
      email: currentUser.email,
      isAnonymous: currentUser.isAnonymous
    }));

    // Call the API endpoint with the previous response ID if available
    try {
      const response = await fetch('/api/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: question,
          userId: currentUser.uid,
          previousResponseId: previousResponseId,
          generateAudio: true, // Request audio generation
          voicePreference: 'alloy' // Use fixed 'alloy' voice
        }),
      });
      const data = await response.json();
      const aiResponse = data.answer || 'No response from AI';
      const responseId = data.responseId;
      const audioData = data.audioData;

      // Process the AI response to remove XML tags
      const processedResponse = processChatResponse(aiResponse);

      // Update the last message with processed AI response, the new response ID, and audio data
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          ai: processedResponse,
          responseId: responseId,
          audioData: audioData
        };
        return newMessages;
      });
    } catch (error) {
      console.error('Error communicating with AI:', error);
      // Update with error message
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = 'Sorry, there was an error processing your question. Please try again.';
        return newMessages;
      });
    } finally {
      setIsAiResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Content */}
      <div className="pt-safe">
        {/* Navigation Header */}
        <Navigation isHomePage={true} />

        {/* Main Content */}
        {!currentUser ? (
          <div className="flex flex-col items-center justify-center h-screen px-4">
            <div className="bg-black/80 p-6 rounded-lg shadow-lg text-center max-w-sm w-full backdrop-blur-sm border border-gray-800">
              <h1 className="text-3xl font-bold text-white mb-6">Welcome to Wattle</h1>
              <p className="mb-8 text-gray-300">Your personal health assistant powered by AI</p>
              <div className="space-y-4">
                <Link 
                  href="/signup" 
                  className="block w-full bg-primary-blue text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Sign Up
                </Link>
                <Link 
                  href="/login" 
                  className="block w-full bg-black text-primary-blue py-2 px-4 rounded-md border border-primary-blue hover:bg-gray-900 transition-colors"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 pb-safe flex flex-col h-[calc(100vh-120px)]">
            
            {/* Messages */}
            <div className="flex-grow overflow-y-auto hide-scrollbar mb-0 pt-4 pb-28 messages-container relative">
              {messages.length === 0 ? (
                <div className="text-gray-200 text-center py-4">
                  {/* Empty state content */}
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className="message-group mb-5">
                    {message.user && (
                      <div className="flex justify-end mb-3">
                        <div className="bg-gray-700 p-3 rounded-2xl text-gray-100 max-w-[80%]">
                          {message.user}
                        </div>
                      </div>
                    )}
                    {message.ai && (
                      <div className="flex justify-start">
                        <div className="relative text-white max-w-[80%] whitespace-pre-line pl-3">
                          {message.audioData ? (
                            <SpeakText 
                              text={message.ai} 
                              audioData={message.audioData} 
                              voiceInput={message.wasVoiceInput || false}
                            />
                          ) : (
                            <div className="whitespace-pre-wrap">{message.ai}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {(index === messages.length - 1 && !message.ai && isAiResponding) && (
                      <div className="flex justify-start">
                        <div className="flex items-center text-white pl-3">
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z"></path>
                          </svg>
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} /> {/* Scroll anchor */}
            </div>
            
            {/* Fixed input box at bottom */}
            <div className="chat-input-container fixed bottom-0 left-0 right-0 bg-black-75 backdrop-blur-md border-t border-gray-800 p-4 pb-safe">
              <form onSubmit={handleSendMessage} className="flex flex-col">
                <div className="relative">
                  {/* New Chat button - positioned above input on right */}
                  <button
                    onClick={handleNewChat}
                    className="absolute -top-12 right-2 flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors z-30"
                    aria-label="New chat"
                  >
                    <FaPlus className="w-4 h-4" />
                  </button>
                
                  <div className="flex items-center space-x-2">
                    {/* Existing input field */}
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Ask me anything..."
                      className="flex-grow bg-gray-800 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isAiResponding}
                    />
                    
                    {/* Microphone button */}
                    <MicrophoneButton 
                      onTranscription={(text: string) => {
                        setUserInput(text);
                        setLastInputWasVoice(true); // Mark that voice input was used
                        // Auto-submit if we got text from microphone
                        if (text && !isAiResponding) {
                          setUserInput(text);
                          setTimeout(() => {
                            const form = document.querySelector('form');
                            if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
                          }, 200);
                        }
                      }}
                    />
                    
                    {/* Send button */}
                    <button
                      type="submit"
                      className={`bg-blue-600 text-white rounded-full p-2 ${
                        !userInput.trim() || isAiResponding ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                      }`}
                      disabled={!userInput.trim() || isAiResponding}
                      aria-label="Send message"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 