export interface Message {
  id: string;
  chatId: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: number;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string; // color hex for avatar circle
  lastMessage: string;
  lastTimestamp: number;
  createdAt: number;
}
