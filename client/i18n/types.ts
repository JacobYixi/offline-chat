/**
 * i18n 类型定义
 */

// 支持的语言
export type SupportedLanguage = 
  | 'zh-CN'    // 中文简体
  | 'zh-TW'    // 中文繁体
  | 'en'       // 英文
  | 'fr'       // 法文
  | 'ru'       // 俄文
  | 'es'       // 西班牙文
  | 'ar'       // 阿拉伯文 (RTL)
  | 'fa'       // 波斯文 (RTL)
  | 'ja'       // 日文
  | 'ko';      // 韩文

// RTL 语言列表
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar', 'fa'];

// 语言配置
export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;           // 原生名称
  nameEn: string;         // 英文名称
  isRTL: boolean;
}

// 翻译键值类型
export interface TranslationKeys {
  // 通用
  common: {
    confirm: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    back: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    notice: string;
    yes: string;
    no: string;
    ok: string;
    retry: string;
    connect: string;
  };

  // 首页
  home: {
    appName: string;
    subtitle: string;
    nickname: string;
    nicknamePlaceholder: string;
    setNickname: string;
    changeNickname: string;
    nicknameRequired: string;
    nicknameLengthError: string;
    nicknameSet: string;
    scanning: string;
    scanComplete: string;
    scanningSubtitle: string;
    noServers: string;
    noServerFound: string;
    noServersHint: string;
    noServerHint: string;
    createRoom: string;
    manualConnect: string;
    manualIP: string;
    enterServerAddress: string;
    ipPlaceholder: string;
    connect: string;
    connectFailed: string;
    enterIP: string;
    online: string;
    usersOnline: string;
    needPassword: string;
    needApproval: string;
    enterPassword: string;
    passwordRequired: string;
    enter8DigitPassword: string;
    wrongPassword: string;
    verifyFailed: string;
    applyToJoin: string;
    approvalRequired: string;
    enterReason: string;
    submitApply: string;
    waitingForApproval: string;
    approved: string;
    rejected: string;
    open: string;
    language: string;
  };

  // 创建房间
  createRoom: {
    title: string;
    roomName: string;
    roomNamePlaceholder: string;
    roomNameHint: string;
    password: string;
    passwordPlaceholder: string;
    passwordHint: string;
    requireApproval: string;
    approvalExpiry: string;
    expiryNever: string;
    expiry1Hour: string;
    expiry24Hours: string;
    expiry7Days: string;
    advancedSettings: string;
    encryption: string;
    encryptionHint: string;
    disguiseType: string;
    disguiseNone: string;
    disguiseWeather: string;
    disguiseCode: string;
    disguiseLog: string;
    disguiseShopping: string;
    createButton: string;
    creating: string;
    created: string;
  };

  // 聊天室
  chat: {
    publicChat: string;
    onlineCount: string;
    onlineUsers: string;
    send: string;
    inputPlaceholder: string;
    noMessages: string;
    noMessagesHint: string;
    mention: string;
    reply: string;
    replyPrefix: string;
    copy: string;
    report: string;
    block: string;
    privateChat: string;
    privateChatPrefix: string;
    privateChatPlaceholder: string;
    privateMessagePlaceholder: string;
    groupChat: string;
    createGroup: string;
    groupMembers: string;
    leaveGroup: string;
    dismissGroup: string;
    transferOwnership: string;
    defaultRoomName: string;
    kicked: string;
    nicknameTaken: string;
    reconnecting: string;
    disguiseMode: string;
    selectDisguiseMode: string;
    controlPanel: string;
    smallGroups: string;
    selectDisguise: string;
    reportUser: string;
    reportedUser: string;
    reportReason: string;
    reportReasonPlaceholder: string;
    submitReport: string;
    reportSubmitted: string;
    anonymous: string;
    blockedUser: string;
  };

  // 在线用户
  users: {
    title: string;
    owner: string;
    you: string;
    kick: string;
    ban: string;
    unban: string;
    privateMessage: string;
  };

  // 房主控制面板
  controlPanel: {
    title: string;
    roomSettings: string;
    setPassword: string;
    removePassword: string;
    approvalList: string;
    pendingApprovals: string;
    approve: string;
    reject: string;
    blacklist: string;
    connectedUsers: string;
    stopServer: string;
  };

  // 举报
  report: {
    title: string;
    reason: string;
    reasonSpam: string;
    reasonHarassment: string;
    reasonInappropriate: string;
    reasonOther: string;
    includeMessages: string;
    submit: string;
    submitted: string;
  };

  // 密码弹窗
  password: {
    title: string;
    subtitle: string;
    placeholder: string;
    submit: string;
    error: string;
  };

  // 申请弹窗
  approval: {
    title: string;
    subtitle: string;
    message: string;
    messagePlaceholder: string;
    submit: string;
    pending: string;
    approved: string;
    rejected: string;
  };

  // 昵称设置
  nickname: {
    title: string;
    subtitle: string;
    placeholder: string;
    startChat: string;
  };

  // 语言设置
  language: {
    title: string;
    followSystem: string;
    followSystemDesc: string;
    zhCN: string;
    zhTW: string;
    en: string;
    fr: string;
    ru: string;
    es: string;
    ar: string;
    fa: string;
    ja: string;
    ko: string;
    rtlNote: string;
  };

  // 连接状态
  connection: {
    connecting: string;
    connected: string;
    disconnected: string;
    reconnecting: string;
    failed: string;
  };

  // 错误提示
  errors: {
    networkError: string;
    serverNotFound: string;
    connectionFailed: string;
    authenticationFailed: string;
    permissionDenied: string;
    invalidPassword: string;
    roomFull: string;
    banned: string;
    apIsolation: string;
  };
}
