
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Story, Page, ImageSize, Message } from "../types.ts";

// Fix: Always use process.env.API_KEY directly for initialization per guidelines.
export const generateStory = async (prompt: string): Promise<Story> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

  try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    throw new Error("I couldn't write that story! Try something else.");
  }
};

// Fix: Support both gemini-2.5-flash-image and gemini-3-pro-image-preview based on requested resolution.
// gemini-3-pro-image-preview is used for 2K or 4K requests.
export const generateIllustration = async (prompt: string, size: ImageSize): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isHighQuality = size === '2K' || size === '4K';
  const modelName = isHighQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          text: `A magical, colorful, kid-friendly digital illustration of: ${prompt}. Studio Ghibli style, vibrant, high detail.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        ...(isHighQuality ? { imageSize: size } : {})
      }
    },
  });

  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("No image data found in response");
};

// Fix: Always use process.env.API_KEY directly for initialization.
export const generateSpeech = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this story page with a warm, friendly, storytelling voice: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data generated");
  return base64Audio;
};

// Fix: Implement missing chatWithAi function to fix module export error in ChatBot.tsx
export const chatWithAi = async (message: string, history: Message[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: "You are Sparkle the Dragon, a friendly and magical dragon who loves telling stories and helping kids. Your tone is playful, encouraging, and full of wonder. Use lots of sparkle emojis! ✨🐉",
    },
    history: history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }))
  });

  const response = await chat.sendMessage({ message });
  return response.text || "Oops! My dragon fire sizzled. Try again! 🔥";
};
