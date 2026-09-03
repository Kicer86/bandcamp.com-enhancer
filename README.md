
# Bandcamp.com Enhancer

Userscript for Firefox and Greasemonkey that makes Bandcamp discographies easier to browse.

Features:

- highlights releases you already own,
- shows whether a release is an album or single,
- adds an artist browser to large label discographies, if Bandcamp does not provide one, with a link from every profile tab,
- lets you filter an artist's releases by all, albums, or singles.

## Installation

1. Install [Greasemonkey for Firefox](https://addons.mozilla.org/firefox/addon/greasemonkey/).
2. Open [the installation script](https://raw.githubusercontent.com/Kicer86/bandcamp.com-enhancer/master/bandcamp-com-enhancer.user.js) in Firefox.
3. Confirm the installation in Greasemonkey.
4. Log in to Bandcamp and open any artist's discography.

After making a new purchase, use **Bandcamp.com Enhancer: refresh collection** from the Greasemonkey menu to clear the cache immediately.

## Updates

Greasemonkey periodically checks the installation URL for a newer `@version` and offers an update automatically. Install the script from the GitHub link above rather than by copying it into a new local script; this one-time reinstall is required for existing manual installations.

## Privacy and limitations

The script communicates only with Bandcamp and does not send data to other services.

## AI assistance

This project was developed with AI assistance (OpenAI Codex), under the direction and review of the maintainer.

## Tests

Node.js 18 or newer is required:

```sh
node --test tests/userscript.test.js
```
