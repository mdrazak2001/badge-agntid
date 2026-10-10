// Minimal streamable-HTTP MCP client for the AgntID runtime.
const URL_ = process.env.AGNTID_MCP_URL || "http://localhost:8082/mcp";
let nextId = 1;

async function rpc(session, method, params, isNotification = false) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify(isNotification ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const sid = res.headers.get("mcp-session-id");
  const text = await res.text();
  if (isNotification) return { sid };
  const line = text.split("\n").filter((l) => l.startsWith("data: ")).pop();
  const msg = JSON.parse(line ? line.slice(6) : text);
  return { sid, msg };
}

export async function connect(clientName = "badge") {
  const { sid } = await rpc(null, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: clientName, version: "0.1" },
  });
  await rpc(sid, "notifications/initialized", {}, true);
  return {
    session: sid,
    async listTools() {
      return (await rpc(sid, "tools/list", {})).msg.result.tools;
    },
    async call(name, args) {
      const { msg } = await rpc(sid, "tools/call", { name, arguments: args });
      return msg;
    },
  };
}
