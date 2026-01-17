
import React, { useState, useRef, useEffect } from 'react';
import { generateStory, generateIllustration, generateSpeech } from './services/gemini.ts';
import { Story, AppState } from './types.ts';
import { decode, decodeAudioData } from './utils/audio.ts';
import { IntroScreen } from './components/IntroScreen.tsx';
import { OnboardingFlow } from './components/OnboardingFlow.tsx';

const CATEGORIES = [
  { 
    id: 'ghost', 
    title: "Ghost Stories", 
    topic: "A friendly ghost named Boo who lost his favorite sheet", 
    emoji: "👻", 
    gradient: "from-indigo-600 via-indigo-500 to-purple-700",
    border: "border-indigo-800"
  },
  { 
    id: 'science', 
    title: "Scientific", 
    topic: "A young scientist who accidentally makes a giant jumping bean", 
    emoji: "🔬", 
    gradient: "from-cyan-500 via-blue-500 to-blue-700",
    border: "border-blue-800"
  },
  { 
    id: 'fiction', 
    title: "Fictionland", 
    topic: "A secret city built entirely out of books and bookmarks", 
    emoji: "📚", 
    gradient: "from-emerald-500 via-green-500 to-green-700",
    border: "border-green-800"
  },
  { 
    id: 'barbie', 
    title: "Barbie Girl", 
    topic: "Barbie and her friends finding a lost magic tiara in Malibu", 
    emoji: "💖", 
    gradient: "from-pink-400 via-rose-500 to-rose-600",
    border: "border-rose-800"
  },
  { 
    id: 'bheem', 
    title: "Chota Bheem", 
    topic: "Bheem and his friends saving the village using yummy Laddoos", 
    emoji: "💪", 
    gradient: "from-orange-400 via-amber-500 to-yellow-600",
    border: "border-orange-800"
  },
  { 
    id: 'masha', 
    title: "Masha & Bear", 
    topic: "Masha trying to teach the Bear how to play hide and seek", 
    emoji: "🐻", 
    gradient: "from-amber-600 via-orange-600 to-red-700",
    border: "border-amber-800"
  },
];

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.INTRO);
  const [story, setStory] = useState<Story | null>(null);
  const [savedStories, setSavedStories] = useState<Story[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('magic_storybook_onboarded');
    if (hasSeenOnboarding) {
      setAppState(AppState.IDLE);
    }
    
    const stored = localStorage.getItem('magic_storybook_saved_stories');
    if (stored) {
      setSavedStories(JSON.parse(stored));
    }
  }, []);

  const startNewStory = async (selectedTopic?: string) => {
    const finalTopic = selectedTopic || topic;
    if (!finalTopic.trim()) return;
    
    setError(null);
    setAppState(AppState.GENERATING_STORY);
    setLoadingMsg('Magic Sparkles are weaving your story...');
    try {
      const newStory = await generateStory(finalTopic);
      setStory(newStory);
      setCurrentPage(0);
      setDirection('forward');
      setAppState(AppState.READING_STORY);
      setIsSaved(false);
    } catch (err) {
      console.error(err);
      setError("The magic failed! Try another topic.");
      setAppState(AppState.IDLE);
    }
  };

  const handleSaveStory = () => {
    if (!story) return;
    const isAlreadySaved = savedStories.some(s => s.title === story.title);
    if (isAlreadySaved) {
      setIsSaved(true);
      return;
    }
    const updated = [...savedStories, story];
    setSavedStories(updated);
    localStorage.setItem('magic_storybook_saved_stories', JSON.stringify(updated));
    setIsSaved(true);
  };

  const handleDeleteStory = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const updated = savedStories.filter((_, i) => i !== index);
    setSavedStories(updated);
    localStorage.setItem('magic_storybook_saved_stories', JSON.stringify(updated));
  };

  const openSavedStory = (saved: Story) => {
    setStory(saved);
    setCurrentPage(0);
    setDirection('forward');
    setAppState(AppState.READING_STORY);
    setIsSaved(true);
  };

  const handleGenerateIllustration = async () => {
    if (!story) return;
    
    setLoadingMsg(`Sparkle is painting page ${currentPage + 1}...`);
    try {
      const url = await generateIllustration(story.pages[currentPage].illustrationPrompt, '1K');
      const updatedPages = [...story.pages];
      updatedPages[currentPage].imageUrl = url;
      const updatedStory = { ...story, pages: updatedPages };
      setStory(updatedStory);
      
      if (isSaved) {
        const updatedCollection = savedStories.map(s => s.title === story.title ? updatedStory : s);
        setSavedStories(updatedCollection);
        localStorage.setItem('magic_storybook_saved_stories', JSON.stringify(updatedCollection));
      }
    } catch (err) {
      console.error(err);
      setError("Painting is hard! Sparkle needs a break.");
    } finally {
      setLoadingMsg('');
    }
  };

  const handleReadAloud = async () => {
    if (!story || isAudioPlaying) return;
    setIsAudioPlaying(true);
    setLoadingMsg('Sparkle is warming up his voice...');
    
    try {
      const base64 = await generateSpeech(story.pages[currentPage].text);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioData = decode(base64);
      const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsAudioPlaying(false);
      source.start();
    } catch (err) {
      console.error(err);
      setError("Voice box is dusty! Try again.");
      setIsAudioPlaying(false);
    } finally {
      setLoadingMsg('');
    }
  };

  const goToNextPage = () => {
    if (story && currentPage < story.pages.length - 1) {
      setDirection('forward');
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setDirection('backward');
      setCurrentPage(prev => prev - 1);
    }
  };

  const reset = () => {
    setAppState(AppState.IDLE);
    setStory(null);
    setTopic('');
    setDirection(null);
    setError(null);
  };

  const openAbout = () => setAppState(AppState.ABOUT);
  const openLibrary = () => setAppState(AppState.LIBRARY);

  const onIntroComplete = () => setAppState(AppState.ONBOARDING);
  const onOnboardingComplete = () => {
    localStorage.setItem('magic_storybook_onboarded', 'true');
    setAppState(AppState.IDLE);
  };

  if (appState === AppState.INTRO) {
    return <IntroScreen onStart={onIntroComplete} />;
  }

  if (appState === AppState.ONBOARDING) {
    return <OnboardingFlow onComplete={onOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen pb-24 overflow-x-hidden selection:bg-yellow-200">
      <header className="p-6 flex justify-between items-center max-w-6xl mx-auto">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
          <div className="bg-yellow-400 p-2 rounded-2xl shadow-lg transform -rotate-6 group-hover:rotate-0 transition-transform duration-300">
            <span className="text-3xl">📖</span>
          </div>
          <h1 className="text-2xl md:text-3xl text-indigo-900 tracking-tight font-kids">Magic Storybook</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={openAbout}
            className={`p-3 rounded-2xl bg-white shadow-lg border-b-4 border-indigo-100 transition-all hover:scale-110 active:scale-95 text-indigo-500 font-kids ${appState === AppState.ABOUT ? 'hidden' : ''}`}
            title="How it works"
          >
            ❓
          </button>
          
          {appState === AppState.IDLE && (
            <button 
              onClick={openLibrary}
              className="bg-yellow-400 hover:bg-yellow-500 text-indigo-950 px-6 py-3 rounded-2xl font-kids text-lg transition-all border-b-4 border-yellow-600 shadow-lg active:border-b-0 active:translate-y-1 flex items-center gap-2"
            >
              <span>📚</span>
              <span>My Library</span>
            </button>
          )}

          {(appState === AppState.READING_STORY || appState === AppState.ABOUT || appState === AppState.LIBRARY) && (
            <button 
              onClick={reset}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-2xl font-kids text-lg transition-all border-b-4 border-indigo-800 shadow-lg active:border-b-0 active:translate-y-1 flex items-center gap-2"
            >
              <span>🏠</span>
              <span>Home</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-4">
        {appState === AppState.IDLE && (
          <div className="flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in duration-700">
            <div className="space-y-4 text-center">
              <h2 className="text-6xl md:text-8xl text-indigo-950 font-kids leading-tight drop-shadow-xl animate-float">Let's Play!</h2>
              <p className="text-indigo-600 text-2xl font-bold opacity-80">What kind of magic story should we make today?</p>
            </div>
            
            {/* Search Box - High Contrast for Kids */}
            <div className="w-full max-w-3xl relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 via-indigo-400 to-purple-400 rounded-[3.5rem] blur opacity-20 group-hover:opacity-40 transition duration-500 animate-pulse"></div>
              <div className="relative">
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startNewStory()}
                  placeholder="TYPE STORY IDEA HERE... ✨"
                  className="w-full p-8 pr-44 rounded-[3rem] bg-white shadow-2xl border-4 border-indigo-100 focus:border-yellow-400 outline-none text-2xl font-bold text-indigo-950 transition-all placeholder:text-indigo-700 placeholder:opacity-100 placeholder:font-black"
                />
                <button 
                  onClick={() => startNewStory()}
                  className="absolute right-4 top-4 bottom-4 bg-indigo-500 hover:bg-indigo-600 text-white font-kids text-2xl px-12 rounded-[2rem] shadow-xl transition-all transform hover:scale-105 active:scale-95 active:shadow-inner flex items-center gap-2 border-b-4 border-indigo-800 active:border-b-0"
                >
                  Go! 🚀
                </button>
              </div>
            </div>

            <div className="w-full space-y-8">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3 text-indigo-300">
                  <span className="text-xl">✨</span>
                  <span className="text-sm font-black uppercase tracking-[0.3em]">Quick Choices</span>
                  <span className="text-xl">✨</span>
                </div>
                <h3 className="text-4xl text-indigo-900 font-kids text-center">Choose an Adventure</h3>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => startNewStory(cat.topic)}
                    className={`group relative flex flex-col items-center justify-center p-8 rounded-[3rem] bg-gradient-to-br ${cat.gradient} border-t-2 border-white/40 shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden min-h-[180px] border-b-8 ${cat.border}`}
                  >
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="mb-4 drop-shadow-2xl animate-float group-hover:scale-125 transition-transform duration-500 text-6xl">
                        {cat.emoji}
                      </div>
                      <span className="text-xl font-kids text-white drop-shadow-md tracking-wide">
                        {cat.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {savedStories.length > 0 && (
              <button 
                onClick={openLibrary}
                className="group flex flex-col items-center gap-4 bg-white p-6 rounded-[3rem] shadow-xl border-b-8 border-indigo-50 hover:scale-105 transition-all active:scale-95"
              >
                <div className="flex items-center gap-3 text-yellow-400">
                  <span className="text-xl">⭐</span>
                  <span className="text-sm font-black uppercase tracking-[0.3em]">Your Library</span>
                  <span className="text-xl">⭐</span>
                </div>
                <div className="flex -space-x-4">
                  {savedStories.slice(0, 4).map((s, idx) => (
                    <div key={idx} className="w-16 h-16 rounded-full border-4 border-white bg-indigo-50 overflow-hidden shadow-lg transform rotate-6 hover:rotate-0 transition-transform">
                      {s.pages[0].imageUrl ? <img src={s.pages[0].imageUrl} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-2xl">📖</span>}
                    </div>
                  ))}
                  {savedStories.length > 4 && (
                    <div className="w-16 h-16 rounded-full border-4 border-white bg-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      +{savedStories.length - 4}
                    </div>
                  )}
                </div>
                <p className="text-indigo-900 font-kids text-xl">Open My Magical Bookshelf ➡</p>
              </button>
            )}

            {error && (
              <div className="bg-red-100 text-red-600 px-10 py-5 rounded-full border-4 border-red-200 font-black animate-bounce shadow-2xl text-xl font-kids">
                {error}
              </div>
            )}
          </div>
        )}

        {appState === AppState.LIBRARY && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 pb-12">
            <div className="flex flex-col items-center gap-4">
              <button 
                onClick={reset}
                className="flex items-center gap-2 bg-white text-indigo-500 px-8 py-4 rounded-[2rem] font-kids text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all border-b-8 border-indigo-50 active:border-b-0"
              >
                <span>⬅️</span>
                <span>Back Home</span>
              </button>
              <h2 className="text-6xl text-indigo-950 font-kids text-center">My Magical Bookshelf</h2>
              <p className="text-indigo-400 text-2xl font-bold">You have {savedStories.length} stories saved!</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {savedStories.map((saved, idx) => (
                <div 
                  key={idx}
                  onClick={() => openSavedStory(saved)}
                  className="group relative bg-white rounded-[4rem] shadow-2xl border-b-[16px] border-indigo-50 p-6 flex flex-col items-center cursor-pointer hover:translate-y-[-10px] transition-all duration-300 active:scale-95"
                >
                  <button 
                    onClick={(e) => handleDeleteStory(e, idx)}
                    className="absolute -top-3 -right-3 bg-red-500 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-110 active:scale-90"
                    title="Delete Story"
                  >
                    ❌
                  </button>
                  <div className="w-full aspect-[4/5] bg-indigo-50 rounded-[3rem] mb-6 overflow-hidden border-4 border-indigo-50 flex items-center justify-center relative shadow-inner">
                    {saved.pages[0].imageUrl ? (
                      <img src={saved.pages[0].imageUrl} alt={saved.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <span className="text-8xl">📖</span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
                  </div>
                  <h3 className="text-2xl font-kids text-indigo-900 text-center line-clamp-2 px-4 mb-4">
                    {saved.title}
                  </h3>
                  <div className="flex gap-2 mb-2">
                    {saved.pages.map((p, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${p.imageUrl ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'bg-gray-200'}`}></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
