
import React, { useState, useRef, useEffect } from 'react';
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

// --- AI Services ---
const aiGenerateStory = async (prompt: string): Promise<Story> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a short story for kids about: ${prompt}. Exactly 4 pages. JSON format with title and pages array (text, illustrationPrompt).`,
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
    contents: { parts: [{ text: `A vibrant, high-quality kid-friendly digital illustration: ${prompt}. Studio Ghibli style, soft magical lighting, clean lines.` }] },
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

const MagicBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="absolute top-10 left-10 text-4xl animate-float opacity-20">✨</div>
    <div className="absolute top-1/4 right-20 text-5xl animate-float-slow opacity-15">⭐</div>
    <div className="absolute bottom-20 left-1/4 text-6xl animate-float-delayed opacity-20">🌈</div>
    <div className="absolute bottom-40 right-10 text-4xl animate-float opacity-20">✨</div>
  </div>
);

const Onboarding = ({ onFinish }: { onFinish: () => void }) => {
  const [step, setStep] = useState(0);
  const slides = [
    { title: "Imagine it! 🧠", desc: "Type any idea you have. A dragon who eats tacos? We can do it!", icon: "💭", color: "bg-indigo-500" },
    { title: "Watch it! 🎨", desc: "Sparkle the Dragon uses magic paint to draw every page for you.", icon: "🖌️", color: "bg-yellow-400" },
    { title: "Hear it! 🔊", desc: "Our magic book reads the story aloud so you can enjoy the magic.", icon: "🐉", color: "bg-pink-500" }
  ];

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in zoom-in text-center p-6 relative z-10">
      <div className={`${slides[step].color} w-48 h-48 rounded-[3rem] shadow-2xl flex items-center justify-center text-8xl transform hover:rotate-6 transition-transform`}>
        {slides[step].icon}
      </div>
      <div className="space-y-4">
        <h2 className="text-5xl font-kids text-indigo-900 drop-shadow-sm">{slides[step].title}</h2>
        <p className="text-xl text-indigo-400 font-bold max-w-sm leading-relaxed">{slides[step].desc}</p>
      </div>
      <div className="flex gap-2">
        {slides.map((_, i) => <div key={i} className={`h-3 rounded-full transition-all ${i === step ? 'w-10 bg-indigo-500' : 'w-3 bg-indigo-100'}`} />)}
      </div>
      <button onClick={() => step < 2 ? setStep(step + 1) : onFinish()} className="bg-indigo-500 text-white font-kids text-2xl py-5 px-12 rounded-[2rem] shadow-xl hover:scale-105 active:scale-95 transition-all border-b-8 border-indigo-800 active:border-b-0">
        {step === 2 ? "Let's Go! 🚀" : "Next ✨"}
      </button>
    </div>
  );
};

const Library = ({ stories, onSelect, onBack }: { stories: Story[], onSelect: (s: Story) => void, onBack: () => void }) => (
  <div className="w-full space-y-8 animate-in slide-in-from-bottom-10 relative z-10">
    <div className="flex justify-between items-center">
      <h2 className="text-5xl font-kids text-indigo-950">My Magic Books</h2>
      <button onClick={onBack} className="bg-white text-indigo-400 font-bold px-6 py-2 rounded-full shadow hover:bg-indigo-50 transition-colors">← Home</button>
    </div>
    {stories.length === 0 ? (
      <div className="text-center py-20 bg-white/50 backdrop-blur rounded-[3rem] border-4 border-dashed border-indigo-100">
        <div className="text-7xl mb-4 grayscale opacity-40">📚</div>
        <p className="text-2xl text-indigo-200 font-bold">No books yet. Let's write one!</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stories.map(s => (
          <button key={s.id} onClick={() => onSelect(s)} className="bg-white p-6 rounded-[2.5rem] shadow-xl flex items-center gap-6 text-left group hover:scale-[1.02] transition-transform border-b-8 border-indigo-50">
            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center text-4xl group-hover:rotate-6 transition-transform">📖</div>
            <div>
              <h3 className="text-2xl font-kids text-indigo-900">{s.title}</h3>
              <p className="text-sm text-indigo-200 uppercase font-black tracking-widest">{new Date(s.timestamp).toLocaleDateString()}</p>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([{ role: 'model', content: "Hi! I'm Sparkle the Dragon. Want to dream up a new story? ✨🐉" }]);
  const [input, setInput] = useState('');
  const handleSend = async () => {
    if (!input.trim()) return;
    setMsgs(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    const chat = getAI().chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: "You are Sparkle the Dragon, a friendly storyteller for kids. Use emojis." } });
    const res = await chat.sendMessage({ message: input });
    setMsgs(prev => [...prev, { role: 'model', content: res.text || "Oops! My magic fire fizzled." }]);
  };
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white rounded-[3rem] w-80 h-[400px] shadow-2xl flex flex-col border-4 border-yellow-300 overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-yellow-400 p-4 text-white font-kids flex justify-between"><span>🐉 Sparkle Chat</span><button onClick={() => setIsOpen(false)}>✕</button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-amber-50">
            {msgs.map((m, i) => <div key={i} className={`p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-indigo-500 text-white ml-8 shadow-sm' : 'bg-white border mr-8 font-bold text-gray-700 shadow-sm'}`}>{m.content}</div>)}
          </div>
          <div className="p-2 border-t flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 p-2 bg-gray-50 rounded-xl outline-none text-sm" placeholder="Say hi!" /><button onClick={handleSend} className="bg-yellow-400 text-white p-2 rounded-xl">🚀</button></div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-yellow-400 p-5 rounded-full shadow-2xl text-4xl hover:scale-110 active:scale-95 transition-all">🐉</button>
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
    const saved = localStorage.getItem('magic_stories_clean');
    if (saved) setSavedStories(JSON.parse(saved));
  }, []);

  const saveStory = (s: Story) => {
    const updated = [s, ...savedStories.filter(old => old.id !== s.id)];
    setSavedStories(updated);
    localStorage.setItem('magic_stories_clean', JSON.stringify(updated));
  };

  const startStory = async (t?: string) => {
    const final = t || topic;
    if (!final) return;
    setLoading('Weaving magic...'); setState(AppState.GENERATING_STORY);
    try {
      const s = await aiGenerateStory(final);
      setStory(s); setPage(0); setState(AppState.READING_STORY);
      saveStory(s);
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
      saveStory(updatedStory);
    } finally { setLoading(''); }
  };

  const portals = [
    { title: "Barby", img: "https://images.unsplash.com/photo-1626125342332-d39363f9ef49?q=80&w=400&auto=format&fit=crop", color: "from-pink-400 to-rose-500", border: "border-rose-600" },
    { title: "Chhota Bheem", img: "https://images.unsplash.com/photo-1590333746431-1376dfc6c11d?q=80&w=400&auto=format&fit=crop", color: "from-orange-400 to-amber-600", border: "border-amber-700" },
    { title: "Ghost", img: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=400&auto=format&fit=crop", color: "from-indigo-400 to-purple-600", border: "border-purple-700" },
    { title: "Dino", img: "https://images.unsplash.com/photo-1525825691042-e14d9042fc59?q=80&w=400&auto=format&fit=crop", color: "from-green-400 to-emerald-600", border: "border-emerald-700" },
    { title: "Magic Castle", img: "https://images.unsplash.com/photo-1529154031171-89a662485144?q=80&w=400&auto=format&fit=crop", color: "from-purple-400 to-violet-600", border: "border-violet-700" },
    { title: "Space Adventure", img: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=400&auto=format&fit=crop", color: "from-blue-400 to-indigo-600", border: "border-indigo-700" }
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-gradient-to-b from-amber-50 to-indigo-50 relative overflow-hidden">
      <MagicBackground />

      <header className="w-full max-w-5xl flex justify-between items-center mb-10 relative z-20">
        <h1 className="text-4xl text-indigo-950 font-kids drop-shadow-sm cursor-pointer hover:scale-105 transition-transform" onClick={() => setState(AppState.IDLE)}>✨ Magic Storybook</h1>
        {state === AppState.IDLE && (
          <button onClick={() => setState(AppState.LIBRARY)} className="bg-white px-8 py-3 rounded-full font-kids text-xl text-indigo-500 shadow-xl hover:scale-105 transition-all border-b-4 border-indigo-100">📚 My Library</button>
        )}
      </header>

      <main className="w-full max-w-6xl bg-white/70 backdrop-blur-xl rounded-[4rem] shadow-2xl p-6 md:p-12 min-h-[600px] flex flex-col items-center justify-center relative z-10 border border-white/50">
        
        {state === AppState.INTRO && (
          <div className="text-center space-y-12 animate-in zoom-in duration-700">
            <div className="bg-yellow-400 w-56 h-56 rounded-[5rem] shadow-[0_20px_50px_rgba(251,191,36,0.5)] flex items-center justify-center mx-auto text-[10rem] animate-float">📖</div>
            <div className="space-y-4">
              <h2 className="text-6xl md:text-8xl text-indigo-950 font-kids drop-shadow-lg">Magic Storybook</h2>
              <p className="text-3xl text-indigo-400 font-bold italic">Endless adventures, made just for you!</p>
            </div>
            <button onClick={() => setState(AppState.ONBOARDING)} className="bg-indigo-500 text-white font-kids text-4xl px-20 py-8 rounded-[3rem] shadow-2xl hover:scale-110 transition-all border-b-[15px] border-indigo-900 active:border-b-0">Start Adventure 🚀</button>
          </div>
        )}

        {state === AppState.ONBOARDING && <Onboarding onFinish={() => setState(AppState.IDLE)} />}

        {state === AppState.IDLE && (
          <div className="w-full space-y-12 text-center animate-in fade-in">
            <div className="space-y-4">
              <h2 className="text-7xl text-indigo-950 font-kids">Let's Create!</h2>
              <p className="text-2xl text-indigo-300 font-bold uppercase tracking-widest">Type your idea or pick an adventure</p>
            </div>

            <div className="max-w-3xl mx-auto relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-[4rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse"></div>
              <div className="relative flex bg-indigo-600 p-3 rounded-[4rem] shadow-2xl border-4 border-white/30">
                <input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && startStory()} 
                  placeholder="Tell me a story about a brave kitty..." 
                  className="flex-1 p-6 pl-10 rounded-l-[3.5rem] outline-none text-2xl font-bold bg-transparent text-white placeholder:text-indigo-100/40" 
                />
                <button onClick={() => startStory()} className="bg-yellow-400 text-indigo-950 px-12 py-4 rounded-full font-kids text-3xl shadow-xl hover:scale-105 hover:bg-yellow-300 transition-all border-b-[6px] border-yellow-600 active:border-b-0 active:translate-y-1">GO! ✨</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 w-full px-4">
              {portals.map((p) => (
                <button 
                  key={p.title} 
                  onClick={() => startStory(p.title)} 
                  className={`group relative flex flex-col h-[280px] rounded-[3rem] overflow-hidden shadow-2xl transition-all hover:scale-[1.05] active:scale-95 border-b-[10px] ${p.border}`}
                >
                  <img src={p.img} alt={p.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${p.color} opacity-30 group-hover:opacity-10 transition-opacity`}></div>
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20">
                    <span className="text-3xl font-kids text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{p.title}</span>
                    <div className="mt-2 text-indigo-100 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity tracking-widest uppercase">Start Journey →</div>
                  </div>
                  <div className="absolute top-4 right-6 text-white text-3xl drop-shadow-lg opacity-80 animate-bounce-slow">✨</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {state === AppState.LIBRARY && <Library stories={savedStories} onSelect={s => { setStory(s); setPage(0); setState(AppState.READING_STORY); }} onBack={() => setState(AppState.IDLE)} />}

        {state === AppState.GENERATING_STORY && (
          <div className="text-center space-y-10">
            <div className="text-[12rem] animate-bounce drop-shadow-2xl">🪄</div>
            <h3 className="text-4xl font-kids text-indigo-900 animate-pulse">{loading}</h3>
            <div className="max-w-xs mx-auto h-3 bg-indigo-50 rounded-full overflow-hidden">
               <div className="h-full bg-indigo-500 animate-infinite-scroll w-1/2 rounded-full"></div>
            </div>
          </div>
        )}

        {state === AppState.READING_STORY && story && (
          <div className="w-full space-y-10 animate-in slide-in-from-right">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <button onClick={() => setState(AppState.IDLE)} className="bg-white/80 px-6 py-2 rounded-full text-indigo-300 font-bold hover:text-indigo-500 shadow-sm">🏠 Home</button>
              <h2 className="text-5xl text-center text-indigo-950 font-kids flex-1 px-4 drop-shadow-sm">{story.title}</h2>
              <button onClick={() => setState(AppState.LIBRARY)} className="bg-white/80 px-6 py-2 rounded-full text-indigo-300 font-bold hover:text-indigo-500 shadow-sm">📚 Library</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center bg-white p-10 rounded-[4rem] shadow-2xl border-4 border-indigo-50">
              <div className="aspect-square bg-indigo-50 rounded-[3rem] overflow-hidden flex items-center justify-center relative shadow-inner">
                {story.pages[page].imageUrl ? (
                  <img src={story.pages[page].imageUrl} className="w-full h-full object-cover animate-in fade-in" />
                ) : (
                  <button onClick={paintImage} className="bg-indigo-500 text-white px-10 py-5 rounded-[2rem] font-kids text-2xl shadow-xl hover:bg-indigo-600 transition-all border-b-4 border-indigo-800">
                    {loading === 'Painting...' ? '🎨 Painting...' : '✨ Paint Magic'}
                  </button>
                )}
                {loading === 'Painting...' && <div className="absolute inset-0 bg-white/60 backdrop-blur flex items-center justify-center text-8xl animate-bounce">🎨</div>}
              </div>
              <div className="flex flex-col h-full justify-between space-y-8">
                <div>
                  <div className="inline-block px-6 py-2 rounded-full bg-indigo-500 text-white text-lg font-kids shadow-lg mb-6">Page {page + 1}</div>
                  <p className="text-4xl text-gray-800 leading-relaxed font-bold italic font-kids">"{story.pages[page].text}"</p>
                </div>
                <button onClick={readAloud} disabled={playing} className="w-full py-8 bg-yellow-400 text-indigo-950 rounded-[3rem] font-kids text-3xl shadow-2xl border-b-[12px] border-yellow-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">
                  {playing ? '🗣️ Reading...' : '🔊 Read Aloud'}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center pt-8 px-4">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-7xl disabled:opacity-10 hover:scale-125 transition-transform">⬅️</button>
              <div className="flex gap-4">{story.pages.map((_, i) => <div key={i} className={`h-4 rounded-full transition-all duration-500 ${i === page ? 'w-20 bg-indigo-500' : 'w-4 bg-indigo-100'}`} />)}</div>
              <button disabled={page === 3} onClick={() => setPage(p => p + 1)} className="text-7xl disabled:opacity-10 hover:scale-125 transition-transform">➡️</button>
            </div>
          </div>
        )}
      </main>
      <ChatBot />
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-30px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-50px) rotate(10deg); } }
        @keyframes float-delayed { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-40px); } }
        @keyframes infinite-scroll { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 10s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; animation-delay: 2s; }
        .animate-infinite-scroll { animation: infinite-scroll 2s linear infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
