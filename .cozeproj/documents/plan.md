# 修复"创建并启动房间"按钮无响应问题

## 概述
修复 OfflineChat 应用中"创建并启动房间"按钮点击后无反应的问题。

## 问题分析

### 根本原因
`createRoom/index.tsx` 中存在**竞态条件**：

```javascript
// 当前代码流程（有问题）
const result = await startServer({...});  // 1. 立即返回 success

if (result.success) {
  // 2. 然后才添加监听器
  const unsubscribe = addServerListener((event, data) => {
    if (event === 'server:started') { ... }
  });
}
```

而 `mobileServer.ts` 中：
```javascript
server.listen(state.port, HOST);  // 异步触发 listening 事件
return { success: true, port: state.port };  // 立即返回
```

**问题**：如果服务器启动非常快（在 `addServerListener` 调用之前），`server:started` 事件会被错过，导致页面卡在加载状态。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 修复策略 | 先注册监听器再启动服务器 | 避免竞态条件 |
| 影响范围 | 仅前端 | 后端逻辑无需修改 |

## 功能模块

### 修复模块
- **职责**：修复按钮点击后的事件监听时序问题
- **要点**：
  1. 在调用 `startServer` 之前先注册 `addServerListener`
  2. 确保能捕获到 `server:started` 和 `server:error` 事件
  3. 添加超时机制，防止无限等待

## 是否有原型设计
否

## 实施步骤

1. **修复竞态条件** — 调整事件监听器注册时机，确保在 `startServer` 调用前注册
   - 涉及文件：`client/screens/createRoom/index.tsx`

2. **添加超时保护** — 为服务器启动添加超时检测，防止无限等待
   - 涉及文件：`client/screens/createRoom/index.tsx`

3. **验证修复** — 检查代码逻辑，确保事件监听时序正确
   - 涉及文件：`client/screens/createRoom/index.tsx`
