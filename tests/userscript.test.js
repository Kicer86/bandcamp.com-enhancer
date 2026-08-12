const assert = require("node:assert/strict");
const test = require("node:test");

const {
  keyFromGridItemId,
  keyFromPageProperties,
  ownedKeysFromSummary,
} = require("../bandcamp-improver.user.js");

test("extracts Bandcamp keys from discography item identifiers", () => {
  assert.equal(keyFromGridItemId("album-1631511408"), "a1631511408");
  assert.equal(keyFromGridItemId("track-510564906"), "t510564906");
  assert.equal(keyFromGridItemId("merch-123"), null);
  assert.equal(keyFromGridItemId(null), null);
});

test("extracts the current release key from Bandcamp page properties", () => {
  assert.equal(
    keyFromPageProperties({ item_type: "a", item_id: 1631511408 }),
    "a1631511408",
  );
  assert.equal(keyFromPageProperties({ item_type: "p", item_id: 123 }), null);
  assert.equal(keyFromPageProperties(null), null);
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
