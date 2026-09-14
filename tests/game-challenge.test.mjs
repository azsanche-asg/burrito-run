import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Exercise the actual game event handlers and simulation with a minimal DOM.
// Canvas pixels and native OS dialogs are checked separately in the browser.
function createGame(search = "", platform = {}) {
  const elements = new Map();
  const listeners = new Map();
  const timers = [];
  const stored = new Map();
  let frame;
  let now = 0;
  const context = new Proxy({}, {
    get: (_, key) => key === "createLinearGradient" || key === "createRadialGradient"
      ? () => ({ addColorStop() {} }) : () => {},
  });
  class Element {
    constructor(id, tag = "div") {
      this.id = id;
      this.tag = tag;
      this.hidden = false;
      this.textContent = "";
      this.value = "";
      this.disabled = false;
      this.handlers = new Map();
      const classes = new Set();
      this.classList = {
        add: (...items) => items.forEach((item) => classes.add(item)),
        remove: (...items) => items.forEach((item) => classes.delete(item)),
        toggle: (item, enabled) => enabled ? classes.add(item) : classes.delete(item),
        contains: (item) => classes.has(item),
      };
    }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    setAttribute() {}
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    closest(selectors) { return selectors.split(",").some((value) => value.trim() === this.tag) ? this : null; }
    getContext() { return context; }
    fire(name, values = {}) { return this.handlers.get(name)?.({ target: this, preventDefault() {}, ...values }); }
  }
  class Button extends Element {}
  const buttons = new Set(["action-button", "pause-button", "resume-button", "sound-button", "motion-button", "record-button", "recording-dismiss", "share-challenge", "copy-challenge", "dismiss-challenge"]);
  const el = (selector) => {
    if (!elements.has(selector)) {
      const id = selector.slice(1);
      elements.set(selector, buttons.has(id) ? new Button(id, "button") : new Element(id, id === "challenge-copy-text" ? "textarea" : "div"));
    }
    return elements.get(selector);
  };
  const document = {
    querySelector: el,
    documentElement: el("html"),
    body: el("body"),
    addEventListener() {},
  };
  const location = new URL(`https://run.burritoslabs.com/${search}`);
  const window = {
    location,
    matchMedia: () => ({ matches: false }),
    history: { replaceState: (_, __, url) => { location.href = url; } },
    requestAnimationFrame: (callback) => { frame = callback; },
    setTimeout: (callback, delay) => timers.push({ callback, at: now + delay }),
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0.35;
  const sandbox = vm.createContext({
    window, document, location, navigator: platform, URL, URLSearchParams,
    HTMLButtonElement: Button, Image: class { addEventListener() {} },
    performance: { now: () => now }, Math: deterministicMath,
    localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
  });
  for (const file of ["challenge.js", "game.js"]) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), sandbox);
  }
  function finishRun() {
    for (let count = 0; count < 20_000; count += 1) {
      now += 35;
      frame(now);
      for (let i = timers.length - 1; i >= 0; i -= 1) {
        if (timers[i].at <= now) timers.splice(i, 1)[0].callback();
      }
      if (el(".game-frame").classList.contains("is-finished")) return;
    }
    assert.fail("The simulated run did not finish");
  }
  return { el, finishRun, stored, location, key: (values) => listeners.get("keydown")({ preventDefault() {}, repeat: false, ...values }) };
}

test("a friend target never becomes a personal record; the next share contains only the completed run", async () => {
  let copied;
  const app = createGame("?challenge=1&score=99999&distance=225&rescues=2", {
    clipboard: { writeText: async (text) => { copied = text; } },
  });
  assert.equal(app.el("#best-score").textContent, "00000");
  assert.equal(app.el("#action-button").textContent, "Take the challenge");
  app.el("#action-button").fire("click");
  app.finishRun();
  assert.equal(app.el("#share-actions").hidden, false);
  assert.equal(app.el("#career-stats").hidden, true);
  assert.match(app.el("#challenge-feedback").textContent, /more points/);
  const runScore = Number(app.el("#result-score").textContent.replaceAll(",", ""));
  assert.ok(runScore > 0 && runScore < 99999);
  await app.el("#copy-challenge").fire("click");
  const link = new URL(copied);
  assert.equal(Number(link.searchParams.get("score")), runScore);
  assert.equal(link.searchParams.get("rescues"), app.el("#result-rescues").textContent);
  assert.equal(JSON.parse(app.stored.get("burrito-run:career:v1")).runs, 1);
  app.el("#game-overlay").fire("pointerdown", { target: app.el("#share-challenge") });
  assert.equal(app.el("#game-overlay").hidden, false);
  app.el("#action-button").fire("click");
  assert.equal(app.el("#share-actions").hidden, true);
  assert.equal(app.el("#challenge-target").hidden, false);
});

test("clipboard fallback can be selected without replaying or intercepting copy shortcuts", async () => {
  const app = createGame();
  app.el("#action-button").fire("click");
  app.finishRun();
  await app.el("#share-challenge").fire("click");
  const field = app.el("#challenge-copy-text");
  assert.equal(app.el("#share-fallback").hidden, false);
  assert.equal(field.selected, true);
  assert.match(field.value, /https:\/\/run.burritoslabs.com\/\?challenge=1/);
  app.el("#game-overlay").fire("pointerdown", { target: field });
  app.key({ code: "Space", target: field });
  app.key({ code: "KeyC", target: field, metaKey: true });
  assert.equal(app.el("#game-overlay").hidden, false);
  assert.equal(app.el("#motion-button").textContent, "Calm off");
});

test("a late share response cannot leak into the next run", async () => {
  let resolveShare;
  const app = createGame("", { share: () => new Promise((resolve) => { resolveShare = resolve; }) });
  app.el("#action-button").fire("click");
  app.finishRun();
  const pending = app.el("#share-challenge").fire("click");
  assert.equal(app.el("#share-challenge").disabled, true);
  app.el("#action-button").fire("click");
  resolveShare();
  await pending;
  assert.equal(app.el("#share-status").textContent, "");
  assert.equal(app.el("#share-actions").hidden, true);
  assert.equal(app.el("#share-challenge").disabled, false);
});

test("dismissing a target preserves unrelated parameters and normal play", () => {
  const app = createGame("?challenge=1&score=515&distance=225&rescues=2&utm_source=friend#top");
  app.el("#dismiss-challenge").fire("click");
  assert.equal(app.el("#challenge-target").hidden, true);
  assert.equal(app.el("#action-button").textContent, "Start running");
  assert.equal(app.location.search, "?utm_source=friend");
  assert.equal(app.location.hash, "#top");
});
