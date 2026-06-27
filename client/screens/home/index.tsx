/**
 * 首页 - 昵称设置 + 服务端发现
 */

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
  I18nManager,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { useServerDiscovery, connectToServer } from '@/hooks/useServerDiscovery';
import { initializeDeviceIdentity } from '@/utils/deviceIdentity';
import { getSettings, saveSettings, addToServerHistory } from '@/utils/storage';
import { useTranslation } from '@/i18n';
import type { DiscoveredServer } from '@/utils/types';

export default function HomeScreen() {
  const router = useSafeRouter();
  const { t } = useTranslation();
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
      Alert.alert(t('common.tip'), t('home.nicknameLengthError'));
      return;
    }
    await saveSettings({ nickname });
    setIsNicknameSet(true);
  };

  const handleConnectToServer = async (server: DiscoveredServer) => {
    setSelectedServer(server);

    if (server.hasPassword && server.requireApproval) {
      setShowPasswordModal(true);
    } else if (server.hasPassword) {
      setShowPasswordModal(true);
    } else if (server.requireApproval) {
      setShowApprovalModal(true);
    } else {
      await connectDirectly(server);
    }
  };

  const connectDirectly = async (server: DiscoveredServer) => {
    setIsConnecting(true);
    try {
      await addToServerHistory(server);
      router.push('/chatRoom', {
        serverId: server.serverId,
        serverName: server.serverName,
        serverIp: server.ip,
        serverPort: server.port,
        nickname,
      });
    } catch {
      Alert.alert(t('common.error'), t('home.connectFailed'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualConnect = async () => {
    if (!manualIP.trim()) {
      Alert.alert(t('common.tip'), t('home.enterIP'));
      return;
    }

    setIsConnecting(true);
    try {
      const server = await connectToServer(manualIP.trim());
      if (server) {
        await handleConnectToServer(server);
      } else {
        Alert.alert(t('common.error'), t('home.connectFailed'));
      }
    } catch {
      Alert.alert(t('common.error'), t('home.connectFailed'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (password.length !== 8) {
      Alert.alert(t('common.tip'), t('home.enter8DigitPassword'));
      return;
    }

    if (!selectedServer) return;

    setIsConnecting(true);
    try {
      const response = await fetch(
        `http://${selectedServer.ip}:${selectedServer.port}/api/v1/verify-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }
      );

      if (!response.ok) {
        Alert.alert(t('common.error'), t('home.wrongPassword'));
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
      Alert.alert(t('common.error'), t('home.verifyFailed'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApprovalSubmit = async () => {
    if (!approvalReason.trim()) {
      Alert.alert(t('common.tip'), t('home.enterReason'));
      return;
    }

    if (!selectedServer) return;

    setApprovalStatus('waiting');
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
      <Text style={styles.appSubtitle}>{t('home.subtitle')}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('home.setNickname')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('home.nicknamePlaceholder')}
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
        <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderServerDiscovery = () => (
    <View style={styles.section}>
      <View style={styles.scanHeader}>
        <View style={styles.scanIndicator}>
          {scanning && <ActivityIndicator size="small" color="#6366F1" />}
          <Text style={styles.scanText}>
            {scanning ? t('home.scanning') : t('home.scanComplete')}
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

      <View style={styles.serverListContainer}>
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
                      {t('home.usersOnline', { count: server.userCount })}
                    </Text>
                    {server.hasPassword && (
                      <View style={styles.badge}>
                        <FontAwesome6 name="lock" size={10} color="#F59E0B" />
                        <Text style={styles.badgeText}>{t('home.needPassword')}</Text>
                      </View>
                    )}
                    {server.requireApproval && (
                      <View style={[styles.badge, styles.badgeApproval]}>
                        <FontAwesome6 name="user-check" size={10} color="#10B981" />
                        <Text style={styles.badgeText}>{t('home.needApproval')}</Text>
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
            <Text style={styles.emptyText}>{t('home.noServerFound')}</Text>
            <Text style={styles.emptySubtext}>{t('home.noServerHint')}</Text>
          </View>
        )}
      </View>

      {/* 创建房间按钮 */}
      <TouchableOpacity
        style={styles.createRoomButton}
        onPress={() => router.push('/createRoom')}
      >
        <FontAwesome6 name="circle-plus" size={20} color="#fff" />
        <Text style={styles.createRoomButtonText}>{t('home.createRoom')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => setShowManualInput(!showManualInput)}
      >
        <FontAwesome6 name="keyboard" size={16} color="#6366F1" />
        <Text style={styles.manualButtonText}>{t('home.manualIP')}</Text>
      </TouchableOpacity>

      {showManualInput && (
        <View style={styles.manualInputContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder={t('home.ipPlaceholder')}
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
              <Text style={styles.connectButtonText}>{t('common.connect')}</Text>
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
        {/* 顶部栏 - 语言切换按钮 */}
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>OfflineChat</Text>
          </View>
          <TouchableOpacity
            style={styles.headerRight}
            onPress={() => router.push('/language')}
          >
            <FontAwesome6 name="globe" size={20} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

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
                <Text style={styles.modalTitle}>{t('home.enterPassword')}</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <FontAwesome6 name="xmark" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDescription}>
                {t('home.passwordRequired')}
              </Text>
              <TextInput
                style={styles.passwordInput}
                placeholder={t('home.enter8DigitPassword')}
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
                  <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
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
                <Text style={styles.modalTitle}>{t('home.applyToJoin')}</Text>
                {approvalStatus === 'idle' && (
                  <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                    <FontAwesome6 name="xmark" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {approvalStatus === 'idle' && (
                <>
                  <Text style={styles.modalDescription}>
                    {t('home.approvalRequired')}
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder={t('home.enterReason')}
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
                    <Text style={styles.primaryButtonText}>{t('home.submitApply')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {approvalStatus === 'waiting' && (
                <View style={styles.waitingContainer}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.waitingText}>{t('home.waitingForApproval')}</Text>
                </View>
              )}

              {approvalStatus === 'granted' && (
                <View style={styles.grantedContainer}>
                  <FontAwesome6 name="circle-check" size={48} color="#10B981" />
                  <Text style={styles.grantedText}>{t('home.approved')}</Text>
                </View>
              )}

              {approvalStatus === 'rejected' && (
                <View style={styles.rejectedContainer}>
                  <FontAwesome6 name="circle-xmark" size={48} color="#EF4444" />
                  <Text style={styles.rejectedText}>{t('home.rejected')}</Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      setShowApprovalModal(false);
                      setApprovalStatus('idle');
                      setApprovalReason('');
                    }}
                  >
                    <Text style={styles.primaryButtonText}>{t('common.confirm')}</Text>
                  </TouchableOpacity>
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
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#334155',
  },
  charCount: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scanIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanText: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 8,
  },
  refreshButton: {
    padding: 8,
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  serverListContainer: {
    maxHeight: 300,
  },
  serverList: {
    maxHeight: 280,
  },
  serverCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serverIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serverDetails: {
    flex: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  serverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 8,
  },
  signalBar: {
    width: 3,
    borderRadius: 1,
    marginRight: 2,
  },
  userCount: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  badgeApproval: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    color: '#F59E0B',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  createRoomButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createRoomButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  manualButtonText: {
    fontSize: 14,
    color: '#6366F1',
    marginLeft: 8,
  },
  manualInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  connectButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  modalDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  reasonInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  waitingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 16,
  },
  grantedContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  grantedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 16,
  },
  rejectedContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  rejectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 16,
  },
});
