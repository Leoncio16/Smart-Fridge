# GitHub Pages dla Smart Fridge

Ten projekt ma gotowa wersje webowa w folderze `docs/`.

## Najprostsze uruchomienie

1. Utworz nowe repozytorium na GitHubie.
2. Wgraj cala zawartosc tego folderu projektu do repozytorium.
3. Wejdz w repozytorium na GitHubie: `Settings` -> `Pages`.
4. Wybierz `Build and deployment` -> `Source` -> `Deploy from a branch`.
5. Ustaw branch `main` i folder `/docs`.
6. Zapisz. Po chwili GitHub pokaze adres strony.

## Alternatywa przez GitHub Actions

Repo zawiera workflow `.github/workflows/deploy-pages.yml`.
Jesli w `Settings` -> `Pages` ustawisz `Source` na `GitHub Actions`, strona bedzie publikowana automatycznie z folderu `docs`.

## iPhone

Po otwarciu adresu GitHub Pages w Safari:

1. Kliknij przycisk udostepniania.
2. Wybierz `Dodaj do ekranu poczatkowego`.
3. Uruchamiaj Smart Fridge jak zwykla aplikacje.

Skaner kodow kreskowych wymaga HTTPS. GitHub Pages daje HTTPS automatycznie.
