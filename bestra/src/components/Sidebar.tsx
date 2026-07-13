import { useState } from "@lynx-js/react";
import { useChatStore } from "../store/useChatStore.js";
import { theme } from "../theme.js";

export function Sidebar() {
  const { users, setSelectedUser, selectedUser, getUsers } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    getUsers(searchQuery);
  };

  return (
    <view style={{
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.background,
      borderRightWidth: '1px',
      borderRightColor: theme.colors.border
    }}>
      <view style={{ padding: theme.spacing.md }}>
        <text style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: theme.colors.text,
          marginBottom: theme.spacing.md
        }}>Contacts</text>

        <view style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: theme.borderRadius.md,
          paddingLeft: theme.spacing.sm,
          paddingRight: theme.spacing.sm,
          height: '40px'
        }}>
          <input
            placeholder="Search username#id"
            // @ts-ignore
            value={searchQuery}
            bindinput={(e: any) => setSearchQuery(e.detail.value)}
            style={{
              flex: 1,
              color: theme.colors.text,
              fontSize: '14px',
              backgroundColor: 'transparent',
              border: 'none'
            }}
          />
          <view bindtap={handleSearch} style={{ padding: theme.spacing.xs }}>
            <text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Find</text>
          </view>
        </view>
      </view>

      <view style={{ flex: 1 }}>
        {users.length === 0 && (
          <view style={{ padding: theme.spacing.md, alignItems: 'center' }}>
            <text style={{ color: theme.colors.textSecondary, fontSize: '14px', textAlign: 'center' }}>
              Search for users using their full tag (e.g. name#2t4v)
            </text>
          </view>
        )}
        {users.map((user) => (
          <view
            key={user.id}
            bindtap={() => setSelectedUser(user)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing.md,
              backgroundColor: selectedUser?.id === user.id ? theme.colors.backgroundSecondary : 'transparent'
            }}
          >
            <view style={{
              width: '48px',
              height: '48px',
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.border,
              overflow: 'hidden'
            }}>
              {user.profilePic && <image src={user.profilePic} style={{ width: '48px', height: '48px' }} />}
            </view>
            <view style={{ marginLeft: theme.spacing.md }}>
              <text style={{
                fontSize: '16px',
                fontWeight: '500',
                color: theme.colors.text
              }}>{user.fullName}</text>
              <text style={{
                fontSize: '12px',
                color: theme.colors.textSecondary
              }}>@{user.username}#{user.id.slice(-4)}</text>
            </view>
          </view>
        ))}
      </view>
    </view>
  );
}
