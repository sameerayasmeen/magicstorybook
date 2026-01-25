
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

// --- Audio Utilities ---
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
    contents: `Write a 4-page magical children's story about: ${prompt}. JSON format with title and pages array (text, illustrationPrompt).`,
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
    contents: { parts: [{ text: `A vibrant, high-quality, Studio Ghibli style digital illustration for children: ${prompt}. Warm lighting, magical atmosphere.` }] },
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

// --- Decorative Components ---
const MagicBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
    <div className="absolute top-10 left-[10%] text-4xl animate-float">✨</div>
    <div className="absolute top-[20%] right-[15%] text-6xl animate-float-slow">⭐</div>
    <div className="absolute bottom-[10%] left-[20%] text-5xl animate-float-delayed">🌈</div>
    <div className="absolute bottom-[30%] right-[10%] text-4xl animate-float">✨</div>
  </div>
);

const Onboarding = ({ onFinish }: { onFinish: () => void }) => {
  const [step, setStep] = useState(0);
  const slides = [
    { title: "Imagine! 🧠", desc: "Type anything! Like a dragon that loves dancing.", icon: "💭", color: "bg-indigo-500" },
    { title: "Watch! 🎨", desc: "Sparkle the Dragon paints every page just for you.", icon: "🖌️", color: "bg-yellow-400" },
    { title: "Listen! 🔊", desc: "Our magic book reads the story aloud in a friendly voice.", icon: "🐉", color: "bg-pink-500" }
  ];

  return (
    <div className="text-center space-y-8 animate-in zoom-in max-w-md">
      <div className={`${slides[step].color} w-48 h-48 rounded-[3rem] shadow-2xl flex items-center justify-center text-8xl mx-auto transform hover:rotate-6 transition-transform duration-500`}>
        {slides[step].icon}
      </div>
      <div className="space-y-3">
        <h2 className="text-5xl font-kids text-indigo-950">{slides[step].title}</h2>
        <p className="text-xl text-indigo-400 font-bold">{slides[step].desc}</p>
      </div>
      <div className="flex justify-center gap-3">
        {slides.map((_, i) => <div key={i} className={`h-3 rounded-full transition-all duration-300 ${i === step ? 'w-12 bg-indigo-500' : 'w-3 bg-indigo-100'}`} />)}
      </div>
      <button onClick={() => step < 2 ? setStep(step + 1) : onFinish()} className="bg-indigo-500 text-white font-kids text-2xl py-5 px-16 rounded-[2rem] shadow-xl hover:scale-105 transition-all active:scale-95 border-b-8 border-indigo-800 active:border-b-0">
        {step === 2 ? "Let's Start! 🚀" : "Next ✨"}
      </button>
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
    const saved = localStorage.getItem('magic_library');
    if (saved) setSavedStories(JSON.parse(saved));
  }, []);

  const saveToLibrary = (s: Story) => {
    const updated = [s, ...savedStories.filter(old => old.id !== s.id)];
    setSavedStories(updated);
    localStorage.setItem('magic_library', JSON.stringify(updated));
  };

  const generate = async (t?: string) => {
    const final = t || topic;
    if (!final) return;
    setLoading('Creating your story...'); setState(AppState.GENERATING_STORY);
    try {
      const s = await aiGenerateStory(final);
      setStory(s); setPage(0); setState(AppState.READING_STORY);
      saveToLibrary(s);
    } catch { setState(AppState.IDLE); }
    finally { setLoading(''); }
  };

  const read = async () => {
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

  const paint = async () => {
    if (!story) return;
    setLoading('Painting...');
    try {
      const url = await aiGenerateImage(story.pages[page].illustrationPrompt);
      const updatedPages = [...story.pages]; updatedPages[page].imageUrl = url;
      const updatedStory = { ...story, pages: updatedPages };
      setStory(updatedStory);
      saveToLibrary(updatedStory);
    } finally { setLoading(''); }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-gradient-to-b from-amber-50 to-indigo-50 relative overflow-hidden">
      <MagicBackground />
      
      <header className="w-full max-w-5xl flex justify-between items-center mb-10 relative z-20">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setState(AppState.IDLE)}>
          <div className="bg-yellow-400 p-2 rounded-2xl shadow-lg transform -rotate-6 group-hover:rotate-0 transition-transform">
            <span className="text-3xl">📖</span>
          </div>
          <h1 className="text-3xl text-indigo-950 font-kids">Magic Storybook</h1>
        </div>
        {state === AppState.IDLE && (
          <button onClick={() => setState(AppState.LIBRARY)} className="bg-white px-8 py-3 rounded-full font-kids text-indigo-500 shadow-xl hover:scale-105 transition-all">
            📚 My Library
          </button>
        )}
      </header>

      <main className="w-full max-w-5xl bg-white/80 backdrop-blur rounded-[4rem] shadow-2xl p-8 md:p-16 min-h-[600px] flex flex-col items-center justify-center relative z-10 border border-white">
        
        {state === AppState.INTRO && (
          <div className="text-center space-y-12 animate-in zoom-in duration-700">
            <div className="bg-yellow-400 w-56 h-56 rounded-[5rem] shadow-2xl flex items-center justify-center mx-auto text-[10rem] animate-float relative">
              📖
              <div className="absolute -top-10 -right-10 text-6xl animate-pulse">✨</div>
            </div>
            <div className="space-y-4">
              <h2 className="text-6xl md:text-8xl text-indigo-950 font-kids drop-shadow-lg">Storybook AI</h2>
              <p className="text-3xl text-indigo-400 font-bold italic">Your imagination, brought to life!</p>
            </div>
            <button onClick={() => setState(AppState.ONBOARDING)} className="bg-indigo-500 text-white font-kids text-4xl px-20 py-8 rounded-[3rem] shadow-2xl hover:scale-110 transition-all border-b-[15px] border-indigo-900 active:border-b-0">
              Start Magic 🚀
            </button>
          </div>
        )}

        {state === AppState.ONBOARDING && <Onboarding onFinish={() => setState(AppState.IDLE)} />}

        {state === AppState.IDLE && (
          <div className="w-full space-y-16 text-center animate-in fade-in">
            <h2 className="text-7xl md:text-8xl text-indigo-950 font-kids">Let's Create!</h2>
            <div className="max-w-2xl mx-auto relative">
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder="A pizza that loves surfing..." className="w-full p-8 rounded-[3rem] border-4 border-indigo-50 outline-none text-2xl shadow-inner font-bold text-indigo-900" />
              <button onClick={() => generate()} className="absolute right-4 top-4 bottom-4 bg-indigo-500 text-white px-10 rounded-[2.5rem] font-kids text-2xl shadow-lg hover:bg-indigo-600 transition-all">Go! ✨</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[ {e: "👻", t: "Ghost"}, {e: "🚀", t: "Space"}, {e: "🦖", t: "Dino"}, {e: "🏰", t: "Castle"} ].map(c => (
                <button key={c.t} onClick={() => generate(c.t)} className="bg-white p-8 rounded-[3rem] shadow-xl hover:scale-110 transition-all group border-b-[10px] border-indigo-50">
                  <div className="text-7xl group-hover:rotate-12 transition-transform">{c.e}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {state === AppState.LIBRARY && (
          <div className="w-full space-y-8 animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center"><h2 className="text-5xl font-kids text-indigo-950">My Books</h2><button onClick={() => setState(AppState.IDLE)} className="text-indigo-400 font-bold">← Back</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {savedStories.map(s => (
                <button key={s.id} onClick={() => { setStory(s); setState(AppState.READING_STORY); }} className="bg-white p-8 rounded-[3rem] shadow-xl flex items-center gap-8 text-left hover:scale-[1.02] transition-transform border-b-8 border-indigo-50">
                  <div className="text-6xl">📖</div>
                  <div><h3 className="text-2xl font-kids text-indigo-900">{s.title}</h3><p className="text-sm text-indigo-200 uppercase font-black tracking-widest">{new Date(s.timestamp).toLocaleDateString()}</p></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {state === AppState.GENERATING_STORY && (
          <div className="text-center space-y-10 animate-pulse">
            <div className="text-[12rem] animate-bounce">🪄</div>
            <h3 className="text-4xl font-kids text-indigo-900">{loading}</h3>
          </div>
        )}

        {state === AppState.READING_STORY && story && (
          <div className="w-full space-y-10 animate-in slide-in-from-right">
            <div className="flex justify-between items-center">
              <button onClick={() => setState(AppState.IDLE)} className="text-indigo-300 font-bold">🏠 Home</button>
              <h2 className="text-4xl font-kids text-indigo-950 text-center flex-1 px-4">{story.title}</h2>
              <button onClick={() => setState(AppState.LIBRARY)} className="text-indigo-300 font-bold">📚 Library</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-white p-10 rounded-[4rem] shadow-2xl border-4 border-indigo-50">
              <div className="aspect-square bg-indigo-50 rounded-[3rem] overflow-hidden flex items-center justify-center relative shadow-inner">
                {story.pages[page].imageUrl ? (
                  <img src={story.pages[page].imageUrl} className="w-full h-full object-cover animate-in fade-in" />
                ) : (
                  <button onClick={paint} className="bg-indigo-500 text-white px-10 py-5 rounded-[2rem] font-kids text-2xl shadow-xl hover:bg-indigo-600 transition-all">
                    {loading === 'Painting...' ? '🎨 Painting...' : '✨ Paint Scene'}
                  </button>
                )}
                {loading === 'Painting...' && <div className="absolute inset-0 bg-white/60 backdrop-blur flex items-center justify-center text-8xl animate-bounce">🎨</div>}
              </div>
              <div className="flex flex-col justify-between space-y-8">
                <div>
                  <div className="inline-block px-6 py-2 rounded-full bg-indigo-500 text-white font-kids text-lg mb-6">Page {page + 1}</div>
                  <p className="text-4xl text-gray-800 leading-relaxed font-bold italic">"{story.pages[page].text}"</p>
                </div>
                <button onClick={read} disabled={playing} className="w-full py-8 bg-yellow-400 text-indigo-950 rounded-[3rem] font-kids text-3xl shadow-2xl border-b-[12px] border-yellow-600 active:border-b-0 active:translate-y-1 disabled:opacity-50 transition-all">
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

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-30px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-50px) rotate(10deg); } }
        @keyframes float-delayed { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-40px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 10s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; animation-delay: 2s; }
      `}</style>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
