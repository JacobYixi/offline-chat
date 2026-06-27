/**
 * 语言设置页面
 * 允许用户选择应用显示语言
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useTranslation, useLanguage, LANGUAGE_CONFIGS, SupportedLanguage } from '@/i18n';
import { useSafeRouter } from '@/hooks/useSafeRouter';

// 语言列表配置
const LANGUAGE_LIST: Array<{
  code: SupportedLanguage | 'system';
  name: string;
  subtitle?: string;
  isRTL?: boolean;
}> = [
  { code: 'system', name: 'language.followSystem', subtitle: 'language.followSystemDesc' },
  { code: 'zh-CN', name: 'language.zhCN' },
  { code: 'zh-TW', name: 'language.zhTW' },
  { code: 'en', name: 'language.en' },
  { code: 'fr', name: 'language.fr' },
  { code: 'ru', name: 'language.ru' },
  { code: 'es', name: 'language.es' },
  { code: 'ar', name: 'language.ar', isRTL: true },
  { code: 'fa', name: 'language.fa', isRTL: true },
  { code: 'ja', name: 'language.ja' },
  { code: 'ko', name: 'language.ko' },
];

export default function LanguageScreen() {
  const router = useSafeRouter();
  const { t } = useTranslation();
  const { language, setLanguage, followSystem } = useLanguage();

  // 选择语言
  const handleSelectLanguage = async (code: SupportedLanguage | 'system') => {
    await setLanguage(code);
    // 延迟返回，让用户看到选择效果
    setTimeout(() => {
      router.back();
    }, 300);
  };

  // 检查是否选中
  const isSelected = (code: SupportedLanguage | 'system') => {
    if (code === 'system') return followSystem;
    return !followSystem && language === code;
  };

  return (
    <Screen>
      <SafeAreaView style={styles.container}>
        {/* 顶部导航栏 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome6 name="arrow-left" size={20} color="#E2E8F0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('language.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* 跟随系统选项 */}
          <TouchableOpacity
            style={[
              styles.languageCard,
              isSelected('system') && styles.languageCardSelected,
            ]}
            onPress={() => handleSelectLanguage('system')}
          >
            <View style={styles.languageCardContent}>
              <Text style={[
                styles.languageName,
                isSelected('system') && styles.languageNameSelected,
              ]}>
                {t('language.followSystem')}
              </Text>
              <Text style={styles.languageDesc}>
                {t('language.followSystemDesc')}
              </Text>
            </View>
            {isSelected('system') && (
              <FontAwesome6 name="check" size={18} color="#6366F1" />
            )}
          </TouchableOpacity>

          {/* 分割线 */}
          <View style={styles.divider} />

          {/* 语言列表 */}
          <View style={styles.languageList}>
            {LANGUAGE_LIST.filter(item => item.code !== 'system').map((item, index) => (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.languageItem,
                  isSelected(item.code) && styles.languageCardSelected,
                ]}
                onPress={() => handleSelectLanguage(item.code)}
              >
                <View style={styles.languageItemContent}>
                  <Text style={[
                    styles.languageItemName,
                    isSelected(item.code) && styles.languageNameSelected,
                  ]}>
                    {t(item.name)}
                  </Text>
                  {item.isRTL && (
                    <View style={styles.rtlBadge}>
                      <Text style={styles.rtlBadgeText}>RTL</Text>
                    </View>
                  )}
                </View>
                {isSelected(item.code) && (
                  <FontAwesome6 name="check" size={18} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419',
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  languageCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  languageCardContent: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  languageNameSelected: {
    color: '#6366F1',
    fontWeight: '500',
  },
  languageDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  divider: {
    marginHorizontal: 16,
    marginVertical: 16,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  languageList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#1E293B',
  },
  languageItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageItemName: {
    fontSize: 16,
    color: '#E2E8F0',
  },
  rtlBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  rtlBadgeText: {
    fontSize: 12,
    color: '#F59E0B',
  },
});
