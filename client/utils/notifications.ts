/**
 * 通知系统 - 简化版本
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationSettings {
  sound: boolean;
  vibration: boolean;
  localNotification: boolean;
  banner: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  sound: true,
  vibration: true,
  localNotification: true,
  banner: true,
};

const SETTINGS_KEY = '@chat:notification_settings';

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const settings = await AsyncStorage.getItem(SETTINGS_KEY);
  if (settings) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
  }
  return DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function updateNotificationSetting<K extends keyof NotificationSettings>(
  key: K,
  value: NotificationSettings[K]
): Promise<void> {
  const currentSettings = await getNotificationSettings();
  currentSettings[key] = value;
  await saveNotificationSettings(currentSettings);
}

export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
}

export async function triggerVibration(
  style: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
): Promise<void> {
  const settings = await getNotificationSettings();
  if (settings.vibration && Platform.OS !== 'web') {
    await Haptics.notificationAsync(style);
  }
}

export async function playSound(): Promise<void> {
  const settings = await getNotificationSettings();
  if (settings.sound && Platform.OS !== 'web') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

export async function sendLocalNotification(): Promise<string> {
  return '';
}

export async function cancelNotification(): Promise<void> {}

export async function cancelAllNotifications(): Promise<void> {}

export async function getBadgeCount(): Promise<number> {
  return 0;
}

export async function setBadgeCount(): Promise<void> {}

export async function clearBadgeCount(): Promise<void> {}

export enum MessageNotificationType {
  GROUP_MESSAGE = 'group_message',
  PRIVATE_MESSAGE = 'private_message',
  GROUP_MENTION = 'group_mention',
  JOIN_REQUEST = 'join_request',
  REPORT = 'report',
}

export async function sendMessageNotification(
  type: MessageNotificationType,
  senderName: string,
  messagePreview: string,
  data?: Record<string, unknown>
): Promise<void> {
  const settings = await getNotificationSettings();
  
  if (settings.vibration) {
    await triggerVibration();
  }

  if (settings.sound) {
    await playSound();
  }

  if (settings.localNotification) {
    let title = '';
    let body = '';

    switch (type) {
      case MessageNotificationType.GROUP_MESSAGE:
        title = senderName;
        body = messagePreview;
        break;
      case MessageNotificationType.PRIVATE_MESSAGE:
        title = senderName + ' 私聊';
        body = messagePreview;
        break;
      case MessageNotificationType.GROUP_MENTION:
        title = senderName + ' 提到了你';
        body = messagePreview;
        break;
      case MessageNotificationType.JOIN_REQUEST:
        title = '新的加入申请';
        body = senderName + ' 申请加入聊天室';
        break;
      case MessageNotificationType.REPORT:
        title = '新的举报';
        body = senderName + ' 提交了举报';
        break;
    }

    await sendLocalNotification();
  }
}
