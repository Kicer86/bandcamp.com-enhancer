const assert = require("node:assert/strict");
const test = require("node:test");

const {
  hasNativeOwnership,
  keyFromGridItemId,
  ownedKeysFromSummary,
} = require("../bandcamp-improver.user.js");

test("extracts Bandcamp keys from discography item identifiers", () => {
  assert.equal(keyFromGridItemId("album-1631511408"), "a1631511408");
  assert.equal(keyFromGridItemId("track-510564906"), "t510564906");
  assert.equal(keyFromGridItemId("merch-123"), null);
  assert.equal(keyFromGridItemId(null), null);
});

test("keeps purchases and excludes wishlist-only entries", () => {
  const payload = {
    collection_summary: {
      tralbum_lookup: {
        a1: { purchased: "2026-08-12" },
        a2: { purchased: null },
        t3: { purchased: true },
      },
    },
  };

  assert.deepEqual(ownedKeysFromSummary(payload), ["a1", "t3"]);
});

test("handles an empty or malformed collection summary", () => {
  assert.deepEqual(ownedKeysFromSummary(null), []);
  assert.deepEqual(ownedKeysFromSummary({}), []);
});

test("recognizes Bandcamp's native visible ownership message", () => {
  const ownedPage = {
    querySelector(selector) {
      return selector === "#collect-item.purchased #purchased-msg" ? {} : null;
    },
  };
  const unownedPage = { querySelector: () => null };

  assert.equal(hasNativeOwnership(ownedPage), true);
  assert.equal(hasNativeOwnership(unownedPage), false);
  assert.equal(hasNativeOwnership(null), false);
});
