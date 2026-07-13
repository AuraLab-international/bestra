import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { useCryptoStore } from "./useCryptoStore";

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  profilePic?: string;
  publicKey?: string;
}

interface Message {
  id: string;
  text?: string;
  image?: string;
  voice?: string;
  location?: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  isEncrypted?: boolean;
}

interface ChatState {
  messages: Message[];
  users: User[];
  selectedUser: User | null;
  isUsersLoading: boolean;
  isMessagesLoading: boolean;

  getUsers: (query?: string) => Promise<void>;
  getMessages: (userId: string) => Promise<void>;
  sendMessage: (messageData: { text?: string; image?: string; voice?: string; location?: string }) => Promise<void>;
  clearMessages: (userId: string) => Promise<void>;
  setSelectedUser: (user: User | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async (query?: string) => {
    set({ isUsersLoading: true });
    try {
      const endpoint = query ? `/messages/users?search=${encodeURIComponent(query)}` : "/messages/users";
      const data = await apiFetch(endpoint);
      set({ users: data });
    } catch (error) {
      console.error("Error in getUsers:", error);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId: string) => {
    set({ isMessagesLoading: true });
    try {
      const data = await apiFetch(`/messages/${userId}`);
      
      const { decryptMessage } = useCryptoStore.getState();
      const decryptedMessages = await Promise.all(data.map(async (msg: Message) => {
        if (msg.text && msg.text.startsWith("enc:")) {
          const decryptedText = await decryptMessage(msg.text.replace("enc:", ""));
          return { ...msg, text: decryptedText, isEncrypted: true };
        }
        return msg;
      }));

      set({ messages: decryptedMessages });
    } catch (error) {
      console.error("Error in getMessages:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    if (!selectedUser) return;

    let payload = { ...messageData };

    if (payload.text && selectedUser.publicKey) {
      const { encryptMessage } = useCryptoStore.getState();
      const encryptedText = await encryptMessage(payload.text, selectedUser.publicKey);
      payload.text = `enc:${encryptedText}`;
    }

    try {
      const data = await apiFetch(`/messages/send/${selectedUser.id}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Spread both the server response and the original message data
      // to ensure we don't lose media fields if the server returns a partial object
      const displayMessage = { 
        ...data, 
        ...messageData, 
        isEncrypted: !!selectedUser.publicKey,
        id: data.id || `msg-${Date.now()}` // Ensure we have an ID for the key
      };
      set({ messages: [...messages, displayMessage] });
    } catch (error) {
      console.error("Error in sendMessage, adding to UI anyway (mock mode):", error);
      
      // FALLBACK: Add to UI even if backend is unreachable so user can "test" the native module output
      const fallbackMessage: Message = {
        id: `mock-${Date.now()}`,
        ...messageData,
        senderId: 'user_2t4v_dev_test', // current mock user
        receiverId: selectedUser.id,
        createdAt: new Date().toISOString(),
        isEncrypted: !!selectedUser.publicKey
      };
      
      set({ messages: [...messages, fallbackMessage] });
    }
  },

  clearMessages: async (userId: string) => {
    try {
      await apiFetch(`/messages/clear/${userId}`, { method: "DELETE" });
      set({ messages: [] });
    } catch (error) {
      console.error("Error in clearMessages:", error);
    }
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
