function m() {
  var t;
  try {
    const o = document.querySelector("title");
    if (o) {
      let n = o.textContent || "";
      if (n.endsWith(" - ChatGPT") && (n = n.substring(0, n.length - 10)), n !== "ChatGPT" && n !== "New chat" && n.trim() !== "")
        return n;
    }
    const e = document.querySelector("h1");
    if (e && ((t = e.textContent) == null ? void 0 : t.trim()) !== "") return e.textContent.trim();
  } catch (o) {
    console.warn("AutoEOD: Failed to parse title", o);
  }
  return "Untitled Conversation";
}
function h() {
  const t = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)$/);
  return t ? t[1] : null;
}
function p() {
  try {
    const t = document.querySelector('button[aria-haspopup="menu"] .truncate, div.text-token-text-secondary.truncate');
    if (t && t.textContent)
      return t.textContent.trim();
  } catch {
  }
}
function f() {
  try {
    const t = document.querySelector('[data-testid="workspace-name"]');
    if (t && t.textContent)
      return t.textContent.trim();
  } catch {
  }
}
function g() {
  try {
    const t = document.querySelectorAll("[data-message-author-role]"), o = [];
    return t.forEach((e) => {
      const n = e.getAttribute("data-message-author-role") || "unknown", a = e.getAttribute("data-message-id") || void 0;
      let r = e.textContent || "";
      r = r.trim();
      const s = r.length > 500 ? r.substring(0, 500) + "..." : r, i = (/* @__PURE__ */ new Date()).toISOString();
      s && n && o.push({ id: a, role: n, excerpt: s, timestamp: i });
    }), o;
  } catch (t) {
    return console.warn("AutoEOD: Failed to extract messages", t), [];
  }
}
let d = null, u = null, c = null;
function y() {
  const t = h();
  if (!t) return;
  const o = m(), e = g(), n = p(), a = f(), r = {
    id: crypto.randomUUID(),
    domain: window.location.hostname,
    url: window.location.href,
    pageTitle: document.title,
    tabOpenedAt: (/* @__PURE__ */ new Date()).toISOString(),
    durationSeconds: 0,
    // Duration handled by background tier 0
    captureTier: 2,
    adapterPayload: {
      externalId: t,
      title: o,
      lastSeenAt: (/* @__PURE__ */ new Date()).toISOString(),
      modelName: n,
      workspace: a,
      messages: e
    }
  }, s = JSON.stringify(r);
  if (d !== s) {
    d = s;
    try {
      chrome.runtime.sendMessage({ type: "ACTIVITY_UPDATE", payload: r }, (i) => {
        chrome.runtime.lastError && console.warn("AutoEOD: Failed to send message to background script.", chrome.runtime.lastError);
      });
    } catch (i) {
      console.warn("AutoEOD: Error sending message", i);
    }
  }
}
function l() {
  u !== null && clearTimeout(u), u = setTimeout(y, 5e3);
}
function w() {
  c && c.disconnect(), c = new MutationObserver((o) => {
    let e = !1;
    for (const n of o)
      if (n.type === "childList" || n.type === "characterData") {
        e = !0;
        break;
      }
    e && l();
  });
  const t = document.querySelector("main") || document.body;
  c.observe(t, {
    childList: !0,
    subtree: !0,
    characterData: !0
  });
}
function S() {
  const t = document.querySelectorAll("input");
  for (const e of Array.from(t)) {
    const n = e.type.toLowerCase(), a = (e.name || "").toLowerCase();
    if (n === "password" || a.includes("card") || a.includes("ccv") || a.includes("credit"))
      return null;
  }
  return (document.body.innerText || "").slice(0, 2e3);
}
async function b() {
  const t = window.location.hostname;
  if (t.includes("chatgpt.com")) {
    w(), setTimeout(() => {
      l();
    }, 2e3);
    let o = location.href;
    new MutationObserver(() => {
      const e = location.href;
      e !== o && (o = e, l());
    }).observe(document, { subtree: !0, childList: !0 });
    return;
  }
  try {
    const o = await new Promise((e) => {
      chrome.runtime.sendMessage({ type: "CHECK_TIER_1", payload: { domain: t } }, e);
    });
    o && o.allowed && setTimeout(() => {
      const e = S();
      if (e) {
        const n = {
          id: crypto.randomUUID(),
          domain: t,
          url: window.location.href,
          pageTitle: document.title,
          tabOpenedAt: (/* @__PURE__ */ new Date()).toISOString(),
          durationSeconds: 0,
          captureTier: 1,
          snapshotText: e
        };
        chrome.runtime.sendMessage({ type: "ACTIVITY_UPDATE", payload: n });
      }
    }, 3e3);
  } catch {
    console.error("AutoEOD: Failed to check tier 1 status");
  }
}
b();
