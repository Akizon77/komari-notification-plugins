const net = require("net");
const tls = require("tls");
const server = require("server");

const configuration = {
  type: "managed",
  name: {
    zh_CN: "Email",
    zh_TW: "Email",
    en: "Email",
    ja_JP: "メール",
    id_ID: "Email",
  },
  data: [
    {
      key: "host",
      name: {
        zh_CN: "SMTP 服务器",
        zh_TW: "SMTP 伺服器",
        en: "SMTP Server",
        ja_JP: "SMTP サーバー",
        id_ID: "Server SMTP",
      },
      type: "string",
      required: true,
    },
    {
      key: "port",
      name: {
        zh_CN: "端口",
        zh_TW: "連接埠",
        en: "Port",
        ja_JP: "ポート",
        id_ID: "Port",
      },
      type: "number",
      required: true,
      default: 587,
    },
    {
      key: "username",
      name: {
        zh_CN: "用户名",
        zh_TW: "使用者名稱",
        en: "Username",
        ja_JP: "ユーザー名",
        id_ID: "Nama Pengguna",
      },
      type: "string",
    },
    {
      key: "password",
      name: {
        zh_CN: "密码",
        zh_TW: "密碼",
        en: "Password",
        ja_JP: "パスワード",
        id_ID: "Kata Sandi",
      },
      type: "string",
    },
    {
      key: "sender",
      name: {
        zh_CN: "发件人邮箱",
        zh_TW: "寄件者電子郵件",
        en: "Sender Email",
        ja_JP: "送信元メールアドレス",
        id_ID: "Email Pengirim",
      },
      type: "string",
    },
    {
      key: "receiver",
      name: {
        zh_CN: "收件人邮箱",
        zh_TW: "收件者電子郵件",
        en: "Receiver Email",
        ja_JP: "宛先メールアドレス",
        id_ID: "Email Penerima",
      },
      type: "string",
    },
    {
      key: "use_ssl",
      name: {
        zh_CN: "启用 SSL",
        zh_TW: "啟用 SSL",
        en: "Enable SSL",
        ja_JP: "SSL を有効化",
        id_ID: "Aktifkan SSL",
      },
      type: "switch",
      default: false,
    },
    {
      key: "use_login_auth",
      name: {
        zh_CN: "使用 LOGIN 认证",
        zh_TW: "使用 LOGIN 驗證",
        en: "Use LOGIN authentication",
        ja_JP: "LOGIN 認証を使用",
        id_ID: "Gunakan autentikasi LOGIN",
      },
      type: "switch",
      default: false,
      help: {
        zh_CN: "如果邮件服务商要求使用 LOGIN 认证，请开启；否则使用 PLAIN",
        zh_TW: "如果郵件服務商要求使用 LOGIN 驗證，請開啟；否則使用 PLAIN",
        en: "Use LOGIN instead of PLAIN for providers that require it",
        ja_JP: "LOGIN 認証が必要なプロバイダーでは有効にします。それ以外は PLAIN を使用します",
        id_ID: "Gunakan LOGIN alih-alih PLAIN untuk penyedia yang memerlukannya",
      },
    },
  ],
};

class SMTPClient {
  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.lines = [];
    this.responses = [];
    this.waiters = [];
    this.failure = null;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => this.receive(chunk));
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("SMTP connection closed")));
  }

  receive(chunk) {
    this.buffer += chunk;
    while (true) {
      const end = this.buffer.indexOf("\n");
      if (end < 0) return;
      const line = this.buffer.slice(0, end).replace(/\r$/, "");
      this.buffer = this.buffer.slice(end + 1);
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!match) continue;
      this.lines.push(line);
      if (match[2] === " ") {
        this.pushResponse({ code: Number(match[1]), lines: this.lines });
        this.lines = [];
      }
    }
  }

  pushResponse(response) {
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve(response);
    else this.responses.push(response);
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  readResponse() {
    if (this.responses.length) return Promise.resolve(this.responses.shift());
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async command(command, expected) {
    this.socket.write(command + "\r\n");
    const response = await this.readResponse();
    if (!expected.includes(response.code)) {
      throw new Error(`SMTP command failed (${response.code}): ${response.lines.join(" | ")}`);
    }
    return response;
  }

  async expect(expected) {
    const response = await this.readResponse();
    if (!expected.includes(response.code)) {
      throw new Error(`SMTP response failed (${response.code}): ${response.lines.join(" | ")}`);
    }
    return response;
  }

  async hello() {
    try {
      return await this.command("EHLO localhost", [250]);
    } catch (_) {
      return this.command("HELO localhost", [250]);
    }
  }
}

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    socket.once(event, resolve);
    socket.once("error", reject);
  });
}

async function connectSMTP(host, port, useSSL) {
  if (useSSL && port === 465) {
    const socket = tls.connect({ host, port, servername: host });
    await waitFor(socket, "secureConnect");
    return new SMTPClient(socket);
  }
  const socket = net.connect({ host, port });
  await waitFor(socket, "connect");
  return new SMTPClient(socket);
}

function addressOnly(value) {
  const text = String(value || "").trim();
  const match = /<([^<>]+)>/.exec(text);
  return (match ? match[1] : text).trim();
}

function recipients(value) {
  return String(value || "")
    .split(",")
    .map((item) => ({ header: item.trim(), address: addressOnly(item) }))
    .filter((item) => item.address);
}

function encodeSubject(value) {
  const text = String(value || "");
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function encodeBody(value) {
  const encoded = Buffer.from(String(value || ""), "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function buildMessage(notification, config, recipientList) {
  const body = String(notification.message || "");
  const lower = body.trim().toLowerCase();
  const html =
    lower.includes("<html") ||
    lower.includes("<!doctype") ||
    (lower.includes("<div") && lower.includes("</div>"));
  const headers = [
    "To: " + recipientList.map((item) => item.header).join(", "),
    "From: " + config.sender,
    "Subject: " + encodeSubject(notification.title),
    "MIME-Version: 1.0",
    `Content-Type: ${html ? "text/html" : "text/plain"}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
    "Date: " + new Date().toUTCString(),
    `Message-ID: <${Date.now()}.${Math.random().toString(16).slice(2)}@${config.host}>`,
  ];
  return headers.join("\r\n") + "\r\n\r\n" + encodeBody(body);
}

async function authenticate(client, config) {
  if (config.use_login_auth) {
    await client.command("AUTH LOGIN", [334]);
    await client.command(Buffer.from(config.username, "utf8").toString("base64"), [334]);
    await client.command(Buffer.from(config.password, "utf8").toString("base64"), [235]);
    return;
  }
  const token = Buffer.from(`\0${config.username}\0${config.password}`, "utf8").toString("base64");
  await client.command("AUTH PLAIN " + token, [235]);
}

async function sendEmail(notification, config) {
  const host = String(config.host || "").trim();
  const port = Number(config.port || 587);
  const sender = addressOnly(config.sender);
  const recipientList = recipients(config.receiver);
  if (!host || !sender || !config.username || !config.password || !recipientList.length) {
    throw new Error("email sending is not fully configured");
  }

  let client = await connectSMTP(host, port, Boolean(config.use_ssl));
  try {
    await client.expect([220]);
    await client.hello();

    if (config.use_ssl && port !== 465) {
      await client.command("STARTTLS", [220]);
      const secureSocket = tls.connect({ socket: client.socket, servername: host });
      await waitFor(secureSocket, "secureConnect");
      client = new SMTPClient(secureSocket);
      await client.hello();
    }

    await authenticate(client, config);
    await client.command(`MAIL FROM:<${sender}>`, [250]);
    for (const recipient of recipientList) {
      await client.command(`RCPT TO:<${recipient.address}>`, [250, 251]);
    }
    await client.command("DATA", [354]);
    const message = buildMessage(notification, { ...config, host }, recipientList)
      .replace(/\r?\n/g, "\r\n")
      .replace(/^\./gm, "..");
    client.socket.write(message + "\r\n.\r\n");
    await client.expect([250]);
    await client.command("QUIT", [221]);
    client.socket.end();
  } catch (error) {
    client.socket.destroy();
    throw error;
  }
}

function load() {
  server.registerNotificationChannel("email", configuration, sendEmail);
}
