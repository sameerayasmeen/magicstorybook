
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Story, Page, ImageSize } from "../types.ts";

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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    throw new Error("Failed to parse story generation result.");
  }
};

export const generateIllustration = async (prompt: string, size: ImageSize): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `A magical, colorful, kid-friendly digital illustration of: ${prompt}. Studio Ghibli style, vibrant, high detail.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data found in response");
};

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

export const chatWithAi = async (message: string, history: {role: 'user' | 'model', content: string}[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: "You are Sparkle, a friendly magical storytelling dragon who loves helping kids. You are enthusiastic, use emojis, and answer questions simply.",
    },
  });

  const response = await chat.sendMessage({ message });
  return response.text || "Oops, I forgot what I was saying! 🐉";
};
