import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Screen } from '@/components/Screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';

const NICKNAME_KEY = '@offline_chat_nickname';

export default function NicknameScreen() {
  const [nickname, setNickname] = useState('');
  const router = useSafeRouter();
  const { t } = useTranslation();

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(NICKNAME_KEY, trimmed);
    router.replace('/');
  };

  return (
    <Screen backgroundColor="#F0F0F3">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <FontAwesome6 name="user-pen" size={32} color="#6C63FF" />
          </View>
          <Text style={styles.title}>{t('nickname.title')}</Text>
          <Text style={styles.subtitle}>{t('nickname.subtitle')}</Text>
        </View>

        {/* Input */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t('nickname.placeholder')}
              placeholderTextColor="#B2BEC3"
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
          <Text style={styles.charCount}>{nickname.length}/20</Text>
        </View>

        {/* Button */}
        <TouchableOpacity
          style={[styles.button, !nickname.trim() && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!nickname.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{t('nickname.startChat')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(108,99,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3436',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 32,
  },
  inputContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  input: {
    fontSize: 17,
    color: '#2D3436',
    textAlign: 'center',
    padding: 0,
    ...Platform.select({
      web: { outline: 'none' },
    }),
  },
  charCount: {
    fontSize: 12,
    color: '#B2BEC3',
    textAlign: 'right',
    marginTop: 6,
  },
  button: {
    width: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
