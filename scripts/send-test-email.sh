#!/bin/bash
# Test-E-Mail von Server senden (ohne Authentication)
# Verwendung: bash scripts/send-test-email.sh [email]

EMAIL="${1:-jagadi@web.de}"

echo "Sende Test-E-Mail an: $EMAIL"
echo ""

docker compose exec -T backend sh -c "
  cd /app &&
  node -e \"
    import('dotenv').then(({config}) => config());
    import('./dist/services/email.js').then(({sendMail}) => {
      sendMail({
        to: '$EMAIL',
        subject: 'Moving Dinner - Test vom Server',
        body: 'Hallo!\\n\\nDas ist eine Test-E-Mail von deinem Moving Dinner Server.\\n\\nWenn du das liest, funktioniert der E-Mail-Versand! 🎉\\n\\nGesendet an: $EMAIL\\nZeit: ' + new Date().toLocaleString('de-DE') + '\\n\\nViele Grüße,\\nMoving Dinner'
      }).then(success => {
        console.log(success ? '✓ E-Mail erfolgreich gesendet!' : '✗ E-Mail fehlgeschlagen');
        process.exit(success ? 0 : 1);
      });
    });
  \"
"

echo ""
echo "Fertig! Prüfe dein Postfach."
