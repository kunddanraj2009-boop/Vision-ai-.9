import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Trash2,
  Download,
  Sparkles,
  Bot,
  Globe,
} from 'lucide-react';
import { ChatMessage, LanguageCode } from '../types/nancy';
import { speechService } from '../services/speechService';
import { playAudioFx } from '../services/audioSynth';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearChat: () => void;
  language: LanguageCode;
  isListening: boolean;
  onToggleMic: () => void;
  interimTranscript: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  language,
  isListening,
  onToggleMic,
  interimTranscript,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Sync interim transcript if microphone is on in chat view
  useEffect(() => {
    if (interimTranscript) {
      setInputText(interimTranscript);
    }
  }, [interimTranscript]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputText.trim();
    if (!query || isSending) return;

    setInputText('');
    setIsSending(true);
    playAudioFx.click();

    try {
      await onSendMessage(query);
    } finally {
      setIsSending(false);
    }
  };

  const handleSpeakMessage = (text: string) => {
    playAudioFx.acknowledge();
    speechService.speak(text);
  };

  const handleExportChat = () => {
    playAudioFx.click();
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `use_vision_ai_chat_history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-125px)] max-w-xl mx-auto w-full px-3 pb-2 select-none">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800 px-1 shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <Bot className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-cyber font-bold text-xs text-slate-200 truncate">
            USE VISION AI CHAT
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={handleExportChat}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs"
            title="Export Chat History"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClearChat}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 text-xs"
            title="Clear Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3 font-sans text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Sparkles className="w-8 h-8 text-cyan-400/50" />
            <p className="font-tech text-slate-300 text-sm">USE VISION AI Neural Link Ready</p>
            <p className="text-[11px] max-w-xs">
              Ask anything in English or Hindi, or issue voice & hardware commands.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 space-y-1 shadow-md ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-900/90 border border-cyan-500/25 text-slate-100 rounded-bl-sm'
                }`}
              >
                <div className="flex items-center justify-between space-x-3 text-[10px] opacity-75 font-mono-cyber">
                  <span>{m.role === 'user' ? 'YOU' : 'USE VISION AI'}</span>
                  <span>{m.timestamp}</span>
                </div>

                <p className="leading-relaxed whitespace-pre-wrap text-xs font-sans">
                  {m.content}
                </p>

                {m.role === 'assistant' && (
                  <>
                    {m.groundingSources && m.groundingSources.length > 0 && (
                      <div className="pt-1.5 pb-0.5 border-t border-slate-800/80 space-y-1">
                        <span className="text-[9px] font-mono-cyber text-cyan-400 block font-bold flex items-center space-x-1">
                          <Globe className="w-2.5 h-2.5 text-cyan-300 animate-spin-slow" />
                          <span>LIVE REAL-TIME SOURCES:</span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {m.groundingSources.map((src, i) => (
                            <a
                              key={i}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] font-mono-cyber px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:text-white truncate max-w-[210px] flex items-center space-x-1"
                            >
                              <span className="truncate">{src.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-cyan-400/80">
                      <span className="font-mono-cyber text-[9px] uppercase">
                        {m.source === 'google_search' ? '🌐 GEMINI + LIVE SEARCH' : m.source || 'gemini'}
                      </span>
                      <button
                        onClick={() => handleSpeakMessage(m.content)}
                        className="p-1 rounded hover:bg-slate-800 text-cyan-300 transition-colors"
                        title="Read Message Aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-center space-x-2 text-cyan-400 font-mono-cyber text-xs p-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>USE VISION AI COGNITIVE SYNAPSE ACTIVE...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form onSubmit={handleSubmit} className="pt-2 shrink-0">
        <div className="flex items-center space-x-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-xl shadow-lg">
          {/* Speech Mic Toggle */}
          <button
            type="button"
            onClick={onToggleMic}
            className={`p-2.5 rounded-xl transition-all ${
              isListening
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_#00F0FF] animate-pulse'
                : 'bg-slate-800 text-slate-300 hover:text-cyan-400'
            }`}
            title="Voice Speech Input"
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              language === 'hi'
                ? 'अपना सवाल लिखें या कमांड दें...'
                : 'Message USE VISION AI or enter command...'
            }
            className="flex-1 bg-transparent px-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
