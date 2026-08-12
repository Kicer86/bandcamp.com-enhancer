const assert = require("node:assert/strict");
const test = require("node:test");

const {
  groupReleasesByArtist,
  hasNativeOwnership,
  keyFromGridItemId,
  mergeReleases,
  normalizeArtistName,
  ownedKeysFromSummary,
  releaseTypeLabel,
} = require("../bandcamp-com-enhancer.user.js");

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

test("normalizes artist spelling without case, spacing, punctuation, or accents", () => {
  assert.equal(normalizeArtistName("WolfClub"), "wolfclub");
  assert.equal(normalizeArtistName("W O L F C L U B"), "wolfclub");
  assert.equal(normalizeArtistName("W.O.L.F-C.L.U.B!"), "wolfclub");
  assert.equal(normalizeArtistName("MØNTRÉAL Łódź"), "montreallodz");
});

test("groups releases by normalized artist while preserving variants", () => {
  const releases = [
    { id: 1, artist: "W O L F C L U B", title: "One" },
    { id: 2, artist: "WolfClub", title: "Two" },
    { id: 3, artist: "Other Artist", title: "Three" },
    { id: 4, title: "Compilation" },
  ];

  const groups = groupReleasesByArtist(releases);
  const wolfClub = groups.find((group) => group.key === "wolfclub");
  const various = groups.find((group) => group.key === "variousartists");

  assert.equal(wolfClub.name, "W O L F C L U B");
  assert.deepEqual(wolfClub.variants, ["W O L F C L U B", "WolfClub"]);
  assert.deepEqual(wolfClub.items.map((item) => item.id), [1, 2]);
  assert.equal(various.items[0].id, 4);
});

test("merges rendered and deferred catalog items without duplicates", () => {
  const rendered = [
    { type: "album", id: 1, title: "Newest" },
    { type: "track", id: 2, title: "Single" },
  ];
  const deferred = [
    { type: "album", id: 1, title: "Duplicate" },
    { type: "album", id: 3, title: "Older" },
  ];

  assert.deepEqual(
    mergeReleases(rendered, deferred).map((item) => item.title),
    ["Newest", "Single", "Older"],
  );
});

test("labels Bandcamp release types in English", () => {
  assert.equal(releaseTypeLabel("album"), "album");
  assert.equal(releaseTypeLabel("track"), "single");
  assert.equal(releaseTypeLabel("merch"), null);
  assert.equal(releaseTypeLabel(null), null);
});
