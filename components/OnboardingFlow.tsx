
import React, { useState } from 'react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    emoji: "🧠",
    title: "You're the Boss!",
    text: "Think of anything! A pizza that talks? A cat in space? Just type it, and we make a story!",
    bgColor: "bg-indigo-50",
    iconColor: "bg-indigo-500",
    accent: "✨"
  },
  {
    emoji: "🎨",
    title: "Magic Painting!",
    text: "Sparkle the Dragon uses magic paint to make pictures for every single page of your story!",
    bgColor: "bg-yellow-50",
    iconColor: "bg-yellow-400",
    accent: "🌈"
  },
  {
    emoji: "🔊",
    title: "Story Time!",
    text: "Sit back and listen! Sparkle will read your new story out loud with a friendly voice!",
    bgColor: "bg-purple-50",
    iconColor: "bg-purple-500",
    accent: "🐉"
  }
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const next = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-1000 ${slide.bgColor}`}>
      <div className="max-w-xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="relative inline-block">
          <div className={`${slide.iconColor} w-48 h-48 md:w-64 md:h-64 rounded-[4rem] shadow-2xl flex items-center justify-center mx-auto transform hover:rotate-6 transition-transform`}>
            <span className="text-[8rem] md:text-[10rem]">{slide.emoji}</span>
          </div>
          <div className="absolute -top-6 -right-6 text-6xl animate-bounce">{slide.accent}</div>
        </div>

        <div className="space-y-6">
          <h2 className="text-5xl md:text-6xl text-indigo-950 font-kids leading-tight">
            {slide.title}
          </h2>
          <p className="text-xl md:text-2xl text-indigo-600 font-bold leading-relaxed px-4">
            {slide.text}
          </p>
        </div>

        <div className="flex flex-col items-center gap-8">
          <button 
            onClick={next}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-kids text-2xl px-16 py-6 rounded-[2.5rem] shadow-xl transition-all transform hover:scale-105 active:scale-95 border-b-8 border-indigo-900 active:border-b-0"
          >
            {currentSlide === SLIDES.length - 1 ? "Let's Go! 🚀" : "Cool! What's Next? ➡"}
          </button>

          <div className="flex gap-4">
            {SLIDES.map((_, i) => (
              <div 
                key={i} 
                className={`h-4 rounded-full transition-all duration-500 ${i === currentSlide ? 'bg-indigo-500 w-12' : 'bg-indigo-200 w-4'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
