# Facultate pentru examenele UMFCD

Codul aplicației a fost recuperat din commitul `53f4e74957cc1f937c646f22c6390631a00cb0bb` (8 octombrie 2026), la cererea utilizatorului. Ramura principală inspectată, `918d661`, conținea numai `package-lock.json`. Restaurarea și funcționalitatea Facultate sunt salvate în commituri separate.

## Modificări

- Formularul de creare/editare UMFCD cere explicit Medicină Generală sau Stomatologie; editarea precompletează valoarea salvată.
- Valoarea este trimisă către `public.simulations.faculty` la salvare în Supabase.
- Facultatea este afișată în listele administratorului și elevului, în introducerea examenului, în timpul rezolvării și la rezultate.
- Filtrele includ Toate facultățile, Medicină Generală, Stomatologie și Nespecificată. Filtrul elevului se combină cu tipul și anul. Reordonarea administrativă păstrează pozițiile din lista completă.
- Examenele vechi rămân cu NULL și sunt afișate ca Nespecificată; nu este presupusă o facultate. La editarea formularului devine obligatorie alegerea unei facultăți. Publicarea/reordonarea unui examen vechi rămân compatibile.
- Descrierile existente sunt păstrate la salvare.

## Aplicare în mediul real

1. Verifică proiectul Supabase asociat aplicației și aplică **doar noua migrare** `supabase/migrations/20261014190000_umfcd_exam_faculty.sql`, prin mecanismul obișnuit de migrare sau SQL Editor. Nu reexecuta migrările istorice pe baza existentă.
2. Migrarea adaugă coloana, validarea celor două valori și obligativitatea pentru examenele UMFCD noi. Nu actualizează și nu șterge rânduri, întrebări, încercări sau politici RLS. Actualizările administrative ale rândurilor vechi NULL rămân posibile.
3. Integrează sursa restaurată și modificată în proiectul Bolt existent, păstrând configurația lui de mediu Supabase. Publică aplicația după aplicarea migrării.
4. Verifică în mediul real crearea, editarea și reîncărcarea câte unui examen pentru fiecare facultate, filtrarea și accesul la examenele vechi.

## Verificări efectuate local

- TypeScript și compilare Vite: reușite (avertisment de dimensiune a pachetelor rezultate).
- PostgreSQL local PGlite: rândurile existente și legăturile întrebărilor sunt păstrate; examenele UMFCD noi fără facultate și valorile invalide sunt respinse; ambele facultăți sunt acceptate; un examen clasificat nu poate fi golit; simulările non-UMFCD rămân compatibile.
- Funcțiile de filtrare: ambele facultăți, toate și nespecificată, inclusiv date vechi fără câmp.
- Browser, date fictive: validarea câmpului obligatoriu, precompletare la editare, afișarea celor trei categorii, filtrarea Stomatologie și Nespecificată.

Migrarea nu a fost executată în baza reală, iar această versiune nu a fost publicată în Bolt. Testele locale nu înlocuiesc verificarea fluxului autentificat cu Supabase în mediul real.
