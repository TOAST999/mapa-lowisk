# mapa-lowisk

Szkolny atlas wędkarski. Na mapie Polski jest 15 łowisk, po pięć w województwach dolnośląskim, opolskim i lubuskim. Każda karta podaje maksymalną głębokość, gatunki ryb, położenie i źródła. Próbne zgłoszenia kontroli służą do demonstracji pracy kilku użytkowników.

## Szybki pokaz bez instalacji

Pobierz **[Atlas_lowisk.html](Atlas_lowisk.html)** i otwórz plik w przeglądarce. Na stronie pliku w GitHubie służy do tego przycisk **Download raw file**. Mapa działa bez internetu. Wpisz np. „sandacz”, wybierz województwo i kliknij łowisko. Kliknięcie liczby na mapie przybliża grupę sąsiednich łowisk.

W karcie dodaj próbne zgłoszenie jako **Tester A**, a następnie zmień rolę na **Tester B** i wybierz **Potwierdź**. W tym pokazie zdarzenia istnieją do odświeżenia strony albo do wygaśnięcia wpisu. Przełączanie ról symuluje kilka osób na jednym ekranie.

## Wspólne zgłoszenia na komputerze i telefonie

Pobierz całe repozytorium (**Code → Download ZIP**) i rozpakuj je. W katalogu projektu uruchom serwer w Pythonie 3.8 lub nowszym. Wystarczy standardowa biblioteka Pythona.

Na Windowsie uruchom

```shell
py -3 serwer.py
```

Na macOS lub Linuksie uruchom

```shell
python3 serwer.py
```

Otwórz **http://127.0.0.1:8000**. Żeby przetestować mapę wspólnie na telefonach, uruchom serwer z opcją `--host 0.0.0.0`, połącz urządzenia z tą samą siecią i na telefonie otwórz adres IP komputera z portem 8000, np. `http://192.168.1.20:8000`. Na Windowsie swój adres IPv4 sprawdzisz poleceniem `ipconfig`. Sieć musi pozwalać urządzeniom łączyć się ze sobą.

Po dodaniu próbnej kontroli całe łowisko dostaje oznaczenie na mapie. Pozostali zobaczą zmianę w ciągu 10 sekund. Autor nie głosuje pod własnym wpisem. Inna przeglądarka może oddać jeden głos i zmienić ocenę. Dwa niezależne oznaczenia błędu ukrywają wpis. Po 2 godzinach zgłoszenie wygasa. Wspólne dane zapisują się w lokalnej bazie SQLite, również po ponownym uruchomieniu serwera.

## Dokumentacja projektu

- [Cel SMART, zakres i rejestr ryzyk w Dokumentach Google](https://docs.google.com/document/d/19-anXV_sCFhmBsD43IFtxT1gCtv0Eo87KuHjEX9sEw0/edit?usp=drivesdk)
- [Kopia dokumentu w PDF](Mapa%20%C5%82owisk%20w%20Polsce%20%E2%80%93%20cel%20SMART%2C%20zakres%20i%20ryzyka.pdf)
- [Wersja edytowalna w Wordzie](docs/Mapa_lowisk_w_Polsce.docx)

Próba odbioru z karty projektu polega na tym, że tester samodzielnie odnajduje wskazane łowisko, odczytuje głębokość i dodaje próbne zgłoszenie. Cel to co najmniej 4 z 5 osób kończących zadanie w 3 minuty. To zadanie dla zespołu i testerów podczas zajęć.

## Pliki i dane

- `index.html`, `static/atlas.css`, `static/atlas.js` i `static/mapa.js` tworzą interfejs.
- [Katalog łowisk](static/lowiska.json) zawiera źródła przy każdym akwenie. Wartości głębokości odnoszą się do materiałów źródłowych. Poziom wody w zbiorniku może się zmieniać.
- [Granice województw](static/regiony.json) to uproszczone dane z Geoportalu GUGiK z sierpnia 2025. [Opracowanie JW](https://github.com/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy).
- `serwer.py` obsługuje wspólne zgłoszenia. Po zmianie danych lub wyglądu uruchom `python zbuduj_pokaz.py`, aby odświeżyć przenośny plik HTML.
- Uruchom `python -m unittest discover -s tests`, aby sprawdzić dane i zasady obsługi zgłoszeń. Licencje osadzonych krojów DM Sans i Instrument Serif są w `static/fonts/`.
