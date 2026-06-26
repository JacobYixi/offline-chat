import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DISGUISE_OPTIONS } from '@/utils/disguise';
import type { DisguiseMode } from '@/utils/disguise';

const NICKNAME_KEY = '@offline_chat_nickname';
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

export default function HomeScreen() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [mode, setMode] = useState<'main' | 'create' | 'join'>('main');
  const [disguiseMode, setDisguiseMode] = useState<DisguiseMode>('none');
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(NICKNAME_KEY).then((name) => {
        if (name) {
          setNickname(name);
        } else {
          router.replace('/nickname');
        }
      });
    }, [router])
  );

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    setIsCreating(true);
    try {
      /**
       * 服务端文件：server/src/index.ts
       * 接口：POST /api/v1/rooms
       * Body 参数：name: string, disguiseMode?: 'none' | 'weather' | 'code' | 'shopping' | 'syslog'
       */
      const response = await fetch(`${API_BASE}/api/v1/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          disguiseMode: encryptionEnabled ? disguiseMode : 'none',
        }),
      });
      if (!response.ok) throw new Error('创建失败');
      const room = await response.json();
      router.push('/chatRoom', {
        roomCode: room.code,
        roomName: room.name,
        roomId: room.id,
        nickname,
        isCreator: true,
      });
    } catch {
      Alert.alert('错误', '创建房间失败，请检查网络连接');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('提示', '请输入6位房间号');
      return;
    }
    setIsJoining(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/rooms/${code}`);
      if (!response.ok) {
        if (response.status === 404) {
          Alert.alert('错误', '房间不存在，请检查房间号');
        } else {
          Alert.alert('错误', '获取房间信息失败');
        }
        return;
      }
      const room = await response.json();
      router.push('/chatRoom', {
        roomCode: room.code,
        roomName: room.name,
        roomId: room.id,
        nickname,
        isCreator: false,
      });
    } catch {
      Alert.alert('错误', '加入房间失败，请检查网络连接');
    } finally {
      setIsJoining(false);
    }
  };

  const handleChangeNickname = () => {
    router.push('/nickname');
  };

  return (
    <Screen backgroundColor="#F0F0F3" safeAreaEdges={['left', 'right', 'bottom']}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.appTitle}>OfflineChat</Text>
              <Text style={styles.appSubtitle}>离线聊天，随时连接</Text>
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={handleChangeNickname}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {nickname ? nickname.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              <Text style={styles.nicknameLabel} numberOfLines={1}>{nickname}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        {mode === 'main' && (
          <View style={styles.mainContent}>
            {/* Create Room Card */}
            <TouchableOpacity
              style={styles.card}
              onPress={() => setMode('create')}
              activeOpacity={0.7}
            >
              <View style={styles.cardShadowOuter}>
                <View style={styles.cardShadowInner}>
                  <View style={styles.cardContent}>
                    <View style={[styles.cardIcon, { backgroundColor: 'rgba(108,99,255,0.12)' }]}>
                      <FontAwesome6 name="plus" size={22} color="#6C63FF" />
                    </View>
                    <View style={styles.cardTextContainer}>
                      <Text style={styles.cardTitle}>创建房间</Text>
                      <Text style={styles.cardDesc}>开启一个新聊天室，邀请朋友加入</Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={16} color="#B2BEC3" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Join Room Card */}
            <TouchableOpacity
              style={styles.card}
              onPress={() => setMode('join')}
              activeOpacity={0.7}
            >
              <View style={styles.cardShadowOuter}>
                <View style={styles.cardShadowInner}>
                  <View style={styles.cardContent}>
                    <View style={[styles.cardIcon, { backgroundColor: 'rgba(255,101,132,0.12)' }]}>
                      <FontAwesome6 name="right-to-bracket" size={22} color="#FF6584" />
                    </View>
                    <View style={styles.cardTextContainer}>
                      <Text style={styles.cardTitle}>加入房间</Text>
                      <Text style={styles.cardDesc}>输入房间号，加入已有的聊天室</Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={16} color="#B2BEC3" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.cardShadowOuter}>
                <View style={styles.cardShadowInner}>
                  <View style={styles.infoContent}>
                    <FontAwesome6 name="wifi" size={18} color="#6C63FF" />
                    <Text style={styles.infoText}>
                      使用方法：一台设备创建房间并开启热点，其他设备连接热点后输入房间号即可加入
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Create Room Form */}
        {mode === 'create' && (
          <ScrollView style={styles.formContent} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMode('main')}>
              <FontAwesome6 name="arrow-left" size={18} color="#6C63FF" />
              <Text style={styles.backText}>返回</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>创建聊天室</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>房间名称</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="例如：飞机上的闲聊"
                  placeholderTextColor="#B2BEC3"
                  value={roomName}
                  onChangeText={setRoomName}
                  maxLength={30}
                  autoFocus
                />
              </View>
            </View>

            {/* Encryption Toggle */}
            <View style={styles.securitySection}>
              <Text style={styles.inputLabel}>安全设置</Text>
              <View style={styles.securityCard}>
                <View style={styles.securityRow}>
                  <View style={styles.securityLeft}>
                    <View style={[styles.securityIcon, { backgroundColor: 'rgba(0,184,148,0.12)' }]}>
                      <FontAwesome6 name="shield-halved" size={16} color="#00B894" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.securityTitle}>端到端加密</Text>
                      <Text style={styles.securityDesc}>AES-256 加密，仅房间成员可解密</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, encryptionEnabled && styles.toggleActive]}
                    onPress={() => setEncryptionEnabled(!encryptionEnabled)}
                  >
                    <View style={[styles.toggleDot, encryptionEnabled && styles.toggleDotActive]} />
                  </TouchableOpacity>
                </View>

                {encryptionEnabled && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.disguiseSectionTitle}>伪装模式</Text>
                    <Text style={styles.disguiseSectionDesc}>
                      加密后的消息将被伪装成以下形式，旁人看到的将是伪装内容
                    </Text>
                    {DISGUISE_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.mode}
                        style={[styles.disguiseOption, disguiseMode === option.mode && styles.disguiseOptionActive]}
                        onPress={() => setDisguiseMode(option.mode)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.disguiseOptionIcon, {
                          backgroundColor: disguiseMode === option.mode ? 'rgba(108,99,255,0.15)' : 'rgba(0,0,0,0.04)',
                        }]}>
                          <FontAwesome6
                            name={option.icon as keyof typeof FontAwesome6.glyphMap}
                            size={14}
                            color={disguiseMode === option.mode ? '#6C63FF' : '#636E72'}
                          />
                        </View>
                        <View style={styles.disguiseOptionText}>
                          <Text style={[
                            styles.disguiseOptionTitle,
                            disguiseMode === option.mode && styles.disguiseOptionTitleActive,
                          ]}>
                            {option.label}
                          </Text>
                          <Text style={styles.disguiseOptionDesc}>{option.description}</Text>
                        </View>
                        {disguiseMode === option.mode && (
                          <FontAwesome6 name="check" size={12} color="#6C63FF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, !roomName.trim() && styles.buttonDisabled]}
              onPress={handleCreateRoom}
              disabled={!roomName.trim() || isCreating}
              activeOpacity={0.8}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>创建并进入</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Join Room Form */}
        {mode === 'join' && (
          <View style={styles.formContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMode('main')}>
              <FontAwesome6 name="arrow-left" size={18} color="#6C63FF" />
              <Text style={styles.backText}>返回</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>加入聊天室</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>房间号</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.roomCodeInput}
                  placeholder="输入6位房间号"
                  placeholderTextColor="#B2BEC3"
                  value={roomCode}
                  onChangeText={(text) => setRoomCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, roomCode.length !== 6 && styles.buttonDisabled]}
              onPress={handleJoinRoom}
              disabled={roomCode.length !== 6 || isJoining}
              activeOpacity={0.8}
            >
              {isJoining ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>加入房间</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D3436',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
  avatarBtn: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nicknameLabel: {
    fontSize: 11,
    color: '#636E72',
    marginTop: 4,
    maxWidth: 60,
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
    gap: 16,
  },
  card: {
    marginBottom: 0,
  },
  cardShadowOuter: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    borderRadius: 24,
    ...Platform.select({
      android: { elevation: 6 },
    }),
  },
  cardShadowInner: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -6, height: -6 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    ...Platform.select({
      android: {
        backgroundColor: '#F0F0F3',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.5)',
      },
    }),
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  cardDesc: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 2,
  },
  infoCard: {
    marginTop: 8,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#636E72',
    lineHeight: 20,
  },
  formContent: {
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C63FF',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3436',
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  input: {
    fontSize: 15,
    color: '#2D3436',
    padding: 0,
    ...Platform.select({
      web: { outline: 'none' },
    }),
  },
  roomCodeInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
    textAlign: 'center',
    letterSpacing: 6,
    padding: 0,
    ...Platform.select({
      web: { outline: 'none' },
    }),
  },
  primaryButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 54,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  securitySection: {
    marginBottom: 24,
  },
  securityCard: {
    backgroundColor: '#E8E8EB',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
  },
  securityDesc: {
    fontSize: 11,
    color: '#636E72',
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1D9E6',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: '#6C63FF',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 16,
  },
  disguiseSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 4,
  },
  disguiseSectionDesc: {
    fontSize: 11,
    color: '#636E72',
    marginBottom: 12,
    lineHeight: 16,
  },
  disguiseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  disguiseOptionActive: {
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  disguiseOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  disguiseOptionText: {
    flex: 1,
  },
  disguiseOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3436',
  },
  disguiseOptionTitleActive: {
    color: '#6C63FF',
  },
  disguiseOptionDesc: {
    fontSize: 10,
    color: '#636E72',
    marginTop: 1,
  },
});
