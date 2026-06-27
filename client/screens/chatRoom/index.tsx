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
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeSearchParams, useSafeRouter } from '@/hooks/useSafeRouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarColor, getMessages, saveMessages, getSettings } from '@/utils/storage';
import { getOrCreateDeviceId } from '@/utils/deviceIdentity';
import { encryptWithSharedKey, decryptWithSharedKey } from '@/utils/crypto';
import { disguise, undisguise, DISGUISE_OPTIONS } from '@/utils/disguise';
import type { DisguiseMode } from '@/utils/disguise';
import type { ChatMessage, ChatUser, SmallGroup, Report, ServerConfig, WsMessage } from '@/utils/types';
import { useTranslation } from '@/i18n';

export default function ChatRoomScreen() {
  const { t } = useTranslation();
  const params = useSafeSearchParams<{
    serverId: string;
    serverName: string;
    serverIp: string;
    serverPort: number;
    nickname: string;
  }>();
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const serverId = (params.serverId as string) || '';
  const serverName = (params.serverName as string) || t('chat.defaultRoomName');
  const serverIp = (params.serverIp as string) || '';
  const serverPort = (params.serverPort as number) || 9091;
  const nickname = (params.nickname as string) || t('chat.anonymous');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [inputText, setInputText] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [showDisguiseMenu, setShowDisguiseMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [privateChatTarget, setPrivateChatTarget] = useState<ChatUser | null>(null);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [disguiseMode, setDisguiseMode] = useState<DisguiseMode>('none');
  const [deviceId, setDeviceId] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [mentionUsers, setMentionUsers] = useState<string[]>([]);
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [showSmallGroups, setShowSmallGroups] = useState(false);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatUser | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const init = async () => {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);

      // Load settings
      const settings = await getSettings();
      if (settings.disguiseMode) {
        setDisguiseMode(settings.disguiseMode);
      }

      // Load messages from storage
      const savedMessages = await getMessages(serverId);
      setMessages(savedMessages);
    };
    init();
  }, [serverId]);

  const wsUrl = `ws://${serverIp}:${serverPort}`;

  const handleMessage = useCallback(
    async (data: unknown) => {
      const msg = data as {
        type: string;
        payload?: Record<string, unknown>;
      };

      switch (msg.type) {
        case 'connected': {
          setIsConnected(true);
          setIsReconnecting(false);
          const payload = msg.payload as {
            users?: ChatUser[];
            config?: ServerConfig;
            isOwner?: boolean;
          };
          if (payload?.users) setUsers(payload.users);
          if (payload?.config) setServerConfig(payload.config);
          if (payload?.isOwner) setIsOwner(true);
          break;
        }
        case 'message': {
          const payload = msg.payload as {
            id?: string;
            senderId?: string;
            senderName?: string;
            text?: string;
            type?: string;
            timestamp?: number;
            replyTo?: { messageId: string; senderName: string; content: string };
            mentions?: string[];
          };
          if (payload) {
            // Decrypt message
            let displayText = payload.text || '';
            if (serverConfig?.sharedKey && payload.text) {
              const decrypted = decryptWithSharedKey(payload.text, serverConfig.sharedKey);
              if (decrypted && serverConfig.disguiseMode !== 'none') {
                displayText = undisguise(decrypted, serverConfig.disguiseMode) || decrypted;
              } else if (decrypted) {
                displayText = decrypted;
              }
            }

            const newMsg: ChatMessage = {
              id: payload.id || Date.now().toString(),
              senderId: payload.senderId || '',
              senderName: payload.senderName || 'Unknown',
              text: displayText,
              type: (payload.type as 'group' | 'private' | 'system') || 'group',
              timestamp: payload.timestamp || Date.now(),
              replyTo: payload.replyTo,
              mentions: payload.mentions,
            };

            setMessages((prev) => {
              const updated = [...prev, newMsg];
              saveMessages(serverId, updated);
              return updated;
            });
          }
          break;
        }
        case 'userList': {
          const payload = msg.payload as { users?: ChatUser[] };
          if (payload?.users) setUsers(payload.users);
          break;
        }
        case 'userJoined':
        case 'userLeft': {
          const payload = msg.payload as { nickname?: string };
          const sysMsg: ChatMessage = {
            id: Date.now().toString(),
            senderId: 'system',
            senderName: 'System',
            text: `${payload?.nickname || 'User'} ${msg.type === 'userJoined' ? 'joined' : 'left'}`,
            type: 'system',
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const updated = [...prev, sysMsg];
            saveMessages(serverId, updated);
            return updated;
          });
          break;
        }
        case 'reconnecting': {
          setIsReconnecting(true);
          setIsConnected(false);
          break;
        }
        case 'approvalRequired': {
          // Handle approval required
          break;
        }
        case 'approvalGranted': {
          setIsConnected(true);
          break;
        }
        case 'approvalRejected': {
          Alert.alert(t('common.notice'), t('home.rejected'));
          router.replace('/');
          break;
        }
        case 'kicked': {
          Alert.alert(t('common.notice'), t('chat.kicked'));
          router.replace('/');
          break;
        }
      }
    },
    [serverId, serverConfig, router, t]
  );

  const { connected: wsConnected, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    autoReconnect: true,
  });

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setIsConnected(wsConnected);
      if (wsConnected) {
        setIsReconnecting(false);
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [wsConnected]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;

    let textToSend = inputText.trim();

    // Apply disguise if enabled
    if (disguiseMode !== 'none') {
      textToSend = disguise(textToSend, disguiseMode, nickname, Date.now());
    }

    // Encrypt if shared key exists
    if (serverConfig?.sharedKey) {
      const encrypted = encryptWithSharedKey(textToSend, serverConfig.sharedKey);
      if (encrypted) {
        textToSend = encrypted;
      }
    }

    const msg: WsMessage = {
      type: 'send_message',
      payload: {
        text: textToSend,
        disguiseMode,
        replyTo: replyTo
          ? {
              messageId: replyTo.id,
              senderName: replyTo.senderName,
              content: replyTo.text,
            }
          : undefined,
        mentions: mentionUsers.length > 0 ? mentionUsers : undefined,
      },
    };

    send(msg);

    // Add to local messages
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: deviceId,
      senderName: nickname,
      text: inputText.trim(),
      type: 'group',
      timestamp: Date.now(),
      replyTo: replyTo
        ? {
            messageId: replyTo.id,
            senderName: replyTo.senderName,
            content: replyTo.text,
          }
        : undefined,
      mentions: mentionUsers.length > 0 ? mentionUsers : undefined,
    };

    setMessages((prev) => {
      const updated = [...prev, newMsg];
      saveMessages(serverId, updated);
      return updated;
    });

    setInputText('');
    setReplyTo(null);
    setMentionUsers([]);
    Keyboard.dismiss();
  }, [inputText, disguiseMode, serverConfig, serverId, deviceId, nickname, replyTo, mentionUsers, send]);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
  }, []);

  const handleMention = useCallback((user: ChatUser) => {
    setMentionUsers((prev) =>
      prev.includes(user.id) ? prev : [...prev, user.id]
    );
    setInputText((prev) => `${prev}@${user.nickname} `);
  }, []);

  const handlePrivateChat = useCallback((user: ChatUser) => {
    setPrivateChatTarget(user);
    setShowPrivateChat(true);
    setShowUsers(false);
  }, []);

  const handleReport = useCallback(() => {
    if (!reportTarget || !reportReason.trim()) return;

    const report: Report = {
      id: Date.now().toString(),
      reporterId: deviceId,
      reporterName: nickname,
      reportedId: reportTarget.id,
      reportedName: reportTarget.nickname,
      reason: reportReason,
      includeMessages: selectedMessages.length > 0,
      messages: selectedMessages.map((m) => ({
        messageId: m.id,
        content: m.text,
        timestamp: m.timestamp,
      })),
      status: 'pending',
      createdAt: Date.now(),
    };

    setReports((prev) => [...prev, report]);
    setShowReportModal(false);
    setReportTarget(null);
    setReportReason('');
    setSelectedMessages([]);
    Alert.alert(t('common.notice'), t('chat.reportSubmitted'));
  }, [reportTarget, reportReason, deviceId, nickname, selectedMessages, t]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.senderId === deviceId;
      const isSystem = item.type === 'system';

      if (isSystem) {
        return (
          <View style={styles.systemMessage}>
            <Text style={styles.systemMessageText}>{item.text}</Text>
          </View>
        );
      }

      const avatarColor = getAvatarColor(item.senderId);

      return (
        <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
          {!isMe && (
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>
                {item.senderName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
            {!isMe && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            {item.replyTo && (
              <View style={styles.replyPreview}>
                <View style={styles.replyPreviewContent}>
                  <FontAwesome6 name="reply" size={10} color="#6366F1" />
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {' '}{item.replyTo.senderName}: {item.replyTo.content}
                  </Text>
                </View>
              </View>
            )}
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
              {item.text}
            </Text>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          {isMe && (
            <View style={[styles.avatar, { backgroundColor: '#6366F1' }]}>
              <Text style={styles.avatarText}>
                {nickname.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [deviceId, nickname]
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 56}
      >
        {/* Reconnecting Banner */}
        {isReconnecting && (
          <View style={styles.reconnectBanner}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.reconnectText}>{t('connection.reconnecting')}</Text>
          </View>
        )}

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <FontAwesome6 name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{serverName}</Text>
            <TouchableOpacity
              onPress={() => setShowUsers(true)}
              style={styles.userCountBadge}
            >
              <View style={styles.onlineDot} />
              <Text style={styles.userCountText}>{t('chat.onlineCount', { count: users.length })}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setShowMoreMenu(!showMoreMenu)}
            style={styles.headerButton}
          >
            <FontAwesome6 name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* More Menu */}
        {showMoreMenu && (
          <View style={styles.moreMenu}>
            <TouchableOpacity
              onPress={() => {
                setShowDisguiseMenu(true);
                setShowMoreMenu(false);
              }}
              style={styles.menuItem}
            >
              <FontAwesome6 name="mask" size={16} color="#fff" />
              <Text style={styles.menuItemText}>{t('chat.disguiseMode')}</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                onPress={() => {
                  setShowOwnerPanel(true);
                  setShowMoreMenu(false);
                }}
                style={styles.menuItem}
              >
                <FontAwesome6 name="crown" size={16} color="#F59E0B" />
                <Text style={styles.menuItemText}>{t('chat.controlPanel')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setShowSmallGroups(true);
                setShowMoreMenu(false);
              }}
              style={styles.menuItem}
            >
              <FontAwesome6 name="users" size={16} color="#fff" />
              <Text style={styles.menuItemText}>{t('chat.smallGroups')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Reply Preview */}
        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarContent}>
              <Text style={styles.replyBarText}>
                {t('chat.replyPrefix')} {replyTo.senderName}: {replyTo.text.slice(0, 30)}
                {replyTo.text.length > 30 ? '...' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <FontAwesome6 name="xmark" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            onPress={() => setShowDisguiseMenu(true)}
            style={styles.disguiseButton}
          >
            <FontAwesome6
              name={
                disguiseMode === 'none'
                  ? 'eye'
                  : disguiseMode === 'weather'
                    ? 'cloud-sun'
                    : disguiseMode === 'code'
                      ? 'code'
                      : disguiseMode === 'syslog'
                        ? 'file-lines'
                        : 'cart-shopping'
              }
              size={20}
              color={disguiseMode === 'none' ? '#94A3B8' : '#6366F1'}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('chat.inputPlaceholder')}
            placeholderTextColor="#64748B"
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            disabled={!inputText.trim()}
          >
            <FontAwesome6
              name="paper-plane"
              size={18}
              color={inputText.trim() ? '#fff' : '#64748B'}
            />
          </TouchableOpacity>
        </View>

        {/* Users Sidebar */}
        <Modal
          visible={showUsers}
          transparent
          animationType="slide"
          onRequestClose={() => setShowUsers(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowUsers(false)}
          >
            <View style={styles.usersSidebar}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>{t('chat.onlineUsers')}</Text>
                <TouchableOpacity onPress={() => setShowUsers(false)}>
                  <FontAwesome6 name="xmark" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userItem}
                    onPress={() => handlePrivateChat(item)}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: getAvatarColor(item.id) },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {item.nickname.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userNickname}>{item.nickname}</Text>
                      {item.isOwner && (
                        <FontAwesome6
                          name="crown"
                          size={12}
                          color="#F59E0B"
                          style={styles.ownerIcon}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Disguise Menu */}
        <Modal
          visible={showDisguiseMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDisguiseMenu(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDisguiseMenu(false)}
          >
            <View style={styles.disguiseMenu}>
              <Text style={styles.disguiseMenuTitle}>{t('chat.selectDisguiseMode')}</Text>
              {DISGUISE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.disguiseOption,
                    disguiseMode === option.mode && styles.disguiseOptionActive,
                  ]}
                  onPress={() => {
                    setDisguiseMode(option.mode);
                    setShowDisguiseMenu(false);
                  }}
                >
                  <FontAwesome6
                    name={option.icon as React.ComponentProps<typeof FontAwesome6>['name']}
                    size={20}
                    color={disguiseMode === option.mode ? '#6366F1' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      styles.disguiseOptionText,
                      disguiseMode === option.mode &&
                        styles.disguiseOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Private Chat Modal */}
        <Modal
          visible={showPrivateChat}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPrivateChat(false)}
        >
          <View style={styles.privateChatModal}>
            <View style={styles.privateChatHeader}>
              <Text style={styles.privateChatTitle}>
                {t('chat.privateChatPrefix')}: {privateChatTarget?.nickname}
              </Text>
              <View style={styles.privateChatActions}>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(t('common.notice'), t('chat.blockedUser'));
                    setShowPrivateChat(false);
                  }}
                  style={styles.blockButton}
                >
                  <FontAwesome6 name="ban" size={16} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowPrivateChat(false)}>
                  <FontAwesome6 name="xmark" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.privateChatContent}>
              <Text style={styles.privateChatPlaceholder}>
                {t('chat.privateChatPlaceholder')}
              </Text>
            </View>
            <View style={styles.privateChatInput}>
              <TextInput
                style={styles.textInput}
                placeholder={t('chat.privateMessagePlaceholder')}
                placeholderTextColor="#64748B"
              />
              <TouchableOpacity style={styles.sendButton}>
                <FontAwesome6 name="paper-plane" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Report Modal */}
        <Modal
          visible={showReportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.reportModal}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{t("chat.reportUser")}</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <FontAwesome6 name="xmark" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportLabel}>
              {t("chat.reportedUser")}: {reportTarget?.nickname}
            </Text>
            <Text style={styles.reportLabel}>{t("chat.reportReason")}:</Text>
            <TextInput
              style={styles.reportInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder={t("chat.reportReasonPlaceholder")}
              placeholderTextColor="#64748B"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.reportSubmitButton,
                !reportReason.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleReport}
              disabled={!reportReason.trim()}
            >
              <Text style={styles.reportSubmitText}>{t("chat.submitReport")}</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#EF4444',
    gap: 8,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  userCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#334155',
    borderRadius: 12,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  userCountText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  moreMenu: {
    position: 'absolute',
    top: 100,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 8,
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 14,
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  systemMessage: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#64748B',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '70%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleMe: {
    backgroundColor: '#6366F1',
  },
  senderName: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  replyPreview: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.6)',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  disguiseButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  usersSidebar: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    padding: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userNickname: {
    fontSize: 16,
    color: '#fff',
  },
  ownerIcon: {
    marginLeft: 4,
  },
  disguiseMenu: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  disguiseMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  disguiseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    gap: 12,
  },
  disguiseOptionActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  disguiseOptionText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  disguiseOptionTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  privateChatModal: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  privateChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#1E293B',
  },
  privateChatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  privateChatActions: {
    flexDirection: 'row',
    gap: 12,
  },
  blockButton: {
    padding: 8,
  },
  privateChatContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privateChatPlaceholder: {
    color: '#64748B',
    fontSize: 14,
  },
  privateChatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#1E293B',
  },
  reportModal: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 24,
    paddingTop: 60,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  reportLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  reportInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  reportSubmitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  reportSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
