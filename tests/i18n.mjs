// 离线自检（只读，不写不删任何真实文件）：打桩加载浏览器半 lib/client.js，真跑 apply() 与两个菜单组件，
// 验中英词表是否齐全、切语言后文案是否跟着变、服务端错误码是否都能渲染成人话。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const CLIENT = process.env.DSH_SD_CLIENT || path.join(HERE, '..', 'lib', 'client.js');
const src = fs.readFileSync(CLIENT, 'utf8');

let captured = null;
global.window = { __ModuleLoader__: { load: (def) => { captured = def; } } };

const makeEl = () => ({
  id: '', textContent: '', parentNode: null, style: {},
  setAttribute() {}, appendChild() {}, removeChild() {},
  querySelector: () => null,
});
global.document = {
  createElement: makeEl,
  head: { appendChild() {} },
  body: { appendChild() {} },
  addEventListener() {}, removeEventListener() {},
};

const reactStub = {
  createElement: (type, props, ...kids) => ({ type, props: props || {}, kids }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  useMemo: (fn) => fn(),
};
const fakeRequire = (name) => {
  if (name === 'react') return reactStub;
  if (name === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) };
  throw new Error('stub 未提供：' + name);
};

// 用 Function 包一层，让 window 指向我们的桩；顺带把内部函数挂到导出上供测试调用
const patched = src.replace(
  'return module.exports;',
  'exports.__renderFailure = renderFailure; exports.__t = t; return module.exports;'
);
new Function('window', patched)(global.window);
if (!captured) { console.log('FAIL 没抓到模块定义'); process.exit(1); }
const mod = captured.factory(fakeRequire);

const localeDicts = {};
const registeredSlots = {};
const registeredOptions = {};
let subscribeFn = null;
let active = 'zh';

const ctx = {
  get(name) {
    if (name === 'locale') {
      return {
        register: (ns, dicts) => { localeDicts[ns] = dicts; return () => {}; },
        subscribe: (fn) => { subscribeFn = fn; return () => {}; },
        getLocale: () => ({ active }),
      };
    }
    if (name === 'slots') return slotsStub;
    return null;
  },
  slots: null,
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
};
const slotsStub = {
  inject: (name, cb) => { cb(); return () => {}; },
  register: (options, Component) => {
    registeredSlots[options.id] = Component;
    registeredOptions[options.id] = options;
    return () => {};
  },
};
ctx.slots = slotsStub;

mod.apply(ctx);
// 首次 apply 的注册选项单独留一份：后面几处 apply() 会复用同一个 slotsStub 并覆盖 registeredOptions。
const firstOptions = { ...registeredOptions };

let fails = 0;
const check = (ok, label, extra) => {
  if (!ok) { fails++; console.log('FAIL ' + label + (extra ? '  ' + extra : '')); }
  else console.log('ok   ' + label + (extra ? '  ' + extra : ''));
};

// 1 词表注册到了官方 locale 服务
check(Object.keys(localeDicts).length === 1, '词表已注册', Object.keys(localeDicts).join(','));
const dicts = localeDicts['dsh-session-remover'];
check(!!dicts && !!dicts.zh && !!dicts.en, '中英两份词表都在');

// 2 两份词表键集完全一致
const zhKeys = Object.keys(dicts.zh).sort();
const enKeys = Object.keys(dicts.en).sort();
const missingEn = zhKeys.filter((k) => !(k in dicts.en));
const missingZh = enKeys.filter((k) => !(k in dicts.zh));
check(missingEn.length === 0, '中文有、英文缺的键 = 0', missingEn.join(','));
check(missingZh.length === 0, '英文有、中文缺的键 = 0', missingZh.join(','));

// 3 同键的占位符名字一致（漏一个就会显示成 {count}）
const ph = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
let phBad = [];
for (const k of zhKeys) {
  if (dicts.en[k] === undefined) continue;
  if (ph(dicts.zh[k]) !== ph(dicts.en[k])) phBad.push(k + ' zh=' + ph(dicts.zh[k]) + ' en=' + ph(dicts.en[k]));
}
check(phBad.length === 0, '占位符中英一致', phBad.join(' | '));

// 4 英文里不该再有汉字
const han = /[\u4e00-\u9fff]/;
const enWithHan = enKeys.filter((k) => han.test(dicts.en[k]));
check(enWithHan.length === 0, '英文词表无汉字残留', enWithHan.join(','));

// 5 两个菜单项都注册上了
check(!!registeredSlots['dsh-session-remover/delete'], '单条删除菜单项已注册');
check(!!registeredSlots['dsh-session-remover/batch-delete'], '批量删除菜单项已注册');

// 6 真调组件：中文界面
const labelOf = (C) => {
  const out = C({ sessionId: 's-1', displayTitle: 'T' });
  return out && out.kids ? out.kids[0] : undefined;
};
const delZh = labelOf(registeredSlots['dsh-session-remover/delete']);
const batZh = labelOf(registeredSlots['dsh-session-remover/batch-delete']);
check(delZh === '删除对话', '中文界面：单条菜单文案', String(delZh));
check(batZh === '批量删除…', '中文界面：批量菜单文案', String(batZh));

// 7 切到英文，走官方 locale 的 subscribe 通知
active = 'en';
if (subscribeFn) subscribeFn();
const delEn = labelOf(registeredSlots['dsh-session-remover/delete']);
const batEn = labelOf(registeredSlots['dsh-session-remover/batch-delete']);
check(delEn === 'Delete conversation', '英文界面：单条菜单文案', String(delEn));
check(batEn === 'Batch delete…', '英文界面：批量菜单文案', String(batEn));

// 8 切回中文
active = 'zh';
if (subscribeFn) subscribeFn();
check(labelOf(registeredSlots['dsh-session-remover/delete']) === '删除对话', '切回中文后文案复原');

// 9 语言服务缺失时不报错（软取）
const ctxNoLocale = {
  get(name) { return name === 'slots' ? slotsStub : null; },
  slots: slotsStub,
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
};
let threw = null;
try { mod.apply(ctxNoLocale); } catch (e) { threw = e; }
check(threw === null, '拿不到 locale 服务时不抛错', threw ? threw.message : '');

// 10 错误码渲染：宿主半给「码 + 参数」，浏览器半按界面语言取词
const errKeys = zhKeys.filter((k) => k.startsWith('err.'));
const loKeys = zhKeys.filter((k) => k.startsWith('leftover.'));
check(errKeys.length >= 25, '错误码词条数 ≥ 25', String(errKeys.length));
check(loKeys.length >= 5, '残留项词条数 ≥ 5', String(loKeys.length));
const enErrWithHan = errKeys.concat(loKeys).filter((k) => han.test(dicts.en[k]));
check(enErrWithHan.length === 0, '错误码英文词条无汉字', enErrWithHan.join(','));

// 11 真跑服务端返回的失败结构，看是否渲染成人话（含嵌套 reason 递归）
const inner = { ok: false, code: 'E_SESSION_ROOT_UNREADABLE', params: { reason: 'ENOENT' } };
const outer = { ok: false, code: 'E_INDEX_UNREADABLE', params: { reason: inner } };
check(typeof mod.__renderFailure === 'function', '模块暴露了 renderFailure 供测试');
active = 'zh'; if (subscribeFn) subscribeFn();
const zhOuter = mod.__renderFailure(outer);
check(zhOuter.includes('无法读取会话根目录') && zhOuter.includes('ENOENT'), '中文：嵌套原因已递归展开', zhOuter);
active = 'en'; if (subscribeFn) subscribeFn();
const enOuter = mod.__renderFailure(outer);
check(enOuter.includes('Cannot read the sessions root directory') && enOuter.includes('ENOENT'), '英文：同一结构渲染为英文', enOuter);
check(han.test(enOuter) === false, '英文错误文本无汉字残留', enOuter);

active = 'zh'; if (subscribeFn) subscribeFn();
const lo = mod.__renderFailure({ code: 'L_SESSION_LEFTOVER', params: { id: 'session-1', what: '会话目录' } });
check(lo.includes('session-1') && lo.includes('会话目录'), '残留项渲染含会话号与部位', lo);
active = 'en'; if (subscribeFn) subscribeFn();
const loEn = mod.__renderFailure({ code: 'L_SESSION_LEFTOVER', params: { id: 'session-1', what: 'L_SESSION_DIR' } });
check(loEn.includes('session-1') && han.test(loEn) === false, '残留项英文渲染无汉字', loEn);

// 12 未知码不炸、退回码本身
const unk = mod.__renderFailure({ code: 'E_NOT_A_REAL_CODE' });
check(unk === 'E_NOT_A_REAL_CODE', '未知码退回码本身', unk);
check(mod.__renderFailure(null) === '', 'null 安全');
check(mod.__renderFailure('plain') === 'plain', '纯字符串原样透传');

// 13 端到端：宿主半的 28 个失败码逐个过一遍浏览器半的词表
active = 'zh'; if (subscribeFn) subscribeFn();
const allCodes = ['E_SESSION_ROOT_UNREADABLE', 'E_WORKSPACE_DIR_UNREADABLE', 'E_REGISTRY_UNAVAILABLE',
  'E_SESSION_IDS_NOT_ARRAY', 'E_ARCHIVED_NOT_ARRAY', 'E_REGISTRY_READ_FAILED', 'E_PROTECTED_LIST_UNREADABLE',
  'E_INDEX_UNREADABLE', 'E_CSCRIPT_MISSING', 'E_DIR_OUTSIDE_ROOT', 'E_RECYCLE_SPAWN_FAILED',
  'E_RECYCLE_NO_RESULT', 'E_RECYCLE_DISABLED', 'E_RECYCLE_UNRECOGNIZED', 'E_RECYCLE_LEFT',
  'E_RECYCLE_LEFT_REASON',
  'E_RECYCLE_MISMATCH', 'E_WS_DETACH_FAILED', 'E_DETACH_FAILED', 'E_ABORTED_NO_CHANGE', 'E_NOT_FOUND',
  'E_MOVE_ABORTED', 'E_LOOPBACK_ONLY', 'E_POST_ONLY', 'E_BODY_TOO_LARGE', 'E_BODY_READ_FAILED',
  'E_SESSION_ID_REQUIRED', 'E_SESSION_ID_INVALID', 'E_INTERNAL'];
const bare = allCodes.filter((c) => mod.__renderFailure({ code: c }) === c);
check(bare.length === 0, allCodes.length + ' 个失败码在中文下都有词条', bare.join(','));

// 14 官方 t 查不到词条时会把 key 原样返回，菜单项必须当作没取到并退回模块内词表
{
  const Comp = registeredSlots['dsh-session-remover/delete'];
  const labelWith = (tFn) => {
    const out = Comp({ sessionId: 's-1', displayTitle: 'T', t: tFn });
    return out && out.kids ? out.kids[0] : undefined;
  };
  const echoing = (k) => k; // 模拟官方未命中：返回 key
  const zh = labelWith(echoing);
  check(zh === '删除对话', '官方 t 回退成 key 时，菜单不露裸码', String(zh));
  const real = labelWith((k) => (k === 'menu.delete' ? 'Custom Label' : k));
  check(real === 'Custom Label', '官方 t 正常返回时以官方为准', String(real));
  const throwing = () => { throw new Error('boom'); };
  check(labelWith(throwing) === '删除对话', '官方 t 抛错时退回模块内词表');
}

// 15 locale 服务在场时才声明 locale 字段（否则官方渲染该条目会抛错，侧栏整条报错）
{
  const del = firstOptions['dsh-session-remover/delete'];
  const bat = firstOptions['dsh-session-remover/batch-delete'];
  check(del && del.locale === 'dsh-session-remover', 'locale 在场：条目带 locale 命名空间', JSON.stringify(del));
  check(bat && bat.locale === 'dsh-session-remover', 'locale 在场：批量条目同样带 locale');
}

// 16 locale 服务缺失时不带 locale 字段，且不影响菜单可用
{
  const slots2 = { inject: (n, cb) => { cb(); return () => {}; }, register: (o, C) => { registeredOptions['n-' + o.id] = o; return () => {}; } };
  const ctx2 = {
    get(name) { return name === 'slots' ? slots2 : null; },
    slots: slots2,
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
  };
  let threw = null;
  try { mod.apply(ctx2); } catch (e) { threw = e; }
  check(threw === null, 'locale 缺失时 apply 不抛错', threw ? threw.message : '');
  const o = registeredOptions['n-dsh-session-remover/delete'];
  check(o && o.locale === undefined, 'locale 缺失：条目不声明 locale（避免官方渲染报错）', JSON.stringify(o));
}

// 17 订阅失败不废掉已注册成功的词表（两处独立降级）
{
  const slots3 = { inject: (n, cb) => { cb(); return () => {}; }, register: (o, C) => { registeredOptions['s-' + o.id] = o; return () => {}; } };
  const ctx3 = {
    get(name) {
      if (name === 'slots') return slots3;
      if (name === 'locale') {
        return {
          register: () => () => {},
          subscribe: () => { throw new Error('subscribe boom'); },
          getLocale: () => ({ active: 'en' }),
        };
      }
      return null;
    },
    slots: slots3,
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
  };
  let threw3 = null;
  try { mod.apply(ctx3); } catch (e) { threw3 = e; }
  check(threw3 === null, '订阅抛错时 apply 不抛错', threw3 ? threw3.message : '');
  const o3 = registeredOptions['s-dsh-session-remover/delete'];
  check(o3 && o3.locale === 'dsh-session-remover', '订阅失败不影响词表就位，条目仍带 locale', JSON.stringify(o3));
}

console.log('\n结果：' + (fails === 0 ? '全部通过' : fails + ' 项失败'));
process.exit(fails === 0 ? 0 : 1);
