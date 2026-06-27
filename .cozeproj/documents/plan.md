# OfflineChat 开源准备计划

## 概述

将 OfflineChat（离线加密通讯 App）项目整理为可发布到 GitHub 的开源项目。主要工作包括：编写项目专属 README、添加开源许可证、清理模板残留文件、完善 .gitignore。

**平台**：Mobile (React Native / Expo 54 + Express.js)

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 许可证 | Hippocratic License 3.0 | 基于 MIT + 人权条款，引用《世界人权宣言》，禁止用于侵犯人权的活动 |
| README 语言 | 中英双语 | 覆盖国内外开发者 |
| 清理范围 | 模板文件、内部配置 | 去除与开源无关的脚手架内容 |

## 功能模块

### 1. README.md 重写

**职责**：替换当前模板 README，编写项目专属说明

| 内容 | 说明 |
|------|------|
| 项目介绍 | OfflineChat 的核心功能：局域网离线加密通讯、无需互联网、P2P 架构 |
| 功能特性 | 端到端加密、多语言支持(10种)、房间创建/加入、UDP 广播发现、消息伪装等 |
| 技术栈 | Expo 54 + React Native + Express.js + TCP/UDP |
| 快速开始 | 安装依赖、运行开发环境、构建 App |
| 项目结构 | 目录树说明 |
| 多语言 | 支持的语言列表 |
| 安全说明 | 加密方式、免责声明 |
| 许可证 | MIT |

### 2. LICENSE 文件

**职责**：添加 MIT 开源许可证

### 3. .gitignore 完善

**职责**：确保敏感文件和构建产物不被提交

需要补充：
- `.expo/` 目录
- `*.jks`、`*.p12` 等签名文件
- `.env.local`、`.env.production`
- IDE 配置文件

### 4. 清理模板残留

**职责**：移除与开源项目无关的模板文件

| 文件 | 操作 | 理由 |
|------|------|------|
| `AGENTS.md` | 删除 | 开发脚手架内部文档，不属于开源项目 |
| `.coze` | 保留但加入 .gitignore | 平台配置文件 |
| `.cozeproj/` | 加入 .gitignore | 平台内部目录 |
| `demo/` screen | 删除 | 模板示例页面，不属于 OfflineChat |

## 是否有原型设计

否

## 实施步骤

#### 步骤 1：编写 README.md

重写 README.md，包含项目介绍、功能特性、技术栈、快速开始、项目结构、多语言支持、安全说明等内容。中英双语。

涉及文件：`README.md`

#### 步骤 2：添加 LICENSE 和更新 .gitignore

添加 Hippocratic License 3.0 许可证文件，更新 .gitignore 排除敏感文件和构建产物。

涉及文件：`LICENSE`、`.gitignore`

#### 步骤 3：清理模板残留文件

删除 AGENTS.md、demo screen 等模板文件，将 .coze 和 .cozeproj 加入 .gitignore。

涉及文件：`AGENTS.md`、`client/screens/demo/`、`.gitignore`

#### 步骤 4：验证与提交

运行静态检查确保代码无误，验证项目结构完整，提交所有变更。

涉及文件：全局检查
