const server = require("server");

const configuration = {
  type: "managed",
  name: {
    zh_CN: "Bark",
    zh_TW: "Bark",
    en: "Bark",
    ja_JP: "Bark",
    id_ID: "Bark",
  },
  data: [
    {
      key: "server_url",
      name: {
        zh_CN: "Bark 服务器地址",
        zh_TW: "Bark 伺服器位址",
        en: "Bark Server URL",
        ja_JP: "Bark サーバー URL",
        id_ID: "URL Server Bark",
      },
      type: "string",
      required: true,
      default: "https://api.day.app",
      help: {
        zh_CN: "Bark 服务器地址，例如 https://api.day.app，也可以是自建服务器",
        zh_TW: "Bark 伺服器位址，例如 https://api.day.app，也可以是自架伺服器",
        en: "Bark server URL, for example https://api.day.app or a self-hosted server",
        ja_JP: "Bark サーバー URL。例: https://api.day.app、またはセルフホストサーバー",
        id_ID: "URL server Bark, misalnya https://api.day.app atau server yang di-host sendiri",
      },
    },
    {
      key: "device_key",
      name: {
        zh_CN: "设备密钥",
        zh_TW: "裝置金鑰",
        en: "Device Key",
        ja_JP: "デバイスキー",
        id_ID: "Kunci Perangkat",
      },
      type: "string",
      required: true,
      help: {
        zh_CN: "Bark App 中显示的设备密钥",
        zh_TW: "Bark App 中顯示的裝置金鑰",
        en: "The device key shown in the Bark app",
        ja_JP: "Bark アプリに表示されるデバイスキー",
        id_ID: "Kunci perangkat yang ditampilkan di aplikasi Bark",
      },
    },
    {
      key: "icon",
      name: {
        zh_CN: "图标",
        zh_TW: "圖示",
        en: "Icon",
        ja_JP: "アイコン",
        id_ID: "Ikon",
      },
      type: "string",
      help: {
        zh_CN: "图标的 URL 或系统图标名称",
        zh_TW: "圖示 URL 或系統圖示名稱",
        en: "A URL or system icon name",
        ja_JP: "アイコンの URL またはシステムアイコン名",
        id_ID: "URL atau nama ikon sistem",
      },
    },
    {
      key: "level",
      name: {
        zh_CN: "通知级别",
        zh_TW: "通知層級",
        en: "Level",
        ja_JP: "通知レベル",
        id_ID: "Tingkat",
      },
      type: "select",
      options: "active,timeSensitive,passive,critical",
      default: "timeSensitive",
      help: {
        zh_CN: "Bark 通知级别",
        zh_TW: "Bark 通知層級",
        en: "Bark notification level",
        ja_JP: "Bark の通知レベル",
        id_ID: "Tingkat notifikasi Bark",
      },
    },
  ],
};

async function sendBark(notification, config) {
  const deviceKey = String(config.device_key || "").trim();
  if (!deviceKey) throw new Error("device key is required");
  if (!notification.message) throw new Error("message is empty");

  const serverURL = String(config.server_url || "https://api.day.app").replace(/\/+$/, "");
  new URL(serverURL);
  const payload = {
    body: notification.message,
    device_key: deviceKey,
  };
  if (notification.title) payload.title = notification.title;
  if (config.icon) payload.icon = config.icon;
  if (config.level) payload.level = config.level;

  const response = await fetch(serverURL + "/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status !== 200) {
    throw new Error("bark API returned non-OK status: " + response.status);
  }

  const body = await response.text();
  let result;
  try {
    result = JSON.parse(body);
  } catch (_) {
    return;
  }
  if (result.code !== 200) {
    throw new Error(`bark API error (code: ${result.code}): ${result.message || ""}`);
  }
}

function load() {
  server.registerNotificationChannel("bark", configuration, sendBark);
}
