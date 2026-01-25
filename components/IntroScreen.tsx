
import React from 'react';

interface IntroScreenProps {
  onStart: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-50 via-white to-indigo-100 p-6 text-center overflow-hidden">
      <div className="relative group cursor-pointer animate-in zoom-in duration-1000" onClick={onStart}>
        {/* Animated background glows */}
        <div className="absolute inset-0 bg-yellow-400 blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
        <div className="absolute -top-20 -left-20 text-6xl animate-pulse">✨</div>
        <div className="absolute -bottom-10 -right-20 text-6xl animate-pulse delay-700">💫</div>
        
        <div className="bg-yellow-400 w-48 h-48 md:w-64 md:h-64 rounded-[4rem] shadow-[0_30px_60px_-15px_rgba(251,191,36,0.5)] flex items-center justify-center mx-auto mb-12 transform -rotate-6 animate-float transition-transform group-hover:rotate-0 group-active:scale-95">
          <span className="text-8xl md:text-9xl">📖</span>
        </div>
        
        <div className="space-y-6 relative z-10">
          <h1 className="text-6xl md:text-8xl text-indigo-950 font-kids tracking-tighter drop-shadow-2xl">
            Magic Storybook
          </h1>
          <p className="text-2xl md:text-3xl text-indigo-500 font-bold max-w-lg mx-auto leading-relaxed px-4">
            Where your <span className="text-yellow-500 underline decoration-indigo-200">wildest dreams</span> become real adventures! 🌈
          </p>
        </div>
      </div>

      <button 
        onClick={onStart}
        className="mt-16 bg-indigo-500 hover:bg-indigo-600 text-white font-kids text-3xl px-16 py-8 rounded-[3rem] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] transition-all transform hover:scale-110 active:scale-95 border-b-[12px] border-indigo-800 active:border-b-0 flex items-center gap-4 group"
      >
        <span>Start the Magic</span>
        <span className="group-hover:translate-x-2 transition-transform">🚀</span>
      </button>

      <div className="fixed bottom-10 text-indigo-300 font-bold uppercase tracking-[0.4em] text-sm">
        Sparkle is waiting for you
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-30px) rotate(2deg); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
