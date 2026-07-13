import { useChatStore } from "../store/useChatStore.js";
import { theme } from "../theme.js";
import { useEffect, useState } from "@lynx-js/react";

// TypeScript declaration for our Native Module
interface BestraNative {
  playAudio: (base64Data: string) => void;
  openUrl: (url: string) => void;
  testNative?: (callback: (status: string, data: string) => void) => void;
}

export function ChatContainer() {
  const { messages, getMessages, selectedUser, clearMessages } = useChatStore();
  const [scrollTop, setScrollTop] = useState(0);

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
        return lynx.requireModule("BestraNative") as BestraNative;
      } catch (e) {
        console.error("lynx.requireModule failed:", e);
      }
    }
    return null;
  };

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser.id);
    }
  }, [selectedUser]);

  // Auto-scroll logic
  useEffect(() => {
    if (messages.length > 0) {
      setScrollTop(scrollTop === 100000 ? 100000.1 : 100000);
    }
  }, [messages]);

  if (!selectedUser) return <view />;

  const handlePlayAudio = (voiceData: string) => {
    const native = getNative();
    if (native) {
      native.playAudio(voiceData);
    } else {
      console.log("Play audio requested (Mock Mode)");
    }
  };

  const handleOpenMaps = (coords: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${coords}`;
    const native = getNative();
    if (native) {
      native.openUrl(url);
    } else {
      console.log("Open maps requested:", url);
    }
  };

  return (
    <view style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      {/* SCROLL AREA */}
      <scroll-view 
        scroll-y="true" 
        scroll-top={scrollTop}
        style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      >
        <view style={{ padding: '16px', paddingBottom: '40px' }}>
          {messages.map((message) => {
            const isSentByMe = message.senderId !== selectedUser.id;
            return (
              <view
                key={message.id}
                style={{
                  alignSelf: isSentByMe ? 'flex-end' : 'flex-start',
                  backgroundColor: isSentByMe ? theme.colors.messageSent : theme.colors.messageReceived,
                  padding: '12px',
                  borderRadius: '12px',
                  marginBottom: '10px',
                  maxWidth: '80%',
                  display: 'flex',
                  minWidth: message.location ? '200px' : '0'
                }}
              >
                <view style={{ flexDirection: 'row', alignItems: 'center', display: 'flex' }}>
                  {message.text && <text style={{ color: theme.colors.text, fontSize: '16px' }}>{message.text}</text>}
                  {message.isEncrypted && <text style={{ fontSize: '10px', marginLeft: '4px' }}>🔒</text>}
                </view>
                {message.image && (
                  <image 
                    src={message.image} 
                    mode="aspectFill"
                    style={{ width: '220px', height: '160px', borderRadius: '8px', marginTop: '8px' }} 
                  />
                )}
                {message.voice && (
                  <view 
                    bindtap={() => handlePlayAudio(message.voice!)}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center',
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      borderRadius: '8px',
                      display: 'flex'
                    }}
                  >
                    <text style={{ fontSize: '14px' }}>🎤 Play Voice Note</text>
                  </view>
                )}
                {message.location && (
                  <view 
                    style={{ 
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: isSentByMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      borderWidth: '1px',
                      borderColor: 'rgba(0,0,0,0.05)'
                    }}
                  >
                    <view style={{ flexDirection: 'row', alignItems: 'center', marginBottom: '8px' }}>
                      <view style={{ 
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '5px', 
                        backgroundColor: '#3B82F6',
                        marginRight: '8px'
                      }} />
                      <text style={{ fontWeight: 'bold', fontSize: '14px', color: theme.colors.text }}>Shared Location</text>
                    </view>
                    <view 
                      bindtap={() => handleOpenMaps(message.location!)}
                      style={{
                        backgroundColor: theme.colors.primary,
                        padding: '8px 24px',
                        borderRadius: '20px',
                        // @ts-ignore
                        elevation: '2px'
                      }}
                    >
                      <text style={{ color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>Open in Maps</text>
                    </view>
                  </view>
                )}
              </view>
            );
          })}
        </view>
      </scroll-view>
    </view>
  );
}
