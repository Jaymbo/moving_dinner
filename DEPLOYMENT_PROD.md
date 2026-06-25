# Production Deployment - E-Mail Versand aktivieren

## Problem
Die `backend/src/config.ts` wurde angepasst, um sowohl `.env.local` (für DATABASE_URL) als auch `.env` (für SMTP) zu laden. Diese Änderung muss auf das Produktivsystem deployed werden.

## Schritte für Production

### 1. Code auf Server aktualisieren
```bash
# Auf dem Production-Server
cd ~/moving_dinner
git pull
```

### 2. .env Datei prüfen
Stelle sicher, dass folgende Werte in `.env` gesetzt sind (Beispiel für Brevo):
```bash
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<DEIN_BREVO_USER>
SMTP_PASS=<DEIN_BREVO_PASS>
SMTP_FROM='Moving Dinner <info@deine-domain.de>'
BASE_URL=https://deine-domain.de
NODE_ENV=production
JWT_SECRET=<DEIN_JWT_SECRET>
DATABASE_URL=postgresql://movingdinner:<DEIN_DB_PASSWORT>@db:5432/movingdinner?schema=public
POSTGRES_PASSWORD=<DEIN_DB_PASSWORT>
```

**Wichtig:** Die `.env` auf Production hat bereits die korrekten Werte. Nicht ändern, nur prüfen!

**Wichtig:** Die `.env` auf Production hat bereits ein `POSTGRES_PASSWORD` und `DATABASE_URL`. Diese müssen nicht geändert werden, nur prüfen ob sie korrekt sind.

### 3. Docker Container neu bauen
```bash
cd ~/moving_dinner
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 4. Health Check prüfen
```bash
# Logs ansehen
docker compose logs backend

# Backend Health Check
curl http://localhost:3002/api/health

# Container Status
docker compose ps
```

### 5. E-Mail Versand testen
Test-E-Mail manuell auslösen über die Admin-Routes oder:
```bash
# Im Backend Container
docker compose exec backend sh -c "
  cd /app &&
  node -e \"
    import('dotenv').then(({config}) => config());
    import('./dist/services/email.js').then(({sendMail}) => {
      sendMail({
        to: 'jagadi@web.de',
        subject: 'Production Test',
        body: 'E-Mail Versand funktioniert!'
      }).then(console.log);
    });
  \"
"
```

## Alternative: Nur Config ändern ohne Git

Falls du Git nicht verwenden möchtest:

### 1. Config Datei direkt auf Server bearbeiten
```bash
# Auf dem Server
cd ~/moving_dinner/backend/src
nano config.ts
```

Füge diese Zeilen am Anfang ein (vor `dotenv.config()`):
```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lade zuerst .env.local für DATABASE_URL, dann ../.env für andere Werte
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
```

### 2. .env.local auf Server erstellen
```bash
cd ~/moving_dinner/backend
echo "DATABASE_URL=postgresql://movingdinner:<DEIN_DB_PASSWORT>@db:5432/movingdinner?schema=public" > .env.local
chmod 600 .env.local
```

### 3. Container neu starten
```bash
cd ~/moving_dinner
docker compose restart backend
```

## Wichtige Hinweise

1. **.env Datei ist kritisch**: Sie enthält alle Secrets. Nicht committen!
2. **DATABASE_URL**: Auf Production zeigt sie auf den Docker-Service `db`, nicht auf `localhost`
3. **Backup**: Vor Änderungen immer Backup machen:
   ```bash
   ./backup.sh
   ```

## Troubleshooting

### Backend startet nicht
```bash
docker compose logs backend | tail -50
```

Häufige Fehler:
- `Missing required environment variable: DATABASE_URL` → `.env` oder `.env.local` prüfen
- `JWT_SECRET must be at least 32 characters` → JWT_SECRET in `.env` prüfen

### E-Mails werden nicht gesendet
```bash
docker compose logs backend | grep -i "email\|smtp"
```

Prüfe:
- SMTP credentials in `.env` korrekt
- Firewall blockiert Port 587 nicht
- Brevo Account ist aktiv

### Database Connection Failed
```bash
docker compose logs db | tail -20
docker compose logs backend | grep -i "database"
```
