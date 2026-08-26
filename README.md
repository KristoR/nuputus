# Nuputus

Eestikeelne nuputusmängude veebirakendus, mis töötab hästi ka mobiilis. Rakendus pakub viit klassikalist loogikamõistatust:

- **Sudoku** — täida ruudustik numbritega 1–9.
- **Telklaager** — aseta telgid puude kõrvale.
- **Tähesõda** — paiguta tähed ridadesse, veergudesse ja aladesse.
- **Laevade pommitamine** — leia peidetud laevastik.
- **Hiina müür** — tõmba jooned nii, et tekiks üks terviklik müür.

Iga mõistatus genereeritakse juhuslikult (kolmes raskusastmes) ja igaühel on garanteeritult üks kordumatu lahendus. Kui mängija jääb kinni, näitab **Vihje**-nupp, milline samm on loogiliselt tuletatav ja miks — mõeldud selleks, et aidata mängijal loogilist tuletamist harjutada, mitte lihtsalt vastust ette anda.

## Arendus

```bash
npm install
npm run dev       # arendusserver
npm run build     # tootmisversiooni ehitamine (dist/)
npm run typecheck # TypeScripti tüübikontroll
```

Tehniliselt on tegu tavalise staatilise Vite + TypeScript rakendusega (ilma raamistikuta, ilma taustasüsteemita) — kõik mõistatuste genereerimine ja lahendamine toimub brauseris.

## Struktuur

```
src/
  lib/            jagatud abifunktsioonid (DOM, tüübid, UI-komponendid)
  home.ts         avaekraan mängude valikuga
  main.ts         marsruutimine
  games/<mäng>/
    core.ts       andmestruktuurid ja abifunktsioonid
    generate.ts   mõistatuse generaator (kordumatu lahendusega)
    solve.ts       lahendaja (kasutatakse genereerimisel ja varulahendusena)
    hints.ts      inimliku loogika vihjemootor
    ui.ts         mängulaua kuvamine ja juhtimine
```
