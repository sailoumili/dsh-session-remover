// dsh-session-remover —— 宿主半（node 侧），浏览器半见同包 lib/client.js。
//   POST /api/session.delete  body { sessionId } —— 把该对话及其子代理后代移入系统回收站
// 会动用户数据：只放行回环来源，非回环一律拒。
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { zstdDecompressSync } from "node:zlib";

export const name = "dsh-session-remover";

const inject = ["webServer"];

const SESSION_ID_RE = /^(session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODY_LIMIT = 1_000_000;
const AGENT_QUIESCE_MS = 8000;
const HEAD_BYTES = 262144;
const RECYCLE_TIMEOUT_MS = 25000;

function json(res, status, value, extraHeaders) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify(value));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 失败一律回「错误码 + 参数」，由浏览器半按界面语言取词：服务端不产出面向界面的自然语言，
// 否则英文界面下会冒出中文。params 的值可以是字符串，也可以是另一个失败对象，供嵌套原因递归展开。
const fail = (code, params, extra) => ({ ok: false, code, params: params || {}, ...(extra || {}) });

// 自注册路由在官方 /api 信任栅栏之外，须自补判据。只放行回环来源：官方第二道浏览器 cookie 鉴权依赖插件拿不到的签名密钥。0 = 放行；403 = 拒。
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = String(hostname).split(".");
  return parts.length === 4 && parts[0] === "127"
    && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}
function parseAuthority(authority) {
  try { return new URL("http://" + authority); } catch { return undefined; }
}
function headerOf(headers, name) {
  if (!headers) return undefined;
  const v = headers[name] !== undefined ? headers[name] : headers[name.toLowerCase()];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}
function requestRejection(req) {
  const headers = (req && req.headers) || {};
  const hostUrl = parseAuthority(headerOf(headers, "host") ?? "");
  if (hostUrl === undefined || !isLoopbackHostname(hostUrl.hostname)) return 403;
  if (headerOf(headers, "sec-fetch-site") === "cross-site") return 403;
  const origin = headerOf(headers, "origin");
  if (origin === undefined) return 0;
  try { return new URL(origin).host === hostUrl.host ? 0 : 403; } catch { return 403; }
}

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}
function sessionsRoot() {
  return join(dshHome(), "sessions");
}
function idVariants(sessionId) {
  const set = new Set([sessionId]);
  if (sessionId.startsWith("session-")) set.add(sessionId.slice("session-".length));
  else set.add("session-" + sessionId);
  return [...set];
}
function dirName(dir) {
  return dir.split(/[\\/]/).filter(Boolean).pop() ?? "";
}
function isInside(root, target) {
  const r = resolve(root).toLowerCase().replace(/[\\/]+$/, "");
  const t = resolve(target).toLowerCase();
  return t.startsWith(r + "\\") || t.startsWith(r + "/");
}
// 读磁盘的函数一律：读失败返回 ok:false。把「读不出来」当成「磁盘上没有」，会误判活会话。
function findSessionDirs(sessionId) {
  const root = sessionsRoot();
  const variants = idVariants(sessionId);
  const out = [];
  let slugs = [];
  try {
    slugs = readdirSync(root, { withFileTypes: true });
  } catch (error) {
    return { ...fail("E_SESSION_ROOT_UNREADABLE", { reason: String(error?.message || error) }), dirs: out };
  }
  for (const slug of slugs) {
    if (!slug.isDirectory()) continue;
    for (const v of variants) {
      const p = join(root, slug.name, v);
      try {
        if (statSync(p).isDirectory() && !out.includes(p)) out.push(p);
      } catch {}
    }
  }
  return { ok: true, dirs: out };
}

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
// 复用一块头缓冲：readSessionHeader 是同步函数，不会重入；几百个会话逐个 new 会白扔上百 MB。
const HEAD_BUF = Buffer.allocUnsafe(HEAD_BYTES);

function sessionLogFiles(dir) {
  let files = [];
  try { files = readdirSync(dir); } catch { return []; }
  return files.filter((f) => f.endsWith(".zstd")).map((f) => join(dir, f));
}
function readSessionHeader(dir) {
  for (const file of sessionLogFiles(dir)) {
    let handle;
    try {
      handle = openSync(file, "r");
      const read = readSync(handle, HEAD_BUF, 0, HEAD_BYTES, 0);
      const head = HEAD_BUF.subarray(0, read);
      const offsets = [];
      for (let i = 0; i + 4 <= head.length && offsets.length < 2; i++) {
        if (head[i] === ZSTD_MAGIC[0] && head[i + 1] === ZSTD_MAGIC[1] && head[i + 2] === ZSTD_MAGIC[2] && head[i + 3] === ZSTD_MAGIC[3]) offsets.push(i);
      }
      if (offsets.length === 0) continue;
      const end = offsets.length > 1 ? offsets[1] : head.length;
      let text;
      try { text = zstdDecompressSync(head.subarray(0, end)).toString("utf8"); } catch { continue; }
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj && obj.type === "session" && typeof obj.id === "string") return obj;
        } catch {}
      }
    } catch {}
    finally { if (handle !== undefined) { try { closeSync(handle); } catch {} } }
  }
  return null;
}
function indexSessionsOnDisk() {
  const byKey = new Map();
  const byDir = new Map();
  let slugs = [];
  try {
    slugs = readdirSync(sessionsRoot(), { withFileTypes: true });
  } catch (error) {
    return { ...fail("E_SESSION_ROOT_UNREADABLE", { reason: String(error?.message || error) }), byKey, byDir };
  }
  for (const slug of slugs) {
    if (!slug.isDirectory()) continue;
    const slugDir = join(sessionsRoot(), slug.name);
    let dirs = [];
    try {
      dirs = readdirSync(slugDir, { withFileTypes: true });
    } catch (error) {
      return { ...fail("E_WORKSPACE_DIR_UNREADABLE", { name: slug.name, reason: String(error?.message || error) }), byKey, byDir };
    }
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const dir = join(slugDir, d.name);
      const entry = { dir, dirName: d.name, id: "session-" + d.name.replace(/^session-/, ""), header: readSessionHeader(dir) };
      byDir.set(d.name, entry);
      byKey.set(entry.id, entry);
    }
  }
  return { ok: true, byKey, byDir };
}
function permanentSessionKeys(ctx) {
  const keys = new Set();
  const registry = ctx.get("workspaceRegistry");
  if (!registry || typeof registry.list !== "function") {
    return fail("E_REGISTRY_UNAVAILABLE");
  }
  try {
    for (const ws of registry.list()) {
      const ids = ws.sessionIds;
      if (!Array.isArray(ids)) {
        return fail("E_SESSION_IDS_NOT_ARRAY", { type: typeof ids });
      }
      for (const id of ids) keys.add("session-" + String(id).replace(/^session-/, ""));
    }
    const state = typeof registry.requireState === "function" ? registry.requireState() : null;
    const archived = state?.archivedSessionIds;
    if (archived !== undefined && archived !== null && !Array.isArray(archived)) {
      return fail("E_ARCHIVED_NOT_ARRAY", { type: typeof archived });
    }
    for (const id of archived ?? []) keys.add("session-" + String(id).replace(/^session-/, ""));
  } catch (error) {
    return fail("E_REGISTRY_READ_FAILED", { reason: String(error?.message || error) });
  }
  return { ok: true, keys };
}
// 收集该会话及其磁盘上的全部子代理后代，返回「后代在前、父在后」的目录清单。
function collectSessionTree(ctx, sessionId) {
  const perm = permanentSessionKeys(ctx);
  if (!perm.ok) return fail("E_PROTECTED_LIST_UNREADABLE", { reason: perm });
  const protectedKeys = perm.keys;
  const index = indexSessionsOnDisk();
  if (!index.ok) return fail("E_INDEX_UNREADABLE", { reason: index });
  const { byKey, byDir } = index;
  const rootKey = "session-" + sessionId.replace(/^session-/, "");
  const childrenOf = new Map();
  for (const entry of byKey.values()) {
    if (protectedKeys.has(entry.id)) continue;
    // 只收 origin === "subagent"：fork 出来的分叉会话 header 里也有 parentSession，但它是独立对话，绝不能连带删。
    if (entry.header?.origin !== "subagent") continue;
    const parent = entry.header?.parentSession;
    if (typeof parent !== "string" || parent.length === 0) continue;
    const parentKey = "session-" + parent.replace(/^session-/, "");
    const list = childrenOf.get(parentKey) ?? [];
    list.push(entry.id);
    childrenOf.set(parentKey, list);
  }
  const ordered = [];
  const seen = new Set();
  const stack = [rootKey];
  while (stack.length > 0) {
    const key = stack.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
    for (const child of childrenOf.get(key) ?? []) stack.push(child);
  }
  const targetKeys = ordered.filter((key) => key === rootKey || !protectedKeys.has(key));
  const dirs = [];
  for (const key of targetKeys.reverse()) {
    const entry = byKey.get(key);
    if (entry) dirs.push(entry.dir);
  }
  const rootDirs = new Set(dirs);
  for (const name of idVariants(sessionId)) {
    const entry = byDir.get(name);
    if (entry && !rootDirs.has(entry.dir)) { dirs.push(entry.dir); rootDirs.add(entry.dir); }
  }
  return { ok: true, dirs };
}

// 移入回收站要靠系统脚本宿主 cscript：node 没有回收站接口，PowerShell 每次启动太慢。
// 结果写文件而非 stdout——管道在受限环境里拿不到，写文件到哪都能读。
function cscriptPath() {
  const root = process.env.SystemRoot || "C:\\Windows";
  for (const p of [join(root, "System32", "cscript.exe"), join(root, "SysWOW64", "cscript.exe")]) {
    try { if (statSync(p).isFile()) return p; } catch {}
  }
  return "";
}
// 回收站被关掉（NukeOnDelete=1）时 MoveHere 会直接永久删除，与「可还原」的承诺相反 → 先拒绝。
// 注意：该开关是「按卷」存的（回收站属性按驱动器逐个勾选），根键下通常没有这个值，
// 故必须先由盘符查到卷 GUID，再读该卷的值；只读根键会让这道闸门形同虚设。
// 移完后按「原位置 + 名字」回回收站里点名核对，确认真的进去了，而不是被静默永久删掉。
function recycleScript(paths, resultFile) {
  return [
    "var paths = " + JSON.stringify(paths) + ";",
    "var resultFile = " + JSON.stringify(resultFile) + ";",
    'var fso = new ActiveXObject("Scripting.FileSystemObject");',
    'var wsh = new ActiveXObject("WScript.Shell");',
    "function write(line) { var o = fso.CreateTextFile(resultFile, true, false); o.WriteLine(line); o.Close(); }",
    "function readNuke(key) { try { return wsh.RegRead(key); } catch (e) { return 0; } }",
    // 反斜杠用 fromCharCode 拼，避免多层转义出错。
    "var BS = String.fromCharCode(92);",
    'var ROOT_KEY = ["HKCU","Software","Microsoft","Windows","CurrentVersion","Explorer","BitBucket"].join(BS);',
    // 盘符 → 卷 GUID：Win32_Volume 的 DeviceID 形如 \\?\Volume{GUID}\
    "function volumeKeyOf(p) {",
    "  var m = /^([A-Za-z]):/.exec(p);",
    "  if (!m) return \"\";",
    "  var letter = m[1].toUpperCase() + \":\";",
    "  try {",
    '    var wmi = GetObject("winmgmts:\\\\\\\\.\\\\root\\\\cimv2");',
    '    var vols = wmi.ExecQuery("SELECT DeviceID FROM Win32_Volume WHERE DriveLetter=\'" + letter + "\'");',
    "    var e = new Enumerator(vols);",
    "    for (; !e.atEnd(); e.moveNext()) {",
    "      var g = /\\{([0-9a-fA-F-]+)\\}/.exec(String(e.item().DeviceID));",
    '      if (g) return ROOT_KEY + BS + "Volume" + BS + "{" + g[1] + "}";',
    "    }",
    "  } catch (err) {}",
    "  return \"\";",
    "}",
    // 卷级值读不到时退回根键值（旧版 Windows 把开关放在根键）。
    "function isNukeOn(p) {",
    "  var volKey = volumeKeyOf(p);",
    "  if (volKey !== \"\") {",
    '    if (readNuke(volKey + BS + "NukeOnDelete") === 1) return true;',
    "  }",
    '  return readNuke(ROOT_KEY + BS + "NukeOnDelete") === 1;',
    "}",
    "for (var n = 0; n < paths.length; n++) {",
    '  if (isNukeOn(paths[n])) { write("NUKE|0|0"); WScript.Quit(0); }',
    "}",
    'var sh = new ActiveXObject("Shell.Application");',
    "var bin = sh.NameSpace(10);",
    "function baseName(p) { var a = p.split(\"\\\\\"); return a[a.length - 1]; }",
    "function dirName(p) { var a = p.split(\"\\\\\"); a.pop(); return a.join(\"\\\\\").toLowerCase(); }",
    // 摘内存后落盘句柄的关闭是异步的，一次 MoveHere 可能撞上「目录仍被占用」而失败，
    // 故在截止时间内反复重试，只对仍存在的路径再搬一次。
    "var deadline = (new Date()).getTime() + " + RECYCLE_TIMEOUT_MS + ";",
    "var left = paths.length;",
    "var lastErr = \"\";",
    "while (true) {",
    "  left = 0;",
    "  for (var j = 0; j < paths.length; j++) {",
    "    if (!(fso.FolderExists(paths[j]) || fso.FileExists(paths[j]))) continue;",
    "    try { bin.MoveHere(paths[j], 0); } catch (err) { lastErr = String(err && err.message || err); }",
    "    if (fso.FolderExists(paths[j]) || fso.FileExists(paths[j])) left++;",
    "  }",
    "  if (left === 0) break;",
    "  if ((new Date()).getTime() > deadline) break;",
    "  WScript.Sleep(200);",
    "}",
    // 逐项容错：回收站里个别项取属性会抛错，一处抛错不能带塌整轮核对。
    "var matched = 0;",
    "var e = new Enumerator(bin.Items());",
    "for (; !e.atEnd(); e.moveNext()) {",
    "  try {",
    "    var it = e.item();",
    "    var nm = String(it.Name);",
    "    for (var k = 0; k < paths.length; k++) {",
    "      if (nm !== baseName(paths[k])) continue;",
    '      if (String(bin.GetDetailsOf(it, 1)).toLowerCase() === dirName(paths[k])) { matched++; break; }',
    "    }",
    "  } catch (err2) {}",
    "}",
    'write("RS|" + left + "|" + matched + "|" + lastErr.replace(/[\\r\\n|]/g, " "));',
  ].join("\r\n");
}
async function recycleBinMove(dirs) {
  if (dirs.length === 0) return { ok: true, moved: 0 };
  const exe = cscriptPath();
  if (exe === "") return fail("E_CSCRIPT_MISSING");
  const root = sessionsRoot();
  if (dirs.some((d) => !isInside(root, d))) return fail("E_DIR_OUTSIDE_ROOT");
  const work = mkdtempSync(join(tmpdir(), "dsh-session-remover-"));
  const script = join(work, "recycle.js");
  const resultFile = join(work, "result.txt");
  try {
    // cscript 按 BOM 判编码，UTF-16LE 才认得出中文路径。
    writeFileSync(script, "\uFEFF" + recycleScript(dirs, resultFile), "utf16le");
    const r = spawnSync(exe, ["//nologo", "//E:JScript", script], {
      stdio: "ignore", timeout: RECYCLE_TIMEOUT_MS + 30000, windowsHide: true,
    });
    if (r.error) return fail("E_RECYCLE_SPAWN_FAILED", { reason: r.error.message });
    let text = "";
    try { text = readFileSync(resultFile, "utf8"); } catch { return fail("E_RECYCLE_NO_RESULT"); }
    if (text.startsWith("NUKE")) {
      return fail("E_RECYCLE_DISABLED");
    }
    const m = text.match(/RS\|(\d+)\|(\d+)\|?([^\r\n]*)/);
    if (!m) return fail("E_RECYCLE_UNRECOGNIZED");
    const left = Number(m[1]);
    const matched = Number(m[2]);
    const lastErr = (m[3] || "").trim();
    // 部分成功是可能发生的：搬移是逐项的，失败的项数要如实报出来，不能一律说「未删除任何记录」。
    if (left > 0) {
      const params = { left, total: dirs.length, moved: dirs.length - left };
      return fail(lastErr === "" ? "E_RECYCLE_LEFT" : "E_RECYCLE_LEFT_REASON", lastErr === "" ? params : { ...params, reason: lastErr });
    }
    if (matched < dirs.length) {
      return fail("E_RECYCLE_MISMATCH", { matched, total: dirs.length });
    }
    return { ok: true, moved: dirs.length };
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch {}
  }
}
async function stopAgent(ctx, sessionId) {
  const agents = ctx.get("agents");
  if (!agents || typeof agents.get !== "function") return false;
  let stopped = false;
  for (const v of idVariants(sessionId)) {
    const agent = agents.get(v);
    if (!agent) continue;
    stopped = true;
    try { agent.cancel?.({ kind: "disposed" }); } catch {}
    try {
      // Agent 只有 cancel/whenIdle，没有可自己调的 scope；等它静默即可，超时就走人。
      if (typeof agent.whenIdle === "function") await Promise.race([agent.whenIdle(), sleep(AGENT_QUIESCE_MS)]);
      else await sleep(200);
    } catch {}
    try { agents.store?.delete?.(v); } catch {}
  }
  return stopped;
}

async function flushSession(ctx, sessionId) {
  const sessions = ctx.get("sessions");
  if (!sessions || typeof sessions.get !== "function") return false;
  let flushed = false;
  for (const v of idVariants(sessionId)) {
    const s = sessions.get(v);
    if (!s) continue;
    try {
      if (typeof sessions.flush === "function") { await sessions.flush(s); flushed = true; }
    } catch {}
  }
  return flushed;
}

async function detachLive(ctx, sessionId) {
  const sessions = ctx.get("sessions");
  if (!sessions) return false;
  let detached = false;
  for (const v of idVariants(sessionId)) {
    try {
      const store = sessions.store;
      const entry = store && typeof store.get === "function" ? store.get(v) : undefined;
      if (entry === undefined) continue;
      // 首选官方 enter() 交出的 detach 闭包：它是唯一会连带摘内部附件的口子。
      if (typeof entry.detach === "function") { entry.detach(); detached = true; }
      else if (typeof sessions.detachEntered === "function") { sessions.detachEntered(entry); detached = true; }
      else if (typeof store.delete === "function") { store.delete(v); detached = true; }
    } catch {}
  }
  if (detached) await sleep(250);
  return detached;
}

async function cleanDomainRows(ctx, domainName, sessionId) {
  const sd = ctx.get("storageDomain");
  if (!sd || typeof sd.get !== "function") return false;
  let removed = false;
  try {
    const domain = sd.get(domainName);
    if (!domain || typeof domain.table !== "function") return false;
    const table = domain.table("sessions");
    for (const v of idVariants(sessionId)) {
      try {
        if (typeof table.get === "function" && table.get(v) === undefined) continue;
        await table.delete(v);
        removed = true;
      } catch {}
    }
  } catch {}
  return removed;
}

async function detachFromWorkspaces(ctx, sessionId) {
  const registry = ctx.get("workspaceRegistry");
  if (!registry || typeof registry.list !== "function") return { ok: true, removed: false };
  const variants = idVariants(sessionId);
  let removed = false;
  for (const ws of registry.list()) {
    if (!Array.isArray(ws.sessionIds)) continue;
    for (const v of variants) {
      if (!ws.sessionIds.includes(v)) continue;
      try { await ws.detachSession(v); removed = true; }
      catch (error) { return fail("E_WS_DETACH_FAILED", { reason: error?.message || error }); }
    }
  }
  return { ok: true, removed };
}

async function removeFromArchiveSet(ctx, sessionId) {
  const registry = ctx.get("workspaceRegistry");
  if (!registry) return false;
  const variants = idVariants(sessionId);
  // 公开接口优先：不在归档集时它静默返回，正合我用。
  if (typeof registry.unarchiveSession === "function") {
    let removed = false;
    try {
      const before = Array.isArray(registry.archivedSessionIds) ? registry.archivedSessionIds : null;
      const wasArchived = before === null || variants.some((v) => before.includes(v));
      for (const v of variants) await registry.unarchiveSession(v);
      const after = Array.isArray(registry.archivedSessionIds) ? registry.archivedSessionIds : null;
      removed = after !== null && !variants.some((v) => after.includes(v)) && wasArchived;
    } catch {}
    if (removed) return true;
  }
  // 退回内部写入路径：公开接口在旧版本上可能不存在。
  if (typeof registry.enqueueOperation !== "function") return false;
  let removed = false;
  try {
    await registry.enqueueOperation(async () => {
      const state = typeof registry.requireState === "function" ? registry.requireState() : null;
      if (!state || !Array.isArray(state.archivedSessionIds)) return;
      if (!variants.some((v) => state.archivedSessionIds.includes(v))) return;
      await registry.setState({
        ...state,
        archivedSessionIds: state.archivedSessionIds.filter((id) => !variants.includes(id)),
      });
      removed = true;
    });
  } catch {}
  return removed;
}

// 三段式：先摘内存（运行中的会话占着文件句柄，不摘就搬不动）→ 再把整棵树一次性移入回收站
// → 最后清记账。磁盘这一步失败就整体中止，后面的记录一律不动，留给用户重试。
async function deleteSessionCore(ctx, sessionId) {
  const tree = collectSessionTree(ctx, sessionId);
  const treeFailed = tree.ok ? null : tree;
  const fallback = tree.ok && tree.dirs.length > 0 ? null : findSessionDirs(sessionId);
  if (fallback && !fallback.ok) {
    return fail("E_ABORTED_NO_CHANGE", { reason: fallback });
  }
  const dirs = tree.ok && tree.dirs.length > 0 ? tree.dirs : fallback.dirs;
  if (treeFailed) ctx.logger?.warn?.(`[dsh-session-remover] ${sessionId}：连带展开失败 ${treeFailed.code}`);
  if (dirs.length === 0) return fail("E_NOT_FOUND", {}, { status: 404 });

  const ids = dirs.map((d) => "session-" + dirName(d).replace(/^session-/, ""));

  let stopped = false, flushed = false, detached = false;
  for (const id of ids) {
    stopped = (await stopAgent(ctx, id)) || stopped;
    flushed = (await flushSession(ctx, id)) || flushed;
    detached = (await detachLive(ctx, id)) || detached;
  }

  const moved = await recycleBinMove(dirs);
  if (!moved.ok) return fail("E_MOVE_ABORTED", { reason: moved }, { status: 500 });

  let projRemoved = false, wsRemoved = false, archiveRemoved = false;
  const warnings = [];
  for (const id of ids) {
    projRemoved = (await cleanDomainRows(ctx, "session_projcache", id)) || projRemoved;
    archiveRemoved = (await removeFromArchiveSet(ctx, id)) || archiveRemoved;
    const ws = await detachFromWorkspaces(ctx, id);
    if (!ws.ok) warnings.push({ code: "E_DETACH_FAILED", params: { id, reason: ws } });
    wsRemoved = ws.removed || wsRemoved;
  }

  const leftover = [];
  for (let i = 0; i < ids.length; i++) {
    const audit = auditLeftover(ctx, ids[i], dirs[i] ? [dirs[i]] : []);
    for (const item of audit.leftover) leftover.push({ code: "L_SESSION_LEFTOVER", params: { id: ids[i], what: item } });
  }
  return {
    ok: true,
    sessions: ids.length,
    subagents: ids.length - 1,
    recycled: moved.moved,
    stopped, flushed, detached,
    projRemoved,
    workspaceRemoved: wsRemoved, archiveRemoved,
    clean: leftover.length === 0 && warnings.length === 0,
    leftover,
    warnings,
  };
}

function auditLeftover(ctx, sessionId, dirs) {
  const variants = idVariants(sessionId);
  const leftover = [];
  if (dirs.some((d) => existsSync(d))) leftover.push({ code: "L_SESSION_DIR" });
  const sd = ctx.get("storageDomain");
  if (sd && typeof sd.get === "function") {
    // 只审 rc.2 里真实存在的存储域：message_feedback 已改为会话日志权威，不再是存储域。
    for (const [domainName, label] of [["session_projcache", "L_PROJ_CACHE"]]) {
      try {
        const domain = sd.get(domainName);
        const table = domain && typeof domain.table === "function" ? domain.table("sessions") : null;
        if (!table || typeof table.get !== "function") continue;
        if (variants.some((v) => table.get(v) !== undefined)) leftover.push({ code: label });
      } catch {}
    }
  }
  const registry = ctx.get("workspaceRegistry");
  if (registry && typeof registry.list === "function") {
    try {
      for (const ws of registry.list()) {
        if (!Array.isArray(ws.sessionIds)) continue;
        if (variants.some((v) => ws.sessionIds.includes(v))) { leftover.push({ code: "L_WORKSPACE_REGISTRY" }); break; }
      }
      const state = typeof registry.requireState === "function" ? registry.requireState() : null;
      if (state && Array.isArray(state.archivedSessionIds) && variants.some((v) => state.archivedSessionIds.includes(v))) {
        leftover.push({ code: "L_ARCHIVE_SET" });
      }
    } catch {}
  }
  return { clean: leftover.length === 0, leftover };
}

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/api/session.delete",
    handler: async (req, res) => {
      if (requestRejection(req) !== 0) return json(res, 403, fail("E_LOOPBACK_ONLY"));
      if (req.method !== "POST") {
        return json(res, 405, fail("E_POST_ONLY"), { allow: "POST" });
      }
      if (req.headers["content-length"] && Number(req.headers["content-length"]) > BODY_LIMIT) {
        return json(res, 413, fail("E_BODY_TOO_LARGE"));
      }
      let raw = "";
      try {
        for await (const chunk of req) {
          raw += chunk;
          // 超限与「读失败」是两回事：前者是客户端请求过大，回 413 才能让人看懂。
          if (raw.length > BODY_LIMIT) return json(res, 413, fail("E_BODY_TOO_LARGE"));
        }
      } catch {
        return json(res, 400, fail("E_BODY_READ_FAILED"));
      }
      let sessionId;
      try { sessionId = JSON.parse(raw).sessionId; } catch {}
      if (typeof sessionId !== "string" || sessionId.length === 0) {
        return json(res, 400, fail("E_SESSION_ID_REQUIRED"));
      }
      sessionId = sessionId.trim();
      if (!SESSION_ID_RE.test(sessionId)) {
        return json(res, 400, fail("E_SESSION_ID_INVALID", { id: sessionId }));
      }
      try {
        const result = await deleteSessionCore(ctx, sessionId);
        if (!result.ok) return json(res, result.status || 500, result);
        if (!result.clean) {
          ctx.logger?.warn?.(`[dsh-session-remover] ${sessionId} 删除后仍有残留：${result.leftover.map((x) => x.code).join(",")}`);
        }
        return json(res, 200, result);
      } catch (error) {
        return json(res, 500, fail("E_INTERNAL", { reason: String(error?.message || error) }));
      }
    },
  }));
}

export { apply, inject };
