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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        <SafeAreaView className="flex-1 bg-background">
          {/* 顶部导航栏 */}
          <View className="flex-row items-center px-4 py-3 border-b border-border/30">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center"
            >
              <FontAwesome6 name="arrow-left" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-semibold text-white">
              {t('createRoom.title')}
            </Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
            {/* 房间名称 */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-300 mb-2">
                {t('createRoom.roomName')}
              </Text>
              <View className="bg-surface-container rounded-2xl px-4 py-3.5 flex-row items-center">
                <FontAwesome6 name="pen" size={16} color="#64748B" />
                <TextInput
                  className="flex-1 ml-3 text-base text-white"
                  placeholder={t('createRoom.roomNamePlaceholder')}
                  placeholderTextColor="#64748B"
                  value={roomName}
                  onChangeText={setRoomName}
                  maxLength={20}
                  returnKeyType="next"
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1.5 ml-1">
                {t('createRoom.roomNameHint')}
              </Text>
            </View>

            {/* 房间密码 */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-300 mb-2">
                {t('createRoom.password')}
              </Text>
              <View className="bg-surface-container rounded-2xl px-4 py-3.5 flex-row items-center">
                <FontAwesome6 name="lock" size={16} color="#64748B" />
                <TextInput
                  className="flex-1 ml-3 text-base text-white"
                  placeholder={t('createRoom.passwordPlaceholder')}
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  maxLength={8}
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1.5 ml-1">
                {t('createRoom.passwordHint')}
              </Text>
            </View>

            {/* 加入审批 */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between bg-surface-container rounded-2xl px-4 py-4">
                <View className="flex-row items-center flex-1">
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3">
                    <FontAwesome6 name="user-check" size={14} color="#6366F1" />
                  </View>
                  <Text className="text-base text-white flex-1">
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
              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-300 mb-2">
                  {t('createRoom.approvalExpiry')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { value: 'never', label: t('createRoom.expiryNever') },
                    { value: '1h', label: t('createRoom.expiry1Hour') },
                    { value: '24h', label: t('createRoom.expiry24Hours') },
                    { value: '7d', label: t('createRoom.expiry7Days') },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      className={`px-4 py-2.5 rounded-xl ${
                        approvalExpiry === option.value
                          ? 'bg-primary'
                          : 'bg-surface-container'
                      }`}
                      onPress={() => setApprovalExpiry(option.value as ApprovalExpiry)}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          approvalExpiry === option.value ? 'text-white' : 'text-gray-400'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 高级设置 */}
            <View className="mb-6">
              <TouchableOpacity
                className="flex-row items-center justify-between bg-surface-container rounded-2xl px-4 py-4"
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3">
                    <FontAwesome6 name="gear" size={14} color="#6366F1" />
                  </View>
                  <Text className="text-base text-white">
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
                <View className="mt-3 bg-surface-container/50 rounded-2xl p-4">
                  {/* 端到端加密 */}
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-1 mr-4">
                      <Text className="text-base text-white mb-1">
                        {t('createRoom.encryption')}
                      </Text>
                      <Text className="text-xs text-gray-500">
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
                  <View className="border-t border-border/20 pt-4">
                    <Text className="text-sm font-medium text-gray-300 mb-2">
                      {t('createRoom.disguiseType')}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {[
                        { value: 'none', label: t('createRoom.disguiseNone') },
                        { value: 'weather', label: t('createRoom.disguiseWeather') },
                        { value: 'code', label: t('createRoom.disguiseCode') },
                        { value: 'log', label: t('createRoom.disguiseLog') },
                        { value: 'shopping', label: t('createRoom.disguiseShopping') },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          className={`px-3 py-2 rounded-lg ${
                            disguiseType === option.value
                              ? 'bg-primary'
                              : 'bg-background'
                          }`}
                          onPress={() => setDisguiseType(option.value as DisguiseType)}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              disguiseType === option.value ? 'text-white' : 'text-gray-400'
                            }`}
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
          <View className="px-4 pb-6 pt-3 border-t border-border/30 bg-background">
            <TouchableOpacity
              className="bg-primary rounded-2xl py-4 items-center justify-center flex-row"
              onPress={handleCreateRoom}
              disabled={isCreating}
              style={{
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              {isCreating ? (
                <>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text className="text-white text-base font-semibold ml-2">
                    {t('createRoom.creating')}
                  </Text>
                </>
              ) : (
                <>
                  <FontAwesome6 name="play" size={16} color="#FFF" style={{ marginRight: 8 }} />
                  <Text className="text-white text-base font-semibold">
                    {t('createRoom.createButton')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
