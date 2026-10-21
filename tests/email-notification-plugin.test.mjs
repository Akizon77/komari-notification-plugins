import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import net from "node:net";
import test from "node:test";
import tls from "node:tls";
import vm from "node:vm";
import selfsigned from "selfsigned";

const source = readFileSync(new URL("../email-notification-plugin/script.js", import.meta.url), "utf8");
// Generate fresh local test credentials in memory; never persist private keys.
const now = Date.now();
const { private: key, cert } = await selfsigned.generate(
  [{ name: "commonName", value: "localhost" }],
  {
    algorithm: "sha256",
    keySize: 2048,
    notBeforeDate: new Date(now - 24 * 60 * 60 * 1000),
    notAfterDate: new Date(now + 24 * 60 * 60 * 1000),
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }] },
    ],
  },
);
const secureContext = tls.createSecureContext({ key, cert });
const config = {
  host: "localhost",
  port: 587,
  username: "test-user",
  password: "test-password",
  sender: "sender@example.test",
  receiver: "receiver@example.test",
  use_ssl: false,
};

function loadPlugin(port, options = {}) {
  let send;
  const rawSockets = new WeakMap();
  function deferSocketMethods(socket, readyEvent) {
    // Komari returns event emitters and adds stream methods only after connecting.
    const placeholder = new EventEmitter();
    rawSockets.set(placeholder, socket);
    if (readyEvent === "secureConnect") placeholder.destroy = socket.destroy.bind(socket);
    socket.once(readyEvent, () => {
      for (const method of ["setEncoding", "write", "end", "destroy"]) {
        placeholder[method] = socket[method].bind(socket);
      }
      placeholder.emit(readyEvent);
    });
    for (const event of ["data", "error", "close"]) {
      socket.on(event, (...args) => placeholder.emit(event, ...args));
    }
    return placeholder;
  }
  const context = {
    Buffer,
    require(name) {
      if (name === "server") {
        return {
          registerNotificationChannel(id, _configuration, callback) {
            assert.equal(id, "email");
            send = callback;
          },
        };
      }
      if (name === "net") {
        return {
          connect(connectOptions) {
            if (options.connectionError) {
              const placeholder = new EventEmitter();
              queueMicrotask(() => placeholder.emit("error", options.connectionError));
              return placeholder;
            }
            const socket = net.connect({ ...connectOptions, host: "127.0.0.1", port });
            return options.deferMethods ? deferSocketMethods(socket, "connect") : socket;
          },
        };
      }
      if (name === "tls") {
        return {
          connect(connectOptions) {
            const socket = tls.connect({
              ...connectOptions,
              ...(connectOptions.socket
                ? { socket: rawSockets.get(connectOptions.socket) ?? connectOptions.socket }
                : { host: "127.0.0.1", port }),
              ...(options.trustFixture !== false ? { ca: cert } : {}),
            });
            return options.deferMethods ? deferSocketMethods(socket, "secureConnect") : socket;
          },
        };
      }
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(source + "\nload();", context, { filename: "email-notification-plugin/script.js" });
  assert.equal(typeof send, "function");
  return send;
}

async function smtpFixture(t, options = {}) {
  const sockets = new Set();
  const commands = [];
  const messages = [];
  let connections = 0;

  function attach(socket, encrypted) {
    sockets.add(socket);
    socket.on("error", () => {}); // Intentional handshake failures are asserted on the client.
    socket.once("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    let buffer = "";
    let body = null;
    let loginStep = 0;
    function receive(chunk) {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (body !== null) {
          if (line === ".") {
            messages.push(body.join("\r\n"));
            body = null;
            socket.write("250 Message accepted\r\n");
          } else {
            body.push(line);
          }
          continue;
        }
        commands.push({ line, encrypted });
        if (loginStep) {
          if (loginStep === 1) {
            assert.equal(line, Buffer.from(config.username).toString("base64"));
            loginStep = 2;
            socket.write("334 UGFzc3dvcmQ6\r\n");
          } else {
            assert.equal(line, Buffer.from(config.password).toString("base64"));
            loginStep = 0;
            socket.write("235 Authenticated\r\n");
          }
        } else if (line.startsWith("EHLO ")) {
          if (options.rejectEHLO) {
            socket.write("502 EHLO unsupported\r\n");
          } else {
            const capability = !encrypted && options.capability !== null
              ? `250-${options.capability ?? "STARTTLS"}\r\n` : "";
            const response = `250-localhost\r\n${capability}250 AUTH PLAIN LOGIN\r\n`;
            if (options.fragmentEHLO) {
              const split = response.indexOf("STARTTLS") + 4;
              socket.write(response.slice(0, split));
              setImmediate(() => socket.write(response.slice(split)));
            } else {
              socket.write(response);
            }
          }
        } else if (line.startsWith("HELO ")) {
          socket.write("250 localhost\r\n");
        } else if (line === "STARTTLS") {
          if (options.rejectSTARTTLS) {
            socket.write("454 TLS temporarily unavailable\r\n");
          } else {
            socket.write("220 Ready to start TLS\r\n");
            socket.removeListener("data", receive);
            if (options.failHandshake) {
              socket.end("This is not a TLS handshake\r\n");
            } else {
              attach(new tls.TLSSocket(socket, { isServer: true, secureContext }), true);
            }
            return;
          }
        } else if (line.startsWith("AUTH ")) {
          if (!encrypted && options.requireTLS !== false) {
            socket.write("530 Must issue a STARTTLS command first\r\n");
          } else if (line === "AUTH LOGIN") {
            loginStep = 1;
            socket.write("334 VXNlcm5hbWU6\r\n");
          } else {
            const token = Buffer.from(`\0${config.username}\0${config.password}`).toString("base64");
            assert.equal(line, "AUTH PLAIN " + token);
            socket.write("235 Authenticated\r\n");
          }
        } else if (line.startsWith("MAIL FROM:") || line.startsWith("RCPT TO:")) {
          socket.write("250 OK\r\n");
        } else if (line === "DATA") {
          body = [];
          socket.write("354 End with a dot\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Bye\r\n");
        } else {
          socket.write("500 Unexpected command\r\n");
        }
      }
    }
    socket.on("data", receive);
  }

  function connected(socket) {
    connections++;
    attach(socket, Boolean(options.implicitTLS));
    socket.write("220 localhost ESMTP\r\n");
  }
  const server = options.implicitTLS
    ? tls.createServer({ key, cert }, connected)
    : net.createServer(connected);
  server.on("tlsClientError", () => {});
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const send = loadPlugin(server.address().port, options);
  return {
    commands,
    messages,
    get connections() { return connections; },
    async send(overrides = {}) {
      let timeout;
      try {
        await Promise.race([
          send({ title: "SMTP test", message: "Local fixture message" }, { ...config, ...overrides }),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("SMTP fixture timed out")), 4000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function assertDelivered(fixture) {
  assert.equal(fixture.messages.length, 1);
  assert.match(fixture.messages[0], /Subject: SMTP test/);
  assert.equal(fixture.commands.at(-1).line, "QUIT");
}

function assertUpgraded(fixture, auth) {
  assert.deepEqual(fixture.commands.slice(0, 3), [
    { line: "EHLO localhost", encrypted: false },
    { line: "STARTTLS", encrypted: false },
    { line: "EHLO localhost", encrypted: true },
  ]);
  assert.match(fixture.commands[3].line, auth);
  assert.ok(fixture.commands.slice(3).every(({ encrypted }) => encrypted));
  assertDelivered(fixture);
}

test("automatically negotiates advertised STARTTLS before PLAIN authentication", { timeout: 6000 }, async (t) => {
  const fixture = await smtpFixture(t);
  await fixture.send();
  assertUpgraded(fixture, /^AUTH PLAIN /);
});

test("recognizes mixed-case STARTTLS and performs LOGIN only after the second EHLO", { timeout: 6000 }, async (t) => {
  const fixture = await smtpFixture(t, { capability: "sTaRtTlS" });
  await fixture.send({ use_login_auth: true });
  assertUpgraded(fixture, /^AUTH LOGIN$/);
});

test("waits for Komari socket methods and reads fragmented EHLO capabilities", { timeout: 6000 }, async (t) => {
  const fixture = await smtpFixture(t, { deferMethods: true, fragmentEHLO: true });
  await fixture.send();
  assertUpgraded(fixture, /^AUTH PLAIN /);
});

test("preserves errors from a Komari connection placeholder without destroy", { timeout: 6000 }, async () => {
  const connectionError = new Error("Fixture connection refused");
  const send = loadPlugin(0, { connectionError });
  await assert.rejects(send({ title: "SMTP test", message: "Local fixture message" }, config),
    (error) => error === connectionError);
});

test("preserves implicit TLS on port 465 without issuing STARTTLS", { timeout: 6000 }, async (t) => {
  const fixture = await smtpFixture(t, { implicitTLS: true });
  await fixture.send({ port: 465, use_ssl: true });
  assert.ok(fixture.commands.every(({ encrypted }) => encrypted));
  assert.equal(fixture.commands.filter(({ line }) => line === "STARTTLS").length, 0);
  assertDelivered(fixture);
});

test("explicit TLS on submission ports still requests STARTTLS when it is not advertised", { timeout: 6000 }, async (t) => {
  const fixture = await smtpFixture(t, { capability: null });
  await fixture.send({ use_ssl: true });
  assertUpgraded(fixture, /^AUTH PLAIN /);
});

for (const [name, options] of [
  ["keeps legacy plaintext SMTP when STARTTLS is unavailable", { capability: null }],
  ["keeps HELO fallback for legacy SMTP servers", { rejectEHLO: true }],
  ["does not mistake XSTARTTLS for the STARTTLS capability", { capability: "XSTARTTLS" }],
]) {
  test(name, { timeout: 6000 }, async (t) => {
    const fixture = await smtpFixture(t, { ...options, requireTLS: false });
    await fixture.send();
    assert.ok(fixture.commands.every(({ encrypted }) => !encrypted));
    assert.equal(fixture.commands.filter(({ line }) => line === "STARTTLS").length, 0);
    if (options.rejectEHLO) assert.equal(fixture.commands[1].line, "HELO localhost");
    assertDelivered(fixture);
  });
}

for (const [name, options, error] of [
  ["STARTTLS refusal", { rejectSTARTTLS: true }, /454/],
  ["TLS handshake failure", { failHandshake: true }, /SSL|TLS|wrong version|packet length/i],
  ["untrusted TLS certificate", { trustFixture: false }, /self.signed certificate|certificate chain/i],
]) {
  test(`does not authenticate or retry in plaintext after ${name}`, { timeout: 6000 }, async (t) => {
    const fixture = await smtpFixture(t, options);
    await assert.rejects(fixture.send(), error);
    assert.deepEqual(fixture.commands.map(({ line }) => line), ["EHLO localhost", "STARTTLS"]);
    assert.equal(fixture.connections, 1);
    assert.equal(fixture.messages.length, 0);
  });
}
