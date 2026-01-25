
export interface Page {
  text: string;
  illustrationPrompt: string;
  imageUrl?: string;
  audioData?: string;
}

export interface Story {
  title: string;
  pages: Page[];
}

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export type ImageSize = '1K' | '2K' | '4K';

export enum AppState {
  INTRO = 'INTRO',
  ONBOARDING = 'ONBOARDING',
  IDLE = 'IDLE',
  LIBRARY = 'LIBRARY',
  GENERATING_STORY = 'GENERATING_STORY',
  READING_STORY = 'READING_STORY',
  CHAT = 'CHAT',
  ABOUT = 'ABOUT'
}
