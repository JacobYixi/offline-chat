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
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NICKNAME_KEY = '@offline_chat_nickname';
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

export default function HomeScreen() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [mode, setMode] = useState<'main' | 'create' | 'join'>('main');
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
      const response = await fetch(`${API_BASE}/api/v1/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() }),
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
          <View style={styles.formContent}>
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
          </View>
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
});
