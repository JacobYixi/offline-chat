/**
 * i18n 国际化模块
 * 支持 8 种语言：中文、英文、法文、俄文、西班牙文、阿拉伯文、日文、韩文
 */

import { useState, useEffect, useCallback } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { SupportedLanguage, RTL_LANGUAGES, LanguageConfig, TranslationKeys } from './types';

// 导入所有翻译文件
import zhCN from './translations/zh-CN';
import en from './translations/en';
import fr from './translations/fr';
import ru from './translations/ru';
import es from './translations/es';
import ar from './translations/ar';
import ja from './translations/ja';
import ko from './translations/ko';

// 语言配置
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  'zh-CN': { code: 'zh-CN', name: '中文（简体）', nameEn: 'Chinese', isRTL: false },
  'en': { code: 'en', name: 'English', nameEn: 'English', isRTL: false },
  'fr': { code: 'fr', name: 'Français', nameEn: 'French', isRTL: false },
  'ru': { code: 'ru', name: 'Русский', nameEn: 'Russian', isRTL: false },
  'es': { code: 'es', name: 'Español', nameEn: 'Spanish', isRTL: false },
  'ar': { code: 'ar', name: 'العربية', nameEn: 'Arabic', isRTL: true },
  'ja': { code: 'ja', name: '日本語', nameEn: 'Japanese', isRTL: false },
  'ko': { code: 'ko', name: '한국어', nameEn: 'Korean', isRTL: false },
};

// 翻译文件映射
const translations: Record<SupportedLanguage, TranslationKeys> = {
  'zh-CN': zhCN,
  'en': en,
  'fr': fr,
  'ru': ru,
  'es': es,
  'ar': ar,
  'ja': ja,
  'ko': ko,
};

// 存储键
const STORAGE_KEY = '@i18n_language';
const FOLLOW_SYSTEM_KEY = '@i18n_follow_system';

// 全局状态
let currentLanguage: SupportedLanguage = 'zh-CN';
let followSystem: boolean = true;
let listeners: Array<() => void> = [];

/**
 * 检测系统语言并映射到支持的语言
 */
function detectSystemLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  if (!locales || locales.length === 0) {
    return 'en';
  }

  const locale = locales[0];
  const languageCode = locale.languageCode?.toLowerCase();
  const regionCode = locale.regionCode?.toUpperCase();

  // 中文特殊处理（区分简繁体，目前只支持简体）
  if (languageCode === 'zh') {
    return 'zh-CN';
  }

  // 其他语言直接映射
  const supportedCodes: SupportedLanguage[] = ['en', 'fr', 'ru', 'es', 'ar', 'ja', 'ko'];
  if (languageCode && supportedCodes.includes(languageCode as SupportedLanguage)) {
    return languageCode as SupportedLanguage;
  }

  // 默认英文
  return 'en';
}

/**
 * 设置 RTL 布局方向
 */
function setRTLDirection(language: SupportedLanguage) {
  const isRTL = RTL_LANGUAGES.includes(language);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }
}

/**
 * 初始化 i18n
 */
export async function initI18n(): Promise<void> {
  try {
    // 读取存储的设置
    const storedFollowSystem = await AsyncStorage.getItem(FOLLOW_SYSTEM_KEY);
    const storedLanguage = await AsyncStorage.getItem(STORAGE_KEY);

    followSystem = storedFollowSystem !== 'false'; // 默认跟随系统

    if (followSystem) {
      currentLanguage = detectSystemLanguage();
    } else if (storedLanguage && storedLanguage in translations) {
      currentLanguage = storedLanguage as SupportedLanguage;
    } else {
      currentLanguage = detectSystemLanguage();
    }

    // 设置 RTL
    setRTLDirection(currentLanguage);
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
    currentLanguage = 'en';
  }
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * 获取当前语言配置
 */
export function getCurrentLanguageConfig(): LanguageConfig {
  return LANGUAGE_CONFIGS[currentLanguage];
}

/**
 * 检查是否跟随系统
 */
export function isFollowingSystem(): boolean {
  return followSystem;
}

/**
 * 设置语言
 */
export async function setLanguage(language: SupportedLanguage | 'system'): Promise<void> {
  try {
    if (language === 'system') {
      followSystem = true;
      currentLanguage = detectSystemLanguage();
      await AsyncStorage.setItem(FOLLOW_SYSTEM_KEY, 'true');
    } else {
      followSystem = false;
      currentLanguage = language;
      await AsyncStorage.setItem(FOLLOW_SYSTEM_KEY, 'false');
      await AsyncStorage.setItem(STORAGE_KEY, language);
    }

    // 设置 RTL
    setRTLDirection(currentLanguage);

    // 通知监听器
    notifyListeners();
  } catch (error) {
    console.error('Failed to set language:', error);
  }
}

/**
 * 获取翻译
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.');
  let value: any = translations[currentLanguage];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // 如果找不到翻译，回退到英文
      value = getFallbackTranslation(path);
      break;
    }
  }

  if (typeof value !== 'string') {
    return path;
  }

  // 替换参数
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      value = value.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    });
  }

  return value;
}

/**
 * 获取回退翻译（英文）
 */
function getFallbackTranslation(path: string): string {
  const keys = path.split('.');
  let value: any = translations['en'];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return path;
    }
  }

  return typeof value === 'string' ? value : path;
}

/**
 * 添加监听器
 */
export function addListener(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

/**
 * 通知所有监听器
 */
function notifyListeners() {
  listeners.forEach(listener => listener());
}

/**
 * React Hook: 使用翻译
 */
export function useTranslation() {
  const [language, setLanguageState] = useState<SupportedLanguage>(currentLanguage);

  useEffect(() => {
    const unsubscribe = addListener(() => {
      setLanguageState(currentLanguage);
    });
    return unsubscribe;
  }, []);

  return {
    t,
    language,
    currentLanguage: language,
    isRTL: RTL_LANGUAGES.includes(language),
    setLanguage,
    followSystem,
  };
}

/**
 * React Hook: 使用当前语言
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<SupportedLanguage>(currentLanguage);

  useEffect(() => {
    const unsubscribe = addListener(() => {
      setLanguageState(currentLanguage);
    });
    return unsubscribe;
  }, []);

  return {
    language,
    isRTL: RTL_LANGUAGES.includes(language),
    followSystem,
    setLanguage,
    config: LANGUAGE_CONFIGS[language],
  };
}

/**
 * Language Provider 组件
 * 用于在应用启动时初始化 i18n
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initI18n().then(() => setIsInitialized(true));
  }, []);

  if (!isInitialized) {
    return null;
  }

  return children as React.ReactElement;
}

// 导出类型
export type { SupportedLanguage, LanguageConfig, TranslationKeys };
