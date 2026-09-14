/* Shared by the game and the dependency-free challenge tests. */
const BurritoRunChallenge = (() => {
  "use strict";

  const VERSION = "1";
  const FIELDS = ["score", "distance", "rescues"];
  const formatNumber = (value) => value.toLocaleString("en-US");

  function isValidResult(result) {
    return result && FIELDS.every((field) =>
      Number.isSafeInteger(result[field]) && result[field] >= 0 && result[field] <= 999_999_999,
    ) && result.score >= result.distance;
  }

  function parse(search) {
    const params = new URLSearchParams(search);
    if (params.getAll("challenge").length !== 1 || params.get("challenge") !== VERSION) return null;
    const result = {};
    for (const field of FIELDS) {
      const values = params.getAll(field);
      if (values.length !== 1 || !/^(0|[1-9]\d{0,8})$/.test(values[0])) return null;
      result[field] = Number(values[0]);
    }
    return isValidResult(result) ? Object.freeze(result) : null;
  }

  function createShareData(result) {
    if (!isValidResult(result)) return null;
    // Always send friends to the public game, including when sharing from an embed.
    const url = new URL("https://run.burritoslabs.com/");
    url.searchParams.set("challenge", VERSION);
    for (const field of FIELDS) url.searchParams.set(field, String(result[field]));
    const paisanos = result.rescues === 1 ? "paisano" : "paisanos";
    return Object.freeze({
      title: "Burrito Run — challenge a friend",
      text: `I scored ${formatNumber(result.score)} points in Burrito Run! ${formatNumber(result.distance)} m traveled and ${formatNumber(result.rescues)} ${paisanos} rescued. Can you beat my score? Play free:`,
      url: url.href,
    });
  }

  function compare(score, target) {
    const difference = score - target.score;
    if (difference > 0) return `You beat your friend by ${formatNumber(difference)} ${difference === 1 ? "point" : "points"}!`;
    if (difference === 0) return "A tie! One more point will beat your friend.";
    const needed = target.score - score + 1;
    return `${formatNumber(needed)} more points to beat your friend. Try again!`;
  }

  async function copy(text, platform) {
    try {
      if (typeof platform.clipboard?.writeText !== "function") return "manual";
      await platform.clipboard.writeText(text);
      return "copied";
    } catch {
      return "manual";
    }
  }

  async function share(data, platform) {
    try {
      if (typeof platform.share === "function" &&
          (typeof platform.canShare !== "function" || platform.canShare(data))) {
        await platform.share(data);
        return "shared";
      }
    } catch (error) {
      // Cancelling the native sheet must not overwrite the player's clipboard.
      if (error?.name === "AbortError") return "cancelled";
    }
    return copy(`${data.text}\n${data.url}`, platform);
  }

  return Object.freeze({ parse, createShareData, compare, copy, share, formatNumber });
})();
