/**
 * 内容伪装工具
 * 将加密后的消息伪装成各种无害内容
 * 支持多种伪装模式：天气、代码日志、购物清单、系统日志
 */

export type DisguiseMode = 'none' | 'weather' | 'code' | 'shopping' | 'syslog';

export interface DisguiseOption {
  mode: DisguiseMode;
  label: string;
  icon: string;
  description: string;
}

export const DISGUISE_OPTIONS: DisguiseOption[] = [
  { mode: 'none', label: '普通聊天', icon: 'comment', description: '正常显示消息内容' },
  { mode: 'weather', label: '天气预报', icon: 'cloud-sun', description: '消息伪装成天气数据' },
  { mode: 'code', label: '代码日志', icon: 'code', description: '消息伪装成程序运行日志' },
  { mode: 'shopping', label: '购物清单', icon: 'cart-shopping', description: '消息伪装成购物列表' },
  { mode: 'syslog', label: '系统日志', icon: 'server', description: '消息伪装成系统运行日志' },
];

// ─── 伪装数据池 ───

const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆'];
const WEATHERS = ['晴', '多云', '阴', '小雨', '大风', '雾', '雷阵雨'];
const ITEMS = ['苹果', '牛奶', '面包', '鸡蛋', '咖啡', '茶叶', '饼干', '果汁', '酸奶', '坚果'];
const MODULES = ['auth', 'cache', 'db', 'network', 'scheduler', 'worker', 'gateway', 'proxy'];
const ACTIONS = ['heartbeat', 'sync', 'flush', 'rotate', 'checkpoint', 'gc', 'rebalance', 'ping'];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

// ─── 伪装：加密文本 → 伪装文本 ───

export function disguise(encryptedText: string, mode: DisguiseMode, senderName: string, timestamp: number): string {
  if (mode === 'none') return encryptedText;

  const seed = hashCode(encryptedText);
  const timeStr = new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  switch (mode) {
    case 'weather':
      return disguiseWeather(encryptedText, seed, timeStr, senderName);
    case 'code':
      return disguiseCode(encryptedText, seed, timeStr);
    case 'shopping':
      return disguiseShopping(encryptedText, seed);
    case 'syslog':
      return disguiseSyslog(encryptedText, seed, timeStr);
    default:
      return encryptedText;
  }
}

// ─── 还原：伪装文本 → 加密文本 ───

export function undisguise(disguisedText: string, mode: DisguiseMode): string | null {
  if (mode === 'none') return disguisedText;

  switch (mode) {
    case 'weather':
      return undisguiseWeather(disguisedText);
    case 'code':
      return undisguiseCode(disguisedText);
    case 'shopping':
      return undisguiseShopping(disguisedText);
    case 'syslog':
      return undisguiseSyslog(disguisedText);
    default:
      return disguisedText;
  }
}

// ─── 天气伪装 ───
// 格式: [时间] @昵称 城市: 天气, 温度°C, 湿度%, 风力级 | DATA:base64

function disguiseWeather(text: string, seed: number, time: string, sender: string): string {
  const cityIdx = Math.floor(seededRandom(seed, 0) * CITIES.length);
  const weatherIdx = Math.floor(seededRandom(seed, 1) * WEATHERS.length);
  const temp = Math.floor(seededRandom(seed, 2) * 35) - 5;
  const humidity = Math.floor(seededRandom(seed, 3) * 60) + 30;
  const wind = Math.floor(seededRandom(seed, 4) * 8) + 1;

  return `[${time}] ${sender} ${CITIES[cityIdx]}: ${WEATHERS[weatherIdx]}, ${temp}°C, 湿度${humidity}%, ${wind}级风 | DATA:${text}`;
}

function undisguiseWeather(text: string): string | null {
  const match = text.match(/\| DATA:(.+)$/);
  return match ? match[1] : null;
}

// ─── 代码日志伪装 ───
// 格式: [时间] [INFO] module=xxx action=xxx status=200 latency=xxms data=base64

function disguiseCode(text: string, seed: number, time: string): string {
  const modIdx = Math.floor(seededRandom(seed, 0) * MODULES.length);
  const actIdx = Math.floor(seededRandom(seed, 1) * ACTIONS.length);
  const latency = Math.floor(seededRandom(seed, 2) * 200) + 5;
  const status = seededRandom(seed, 3) > 0.1 ? 200 : 201;

  return `[${time}] [INFO] module=${MODULES[modIdx]} action=${ACTIONS[actIdx]} status=${status} latency=${latency}ms data=${text}`;
}

function undisguiseCode(text: string): string | null {
  const match = text.match(/data=(.+)$/);
  return match ? match[1] : null;
}

// ─── 购物清单伪装 ───
// 格式: 多行，每行一个商品，最后一行包含隐藏数据
// #购物清单 #日期
// - 商品名 x数量 ¥价格
// ...
// [备注: base64data]

function disguiseShopping(text: string, seed: number): string {
  const itemCount = Math.floor(seededRandom(seed, 0) * 4) + 2;
  const lines: string[] = ['#购物清单'];

  for (let i = 0; i < itemCount; i++) {
    const itemIdx = Math.floor(seededRandom(seed, i + 1) * ITEMS.length);
    const qty = Math.floor(seededRandom(seed, i + 10) * 3) + 1;
    const price = (seededRandom(seed, i + 20) * 50 + 5).toFixed(1);
    lines.push(`- ${ITEMS[itemIdx]} x${qty} ¥${price}`);
  }

  lines.push(`[备注: ${text}]`);
  return lines.join('\n');
}

function undisguiseShopping(text: string): string | null {
  const match = text.match(/\[备注: (.+)\]$/);
  return match ? match[1] : null;
}

// ─── 系统日志伪装 ───
// 格式: 时间 [LEVEL] host=xxx pid=xxxx | mem=xx% cpu=xx% | chk=base64

function disguiseSyslog(text: string, seed: number, time: string): string {
  const hostIdx = Math.floor(seededRandom(seed, 0) * 8);
  const pid = Math.floor(seededRandom(seed, 1) * 9000) + 1000;
  const mem = Math.floor(seededRandom(seed, 2) * 60) + 20;
  const cpu = Math.floor(seededRandom(seed, 3) * 40) + 5;
  const level = seededRandom(seed, 4) > 0.2 ? 'INFO' : 'DEBUG';
  const hosts = ['web-01', 'web-02', 'api-01', 'api-02', 'db-01', 'cache-01', 'worker-01', 'gateway-01'];

  return `${time} [${level}] host=${hosts[hostIdx]} pid=${pid} | mem=${mem}% cpu=${cpu}% | chk=${text}`;
}

function undisguiseSyslog(text: string): string | null {
  const match = text.match(/\| chk=(.+)$/);
  return match ? match[1] : null;
}
