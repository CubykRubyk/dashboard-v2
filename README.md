# Damaschin CRM v2

Noua versiune a aplicației pentru fișe de șantier și generarea documentelor.
Proiectul este separat de aplicația existentă și folosește Next.js, PostgreSQL
și Prisma.

## Dezvoltare

Runtime-ul local recomandat este Node.js 22. Copiază `.env.example` în `.env`
și înlocuiește toate valorile demonstrative.

```bash
npm ci
docker compose up -d database
npm run db:deploy
npm run db:seed
npm run dev
```

Aplicația este disponibilă implicit la `http://localhost:3000`.

## Comenzi

- `npm run lint` — verifică stilul și problemele statice;
- `npm run build` — creează build-ul de producție;
- `npm run db:generate` — generează clientul Prisma;
- `npm run db:migrate` — creează migrații în dezvoltare;
- `npm run db:deploy` — aplică migrațiile existente;
- `npm run db:seed` — creează sau actualizează administratorul din `.env`.

## Deployment

Containerul aplicației ascultă doar pe `127.0.0.1:3001`, în spatele unui
reverse proxy cu HTTPS. PostgreSQL este disponibil local pe portul `5433`
pentru administrare, dar nu este expus în internet.

Înainte de pornirea unei versiuni noi:

1. realizează backup-ul bazei și al volumului de documente;
2. construiește imaginea;
3. rulează `npm run db:deploy` într-un container cu acces la baza de date;
4. pornește aplicația;
5. verifică loginul și pagina principală.

Nu salva fișiere `.env`, parole sau chei API în Git.

Storage-ul persistent pentru documentele tehnice PAC, verificările de transfer
și procedura de rollback sunt descrise în
[`docs/pac-document-storage.md`](docs/pac-document-storage.md).
