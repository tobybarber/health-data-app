'use client';

import { useAuth } from './lib/AuthContext';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { FaUpload, FaComments, FaWatchmanMonitoring, FaClipboardList, FaHeartbeat, FaPaperPlane, FaPlus } from 'react-icons/fa';
import Navigation from './components/Navigation';
import { useBackgroundLogo } from './layout';
import MicrophoneButton from './components/MicrophoneButton';
import SpeakText from './components/SpeakText';

// Updated Message interface with responseId
interface Message {
  user: string;
  ai: string;
  responseId?: string; // Added to track OpenAI response IDs
}

export default function Home() {
  const { currentUser, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { showBackgroundLogo, setShowBackgroundLogo } = useBackgroundLogo();

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

  // Function to manually scroll to the bottom when button is clicked
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

  // Listen for scroll events to determine if scroll button should be shown
  useEffect(() => {
    const handleScroll = () => {
      if (!messagesEndRef.current) return;
      
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        // Show button if not scrolled to bottom (with small threshold)
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 20);
      }
    };

    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', handleScroll);
      return () => messagesContainer.removeEventListener('scroll', handleScroll);
    }
  }, [messages]);

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

  // Update the handleSendMessage function to use the previous response ID
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !currentUser || isAiResponding) return;

    // Add user message to chat
    setMessages((prev) => [...prev, { user: userInput, ai: '' }]);
    
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
          previousResponseId: previousResponseId
        }),
      });
      const data = await response.json();
      const aiResponse = data.answer || 'No response from AI';
      const responseId = data.responseId;

      // Process the AI response to remove XML tags
      const processedResponse = processChatResponse(aiResponse);

      // Update the last message with processed AI response and the new response ID
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          ai: processedResponse,
          responseId: responseId
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
            
            {/* Messages displayed directly on background */}
            <div className="flex-grow overflow-y-auto hide-scrollbar mb-0 pt-4 pb-28 messages-container relative">
              {messages.length === 0 ? (
                <div className="text-gray-200 text-center py-4">
                  
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="mb-5">
                    {/* User message - right aligned, darker gray */}
                    <div className="flex justify-end mb-3">
                      <div className="bg-gray-700 p-3 rounded-2xl text-gray-100 max-w-[80%]">{msg.user}</div>
                    </div>
                    
                    {/* AI message - left aligned, no background/border */}
                    {msg.ai ? (
                      <div className="flex justify-start">
                        <div className="relative text-white max-w-[80%] whitespace-pre-line pl-3">
                          {msg.ai}
                          <div className="absolute -top-1 -right-12">
                            <SpeakText text={msg.ai} />
                          </div>
                        </div>
                      </div>
                    ) : (
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
              
              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="fixed bottom-44 right-4 bg-gray-700 text-white rounded-full p-2 shadow-lg hover:bg-gray-600 transition-colors"
                  aria-label="Scroll to bottom"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Fixed input box at bottom */}
            <div className="fixed bottom-0 left-0 right-0 p-2 pb-safe bg-black/90 backdrop-blur-sm border-t border-gray-800" style={{ marginBottom: 0 }}>
              <div className="relative">
                {/* New Chat button - now positioned above input on right */}
                <button 
                  onClick={handleNewChat} 
                  className="absolute -top-12 right-2 flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors z-30 bg-black"
                  aria-label="New chat"
                >
                  <FaPlus className="w-4 h-4" />
                </button>
                
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <div className="relative flex-grow">
                    <textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (userInput.trim() && !isAiResponding) {
                            handleSendMessage(e);
                          }
                        }
                      }}
                      placeholder="Ask about your health records..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-none"
                      rows={1}
                      style={{ minHeight: '44px', maxHeight: '120px' }}
                      disabled={isAiResponding}
                    />
                  </div>
                  
                  {/* Import and use the MicrophoneButton component */}
                  <div className="flex-shrink-0 flex items-center">
                    <MicrophoneButton
                      onTranscription={(text) => {
                        setUserInput(text);
                        // Auto-submit if there's a transcription
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
                        }, 500);
                      }}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isAiResponding}
                    className={`flex items-center justify-center rounded-full p-2 flex-shrink-0 
                      ${!userInput.trim() || isAiResponding
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-primary-blue text-white hover:bg-blue-600'}
                      transition-colors
                    `}
                    aria-label="Send message"
                  >
                    <FaPaperPlane className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 