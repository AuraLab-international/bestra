import { useEffect, useState } from '@lynx-js/react'
import './App.css'
import bestraLogo from '../../static/Bestra-logo.webp'
import { Sidebar } from './components/Sidebar.js'
import { ChatContainer } from './components/ChatContainer.js'
import { MessageInput } from './components/MessageInput.js'
import { useChatStore } from './store/useChatStore.js'
import { useCryptoStore } from './store/useCryptoStore.js'
import { theme } from './theme.js'

export function App() {
  const { selectedUser, getUsers, setSelectedUser } = useChatStore()
  const { initializeKeys } = useCryptoStore()
  const [bridgeStatus, setBridgeStatus] = useState("Checking...")
  const [nativeError, setNativeError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        await getUsers()
        await initializeKeys()
      } catch (err: any) {
        setFetchError(err.message || 'Server error')
      }
    }
    init()

    // Try both NativeModules (standard) and lynx.requireModule (legacy/alternative)
    // @ts-ignore
    const getNativeModule = () => {
      // 1. Try standard NativeModules global
      // @ts-ignore
      if (typeof NativeModules !== 'undefined' && NativeModules.BestraNative) {
        console.log("Found BestraNative via global NativeModules");
        // @ts-ignore
        return NativeModules.BestraNative;
      }
      
      // 2. Try lynx.requireModule ONLY if we are fairly sure it won't trigger a fetch error
      // In some versions of Lynx, requireModule for a missing module triggers a load attempt.
      // @ts-ignore
      if (typeof lynx !== 'undefined' && lynx.requireModule) {
        try {
          // Some environments expose NativeModules list, we could check here but let's just try-catch
          const native = lynx.requireModule("BestraNative");
          if (native) return native;
        } catch (e) {
          console.error("lynx.requireModule failed:", e);
        }
      }
      return null;
    };

    const native = getNativeModule();
    if (native) {
      setBridgeStatus("Ready")
      // Auto-test the bridge
      if (native.testNative) {
        native.testNative({}, (status: string, data: string) => {
          console.log("Auto-test:", status, data)
          if (status === "success") {
            setBridgeStatus("Verified")
          } else {
            setBridgeStatus("Failed: " + data)
          }
        })
      }
    } else {
      setBridgeStatus("Module Missing")
    }
  }, [])

  return (
    <view style={{ 
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 1. NAVBAR & STATUS (80px) */}
      <view style={{
        backgroundColor: '#fff',
        borderBottomWidth: '1px',
        borderBottomColor: theme.colors.border,
        display: 'flex',
        flexDirection: 'column',
        width: '100%'
      }}>
        {/* BRIDGE STATUS BAR - Automated */}
        <view style={{ 
          backgroundColor: bridgeStatus === 'Verified' ? '#10B981' : (bridgeStatus === 'Ready' ? '#3B82F6' : '#EF4444'), 
          padding: '4px 12px',
          flexDirection: 'row',
          justifyContent: 'center'
        }}>
          <text style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
            System Status: {bridgeStatus} {nativeError ? `(${nativeError})` : ''}
          </text>
        </view>

        <view style={{
          height: '60px',
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: '12px',
          paddingRight: '12px',
          display: 'flex',
          width: '100%'
        }}>
          <view style={{ flexShrink: 0 }}>
            {selectedUser ? (
              <view bindtap={() => setSelectedUser(null)} style={{ 
                padding: '8px',
                marginRight: '8px'
              }}>
                 <text style={{ fontSize: '24px', color: theme.colors.primary }}>←</text>
              </view>
            ) : (
              <image src={bestraLogo} style={{ width: '32px', height: '32px', marginRight: '12px' }} />
            )}
          </view>
          
          <view style={{ flex: 1, minWidth: 0 }}>
            <text style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: theme.colors.text,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}>
              {selectedUser ? selectedUser.fullName : 'Bestra'}
            </text>
          </view>

          {selectedUser && (
            <view style={{ flexShrink: 0 }}>
              <view bindtap={() => useChatStore.getState().clearMessages(selectedUser.id)} style={{ padding: '8px' }}>
                <text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '14px' }}>Clear</text>
              </view>
            </view>
          )}
        </view>
      </view>

      {/* 2. MAIN CONTENT (Flexible) */}
      <view style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {fetchError ? (
          <view style={{ flex: 1, alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
            <text style={{ color: 'red' }}>{fetchError}</text>
          </view>
        ) : !selectedUser ? (
          <Sidebar />
        ) : (
          <view style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
             <ChatContainer />
             <MessageInput />
          </view>
        )}
      </view>
    </view>
  )
}
