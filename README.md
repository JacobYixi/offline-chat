# OfflineChat

**离线加密局域网通讯工具 / Offline Encrypted LAN Chat**

[中文](#中文) | [English](#english)

---

## 中文

### 简介

OfflineChat 是一款无需互联网连接的局域网加密通讯应用。在同一局域网（WiFi、热点、有线网络）内，设备之间可以直接进行加密聊天，无需任何中心化服务器。

任何一台设备都可以成为"房主"，启动聊天室服务；其他设备通过 UDP 广播自动发现房间，或手动输入 IP 地址加入。

### 核心特性

- **完全离线** — 无需互联网，局域网内即可通讯
- **端到端加密** — AES-256-CBC + PBKDF2 密钥派生，消息内容全程加密
- **私聊加密** — 基于 ECDH 密钥交换，每对用户拥有独立密钥
- **群组加密** — 小群组消息使用群组共享密钥
- **消息伪装** — 将加密消息伪装成天气预报、代码日志、购物清单等无害内容
- **UDP 广播发现** — 自动发现同一网络内的聊天室
- **房间管理** — 支持密码保护、审批加入机制
- **多语言** — 支持 10 种语言，包括 RTL 布局（阿拉伯语、波斯语）
- **举报系统** — 支持举报不当消息
- **跨平台** — 基于 Expo/React Native，支持 Android、iOS、Web

### 支持语言

| 语言 | 代码 | RTL |
|------|------|-----|
| 简体中文 | zh-CN | |
| 繁体中文 | zh-TW | |
| English | en | |
| Français | fr | |
| Русский | ru | |
| Español | es | |
| العربية | ar | ✓ |
| فارسی | fa | ✓ |
| 日本語 | ja | |
| 한국어 | ko | |

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Expo 54 + React Native + TypeScript |
| 后端 | Express.js + WebSocket |
| 加密 | CryptoJS (AES-256-CBC, PBKDF2, ECDH) |
| 网络 | TCP/UDP (react-native-tcp-socket) |
| 样式 | Tailwind CSS (Uniwind) |
| 路由 | Expo Router |

### 项目结构

```
├── client/                     # React Native 前端
│   ├── app/                    # Expo Router 路由目录
│   ├── screens/                # 页面实现
│   │   ├── home/               # 首页（昵称设置 + 服务器发现）
│   │   ├── chatRoom/           # 聊天室
│   │   ├── createRoom/         # 创建房间
│   │   ├── nickname/           # 昵称设置
│   │   └── language/           # 语言切换
│   ├── i18n/                   # 国际化模块
│   │   └── translations/       # 10 种语言翻译文件
│   ├── utils/                  # 工具函数
│   │   ├── crypto.ts           # 加密模块
│   │   ├── disguise.ts         # 消息伪装
│   │   ├── mobileServer.ts     # 移动端 TCP 服务
│   │   ├── deviceIdentity.ts   # 设备身份
│   │   └── storage.ts          # 本地存储
│   └── hooks/                  # 自定义 Hooks
├── server/                     # Express.js 后端
│   └── src/
│       ├── index.ts            # 服务入口
│       ├── chatManager.ts      # 聊天管理
│       └── broadcast.ts        # UDP 广播
└── package.json
```

### 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发环境
coze dev

# 静态检查
pnpm -w lint:all
```

### 安全说明

- 所有消息在发送前使用 AES-256-CBC 加密，密钥通过 PBKDF2 从共享密钥派生
- 私聊消息使用 ECDH 密钥交换，确保只有对话双方可以解密
- 消息伪装功能可将加密内容伪装成无害文本，防止被识别为加密通讯
- 本工具仅用于合法的局域网通讯场景，请遵守当地法律法规

### 许可证

[Hippocratic License 3.0](./LICENSE) — 基于 MIT，附加人权条款。
引用《世界人权宣言》，禁止将本软件用于侵犯人权的活动。

---

## English

### Introduction

OfflineChat is an encrypted LAN communication app that works without internet access. Devices on the same local network (WiFi, hotspot, wired network) can chat securely with each other — no centralized server required.

Any device can become a "room owner" and start a chat room service. Other devices automatically discover rooms via UDP broadcast, or join manually by entering an IP address.

### Key Features

- **Fully Offline** — No internet needed, works on any local network
- **End-to-End Encryption** — AES-256-CBC + PBKDF2 key derivation, all messages encrypted in transit
- **Private Chat Encryption** — ECDH key exchange, each pair of users has a unique shared secret
- **Group Encryption** — Small group messages use a shared group key
- **Message Disguise** — Disguise encrypted messages as weather reports, code logs, shopping lists, or system logs
- **UDP Broadcast Discovery** — Automatically discover chat rooms on the same network
- **Room Management** — Password protection and approval-based joining
- **Multi-Language** — 10 languages supported, including RTL layouts (Arabic, Persian)
- **Report System** — Report inappropriate messages
- **Cross-Platform** — Built with Expo/React Native for Android, iOS, and Web

### Supported Languages

| Language | Code | RTL |
|----------|------|-----|
| Simplified Chinese | zh-CN | |
| Traditional Chinese | zh-TW | |
| English | en | |
| Français | fr | |
| Русский | ru | |
| Español | es | |
| العربية | ar | ✓ |
| فارسی | fa | ✓ |
| 日本語 | ja | |
| 한국어 | ko | |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Expo 54 + React Native + TypeScript |
| Backend | Express.js + WebSocket |
| Encryption | CryptoJS (AES-256-CBC, PBKDF2, ECDH) |
| Network | TCP/UDP (react-native-tcp-socket) |
| Styling | Tailwind CSS (Uniwind) |
| Routing | Expo Router |

### Project Structure

```
├── client/                     # React Native Frontend
│   ├── app/                    # Expo Router routes
│   ├── screens/                # Screen implementations
│   │   ├── home/               # Home (nickname + server discovery)
│   │   ├── chatRoom/           # Chat room
│   │   ├── createRoom/         # Create room
│   │   ├── nickname/           # Nickname setup
│   │   └── language/           # Language switch
│   ├── i18n/                   # Internationalization
│   │   └── translations/       # 10 language files
│   ├── utils/                  # Utilities
│   │   ├── crypto.ts           # Encryption module
│   │   ├── disguise.ts         # Message disguise
│   │   ├── mobileServer.ts     # Mobile TCP server
│   │   ├── deviceIdentity.ts   # Device identity
│   │   └── storage.ts          # Local storage
│   └── hooks/                  # Custom Hooks
├── server/                     # Express.js Backend
│   └── src/
│       ├── index.ts            # Server entry
│       ├── chatManager.ts      # Chat management
│       └── broadcast.ts        # UDP broadcast
└── package.json
```

### Quick Start

```bash
# Install dependencies
pnpm install

# Start development environment
coze dev

# Run static checks
pnpm -w lint:all
```

### Security Notes

- All messages are encrypted with AES-256-CBC before sending, keys derived via PBKDF2 from a shared secret
- Private chat messages use ECDH key exchange, ensuring only the two participants can decrypt
- Message disguise feature can camouflage encrypted content as innocuous text to avoid detection as encrypted communication
- This tool is intended for legitimate LAN communication scenarios only. Please comply with local laws and regulations

### License

[Hippocratic License 3.0](./LICENSE) — Based on MIT with a human rights clause.
References the Universal Declaration of Human Rights. Prohibits use of the software for activities that violate human rights.
