import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../challenge.js", import.meta.url), "utf8");
const challenge = vm.runInNewContext(`${source}\nBurritoRunChallenge;`, { URL, URLSearchParams });
const result = { score: 515, distance: 225, rescues: 2 };
const data = challenge.createShareData(result);

test("sharing a completed run produces a public link that round-trips all three values", () => {
  const url = new URL(data.url);
  assert.equal(url.origin, "https://run.burritoslabs.com");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("challenge"), "1");
  assert.equal(JSON.stringify(challenge.parse(url.search)), JSON.stringify(result));
  assert.match(data.text, /515 points/);
  assert.match(data.text, /225 m/);
  assert.match(data.text, /2 paisanos/);
  assert.equal(url.searchParams.has("embed"), false);
  assert.equal(url.searchParams.has("utm_source"), false);
});

test("normal visits and malformed, duplicate or unsupported challenge values are ignored", () => {
  const invalid = [
    "", "?embed=1", "?score=515&distance=225&rescues=2",
    "?challenge=2&score=515&distance=225&rescues=2",
    "?challenge=1&challenge=1&score=515&distance=225&rescues=2",
    "?challenge=1&score=515&score=516&distance=225&rescues=2",
    "?challenge=1&score=515&distance=225",
    "?challenge=1&score=200&distance=225&rescues=2",
    ...["-1", "1.5", "NaN", "Infinity", "1e3", "9999999999", "", "01", "%20", "%3Cscript%3E"].flatMap((value) =>
      ["score", "distance", "rescues"].map((field) => {
        const params = new URLSearchParams("challenge=1&score=515&distance=225&rescues=2");
        params.set(field, value);
        return params.toString();
      }),
    ),
  ];
  for (const search of invalid) assert.equal(challenge.parse(search), null, search);
});

test("zero results and valid links with unrelated parameters still work", () => {
  assert.equal(challenge.parse("?challenge=1&score=0&distance=0&rescues=0").score, 0);
  assert.equal(challenge.parse(`${new URL(data.url).search}&utm_source=test&embed=1`).score, 515);
  assert.match(challenge.createShareData({ score: 61, distance: 1, rescues: 1 }).text, /1 paisano rescued/);
  assert.equal(challenge.createShareData({ score: Infinity, distance: 1, rescues: 1 }), null);
});

test("a tie does not count as a win and a losing result reports points needed to win", () => {
  assert.equal(challenge.compare(516, result), "You beat your friend by 1 point!");
  assert.equal(challenge.compare(517, result), "You beat your friend by 2 points!");
  assert.match(challenge.compare(515, result), /^A tie!/);
  assert.match(challenge.compare(514, result), /^2 more points/);
});

test("supported native sharing receives the result and does not touch the clipboard", async () => {
  let received;
  const outcome = await challenge.share(data, {
    canShare: () => true,
    share: async (payload) => { received = payload; },
    clipboard: { writeText: () => { throw new Error("Unexpected clipboard write"); } },
  });
  assert.equal(outcome, "shared");
  assert.equal(received, data);
});

test("native sharing also works without canShare", async () => {
  let called = false;
  assert.equal(await challenge.share(data, { share: async () => { called = true; } }), "shared");
  assert.equal(called, true);
});

test("cancelling native sharing leaves the clipboard alone", async () => {
  let copied = false;
  const outcome = await challenge.share(data, {
    share: async () => { throw { name: "AbortError" }; },
    clipboard: { writeText: async () => { copied = true; } },
  });
  assert.equal(outcome, "cancelled");
  assert.equal(copied, false);
});

test("missing, declined or blocked native sharing falls back to the full challenge text", async () => {
  for (const platform of [
    {},
    { canShare: () => false, share: () => { throw new Error("Should not share"); } },
    { share: async () => { throw { name: "NotAllowedError" }; } },
  ]) {
    let copied;
    platform.clipboard = { writeText: async (text) => { copied = text; } };
    assert.equal(await challenge.share(data, platform), "copied");
    assert.equal(copied, `${data.text}\n${data.url}`);
  }
});

test("unavailable or denied clipboard access requests the manual fallback", async () => {
  assert.equal(await challenge.copy(data.url, {}), "manual");
  assert.equal(await challenge.copy(data.url, { clipboard: { writeText: async () => { throw new Error("Denied"); } } }), "manual");
  assert.equal(await challenge.share(data, {}), "manual");
});

test("copy link writes only the playable URL", async () => {
  let copied;
  assert.equal(await challenge.copy(data.url, { clipboard: { writeText: async (text) => { copied = text; } } }), "copied");
  assert.equal(copied, data.url);
});
