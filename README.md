# Bandcamp.com Enhancer

Userscript for Firefox and Greasemonkey that marks owned releases and makes large Bandcamp discographies easier to browse.

Current MVP features:

- adds an **Owned** badge to release artwork in an artist's discography (`/music`),
- shows the release type under each item: **ALBUM** or **SINGLE**, including items loaded later by Bandcamp,
- leaves Bandcamp's native **You own this** message on album and track pages without duplicating it,
- adds an **artists** tab on accounts that do not have Bandcamp's native label tab,
- groups artist-name variants without considering case, spaces, punctuation, or accents (for example, `WolfClub` and `W O L F C L U B`),
- lets you filter artists and click through to all releases associated with an artist,
- uses your logged-in Bandcamp session without asking for your password or profile name,
- stores only owned-release identifiers locally and refreshes them every six hours.

## Installation

1. Install [Greasemonkey for Firefox](https://addons.mozilla.org/firefox/addon/greasemonkey/).
2. Open [the installation script](https://raw.githubusercontent.com/Kicer86/bandcamp.com-enhancer/master/bandcamp-com-enhancer.user.js) in Firefox.
3. Confirm the installation in Greasemonkey.
4. Log in to Bandcamp and open any artist's discography.

After making a new purchase, use **Bandcamp.com Enhancer: refresh collection** from the Greasemonkey menu to clear the cache immediately.

## Updates

Greasemonkey periodically checks the installation URL for a newer `@version` and offers an update automatically. Install the script from the GitHub link above rather than by copying it into a new local script; this one-time reinstall is required for existing manual installations.

## Privacy and limitations

The script contacts only `bandcamp.com` and uses the collection summary consumed by Bandcamp's own interface. On an individual release page, the native `#collect-item.purchased #purchased-msg` state remains the source of truth. No data is sent to any other service. The collection endpoint is not publicly documented, so a change on Bandcamp's side may require an update to the script.

## Tests

Node.js 18 or newer is required:

```sh
node --test tests/userscript.test.js
```
