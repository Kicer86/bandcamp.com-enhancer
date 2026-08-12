# Bandcamp Improver

Userscript dla Firefoksa i Greasemonkey, który wyraźnie oznacza kupione wydania na stronach Bandcampa.

Obecna wersja MVP:

- dodaje znaczek **✓ Masz** na okładkach w dyskografii artysty (`/music`),
- dodaje znaczek **✓ W kolekcji** obok tytułu strony albumu lub utworu,
- korzysta z zalogowanej sesji Bandcampa — nie prosi o hasło ani nazwę profilu,
- zapisuje lokalnie tylko identyfikatory kupionych wydań i odświeża je co 6 godzin.

## Instalacja

1. Zainstaluj dodatek [Greasemonkey dla Firefoksa](https://addons.mozilla.org/firefox/addon/greasemonkey/).
2. W Greasemonkey wybierz utworzenie nowego skryptu użytkownika.
3. Zastąp jego zawartość całym plikiem `bandcamp-improver.user.js` i zapisz.
4. Zaloguj się do Bandcampa i otwórz dyskografię dowolnego artysty.

Po nowym zakupie możesz użyć polecenia **Bandcamp Improver: odśwież kolekcję** z menu Greasemonkey, aby od razu wyczyścić pamięć podręczną.

## Prywatność i ograniczenia

Skrypt odpytuje wyłącznie `bandcamp.com` i używa podsumowania kolekcji, z którego korzysta sam interfejs Bandcampa. Dane nie są wysyłane do żadnego innego serwisu. Endpoint nie jest publicznie udokumentowany, więc zmiana po stronie Bandcampa może w przyszłości wymagać aktualizacji skryptu.

## Testy

Wymagany jest Node.js 18 lub nowszy:

```sh
node --test tests/userscript.test.js
```
