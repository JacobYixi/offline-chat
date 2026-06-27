# OfflineChat 多语言支持 + 创建房间功能 + UI 修复

## 概述

为 OfflineChat 添加功能和修复问题：
1. **创建房间**：用户可以在 App 内启动服务端，成为房主
2. **多语言支持**：8 种语言（中/英/法/俄/西/阿/日/韩），默认跟随系统，可手动切换
3. **UI 修复**：
   - 修复"手动输入IP地址"按钮无法点击的问题
   - 美化开屏页面

**平台**：Mobile (React Native / Expo 54)

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 服务端嵌入 | react-native-tcp-socket 或 Node.js 运行时 | 在移动端运行 WebSocket 服务 |
| i18n 方案 | 自建轻量 i18n 模块 | 项目文本量可控，无需引入重量级库 |
| 语言检测 | expo-localization | 获取系统语言偏好 |
| 语言持久化 | AsyncStorage | 保存用户手动选择的语言 |
| RTL 支持 | I18nManager (RN 内置) | 阿拉伯文需要从右到左布局 |

## 支持语言

| 语言代码 | 语言名称 | 备注 |
|----------|----------|------|
| zh | 中文 | 默认语言 |
| en | English | |
| fr | Français | |
| ru | Русский | |
| es | Español | |
| ar | العربية | RTL 布局 |
| ja | 日本語 | |
| ko | 한국어 | |

## 功能模块

### 1. 创建房间（服务端嵌入）

**职责**：允许用户在 App 内启动 WebSocket 服务，成为房主

| 功能 | 说明 |
|------|------|
| 创建房间 | 首页添加"创建房间"按钮 |
| 房间设置 | 设置房间名、密码、是否需审批 |
| 启动服务 | 在本机启动 WebSocket 服务 |
| 广播存在 | UDP 广播自己的存在，让其他设备发现 |
| 房主身份 | 自动成为房主，进入聊天室 |
| 停止服务 | 房主可停止服务，结束房间 |

**技术实现**：
- 使用 `react-native-tcp-socket` 或类似库在移动端运行 TCP/WebSocket 服务
- 或使用 Hermes 引擎的 Node.js 兼容特性运行简化版服务端
- 复用 `server/src/chatManager.ts` 的核心逻辑

### 2. i18n 核心模块

**职责**：提供翻译函数、语言切换、系统语言检测

| 功能 | 说明 |
|------|------|
| t(key) | 翻译函数，根据当前语言返回对应文本 |
| setLanguage(lang) | 手动切换语言，持久化到 AsyncStorage |
| getSystemLanguage() | 获取系统语言，映射到支持的语言列表 |
| initI18n() | 初始化：优先读用户设置，否则跟随系统 |

**文件结构**：
```
client/i18n/
├── index.ts          # i18n 核心（Provider、Hook、翻译函数）
├── types.ts          # 语言 key 类型定义
└── locales/
    ├── zh.ts         # 中文
    ├── en.ts         # 英文
    ├── fr.ts         # 法文
    ├── ru.ts         # 俄文
    ├── es.ts         # 西班牙文
    ├── ar.ts         # 阿拉伯文
    ├── ja.ts         # 日文
    └── ko.ts         # 韩文
```

### 3. 语言设置 UI

**职责**：在首页提供语言切换入口

| 功能 | 说明 |
|------|------|
| 语言选择器 | 列表展示 8 种语言，点击切换 |
| 跟随系统 | 默认选项，自动检测系统语言 |
| 手动选择 | 选择后覆盖系统设置，持久化存储 |

### 4. 文本提取

**职责**：将首页和聊天室页面的硬编码文本替换为 t(key) 调用

需要提取的文本包括：
- 首页：标题、按钮、提示语、错误信息
- 聊天室：标题、菜单项、系统消息、弹窗文本、提示语
- 昵称设置页：标题、提示语

## 是否有原型设计

是

## 实施步骤

### 阶段一：原型设计

加载 `design-canvas` 技能，按该技能中的流程完成以下页面的原型设计：
- 首页（添加"创建房间"按钮和语言切换入口）
- 创建房间页（房间设置表单）
- 语言选择页

原型设计完成后提示用户如果不需要修改则进入开发阶段，调用 done 工具提交等候用户确认。用户确认后进入下阶段开发。

### 阶段二：代码开发

#### 步骤 1：创建 i18n 核心模块

创建 `client/i18n/` 目录，实现 i18n Provider、useTranslation Hook、翻译函数。安装 `expo-localization` 依赖。

涉及文件：`client/i18n/index.ts`、`client/i18n/types.ts`

#### 步骤 2：编写 8 种语言翻译文件

为每个语言创建翻译文件，包含所有 UI 文本的翻译。

涉及文件：`client/i18n/locales/zh.ts`、`en.ts`、`fr.ts`、`ru.ts`、`es.ts`、`ar.ts`、`ja.ts`、`ko.ts`

#### 步骤 3：实现创建房间功能

在移动端嵌入 WebSocket 服务，实现房主创建房间的能力。

涉及文件：`client/utils/localServer.ts`、`client/screens/home/index.tsx`、`client/screens/createRoom/index.tsx`

#### 步骤 4：集成 i18n 到应用入口

在 `app/_layout.tsx` 中包裹 I18nProvider，初始化语言设置。

涉及文件：`client/app/_layout.tsx`

#### 步骤 5：改造首页和昵称页

提取所有硬编码文本，替换为 t(key) 调用。添加"创建房间"按钮和语言切换入口。

涉及文件：`client/screens/home/index.tsx`、`client/screens/nickname/index.tsx`

#### 步骤 6：改造聊天室页面

提取所有硬编码文本，替换为 t(key) 调用。处理系统消息的国际化。

涉及文件：`client/screens/chatRoom/index.tsx`

#### 步骤 7：RTL 支持与验证

为阿拉伯文添加 RTL 布局支持。运行静态检查，验证所有页面正常显示。

涉及文件：`client/app/_layout.tsx`、各页面样式

#### 步骤 8：UI 修复

- 修复"手动输入IP地址"按钮无法点击的问题（调整布局层级）
- 美化开屏页面（更新 splash 配置和图标）

涉及文件：`client/screens/home/index.tsx`、`client/app.config.ts`、`client/assets/images/splash-icon.png`
