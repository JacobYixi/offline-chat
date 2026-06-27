/**
 * 语言设置页面
 * 允许用户选择应用显示语言
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
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
      <SafeAreaView className="flex-1 bg-background">
        {/* 顶部导航栏 */}
        <View className="flex-row items-center px-4 py-3 border-b border-border/30">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <FontAwesome6 name="arrow-left" size={20} color="#E2E8F0" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-semibold text-foreground">
            {t('language.title')}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* 跟随系统选项 */}
          <TouchableOpacity
            className={`mx-4 mt-4 flex-row items-center px-4 py-4 rounded-2xl ${
              isSelected('system') ? 'bg-primary/10 border border-primary/30' : 'bg-surface-container'
            }`}
            onPress={() => handleSelectLanguage('system')}
          >
            <View className="flex-1">
              <Text className={`text-base font-medium ${
                isSelected('system') ? 'text-primary' : 'text-foreground'
              }`}>
                {t('language.followSystem')}
              </Text>
              <Text className="text-xs text-muted mt-0.5">
                {t('language.followSystemDesc')}
              </Text>
            </View>
            {isSelected('system') && (
              <FontAwesome6 name="check" size={18} color="#6366F1" />
            )}
          </TouchableOpacity>

          {/* 分割线 */}
          <View className="mx-4 my-4 h-px bg-border/20" />

          {/* 语言列表 */}
          <View className="px-4 pb-6">
            {LANGUAGE_LIST.filter(item => item.code !== 'system').map((item, index) => (
              <TouchableOpacity
                key={item.code}
                className={`flex-row items-center px-4 py-4 rounded-2xl mb-2 ${
                  isSelected(item.code) ? 'bg-primary/10 border border-primary/30' : 'bg-surface-container'
                }`}
                onPress={() => handleSelectLanguage(item.code)}
              >
                <View className="flex-1 flex-row items-center">
                  <Text className={`text-base ${
                    isSelected(item.code) ? 'text-primary font-medium' : 'text-foreground'
                  }`}>
                    {t(item.name)}
                  </Text>
                  {item.isRTL && (
                    <View className="ml-2 px-2 py-0.5 rounded bg-amber-500/20">
                      <Text className="text-xs text-amber-400">RTL</Text>
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
