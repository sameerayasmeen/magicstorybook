
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

// --- Audio Utils ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- API Services ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const generateStory = async (prompt: string): Promise<Story> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a short story for kids about: ${prompt}. The story should have exactly 4 short pages. 
    Format the response as JSON with a title and an array of pages. Each page must have 'text' and a short 'illustrationPrompt' for a picture book artist.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          pages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                illustrationPrompt: { type: Type.STRING }
              },
              required: ["text", "illustrationPrompt"]
            }
          }
        },
        required: ["title", "pages"]
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text);
};

const generateIllustration = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A magical, colorful, kid-friendly digital illustration of: ${prompt}. Studio Ghibli style, vibrant.` }] },
    config: { imageConfig: { aspectRatio: "1:1" } },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("No image generated");
};

const generateSpeech = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read cheerfully: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

// --- Main App Component ---
const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [story, setStory] = useState<Story | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const startNewStory = async () => {
    if (!topic.trim()) return;
    setError(null);
    setAppState(AppState.GENERATING_STORY);
    setLoadingMsg('Magic Sparkles are weaving your story...');
    try {
      const newStory = await generateStory(topic);
      setStory(newStory);
      setCurrentPage(0);
      setAppState(AppState.READING_STORY);
    } catch (err: any) {
      setError("The magic failed! Please try again.");
      setAppState(AppState.IDLE);
    }
  };

  const handleReadAloud = async () => {
    if (!story || isAudioPlaying) return;
    setIsAudioPlaying(true);
    try {
      const base64 = await generateSpeech(story.pages[currentPage].text);
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decode(base64), audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsAudioPlaying(false);
      source.start();
    } catch {
      setIsAudioPlaying(false);
    }
  };

  const handlePaintPage = async () => {
    if (!story) return;
    setLoadingMsg('Painting magic...');
    try {
      const url = await generateIllustration(story.pages[currentPage].illustrationPrompt);
      const updatedPages = [...story.pages];
      updatedPages[currentPage].imageUrl = url;
      setStory({ ...story, pages: updatedPages });
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl flex justify-between items-center mb-12">
        <h1 className="text-3xl md:text-4xl text-indigo-900 font-kids">✨ Magic Storybook</h1>
        {appState !== AppState.IDLE && (
          <button onClick={() => setAppState(AppState.IDLE)} className="bg-white px-4 py-2 rounded-xl shadow font-bold text-indigo-500">Home</button>
        )}
      </header>

      <main className="w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl p-8 md:p-12 min-h-[500px] flex flex-col items-center justify-center">
        {appState === AppState.IDLE && (
          <div className="w-full space-y-8 text-center animate-in fade-in zoom-in">
            <h2 className="text-5xl text-indigo-950 font-kids">Let's make magic!</h2>
            <p className="text-xl text-indigo-400 font-bold">What should our story be about?</p>
            <div className="relative group max-w-2xl mx-auto">
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="A friendly dragon who loves pizza..."
                className="w-full p-6 text-xl rounded-[2rem] border-4 border-indigo-100 focus:border-yellow-400 outline-none transition-all shadow-inner"
              />
              <button 
                onClick={startNewStory}
                className="mt-6 w-full md:w-auto md:px-12 py-4 bg-indigo-500 text-white rounded-2xl font-kids text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                Go! 🚀
              </button>
            </div>
            {error && <p className="text-red-500 font-bold">{error}</p>}
          </div>
        )}

        {appState === AppState.GENERATING_STORY && (
          <div className="text-center space-y-6">
            <div className="text-9xl animate-bounce">🎨</div>
            <h3 className="text-3xl text-indigo-900 font-kids">{loadingMsg}</h3>
          </div>
        )}

        {appState === AppState.READING_STORY && story && (
          <div className="w-full space-y-8 animate-in slide-in-from-right">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-1/2 aspect-square bg-indigo-50 rounded-[2rem] overflow-hidden shadow-inner relative">
                {story.pages[currentPage].imageUrl ? (
                  <img src={story.pages[currentPage].imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                    <button onClick={handlePaintPage} className="bg-indigo-500 text-white px-8 py-4 rounded-2xl font-kids text-xl animate-pulse">
                      {loadingMsg === 'Painting magic...' ? 'Painting...' : '✨ Paint this Page'}
                    </button>
                  </div>
                )}
              </div>
              <div className="w-full md:w-1/2 space-y-6">
                <h2 className="text-3xl text-indigo-950 font-kids">{story.title}</h2>
                <p className="text-2xl text-gray-800 leading-relaxed font-medium">
                  {story.pages[currentPage].text}
                </p>
                <button 
                  onClick={handleReadAloud}
                  disabled={isAudioPlaying}
                  className="w-full py-4 bg-yellow-400 text-indigo-900 rounded-2xl font-kids text-xl shadow-lg flex items-center justify-center gap-2"
                >
                  {isAudioPlaying ? '🗣️ Reading...' : '🔊 Read Aloud'}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center pt-8 border-t">
              <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)} className="text-4xl disabled:opacity-20">⬅️</button>
              <span className="font-kids text-indigo-300">Page {currentPage + 1} of 4</span>
              <button disabled={currentPage === 3} onClick={() => setCurrentPage(p => p + 1)} className="text-4xl disabled:opacity-20">➡️</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}
