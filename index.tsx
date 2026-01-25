
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
  id: string;
  title: string;
  pages: Page[];
  timestamp: number;
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

enum AppState {
  INTRO = 'INTRO',
  ONBOARDING = 'ONBOARDING',
  IDLE = 'IDLE',
  LIBRARY = 'LIBRARY',
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

const getAI = () => new GoogleGenAI({ apiKey: (window as any).process?.env?.API_KEY || "" });

// --- API Services ---
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
  const data = JSON.parse(response.text || "{}");
  return { ...data, id: Date.now().toString(), timestamp: Date.now() };
};

const aiGenerateImage = async (prompt: string): Promise<string> => {
  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A vibrant, kid-friendly digital illustration: ${prompt}. High quality, Studio Ghibli inspired.` }] },
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

// --- Sub-Components ---

const Onboarding = ({ onFinish }: { onFinish: () => void }) => {
  const [step, setStep] = useState(0);
  const slides = [
    { title: "Dream Big! ✨", desc: "Type anything you can imagine—from pizza dragons to space cats!", icon: "🧠", color: "bg-indigo-500" },
    { title: "Watch the Magic! 🎨", desc: "Sparkle the Dragon uses magic paint to illustrate every page of your story.", icon: "🖌️", color: "bg-yellow-400" },
    { title: "Hear the Tale! 🔊", desc: "Sit back and listen as Sparkle reads your unique story aloud!", icon: "🐉", color: "bg-pink-500" }
  ];

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in text-center p-6">
      <div className={`${slides[step].color} w-48 h-48 rounded-[3rem] shadow-2xl flex items-center justify-center text-8xl transform hover:rotate-6 transition-transform`}>
        {slides[step].icon}
      </div>
      <div className="space-y-4">
        <h2 className="text-4xl font-kids text-indigo-900">{slides[step].title}</h2>
        <p className="text-xl text-gray-600 max-w-sm font-bold">{slides[step].desc}</p>
      </div>
      <div className="flex gap-2">
        {slides.map((_, i) => <div key={i} className={`h-3 rounded-full transition-all ${i === step ? 'w-10 bg-indigo-500' : 'w-3 bg-indigo-100'}`} />)}
      </div>
      <button 
        onClick={() => step < 2 ? setStep(step + 1) : onFinish()} 
        className="bg-indigo-500 text-white font-kids text-2xl py-5 px-12 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-transform"
      >
        {step === 2 ? "Let's Go! 🚀" : "Next ✨"}
      </button>
    </div>
  );
};

const Library = ({ stories, onSelect, onBack }: { stories: Story[], onSelect: (s: Story) => void, onBack: () => void }) => (
  <div className="w-full space-y-8 animate-in slide-in-from-bottom-10">
    <div className="flex justify-between items-center">
      <h2 className="text-4xl font-kids text-indigo-950">My Magic Books</h2>
      <button onClick={onBack} className="text-indigo-500 font-bold hover:underline">← Back</button>
    </div>
    {stories.length === 0 ? (
      <div className="text-center py-20 bg-indigo-50 rounded-[3rem] border-4 border-dashed border-indigo-200">
        <div className="text-6xl mb-4">📭</div>
        <p className="text-xl text-indigo-300 font-bold">No books yet! Create your first one!</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stories.map(s => (
          <button key={s.id} onClick={() => onSelect(s)} className="bg-white p-6 rounded-[2.5rem] shadow-lg border-b-8 border-indigo-100 hover:scale-[1.02] transition-transform flex items-center gap-6 text-left group">
            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center text-4xl group-hover:rotate-6 transition-transform">📖</div>
            <div>
              <h3 className="text-xl font-kids text-indigo-900">{s.title}</h3>
              <p className="text-sm text-gray-400 font-bold">{new Date(s.timestamp).toLocaleDateString()}</p>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([{ role: 'model', content: "Hi! I'm Sparkle! Want to talk about stories? ✨🐉" }]);
  const [input, setInput] = useState('');
  const handleSend = async () => {
    if (!input.trim()) return;
    setMsgs(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    const chat = getAI().chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: "You are Sparkle the Dragon, a friendly storyteller." } });
    const res = await chat.sendMessage({ message: input });
    setMsgs(prev => [...prev, { role: 'model', content: res.text || "Oops!" }]);
  };
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white rounded-[2rem] w-80 h-[400px] shadow-2xl flex flex-col border-4 border-yellow-300 overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-yellow-400 p-4 text-white font-kids flex justify-between"><span>🐉 Sparkle Chat</span><button onClick={() => setIsOpen(false)}>✕</button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-amber-50 text-sm">
            {msgs.map((m, i) => <div key={i} className={`p-3 rounded-2xl ${m.role === 'user' ? 'bg-indigo-500 text-white ml-8' : 'bg-white border mr-8 font-bold'}`}>{m.content}</div>)}
          </div>
          <div className="p-2 border-t flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 p-2 bg-gray-50 rounded-lg outline-none" placeholder="Say hi!" /><button onClick={handleSend} className="bg-yellow-400 text-white p-2 rounded-lg">🚀</button></div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-yellow-400 p-5 rounded-full shadow-xl text-4xl hover:scale-110 transition-transform">🐉</button>
      )}
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [topic, setTopic] = useState('');
  const [state, setState] = useState<AppState>(AppState.INTRO);
  const [story, setStory] = useState<Story | null>(null);
  const [savedStories, setSavedStories] = useState<Story[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState('');
  const [playing, setPlaying] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('magic_stories');
    if (saved) setSavedStories(JSON.parse(saved));
  }, []);

  const saveStoryToLibrary = (s: Story) => {
    const updated = [s, ...savedStories.filter(old => old.id !== s.id)];
    setSavedStories(updated);
    localStorage.setItem('magic_stories', JSON.stringify(updated));
  };

  const startStory = async (t?: string) => {
    const final = t || topic;
    if (!final) return;
    setLoading('Weaving magic...'); setState(AppState.GENERATING_STORY);
    try {
      const s = await aiGenerateStory(final);
      setStory(s); setPage(0); setState(AppState.READING_STORY);
      saveStoryToLibrary(s);
    } catch { setState(AppState.IDLE); }
    finally { setLoading(''); }
  };

  const readAloud = async () => {
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
    } catch { setPlaying(false); }
  };

  const paintImage = async () => {
    if (!story) return;
    setLoading('Painting...');
    try {
      const url = await aiGenerateImage(story.pages[page].illustrationPrompt);
      const updatedPages = [...story.pages]; updatedPages[page].imageUrl = url;
      const updatedStory = { ...story, pages: updatedPages };
      setStory(updatedStory);
      saveStoryToLibrary(updatedStory);
    } finally { setLoading(''); }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-amber-50">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1 className="text-3xl text-indigo-900 font-kids cursor-pointer" onClick={() => setState(AppState.IDLE)}>✨ Magic Storybook</h1>
        {state === AppState.IDLE && (
          <button onClick={() => setState(AppState.LIBRARY)} className="bg-white px-6 py-2 rounded-full font-bold text-indigo-500 shadow-sm hover:shadow-md transition-shadow">📚 My Library</button>
        )}
      </header>

      <main className="w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl p-6 md:p-12 min-h-[550px] flex flex-col items-center justify-center relative overflow-hidden">
        
        {state === AppState.INTRO && (
          <div className="text-center space-y-8 animate-in zoom-in">
            <div className="bg-yellow-400 w-48 h-48 rounded-[4rem] shadow-xl flex items-center justify-center mx-auto text-9xl animate-bounce">📖</div>
            <h2 className="text-5xl md:text-6xl text-indigo-950 font-kids">Magic Storybook AI</h2>
            <p className="text-2xl text-indigo-400 font-bold">Your portal to endless adventures!</p>
            <button onClick={() => setState(AppState.ONBOARDING)} className="bg-indigo-500 text-white font-kids text-3xl px-16 py-6 rounded-[3rem] shadow-xl hover:scale-105 transition-transform active:scale-95 border-b-[12px] border-indigo-800 active:border-b-0">Start the Magic 🚀</button>
          </div>
        )}

        {state === AppState.ONBOARDING && <Onboarding onFinish={() => setState(AppState.IDLE)} />}

        {state === AppState.IDLE && (
          <div className="w-full space-y-12 text-center animate-in fade-in">
            <h2 className="text-6xl text-indigo-950 font-kids">Let's Play!</h2>
            <div className="max-w-xl mx-auto space-y-4">
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && startStory()} placeholder="A pizza that loves surfing..." className="w-full p-6 rounded-2xl border-4 border-indigo-50 outline-none text-2xl shadow-inner font-bold" />
              <button onClick={() => startStory()} className="w-full bg-indigo-500 text-white py-5 rounded-2xl font-kids text-3xl shadow-lg hover:scale-105 transition-transform active:scale-95 border-b-8 border-indigo-800 active:border-b-0">Make Story! ✨</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[ {e: "👻", t: "Friendly Ghost"}, {e: "🚀", t: "Space Cat"}, {e: "🦖", t: "Tiny Dino"}, {e: "🏰", t: "Magic Castle"} ].map(c => (
                <button key={c.t} onClick={() => startStory(c.t)} className="bg-indigo-50 p-6 rounded-3xl text-white font-kids hover:scale-105 transition-transform shadow-lg group">
                  <div className="text-6xl mb-2 grayscale group-hover:grayscale-0 transition-all">{c.e}</div>
                  <div className="text-indigo-200 text-xs font-bold uppercase">{c.t}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {state === AppState.LIBRARY && <Library stories={savedStories} onSelect={s => { setStory(s); setPage(0); setState(AppState.READING_STORY); }} onBack={() => setState(AppState.IDLE)} />}

        {state === AppState.GENERATING_STORY && (
          <div className="text-center space-y-6">
            <div className="text-9xl animate-spin-slow">✨</div>
            <h3 className="text-3xl font-kids text-indigo-900">{loading}</h3>
          </div>
        )}

        {state === AppState.READING_STORY && story && (
          <div className="w-full space-y-8 animate-in slide-in-from-right duration-500">
            <div className="flex justify-between items-center">
              <button onClick={() => setState(AppState.IDLE)} className="text-indigo-400 font-bold">🏠 Home</button>
              <h2 className="text-4xl text-center text-indigo-950 font-kids flex-1 px-4">{story.title}</h2>
              <button onClick={() => setState(AppState.LIBRARY)} className="text-indigo-400 font-bold">📚 Library</button>
            </div>
            <div className="flex flex-col md:flex-row gap-10">
              <div className="w-full md:w-1/2 aspect-square bg-indigo-50 rounded-[3rem] overflow-hidden flex items-center justify-center relative shadow-inner border-4 border-indigo-100">
                {story.pages[page].imageUrl ? (
                  <img src={story.pages[page].imageUrl} className="w-full h-full object-cover animate-in fade-in" />
                ) : (
                  <button onClick={paintImage} className="bg-indigo-500 text-white px-8 py-4 rounded-2xl font-kids text-xl shadow-lg hover:bg-indigo-600 transition-colors">
                    {loading === 'Painting...' ? '🎨 Painting...' : '✨ Paint Magic'}
                  </button>
                )}
              </div>
              <div className="w-full md:w-1/2 space-y-8 flex flex-col justify-between">
                <p className="text-3xl text-gray-800 leading-relaxed font-bold italic">"{story.pages[page].text}"</p>
                <button onClick={readAloud} disabled={playing} className="w-full py-6 bg-yellow-400 text-indigo-900 rounded-[2rem] font-kids text-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 border-b-8 border-yellow-600 active:border-b-0">
                  {playing ? '🗣️ Reading...' : '🔊 Read Aloud'}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center border-t-4 border-indigo-50 pt-6">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-5xl disabled:opacity-20 hover:scale-125 transition-transform">⬅️</button>
              <span className="font-kids text-2xl text-indigo-300">Page {page + 1} of 4</span>
              <button disabled={page === 3} onClick={() => setPage(p => p + 1)} className="text-5xl disabled:opacity-20 hover:scale-125 transition-transform">➡️</button>
            </div>
          </div>
        )}
      </main>
      <ChatBot />
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
