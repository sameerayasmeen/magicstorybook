
import React, { useState, useRef, useEffect } from 'react';
import { generateStory, generateIllustration, generateSpeech } from './services/gemini.ts';
import { Story, AppState } from './types.ts';
import { decode, decodeAudioData } from './utils/audio.ts';
import { IntroScreen } from './components/IntroScreen.tsx';
import { OnboardingFlow } from './components/OnboardingFlow.tsx';
import { ApiKeyGate } from './components/ApiKeyGate.tsx';

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
  const [isKeyValidated, setIsKeyValidated] = useState(!!process.env.API_KEY);

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
    } catch (err: any) {
      console.error(err);
      // Displaying actual error message to help user debug (e.g., API key issues)
      const msg = err.message || "Unknown error";
      setError(`The magic failed: ${msg.includes('403') || msg.includes('401') ? "Invalid API Key" : "Please try again!"}`);
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
    } catch (err: any) {
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
    } catch (err: any) {
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

  if (!isKeyValidated) {
    return <ApiKeyGate onValidated={() => setIsKeyValidated(true)} />;
  }

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

            {error && (
              <div className="bg-red-100 text-red-600 px-10 py-5 rounded-full border-4 border-red-200 font-black animate-bounce shadow-2xl text-xl font-kids">
                {error}
              </div>
            )}

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
          </div>
        )}

        {appState === AppState.GENERATING_STORY && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
            <div className="relative">
              <div className="text-[10rem] animate-bounce">🎨</div>
              <div className="absolute -top-4 -right-4 text-6xl animate-pulse">✨</div>
            </div>
            <div className="space-y-6 text-center">
              <h3 className="text-4xl text-indigo-900 font-kids drop-shadow-sm">{loadingMsg}</h3>
              <div className="w-96 h-6 bg-white rounded-full overflow-hidden mx-auto border-4 border-indigo-100 shadow-2xl p-1">
                <div className="h-full bg-gradient-to-r from-yellow-400 via-indigo-400 to-purple-400 w-full animate-progress-strip rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {appState === AppState.READING_STORY && story && (
          <div className="space-y-8 animate-in fade-in duration-1000">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4">
              <button 
                onClick={savedStories.length > 0 ? openLibrary : reset}
                className="flex items-center gap-2 bg-white text-indigo-500 px-6 py-3 rounded-2xl font-kids text-xl shadow-lg hover:scale-105 active:scale-95 transition-all border-b-4 border-indigo-50"
              >
                <span>⬅️</span>
                <span>{savedStories.length > 0 ? 'Back to Library' : 'Back to Home'}</span>
              </button>
              
              <h2 className="text-4xl md:text-5xl text-center text-indigo-950 font-kids drop-shadow-sm">{story.title}</h2>
              
              <button 
                onClick={handleSaveStory}
                disabled={isSaved}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-kids text-xl shadow-lg hover:scale-105 active:scale-95 transition-all border-b-4 
                  ${isSaved ? 'bg-green-100 text-green-600 border-green-200 cursor-default' : 'bg-yellow-400 text-indigo-900 border-yellow-600'}
                `}
              >
                <span>{isSaved ? '✅' : '🌟'}</span>
                <span>{isSaved ? 'Saved!' : 'Save Story'}</span>
              </button>
            </div>
            
            <div 
              key={currentPage}
              className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center bg-white p-12 rounded-[5rem] shadow-2xl border-b-[16px] border-indigo-50/50 relative 
                animate-in fade-in duration-500
                ${direction === 'forward' ? 'slide-in-from-right-12' : 'slide-in-from-left-12'}
                zoom-in-95
              `}
            >
              <div className="aspect-square bg-indigo-50 rounded-[4rem] overflow-hidden relative group shadow-inner border-4 border-indigo-50">
                {story.pages[currentPage].imageUrl ? (
                  <img 
                    src={story.pages[currentPage].imageUrl} 
                    alt="Story illustration" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <span className="text-9xl grayscale group-hover:grayscale-0 transition-all duration-700 cursor-help animate-float">🖼️</span>
                    <p className="text-indigo-300 font-bold font-kids text-3xl">Click "Paint Magic"!</p>
                  </div>
                )}
                
                {loadingMsg && loadingMsg.includes('painting') && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex items-center justify-center z-10">
                     <div className="text-center">
                        <div className="text-8xl animate-spin mb-6">🎨</div>
                        <p className="text-indigo-900 font-bold font-kids text-3xl">Painting Magic...</p>
                     </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col h-full justify-between space-y-8">
                <div className="space-y-6">
                  <div className="inline-block px-6 py-2 rounded-full bg-indigo-500 text-white text-lg font-kids shadow-lg">
                    Page {currentPage + 1} of {story.pages.length}
                  </div>
                  <p className="text-3xl text-indigo-950 leading-relaxed font-bold">
                    {story.pages[currentPage].text}
                  </p>
                </div>
                
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <button 
                      onClick={handleReadAloud}
                      disabled={isAudioPlaying}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 text-indigo-900 font-kids text-2xl py-6 px-10 rounded-[2.5rem] shadow-xl transition-all flex items-center justify-center gap-4 transform active:scale-95 border-b-8 border-yellow-600 active:border-b-0"
                    >
                      <span className="text-4xl">{isAudioPlaying ? '🗣️' : '🔊'}</span>
                      <span>{isAudioPlaying ? 'Reading...' : 'Hear Story'}</span>
                    </button>
                    
                    <button 
                      onClick={handleGenerateIllustration}
                      className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-kids text-2xl py-6 px-10 rounded-[2.5rem] shadow-xl transition-all flex items-center justify-center gap-4 transform active:scale-95 border-b-8 border-indigo-800 active:border-b-0"
                    >
                      <span className="text-4xl">✨</span>
                      <span>Paint Magic</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 max-w-2xl mx-auto w-full">
              <button 
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="p-8 rounded-[3rem] bg-white shadow-2xl text-indigo-500 disabled:opacity-20 hover:scale-110 active:scale-90 transition-all group border-b-8 border-indigo-100 active:border-b-0"
                aria-label="Previous Page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex gap-6">
                {story.pages.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      setDirection(i > currentPage ? 'forward' : 'backward');
                      setCurrentPage(i);
                    }}
                    className={`h-6 rounded-full transition-all duration-500 shadow-xl ${i === currentPage ? 'bg-indigo-500 w-20' : 'bg-white w-6 hover:bg-indigo-100'}`}
                  />
                ))}
              </div>

              <button 
                onClick={goToNextPage}
                disabled={currentPage === story.pages.length - 1}
                className="p-8 rounded-[3rem] bg-white shadow-2xl text-indigo-500 disabled:opacity-20 hover:scale-110 active:scale-90 transition-all group border-b-8 border-indigo-100 active:border-b-0"
                aria-label="Next Page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes progress-strip {
          from { background-position: 0 0; }
          to { background-position: 50px 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .animate-progress-strip {
          background-size: 50px 50px;
          animation: progress-strip 1s linear infinite;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
