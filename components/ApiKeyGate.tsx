
import React, { useEffect, useState } from 'react';

interface ApiKeyGateProps {
  onValidated: () => void;
}

declare global {
  // Define AIStudio interface to match the environment's expected type structure
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  // Use declare var for the global aistudio object to avoid modifiers conflict with potential existing declarations.
  // In TypeScript, 'var' inside 'declare global' makes the variable available globally and on the 'window' object.
  var aistudio: AIStudio;
}

export const ApiKeyGate: React.FC<ApiKeyGateProps> = ({ onValidated }) => {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      // Check if the API key selection utility is available and active
      const selected = await window.aistudio.hasSelectedApiKey();
      if (selected) {
        setHasKey(true);
        onValidated();
      }
    };
    checkKey();
  }, [onValidated]);

  const handleOpenSelector = async () => {
    // Trigger the selector dialog provided by the platform
    await window.aistudio.openSelectKey();
    // Assuming success after trigger per instructions to avoid race conditions with state updates
    setHasKey(true);
    onValidated();
  };

  if (hasKey) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border-4 border-purple-200">
        <div className="text-6xl mb-4">🔑</div>
        <h2 className="text-2xl font-bold text-purple-600 mb-4 font-kids">Unlock Pro Illustrations!</h2>
        <p className="text-gray-600 mb-6 font-medium">
          To use our high-quality Gemini 3 Pro image generation, you need to select your own API key.
        </p>
        <button
          onClick={handleOpenSelector}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 mb-4"
        >
          Select My API Key
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-indigo-400 hover:underline text-sm font-medium"
        >
          Learn more about billing
        </a>
      </div>
    </div>
  );
};
