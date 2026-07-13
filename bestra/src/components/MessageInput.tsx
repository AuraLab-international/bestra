import { useState } from "@lynx-js/react";
import { useChatStore } from "../store/useChatStore.js";
import { theme } from "../theme.js";

// TypeScript declaration for our Native Module
interface BestraNative {
  openGallery: (params: any, callback: (status: string, data: string) => void) => void;
  playAudio: (base64Data: string) => void;
  getCurrentLocation: (params: any, callback: (status: string, data: string) => void) => void;
  startRecording: (params: any, callback: (status: string, data: string) => void) => void;
  stopRecording: (params: any, callback: (status: string, data: string) => void) => void;
  showToast: (message: string) => void;
}

export function MessageInput() {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const { sendMessage, selectedUser } = useChatStore();

  const getNative = () => {
    // @ts-ignore
    if (typeof NativeModules !== 'undefined' && NativeModules.BestraNative) {
      // @ts-ignore
      return NativeModules.BestraNative as BestraNative;
    }
    // @ts-ignore
    if (typeof lynx !== 'undefined' && lynx.requireModule) {
      try {
        // @ts-ignore
        const module = lynx.requireModule("BestraNative") as BestraNative;
        if (!module) console.error("BestraNative module not found via requireModule");
        return module;
      } catch (e) {
        console.error("Error requiring BestraNative:", e);
      }
    }
    return null;
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedUser) return;
    try {
      await sendMessage({ text: text.trim() });
      setText("");
    } catch (e: any) {
      const native = getNative();
      if (native) native.showToast("Send failed: " + e.message);
      else console.error("Send failed:", e);
    }
  };

  const handleLocationSend = async () => {
    if (!selectedUser) return;
    const native = getNative();
    
    if (native) {
      native.getCurrentLocation({}, (status, data) => {
        if (status === "success") {
           sendMessage({ location: data });
        } else {
           native.showToast(`Location Error: ${data}`);
           // @ts-ignore
           if (typeof alert === 'function') alert(`Location Error: ${data}`);
        }
      });
    } else {
      console.warn("Location sharing requires the native app.");
      // @ts-ignore
      if (typeof alert === 'function') alert("Bridge Error: Native module not found.");
    }
  };

  const handleImageSelect = async () => {
    if (!selectedUser) return;
    const native = getNative();

    if (native) {
      native.openGallery({}, (status, data) => {
        if (status === "success") {
          sendMessage({ image: data });
        } else {
          native.showToast(`Gallery Error: ${data}`);
          // @ts-ignore
          if (typeof alert === 'function') alert(`Gallery Error: ${data}`);
        }
      });
    } else {
      console.warn("Image selection requires the native app.");
      // @ts-ignore
      if (typeof alert === 'function') alert("Bridge Error: Native module not found.");
    }
  };

  const startRecording = () => {
    if (!selectedUser) return;
    const native = getNative();
    if (native) {
      native.startRecording({}, (status, data) => {
        if (status === "success") {
          setIsRecording(true);
        } else {
          native.showToast(`Mic Error: ${data}`);
          // @ts-ignore
          if (typeof alert === 'function') alert(`Mic Error: ${data}`);
        }
      });
    } else {
      // @ts-ignore
      if (typeof alert === 'function') alert("Bridge Error: Native module not found.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !selectedUser) return;
    const native = getNative();
    if (native) {
      native.stopRecording({}, (status, data) => {
        setIsRecording(false);
        if (status === "success") {
          sendMessage({ voice: data });
        } else {
          native.showToast(`Recording Error: ${data}`);
        }
      });
    }
  };

  return (
    <view style={{
      height: '60px',
      padding: '8px',
      borderTopWidth: '1px',
      borderTopColor: theme.colors.border,
      backgroundColor: '#fff',
      flexDirection: 'row',
      alignItems: 'center',
      display: 'flex',
      width: '100%'
    }}>
      {/* 1. Image Button (Fixed 40px) */}
      <view
        bindtap={handleImageSelect}
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          marginRight: '8px'
        }}
      >
        <text style={{ fontSize: '18px' }}>🖼️</text>
      </view>

      {/* 2. Mic Button (Fixed 40px) */}
      <view
        bindtouchstart={startRecording}
        bindtouchend={stopRecording}
        style={{
          backgroundColor: isRecording ? '#EF4444' : theme.colors.backgroundSecondary,
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          marginRight: '8px'
        }}
      >
        <text style={{ fontSize: '18px' }}>{isRecording ? '🛑' : '🎤'}</text>
      </view>

      {/* 2.5 Location Button (Fixed 40px) */}
      <view
        bindtap={handleLocationSend}
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          marginRight: '8px'
        }}
      >
        <text style={{ fontSize: '18px' }}>📍</text>
      </view>

      {/* 3. Input Field (Fills the remaining space) */}
      <view style={{ flex: 1, display: 'flex' }}>
        <input
          style={{
            height: '40px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            paddingLeft: '12px',
            paddingRight: '12px',
            fontSize: '16px',
            width: '100%'
          }}
          placeholder={isRecording ? "Rec..." : "Message"}
          // @ts-ignore
          value={text}
          bindinput={(e: any) => setText(e.detail.value)}
        />
      </view>

      {/* 4. Send Button (Fixed 64px) */}
      <view
        bindtap={handleSend}
        style={{
          marginLeft: '8px',
          backgroundColor: theme.colors.primary,
          width: '64px',
          borderRadius: '8px',
          height: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex'
        }}
      >
        <text style={{ fontWeight: 'bold', color: theme.colors.text, fontSize: '14px' }}>Send</text>
      </view>
    </view>
  );
}
