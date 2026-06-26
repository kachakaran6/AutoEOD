const g = (e, t) => t.some((n) => e instanceof n);
let P, M;
function $() {
  return P || (P = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function z() {
  return M || (M = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const B = /* @__PURE__ */ new WeakMap(), b = /* @__PURE__ */ new WeakMap(), m = /* @__PURE__ */ new WeakMap();
function G(e) {
  const t = new Promise((n, r) => {
    const o = () => {
      e.removeEventListener("success", a), e.removeEventListener("error", i);
    }, a = () => {
      n(f(e.result)), o();
    }, i = () => {
      r(e.error), o();
    };
    e.addEventListener("success", a), e.addEventListener("error", i);
  });
  return m.set(t, e), t;
}
function H(e) {
  if (B.has(e))
    return;
  const t = new Promise((n, r) => {
    const o = () => {
      e.removeEventListener("complete", a), e.removeEventListener("error", i), e.removeEventListener("abort", i);
    }, a = () => {
      n(), o();
    }, i = () => {
      r(e.error || new DOMException("AbortError", "AbortError")), o();
    };
    e.addEventListener("complete", a), e.addEventListener("error", i), e.addEventListener("abort", i);
  });
  B.set(e, t);
}
let S = {
  get(e, t, n) {
    if (e instanceof IDBTransaction) {
      if (t === "done")
        return B.get(e);
      if (t === "store")
        return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
    }
    return f(e[t]);
  },
  set(e, t, n) {
    return e[t] = n, !0;
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
  }
};
function _(e) {
  S = e(S);
}
function J(e) {
  return z().includes(e) ? function(...t) {
    return e.apply(O(this), t), f(this.request);
  } : function(...t) {
    return f(e.apply(O(this), t));
  };
}
function Q(e) {
  return typeof e == "function" ? J(e) : (e instanceof IDBTransaction && H(e), g(e, $()) ? new Proxy(e, S) : e);
}
function f(e) {
  if (e instanceof IDBRequest)
    return G(e);
  if (b.has(e))
    return b.get(e);
  const t = Q(e);
  return t !== e && (b.set(e, t), m.set(t, e)), t;
}
const O = (e) => m.get(e);
function X(e, t, { blocked: n, upgrade: r, blocking: o, terminated: a } = {}) {
  const i = indexedDB.open(e, t), d = f(i);
  return r && i.addEventListener("upgradeneeded", (c) => {
    r(f(i.result), c.oldVersion, c.newVersion, f(i.transaction), c);
  }), n && i.addEventListener("blocked", (c) => n(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    c.oldVersion,
    c.newVersion,
    c
  )), d.then((c) => {
    a && c.addEventListener("close", () => a()), o && c.addEventListener("versionchange", (l) => o(l.oldVersion, l.newVersion, l));
  }).catch(() => {
  }), d;
}
const Y = ["get", "getKey", "getAll", "getAllKeys", "count"], Z = ["put", "add", "delete", "clear"], E = /* @__PURE__ */ new Map();
function v(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string"))
    return;
  if (E.get(t))
    return E.get(t);
  const n = t.replace(/FromIndex$/, ""), r = t !== n, o = Z.includes(n);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(o || Y.includes(n))
  )
    return;
  const a = async function(i, ...d) {
    const c = this.transaction(i, o ? "readwrite" : "readonly");
    let l = c.store;
    return r && (l = l.index(d.shift())), (await Promise.all([
      l[n](...d),
      o && c.done
    ]))[0];
  };
  return E.set(t, a), a;
}
_((e) => ({
  ...e,
  get: (t, n, r) => v(t, n) || e.get(t, n, r),
  has: (t, n) => !!v(t, n) || e.has(t, n)
}));
const ee = ["continue", "continuePrimaryKey", "advance"], L = {}, T = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), te = {
  get(e, t) {
    if (!ee.includes(t))
      return e[t];
    let n = L[t];
    return n || (n = L[t] = function(...r) {
      T.set(this, j.get(this)[t](...r));
    }), n;
  }
};
async function* ne(...e) {
  let t = this;
  if (t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)
    return;
  t = t;
  const n = new Proxy(t, te);
  for (j.set(n, t), m.set(n, O(t)); t; )
    yield n, t = await (T.get(n) || t.continue()), T.delete(n);
}
function k(e, t) {
  return t === Symbol.asyncIterator && g(e, [IDBIndex, IDBObjectStore, IDBCursor]) || t === "iterate" && g(e, [IDBIndex, IDBObjectStore]);
}
_((e) => ({
  ...e,
  get(t, n, r) {
    return k(t, n) ? ne : e.get(t, n, r);
  },
  has(t, n) {
    return k(t, n) || e.has(t, n);
  }
}));
let I = null;
async function p() {
  return I || (I = X("AutoEOD-Extension-DB", 2, {
    upgrade(e, t) {
      t < 2 && (e.objectStoreNames.contains("sync_queue") && e.deleteObjectStore("sync_queue"), e.createObjectStore("sync_queue", { keyPath: "payload.id" }));
    }
  })), I;
}
async function R(e) {
  const t = await p(), n = await t.get("sync_queue", e.id);
  await t.put("sync_queue", {
    payload: e,
    addedAt: Date.now(),
    retryCount: n ? n.retryCount : 0,
    nextRetryAt: 0
    // Immediately retryable
  });
}
async function re() {
  const t = await (await p()).getAll("sync_queue"), n = Date.now();
  return t.filter((r) => r.nextRetryAt <= n);
}
async function x(e) {
  await (await p()).delete("sync_queue", e);
}
async function oe(e, t, n) {
  const r = await p(), o = await r.get("sync_queue", e);
  o && await r.put("sync_queue", {
    ...o,
    retryCount: t,
    nextRetryAt: n
  });
}
async function C() {
  return (await chrome.storage.local.get("apiToken")).apiToken || null;
}
function W() {
  return "https://autoeod-production.up.railway.app/api/extension/activity";
}
const ae = 10, ie = 5e3;
async function D() {
  const e = await re();
  if (e.length === 0) return;
  const t = await C();
  if (!t) {
    y("!", "#71717a");
    return;
  }
  let n = !1;
  const r = e.map((o) => o.payload);
  if (r.length > 0)
    if (await se(r, t))
      for (const a of e)
        await x(a.payload.id);
    else {
      n = !0;
      for (const a of e) {
        const i = a.retryCount + 1;
        if (i >= ae)
          await x(a.payload.id);
        else {
          const d = ie * Math.pow(2, i);
          await oe(a.payload.id, i, Date.now() + d);
        }
      }
    }
  n ? (y("!", "#ef4444"), chrome.alarms.create("retrySync", { delayInMinutes: 1 })) : (y("✓", "#22c55e"), await chrome.storage.local.set({ lastSync: (/* @__PURE__ */ new Date()).toISOString() }));
}
async function se(e, t) {
  try {
    let n = W();
    n.endsWith("/activity") ? n = n.replace("/activity", "/browser-activity") : n = `${n}/browser-activity`;
    const r = await fetch(n, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`
      },
      body: JSON.stringify({ activities: e })
    });
    return r.status === 401 ? (await chrome.storage.local.remove("apiToken"), y("!", "#ef4444"), !1) : !!r.ok;
  } catch (n) {
    return console.error("Network error syncing payload:", n), !1;
  }
}
function y(e, t) {
  chrome.action.setBadgeText({ text: e }), chrome.action.setBadgeBackgroundColor({ color: t });
}
let s = null, h = !0, u = null, w = null, q = null;
async function N() {
  const e = await C();
  if (e)
    try {
      let t = W();
      t.endsWith("/activity") ? t = t.replace("/extension/activity", "/extension-settings") : t = `${t}/extension-settings`;
      const n = await fetch(t, {
        headers: { Authorization: `Bearer ${e}` }
      });
      n.ok && (u = await n.json(), u.globalPaused ? (h = !1, y("||", "#71717a")) : (h = !0, y("✓", "#22c55e")));
    } catch (t) {
      console.warn("AutoEOD: fetchExtensionSettings failed", t);
    }
}
function F(e) {
  if (!e || !e.startsWith("http://") && !e.startsWith("https://")) return null;
  try {
    return new URL(e);
  } catch {
    return null;
  }
}
async function A(e = Date.now()) {
  if (!s) return;
  if (!h) {
    s = null;
    return;
  }
  const t = s;
  s = null;
  const n = e - t.openedAt, r = Math.floor(n / 1e3);
  if (!(r < 2))
    try {
      await R({
        id: crypto.randomUUID(),
        domain: t.domain,
        url: t.url,
        pageTitle: t.title,
        tabOpenedAt: new Date(t.openedAt).toISOString(),
        tabClosedAt: new Date(e).toISOString(),
        durationSeconds: r,
        captureTier: 0
      }), D();
    } catch (o) {
      console.error("AutoEOD: failed to enqueue Tier 0 payload", o);
    }
}
async function V(e, t) {
  var n;
  if (w = e, q = t, await A(), !!h)
    try {
      const r = await chrome.tabs.get(e), o = F(r == null ? void 0 : r.url);
      if (!o || (n = u == null ? void 0 : u.excludedDomains) != null && n.includes(o.hostname))
        return;
      s = {
        tabId: e,
        windowId: t,
        url: r.url,
        domain: o.hostname,
        title: r.title || o.hostname,
        openedAt: Date.now()
      };
    } catch (r) {
      console.warn("AutoEOD: handleTabSwitch could not read tab", e, r);
    }
}
chrome.tabs.onActivated.addListener(async (e) => {
  try {
    (await chrome.windows.get(e.windowId)).focused && await V(e.tabId, e.windowId);
  } catch (t) {
    console.warn("AutoEOD: onActivated handler error", t);
  }
});
chrome.windows.onFocusChanged.addListener(async (e) => {
  try {
    if (e === chrome.windows.WINDOW_ID_NONE) {
      w = null, q = null, await A();
      return;
    }
    const t = await chrome.tabs.query({ active: !0, windowId: e });
    t.length > 0 && t[0].id !== void 0 && await V(t[0].id, e);
  } catch (t) {
    console.warn("AutoEOD: onFocusChanged handler error", t);
  }
});
chrome.tabs.onUpdated.addListener(async (e, t, n) => {
  var r;
  try {
    if (e === w)
      if (t.url) {
        await A();
        const o = F(t.url);
        o && !((r = u == null ? void 0 : u.excludedDomains) != null && r.includes(o.hostname)) && (s = {
          tabId: e,
          windowId: n.windowId,
          url: t.url,
          domain: o.hostname,
          title: n.title || o.hostname,
          openedAt: Date.now()
        });
      } else s && s.tabId === e && t.title && (s.title = t.title);
    else
      s && s.tabId === e && t.title && (s.title = t.title);
  } catch (o) {
    console.warn("AutoEOD: onUpdated handler error", o);
  }
});
chrome.tabs.onRemoved.addListener(async (e) => {
  try {
    e === w && (w = null), s && s.tabId === e && await A();
  } catch (t) {
    console.warn("AutoEOD: onRemoved handler error", t);
  }
});
chrome.runtime.onMessage.addListener((e, t, n) => {
  var r, o;
  try {
    if ((e == null ? void 0 : e.type) === "ACTIVITY_UPDATE") {
      const a = e.payload;
      return t.tab && (a.tabId = t.tab.id, a.windowId = t.tab.windowId), R(a).then(() => D()).catch((i) => console.error("AutoEOD: failed to enqueue payload", i)), n({ status: "queued" }), !0;
    }
    if ((e == null ? void 0 : e.type) === "GET_RECORDING_STATE")
      return n({ isRecording: h }), !0;
    if ((e == null ? void 0 : e.type) === "CHECK_TIER_1") {
      const { domain: a } = e.payload ?? {};
      let i = !1;
      return u && a && ((r = u.excludedDomains) != null && r.includes(a) ? i = !1 : (u.tier1GlobalDefault || (o = u.tier1DomainAllowlist) != null && o.includes(a)) && (i = !0)), n({ allowed: i }), !0;
    }
  } catch (a) {
    console.warn("AutoEOD: onMessage handler error", a);
    try {
      n({ status: "error" });
    } catch {
    }
  }
  return !0;
});
chrome.alarms.onAlarm.addListener((e) => {
  try {
    e.name === "retrySync" ? D() : e.name === "fetchSettings" && N();
  } catch (t) {
    console.warn("AutoEOD: onAlarm handler error", t);
  }
});
function K() {
  chrome.alarms.create("retrySync", { periodInMinutes: 1 }), chrome.alarms.create("fetchSettings", { periodInMinutes: 5 });
}
async function U() {
  try {
    await C() ? await N() : y("!", "#71717a"), await D();
  } catch (e) {
    console.warn("AutoEOD: checkTokenAndUpdateBadge failed", e);
  }
}
chrome.runtime.onStartup.addListener(() => {
  K(), U();
});
chrome.runtime.onInstalled.addListener(() => {
  K(), U();
});
