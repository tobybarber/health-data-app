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
            <div className="flex-grow overflow-y-auto hide-scrollbar mb-2 pt-4">
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
                        <div className="text-white max-w-[80%] whitespace-pre-line pl-3">{msg.ai}</div>
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
            </div>
            
            {/* Question input moved lower */}
            <div className="mt-auto pb-1">
              <form onSubmit={handleSendMessage} className="flex w-full">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="border border-gray-600 rounded-l-xl p-3 flex-grow bg-gray-800/80 backdrop-blur-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  placeholder="Ask about your health records."
                  disabled={isAiResponding}
                />
                <button 
                  type="submit" 
                  className={`bg-gray-600 text-white rounded-r-xl p-3 ${isAiResponding ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-500'}`}
                  disabled={isAiResponding}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
                <button
                  onClick={handleNewChat}
                  className="ml-2 bg-gray-800 hover:bg-gray-700 text-gray-300 p-3 rounded-xl transition-colors"
                  aria-label="Start a new chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </form>
              <p className="text-xs text-gray-500 mt-1 pl-1">AI can get things wrong, use at own risk!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 