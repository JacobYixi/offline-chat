import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Keyboard,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeSearchParams, useSafeRouter } from '@/hooks/useSafeRouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AVATAR_COLORS } from '@/utils/storage';

interface ChatUser {
  id: string;
  nickname: string;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'group' | 'private' | 'system';
  msgType?: string;
  targetId?: string;
  targetName?: string;
  timestamp: number;
}

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';
const WS_BASE = API_BASE.replace('http', 'ws');

// Generate a stable user ID per session
function getSessionUserId(): string {
  let id = '';
  try {
    // Use a simple approach - generate once and store in module scope
    if (!sessionUserId) {
      sessionUserId = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    }
    id = sessionUserId;
  } catch {
    id = 'user_' + Date.now();
  }
  return id;
}
let sessionUserId = '';

export default function ChatRoomScreen() {
  const params = useSafeSearchParams<{
    roomCode: string;
    roomName: string;
    roomId: string;
    nickname: string;
    isCreator: boolean;
  }>();
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const roomCode = (params.roomCode as string) || '';
  const roomName = (params.roomName as string) || '聊天室';
  const roomId = (params.roomId as string) || '';
  const nickname = (params.nickname as string) || '匿名';
  const isCreator = params.isCreator === true || params.isCreator === ('true' as unknown);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [inputText, setInputText] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [privateChatTarget, setPrivateChatTarget] = useState<ChatUser | null>(null);
  const [userId, setUserId] = useState(() => getSessionUserId());
  const [hasJoined, setHasJoined] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const userIdRef = useRef(userId);

  // Keep ref in sync
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Handle WebSocket messages
  const handleWsMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'joined': {
        const roomData = data.room as Record<string, unknown>;
        const msgs = (data.messages as ChatMsg[]) || [];
        const userList = (data.users as ChatUser[]) || [];
        const myId = data.userId as string;
        setUserId(myId);
        userIdRef.current = myId;
        setMessages(msgs.map(normalizeMessage));
        setUsers(userList);
        setHasJoined(true);
        void roomData;
        void roomCode;
        break;
      }
      case 'message': {
        const msg = normalizeMessage(data.message as ChatMsg);
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        break;
      }
      case 'users_update': {
        setUsers((data.users as ChatUser[]) || []);
        break;
      }
      case 'error': {
        Alert.alert('错误', (data.message as string) || '发生错误');
        break;
      }
      default:
        break;
    }
  }, []);

  const { send, connected } = useWebSocket({
    url: `${WS_BASE}/ws`,
    onMessage: handleWsMessage,
    autoReconnect: true,
    reconnectInterval: 3000,
  });

  // Join room when connected and userId is ready
  useEffect(() => {
    if (connected && userId && roomCode && !hasJoined) {
      send({
        type: 'join',
        userId,
        nickname,
        roomCode,
      });
    }
  }, [connected, userId, roomCode, nickname, hasJoined, send]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    if (privateChatTarget) {
      send({
        type: 'send_message',
        text,
        msgType: 'private',
        targetId: privateChatTarget.id,
        targetName: privateChatTarget.nickname,
      });
    } else {
      send({
        type: 'send_message',
        text,
        msgType: 'group',
      });
    }
    setInputText('');
    Keyboard.dismiss();
  };

  const handleStartPrivateChat = (user: ChatUser) => {
    if (user.id === userIdRef.current) {
      setPrivateChatTarget(null);
      setShowUsers(false);
      return;
    }
    setPrivateChatTarget(user);
    setShowUsers(false);
  };

  const handleLeaveRoom = () => {
    router.back();
  };

  const getAvatarColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const formatMsgTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const renderMessage = ({ item }: { item: ChatMsg }) => {
    // System message
    if (item.type === 'system' || item.msgType === 'system') {
      return (
        <View style={styles.systemMsgContainer}>
          <Text style={styles.systemMsgText}>{item.text}</Text>
        </View>
      );
    }

    const isMe = item.senderId === userId;
    const isPrivate = item.type === 'private';

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={[styles.msgAvatar, { backgroundColor: getAvatarColor(item.senderName) }]}>
            <Text style={styles.msgAvatarText}>{item.senderName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.messageBubbleWrap, isMe && styles.messageBubbleWrapMe]}>
          {!isMe && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <View style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.otherBubble,
            isPrivate && (isMe ? styles.myPrivateBubble : styles.otherPrivateBubble),
          ]}>
            {isPrivate && (
              <View style={styles.privateTag}>
                <FontAwesome6 name="lock" size={8} color={isMe ? 'rgba(255,255,255,0.7)' : '#6C63FF'} />
                <Text style={[styles.privateTagText, { color: isMe ? 'rgba(255,255,255,0.7)' : '#6C63FF' }]}>
                  私信{isMe ? `给${item.targetName}` : ''}
                </Text>
              </View>
            )}
            <Text style={[styles.messageText, isMe && styles.myMessageText]}>
              {item.text}
            </Text>
          </View>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {formatMsgTime(item.timestamp)}
          </Text>
        </View>
        {isMe && (
          <View style={[styles.msgAvatar, { backgroundColor: '#6C63FF' }]}>
            <Text style={styles.msgAvatarText}>{nickname.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen backgroundColor="#F0F0F3" safeAreaEdges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.chatHeaderContent}>
            <TouchableOpacity onPress={handleLeaveRoom} style={styles.headerBtn}>
              <FontAwesome6 name="arrow-left" size={18} color="#2D3436" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.chatRoomName} numberOfLines={1}>{roomName}</Text>
              <View style={styles.headerStatus}>
                <View style={[styles.statusDot, { backgroundColor: connected ? '#00B894' : '#FF6B6B' }]} />
                <Text style={styles.headerStatusText}>
                  {connected ? `${users.length}人在线` : '连接中...'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowUsers(true)} style={styles.headerBtn}>
              <FontAwesome6 name="users" size={18} color="#2D3436" />
            </TouchableOpacity>
          </View>

          {/* Private chat indicator */}
          {privateChatTarget && (
            <View style={styles.privateChatBar}>
              <FontAwesome6 name="lock" size={10} color="#6C63FF" />
              <Text style={styles.privateChatBarText}>
                正在与 {privateChatTarget.nickname} 私聊
              </Text>
              <TouchableOpacity onPress={() => setPrivateChatTarget(null)}>
                <Text style={styles.privateChatCancel}>取消</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Room code display for creator */}
          {isCreator && (
            <View style={styles.roomCodeBar}>
              <Text style={styles.roomCodeLabel}>房间号：</Text>
              <Text style={styles.roomCodeValue}>{roomCode}</Text>
              <Text style={styles.roomCodeHint}>分享给朋友加入</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.inputBarInner}>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={privateChatTarget ? `私信 ${privateChatTarget.nickname}...` : '输入消息...'}
                placeholderTextColor="#B2BEC3"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="paper-plane" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Users Modal */}
      <Modal visible={showUsers} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUsers(false)}
        >
          <View style={styles.usersModal}>
            <View style={styles.usersModalHeader}>
              <Text style={styles.usersModalTitle}>在线用户 ({users.length})</Text>
              <TouchableOpacity onPress={() => setShowUsers(false)}>
                <FontAwesome6 name="xmark" size={20} color="#636E72" />
              </TouchableOpacity>
            </View>
            <View style={styles.usersList}>
              {users.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userItem}
                  onPress={() => handleStartPrivateChat(user)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(user.nickname) }]}>
                    <Text style={styles.userAvatarText}>
                      {user.nickname.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.nickname}
                      {user.id === userId ? ' (我)' : ''}
                    </Text>
                    {user.id !== userId && (
                      <Text style={styles.userAction}>点击发起私聊</Text>
                    )}
                  </View>
                  {user.id !== userId && (
                    <FontAwesome6 name="comment" size={14} color="#6C63FF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

function normalizeMessage(msg: ChatMsg): ChatMsg {
  return {
    ...msg,
    type: (msg.msgType as ChatMsg['type']) || msg.type || 'group',
  };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  chatHeader: {
    backgroundColor: '#F0F0F3',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E8EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  chatRoomName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3436',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerStatusText: {
    fontSize: 12,
    color: '#636E72',
  },
  privateChatBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 6,
  },
  privateChatBarText: {
    flex: 1,
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '600',
  },
  privateChatCancel: {
    fontSize: 12,
    color: '#FF6584',
    fontWeight: '600',
  },
  roomCodeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108,99,255,0.06)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 4,
  },
  roomCodeLabel: {
    fontSize: 12,
    color: '#636E72',
  },
  roomCodeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6C63FF',
    letterSpacing: 2,
  },
  roomCodeHint: {
    fontSize: 11,
    color: '#B2BEC3',
    marginLeft: 8,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  systemMsgContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  systemMsgText: {
    fontSize: 12,
    color: '#B2BEC3',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  msgAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  msgAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messageBubbleWrap: {
    maxWidth: '70%',
  },
  messageBubbleWrapMe: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 11,
    color: '#636E72',
    marginBottom: 3,
    marginLeft: 4,
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    maxWidth: '100%',
  },
  myBubble: {
    backgroundColor: '#6C63FF',
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  myPrivateBubble: {
    backgroundColor: '#896BFF',
  },
  otherPrivateBubble: {
    backgroundColor: '#F3F0FF',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
  },
  privateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  privateTagText: {
    fontSize: 9,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    color: '#2D3436',
    lineHeight: 21,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  msgTime: {
    fontSize: 10,
    color: '#B2BEC3',
    marginTop: 3,
    marginLeft: 4,
  },
  msgTimeMe: {
    marginRight: 4,
    textAlign: 'right',
  },
  inputBar: {
    backgroundColor: '#F0F0F3',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#E8E8EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    maxHeight: 100,
  },
  textInput: {
    fontSize: 15,
    color: '#2D3436',
    padding: 0,
    maxHeight: 80,
    ...Platform.select({
      web: { outline: 'none' },
    }),
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  usersModal: {
    backgroundColor: '#F0F0F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  usersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8EB',
  },
  usersModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
  },
  usersList: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginBottom: 4,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  userAction: {
    fontSize: 12,
    color: '#6C63FF',
    marginTop: 2,
  },
});
