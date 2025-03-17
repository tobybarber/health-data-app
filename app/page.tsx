'use client';

import { useAuth } from './lib/AuthContext';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { FaUpload, FaComments, FaWatchmanMonitoring, FaClipboardList, FaHeartbeat } from 'react-icons/fa';
import Navigation from './components/Navigation';

export default function Home() {
  const { currentUser, loading } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ user: string; ai: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages when new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Get the chat button element
      const chatButton = document.querySelector('button[aria-label="Chat with AI"]');
      
      // Only close if the click is outside the chat AND not on the chat button
      if (chatRef.current && 
          !chatRef.current.contains(event.target as Node) && 
          chatButton !== event.target && 
          !chatButton?.contains(event.target as Node)) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen);
  };

  // Function to clear the chat history
  const handleNewChat = () => {
    setMessages([]);
    setUserInput('');
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

    // Call the API endpoint for follow-up questions
    try {
      const response = await fetch('/api/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: question,
          userId: currentUser.uid,
        }),
      });
      const data = await response.json();
      const aiResponse = data.answer || 'No response from AI';

      // Process the AI response to remove XML tags
      const processedResponse = processChatResponse(aiResponse);

      // Update the last message with processed AI response
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = processedResponse;
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
      <div className="pt-20">
        {/* Navigation Header */}
        <Navigation isHomePage={true} />

        {/* Main Content */}
        {!currentUser ? (
          <div className="flex flex-col items-center justify-center h-screen px-4">
            <div className="bg-black/80 p-6 rounded-lg shadow-lg text-center max-w-sm w-full backdrop-blur-sm border border-gray-800">
              <h1 className="text-3xl font-bold text-white mb-6">Welcome to Fox Health Vault</h1>
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
          <div className="p-2 pb-safe">
            {/* Remove the bottom navigation from here since it's now in the ClientWrapper */}
            
            {/* AI Chat Section - Adjusted to account for bottom navigation */}
            <div className="mt-6 bg-black/80 backdrop-blur-sm p-3 rounded-lg shadow-md w-full">
              <div className="bg-black rounded-lg p-3">
                <div className="flex justify-end items-center mb-2">
                  <button
                    onClick={handleNewChat}
                    className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 py-1 px-2 rounded transition-colors"
                    aria-label="Start a new chat"
                  >
                    New Chat
                  </button>
                </div>
                <div className="h-80 overflow-y-auto mb-3 bg-gray-800 rounded-lg p-2">
                  {messages.length === 0 ? (
                    <div className="text-gray-200 text-center py-4">
                      Ask questions about your health records.
                    </div>
                  ) : (
                    messages.map((msg, index) => (
                      <div key={index} className="mb-3">
                        <div className="font-semibold text-white">You:</div>
                        <div className="bg-gray-600 p-2 rounded-lg mb-2 text-gray-200">{msg.user}</div>
                        {msg.ai ? (
                          <>
                            <div className="font-semibold text-white">AI:</div>
                            <div style={{backgroundColor: '#4338ca', borderColor: '#6366f1', borderWidth: '2px'}} className="p-2 rounded-lg whitespace-pre-line text-white">{msg.ai}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-white">AI:</div>
                            <div style={{backgroundColor: '#4338ca', borderColor: '#6366f1', borderWidth: '2px'}} className="flex items-center text-white p-2 rounded-lg">
                              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z"></path>
                              </svg>
                              Thinking...
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} /> {/* Scroll anchor */}
                </div>
                
                <form onSubmit={handleSendMessage} className="flex w-full">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="border border-gray-600 rounded-l-xl p-2 flex-grow bg-gray-700 text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    placeholder="Type your question here..."
                    disabled={isAiResponding}
                  />
                  <button 
                    type="submit" 
                    className={`bg-gray-500 text-white rounded-r-xl p-2 px-4 ${isAiResponding ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}`}
                    disabled={isAiResponding}
                  >
                    Send
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