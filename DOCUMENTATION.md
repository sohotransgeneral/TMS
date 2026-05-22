# 📦 TMS — Transport Management System

## Documentație completă a aplicației

> **Versiune:** 1.0 | **Data:** Mai 2026  
> Această documentație explică **tot** ce poți face în aplicație, pe înțelesul oricui.

---

## 📋 Cuprins

1. [Ce este TMS?](#1-ce-este-tms)
2. [Cum te autentifici?](#2-cum-te-autentifici)
3. [Rolurile din aplicație](#3-rolurile-din-aplicație)
4. [SUPER ADMIN](#4-super-admin)
5. [COMPANY ADMIN — Administrator de companie](#5-company-admin--administrator-de-companie)
6. [DISPATCHER — Dispecer](#6-dispatcher--dispecer)
7. [DRIVER — Șofer](#7-driver--șofer)
8. [ACCOUNTANT — Contabil](#8-accountant--contabil)
9. [FLEET MANAGER — Manager flotă](#9-fleet-manager--manager-flotă)
10. [Fluxul complet al unui transport](#10-fluxul-complet-al-unui-transport)
11. [Glosar de termeni](#11-glosar-de-termeni)

---

## 1. Ce este TMS?

TMS (Transport Management System) este o aplicație web pentru **firme de transport**.

Gândește-te la ea ca la un **creier central** al firmei de transport:

- Știe unde sunt camioanele și șoferii în timp real
- Urmărește fiecare transport de la creare până la plată
- Generează facturi
- Ține evidența cheltuielilor, combustibilului, mentenanței
- Arată rapoarte financiare
- Permite echipei să colaboreze (dispecer + șofer + contabil) fără să se sune tot timpul

---

## 2. Cum te autentifici?

### Pagina de login — `http://localhost:3000/login`

Introduci:

- **Email** — adresa de email
- **Parola** — minim 6 caractere

Apesi **"Sign In"** și ești dus automat la pagina potrivită rolului tău.

Dacă ai uitat parola:

1. Apesi **"Forgot password?"**
2. Introduci emailul
3. Primești un link pe email
4. Apesi linkul și setezi o parolă nouă

### Înregistrare companie nouă — `/register`

Dacă firma ta nu are cont, poți înregistra una nouă:

- Completezi: **Nume companie**, **Numele tău**, **Email**, **Parolă**
- Apesi **"Register"**
- Se creează automat compania + contul tău de **Company Admin**
- Primești o perioadă de trial de 30 de zile

---

## 3. Rolurile din aplicație

Există **7 roluri**. Fiecare vede și poate face lucruri diferite:

| Rol               | Cine este?                                    | Ce face pe scurt?                                |
| ----------------- | --------------------------------------------- | ------------------------------------------------ |
| **SUPER_ADMIN**   | Proprietarul platformei TMS                   | Controlează toate companiile din sistem          |
| **COMPANY_ADMIN** | Directorul / proprietarul firmei de transport | Controlează tot ce ține de firma sa              |
| **DISPATCHER**    | Dispecerul firmei                             | Creează și gestionează transporturi              |
| **DRIVER**        | Șoferul                                       | Vede transporturile lui și actualizează statusul |
| **ACCOUNTANT**    | Contabilul                                    | Gestionează facturi, cheltuieli, plăți           |
| **FLEET_MANAGER** | Managerul de flotă                            | Gestionează camioane, remorci, mentenanță        |
| **CUSTOMER**      | Un client al firmei                           | Poate vedea transporturile lui (acces limitat)   |

---

## 4. SUPER ADMIN

### Pagina de start: `/dashboard`

Super Admin-ul are acces **la tot**, inclusiv la companiile altor clienți.

### Ce poate face:

#### 🏢 Gestionare companii — `/admin/company`

Vede o grilă cu **toate companiile** înregistrate în platformă.

**Butoane disponibile:**

- **"New Company"** — creează o companie nouă (client nou al platformei)
  - Completează: Nume, CIF/VAT, Reg. Com., Adresă, Telefon, Email, Website, Bancă, IBAN, Prefix facturi, Monedă, TVA, Fusul orar
- **Apasă pe o companie** → deschide formularul de editare al acelei companii

#### 👥 Gestionare utilizatori — `/admin/users`

Vede toți utilizatorii din sistem.

**Butoane disponibile:**

- **"New User"** — creează un utilizator nou
  - Completează: Nume, Email, Parolă temporară, Rol, Telefon
- **Editare** (creion) — modifică datele unui utilizator
- **Activare/Dezactivare** — blochează accesul unui utilizator fără să îl șteargă
- **Reset parolă** — trimite email cu link de resetare
- **Ștergere** — șterge utilizatorul (nu îți poți șterge propriul cont)

#### 🔍 Jurnal de audit — `/admin/audit`

Vede **tot ce s-a întâmplat** în aplicație: cine a creat ce, cine a schimbat ce, de pe ce IP.

- Filtrare după tip de acțiune și tip de entitate
- Fiecare rând arată: Data/ora, Utilizatorul, Acțiunea, Entitatea modificată, IP-ul

#### 🔔 Notificări — `/admin/notifications`

Inbox personal cu notificări sistem:

- **"Mark All Read"** — marchează toate ca citite
- **"Mark as Read"** per notificare
- **"Delete"** per notificare

#### ⚙️ Setări personale — `/settings`

- Schimbă **Numele**, **Emailul**, **Telefonul**
- Schimbă **Parola** (trebuie să știi parola curentă)

---

## 5. COMPANY ADMIN — Administrator de companie

### Pagina de start: `/dashboard`

Company Admin-ul are control complet **asupra firmei sale**.

### 📊 Dashboard principal — `/dashboard`

O privire de ansamblu a firmei:

**Carduri cu statistici (rândul 1):**

- 🚛 **Active Loads** — câte transporturi sunt în desfășurare acum
- ✅ **Completed Loads** — câte transporturi s-au finalizat luna aceasta
- 🚚 **Available Trucks** — câte camioane sunt disponibile
- 👤 **Available Drivers** — câți șoferi sunt disponibili

**Carduri cu statistici (rândul 2):**

- 💰 **Monthly Revenue** — veniturile din facturi emise luna aceasta
- 💸 **Monthly Expenses** — cheltuielile aprobate luna aceasta
- 📈 **Estimated Profit** — diferența (venituri - cheltuieli)
- ⚠️ **Documents Expiring** — câte documente (asigurări, ITP etc.) expiră în 30 de zile

**Tabel:** Ultimele 8 transporturi cu: Număr referință, Client, Rută, Șofer, Status, Preț

---

### 🚛 Transporturi (Dispatch)

#### Lista transporturi — `/dispatch/loads`

Vede toate transporturile firmei.

**Filtre disponibile:**

- Căutare liberă (după număr referință, oraș pickup, oraș livrare)
- Filtrare după **Status** (Draft / Assigned / In Transit / Delivered etc.)

**Butoane:**

- **"New Load"** → creează un transport nou
- **"View Kanban →"** → vede transporturile ca tablă Kanban
- **"Live Map →"** → harta cu pozițiile șoferilor în timp real

**Pe fiecare rând:**

- Apasă **numărul referinței** → pagina de detalii a transportului

---

#### Creare transport nou — `/dispatch/loads/new`

**Câmpuri de completat:**

📍 **Pickup (Ridicare):**

- Adresă completă, Oraș, Țara, Data și ora, Note (ex: "Sunați înainte")
- Coordonate GPS (opțional)

📍 **Delivery (Livrare):**

- Adresă completă, Oraș, Țara, Data și ora, Note
- Coordonate GPS (opțional)

📦 **Marfa:**

- Descriere, Greutate (kg), Volum (m³), Număr colete
- Marfă periculoasă? (bifă), Temperatură necesară (ex: "+2/+6")

💵 **Prețul:** suma + moneda (EUR/RON/USD)

🚚 **Atribuire (opțional):**

- Client (alege din lista de clienți)
- Șofer (alege din lista de șoferi disponibili)
- Camion, Remorcă

**Buton:** **"Create Load"** → salvează și redirectează la pagina de detalii

---

#### Detalii transport — `/dispatch/loads/[id]`

Pagina completă a unui transport.

**Butoane disponibile:**

- **"Edit"** → formularul de editare (modifică orice câmp)
- **"Assign"** → dialog pentru a atribui/schimba Șofer, Camion, Remorcă
- **"Update Status"** → avansează statusul la pasul următor (sau ADMIN poate forța orice status)
- **"Issue Invoice"** → apare după ce transportul e DELIVERED și nu are factură → redirecționează la crearea facturii
- **"Invoice #..."** → apare dacă există factură → redirecționează la factura respectivă

**Secțiuni vizibile:**

- Status curent + Prețul transportului
- Card Pickup (adresă, dată, note)
- Card Delivery (adresă, dată, note)
- Card Marfă (descriere, greutate, volum)
- Card Atribuire (șofer + telefon, camion + număr, remorcă + număr, dispecer)
- **Istoricul statusurilor** — timeline cu fiecare schimbare de status: cine a schimbat, când, de la ce la ce
- **Documente** — fișiere atașate (CMR, BOL, POD etc.) cu buton de upload

---

#### Cockpit Kanban — `/dispatch/cockpit`

O **tablă Kanban** vizuală cu 6 coloane. Fiecare coloană = o etapă a transportului.

| Coloana             | Statusuri incluse               |
| ------------------- | ------------------------------- |
| Backlog             | DRAFT                           |
| Assigned            | ASSIGNED, DRIVER_ACCEPTED       |
| En Route to Pickup  | ON_WAY_TO_PICKUP, AT_PICKUP     |
| Loaded / In Transit | LOADED, IN_TRANSIT, AT_DELIVERY |
| Delivered / POD     | DELIVERED, POD_UPLOADED         |
| Invoiced / Paid     | INVOICED, PAID                  |

**Cum funcționează Drag & Drop:**

1. Prinzi un card de transport (click lung)
2. Tragi în coloana dorită
3. Dai drumul → statusul se actualizează automat în baza de date
4. O notificare verde confirmă că s-a salvat

Fiecare card arată: Număr referință, Rută, Data pickup, Client, Șofer + Camion, Prețul

---

#### Harta live — `/dispatch/map`

O hartă Mapbox cu toți șoferii care au trimis poziție GPS recent.

- **Punct albastru** = poziția unui șofer
- **Apasă pe punct** → popup cu numele șoferului, statusul, ultima actualizare
- **Harta centrată** pe SUA (zona de operare)

**Zone colorate (puse de șoferi):**

- 🟢 Verde = zonă OK
- 🟡 Galben = atenție, condiții dificile
- 🔴 Roșu = evitați zona

---

### 👥 Clienți — `/customers`

Lista tuturor clienților firmei.

**Filtrare:** Căutare după Nume, CIF, Email, Oraș

**Pe fiecare rând:** Nume + Oraș, CIF, Persoana de contact + Email, Termene de plată (zile), Limită credit, Nr. transporturi, Nr. facturi

**Butoane:**

- **"New Customer"** → dialog cu câmpuri:
  - Nume companie, Persoana de contact, Email, Telefon
  - CIF (Tax ID), Număr Reg. Com.
  - Adresă (Stradă, Oraș, Județ, Cod poștal, Țara)
  - Termene de plată (nr. zile), Limită credit, Note interne
- **Editare** (creion) per rând
- **Ștergere** per rând (cu confirmare)

---

### 🚗 Flotă

#### Camioane — `/fleet/trucks`

Lista tuturor camioanelor.

**Filtre:** Căutare (număr înmatriculare, VIN, marcă, model), Status

**Pe fiecare rând:** Număr înmatriculare (link), Marcă + Model + VIN, An + Km parcurși, Data celei mai aproape expirări de documente (roșu=expirat, portocaliu=≤30 zile), Status

**Butoane:**

- **"New Truck"** → dialog:
  - Număr înmatriculare, VIN, Marcă, Model, An, Culoare
  - Km actuali, Tip combustibil, Consum mediu (L/100km)
  - Data expirare: Asigurare RCA, ITP, Rovinietă, Tahograf
  - Note
- **Editare** per rând
- **Ștergere** per rând

**Apasă pe numărul de înmatriculare** → pagina de detalii a camionului cu documente atașate

---

#### Remorci — `/fleet/trailers`

Lista tuturor remorcilor.

**Butoane:**

- **"New Trailer"** → dialog:
  - Număr înmatriculare, Tip (Prelată/Frigorifică/Platformă/etc.)
  - Capacitate kg, Volum m³, Număr osii, Anul fabricației
  - Data expirare: Asigurare, ITP
  - Note
- **Editare**, **Ștergere** per rând

---

#### Mentenanță — `/fleet/maintenance`

Lista lucrărilor de service planificate sau efectuate.

**Filtrare:** Status (Programat / În desfășurare / Finalizat / Anulat)

**Pe fiecare rând:** Vehicul (camion sau remorcă), Titlu lucrare + piese înlocuite, Data programată (roșu dacă a trecut), Data finalizării, Cost, Status

**Butoane:**

- **"Add Maintenance"** → dialog:
  - Vehicul (Camion sau Remorcă) — selectezi din liste
  - Titlu (ex: "Schimb ulei"), Descriere
  - Data programată, Status curent
  - Cost + Monedă, Km la care se face
  - Piese înlocuite (tags), Note, Document URL
- **Ștergere** per rând

---

### 💰 Contabilitate

#### Dashboard financiar — `/accounting/dashboard`

Privire de ansamblu financiară:

- **Invoiced (luna)** — total facturi emise luna aceasta
- **Collected (luna)** — total sume încasate luna aceasta
- **Overdue** — total neîncasat după termenul scadent
- **Expenses (luna)** — cheltuieli aprobate + combustibil luna aceasta

Tabel cu ultimele 5 facturi.

---

#### Facturi — `/accounting/invoices`

Lista completă a facturilor.

**Carduri KPI la top:**

- Total facturat, Încasat, Restanță, Nr. facturi restante

**Filtre:** Status (Toate / Draft / Trimisă / Plătită / Restantă / Anulată), Căutare (număr factură sau client)

**Butoane:**

- **"New Invoice"** → `/accounting/invoices/new`

**Pe fiecare factură:**

- Număr, Client, Data emisiei, Data scadentă, Total, Plătit, Status
- Apasă **numărul** → pagina de detalii

---

#### Detalii factură — `/accounting/invoices/[id]`

Pagina completă a unei facturi.

**Informații afișate:**

- Număr factură, Status (badge colorat)
- Data emisiei, Data scadentă
- Datele clientului (Nume, CIF)
- Transport asociat (dacă există)
- **Tabel linii factură:** Descriere, Cantitate, Preț unitar, Total
- Subtotal, TVA, Total
- Suma plătită, Suma rămasă (în roșu dacă e restantă)
- **Istoric plăți** — fiecare plată cu sumă, metodă, dată, referință

**Butoane:**

- **"PDF"** → deschide factura ca PDF în tab nou (format profesional, cu antet firmă)
- **"Edit"** → formularul de editare
- **"Status"** → schimbi statusul (DRAFT → SENT → PAID / OVERDUE / CANCELLED)
- **"Record Payment"** → dialog pentru înregistrarea unei plăți primite:
  - Suma, Moneda, Metoda (transfer bancar / numerar / card), Referință, Note, Data
  - Apare doar dacă mai există de plătit
- **"Delete"** → șterge factura (cu confirmare)

---

#### Cheltuieli — `/accounting/expenses`

Toate cheltuielile firmei.

**Filtre:** Tip (Combustibil/Taxă de drum/Parcare/Reparație/Salariu/Comision/Asigurare/Altele), Status (În așteptare/Aprobat/Respins)

**Butoane:**

- **"Add Expense"** → dialog:
  - Tip, Sumă, Monedă, Descriere, Data
  - Asociere opțională: Transport, Camion, Șofer
  - URL chitanță (poza chitanței)
- **Approve** / **Reject** per cheltuială (vizibil pentru ACCOUNTANT și ADMIN)
- **Delete** per cheltuială

---

#### Combustibil — `/accounting/fuel`

Jurnalul alimentărilor cu combustibil.

**Statistici header:**

- Total înregistrări, Total litri, Cost total, Preț mediu/litru

**Filtrare:** după Camion

**Butoane:**

- **"Add Fuel"** → dialog:
  - Camion, Șofer, Transport asociat
  - Litri alimentați, Preț/litru, Stație (OMV/Petrom/Rompetrol/MOL/Shell)
  - Km la bord, URL chitanță, Data
- **Ștergere** per înregistrare

---

### 📊 Rapoarte — `/reports`

Dashboard analitic complet al firmei.

**Carduri KPI (an curent):**

- 💰 Total facturat (an)
- ✅ Total încasat (an)
- 🚛 Transporturi create (ultimele 30 zile)
- 🚚 Flotă + cheltuieli totale an

**5 grafice interactive:**

| Nr. | Grafic                    | Ce arată                                                              |
| --- | ------------------------- | --------------------------------------------------------------------- |
| 1   | **Invoiced vs Collected** | Bare pe luni — cât s-a facturat vs cât s-a încasat (ultimele 12 luni) |
| 2   | **Loads by Status**       | Distribuția transporturilor pe statusuri (ultimele 30 zile)           |
| 3   | **Daily Loads**           | Câte transporturi au fost create zilnic (ultimele 30 zile)            |
| 4   | **Expenses by Category**  | Cheltuieli împărțite pe categorii (an curent, aprobate)               |
| 5   | **Fuel by Month**         | Litri + cost combustibil pe luni (ultimele 12 luni)                   |

**Buton:**

- **"Export PDF"** → descarcă un raport PDF complet al firmei

---

### ⚙️ Setări — `/settings`

Pagina de setări personale + companie.

**Secțiunea 1 — Profil:**

- Modifică: Numele, Emailul, Telefonul
- Buton: **"Save Profile"**

**Secțiunea 2 — Schimbare parolă:**

- Câmpuri: Parola curentă, Parola nouă, Confirmare parolă nouă
- Buton: **"Change Password"**

**Secțiunea 3 — Companie** _(doar ADMIN)_:

- Toate datele firmei: Nume, CIF, Reg. Com., Adresă, Telefon, Email, Website
- Date bancare: Bancă, IBAN
- Configurare facturare: Prefix factură (ex: `STR`), Monedă implicită, TVA %
- Configurare regională: Fusul orar, Localizare (limbă)
- Buton: **"Save Company"**

---

### 🔔 Notificări — `/admin/notifications`

Inbox cu notificările sistemului (pentru orice utilizator).

**Tipuri de notificări:**

- 📄 **DOCUMENT_EXPIRING** — un document (ITP, asigurare) expiră în curând
- 🚛 **LOAD_UPDATE** — un transport a fost actualizat
- 💰 **INVOICE_DUE** — o factură e aproape de scadență
- 🔧 **MAINTENANCE** — mentenanță programată
- ℹ️ **INFO / WARNING / ERROR / SUCCESS** — diverse notificări sistem

**Butoane:**

- **"Mark All Read"** — marchează tot ca citit
- **"Mark as Read"** per notificare
- **"Delete"** per notificare

---

## 6. DISPATCHER — Dispecer

Dispecerul are acces la tot ce ține de **transport și clienți**, dar NU la finanțe sau administrare.

### Ce poate face:

✅ **Poate:**

- Crea, edita, șterge transporturi
- Atribui șoferi, camioane, remorci la transporturi
- Actualiza statusul transporturilor
- Vedea harta live cu pozițiile șoferilor
- Folosi Kanban cockpit (drag & drop)
- Crea și edita clienți
- Vedea cheltuielile (nu le poate aproba)
- Vedea facturile (nu le poate crea/edita)
- Vedea rapoartele
- Adăuga intrări de combustibil

❌ **Nu poate:**

- Crea/edita facturi sau înregistra plăți
- Aproba sau respinge cheltuieli
- Crea/edita utilizatori
- Crea/edita camioane sau remorci
- Vedea jurnalul de audit
- Edita datele companiei

### Pagini accesibile:

- `/dashboard` — overview general
- `/dispatch/loads` — toate transporturile
- `/dispatch/cockpit` — Kanban
- `/dispatch/map` — harta live
- `/customers` — clienți (citire + creare)
- `/accounting/expenses` — cheltuieli (citire)
- `/accounting/fuel` — combustibil (adăugare)
- `/reports` — rapoarte
- `/admin/notifications` — notificări
- `/settings` — setări personale

---

## 7. DRIVER — Șofer

Șoferul are **cel mai simplu** dashboard, optimizat pentru folosit pe telefon.

### Pagina de start: `/driver/dashboard`

#### 👋 Salut personalizat

"Hello, [Prenume]!" + statusul curent (AVAILABLE / ON_TRIP / OFF_DUTY)

#### 📊 Carduri rapide

- **Active Load** — câte transporturi active are
- **To Accept** — câte transporturi i-au fost atribuite și nu le-a acceptat încă

#### 🚛 Transportul activ

Dacă are un transport în desfășurare, vede un card mare cu:

- Numărul referinței
- Clientul
- **Pickup:** adresă, oraș, țara, data, coordonate GPS
- **Delivery:** adresă, oraș, țara, data, coordonate GPS
- Descrierea mărfii + greutate
- Buton **"Call client"** → apelează telefonul clientului direct
- Buton **"Update Status"** → actualizează statusul transportului la pasul următor
- Buton **"Details"** → pagina completă a transportului

#### ✅ Transporturi de acceptat

Dacă i-au fost atribuite transporturi noi (status = ASSIGNED):

- Vede fiecare transport cu ruta și data
- Buton **"Accept"** → schimbă statusul la DRIVER_ACCEPTED

#### 📋 Transporturi anterioare

Ultimele 5 transporturi finalizate (Delivered / Invoiced / Paid) — vizualizare rapidă

#### 🗺️ Harta de zone — (componenta DriverZoneMap)

O hartă Mapbox interactivă unde șoferul poate marca condiții de pe rută:

**Cum funcționează:**

1. Apasă o dată pe hartă → creează un **pin verde** 🟢 (zonă OK)
2. Apasă pe pinul verde → devine **galben** 🟡 (atenție)
3. Apasă pe pinul galben → devine **roșu** 🔴 (evitați)
4. Apasă pe pinul roșu → **se șterge**

Pinurile sunt vizibile și dispecerilor pe harta live (`/dispatch/map`).

**Butoane pe hartă:**

- **"Clear all"** → șterge toate pinurile proprii
- **Legendă** la baza hărții: Verde = OK, Galben = Atenție, Roșu = Pericol/Evitare

#### 📡 GPS automat (în fundal)

Când are un transport activ, aplicația trimite automat poziția GPS la server la fiecare 30 de secunde (fără ca șoferul să facă ceva).

---

### Statusurile unui transport (ordinea corectă):

```
DRAFT → ASSIGNED → DRIVER_ACCEPTED → ON_WAY_TO_PICKUP → AT_PICKUP
→ LOADED → IN_TRANSIT → AT_DELIVERY → DELIVERED → POD_UPLOADED
→ INVOICED → PAID
```

**Ce schimbă șoferul:**

- `ASSIGNED` → `DRIVER_ACCEPTED` (apasă Accept)
- `DRIVER_ACCEPTED` → `ON_WAY_TO_PICKUP` (a plecat spre pickup)
- `ON_WAY_TO_PICKUP` → `AT_PICKUP` (a ajuns la pickup)
- `AT_PICKUP` → `LOADED` (marfa a fost încărcată)
- `LOADED` → `IN_TRANSIT` (a plecat spre livrare)
- `IN_TRANSIT` → `AT_DELIVERY` (a ajuns la livrare)
- `AT_DELIVERY` → `DELIVERED` (marfa a fost livrată)
- `DELIVERED` → `POD_UPLOADED` (a încărcat dovada livrării)

---

## 8. ACCOUNTANT — Contabil

Contabilul se ocupă exclusiv de **financiar**.

### Ce poate face:

✅ **Poate:**

- Vedea și crea facturi
- Schimba statusul facturilor (DRAFT → SENT → PAID etc.)
- Înregistra plăți primite
- Descărca facturi ca PDF
- Vedea, aproba sau respinge cheltuieli
- Adăuga intrări de combustibil
- Vedea rapoartele financiare
- Vedea clienții (fără editare)
- Vedea transporturile (fără editare)

❌ **Nu poate:**

- Crea sau edita transporturi
- Crea sau edita utilizatori, camioane, remorci, șoferi
- Vedea jurnalul de audit
- Edita datele companiei

### Pagini accesibile:

- `/accounting/dashboard` — dashboard financiar (pagina de start)
- `/accounting/invoices` — toate facturile
- `/accounting/expenses` — toate cheltuielile (cu aprobare)
- `/accounting/fuel` — înregistrări combustibil
- `/customers` — clienți (citire)
- `/dispatch/loads` — transporturi (citire)
- `/reports` — rapoarte
- `/admin/notifications` — notificări
- `/settings` — setări personale

---

## 9. FLEET MANAGER — Manager flotă

Fleet Manager-ul se ocupă exclusiv de **vehicule și mentenanță**.

### Ce poate face:

✅ **Poate:**

- Crea, edita, șterge camioane
- Crea, edita, șterge remorci
- Crea, edita, șterge lucrări de mentenanță
- Vedea și edita profiluri de șoferi
- Vedea transporturile (fără editare)
- Vedea rapoartele
- Gestiona documentele vehiculelor (ITP, asigurare, rovinietă, tahograf)

❌ **Nu poate:**

- Crea sau edita transporturi
- Gestiona facturi sau cheltuieli
- Crea sau edita utilizatori
- Vedea jurnalul de audit
- Edita datele companiei

### Pagini accesibile:

- `/fleet/trucks` — camioane (pagina de start)
- `/fleet/trailers` — remorci
- `/fleet/maintenance` — mentenanță
- `/admin/drivers` — șoferi (citire + editare profil)
- `/dispatch/loads` — transporturi (citire)
- `/reports` — rapoarte
- `/admin/notifications` — notificări
- `/settings` — setări personale

---

## 10. Fluxul complet al unui transport

Iată cum funcționează un transport de la zero până la plată:

### Pasul 1 — DRAFT (Dispecer creează transportul)

- Dispecerul apasă **"New Load"** pe `/dispatch/loads`
- Completează: adresa de pickup, adresa de livrare, data, marfa, prețul, clientul
- Salvează → transportul e în **DRAFT**

### Pasul 2 — ASSIGNED (Dispecer atribuie șoferul)

- Dispecerul apasă **"Assign"** pe pagina transportului
- Alege Șoferul + Camionul + Remorca
- Salvează → statusul devine **ASSIGNED**
- Șoferul primește o notificare

### Pasul 3 — DRIVER_ACCEPTED (Șoferul acceptă)

- Șoferul vede transportul în dashboard-ul lui sub "To Accept"
- Apasă **"Accept"** → statusul devine **DRIVER_ACCEPTED**

### Pasul 4 → 9 — Șoferul actualizează pe parcurs

| Status           | Când?                            |
| ---------------- | -------------------------------- |
| ON_WAY_TO_PICKUP | A plecat spre locul de încărcare |
| AT_PICKUP        | A ajuns la locul de încărcare    |
| LOADED           | Marfa a fost încărcată în camion |
| IN_TRANSIT       | A plecat spre destinație         |
| AT_DELIVERY      | A ajuns la destinație            |
| DELIVERED        | Marfa a fost predată clientului  |

### Pasul 10 — POD_UPLOADED (Dovada livrării)

- Șoferul sau dispecerul încarcă un document (POD = Proof of Delivery)
- De obicei, o poză cu semnătura de primire (CMR)
- Statusul devine **POD_UPLOADED**

### Pasul 11 — INVOICED (Contabilul emite factura)

- Pe pagina transportului apare butonul **"Issue Invoice"**
- Dispecerul sau Contabilul apasă → completează factura
- Contabilul trimite factura clientului (status SENT)
- Statusul transportului devine **INVOICED**

### Pasul 12 — PAID (Clientul plătește)

- Contabilul înregistrează plata primită (buton "Record Payment")
- Statusul facturii devine **PAID**
- Statusul transportului devine **PAID** ✅

---

## 11. Glosar de termeni

| Termen            | Explicație                                                          |
| ----------------- | ------------------------------------------------------------------- |
| **Load**          | Un transport (o cursă de la A la B)                                 |
| **Pickup**        | Locul de unde se ridică marfa                                       |
| **Delivery**      | Locul unde se livrează marfa                                        |
| **CMR**           | Document internațional de transport rutier (scrisoare de trăsură)   |
| **BOL**           | Bill of Lading — document de expediere                              |
| **POD**           | Proof of Delivery — dovada că marfa a fost livrată                  |
| **ITP**           | Inspecție Tehnică Periodică                                         |
| **Rovinietă**     | Taxă de drum (vignette)                                             |
| **Tahograf**      | Aparat care înregistrează viteza și timpii de condus ai șoferului   |
| **IBAN**          | Codul bancar internațional al unui cont                             |
| **CIF / VAT**     | Codul de identificare fiscală al unei firme                         |
| **Reg. Com.**     | Numărul de înregistrare la Registrul Comerțului (ex: J40/1234/2020) |
| **GPS**           | Sistem de localizare globală — coordonate lat/lng                   |
| **Kanban**        | Metodă vizuală de organizare a sarcinilor pe coloane                |
| **Drag & Drop**   | Tragi cu mouse-ul un element dintr-un loc în altul                  |
| **Draft**         | Schiță — transportul sau factura nu e finalizată încă               |
| **SUPER_ADMIN**   | Administratorul întregii platforme TMS (nu al unei firme)           |
| **COMPANY_ADMIN** | Directorul/proprietarul unei firme de transport                     |
| **Dispatcher**    | Dispecerul — coordonează transporturile și șoferii                  |
| **Fleet**         | Flota — ansamblul de vehicule (camioane + remorci)                  |
| **MapZonePin**    | Pinul pe hartă pus de șofer pentru a marca condiții de zonă         |
| **Audit Log**     | Jurnal cu toate acțiunile din sistem (cine a făcut ce și când)      |
| **Trial**         | Perioadă de probă gratuită (30 de zile la înregistrare)             |
| **Monedă**        | EUR = Euro, RON = Leu românesc, USD = Dolar american                |

---

_Documentație generată pentru TMS v1.0 — Mai 2026_  
_Toate drepturile rezervate SohoTrans / TMS Platform_
