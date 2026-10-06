window.__ModuleLoader__.load({
  id: "dsh-session-remover",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");

    var primitives = null;
    try {
      primitives = require("@deepseek-ai/dsh-client-ui-primitives") || null;
    } catch (e) {
      primitives = null;
    }
    var MenuItemButton = primitives && primitives.MenuItemButton ? primitives.MenuItemButton : null;
    var IconTrash = primitives && primitives.IconTrashOutlineRegular ? primitives.IconTrashOutlineRegular : null;
    var IconCheck = primitives && primitives.IconCheckOutlineRegular ? primitives.IconCheckOutlineRegular : null;
    var Modal = primitives && primitives.Modal ? primitives.Modal : null;
    var Checkbox = primitives && primitives.Checkbox ? primitives.Checkbox : null;
    var Button = primitives && primitives.Button ? primitives.Button : null;

    var reactDomClient = null;
    try {
      reactDomClient = require("react-dom/client") || null;
    } catch (e) {
      reactDomClient = null;
    }
    var canMountOwnRoot = !!(reactDomClient && typeof reactDomClient.createRoot === "function");

    var SLOT = "sidebar.workspaces.session.menu.item";
    var ENTRY_ID = "dsh-session-remover/delete";
    var ENTRY_ORDER = 500;

    var BATCH_ENTRY_ID = "dsh-session-remover/batch-delete";
    var BATCH_ENTRY_ORDER = 600;
    var BATCH_ENDPOINT = "/api/session.delete";
    var STYLE_ID = "dsh-session-remover/style";

    var NS = "dsh-session-remover";
    var DICT = {
      zh: {
        "menu.delete": "删除对话",
        "menu.batch": "批量删除…",
        "batch.title": "批量删除对话",
        "batch.description": "勾选要删除的对话。删除后移入系统回收站，其子代理会话一并移入。",
        "batch.ack": "删除后移入系统回收站，其子代理会话一并移入。",
        "batch.selected": "已选 {selected} / 共 {total} 个",
        "batch.selectAll": "全选",
        "batch.selectNone": "全不选",
        "batch.noSource": "无法读取会话清单，未列出任何对话。单条删除仍可使用。",
        "batch.empty": "没有可批量删除的对话。子代理会话、空白会话、已归档会话不在此列。",
        "batch.forkNote": "列表含 {count} 个「分支」对话，由其他对话派生。删除分支不影响源对话，删除源对话亦不连带删除分支；如需删除请单独勾选。",
        "batch.currentNote": "所选包含当前打开的对话。删除前将先停止其任务，完成后页面自动刷新。",
        "batch.deleting": "正在删除 {index}/{total}：{title}",
        "batch.deletingShort": "正在删除…",
        "batch.continue": "继续删除剩余 {count} 个",
        "batch.confirmDelete": "删除选中的 {count} 个",
        "batch.report.ok": "已移入回收站 {count} 个{list}",
        "batch.report.okColon": "：",
        "fmt.quote": "「{title}」",
        "batch.report.failed": "已中止，未删除 {count} 个。失败项「{title}」：{reason}",
        "batch.report.rest": "其后 {count} 个未处理。排除故障后可继续删除。",
        "batch.report.hint": "侧栏可能仍显示已删除的对话，刷新页面后与磁盘一致。已移入系统回收站的对话可从回收站还原。",
        "batch.report.warn": "会话已移入回收站，但有 {count} 条残留记录未能清理：{list}",
        "confirm.delete": "确认删除对话「{title}」？\n该对话及其子代理会话将移入系统回收站，可从回收站还原。",
        "confirm.batch": "确认删除选中的 {count} 个对话？\n这些对话及其子代理会话将移入系统回收站，可从回收站还原。",
        "error.noSessionId": "删除失败：未获取到会话编号，请刷新页面后重试。",
        "error.noSessionIdShort": "未获取到会话编号",
        "error.http": "删除失败（HTTP {status}）",
        "error.leftover": "会话已移入回收站，但有残留记录未能清理：\n{list}",
        "error.request": "删除请求失败：{reason}",
        "error.batchUnavailable": "批量删除不可用：缺少所需运行组件，请重启 DSH 后重试。",
        "error.batchUnavailableShort": "批量删除不可用：{reason}",
        "tag.fork": "分支",
        "tag.current": "当前打开",
        "common.untitled": "（无标题）",
        "common.close": "关闭",
        "common.cancel": "取消",
        "common.reload": "刷新页面",
        "join.list": "、",
        "join.warn": "；",
        "err.E_SESSION_ROOT_UNREADABLE": "无法读取会话根目录：{reason}",
        "err.E_WORKSPACE_DIR_UNREADABLE": "无法读取工作区目录 {name}：{reason}",
        "err.E_REGISTRY_UNAVAILABLE": "工作区登记表不可用",
        "err.E_SESSION_IDS_NOT_ARRAY": "工作区登记表中的会话名单不是数组（{type}）",
        "err.E_ARCHIVED_NOT_ARRAY": "归档名单不是数组（{type}）",
        "err.E_REGISTRY_READ_FAILED": "读取工作区登记表失败：{reason}",
        "err.E_PROTECTED_LIST_UNREADABLE": "无法读取受保护的会话名单（{reason}）；为避免误删，已放弃连带删除子代理会话",
        "err.E_INDEX_UNREADABLE": "{reason}；为避免误删，已放弃连带删除子代理会话",
        "err.E_CSCRIPT_MISSING": "未找到系统脚本宿主 cscript.exe",
        "err.E_DIR_OUTSIDE_ROOT": "已拒绝：待删除的目录不在会话根目录内",
        "err.E_RECYCLE_SPAWN_FAILED": "调用回收站失败：{reason}",
        "err.E_RECYCLE_NO_RESULT": "回收站未返回结果，脚本未执行完",
        "err.E_RECYCLE_DISABLED": "本机已关闭回收站（已勾选「不将文件移到回收站中，直接删除」），插件拒绝删除，以免数据无法还原",
        "err.E_NO_RECYCLE_BIN": "磁盘 {volume} 上没有可用的回收站（网络盘、U 盘或该磁盘尚未启用回收站），插件拒绝删除，以免数据无法还原。可先把会话目录搬到本地磁盘，或在该磁盘上删除任意一个文件以启用回收站后再试",
        "err.E_RECYCLE_UNRECOGNIZED": "无法识别回收站返回的结果",
        "err.E_RECYCLE_LEFT": "共 {total} 个会话目录，已移入回收站 {moved} 个，仍有 {left} 个未能移入",
        "err.E_RECYCLE_LEFT_REASON": "共 {total} 个会话目录，已移入回收站 {moved} 个，仍有 {left} 个未能移入：{reason}",
        "err.E_RECYCLE_MISMATCH": "回收站中仅找到 {matched}/{total} 个会话，可能有目录已被永久删除，请立即检查回收站",
        "err.E_WS_DETACH_FAILED": "从工作区摘除失败：{reason}",
        "err.E_DETACH_FAILED": "会话 {id} 未能从工作区摘除：{reason}",
        "err.E_ABORTED_NO_CHANGE": "{reason}；已放弃删除，未改动任何数据",
        "err.E_NOT_FOUND": "未找到该会话",
        "err.E_MOVE_ABORTED": "{reason}；已中止，存储域与登记表保持原样",
        "err.E_LOOPBACK_ONLY": "已拒绝：该接口仅接受本机（回环）请求",
        "err.E_POST_ONLY": "仅接受 POST 请求",
        "err.E_BODY_TOO_LARGE": "请求体过大",
        "err.E_BODY_READ_FAILED": "读取请求体失败",
        "err.E_SESSION_ID_REQUIRED": "缺少会话编号",
        "err.E_SESSION_ID_INVALID": "会话编号格式不正确：{id}",
        "err.E_INTERNAL": "服务端内部错误：{reason}",
        "leftover.L_SESSION_DIR": "会话目录",
        "leftover.L_PROJ_CACHE": "投影缓存",
        "leftover.L_WORKSPACE_REGISTRY": "工作区记账",
        "leftover.L_ARCHIVE_SET": "归档集",
        "leftover.L_SESSION_LEFTOVER": "会话 {id}：{what}"
      },
      en: {
        "menu.delete": "Delete conversation",
        "menu.batch": "Batch delete…",
        "batch.title": "Batch delete conversations",
        "batch.description": "Tick the conversations to delete. They are moved to the system recycle bin, together with their subagent sessions.",
        "batch.ack": "After deletion they go to the system recycle bin, together with their subagent sessions.",
        "batch.selected": "{selected} of {total} selected",
        "batch.selectAll": "Select all",
        "batch.selectNone": "Select none",
        "batch.noSource": "Could not read the conversation list, so none are listed. Single delete still works.",
        "batch.empty": "No conversations to batch delete. Subagent, blank and archived sessions are not listed here.",
        "batch.forkNote": "The list contains {count} forked conversations, derived from other conversations. Deleting a fork does not affect its source, and deleting a source does not delete its forks; tick them individually if you want them gone.",
        "batch.currentNote": "The selection includes the conversation you have open. Its running task will be stopped first, and the page reloads when done.",
        "batch.deleting": "Deleting {index}/{total}: {title}",
        "batch.deletingShort": "Deleting…",
        "batch.continue": "Delete the remaining {count}",
        "batch.confirmDelete": "Delete {count} selected",
        "batch.report.ok": "{count} moved to the recycle bin{list}",
        "batch.report.okColon": ": ",
        "fmt.quote": "\"{title}\"",
        "batch.report.failed": "Stopped; {count} not deleted. Failed on \"{title}\": {reason}",
        "batch.report.rest": "The remaining {count} were not processed. Fix the problem, then continue.",
        "batch.report.hint": "The sidebar may still show deleted conversations; reload the page to match the disk. Conversations in the system recycle bin can be restored from it.",
        "batch.report.warn": "The conversations were moved to the recycle bin, but {count} leftover records could not be cleaned: {list}",
        "confirm.delete": "Delete conversation \"{title}\"?\nIt and its subagent sessions will be moved to the system recycle bin, from which they can be restored.",
        "confirm.batch": "Delete the {count} selected conversations?\nThey and their subagent sessions will be moved to the system recycle bin, from which they can be restored.",
        "error.noSessionId": "Delete failed: no session id was available. Reload the page and try again.",
        "error.noSessionIdShort": "no session id was available",
        "error.http": "Delete failed (HTTP {status})",
        "error.leftover": "The conversation was moved to the recycle bin, but some leftover records could not be cleaned:\n{list}",
        "error.request": "Delete request failed: {reason}",
        "error.batchUnavailable": "Batch delete is unavailable: a required runtime module is missing. Restart DSH and try again.",
        "error.batchUnavailableShort": "Batch delete is unavailable: {reason}",
        "tag.fork": "fork",
        "tag.current": "open",
        "common.untitled": "(untitled)",
        "common.close": "Close",
        "common.cancel": "Cancel",
        "common.reload": "Reload page",
        "join.list": ", ",
        "join.warn": "; ",
        "err.E_SESSION_ROOT_UNREADABLE": "Cannot read the sessions root directory: {reason}",
        "err.E_WORKSPACE_DIR_UNREADABLE": "Cannot read the workspace directory {name}: {reason}",
        "err.E_REGISTRY_UNAVAILABLE": "The workspace registry is unavailable",
        "err.E_SESSION_IDS_NOT_ARRAY": "The session list in the workspace registry is not an array ({type})",
        "err.E_ARCHIVED_NOT_ARRAY": "The archived list is not an array ({type})",
        "err.E_REGISTRY_READ_FAILED": "Failed to read the workspace registry: {reason}",
        "err.E_PROTECTED_LIST_UNREADABLE": "Cannot read the protected session list ({reason}); cascading deletion of subagent sessions was abandoned to avoid deleting the wrong sessions",
        "err.E_INDEX_UNREADABLE": "{reason}; cascading deletion of subagent sessions was abandoned to avoid deleting the wrong sessions",
        "err.E_CSCRIPT_MISSING": "The system script host cscript.exe was not found",
        "err.E_DIR_OUTSIDE_ROOT": "Refused: a directory to delete is outside the sessions root",
        "err.E_RECYCLE_SPAWN_FAILED": "Failed to invoke the recycle bin: {reason}",
        "err.E_RECYCLE_NO_RESULT": "The recycle bin returned no result; the script did not finish",
        "err.E_RECYCLE_DISABLED": "The recycle bin is disabled on this machine (\"Don't move files to the Recycle Bin. Remove files immediately when deleted\" is selected), so the plugin refuses to delete rather than leave the data unrestorable",
        "err.E_NO_RECYCLE_BIN": "Volume {volume} has no usable recycle bin (a network drive, a USB stick, or a volume where the recycle bin has not been initialised), so the plugin refuses to delete rather than leave the data unrestorable. Move the session directory to a local disk, or delete any file on that volume once to initialise its recycle bin, and try again",
        "err.E_RECYCLE_UNRECOGNIZED": "The result returned by the recycle bin could not be recognised",
        "err.E_RECYCLE_LEFT": "Of {total} session directories, {moved} were moved to the recycle bin and {left} could not be moved",
        "err.E_RECYCLE_LEFT_REASON": "Of {total} session directories, {moved} were moved to the recycle bin and {left} could not be moved: {reason}",
        "err.E_RECYCLE_MISMATCH": "Only {matched}/{total} sessions were found in the recycle bin; some directories may have been permanently deleted, so check the recycle bin immediately",
        "err.E_WS_DETACH_FAILED": "Failed to detach from the workspace: {reason}",
        "err.E_DETACH_FAILED": "Session {id} could not be detached from the workspace: {reason}",
        "err.E_ABORTED_NO_CHANGE": "{reason}; deletion was abandoned and no data was changed",
        "err.E_NOT_FOUND": "Session not found",
        "err.E_MOVE_ABORTED": "{reason}; the operation was stopped and no records were deleted",
        "err.E_LOOPBACK_ONLY": "Refused: this endpoint accepts loopback requests only",
        "err.E_POST_ONLY": "POST only",
        "err.E_BODY_TOO_LARGE": "Request body too large",
        "err.E_BODY_READ_FAILED": "Failed to read the request body",
        "err.E_SESSION_ID_REQUIRED": "Missing session id",
        "err.E_SESSION_ID_INVALID": "Invalid session id format: {id}",
        "err.E_INTERNAL": "Internal server error: {reason}",
        "leftover.L_SESSION_DIR": "session directory",
        "leftover.L_PROJ_CACHE": "projection cache",
        "leftover.L_WORKSPACE_REGISTRY": "workspace registry",
        "leftover.L_ARCHIVE_SET": "archived set",
        "leftover.L_SESSION_LEFTOVER": "Session {id}: {what}"
      }
    };

    // 文案跟随 DSH 界面语言（官方 locale 服务）；服务缺失时退回中文，不因取不到而报错。
    var i18n = { service: null, active: "zh", revision: 0, listeners: [] };

    function i18nNotify() {
      i18n.revision += 1;
      var list = i18n.listeners.slice();
      for (var i = 0; i < list.length; i++) {
        try { list[i](); } catch (e) { }
      }
    }

    function i18nSubscribe(fn) {
      i18n.listeners.push(fn);
      return function () {
        var at = i18n.listeners.indexOf(fn);
        if (at >= 0) i18n.listeners.splice(at, 1);
      };
    }

    function i18nReadActive() {
      var service = i18n.service;
      if (!service) return "zh";
      try {
        var snapshot = typeof service.getLocale === "function" ? service.getLocale() : null;
        var active = snapshot && snapshot.active;
        if (typeof active === "string" && active !== "") {
          if (DICT[active]) return active;
          if (active.indexOf("zh") === 0) return "zh";
          return "en";
        }
      } catch (e) { }
      return "zh";
    }

    function i18nSync() {
      var next = i18nReadActive();
      if (next === i18n.active) return;
      i18n.active = next;
      i18nNotify();
    }

    function t(key, params) {
      var table = DICT[i18n.active] || DICT.zh;
      // 词表为普通对象，键可能与原型链上的属性同名（如 constructor），故一律按自有属性判定。
      var text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
      if (text === undefined) {
        text = Object.prototype.hasOwnProperty.call(DICT.zh, key) ? DICT.zh[key] : undefined;
      }
      if (text === undefined) return key;
      if (params) {
        text = text.replace(/\{(\w+)\}/g, function (whole, name) {
          var v = params[name];
          return v === undefined || v === null ? whole : String(v);
        });
      }
      return text;
    }

    function hasKey(key) {
      var table = DICT[i18n.active] || DICT.zh;
      return Object.prototype.hasOwnProperty.call(table, key) || Object.prototype.hasOwnProperty.call(DICT.zh, key);
    }

    // 服务端的失败为「错误码 + 参数」；嵌套原因（reason）本身也可能为失败对象，故递归展开。
    function renderFailure(value) {
      if (value === null || value === undefined) return "";
      if (typeof value === "string") {
        // 参数中也可能直接嵌入错误码原文（而非对象），可识别时一并取词。
        var bare = /^(E|L)_[A-Z0-9_]+$/.test(value) ? (value.indexOf("L_") === 0 ? "leftover." : "err.") + value : null;
        return bare !== null && hasKey(bare) ? t(bare) : value;
      }
      if (typeof value !== "object") return String(value);
      var code = value.code;
      if (typeof code === "string" && code !== "") {
        var key = (code.indexOf("L_") === 0 ? "leftover." : "err.") + code;
        if (!hasKey(key)) return typeof value.message === "string" ? value.message : code;
        var src = value.params || {};
        var params = {};
        for (var name in src) {
          if (Object.prototype.hasOwnProperty.call(src, name)) params[name] = renderFailure(src[name]);
        }
        return t(key, params);
      }
      if (typeof value.error === "string" && value.error !== "") return value.error;
      return "";
    }

    // 浮层挂载于自行创建的 React 根上（不经官方插槽），故自行订阅语言变化后重渲染。
    function useI18nRevision() {
      var state = react.useState(i18n.revision);
      var setValue = state[1];
      react.useEffect(function () {
        return i18nSubscribe(function () { setValue(i18n.revision); });
      }, []);
      return state[0];
    }

    var CSS_TEXT = [
      ".dsh-session-remover-dialog{width:min(460px,100%)}",
      ".dsh-session-remover-toolbar{display:flex;align-items:center;gap:8px;",
      "font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#5f6570)}",
      ".dsh-session-remover-list{margin-top:10px;max-height:min(46vh,320px);overflow:auto;",
      "border:0.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));border-radius:10px;padding:4px}",
      ".dsh-session-remover-row{display:flex;align-items:flex-start;border-radius:8px;padding:4px 6px}",
      ".dsh-session-remover-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}",
      ".dsh-session-remover-row>label{width:100%;align-items:flex-start}",
      ".dsh-session-remover-rowmain{display:flex;flex-direction:column;min-width:0}",
      ".dsh-session-remover-title{font-size:13px;line-height:20px;overflow-wrap:anywhere}",
      ".dsh-session-remover-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;",
      "font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b9098)}",
      ".dsh-session-remover-tag{border:0.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.2));",
      "border-radius:4px;padding:0 4px}",
      ".dsh-session-remover-note{margin:10px 0 0;font-size:12px;line-height:18px;",
      "color:var(--dsw-alias-state-warn-label,#8a6d00)}",
      ".dsh-session-remover-empty{margin:12px 0;font-size:13px;line-height:20px;",
      "color:var(--dsw-alias-label-tertiary,#8b9098)}",
      ".dsh-session-remover-report{margin-top:8px;font-size:12px;line-height:18px}",
      ".dsh-session-remover-report p{margin:0 0 6px}",
      ".dsh-session-remover-ok{color:var(--dsw-alias-state-success-primary,#1a7f37)}",
      ".dsh-session-remover-bad{color:var(--dsw-alias-state-error-primary,#e5484d)}",
      ".dsh-session-remover-progress{font-size:13px;line-height:20px;overflow-wrap:anywhere}",
      ".dsh-session-remover-danger{background:var(--dsw-alias-state-error-primary,#e5484d)!important;",
      "color:#fff!important;border-color:transparent!important}",
      ".dsh-session-remover-fallback-mask{position:fixed;inset:0;z-index:1000;display:flex;",
      "align-items:center;justify-content:center;padding:24px;",
      "background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.35))}",
      ".dsh-session-remover-fallback-card{box-sizing:border-box;width:min(460px,100%);",
      "max-height:80vh;overflow:auto;padding:20px 24px;border-radius:16px;",
      "background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.2))}",
      ".dsh-session-remover-fallback-card h2{margin:0 0 10px;font-size:16px;font-weight:500}",
      ".dsh-session-remover-fallback-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}",
      ""
    ].join("");

    function warn(message, error) {
      try {
        console.warn("[dsh-session-remover] " + message, error === undefined ? "" : error);
      } catch (e) { }
    }

    // 确认框不可用时按「不删」处理：不可逆操作的安全阀失效方向必须是拒绝。
    function confirmDelete(message) {
      try { return window.confirm(message) === true; } catch (e) { return false; }
    }

    async function requestDelete(sessionId, displayTitle) {
      var shown = displayTitle || sessionId || t("common.untitled");
      if (!confirmDelete(t("confirm.delete", { title: shown }))) return;
      if (!sessionId) {
        window.alert(t("error.noSessionId"));
        return;
      }
      try {
        var response = await fetch("/api/session.delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId })
        });
        var result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) {
          window.alert(renderFailure(result) || t("error.http", { status: response.status }));
          return;
        }
        // 残留（leftover）与警告均须报出，仅报 warnings 将使「有记录未清理」静默消失。
        var notes = collectNotes(result);
        if (notes.length > 0) {
          window.alert(t("error.leftover", { list: notes.map(renderFailure).join("\n") }));
        }
        window.location.reload();
      } catch (error) {
        window.alert(t("error.request", { reason: (error && error.message) || error }));
      }
    }

    // 残留与警告合并为一串：两者均表示「目录已移走，但本地仍有数据未清理」。
    function collectNotes(result) {
      var notes = [];
      if (result && Array.isArray(result.warnings)) notes = notes.concat(result.warnings);
      if (result && Array.isArray(result.leftover)) notes = notes.concat(result.leftover);
      return notes;
    }

    async function postSessionDelete(sessionId) {
      if (!sessionId) throw new Error(t("error.noSessionIdShort"));
      var response = await fetch(BATCH_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId })
      });
      var result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(renderFailure(result) || t("error.http", { status: response.status }));
      }
      return result;
    }

    function readBatchSources(ctx) {
      var sessions = null;
      var workspaces = null;
      try { sessions = ctx.get("sessions") || null; } catch (e) { sessions = null; }
      try { workspaces = ctx.get("workspaces") || null; } catch (e) { workspaces = null; }
      return {
        sessionList: sessions && sessions.list ? sessions.list : null,
        workspaceList: workspaces && workspaces.list ? workspaces.list : null
      };
    }

    function useSnapshotSource(source, fallback) {
      var state = react.useState(function () {
        try { return source ? source.getSnapshot() : fallback; } catch (e) { return fallback; }
      });
      var value = state[0];
      var setValue = state[1];
      var lastRef = react.useRef(value);
      react.useEffect(function () {
        if (!source || typeof source.subscribe !== "function") return undefined;
        var read = function () {
          var next;
          try { next = source.getSnapshot(); } catch (e) { return; }
          if (next === lastRef.current) return;
          lastRef.current = next;
          setValue(next);
        };
        read();
        var unsubscribe = source.subscribe(read);
        return function () {
          if (typeof unsubscribe === "function") {
            try { unsubscribe(); } catch (e) { }
          }
        };
      }, [source]);
      return value;
    }

    // origin === "subagent" 过滤是安全关键：遗漏会将子代理会话列给用户。
    function selectBatchRows(listState, workspaceState, currentId) {
      var rows = [];
      if (!listState || !listState.byId) return rows;
      var archived = {};
      var archivedIds = (workspaceState && workspaceState.archivedSessionIds) || [];
      for (var a = 0; a < archivedIds.length; a++) archived[archivedIds[a]] = true;

      var workspaceTitle = {};
      var workspaceOrder = [];
      var items = (workspaceState && workspaceState.items) || [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var memberIds = (item && item.sessionIds) || [];
        for (var j = 0; j < memberIds.length; j++) {
          var memberId = memberIds[j];
          if (workspaceTitle[memberId] === undefined) {
            workspaceTitle[memberId] = (item && item.title) || "";
            workspaceOrder.push(memberId);
          }
        }
      }

      var seen = {};
      function pushId(id) {
        if (id === undefined || id === null || seen[id] === true) return;
        seen[id] = true;
        var summary = listState.byId[id];
        if (!summary) return;
        if (summary.origin === "subagent") return;
        if (summary.blank === true) return;
        if (archived[id] === true) return;
        var title = summary.displayTitle || summary.title || id;
        rows.push({
          id: id,
          title: title,
          workspace: workspaceTitle[id] || "",
          fork: typeof summary.parentId === "string" && summary.parentId.length > 0,
          current: id === currentId
        });
      }

      for (var k = 0; k < workspaceOrder.length; k++) pushId(workspaceOrder[k]);
      var ids = Array.isArray(listState.ids) ? listState.ids : Object.keys(listState.byId);
      for (var m = 0; m < ids.length; m++) pushId(ids[m]);
      return rows;
    }

    function currentSessionId(listState) {
      if (!listState || !listState.byId) return undefined;
      var values = Object.keys(listState.byId).map(function (key) { return listState.byId[key]; });
      for (var i = 0; i < values.length; i++) {
        var summary = values[i];
        if (summary && summary.retainedBy && (summary.retainedBy.mainView || 0) > 0) return summary.id;
      }
      return undefined;
    }

    // 官方组件（Button/Checkbox/Modal）取不到时有朴素降级实现，键盘与语义仍可用。
    function uiButton(props) {
      if (Button) return react.createElement(Button, props);
      return react.createElement("button", {
        key: props.key,
        type: "button",
        disabled: props.disabled === true,
        onClick: props.onClick,
        className: props.className,
        style: {
          height: 28, padding: "0 12px", borderRadius: 14, cursor: props.disabled ? "default" : "pointer",
          border: "0.5px solid var(--dsw-alias-border-l3, rgba(0,0,0,.2))",
          background: "transparent", color: "inherit", font: "inherit", fontSize: 13
        }
      }, props.children);
    }

    function uiCheckbox(props) {
      if (Checkbox) return react.createElement(Checkbox, props);
      return react.createElement("label", { style: { display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" } }, [
        react.createElement("input", {
          key: "input",
          type: "checkbox",
          checked: props.checked === true,
          disabled: props.disabled === true,
          onChange: function (event) { props.onChange(event.target.checked); }
        }),
        react.createElement("span", { key: "label", style: { minWidth: 0 } }, props.label)
      ]);
    }

    function uiModal(props) {
      if (Modal) {
        return react.createElement(Modal, {
          open: true,
          onClose: props.onClose,
          title: props.title,
          closeLabel: props.closeLabel,
          description: props.description,
          className: "dsh-session-remover-dialog",
          children: props.children,
          footer: props.footer
        });
      }
      return react.createElement("div", {
        className: "dsh-session-remover-fallback-mask",
        onClick: function () { props.onClose(); }
      }, react.createElement("div", {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": props.title,
        className: "dsh-session-remover-fallback-card",
        onClick: function (event) { event.stopPropagation(); }
      }, [
        react.createElement("h2", { key: "title" }, props.title),
        props.description ? react.createElement("p", { key: "desc", style: { margin: "0 0 8px", fontSize: 13 } }, props.description) : null,
        react.createElement("div", { key: "body" }, props.children),
        react.createElement("div", { key: "footer", className: "dsh-session-remover-fallback-actions" }, props.footer)
      ]));
    }

    function BatchDeleteDialog(props) {
      var ctx = props.ctx;
      var onClose = props.onClose;
      useI18nRevision();
      var sources = readBatchSources(ctx);
      var listState = useSnapshotSource(sources.sessionList, null);
      var workspaceState = useSnapshotSource(sources.workspaceList, null);

      var currentId = react.useMemo(function () { return currentSessionId(listState); }, [listState]);
      var rows = react.useMemo(
        function () { return selectBatchRows(listState, workspaceState, currentId); },
        [listState, workspaceState, currentId]
      );

      var selectedState = react.useState(function () {
        var initial = {};
        if (props.initialId) {
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].id === props.initialId) { initial[props.initialId] = true; break; }
          }
        }
        return initial;
      });
      var selected = selectedState[0];
      var setSelected = selectedState[1];
      var ackState = react.useState(false);
      var acknowledged = ackState[0];
      var setAcknowledged = ackState[1];
      var busyState = react.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var progressState = react.useState(null);
      var progress = progressState[0];
      var setProgress = progressState[1];
      var reportState = react.useState(null);
      var report = reportState[0];
      var setReport = reportState[1];
      var bodyRef = react.useRef(null);

      var selectedIds = Object.keys(selected);
      var selectedCount = selectedIds.length;
      var forkCount = 0;
      for (var f = 0; f < rows.length; f++) if (rows[f].fork) forkCount++;
      var currentPicked = currentId !== undefined && selected[currentId] === true;

      function toggle(id) {
        if (busy) return;
        setSelected(function (previous) {
          var next = {};
          var keys = Object.keys(previous || {});
          for (var i = 0; i < keys.length; i++) next[keys[i]] = true;
          if (next[id] === true) delete next[id];
          else next[id] = true;
          return next;
        });
        setAcknowledged(false);
      }

      function selectAll() {
        if (busy) return;
        setSelected(function () {
          var next = {};
          for (var i = 0; i < rows.length; i++) next[rows[i].id] = true;
          return next;
        });
        setAcknowledged(false);
      }

      function deselectAll() {
        if (busy) return;
        setSelected({});
        setAcknowledged(false);
      }

      // 关闭闸门：删除进行中（busy）时不响应关闭，待其结束。
      function requestClose() {
        if (busy) return;
        onClose();
      }

      react.useEffect(function () {
        var onKeyDown = function (event) {
          if (event.key === "Escape") requestClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return function () { document.removeEventListener("keydown", onKeyDown); };
      }, [onClose, busy]);

      react.useEffect(function () {
        if (busy || report) return;
        var node = bodyRef.current;
        if (!node || typeof node.querySelector !== "function") return;
        var input = node.querySelector('input[type="checkbox"]');
        if (input && typeof input.focus === "function") {
          try { input.focus(); } catch (e) { }
        }
      }, [busy, report]);

      // 删除串行逐个请求，不并发。
      async function runDelete(targets) {
        if (busy || targets.length === 0) return;
        if (!confirmDelete(t("confirm.batch", { count: targets.length }))) return;

        setReport(null);
        setBusy(true);
        var deleted = [];
        var failed = null;
        var remaining = [];
        var warnings = [];
        for (var i = 0; i < targets.length; i++) {
          var target = targets[i];
          setProgress({ index: i + 1, total: targets.length, title: target.title });
          try {
            var done = await postSessionDelete(target.id);
            deleted.push(target);
            warnings = warnings.concat(collectNotes(done));
          } catch (error) {
            failed = { id: target.id, title: target.title, error: (error && error.message) || String(error) };
            remaining = targets.slice(i);
            break;
          }
        }
        setProgress(null);
        setBusy(false);
        if (failed === null && deleted.length === targets.length && warnings.length === 0) {
          window.location.reload();
          return;
        }
        setReport({ deleted: deleted, failed: failed, remaining: remaining, warnings: warnings });
      }

      function onConfirm() {
        var targets = [];
        for (var i = 0; i < rows.length; i++) if (selected[rows[i].id] === true) targets.push(rows[i]);
        void runDelete(targets);
      }

      function onContinue() {
        if (!report) return;
        var remaining = report.remaining;
        var next = {};
        for (var i = 0; i < remaining.length; i++) next[remaining[i].id] = true;
        setSelected(next);
        setReport(null);
        void runDelete(remaining);
      }

      var children = [];
      if (busy) {
        children.push(react.createElement("p", { key: "busy", className: "dsh-session-remover-progress" },
          progress
            ? t("batch.deleting", { index: progress.index, total: progress.total, title: progress.title })
            : t("batch.deletingShort")));
      } else if (report) {
        var reportLines = [];
        var okList = report.deleted.length > 0
          ? t("batch.report.okColon") + report.deleted.map(function (row) { return t("fmt.quote", { title: row.title }); }).join(t("join.list"))
          : "";
        reportLines.push(react.createElement("p", { key: "ok", className: "dsh-session-remover-ok" },
          t("batch.report.ok", { count: report.deleted.length, list: okList })));
        if (report.failed) {
          reportLines.push(react.createElement("p", { key: "bad", className: "dsh-session-remover-bad" },
            t("batch.report.failed", { count: report.remaining.length, title: report.failed.title, reason: report.failed.error })));
          if (report.remaining.length > 1) {
            reportLines.push(react.createElement("p", { key: "rest", className: "dsh-session-remover-meta" },
              t("batch.report.rest", { count: report.remaining.length - 1 })));
          }
        }
        reportLines.push(react.createElement("p", { key: "hint", className: "dsh-session-remover-meta" },
          t("batch.report.hint")));
        if (report.warnings && report.warnings.length > 0) {
          reportLines.push(react.createElement("p", { key: "warn", className: "dsh-session-remover-note" },
            t("batch.report.warn", { count: report.warnings.length, list: report.warnings.map(renderFailure).join(t("join.warn")) })));
        }
        children.push(react.createElement("div", { key: "report", className: "dsh-session-remover-report" }, reportLines));
      } else {
        children.push(react.createElement("div", { key: "toolbar", className: "dsh-session-remover-toolbar" }, [
          react.createElement("span", { key: "count" }, t("batch.selected", { selected: selectedCount, total: rows.length })),
          react.createElement("span", { key: "spacer", style: { marginLeft: "auto" } }),
          uiButton({ key: "all", variant: "ghost", size: "sm", disabled: busy || rows.length === 0, onClick: selectAll, children: t("batch.selectAll") }),
          uiButton({ key: "none", variant: "ghost", size: "sm", disabled: busy || selectedCount === 0, onClick: deselectAll, children: t("batch.selectNone") })
        ]));
        children.push(react.createElement("div", { key: "list", className: "dsh-session-remover-list", ref: bodyRef },
          !sources.sessionList
            ? react.createElement("p", { className: "dsh-session-remover-empty" },
                t("batch.noSource"))
            : rows.length === 0
              ? react.createElement("p", { className: "dsh-session-remover-empty" },
                  t("batch.empty"))
              : rows.map(function (row) {
                var meta = [];
                if (row.workspace) meta.push(react.createElement("span", { key: "ws" }, row.workspace));
                if (row.fork) meta.push(react.createElement("span", { key: "fork", className: "dsh-session-remover-tag" }, t("tag.fork")));
                if (row.current) meta.push(react.createElement("span", { key: "cur", className: "dsh-session-remover-tag" }, t("tag.current")));
                // label 传元素：官方 Checkbox 运行时按 children 渲染，传字符串将无法显示这一整行。
                var label = react.createElement("span", { className: "dsh-session-remover-rowmain" }, [
                  react.createElement("span", { key: "t", className: "dsh-session-remover-title" }, row.title),
                  meta.length > 0 ? react.createElement("span", { key: "m", className: "dsh-session-remover-meta" }, meta) : null
                ]);
                return react.createElement("div", { key: row.id, className: "dsh-session-remover-row" },
                  uiCheckbox({
                    checked: selected[row.id] === true,
                    disabled: busy,
                    label: label,
                    onChange: function () { toggle(row.id); }
                  }));
              })));
        if (forkCount > 0) {
          children.push(react.createElement("p", { key: "forknote", className: "dsh-session-remover-note" },
            t("batch.forkNote", { count: forkCount })));
        }
        if (currentPicked) {
          children.push(react.createElement("p", { key: "curnote", className: "dsh-session-remover-note" },
            t("batch.currentNote")));
        }
        children.push(react.createElement("div", { key: "ack", style: { marginTop: 12 } },
          uiCheckbox({
            checked: acknowledged,
            disabled: busy,
            label: t("batch.ack"),
            onChange: function (next) { setAcknowledged(next === true); }
          })));
      }

      var footer;
      if (busy) {
        footer = [uiButton({ key: "busy", variant: "outline", disabled: true, children: t("batch.deletingShort") })];
      } else if (report) {
        footer = [
          uiButton({ key: "close", variant: "ghost", onClick: requestClose, children: t("common.close") }),
          uiButton({ key: "reload", variant: "outline", onClick: function () { window.location.reload(); }, children: t("common.reload") }),
          uiButton({
            key: "continue",
            variant: "primary",
            className: "dsh-session-remover-danger",
            disabled: report.remaining.length === 0,
            onClick: onContinue,
            children: t("batch.continue", { count: report.remaining.length })
          })
        ];
      } else {
        footer = [
          uiButton({ key: "cancel", variant: "ghost", onClick: requestClose, children: t("common.cancel") }),
          uiButton({
            key: "confirm",
            variant: "primary",
            className: "dsh-session-remover-danger",
            disabled: !acknowledged || selectedCount === 0,
            onClick: onConfirm,
            children: t("batch.confirmDelete", { count: selectedCount })
          })
        ];
      }

      var description = report
        ? undefined
        : t("batch.description");
      return uiModal({
        title: t("batch.title"),
        closeLabel: t("common.close"),
        description: description,
        onClose: requestClose,
        children: children,
        footer: footer
      });
    }

    // 本插件向官方侧栏插槽注册菜单项；批量浮层为自行创建的 React 根（官方无多选插槽）。
    var host = { ctx: null, container: null, root: null, seq: 0 };

    function ensureHost() {
      if (host.root) return host.root;
      var container = document.createElement("div");
      container.setAttribute("data-dsh-session-remover", "batch-dialog");
      container.style.fontFamily = "var(--dsw-font-family, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif)";
      container.style.color = "var(--dsw-alias-label-primary, #1f2329)";
      container.style.fontSize = "14px";
      document.body.appendChild(container);
      host.container = container;
      host.root = reactDomClient.createRoot(container);
      return host.root;
    }

    function closeBatchDialog() {
      if (!host.root) return;
      try { host.root.render(null); } catch (e) { warn("关闭批量浮层失败", e); }
    }

    function openBatchDialog(initialId) {
      if (!canMountOwnRoot) {
        window.alert(t("error.batchUnavailable"));
        return;
      }
      try {
        ensureHost();
        host.seq += 1;
        host.root.render(react.createElement(BatchDeleteDialog, {
          key: "batch-" + host.seq,
          ctx: host.ctx,
          initialId: initialId,
          onClose: closeBatchDialog
        }));
      } catch (e) {
        warn("打开批量浮层失败", e);
        window.alert(t("error.batchUnavailableShort", { reason: (e && e.message) || e }));
      }
    }

    function disposeHost() {
      if (host.root) {
        try { host.root.unmount(); } catch (e) { }
        host.root = null;
      }
      if (host.container && host.container.parentNode) host.container.parentNode.removeChild(host.container);
      host.container = null;
    }

    // 官方 t 查不到词条时会将 key 原样返回，故「等于 key」同样视为未取到，否则菜单将显示错误码原文。
    function menuText(props, key) {
      if (props && typeof props.t === "function") {
        try {
          var text = props.t(key);
          if (typeof text === "string" && text !== "" && text !== key) return text;
        } catch (e) { }
      }
      return t(key);
    }

    function DeleteSessionMenuItem(props) {
      var sessionId = props.sessionId;
      var displayTitle = props.displayTitle;
      var useMenuOpenState = props.useMenuOpenState;
      var label = menuText(props, "menu.delete");
      var setMenuOpen = null;
      if (typeof useMenuOpenState === "function") {
        var pair = useMenuOpenState();
        setMenuOpen = pair && pair[1];
      }
      var onSelect = function () {
        if (typeof setMenuOpen === "function") {
          try { setMenuOpen(false); } catch (e) { }
        }
        void requestDelete(sessionId, displayTitle);
      };
      if (MenuItemButton) {
        return react.createElement(MenuItemButton, {
          icon: IconTrash ? react.createElement(IconTrash, { size: 14 }) : null,
          danger: true,
          onSelect: onSelect,
          children: label
        });
      }
      return react.createElement(
        "button",
        { type: "button", role: "menuitem", onClick: onSelect, style: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: "6px 10px" } },
        label
      );
    }

    function BatchDeleteMenuItem(props) {
      var sessionId = props.sessionId;
      var useMenuOpenState = props.useMenuOpenState;
      var label = menuText(props, "menu.batch");
      var setMenuOpen = null;
      if (typeof useMenuOpenState === "function") {
        var pair = useMenuOpenState();
        setMenuOpen = pair && pair[1];
      }
      var onSelect = function () {
        if (typeof setMenuOpen === "function") {
          try { setMenuOpen(false); } catch (e) { }
        }
        openBatchDialog(sessionId);
      };
      if (MenuItemButton) {
        return react.createElement(MenuItemButton, {
          icon: IconCheck ? react.createElement(IconCheck, { size: 14 }) : null,
          danger: true,
          onSelect: onSelect,
          children: label
        });
      }
      return react.createElement(
        "button",
        { type: "button", role: "menuitem", onClick: onSelect, style: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: "6px 10px" } },
        label
      );
    }

    function apply(ctx) {
      var slots = null;
      try { slots = ctx.slots || ctx.get("slots"); } catch (e) { slots = null; }
      if (!slots || typeof slots.inject !== "function") {
        console.warn("[dsh-session-remover] 拿不到 slots 服务，插件不启用（不影响官方功能）");
        return;
      }
      host.ctx = ctx;

      // locale 服务软取：取不到则维持中文，不阻塞插件启用。
      // 注册与订阅各自独立降级——订阅失败不应使已注册成功的词典一并失效。
      var localeService = null;
      try { localeService = ctx.get("locale") || ctx.locale || null; } catch (e) { localeService = null; }
      var localeReady = false;
      if (localeService && typeof localeService.register === "function") {
        try {
          ctx.effect(function () { return localeService.register(NS, { zh: DICT.zh, en: DICT.en }); });
          i18n.service = localeService;
          i18n.active = i18nReadActive();
          localeReady = true;
        } catch (e) {
          i18n.service = null;
          warn("locale 词表注册失败，文案退回中文", e);
        }
        if (localeReady && typeof localeService.subscribe === "function") {
          try {
            ctx.effect(function () { return localeService.subscribe(i18nSync); });
          } catch (e) {
            warn("locale 语言变化订阅失败，浮层文案不随语言切换", e);
          }
        }
      }
      // 仅当 locale 服务确实就位时才声明 locale：官方在无 locale face 时渲染该条目会抛出异常，
      // 恒带 locale 将使「软取、取不到即退回中文」的设计变成整条侧栏报错。
      function entryOptions(id, order) {
        return localeReady
          ? { name: SLOT, id: id, order: order, locale: NS }
          : { name: SLOT, id: id, order: order };
      }

      if (canMountOwnRoot) {
        ctx.effect(function () {
          var styleEl = document.createElement("style");
          styleEl.id = STYLE_ID;
          styleEl.textContent = CSS_TEXT;
          document.head.appendChild(styleEl);
          return function () {
            if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
            disposeHost();
          };
        });
      } else {
        warn("拿不到 react-dom/client 平台模块，多选批量删除不注册（单条删除照常可用）");
      }

      try {
        ctx.effect(() => slots.inject(
          SLOT,
          () => slots.register(entryOptions(ENTRY_ID, ENTRY_ORDER), DeleteSessionMenuItem)
        ));
        if (canMountOwnRoot) {
          ctx.effect(() => slots.inject(
            SLOT,
            () => slots.register(entryOptions(BATCH_ENTRY_ID, BATCH_ENTRY_ORDER), BatchDeleteMenuItem)
          ));
        }
      } catch (e) {
        console.warn("[dsh-session-remover] 插槽注册失败（自动退化，不影响官方功能）:", (e && e.message) || e);
      }
    }

    exports.name = "dsh-session-remover";
    exports.inject = ["slots"];
    exports.apply = apply;
    return module.exports;
  }
});
