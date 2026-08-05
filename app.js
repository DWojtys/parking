/* ==================================================================
   Parking Pasaż Parsęta -wspólny skrypt witryny.

   WYŁĄCZNIE progressive enhancement. Każda strona jest w pełni
   funkcjonalna bez tego pliku:
     • nawigacja to prawdziwe linki do stron (.html),
     • cennik, FAQ (<details>), galeria (scroll-snap), adres i telefon
       działają natywnie,
     • motyw idzie za `prefers-color-scheme`,
     • mapa Google w ogóle się nie wczytuje (statyczny podgląd OSM
       zostaje na miejscu), więc brak JS to brak zapytań do Google.

   Klasę `js` ustawia mały skrypt w <head> (przed pierwszym malowaniem,
   żeby elementy `.reveal` nie mrugnęły). Ten plik potwierdza swoje
   uruchomienie przez window.__pkGotowe; awaria (błąd, 404, blokada)
   zdejmuje klasę i strona wraca do wariantu bez skryptów.
   ================================================================== */
(function () {
  'use strict';

  var ruchOgraniczony = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    var html = document.documentElement;
    html.classList.add('js');
    window.__pkGotowe = true;

    /* ---------- Motyw jasny / ciemny -------------------------------
       Bez świadomego wyboru motyw idzie za systemem. Wybór zapisujemy
       w localStorage i wygrywa on nad preferencją systemu.            */
    // Na telefonie przełącznik stoi w arkuszu menu, na desktopie w listwie -w DOM
    // są oba, więc etykiety i stan trzymamy zsynchronizowane na wszystkich.
    var przelaczniki = document.querySelectorAll('[data-theme-toggle]');
    if (przelaczniki.length) {
      var kontrastCiemny = window.matchMedia('(prefers-color-scheme: dark)');
      var motywEfektywny = function () {
        return html.getAttribute('data-theme') || (kontrastCiemny.matches ? 'dark' : 'light');
      };
      // Pasek przeglądarki (theme-color) podąża za motywem efektywnym -bez tego ręczne
      // przełączenie zostawiłoby np. jasny pasek adresu nad ciemną stroną.
      var metaKolory = document.querySelectorAll('meta[name="theme-color"]');
      var ustawKolorPaska = function (m) {
        var kolor = m === 'dark' ? '#191c20' : '#f5f7f4';
        metaKolory.forEach(function (meta) { meta.setAttribute('content', kolor); });
      };
      var opiszPrzycisk = function (m) {
        przelaczniki.forEach(function (p) {
          p.setAttribute('aria-pressed', m === 'dark' ? 'true' : 'false');
          p.setAttribute('aria-label', m === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny');
        });
        ustawKolorPaska(m);
      };
      opiszPrzycisk(motywEfektywny());
      przelaczniki.forEach(function (p) {
        p.addEventListener('click', function () {
          var nowy = motywEfektywny() === 'dark' ? 'light' : 'dark';
          html.setAttribute('data-theme', nowy);
          try { localStorage.setItem('motyw', nowy); } catch (e) {}
          opiszPrzycisk(nowy);
        });
      });
      // Dopóki nie ma świadomego wyboru, etykieta śledzi zmianę motywu systemowego.
      // Guard: starsze Safari (<14) nie ma addEventListener na MediaQueryList -bez tego
      // rzuciłoby wyjątek i przerwało resztę progressive enhancement w tym bloku try.
      if (kontrastCiemny.addEventListener) {
        kontrastCiemny.addEventListener('change', function () {
          if (!html.getAttribute('data-theme')) opiszPrzycisk(motywEfektywny());
        });
      }
    }

    /* ---------- Arkusz menu (≤900px) -------------------------------
       Otwieranie, zamykanie klawiszem Esc, zamknięcie kliknięciem obok
       i powrót fokusu na przycisk robi popover w przeglądarce. Skryptowi
       zostają dwie rzeczy: lustrzane `aria-expanded` (nie każda przeglądarka
       wystawia je niejawnie) i domknięcie arkusza, gdy okno urośnie do
       desktopu przy otwartym menu. Bez JS menu działa w całości.        */
    var arkusz = document.getElementById('menu-witryny');
    var przyciskMenu = document.querySelector('[popovertarget="menu-witryny"]');
    if (arkusz && przyciskMenu && typeof arkusz.hidePopover === 'function') {
      var arkuszOtwarty = false;
      przyciskMenu.setAttribute('aria-expanded', 'false');
      arkusz.addEventListener('toggle', function (e) {
        arkuszOtwarty = e.newState === 'open';
        przyciskMenu.setAttribute('aria-expanded', arkuszOtwarty ? 'true' : 'false');
      });
      var desktop = window.matchMedia('(min-width: 901px)');
      if (desktop.addEventListener) {
        desktop.addEventListener('change', function () {
          if (desktop.matches && arkuszOtwarty) arkusz.hidePopover();
        });
      }
    }

    /* ---------- Galeria: strzałki (bez JS pas przewija się natywnie) ---------- */
    var strip = document.querySelector('.strip');
    var prev = document.querySelector('[data-strip-prev]');
    var next = document.querySelector('[data-strip-next]');
    if (strip && prev && next) {
      var krok = function () { return Math.min(strip.clientWidth * 0.8, 640); };
      prev.addEventListener('click', function () {
        strip.scrollBy({ left: -krok(), behavior: ruchOgraniczony ? 'auto' : 'smooth' });
      });
      next.addEventListener('click', function () {
        strip.scrollBy({ left: krok(), behavior: ruchOgraniczony ? 'auto' : 'smooth' });
      });
      // Strzałki gasną na krańcach pasa -widać, że dalej nie ma już zdjęć
      var aktualizujStrzalki = function () {
        var maks = strip.scrollWidth - strip.clientWidth - 1;
        prev.disabled = strip.scrollLeft <= 0;
        next.disabled = strip.scrollLeft >= maks;
      };
      aktualizujStrzalki();
      strip.addEventListener('scroll', aktualizujStrzalki, { passive: true });
      window.addEventListener('resize', aktualizujStrzalki);
    }

    /* ---------- Zgoda na mapę Google -------------------------------
       Baner pojawia się tylko na stronie, która naprawdę ma mapę
       (dziś: dojazd.html). Decyzja zapisana w localStorage obowiązuje
       na całej witrynie, więc przy kolejnych wizytach mapa wczytuje się
       od razu i baner już nie wraca. Przed zgodą strona nie wysyła do
       Google żadnych zapytań.                                         */
    var mapaBtn = document.querySelector('[data-map-load]');
    var mapaWrap = document.querySelector('[data-map-wrap]');
    var baner = document.getElementById('cookie-baner');
    var zapiszZgode = function (w) { try { localStorage.setItem('zgoda-mapa', w); } catch (e) {} };
    var schowajBaner = function () { if (baner) baner.hidden = true; };
    var wczytajMape = function () {
      // Guard: kolejne wywołania (np. szybkie podwójne kliknięcie) nie tworzą drugiej ramki
      if (!mapaBtn || !mapaWrap || mapaWrap.querySelector('iframe')) return;
      var ramka = document.createElement('iframe');
      ramka.title = 'Mapa: Parking Pasaż Parsęta, ul. Łopuskiego 27, Kołobrzeg';
      ramka.src = mapaBtn.getAttribute('data-map-src');
      ramka.loading = 'lazy';
      ramka.referrerPolicy = 'no-referrer-when-downgrade';
      ramka.allowFullscreen = true;
      // Podgląd znika dopiero, gdy mapa naprawdę się załaduje -bez sieci zostaje
      // statyczny podgląd z pinezką, a nie pusta ramka.
      ramka.addEventListener('load', function () {
        mapaWrap.classList.add('mapa-zaladowana');
        var podglad = mapaWrap.querySelector('.map-placeholder');
        if (podglad) setTimeout(function () { podglad.remove(); }, 350);
      });
      mapaWrap.appendChild(ramka);
    };
    var zgoda = null;
    try { zgoda = localStorage.getItem('zgoda-mapa'); } catch (e) {}
    if (zgoda === 'tak') {
      wczytajMape();
    } else if (zgoda !== 'nie' && baner && mapaWrap) {
      baner.hidden = false;
    }
    if (baner) {
      var akceptuj = baner.querySelector('[data-cookie-akceptuj]');
      var odrzuc = baner.querySelector('[data-cookie-odrzuc]');
      if (akceptuj) akceptuj.addEventListener('click', function () { zapiszZgode('tak'); schowajBaner(); wczytajMape(); });
      if (odrzuc) odrzuc.addEventListener('click', function () { zapiszZgode('nie'); schowajBaner(); });
    }
    if (mapaBtn) {
      mapaBtn.addEventListener('click', function () { zapiszZgode('tak'); schowajBaner(); wczytajMape(); });
    }

    /* ---------- Delikatne odsłanianie sekcji przy przewijaniu -------
       Tylko tam, gdzie sekwencja coś znaczy (tablice, cennik, mapa).
       Bez JS i przy ograniczonym ruchu treść jest po prostu widoczna.  */
    var elementy = document.querySelectorAll('.reveal');
    if (ruchOgraniczony || !('IntersectionObserver' in window)) {
      elementy.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (wpisy) {
        wpisy.forEach(function (w) {
          if (w.isIntersecting) { w.target.classList.add('in'); io.unobserve(w.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      elementy.forEach(function (el) { io.observe(el); });
    }

    /* ---------- Mobilny pasek połączenia ---------------------------
       Pojawia się dopiero po minięciu nagłówka strony (tam stoi już
       przycisk „Zadzwoń teraz") i chowa się nad sekcją kontaktu
       z numerem. Bez JS pasek jest po prostu zawsze widoczny.         */
    var callbar = document.getElementById('callbar');
    var gora = document.querySelector('.hero, .page-head, .doc-hero');
    var kontakt = document.getElementById('kontakt');
    if (callbar && gora && 'IntersectionObserver' in window) {
      var przedTrescia = true, wKontakcie = false;
      var aktualizujPasek = function () {
        callbar.classList.toggle('schowany', przedTrescia || wKontakcie);
      };
      callbar.classList.add('schowany');
      new IntersectionObserver(function (wpisy) {
        wpisy.forEach(function (w) { przedTrescia = w.isIntersecting; });
        aktualizujPasek();
      }, { threshold: 0.1 }).observe(gora);
      if (kontakt) {
        new IntersectionObserver(function (wpisy) {
          wpisy.forEach(function (w) { wKontakcie = w.isIntersecting; });
          aktualizujPasek();
        }, { threshold: 0.25 }).observe(kontakt);
      }
    }
  } catch (e) {
    document.documentElement.classList.remove('js');
  }
})();
