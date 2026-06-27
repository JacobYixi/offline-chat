/**
 * 创建房间页面
 * 允许用户配置并启动一个聊天室服务器
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { startServer, addServerListener } from '@/utils/mobileServer';
import { useTranslation } from '@/i18n';
import { useSafeRouter } from '@/hooks/useSafeRouter';

type ApprovalExpiry = 'never' | '1h' | '24h' | '7d';
type DisguiseType = 'none' | 'weather' | 'code' | 'log' | 'shopping';

export default function CreateRoomScreen() {
  const router = useSafeRouter();
  const { t } = useTranslation();

  // 表单状态
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [approvalExpiry, setApprovalExpiry] = useState<ApprovalExpiry>('never');
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [disguiseType, setDisguiseType] = useState<DisguiseType>('none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 验证表单
  const validateForm = (): boolean => {
    if (!roomName.trim()) {
      Alert.alert(t('common.error'), t('createRoom.roomNameHint'));
      return false;
    }
    if (roomName.length < 2 || roomName.length > 20) {
      Alert.alert(t('common.error'), t('createRoom.roomNameHint'));
      return false;
    }
    if (password && (password.length !== 8 || !/^\d{8}$/.test(password))) {
      Alert.alert(t('common.error'), t('createRoom.passwordHint'));
      return false;
    }
    return true;
  };

  // 创建房间
  const handleCreateRoom = async () => {
    if (!validateForm()) return;

    setIsCreating(true);

    try {
      const result = await startServer({
        serverName: roomName.trim(),
        password: password || null,
        requireApproval,
        approvalExpiryHours: approvalExpiry === 'never' ? null : parseInt(approvalExpiry),
      });

      if (result.success) {
        // 监听服务器启动事件
        const unsubscribe = addServerListener((event, data) => {
          if (event === 'server:started') {
            setIsCreating(false);
            Alert.alert(
              t('common.success'),
              t('createRoom.created'),
              [
                {
                  text: t('common.ok'),
                  onPress: () => {
                    router.push(`/chatRoom?serverId=${data.serverId}&isOwner=true`);
                  },
                },
              ]
            );
            unsubscribe();
          } else if (event === 'server:error') {
            setIsCreating(false);
            Alert.alert(t('common.error'), data.error);
            unsubscribe();
          }
        });
      } else {
        setIsCreating(false);
        Alert.alert(t('common.error'), result.error || t('errors.connectionFailed'));
      }
    } catch (error) {
      setIsCreating(false);
      Alert.alert(t('common.error'), (error as Error).message);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* 顶部导航栏 */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <FontAwesome6 name="arrow-left" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {t('createRoom.title')}
            </Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* 房间名称 */}
            <View style={styles.section}>
              <Text style={styles.label}>
                {t('createRoom.roomName')}
              </Text>
              <View style={styles.inputContainer}>
                <FontAwesome6 name="pen" size={16} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder={t('createRoom.roomNamePlaceholder')}
                  placeholderTextColor="#64748B"
                  value={roomName}
                  onChangeText={setRoomName}
                  maxLength={20}
                  returnKeyType="next"
                />
              </View>
              <Text style={styles.hint}>
                {t('createRoom.roomNameHint')}
              </Text>
            </View>

            {/* 房间密码 */}
            <View style={styles.section}>
              <Text style={styles.label}>
                {t('createRoom.password')}
              </Text>
              <View style={styles.inputContainer}>
                <FontAwesome6 name="lock" size={16} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder={t('createRoom.passwordPlaceholder')}
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  maxLength={8}
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
              <Text style={styles.hint}>
                {t('createRoom.passwordHint')}
              </Text>
            </View>

            {/* 加入审批 */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelRow}>
                  <View style={styles.iconCircle}>
                    <FontAwesome6 name="user-check" size={14} color="#6366F1" />
                  </View>
                  <Text style={styles.switchLabel}>
                    {t('createRoom.requireApproval')}
                  </Text>
                </View>
                <Switch
                  value={requireApproval}
                  onValueChange={setRequireApproval}
                  trackColor={{ false: '#334155', true: '#6366F1' }}
                  thumbColor="#F1F5F9"
                />
              </View>
            </View>

            {/* 审批过期时间 */}
            {requireApproval && (
              <View style={styles.section}>
                <Text style={styles.label}>
                  {t('createRoom.approvalExpiry')}
                </Text>
                <View style={styles.optionsRow}>
                  {[
                    { value: 'never', label: t('createRoom.expiryNever') },
                    { value: '1h', label: t('createRoom.expiry1Hour') },
                    { value: '24h', label: t('createRoom.expiry24Hours') },
                    { value: '7d', label: t('createRoom.expiry7Days') },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        approvalExpiry === option.value && styles.optionButtonActive,
                      ]}
                      onPress={() => setApprovalExpiry(option.value as ApprovalExpiry)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          approvalExpiry === option.value && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 高级设置 */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.advancedHeader}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <View style={styles.switchLabelRow}>
                  <View style={styles.iconCircle}>
                    <FontAwesome6 name="gear" size={14} color="#6366F1" />
                  </View>
                  <Text style={styles.switchLabel}>
                    {t('createRoom.advancedSettings')}
                  </Text>
                </View>
                <FontAwesome6
                  name="chevron-down"
                  size={14}
                  color="#64748B"
                  style={{ transform: [{ rotate: showAdvanced ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {showAdvanced && (
                <View style={styles.advancedContent}>
                  {/* 端到端加密 */}
                  <View style={styles.advancedRow}>
                    <View style={styles.advancedLabelContainer}>
                      <Text style={styles.advancedLabel}>
                        {t('createRoom.encryption')}
                      </Text>
                      <Text style={styles.advancedHint}>
                        {t('createRoom.encryptionHint')}
                      </Text>
                    </View>
                    <Switch
                      value={encryptionEnabled}
                      onValueChange={setEncryptionEnabled}
                      trackColor={{ false: '#334155', true: '#6366F1' }}
                      thumbColor="#F1F5F9"
                    />
                  </View>

                  {/* 消息伪装 */}
                  <View style={styles.disguiseSection}>
                    <Text style={styles.label}>
                      {t('createRoom.disguiseType')}
                    </Text>
                    <View style={styles.optionsRow}>
                      {[
                        { value: 'none', label: t('createRoom.disguiseNone') },
                        { value: 'weather', label: t('createRoom.disguiseWeather') },
                        { value: 'code', label: t('createRoom.disguiseCode') },
                        { value: 'log', label: t('createRoom.disguiseLog') },
                        { value: 'shopping', label: t('createRoom.disguiseShopping') },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.disguiseButton,
                            disguiseType === option.value && styles.disguiseButtonActive,
                          ]}
                          onPress={() => setDisguiseType(option.value as DisguiseType)}
                        >
                          <Text
                            style={[
                              styles.disguiseText,
                              disguiseType === option.value && styles.disguiseTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* 底部创建按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateRoom}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.createButtonText}>
                    {t('createRoom.creating')}
                  </Text>
                </>
              ) : (
                <>
                  <FontAwesome6 name="play" size={16} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.createButtonText}>
                    {t('createRoom.createButton')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.3)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#E2E8F0',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    marginLeft: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#E2E8F0',
    flex: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  optionButtonActive: {
    backgroundColor: '#6366F1',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  optionTextActive: {
    color: '#E2E8F0',
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  advancedContent: {
    marginTop: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 16,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  advancedLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  advancedLabel: {
    fontSize: 16,
    color: '#E2E8F0',
    marginBottom: 4,
  },
  advancedHint: {
    fontSize: 12,
    color: '#64748B',
  },
  disguiseSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingTop: 16,
  },
  disguiseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  disguiseButtonActive: {
    backgroundColor: '#6366F1',
  },
  disguiseText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  disguiseTextActive: {
    color: '#E2E8F0',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.3)',
    backgroundColor: '#0F172A',
  },
  createButton: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
