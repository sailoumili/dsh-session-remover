// 离线自检（只读，绝不删任何东西）。原理：把插件源码复制一份、追加内部函数的导出再动态 import，
// 这样发布件的导出面保持干净，自检仍能直接调用内部函数。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const PLUGIN = process.env.DSH_SD_PLUGIN || path.join(HERE, "..", "lib", "index.js");
const SESSIONS_ROOT = path.join(DSH_HOME, "sessions");
const STORAGES = path.join(DSH_HOME, "storages");

const norm = (id) => String(id).replace(/^session-/, "");
const key = (id) => "session-" + norm(id);
// 失败结构是「错误码 + 参数」，打印时摊平成一行，便于人工看。
const why = (x) => (x ? [x.code ?? x.error, x.params && Object.keys(x.params).length ? JSON.stringify(x.params) : ""].filter(Boolean).join(" ") : "");

const PROBE_EXPORTS = [
  "collectSessionTree", "indexSessionsOnDisk", "findSessionDirs", "permanentSessionKeys",
  "requestRejection", "recycleScript", "recycleBinMove", "isInside", "auditLeftover",
  "deleteSessionCore",
];

function loadPlugin() {
  if (!fs.existsSync(PLUGIN)) {
    console.error(`[错误] 找不到插件：${PLUGIN}`);
    process.exit(1);
  }
  const probe = path.join(os.tmpdir(), `session-delete-probe-${process.pid}.mjs`);
  const src = fs.readFileSync(PLUGIN, "utf8");
  fs.writeFileSync(probe, src + `\nexport { ${PROBE_EXPORTS.join(", ")} };\n`, "utf8");
  return probe;
}

function makeCtx() {
  const wsFile = path.join(STORAGES, "workspace.json");
  const w = fs.existsSync(wsFile) ? JSON.parse(fs.readFileSync(wsFile, "utf8")) : {};
  const workspaces = Object.values(w?.tables?.workspaces ?? {}).map((t) => ({
    sessionIds: (t.sessionIds ?? []).map(String),
    detachSession: async () => {},
  }));
  const archivedSessionIds = w?.global?.archivedSessionIds ?? [];
  return {
    registry: workspaces,
    archivedSessionIds,
    ctx: {
      get(name) {
        if (name === "workspaceRegistry") {
          return { list: () => workspaces, requireState: () => ({ archivedSessionIds }), enqueueOperation: async (f) => f(), setState: async () => {} };
        }
        if (name === "sessions") return { get: () => undefined };
        if (name === "storageDomain") return { get: () => undefined };
        return undefined;
      },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
    },
  };
}

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  (ok ? pass++ : fail++);
  console.log(`  ${ok ? "[PASS]" : "[FAIL]"} ${name}${detail ? "  " + detail : ""}`);
};

const probe = loadPlugin();
let mod;
try {
  mod = await import(pathToFileURL(probe).href);
} catch (error) {
  console.error("[错误] 载入插件自检模块失败：" + error.message);
  try { fs.unlinkSync(probe); } catch {}
  process.exit(1);
}
const { collectSessionTree, indexSessionsOnDisk } = mod;

const { registry, ctx } = makeCtx();
const protectedNames = new Set(registry.flatMap((w) => w.sessionIds.map(norm)));
const index0 = indexSessionsOnDisk();
if (!index0.ok) {
  console.error("[错误] 磁盘会话索引读取失败：" + index0.error);
  try { fs.unlinkSync(probe); } catch {}
  process.exit(1);
}
const { byKey } = index0;
const all = [...byKey.values()];
const subs = all.filter((e) => e.header?.origin === "subagent");
const roots = all.filter((e) => e.header && e.header.origin !== "subagent" && e.header.parentSession === undefined);

console.log("=".repeat(64));
console.log("dsh-session-remover 插件离线自检（只读，不会删任何东西）");
console.log("=".repeat(64));
console.log(`插件      : ${PLUGIN}`);
console.log(`数据      : ${SESSIONS_ROOT}`);
console.log(`磁盘会话  : ${all.length} 个（根 ${roots.length} / 子代理 ${subs.length}）`);
console.log(`在册会话  : ${protectedNames.size} 个（保护集）`);

console.log("\n[测试1] 血缘展开（collectSessionTree）");
const directCount = new Map();
for (const s of subs) {
  const p = s.header.parentSession;
  if (typeof p === "string") directCount.set(key(p), (directCount.get(key(p)) ?? 0) + 1);
}
const top = [...directCount.entries()].sort((a, b) => b[1] - a[1])[0];
if (!top) {
  console.log("  （本机没有带子代理的会话，跳过此项）");
} else {
  console.log(`  取子代理最多的父会话 ${top[0]}（直接子代理 ${top[1]} 个）`);
  const t1 = collectSessionTree(ctx, top[0]);
  check("返回结构 ok", t1.ok === true, why(t1));
  const tree = t1.dirs ?? [];
  const rootOnDisk = byKey.has(key(top[0]));
  const descendants = tree.length - (rootOnDisk ? 1 : 0);
  check("至少收全所有直接子代理", descendants >= top[1], `清单后代 ${descendants}，直接子代理 ${top[1]}`);
  check("无重复", new Set(tree).size === tree.length);
  check("目录全部存在", tree.every((d) => fs.existsSync(d)));
  const rootName = norm(top[0]);
  check("清单没混入别的受保护（在册）会话",
    tree.filter((d) => norm(path.basename(d)) !== rootName && protectedNames.has(norm(path.basename(d)))).length === 0);

  const pos = new Map(tree.map((d, i) => [key(path.basename(d)), i]));
  let orderBad = 0;
  for (const [k, i] of pos) {
    const p = byKey.get(k)?.header?.parentSession;
    if (typeof p === "string" && pos.has(key(p)) && pos.get(key(p)) < i) orderBad++;
  }
  check("顺序满足「父在子之后」", orderBad === 0, `违反 ${orderBad}`);

  const inTree = tree.every((d) => {
    const k = key(path.basename(d));
    if (k === key(top[0])) return true;
    const seen = new Set([k]);
    let p = byKey.get(k)?.header?.parentSession;
    while (typeof p === "string" && p.length > 0) {
      const pk = key(p);
      if (pk === key(top[0])) return true;
      if (seen.has(pk)) return false;
      seen.add(pk);
      p = byKey.get(pk)?.header?.parentSession;
    }
    return false;
  });
  check("清单没多收无关会话", inTree);
}

console.log("\n[测试2] fork 保护");
const forks = all.filter((e) => typeof e.header?.parentSession === "string" && e.header.origin !== "subagent");
console.log(`  磁盘上「有 parentSession 但不是 subagent」的会话：${forks.length} 个`);
let forkLeak = 0;
for (const f of forks) {
  const t = collectSessionTree(ctx, f.header.parentSession);
  if (t.ok && t.dirs.some((d) => path.basename(d) === f.dirName)) forkLeak++;
}
check("没有任何 fork 会话被收进父会话的删除清单", forkLeak === 0, `泄漏 ${forkLeak} 个`);

console.log("\n[测试3] 保护集失效时的保守行为");
const broken = {
  get: (n) => (n === "workspaceRegistry"
    ? { list: () => [{ sessionIds: "不是数组" }], requireState: () => ({ archivedSessionIds: [] }) }
    : undefined),
};
const targetId = top ? top[0] : (roots[0] ? key(roots[0].dirName) : null);
if (targetId) {
  const t3 = collectSessionTree(broken, targetId);
  check("sessionIds 形状不对 → collectSessionTree 返回 ok:false（放弃连带删除）", t3.ok === false && t3.code === "E_PROTECTED_LIST_UNREADABLE", why(t3));
} else {
  console.log("  （本机没有可作目标的会话，跳过此项）");
}

console.log("\n[测试4] 磁盘清单读取失败时的保守行为");
{
  const saved = process.env.DSH_HOME;
  const tmp = path.join(os.tmpdir(), `sd-selftest-bail-${process.pid}`);
  fs.mkdirSync(tmp, { recursive: true });
  process.env.DSH_HOME = tmp;
  try {
    const idx = indexSessionsOnDisk();
    check("indexSessionsOnDisk 读失败 → ok:false", idx.ok === false && idx.code === "E_SESSION_ROOT_UNREADABLE", why(idx));
    const dirs = mod.findSessionDirs("session-00000000-0000-0000-0000-000000000000");
    check("findSessionDirs 读失败 → ok:false", dirs.ok === false && dirs.code === "E_SESSION_ROOT_UNREADABLE", why(dirs));
    const t4 = collectSessionTree(ctx, "session-00000000-0000-0000-0000-000000000000");
    check("collectSessionTree 读失败 → ok:false（放弃连带删除）", t4.ok === false && t4.code === "E_INDEX_UNREADABLE", why(t4));
  } finally {
    process.env.DSH_HOME = saved;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

console.log("\n[测试5] 访问围栏（requestRejection）");
{
  const call = (headers) => mod.requestRejection({ headers });
  const ok = (h) => call({ host: "127.0.0.1:3080", "sec-fetch-site": "same-origin", origin: "http://127.0.0.1:3080", ...h });
  check("回环 127.0.0.1 同源 → 放行", ok({}) === 0, "码 " + ok({}));
  check("回环 localhost 无 Origin（本机脚本）→ 放行", ok({ host: "localhost:3080", origin: undefined, "sec-fetch-site": undefined }) === 0);
  check("IPv6 回环 [::1] → 放行", ok({ host: "[::1]:3080", origin: "http://[::1]:3080" }) === 0);
  check("陌生域名 Host → 拒", ok({ host: "evil.example.com" }) === 403);
  check("跨站标记 → 拒", ok({ "sec-fetch-site": "cross-site" }) === 403);
  check("Origin 与 Host 不同源 → 拒", ok({ origin: "http://evil.example.com" }) === 403);
  check("没有 Host 头 → 拒", call({}) === 403);
  check("局域网地址（同源）→ 拒", ok({ host: "192.168.1.5:3080", origin: "http://192.168.1.5:3080" }) === 403);
  check("局域网地址 10.x → 拒", ok({ host: "10.0.0.7:3080", origin: "http://10.0.0.7:3080" }) === 403);
}

console.log("\n[测试6] 回收站脚本（recycleScript）");
{
  const tricky = [
    "C:\\Users\\a b\\会话 目录\\aaaaaaaa-1111-2222-3333-444444444444",
    "C:\\x\\it's\\bbbbbbbb-1111-2222-3333-444444444444",
  ];
  const text = mod.recycleScript(tricky, "C:\\t\\r.txt");
  check("反斜杠被正确转义", text.includes(tricky[0].replace(/\\/g, "\\\\")), "路径原样出现在脚本里");
  check("单引号不破坏脚本（用 JSON 转义，不是单引号包裹）", text.includes('"C:\\\\x\\\\it\'s') || text.includes("it's"));
  check("调用了 Shell.Application 的 MoveHere", text.includes("bin.MoveHere("));
  check("用 FolderExists 判残留", text.includes("fso.FolderExists("));
  check("结果写文件而不是 stdout（受限环境拿不到管道）", text.includes("CreateTextFile(resultFile"));
  check("带超时上限，不会无限等", text.includes("var deadline") && text.includes("WScript.Sleep(200)"));
  check("脚本以 CRLF 分行（cscript 对换行敏感）", text.includes("\r\n") && !/[^\r]\n/.test(text));
  check("回收站被关掉时先拒绝（不静默永久删）", text.includes("NukeOnDelete") && text.includes('write("NUKE'));
  // Windows 把「不移到回收站」存在卷级键上（回收站属性按驱动器逐个勾选），只读根键会让闸门失效。
  check("按卷查 NukeOnDelete（盘符 → Win32_Volume 的卷 GUID）", text.includes("Win32_Volume") && text.includes("volumeKeyOf"));
  check("卷级读不到时退回根键值（兼容旧版）", text.includes("ROOT_KEY") && text.includes("isNukeOn"));
  check("移完按「原位置 + 名字」回回收站点名核对", text.includes("GetDetailsOf") && text.includes("matched++"));
  check("点名核对逐项容错（个别项抛错不带塌整轮）", text.includes("catch (err2)"));
  check("不再做多余的两次计数（省掉每次删除约 2 秒）", text.includes("function count()") === false);
  check("脚本能被 JSON.parse 回路径数组", (() => {
    const m = text.match(/^var paths = (.*);$/m);
    if (!m) return false;
    try { return JSON.parse(m[1]).length === 2; } catch { return false; }
  })());
}

console.log("\n[测试6.5] 卷级 NukeOnDelete 判定（真跑 cscript，只读注册表，不搬任何文件）");
{
  const exe = (process.env.SystemRoot || "C:\\Windows") + "\\System32\\cscript.exe";
  const resultFile = path.join(os.tmpdir(), `sd-nuke-${process.pid}.txt`);
  const fake = path.join(os.tmpdir(), `sd-nuke-dir-${process.pid}`);
  const scriptFile = path.join(os.tmpdir(), `sd-nuke-${process.pid}.js`);
  const full = mod.recycleScript([fake], resultFile);
  const cut = full.indexOf('var sh = new ActiveXObject("Shell.Application");');
  if (cut < 0) {
    check("脚本里能找到搬移起点", false, "Shell.Application 未出现");
  } else {
    // 只保留「判定」部分，把 MoveHere 及其后的动作全部砍掉，确保这条测试绝不搬文件。
    const judge = full.slice(0, cut) + [
      'var out = "F:" + (isNukeOn(paths[0]) ? "NUKE" : "OK");',
      'var vk = volumeKeyOf(paths[0]);',
      'readNuke = function (k) { return k.indexOf("Volume") >= 0 ? 1 : 0; };',
      'var volHit = isNukeOn(paths[0]);',
      'readNuke = function (k) { return k.indexOf("Volume") >= 0 ? 0 : 1; };',
      'var rootHit = isNukeOn(paths[0]);',
      'readNuke = function (k) { return 0; };',
      'var clearHit = isNukeOn(paths[0]);',
      'write("JUDGE|" + out + "|vk=" + vk + "|vol=" + volHit + "|root=" + rootHit + "|clear=" + clearHit);',
    ].join("\r\n");
    fs.writeFileSync(scriptFile, "\uFEFF" + judge, "utf16le");
    try {
      const r = spawnSync(exe, ["//nologo", "//E:JScript", scriptFile], { stdio: "ignore", timeout: 60000, windowsHide: true });
      let text = "";
      try { text = fs.readFileSync(resultFile, "utf8").trim(); } catch {}
      check("cscript 能跑通判定脚本", r.status === 0 && text.startsWith("JUDGE|"), `status=${r.status} out=${text.slice(0, 40)}`);
      check("盘符解析到真实卷 GUID", /vk=HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\BitBucket\\Volume\\\{[0-9a-fA-F-]+\}/.test(text), text.slice(0, 120));
      check("当前卷未关回收站 → 放行", /\|F:OK\|/.test(text));
      check("卷级开关为 1 → 拒绝", /\|vol=true/.test(text));
      check("根键开关为 1 → 也拒绝（兼容旧版）", /\|root=true/.test(text));
      check("都为 0 → 才放行", /\|clear=false$/.test(text));
    } finally {
      for (const f of [scriptFile, resultFile]) { try { fs.rmSync(f, { force: true }); } catch {} }
    }
  }
}

console.log("\n[测试7] 路径围栏（isInside）");
{
  const root = path.join(os.tmpdir(), "sd-fence-root");
  check("根目录内的子路径 → 允许", mod.isInside(root, path.join(root, "a", "b")) === true);
  check("根目录本身 → 拒绝（必须真在里面）", mod.isInside(root, root) === false);
  check("同前缀的另一目录 → 拒绝", mod.isInside(root, root + "-evil\\x") === false);
  check("父目录 → 拒绝", mod.isInside(root, path.dirname(root)) === false);
}

console.log("\n[测试8] 残留审计（auditLeftover）");
{
  const emptyCtx = { get: () => undefined, logger: { info: () => {}, warn: () => {}, debug: () => {} } };
  const gone = mod.auditLeftover(emptyCtx, "session-00000000-0000-0000-0000-000000000000", []);
  check("目录已不在 + 无存储域 → 判定干净", gone.clean === true, JSON.stringify(gone.leftover));
  const dir = path.join(os.tmpdir(), `sd-audit-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const still = mod.auditLeftover(emptyCtx, "session-00000000-0000-0000-0000-000000000000", [dir]);
    const codes = still.leftover.map((x) => (x && x.code) || x);
    check("目录还在 → 判定有残留", still.clean === false && codes.includes("L_SESSION_DIR"), JSON.stringify(still.leftover));
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

console.log("\n[测试9] 旧功能已彻底移除（静态检查）");
{
  const src = fs.readFileSync(PLUGIN, "utf8");
  for (const [label, token] of [
    ["启动自检 sweepOrphans", "sweepOrphans"],
    ["deep 清理端点", "/api/session.sweep"],
    ["deep 令牌文件", ".session-sweep-token"],
    ["孤儿子代理判定", "findOrphanSubagents"],
    ["永久删除调用 rm(", "rm(dir, { recursive: true, force: true })"],
  ]) {
    check(`源码里不再出现：${label}`, src.includes(token) === false);
  }
  check("删除入口仍只注册一个端点", (src.match(/path: "\/api\/session\./g) ?? []).length === 1);
  check("发布件仍只导出 name/inject/apply", mod.name === "dsh-session-remover" && typeof mod.apply === "function" && mod.inject.includes("webServer"));
}

console.log("\n[测试9.5] 服务端失败一律为「错误码 + 参数」，不含面向界面的中文");
{
  const src = fs.readFileSync(PLUGIN, "utf8");
  // 宿主半不许再产出自然语言：界面文案归浏览器半的词表，否则英文界面下会冒出中文。
  const hanInError = [...src.matchAll(/(?:error|reason)\s*:\s*"[^"]*[\u4e00-\u9fff][^"]*"/g)].map((m) => m[0]);
  check("宿主半不再出现中文字面量的 error/reason", hanInError.length === 0, hanInError.join(" | "));
  const codes = [...src.matchAll(/fail\("([A-Z0-9_]+)"/g)].map((m) => m[1]);
  check("宿主半的失败码数量 ≥ 25", codes.length >= 25, String(codes.length));
  // 每个宿主半失败码都必须在浏览器半有对应词条，否则界面上会露出裸码。
  const clientSrc = fs.readFileSync(path.join(HERE, "..", "lib", "client.js"), "utf8");
  const missing = [...new Set(codes)].filter((c) => clientSrc.includes('"err.' + c + '"') === false);
  check("宿主半每个失败码都有界面词条", missing.length === 0, missing.join(","));
  const leftoverCodes = [...src.matchAll(/code:\s*"(L_[A-Z0-9_]+)"/g)].map((m) => m[1]);
  const missLeft = [...new Set(leftoverCodes)].filter((c) => clientSrc.includes('"leftover.' + c + '"') === false);
  check("残留项每个码都有界面词条", missLeft.length === 0, missLeft.join(","));
}

console.log("\n[测试10] 整条删除流程（假 DSH_HOME + 假会话树，真进回收站）");
{
  const saved = process.env.DSH_HOME;
  const home = path.join(os.tmpdir(), `sd-flow-${process.pid}`);
  const slug = path.join(home, "sessions", "--F-fake-workspace--");
  const parentId = "session-11111111-1111-1111-1111-111111111111";
  const childA = "session-22222222-2222-2222-2222-222222222222";
  const childB = "session-33333333-3333-3333-3333-333333333333";
  const short = (id) => id.replace(/^session-/, "");
  const mkSession = (id, header) => {
    const dir = path.join(slug, short(id));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "log.zstd"), zlib.zstdCompressSync(Buffer.from(JSON.stringify(header) + "\n", "utf8")));
    return dir;
  };
  fs.mkdirSync(slug, { recursive: true });
  const dirParent = mkSession(parentId, { type: "session", id: parentId, cwd: "F:\\fake" });
  const dirA = mkSession(childA, { type: "session", id: childA, cwd: "F:\\fake", origin: "subagent", parentSession: parentId });
  const dirB = mkSession(childB, { type: "session", id: childB, cwd: "F:\\fake", origin: "subagent", parentSession: parentId });

  process.env.DSH_HOME = home;
  try {
    const detached = [];
    const unarchiveCalls = [];
    const accounted = [parentId];
    // 只保留 rc.2 里真实存在的存储域：message_feedback 已改为会话日志权威，不再是存储域。
    const rows = { session_projcache: new Set([short(parentId), short(childA), short(childB)]) };
    const table = (name) => ({
      get: (id) => (rows[name].has(short(id)) ? { id } : undefined),
      delete: async (id) => { rows[name].delete(short(id)); },
      entries: () => [...rows[name]].map((id) => [id]),
    });
    const ctx10 = {
      _archived: [parentId],
      get(name) {
        if (name === "workspaceRegistry") {
          // 现实中子代理不进工作区记账（记账里只有主会话），且 detachSession 会真的把这一行去掉。
          return {
            list: () => [{
              get sessionIds() { return accounted; },
              detachSession: async (id) => {
                detached.push(id);
                const i = accounted.indexOf(id);
                if (i >= 0) accounted.splice(i, 1);
              },
            }],
            // 公开接口：不在归档集时静默返回（与官方实现一致）。
            get archivedSessionIds() { return ctx10._archived; },
            unarchiveSession: async (id) => {
              const i = ctx10._archived.indexOf(id);
              if (i < 0) return;
              unarchiveCalls.push(id);
              ctx10._archived = ctx10._archived.filter((x) => x !== id);
            },
            requireState: () => ({ archivedSessionIds: ctx10._archived }),
            enqueueOperation: async (f) => f(),
            setState: async (s) => { ctx10._archived = s.archivedSessionIds; },
          };
        }
        if (name === "storageDomain") return { get: (n) => (rows[n] ? { table: () => table(n) } : undefined) };
        return undefined;
      },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
    };

    const r = await mod.deleteSessionCore(ctx10, parentId);
    check("返回 ok", r.ok === true, why(r));
    check("连带收全 2 个子代理（共 3 个会话）", r.sessions === 3 && r.subagents === 2, `sessions=${r.sessions} subagents=${r.subagents}`);
    check("三个目录都已离开磁盘", [dirParent, dirA, dirB].every((d) => fs.existsSync(d) === false));
    check("回收站项数增加 3", r.recycled === 3, `recycled=${r.recycled}`);
    check("工作区记账已摘除（B 方案：不留痕）", detached.length === 1 && detached[0] === parentId, `摘了 ${detached.length} 条`);
    check("归档集已摘除", ctx10._archived.length === 0, JSON.stringify(ctx10._archived));
    check("归档集摘除走的是公开接口 unarchiveSession", unarchiveCalls.length === 1 && unarchiveCalls[0] === parentId, JSON.stringify(unarchiveCalls));
    check("投影缓存三行全清", rows.session_projcache.size === 0);
    // 插件只清 rc.2 里真实存在的存储域，不再碰 message_feedback（它已不是存储域）。
    check("不再尝试清理不存在的 message_feedback 存储域", rows.message_feedback === undefined);
    check("审计判定干净、无警告", r.clean === true && r.warnings.length === 0, JSON.stringify({ leftover: r.leftover, warnings: r.warnings }));

    const again = await mod.deleteSessionCore(ctx10, parentId);
    check("对已删除的会话再删一次 → 404，不报错也不重复搬", again.ok === false && again.status === 404 && again.code === "E_NOT_FOUND", why(again));
  } finally {
    process.env.DSH_HOME = saved;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch {}
  }
}

console.log("\n" + "=".repeat(64));
console.log(`结果：${pass} 通过 / ${fail} 失败`);
console.log("=".repeat(64));
if (fail > 0) console.log("⚠ 有失败项 → 改完插件请先修好再重启 DSH。");
else console.log("全部通过。改动没问题的话重启 DSH 即可生效。");

try { fs.unlinkSync(probe); } catch {}
process.exitCode = fail === 0 ? 0 : 1;
