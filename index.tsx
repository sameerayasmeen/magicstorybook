
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// --- Types ---
interface Page {
  text: string;
  illustrationPrompt: string;
  imageUrl?: string;
}

interface Story {
  title: string;
  pages: Page[];
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

enum AppState {
  INTRO = 'INTRO',
  ONBOARDING = 'ONBOARDING',
  IDLE = 'IDLE',
  GENERATING_STORY = 'GENERATING_STORY',
  READING_STORY = 'READING_STORY'
}

// --- Utilities ---
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
};

// --- API Services ---
const getAI = () => new GoogleGenAI({ apiKey: (window as any).process?.env?.API_KEY || "" });

const aiGenerateStory = async (prompt: string): Promise<Story> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a short story for kids about: ${prompt}. 4 pages. JSON format with title and pages array (text, illustrationPrompt).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          pages: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, illustrationPrompt: { type: Type.STRING } }, required: ["text", "illustrationPrompt"] } }
        },
        required: ["title", "pages"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

const aiGenerateImage = async (prompt: string): Promise<string> => {
  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Kid-friendly digital illustration: ${prompt}. Vibrant style, Studio Ghibli inspired.` }] },
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part?.inlineData) throw new Error("No image");
  return `data:image/png;base64,${part.inlineData.data}`;
};

const aiGenerateSpeech = async (text: string): Promise<string> => {
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

// --- Components ---

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([{ role: 'model', content: "Hi! I'm Sparkle! Want to talk? ✨" }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || typing) return;
    const userMsg = { role: 'user' as const, content: input };
    setMsgs(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    
    try {
      const chat = getAI().chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction: "You are Sparkle the Dragon, a friendly storyteller. Use emojis! ✨🐉" },
      });
      const res = await chat.sendMessage({ message: input });
      setMsgs(prev => [...prev, { role: 'model', content: res.text || "Oops!" }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white rounded-3xl w-72 h-96 shadow-2xl flex flex-col border-4 border-yellow-300 overflow-hidden">
          <div className="bg-yellow-400 p-3 text-white font-bold flex justify-between items-center">
            <span>🐉 Sparkle Chat</span>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-amber-50">
            {msgs.map((m, i) => (
              <div key={i} className={`p-2 rounded-xl text-sm ${m.role === 'user' ? 'bg-indigo-500 text-white ml-8' : 'bg-white border mr-8'}`}>
                {m.content}
              </div>
            ))}
            {typing && <div className="text-xs text-indigo-300 animate-pulse">Sparkle is thinking...</div>}
          </div>
          <div className="p-2 border-t flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 text-sm p-2 bg-gray-50 rounded-lg outline-none" placeholder="Say hi!" />
            <button onClick={handleSend} className="bg-yellow-400 text-white p-2 rounded-lg">🚀</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-yellow-400 p-4 rounded-full shadow-xl text-3xl hover:scale-110 transition-transform">🐉</button>
      )}
    </div>
  );
};

const CATEGORIES = [
  { title: "Ghost Stories", topic: "A friendly ghost named Boo", emoji: "👻", color: "bg-indigo-500" },
  { title: "Space Adventure", topic: "A cat in a rocket ship", emoji: "🚀", color: "bg-blue-500" },
  { title: "Magic Forest", topic: "Talking trees and fairy dust", emoji: "🌳", color: "bg-green-500" },
  { title: "Princess Quest", topic: "A brave princess and a tiara", emoji: "👑", color: "bg-pink-500" },
];

const App = () => {
  const [topic, setTopic] = useState('');
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [story, setStory] = useState<Story | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState('');
  const [playing, setPlaying] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);

  const startStory = async (t?: string) => {
    const final = t || topic;
    if (!final) return;
    setLoading('Weaving magic...'); setState(AppState.GENERATING_STORY);
    try {
      const s = await aiGenerateStory(final);
      setStory(s); setPage(0); setState(AppState.READING_STORY);
    } catch (err) {
      console.error(err);
      setState(AppState.IDLE);
    } finally {
      setLoading('');
    }
  };

  const readPage = async () => {
    if (!story || playing) return;
    setPlaying(true);
    try {
      const b64 = await aiGenerateSpeech(story.pages[page].text);
      if (!audioCtx.current) audioCtx.current = new AudioContext({ sampleRate: 24000 });
      const buf = await decodeAudioData(decode(b64), audioCtx.current, 24000, 1);
      const src = audioCtx.current.createBufferSource();
      src.buffer = buf; src.connect(audioCtx.current.destination);
      src.onended = () => setPlaying(false);
      src.start();
    } catch {
      setPlaying(false);
    }
  };

  const paintPage = async () => {
    if (!story) return;
    setLoading('Painting...');
    try {
      const url = await aiGenerateImage(story.pages[page].illustrationPrompt);
      const newPages = [...story.pages]; 
      newPages[page].imageUrl = url;
      setStory({ ...story, pages: newPages });
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-amber-50">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1 className="text-3xl text-indigo-900 font-bold cursor-pointer" onClick={() => setState(AppState.IDLE)}>✨ Magic Storybook</h1>
      </header>

      <main className="w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl p-6 md:p-12 min-h-[500px] flex flex-col items-center justify-center">
        {state === AppState.IDLE && (
          <div className="w-full space-y-8 text-center animate-in fade-in zoom-in">
            <h2 className="text-5xl text-indigo-950 font-bold">Let's make magic!</h2>
            <div className="max-w-xl mx-auto flex flex-col gap-4">
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && startStory()} placeholder="A dragon who loves pizza..." className="w-full p-5 rounded-2xl border-4 border-indigo-50 outline-none text-xl shadow-inner" />
              <button onClick={() => startStory()} className="bg-indigo-500 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold text-2xl shadow-lg transition-transform active:scale-95">Go! 🚀</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
              {CATEGORIES.map(c => (
                <button key={c.title} onClick={() => startStory(c.topic)} className={`${c.color} p-6 rounded-3xl text-white font-bold hover:scale-105 transition-transform shadow-lg`}>
                  <div className="text-4xl mb-2">{c.emoji}</div>
                  <div className="text-sm">{c.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {state === AppState.GENERATING_STORY && (
          <div className="text-center space-y-6">
            <div className="text-8xl animate-bounce">🎨</div>
            <h3 className="text-2xl font-bold text-indigo-900">{loading}</h3>
          </div>
        )}

        {state === AppState.READING_STORY && story && (
          <div className="w-full space-y-6 animate-in slide-in-from-right">
            <h2 className="text-3xl text-center text-indigo-950 font-bold">{story.title}</h2>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/2 aspect-square bg-indigo-50 rounded-[2rem] overflow-hidden flex items-center justify-center relative shadow-inner">
                {story.pages[page].imageUrl ? (
                  <img src={story.pages[page].imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <button onClick={paintPage} className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-colors">
                      {loading === 'Painting...' ? 'Painting...' : '✨ Paint this Page'}
                    </button>
                  </div>
                )}
              </div>
              <div className="w-full md:w-1/2 space-y-6 flex flex-col justify-between">
                <p className="text-2xl text-gray-800 leading-relaxed font-semibold italic">"{story.pages[page].text}"</p>
                <button onClick={readPage} disabled={playing} className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-indigo-900 rounded-2xl font-bold text-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                  {playing ? '🗣️ Reading...' : '🔊 Read Aloud'}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center border-t pt-4">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-4xl disabled:opacity-20 hover:scale-125 transition-transform">⬅️</button>
              <span className="font-bold text-indigo-300">Page {page + 1} / 4</span>
              <button disabled={page === 3} onClick={() => setPage(p => p + 1)} className="text-4xl disabled:opacity-20 hover:scale-125 transition-transform">➡️</button>
            </div>
          </div>
        )}
      </main>
      <ChatBot />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
