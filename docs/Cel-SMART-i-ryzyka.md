# Mapa łowisk w Polsce

Karta projektu grupowego z zarządzania projektami

## Cel projektu metodą SMART

W ciągu 8 tygodni przygotujemy i przetestujemy aplikację, w której wędkarz wybierze łowisko na mapie Polski, sprawdzi głębokość i występujące tam gatunki ryb oraz zgłosi kontrolę na danym akwenie. Pierwsza wersja obejmie 15 łowisk w trzech województwach.

- **S – Konkretny.** Użytkownik wybierze województwo, otworzy kartę łowiska i doda albo potwierdzi zgłoszenie kontroli.
- **M – Mierzalny.** Oddamy 15 kompletnych kart. W teście co najmniej 4 z 5 osób w ciągu 3 minut samodzielnie znajdą wskazane łowisko, odczytają głębokość i dodadzą próbne zgłoszenie.
- **A – Osiągalny.** Dane zbierzemy ręcznie dla wybranych zbiorników. Podzielimy między siebie przygotowanie kart, programowanie mapy i obsługę zgłoszeń.
- **R – Istotny.** Przed wyjazdem wędkarz sprawdzi w jednym miejscu, gdzie w wybranym regionie występuje interesujący go gatunek i jak głęboki jest zbiornik.
- **T – Określony w czasie.** Do końca 2. tygodnia wybierzemy łowiska i źródła, do końca 6. uruchomimy mapę i zgłoszenia, a ostatnie 2 tygodnie przeznaczymy na testy i poprawki.

## Zakres i ograniczenia

**Mapa i dane.** Pilotaż obejmie po 5 łowisk w województwach dolnośląskim, opolskim i lubuskim. Każda karta zawrze nazwę, położenie, głębokość maksymalną w metrach, listę gatunków ryb i źródła danych.

**Zgłoszenia kontroli.** Wpis przypiszemy do całego łowiska. Użytkownicy będą mogli go potwierdzić lub oznaczyć jako błędny. W szkolnych testach wykorzystamy fikcyjne zgłoszenia oznaczone jako testowe.

**Granice pierwszej wersji.** Aplikacja będzie działać w przeglądarce na telefonie i komputerze. Na później zostawiamy pozostałe województwa, szczegółowe mapy dna i osobne aplikacje mobilne.

## Użytkownicy końcowi

**Osoby wybierające się na nowe łowisko.** Porównają zbiorniki w danym regionie pod kątem głębokości i występujących gatunków.

**Wędkarze znający lokalne wody.** Dodadzą informację o kontroli na łowisku, potwierdzą cudze zgłoszenie albo zgłoszą pomyłkę.

Kontrole prowadzą m.in. Państwowa Straż Rybacka i Społeczna Straż Rybacka. [Ustawa o rybactwie śródlądowym, art. 22 i 24](https://api.sejm.gov.pl/eli/acts/DU/2022/883/text.html)

## Rejestr ryzyk

- **Prawdopodobieństwo (P).** 1 – mało prawdopodobne, 2 – możliwe, 3 – prawdopodobne, 4 – bardzo prawdopodobne.
- **Wpływ (W).** 1 – drobna poprawka, 2 – utrudnione korzystanie, 3 – opóźnienie lub niedostępna funkcja, 4 – zagrożone oddanie projektu.
- **Poziom ryzyka (P × W).** 1–3 niski, 4–7 umiarkowany, 8–11 wysoki, 12–16 krytyczny.

### 1. Brakuje danych o głębokości lub rybach. Karta pozostaje niepełna.

- **P × W** = 3 × 4 = **12** (krytyczny).
- **Działania prewencyjne.** Do 2. tygodnia sprawdzimy opisy zarządców i opracowania o zbiornikach. W każdym regionie wybierzemy też łowiska rezerwowe.
- **Plan awaryjny.** Zastąpimy zbiornik rezerwowym z tego samego województwa i sprawdzimy źródła obu informacji.

### 2. Nieobecność jednej osoby opóźnia pracę całej grupy.

- **P × W** = 3 × 3 = **9** (wysoki).
- **Działania prewencyjne.** Każde zadanie ma osobę odpowiedzialną i zastępcę. Raz w tygodniu pokazujemy sobie działającą wersję.
- **Plan awaryjny.** Zastępca przejmie otwarte zadanie. Na najbliższe spotkanie przełożymy prace o niższym priorytecie.

### 3. Fałszywy lub stary wpis wprowadza wędkarzy w błąd.

- **P × W** = 3 × 3 = **9** (wysoki).
- **Działania prewencyjne.** Pokażemy godzinę i status zgłoszenia. Nowy wpis będzie niepotwierdzony, a po 2 godzinach automatycznie zniknie z mapy.
- **Plan awaryjny.** Po zgłoszeniu błędu osoba z zespołu sprawdzi wpis, usunie pomyłkę i przetestuje wygaszanie zgłoszeń.

### 4. Ktoś wykorzystuje wpisy do omijania rzeczywistych kontroli.

- **P × W** = 2 × 4 = **8** (wysoki).
- **Działania prewencyjne.** Moduł przetestujemy w zamkniętej grupie na fikcyjnych wpisach. Formularz pozwoli wskazać tylko łowisko, bez zdjęć i dokładnej pozycji osób.
- **Plan awaryjny.** Ukryjemy rzeczywiste zgłoszenie, wstrzymamy dodawanie wpisów i dokończymy pokaz na przygotowanych przykładach.

### 5. Błąd przy łączeniu zmian psuje działającą wersję aplikacji.

- **P × W** = 2 × 4 = **8** (wysoki).
- **Działania prewencyjne.** Zmiany zapiszemy na osobnych gałęziach w GitHubie. Przed połączeniem druga osoba sprawdzi mapę, karty i zgłoszenia.
- **Plan awaryjny.** Cofniemy wadliwą zmianę, przywrócimy ostatnią sprawną wersję i osobno przetestujemy poprawkę.

### 6. Brak internetu uniemożliwia pokaz mapy na lekcji.

- **P × W** = 2 × 3 = **6** (umiarkowany).
- **Działania prewencyjne.** Wcześniej sprawdzimy szkolną sieć. Zachowamy lokalną kopię kart i krótkie nagranie działania mapy.
- **Plan awaryjny.** Pokażemy zapisane karty i nagranie. Po przywróceniu połączenia powtórzymy próbę na żywo.

### 7. Na telefonie trudno wybrać region lub trafić w znacznik.

- **P × W** = 3 × 2 = **6** (umiarkowany).
- **Działania prewencyjne.** Przed testem z użytkownikami sprawdzimy filtr i znaczniki na dwóch telefonach o różnej wielkości ekranu.
- **Plan awaryjny.** Powiększymy znaczniki lub przeniesiemy filtr nad mapę, zależnie od miejsca błędu. Powtórzymy zadanie z testerami.

## Uwagi nauczyciela

_Tu można dopisać uwagi do celu SMART lub wskazanego ryzyka._
