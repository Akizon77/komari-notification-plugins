const server = require("server");

const configuration = {
  type: "managed",
  name: {
    zh_CN: "Server酱³",
    zh_TW: "Server醬³",
    en: "ServerChan3",
    ja_JP: "Server酱³",
    id_ID: "ServerChan3",
  },
  data: [
    {
      key: "api_url",
      name: {
        zh_CN: "API 地址",
        zh_TW: "API 位址",
        en: "API URL",
        ja_JP: "API URL",
        id_ID: "URL API",
      },
      type: "string",
      required: true,
      help: {
        zh_CN: "完整接口地址，例如 https://<uid>.push.ft07.com/send/<sendkey>.send",
        zh_TW: "完整介面位址，例如 https://<uid>.push.ft07.com/send/<sendkey>.send",
        en: "Full API URL, for example https://<uid>.push.ft07.com/send/<sendkey>.send",
        ja_JP: "完全な API URL。例: https://<uid>.push.ft07.com/send/<sendkey>.send",
        id_ID: "URL API lengkap, misalnya https://<uid>.push.ft07.com/send/<sendkey>.send",
      },
    },
    {
      key: "tags",
      name: {
        zh_CN: "标签",
        zh_TW: "標籤",
        en: "Tags",
        ja_JP: "タグ",
        id_ID: "Tag",
      },
      type: "string",
      help: {
        zh_CN: "可选标签，使用 | 分割，例如 tag1|tag2|tag3",
        zh_TW: "可選標籤，使用 | 分割，例如 tag1|tag2|tag3",
        en: "Optional tags separated by |, for example tag1|tag2|tag3",
        ja_JP: "任意のタグを | で区切ります。例: tag1|tag2|tag3",
        id_ID: "Tag opsional dipisahkan dengan |, misalnya tag1|tag2|tag3",
      },
    },
  ],
};

async function sendServerChan3(notification, config) {
  const apiURL = String(config.api_url || "").trim();
  if (!apiURL) throw new Error("未配置 Server酱³ 接口地址(api_url)");

  const title = String(notification.title || "").trim();
  const message = String(notification.message || "").trim();
  if (!title && !message) throw new Error("serverchan3: 标题与正文均为空");

  const payload = { title, desp: message };
  const tags = String(config.tags || "")
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length) payload.tags = tags.join("|");

  const response = await fetch(apiURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new Error(
      `接口返回非 2xx 状态码: ${response.status}${body ? `，响应: ${body}` : ""}`,
    );
  }
}

function load() {
  server.registerNotificationChannel("Server酱³", configuration, sendServerChan3);
}
