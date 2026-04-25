import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, CalendarPlus, CalendarX, Eye, Clock, Calendar, Users, Video, MapPin } from 'lucide-react';

export default function ChatWidget({ token, onMeetingsChange }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hey there! 👋 I'm **Chronos**, your AI scheduling assistant. I can help you schedule, reschedule, or cancel meetings — just tell me what you need!",
      isBot: true,
      suggestedActions: ['Schedule Meeting', 'View Calendar', 'When am I free?']
    }
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

  const sendMessage = async (userMessage) => {
    if (!userMessage.trim()) return;

    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), text: userMessage, isBot: false }]);
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(
        `${API_URL}/api/dialogue/process`,
        { message: userMessage, sessionId }
      );

      const { reply, sessionId: newSessionId, meeting, suggestedActions, meetingCard } = response.data;
      
      setSessionId(newSessionId);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: reply,
        isBot: true,
        suggestedActions: suggestedActions || [],
        meetingCard: meetingCard || null
      }]);

      if (meeting) {
        onMeetingsChange();
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: '😥 Sorry, I encountered an error. Please try again.',
        isBot: true,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (action) => {
    if (isLoading) return;
    sendMessage(action);
  };

  // Render markdown-like bold text
  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm bg-opacity-90 transition-colors duration-200">
      {/* Header */}
      <div className="bg-gray-50/80 dark:bg-gray-800/80 p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col justify-center transition-colors duration-200">
        <h3 className="font-semibold text-base flex items-center gap-2 text-gray-800 dark:text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          Chronos AI
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Your intelligent scheduling assistant</p>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800/50 overflow-x-auto no-scrollbar">
        <button onClick={() => handleQuickAction('Schedule a meeting')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors whitespace-nowrap border border-indigo-200 dark:border-indigo-500/20">
          <CalendarPlus className="w-3 h-3" /> Schedule
        </button>
        <button onClick={() => handleQuickAction('What meetings do I have today?')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors whitespace-nowrap border border-emerald-200 dark:border-emerald-500/20">
          <Eye className="w-3 h-3" /> My Meetings
        </button>
        <button onClick={() => handleQuickAction('When am I free tomorrow?')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-full hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors whitespace-nowrap border border-amber-200 dark:border-amber-500/20">
          <Clock className="w-3 h-3" /> Free Slots
        </button>
        <button onClick={() => handleQuickAction('Cancel a meeting')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors whitespace-nowrap border border-red-200 dark:border-red-500/20">
          <CalendarX className="w-3 h-3" /> Cancel
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isBot ? 'items-start' : 'items-end'}`}>
            <div className={`max-w-[88%] rounded-2xl p-3.5 shadow-md transition-colors duration-200 ${
              msg.isBot
                ? msg.isError
                  ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700/50'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 shadow-lg border border-blue-500/30'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderText(msg.text)}</p>
              
              {/* Meeting Card Rendering */}
              {msg.isBot && msg.meetingCard && (
                <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-all hover:shadow-md">
                  <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-3 border-b border-gray-100 dark:border-gray-800">
                    <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Meeting Confirmed
                    </h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Title</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{msg.meetingCard.title}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                          <Clock className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Date & Time</p>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {msg.meetingCard.date}<br/>{msg.meetingCard.time}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                          <Users className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Participants</p>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-24">
                            {msg.meetingCard.participants}
                          </p>
                        </div>
                      </div>
                    </div>

                    {msg.meetingCard.room && (
                      <div className="pt-2">
                        <a 
                          href={`/meet/${msg.meetingCard.room}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-indigo-200 dark:shadow-none transition-all"
                        >
                          <Video className="w-3.5 h-3.5" /> Join Meeting
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Suggested Action Buttons */}
            {msg.isBot && msg.suggestedActions?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                {msg.suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
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

      {/* Input */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 mb-2 mx-2 rounded-xl transition-colors duration-200">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans text-sm shadow-inner placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Ask me anything about scheduling..."
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
