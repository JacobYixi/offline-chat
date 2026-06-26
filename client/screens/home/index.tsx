import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { useServerDiscovery, connectToServer } from '@/hooks/useServerDiscovery';
import { initializeDeviceIdentity } from '@/utils/deviceIdentity';
import { getSettings, saveSettings, addToServerHistory } from '@/utils/storage';
import type { DiscoveredServer } from '@/utils/types';

export default function HomeScreen() {
  const router = useSafeRouter();
  const [nickname, setNickname] = useState('');
  const [isNicknameSet, setIsNicknameSet] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualIP, setManualIP] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedServer, setSelectedServer] = useState<DiscoveredServer | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [password, setPassword] = useState('');
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'waiting' | 'granted' | 'rejected'>('idle');

  const { servers, scanning, refresh } = useServerDiscovery({
    enabled: isNicknameSet,
  });

  // Initialize device identity and load settings
  useEffect(() => {
    const init = async () => {
      await initializeDeviceIdentity();
      const settings = await getSettings();
      if (settings.nickname) {
        setNickname(settings.nickname);
        setIsNicknameSet(true);
      }
    };
    init();
  }, []);

  const handleSetNickname = async () => {
    if (nickname.length < 2 || nickname.length > 12) {
      Alert.alert('提示', '昵称需要2-12个字符');
      return;
    }
    await saveSettings({ nickname });
    setIsNicknameSet(true);
  };

  const handleConnectToServer = async (server: DiscoveredServer) => {
    setSelectedServer(server);

    if (server.hasPassword && server.requireApproval) {
      // Need both password and approval
      setShowPasswordModal(true);
    } else if (server.hasPassword) {
      setShowPasswordModal(true);
    } else if (server.requireApproval) {
      setShowApprovalModal(true);
    } else {
      // Direct connection
      await connectDirectly(server);
    }
  };

  const connectDirectly = async (server: DiscoveredServer) => {
    setIsConnecting(true);
    try {
      // Save to history
      await addToServerHistory(server);

      // Navigate to chat room
      router.push('/chatRoom', {
        serverId: server.serverId,
        serverName: server.serverName,
        serverIp: server.ip,
        serverPort: server.port,
        nickname,
      });
    } catch {
      Alert.alert('错误', '连接失败，请重试');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualConnect = async () => {
    if (!manualIP.trim()) {
      Alert.alert('提示', '请输入服务器IP地址');
      return;
    }

    setIsConnecting(true);
    try {
      const server = await connectToServer(manualIP.trim());
      if (server) {
        await handleConnectToServer(server);
      } else {
        Alert.alert('错误', '无法连接到服务器，请检查IP地址');
      }
    } catch {
      Alert.alert('错误', '连接失败，请重试');
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (password.length !== 8) {
      Alert.alert('提示', '请输入8位密码');
      return;
    }

    if (!selectedServer) return;

    setIsConnecting(true);
    try {
      // Verify password with server
      const response = await fetch(
        `http://${selectedServer.ip}:${selectedServer.port}/api/v1/verify-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }
      );

      if (!response.ok) {
        Alert.alert('错误', '密码错误');
        return;
      }

      setShowPasswordModal(false);
      setPassword('');

      if (selectedServer.requireApproval) {
        setShowApprovalModal(true);
      } else {
        await connectDirectly(selectedServer);
      }
    } catch {
      Alert.alert('错误', '验证失败，请重试');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApprovalSubmit = async () => {
    if (!approvalReason.trim()) {
      Alert.alert('提示', '请输入申请理由');
      return;
    }

    if (!selectedServer) return;

    setApprovalStatus('waiting');
    // In real implementation, this would use WebSocket to submit approval
    // and wait for server response
    // For now, simulate the flow
    setTimeout(() => {
      setApprovalStatus('granted');
      setTimeout(() => {
        setShowApprovalModal(false);
        setApprovalStatus('idle');
        setApprovalReason('');
        connectDirectly(selectedServer);
      }, 1000);
    }, 2000);
  };

  const renderNicknameSection = () => (
    <View style={styles.section}>
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <FontAwesome6 name="lock" size={32} color="#6366F1" />
        </View>
      </View>
      <Text style={styles.appTitle}>OfflineChat</Text>
      <Text style={styles.appSubtitle}>安全私密的离线聊天</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>设置昵称</Text>
        <TextInput
          style={styles.input}
          placeholder="输入昵称（2-12字符）"
          placeholderTextColor="#64748B"
          value={nickname}
          onChangeText={setNickname}
          maxLength={12}
        />
        <Text style={styles.charCount}>{nickname.length}/12</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          (nickname.length < 2 || nickname.length > 12) && styles.disabledButton,
        ]}
        onPress={handleSetNickname}
        disabled={nickname.length < 2 || nickname.length > 12}
      >
        <Text style={styles.primaryButtonText}>确认</Text>
      </TouchableOpacity>
    </View>
  );

  const renderServerDiscovery = () => (
    <View style={styles.section}>
      <View style={styles.scanHeader}>
        <View style={styles.scanIndicator}>
          {scanning && <ActivityIndicator size="small" color="#6366F1" />}
          <Text style={styles.scanText}>
            {scanning ? '正在搜索附近的服务端...' : '搜索完成'}
          </Text>
        </View>
        <TouchableOpacity onPress={refresh} style={styles.refreshButton}>
          <FontAwesome6
            name="arrows-rotate"
            size={16}
            color="#6366F1"
            style={scanning ? styles.spinning : undefined}
          />
        </TouchableOpacity>
      </View>

      {servers.length > 0 ? (
        <ScrollView style={styles.serverList}>
          {servers.map((server) => (
            <TouchableOpacity
              key={server.serverId}
              style={styles.serverCard}
              onPress={() => handleConnectToServer(server)}
            >
              <View style={styles.serverInfo}>
                <View style={styles.serverIcon}>
                  <FontAwesome6 name="server" size={20} color="#6366F1" />
                </View>
                <View style={styles.serverDetails}>
                  <Text style={styles.serverName}>{server.serverName}</Text>
                  <View style={styles.serverMeta}>
                    <View style={styles.signalBars}>
                      {[1, 2, 3, 4].map((level) => (
                        <View
                          key={level}
                          style={[
                            styles.signalBar,
                            {
                              height: level * 4 + 4,
                              backgroundColor:
                                level <= (server.signalStrength || 0)
                                  ? '#6366F1'
                                  : '#334155',
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={styles.userCount}>
                      {server.userCount}人在线
                    </Text>
                    {server.hasPassword && (
                      <View style={styles.badge}>
                        <FontAwesome6 name="lock" size={10} color="#F59E0B" />
                        <Text style={styles.badgeText}>需密码</Text>
                      </View>
                    )}
                    {server.requireApproval && (
                      <View style={[styles.badge, styles.badgeApproval]}>
                        <FontAwesome6 name="user-check" size={10} color="#10B981" />
                        <Text style={styles.badgeText}>需申请</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color="#64748B" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <FontAwesome6 name="wifi" size={48} color="#334155" />
          <Text style={styles.emptyText}>未发现服务端</Text>
          <Text style={styles.emptySubtext}>请确保已连接到服务端的热点</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => setShowManualInput(!showManualInput)}
      >
        <FontAwesome6 name="keyboard" size={16} color="#6366F1" />
        <Text style={styles.manualButtonText}>手动输入IP地址</Text>
      </TouchableOpacity>

      {showManualInput && (
        <View style={styles.manualInputContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder="输入服务器IP地址（如 192.168.1.100）"
            placeholderTextColor="#64748B"
            value={manualIP}
            onChangeText={setManualIP}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.connectButton,
              !manualIP.trim() && styles.disabledButton,
            ]}
            onPress={handleManualConnect}
            disabled={!manualIP.trim() || isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.connectButtonText}>连接</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!isNicknameSet ? renderNicknameSection() : renderServerDiscovery()}
        </ScrollView>

        {/* Password Modal */}
        <Modal
          visible={showPasswordModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPasswordModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>输入密码</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <FontAwesome6 name="xmark" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDescription}>
                该服务端需要密码才能加入
              </Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="输入8位密码"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={setPassword}
                maxLength={8}
                secureTextEntry
              />
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  password.length !== 8 && styles.disabledButton,
                ]}
                onPress={handlePasswordSubmit}
                disabled={password.length !== 8 || isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>确认</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Approval Modal */}
        <Modal
          visible={showApprovalModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowApprovalModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              if (approvalStatus === 'idle') {
                setShowApprovalModal(false);
              }
            }}
            disabled={approvalStatus !== 'idle'}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>申请加入</Text>
                {approvalStatus === 'idle' && (
                  <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                    <FontAwesome6 name="xmark" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {approvalStatus === 'idle' && (
                <>
                  <Text style={styles.modalDescription}>
                    该服务端需要申请才能加入，请填写申请理由
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="输入申请理由"
                    placeholderTextColor="#64748B"
                    value={approvalReason}
                    onChangeText={setApprovalReason}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      !approvalReason.trim() && styles.disabledButton,
                    ]}
                    onPress={handleApprovalSubmit}
                    disabled={!approvalReason.trim()}
                  >
                    <Text style={styles.primaryButtonText}>提交申请</Text>
                  </TouchableOpacity>
                </>
              )}

              {approvalStatus === 'waiting' && (
                <View style={styles.waitingContainer}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.waitingText}>等待房主审批...</Text>
                </View>
              )}

              {approvalStatus === 'granted' && (
                <View style={styles.grantedContainer}>
                  <FontAwesome6 name="circle-check" size={48} color="#10B981" />
                  <Text style={styles.grantedText}>申请已通过</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  section: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 32,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.5,
  },
  scanHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  refreshButton: {
    padding: 8,
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  serverList: {
    width: '100%',
    maxHeight: 300,
  },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  serverInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serverDetails: {
    flex: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  serverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  signalBar: {
    width: 3,
    borderRadius: 1,
  },
  userCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeApproval: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    color: '#F59E0B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  manualButtonText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  manualInputContainer: {
    width: '100%',
    marginTop: 8,
  },
  manualInput: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 12,
  },
  connectButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  modalDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  passwordInput: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  reasonInput: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  waitingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  grantedContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  grantedText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
});
