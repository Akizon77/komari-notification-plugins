const server = require("server");

const configuration = {
  type: "managed",
  name: {
    zh_CN: "Server酱Turbo",
    zh_TW: "Server醬Turbo",
    en: "ServerChan Turbo",
    ja_JP: "Server酱Turbo",
    id_ID: "ServerChan Turbo",
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
        zh_CN: "完整接口地址，例如 https://sctapi.ftqq.com/<sendkey>.send",
        zh_TW: "完整介面位址，例如 https://sctapi.ftqq.com/<sendkey>.send",
        en: "Full API URL, for example https://sctapi.ftqq.com/<sendkey>.send",
        ja_JP: "完全な API URL。例: https://sctapi.ftqq.com/<sendkey>.send",
        id_ID: "URL API lengkap, misalnya https://sctapi.ftqq.com/<sendkey>.send",
      },
    },
    {
      key: "channel",
      name: {
        zh_CN: "消息通道",
        zh_TW: "訊息通道",
        en: "Channel",
        ja_JP: "チャンネル",
        id_ID: "Saluran",
      },
      type: "string",
      help: {
        zh_CN: "消息通道，可选，多个用 | 隔开，例如 9|66",
        zh_TW: "訊息通道，可選，多個請用 | 隔開，例如 9|66",
        en: "Optional message channels separated by |, for example 9|66",
        ja_JP: "任意のメッセージチャンネルを | で区切ります。例: 9|66",
        id_ID: "Saluran pesan opsional dipisahkan dengan |, misalnya 9|66",
      },
    },
    {
      key: "noip",
      name: {
        zh_CN: "隐藏 IP",
        zh_TW: "隱藏 IP",
        en: "Hide IP",
        ja_JP: "IP を隠す",
        id_ID: "Sembunyikan IP",
      },
      type: "string",
      help: {
        zh_CN: "填 1 隐藏调用 IP；为空则不隐藏",
        zh_TW: "填 1 隱藏呼叫 IP；留空則不隱藏",
        en: "Set to 1 to hide the calling IP; leave empty to disable",
        ja_JP: "1 を指定すると呼び出し元 IP を隠します。空欄では無効です",
        id_ID: "Isi 1 untuk menyembunyikan IP pemanggil; kosongkan untuk menonaktifkan",
      },
    },
    {
      key: "openid",
      name: {
        zh_CN: "OpenID",
        zh_TW: "OpenID",
        en: "OpenID",
        ja_JP: "OpenID",
        id_ID: "OpenID",
      },
      type: "string",
      help: {
        zh_CN: "抄送 openid，测试号用 , 分隔；企业微信应用用 | 分隔",
        zh_TW: "副本 openid，測試號用 , 分隔；企業微信應用用 | 分隔",
        en: "CC OpenIDs; separate test account IDs with , and WeCom app IDs with |",
        ja_JP: "OpenID を CC します。テスト番号は ,、WeCom アプリは | で区切ります",
        id_ID: "CC OpenID; pisahkan ID akun uji dengan , dan ID aplikasi WeCom dengan |",
      },
    },
  ],
};

async function sendServerChanTurbo(notification, config) {
  const apiURL = String(config.api_url || "").trim();
  if (!apiURL) throw new Error("未配置 Server酱 Turbo 接口地址(api_url)");

  const title = String(notification.title || "").trim();
  const message = String(notification.message || "").trim();
  if (!title && !message) throw new Error("serverchanturbo: 标题与正文均为空");

  const payload = { title, desp: message };
  if (String(config.channel || "").trim()) payload.channel = String(config.channel).trim();
  if (String(config.noip || "").trim() === "1") payload.noip = "1";
  if (String(config.openid || "").trim()) payload.openid = String(config.openid).trim();

  const response = await fetch(apiURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.text()).trim();
    throw new Error(
      `serverchanturbo: 接口返回非 2xx 状态码: ${response.status}${body ? `，响应: ${body}` : ""}`,
    );
  }
}

function load() {
  server.registerNotificationChannel("Server酱Turbo", configuration, sendServerChanTurbo);
}
