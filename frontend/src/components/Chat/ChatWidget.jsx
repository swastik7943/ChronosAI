import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Loader2 } from 'lucide-react';

export default function ChatWidget({ token, onMeetingsChange }) {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I'm Chronos, your AI scheduling assistant. How can I help you today?", isBot: true }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), text: userMessage, isBot: false }]);
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(
        `${API_URL}/api/dialogue/process`,
        { message: userMessage, sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { reply, sessionId: newSessionId, meeting } = response.data;
      
      setSessionId(newSessionId);
      setMessages(prev => [...prev, { id: Date.now(), text: reply, isBot: true }]);

      if (meeting) {
        onMeetingsChange();
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), text: 'Sorry, I encountered an error. Please try again.', isBot: true, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm bg-opacity-90 transition-colors duration-200">
      <div className="bg-gray-50/80 dark:bg-gray-800/80 p-5 border-b border-gray-200 dark:border-gray-800 flex flex-col justify-center transition-colors duration-200">
        <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          AI Assistant
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Schedule, reschedule, or cancel your meetings.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-md transition-colors duration-200 ${
              msg.isBot 
                ? msg.isError ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700/50'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 shadow-lg border border-blue-500/30'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4 shadow-md w-fit transition-colors duration-200">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce"></div>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 italic">Chronos is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 mb-2 mx-2 rounded-xl transition-colors duration-200">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans text-sm shadow-inner placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
