// ==UserScript==
// @name         Bandcamp.com Enhancer
// @namespace    https://github.com/Kicer86/bandcamp.com-enhancer
// @version      0.6.0
// @description  Marks owned releases and groups discographies by artist.
// @author       local
// @match        https://bandcamp.com/*
// @match        https://*.bandcamp.com/*
// @connect      bandcamp.com
// @grant        GM.deleteValue
// @grant        GM.getValue
// @grant        GM.registerMenuCommand
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const CACHE_KEY = "bandcamp-com-enhancer-owned-v1";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const SUMMARY_URL = "https://bandcamp.com/api/fan/2/collection_summary";
  const ARTISTS_HASH = "#bc-artists";
  const ARTIST_HASH_PREFIX = "#bc-artist=";

  function keyFromGridItemId(itemId) {
    if (typeof itemId !== "string") {
      return null;
    }

    const match = /^(album|track)-(\d+)$/.exec(itemId);
    if (match) {
      return `${match[1] === "album" ? "a" : "t"}${match[2]}`;
    }

    return null;
  }

  function ownedKeysFromSummary(payload) {
    const lookup = payload?.collection_summary?.tralbum_lookup;
    if (!lookup || typeof lookup !== "object") {
      return [];
    }

    return Object.entries(lookup)
      .filter(([, item]) => Boolean(item?.purchased))
      .map(([key]) => key);
  }

  function normalizeArtistName(name) {
    if (typeof name !== "string") {
      return "";
    }

    return name
      .normalize("NFKD")
      .replace(/[łŁ]/g, "l")
      .replace(/[øØ]/g, "o")
      .replace(/[đĐðÐ]/g, "d")
      .replace(/[þÞ]/g, "th")
      .replace(/[æÆ]/g, "ae")
      .replace(/[œŒ]/g, "oe")
      .replace(/ß/g, "ss")
      .replace(/\p{Mark}/gu, "")
      .toLocaleLowerCase("en")
      .replace(/[^\p{Letter}\p{Number}]/gu, "");
  }

  function groupReleasesByArtist(items, fallbackArtist = "Various Artists") {
    const groupsByKey = new Map();

    for (const item of Array.isArray(items) ? items : []) {
      const artist =
        typeof item?.artist === "string" && item.artist.trim()
          ? item.artist.trim()
          : fallbackArtist;
      const key = normalizeArtistName(artist);
      if (!key) {
        continue;
      }

      let group = groupsByKey.get(key);
      if (!group) {
        group = { key, name: artist, variants: [], items: [] };
        groupsByKey.set(key, group);
      }

      if (!group.variants.includes(artist)) {
        group.variants.push(artist);
      }
      group.items.push(item);
    }

    return [...groupsByKey.values()].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
  }

  function mergeReleases(...releaseLists) {
    const merged = [];
    const seen = new Set();

    for (const item of releaseLists.flat()) {
      if (!item || !item.type || !Number.isInteger(item.id)) {
        continue;
      }

      const key = `${item.type}-${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    return merged;
  }

  function releaseTypeLabel(type) {
    if (type === "album") {
      return "album";
    } else if (type === "track") {
      return "single";
    }

    return null;
  }

  function hasNativeOwnership(pageDocument) {
    return Boolean(
      pageDocument?.querySelector?.("#collect-item.purchased #purchased-msg"),
    );
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      groupReleasesByArtist,
      hasNativeOwnership,
      keyFromGridItemId,
      mergeReleases,
      normalizeArtistName,
      ownedKeysFromSummary,
      releaseTypeLabel,
    };
    return;
  }

  function currentFanId() {
    const footer = document.querySelector("page-footer[page-context]");
    if (!footer) {
      return null;
    }

    try {
      return JSON.parse(footer.getAttribute("page-context")).identity?.fanId ?? null;
    } catch (error) {
      console.warn("Bandcamp.com Enhancer: invalid user data", error);
      return null;
    }
  }

  function requestJson(url) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: "GET",
        url,
        anonymous: false,
        timeout: 15000,
        headers: { Accept: "application/json" },
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`Bandcamp returned status ${response.status}`));
            return;
          }

          try {
            resolve(JSON.parse(response.responseText));
          } catch (error) {
            reject(new Error("Bandcamp returned invalid JSON", { cause: error }));
          }
        },
        onerror() {
          reject(new Error("Could not connect to Bandcamp"));
        },
        ontimeout() {
          reject(new Error("The connection to Bandcamp timed out"));
        },
      });
    });
  }

  async function loadOwnedKeys() {
    const fanId = currentFanId();
    const cached = await GM.getValue(CACHE_KEY, null);
    const cacheIsCurrent =
      cached &&
      Array.isArray(cached.keys) &&
      Date.now() - cached.savedAt < CACHE_TTL_MS &&
      (!fanId || !cached.fanId || fanId === cached.fanId);

    if (cacheIsCurrent) {
      return new Set(cached.keys);
    }

    const payload = await requestJson(SUMMARY_URL);
    if (!payload?.collection_summary?.tralbum_lookup) {
      throw new Error("The response did not include a collection; you may be logged out");
    }

    const keys = ownedKeysFromSummary(payload);
    await GM.setValue(CACHE_KEY, {
      fanId: payload.fan_id ?? fanId,
      keys,
      savedAt: Date.now(),
    });
    return new Set(keys);
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .bc-improver-owned-anchor {
        position: relative !important;
      }

      .bc-improver-owned-badge {
        align-items: center;
        background: #087e8b;
        border: 2px solid rgba(255, 255, 255, 0.92);
        border-radius: 999px;
        box-shadow: 0 2px 7px rgba(0, 0, 0, 0.3);
        color: #fff;
        display: inline-flex;
        font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        gap: 4px;
        letter-spacing: 0;
        padding: 4px 7px;
        pointer-events: none;
        text-transform: none;
      }

      .bc-improver-owned-badge--cover {
        position: absolute;
        right: 7px;
        top: 7px;
        z-index: 20;
      }

      .bc-improver-owned-badge .collect-item-icon {
        background-position: -42px -73px;
        display: inline-block;
        flex: 0 0 auto;
        height: 13px;
        position: relative;
        top: 1px;
        width: 14px;
      }

      .bc-improver-artists-view[hidden],
      #music-grid[hidden] {
        display: none !important;
      }

      .bc-improver-artists-toolbar {
        align-items: center;
        display: flex;
        gap: 16px;
        justify-content: space-between;
        margin: 0 0 24px;
      }

      .bc-improver-artists-toolbar h2 {
        font-size: 20px;
        margin: 0;
      }

      .bc-improver-artist-filter {
        background: #fff;
        border: 1px solid #aaa;
        border-radius: 3px;
        box-sizing: border-box;
        color: #222;
        font: 14px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        max-width: 280px;
        padding: 8px 10px;
        width: 45%;
      }

      .bc-improver-artists-grid {
        display: grid;
        gap: 26px 18px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .bc-improver-artist-card[hidden] {
        display: none;
      }

      .bc-improver-artist-card a {
        display: block;
        text-decoration: none;
      }

      .bc-improver-artist-art {
        aspect-ratio: 1;
        background: rgba(127, 127, 127, 0.15);
        margin-bottom: 8px;
        overflow: hidden;
        width: 100%;
      }

      .bc-improver-artist-art img {
        display: block;
        height: 100%;
        object-fit: cover;
        width: 100%;
      }

      .bc-improver-artist-name {
        font-size: 14px;
        font-weight: bold;
        overflow-wrap: anywhere;
      }

      .bc-improver-artist-count,
      .bc-improver-artist-variants {
        font-size: 12px;
        margin-top: 3px;
      }

      .bc-improver-artist-detail-header {
        margin-bottom: 24px;
      }

      .bc-improver-artist-detail-header h2 {
        font-size: 22px;
        margin: 10px 0 0;
      }

      .bc-improver-back-link {
        font-size: 13px;
      }

      .bc-improver-release-grid {
        display: grid;
        gap: 28px 18px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .bc-improver-release-card {
        min-width: 0;
      }

      .bc-improver-release-card > a {
        display: block;
        text-decoration: none;
      }

      .bc-improver-release-card .art {
        aspect-ratio: 1;
        background: rgba(127, 127, 127, 0.15);
        margin-bottom: 7px;
        overflow: hidden;
      }

      .bc-improver-release-card .art img {
        display: block;
        height: 100%;
        object-fit: cover;
        width: 100%;
      }

      .bc-improver-release-card .title {
        font-size: 12px;
        line-height: 1.25;
        margin: 0;
        overflow-wrap: anywhere;
      }

      .bc-improver-release-type {
        display: block;
        font-size: 10px;
        font-weight: normal;
        letter-spacing: 0.08em;
        margin-top: 5px;
        opacity: 0.75;
        text-transform: uppercase;
      }

      @media (max-width: 700px) {
        .bc-improver-artists-grid,
        .bc-improver-release-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .bc-improver-artists-toolbar {
          align-items: stretch;
          flex-direction: column;
        }

        .bc-improver-artist-filter {
          max-width: none;
          width: 100%;
        }
      }

      .bc-improver-notice {
        background: #222;
        border-radius: 4px;
        bottom: 18px;
        box-shadow: 0 3px 14px rgba(0, 0, 0, 0.35);
        color: #fff;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        max-width: 330px;
        padding: 11px 36px 11px 13px;
        position: fixed;
        right: 18px;
        z-index: 2147483647;
      }

      .bc-improver-notice button {
        background: transparent;
        border: 0;
        color: #fff;
        cursor: pointer;
        font: 20px/1 sans-serif;
        padding: 7px;
        position: absolute;
        right: 2px;
        top: 1px;
      }
    `;
    document.head.append(style);
  }

  function createBadge(label, variant) {
    const badge = document.createElement("span");
    badge.className = `bc-improver-owned-badge bc-improver-owned-badge--${variant}`;
    badge.setAttribute("aria-label", "This release is in your collection");

    const icon = document.createElement("span");
    icon.className = "bc-ui2 collect-item-icon";
    icon.setAttribute("aria-hidden", "true");
    badge.append(icon, document.createTextNode(label));
    return badge;
  }

  function releaseCountLabel(count) {
    return count === 1 ? "1 release" : `${count} releases`;
  }

  function createArtwork(artId, className) {
    const art = document.createElement("div");
    art.className = className;
    if (Number.isInteger(artId)) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.src = `https://f4.bcbits.com/img/a${artId}_2.jpg`;
      art.append(image);
    }
    return art;
  }

  function createArtistCard(group) {
    const card = document.createElement("li");
    card.className = "bc-improver-artist-card";
    card.dataset.artistKey = group.key;

    const link = document.createElement("a");
    link.href = `${ARTIST_HASH_PREFIX}${encodeURIComponent(group.key)}`;
    link.title =
      group.variants.length > 1
      ? `Merged variants: ${group.variants.join(", ")}`
        : group.name;
    link.append(createArtwork(group.items[0]?.art_id, "bc-improver-artist-art art"));

    const name = document.createElement("div");
    name.className = "bc-improver-artist-name primaryText";
    name.textContent = group.name;

    const count = document.createElement("div");
    count.className = "bc-improver-artist-count secondaryText";
    count.textContent = releaseCountLabel(group.items.length);
    link.append(name, count);
    card.append(link);
    return card;
  }

  function appendReleaseTypeLabel(titleElement, type) {
    const label = releaseTypeLabel(type);
    if (!titleElement || !label || titleElement.querySelector(".bc-improver-release-type")) {
      return;
    }

    const typeElement = document.createElement("span");
    typeElement.className = "bc-improver-release-type secondaryText";
    typeElement.textContent = label;
    titleElement.append(typeElement);
  }

  function createReleaseCard(item) {
    const card = document.createElement("li");
    card.className = "bc-improver-release-card";
    card.dataset.itemId = `${item.type}-${item.id}`;

    const link = document.createElement("a");
    link.href = new URL(item.page_url, location.origin).href;
    link.append(createArtwork(item.art_id, "art"));

    const title = document.createElement("p");
    title.className = "title primaryText";
    title.textContent = item.title;
    appendReleaseTypeLabel(title, item.type);
    link.append(title);
    card.append(link);
    return card;
  }

  function addReleaseTypeLabels(root) {
    const selector = '[data-item-id^="album-"], [data-item-id^="track-"]';
    const elements = root.matches?.(selector)
      ? [root, ...root.querySelectorAll(selector)]
      : [...root.querySelectorAll(selector)];

    for (const element of elements) {
      const match = /^(album|track)-\d+$/.exec(element.dataset.itemId ?? "");
      if (match) {
        appendReleaseTypeLabel(element.querySelector(".title"), match[1]);
      }
    }
  }

  function observeReleaseTypeLabels(musicGrid) {
    addReleaseTypeLabels(musicGrid);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            addReleaseTypeLabels(node);
          }
        }
      }
    });
    observer.observe(musicGrid, { childList: true, subtree: true });
  }

  function parseClientItems(musicGrid) {
    const serialized = musicGrid?.getAttribute("data-client-items");
    if (!serialized) {
      return [];
    }

    try {
      const items = JSON.parse(serialized);
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.warn("Bandcamp.com Enhancer: invalid release catalog", error);
      return [];
    }
  }

  function readRenderedItems(musicGrid) {
    return [...musicGrid.querySelectorAll("[data-item-id]")]
      .map((element) => {
        const match = /^(album|track)-(\d+)$/.exec(element.dataset.itemId ?? "");
        const link = element.querySelector(":scope > a[href]");
        if (!match || !link) {
          return null;
        }

        const titleElement = element.querySelector(".title")?.cloneNode(true);
        titleElement?.querySelector(".artist-override")?.remove();
        titleElement?.querySelector(".bc-improver-release-type")?.remove();
        const image = element.querySelector(".art img");
        const imageUrl = image?.dataset.original || image?.src || "";
        const artId = /\/a(\d+)_/.exec(imageUrl)?.[1];
        const artist = element.querySelector(".artist-override")?.textContent.trim();

        return {
          art_id: artId ? Number(artId) : null,
          artist: artist || undefined,
          id: Number(match[2]),
          page_url: link.getAttribute("href"),
          title: titleElement?.textContent.trim() || "Untitled",
          type: match[1],
        };
      })
      .filter(Boolean);
  }

  function setupArtistBrowser(musicGrid) {
    const navbar = document.querySelector("#band-navbar");
    if (!navbar) {
      return null;
    }

    const alreadyHasArtistsTab = [...navbar.querySelectorAll("a[href]")].some(
      (link) => new URL(link.href, location.origin).pathname === "/artists",
    );
    if (alreadyHasArtistsTab) {
      return null;
    }

    const catalog = mergeReleases(
      readRenderedItems(musicGrid),
      parseClientItems(musicGrid),
    );
    const groups = groupReleasesByArtist(catalog);
    if (groups.length < 2) {
      return null;
    }

    const musicLink = [...navbar.querySelectorAll("a[href]")].find(
      (link) => new URL(link.href, location.origin).pathname === "/music",
    );
    if (!musicLink) {
      return null;
    }

    const tabItem = document.createElement("li");
    const tabLink = document.createElement("a");
    tabLink.href = ARTISTS_HASH;
    tabLink.textContent = "artists";
    tabItem.append(tabLink);
    musicLink.closest("li").before(tabItem);

    const view = document.createElement("section");
    view.className = "bc-improver-artists-view";
    view.hidden = true;

    const artistsPanel = document.createElement("div");
    const toolbar = document.createElement("div");
    toolbar.className = "bc-improver-artists-toolbar";

    const heading = document.createElement("h2");
    heading.className = "primaryText";
    heading.textContent = `Artists (${groups.length})`;

    const filter = document.createElement("input");
    filter.className = "bc-improver-artist-filter";
    filter.type = "search";
    filter.placeholder = "Filter artists";
    filter.setAttribute("aria-label", "Filter artists");
    toolbar.append(heading, filter);

    const artistsGrid = document.createElement("ol");
    artistsGrid.className = "bc-improver-artists-grid";
    const artistCards = groups.map(createArtistCard);
    artistsGrid.append(...artistCards);
    artistsPanel.append(toolbar, artistsGrid);

    const detailPanel = document.createElement("div");
    view.append(artistsPanel, detailPanel);
    musicGrid.before(view);

    filter.addEventListener("input", () => {
      const query = normalizeArtistName(filter.value);
      for (const card of artistCards) {
        card.hidden = Boolean(query) && !card.dataset.artistKey.includes(query);
      }
    });

    let ownedKeys = new Set();

    function renderArtist(group) {
      const header = document.createElement("header");
      header.className = "bc-improver-artist-detail-header";

      const back = document.createElement("a");
      back.className = "bc-improver-back-link primaryText";
      back.href = ARTISTS_HASH;
      back.textContent = "← all artists";

      const artistHeading = document.createElement("h2");
      artistHeading.className = "primaryText";
      artistHeading.textContent = group.name;
      header.append(back, artistHeading);

      if (group.variants.length > 1) {
        const variants = document.createElement("div");
        variants.className = "bc-improver-artist-variants secondaryText";
        variants.textContent = `Merged names: ${group.variants.join(" · ")}`;
        header.append(variants);
      }

      const count = document.createElement("div");
      count.className = "bc-improver-artist-count secondaryText";
      count.textContent = releaseCountLabel(group.items.length);
      header.append(count);

      const releases = document.createElement("ol");
      releases.className = "bc-improver-release-grid";
      releases.append(...group.items.map(createReleaseCard));
      detailPanel.replaceChildren(header, releases);
      markDiscography(ownedKeys);
    }

    function applyRoute() {
      const isArtistsIndex = location.hash === ARTISTS_HASH;
      let artistKey = null;
      if (location.hash.startsWith(ARTIST_HASH_PREFIX)) {
        try {
          artistKey = decodeURIComponent(
            location.hash.slice(ARTIST_HASH_PREFIX.length),
          );
        } catch (error) {
          console.warn("Bandcamp.com Enhancer: invalid artist URL", error);
        }
      }
      const group = artistKey
        ? groups.find((candidate) => candidate.key === artistKey)
        : null;
      const isArtistRoute = isArtistsIndex || Boolean(group);

      musicGrid.hidden = isArtistRoute;
      view.hidden = !isArtistRoute;
      tabLink.classList.toggle("active", isArtistRoute);
      tabLink.classList.toggle("primaryText", isArtistRoute);
      musicLink.classList.toggle("active", !isArtistRoute);
      musicLink.classList.toggle("primaryText", !isArtistRoute);

      if (!isArtistRoute) {
        return;
      }

      artistsPanel.hidden = Boolean(group);
      detailPanel.hidden = !group;
      if (group) {
        renderArtist(group);
      }
    }

    window.addEventListener("hashchange", applyRoute);
    applyRoute();

    return {
      setOwnedKeys(keys) {
        ownedKeys = keys;
          markDiscography(keys);
      },
    };
  }

  function markDiscography(ownedKeys) {
    document
      .querySelectorAll(
        "#music-grid [data-item-id], .bc-improver-release-grid [data-item-id]",
      )
      .forEach((item) => {
        const key = keyFromGridItemId(item.dataset.itemId);
        if (
          !key ||
          !ownedKeys.has(key) ||
          item.querySelector(".bc-improver-owned-badge")
        ) {
          return;
        }

        const art = item.querySelector(".art");
        if (art) {
          art.classList.add("bc-improver-owned-anchor");
          art.append(createBadge("Owned", "cover"));
        }
      });
  }

  function showErrorNotice() {
    const notice = document.createElement("div");
    notice.className = "bc-improver-notice";
    notice.setAttribute("role", "status");
    notice.append(
      document.createTextNode(
        "Could not read your collection. Log in to Bandcamp and refresh the page.",
      ),
    );

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => notice.remove());
    notice.append(close);
    document.body.append(notice);
  }

  GM.registerMenuCommand("Bandcamp.com Enhancer: refresh collection", async () => {
    await GM.deleteValue(CACHE_KEY);
    location.reload();
  });

  async function main() {
    if (hasNativeOwnership(document)) {
      return;
    }

    const musicGrid = document.querySelector("#music-grid");
    if (!musicGrid) {
      return;
    }

    addStyles();
    const artistBrowser = setupArtistBrowser(musicGrid);
    observeReleaseTypeLabels(musicGrid);
    try {
      const ownedKeys = await loadOwnedKeys();
      markDiscography(ownedKeys);
      artistBrowser?.setOwnedKeys(ownedKeys);
    } catch (error) {
      console.warn("Bandcamp.com Enhancer:", error);
      showErrorNotice();
    }
  }

  void main();
})();
