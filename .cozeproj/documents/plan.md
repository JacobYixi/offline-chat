# 修复计划

## 概述
修复 OfflineChat 移动端应用的两个问题：
1. 语言选择页面和创建房间页面空白（className 样式不生效）
2. 将应用固定为深色模式

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 样式方案 | StyleSheet 内联样式 | 与首页保持一致，避免 NativeWind/Uniwind 兼容性问题 |
| 主题模式 | 固定深色 | 修改 ColorSchemeUpdater.tsx 中的 DEFAULT_THEME |

## 功能模块

### 1. 主题配置
- 文件：`client/components/ColorSchemeUpdater.tsx`
- 修改：`DEFAULT_THEME` 从 `'system'` 改为 `'dark'`

### 2. 语言页面样式修复
- 文件：`client/screens/language/index.tsx`
- 修改：将所有 `className` 替换为 `StyleSheet` 内联样式

### 3. 创建房间页面样式修复
- 文件：`client/screens/createRoom/index.tsx`
- 修改：将所有 `className` 替换为 `StyleSheet` 内联样式

## 是否有原型设计
否

## 实施步骤

1. **修改主题配置** — 将 DEFAULT_THEME 改为 'dark'
   - 涉及文件：`client/components/ColorSchemeUpdater.tsx`

2. **修复语言页面样式** — 将 className 改为 StyleSheet
   - 涉及文件：`client/screens/language/index.tsx`

3. **修复创建房间页面样式** — 将 className 改为 StyleSheet
   - 涉及文件：`client/screens/createRoom/index.tsx`

4. **验证修复效果** — 运行静态检查，确认无报错
   - 验证：静态检查通过
