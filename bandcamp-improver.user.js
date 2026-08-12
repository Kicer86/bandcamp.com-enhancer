// ==UserScript==
// @name         Bandcamp Improver
// @namespace    https://github.com/local/bandcamp-improver
// @version      0.1.0
// @description  Pokazuje wyraźne oznaczenie przy wydaniach, które masz już w kolekcji Bandcamp.
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

  const CACHE_KEY = "bandcamp-improver-owned-v1";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const SUMMARY_URL = "https://bandcamp.com/api/fan/2/collection_summary";

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

  function keyFromPageProperties(properties) {
    if (
      properties &&
      (properties.item_type === "a" || properties.item_type === "t") &&
      Number.isInteger(properties.item_id)
    ) {
      return `${properties.item_type}${properties.item_id}`;
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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      keyFromGridItemId,
      keyFromPageProperties,
      ownedKeysFromSummary,
    };
    return;
  }

  function readPageProperties() {
    const meta = document.querySelector('meta[name="bc-page-properties"]');
    if (!meta) {
      return null;
    }

    try {
      return JSON.parse(meta.content);
    } catch (error) {
      console.warn("Bandcamp Improver: nieprawidłowe dane strony", error);
      return null;
    }
  }

  function currentFanId() {
    const footer = document.querySelector("page-footer[page-context]");
    if (!footer) {
      return null;
    }

    try {
      return JSON.parse(footer.getAttribute("page-context")).identity?.fanId ?? null;
    } catch (error) {
      console.warn("Bandcamp Improver: nieprawidłowe dane użytkownika", error);
      return null;
    }
  }

  function hasSupportedContent() {
    return Boolean(
      document.querySelector("#music-grid [data-item-id]") ||
        keyFromPageProperties(readPageProperties()),
    );
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
            reject(new Error(`Bandcamp odpowiedział kodem ${response.status}`));
            return;
          }

          try {
            resolve(JSON.parse(response.responseText));
          } catch (error) {
            reject(new Error("Bandcamp nie zwrócił poprawnych danych JSON", { cause: error }));
          }
        },
        onerror() {
          reject(new Error("Nie udało się połączyć z Bandcampem"));
        },
        ontimeout() {
          reject(new Error("Upłynął limit czasu połączenia z Bandcampem"));
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
      throw new Error("Brak kolekcji w odpowiedzi; użytkownik może nie być zalogowany");
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

      .bc-improver-owned-badge--page {
        margin-top: 10px;
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
    badge.setAttribute("aria-label", "To wydanie jest w Twojej kolekcji");

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";
    badge.append(icon, document.createTextNode(label));
    return badge;
  }

  function markDiscography(ownedKeys) {
    document.querySelectorAll("#music-grid [data-item-id]").forEach((item) => {
      const key = keyFromGridItemId(item.dataset.itemId);
      if (!key || !ownedKeys.has(key) || item.querySelector(".bc-improver-owned-badge")) {
        return;
      }

      const art = item.querySelector(".art");
      if (art) {
        art.classList.add("bc-improver-owned-anchor");
        art.append(createBadge("Masz", "cover"));
      }
    });
  }

  function markCurrentRelease(ownedKeys) {
    const key = keyFromPageProperties(readPageProperties());
    const nameSection = document.querySelector("#name-section");
    if (
      key &&
      ownedKeys.has(key) &&
      nameSection &&
      !nameSection.querySelector(".bc-improver-owned-badge")
    ) {
      nameSection.append(createBadge("W kolekcji", "page"));
    }
  }

  function showErrorNotice() {
    const notice = document.createElement("div");
    notice.className = "bc-improver-notice";
    notice.setAttribute("role", "status");
    notice.append(
      document.createTextNode(
        "Nie udało się odczytać kolekcji. Zaloguj się do Bandcampa i odśwież stronę.",
      ),
    );

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Zamknij");
    close.textContent = "×";
    close.addEventListener("click", () => notice.remove());
    notice.append(close);
    document.body.append(notice);
  }

  GM.registerMenuCommand("Bandcamp Improver: odśwież kolekcję", async () => {
    await GM.deleteValue(CACHE_KEY);
    location.reload();
  });

  async function main() {
    if (!hasSupportedContent()) {
      return;
    }

    addStyles();
    try {
      const ownedKeys = await loadOwnedKeys();
      markDiscography(ownedKeys);
      markCurrentRelease(ownedKeys);
    } catch (error) {
      console.warn("Bandcamp Improver:", error);
      showErrorNotice();
    }
  }

  void main();
})();
