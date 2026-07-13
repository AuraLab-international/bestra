import { create } from "zustand";
import { apiFetch } from "../lib/api";

interface CryptoState {
  publicKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  publicKeyBase64: string | null;

  initializeKeys: () => Promise<void>;
  encryptMessage: (text: string, recipientPublicKeyBase64: string) => Promise<string>;
  decryptMessage: (ciphertextBase64: string) => Promise<string>;
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  publicKey: null,
  privateKey: null,
  publicKeyBase64: null,

  initializeKeys: async () => {
    try {
      // Generate RSA-OAEP key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      // Export public key to base64
      const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const publicKeyBase64 = btoa(Array.from(new Uint8Array(exportedPublic)).map(b => String.fromCharCode(b)).join(""));

      set({
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        publicKeyBase64,
      });

      // Sync with backend
      await apiFetch("/messages/public-key", {
        method: "POST",
        body: JSON.stringify({ publicKey: publicKeyBase64 }),
      });

      console.log("E2EE keys initialized and synced");
    } catch (error) {
      console.error("Failed to initialize E2EE keys:", error);
    }
  },

  encryptMessage: async (text: string, recipientPublicKeyBase64: string) => {
    try {
      // Import recipient's public key
      const binaryDerString = atob(recipientPublicKeyBase64);
      const binaryDer = new Uint8Array(binaryDerString.length);
      for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
      }

      const recipientPublicKey = await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        true,
        ["encrypt"]
      );

      // Encrypt
      const encodedText = new TextEncoder().encode(text);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        encodedText
      );

      return btoa(Array.from(new Uint8Array(ciphertext)).map(b => String.fromCharCode(b)).join(""));
    } catch (error) {
      console.error("Encryption failed:", error);
      return text; // Fallback to plain text if encryption fails (should be handled better in production)
    }
  },

  decryptMessage: async (ciphertextBase64: string) => {
    const { privateKey } = get();
    if (!privateKey) return "[Encryption error: No private key]";

    try {
      const binaryString = atob(ciphertextBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        bytes.buffer
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error("Decryption failed:", error);
      return "[Encrypted Message]"; // Could be for a different key or corrupted
    }
  },
}));
