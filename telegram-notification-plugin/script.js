const server = require("server");

const configuration = {
  type: "managed",
  name: {
    zh_CN: "Telegram",
    zh_TW: "Telegram",
    en: "Telegram",
    ja_JP: "Telegram",
    id_ID: "Telegram",
  },
  data: [
    {
      key: "bot_token",
      name: {
        zh_CN: "Telegram Bot Token",
        zh_TW: "Telegram Bot Token",
        en: "Telegram Bot Token",
        ja_JP: "Telegram Bot Token",
        id_ID: "Token Bot Telegram",
      },
      type: "string",
      required: true,
    },
    {
      key: "chat_id",
      name: {
        zh_CN: "Chat ID",
        zh_TW: "Chat ID",
        en: "Chat ID",
        ja_JP: "チャット ID",
        id_ID: "ID Chat",
      },
      type: "string",
      required: true,
    },
    {
      key: "message_thread_id",
      name: {
        zh_CN: "消息话题 ID",
        zh_TW: "訊息話題 ID",
        en: "Message Thread ID",
        ja_JP: "メッセージスレッド ID",
        id_ID: "ID Topik Pesan",
      },
      type: "string",
      help: {
        zh_CN: "超级群组可选的 message thread ID",
        zh_TW: "超級群組可選的 message thread ID",
        en: "Optional message thread identifier for supergroups",
        ja_JP: "スーパーグループ用の任意のメッセージスレッド ID",
        id_ID: "ID topik pesan opsional untuk supergroup",
      },
    },
    {
      key: "endpoint",
      name: {
        zh_CN: "请求端点",
        zh_TW: "請求端點",
        en: "Request Endpoint",
        ja_JP: "リクエストエンドポイント",
        id_ID: "Endpoint Permintaan",
      },
      type: "string",
      required: true,
      default: "https://api.telegram.org/bot",
      help: {
        zh_CN: "Telegram API 端点，例如 https://api.telegram.org/bot",
        zh_TW: "Telegram API 端點，例如 https://api.telegram.org/bot",
        en: "Telegram API endpoint, for example https://api.telegram.org/bot",
        ja_JP: "Telegram API エンドポイント。例: https://api.telegram.org/bot",
        id_ID: "Endpoint API Telegram, misalnya https://api.telegram.org/bot",
      },
    },
  ],
};

async function sendTelegram(notification, config) {
  let message = String(notification.message || "");
  if (notification.title) {
    message = `<b>${notification.title}</b>\n${message}`;
  }
  if (!message) throw new Error("message is empty");

  const form = new URLSearchParams();
  form.set("chat_id", String(config.chat_id || ""));
  form.set("text", message);
  form.set("parse_mode", "HTML");
  if (config.message_thread_id) {
    form.set("message_thread_id", String(config.message_thread_id));
  }

  const endpoint = String(config.endpoint || "https://api.telegram.org/bot");
  const response = await fetch(endpoint + String(config.bot_token || "") + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("failed to decode response: " + error.message);
  }
  if (response.status !== 200) {
    throw new Error(
      result.description
        ? "telegram API error: " + result.description
        : "telegram API returned non-OK status: " + response.status,
    );
  }
  if (!result.ok) {
    throw new Error("telegram API error: " + (result.description || ""));
  }
}

function load() {
  server.registerNotificationChannel("telegram", configuration, sendTelegram);
}
