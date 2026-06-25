import React from 'react';
import { Link } from 'react-router-dom';

export default function DatenschutzPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <Link to="/" className="legal-back-link">
            ← Zurück zur Startseite
          </Link>
        </div>

        <h1>Datenschutzerklärung</h1>

        <section className="legal-section">
          <h2>1. Datenschutz auf einen Blick</h2>
          <div className="legal-content">
            <h3>Allgemeine Hinweise</h3>
            <p>
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren 
              personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene 
              Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
            </p>

            <h3>Datenerfassung auf dieser Website</h3>
            <p>
              <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong>
            </p>
            <p>
              Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. 
              Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
            </p>
            <p>
              <strong>Wie erfassen wir Ihre Daten?</strong>
            </p>
            <p>
              Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. 
              Hierbei kann es sich z. B. um Daten handeln, die Sie in ein Registrierungsformular 
              eingeben. Andere Daten werden automatisch beim Besuch der Website durch unsere 
              IT-Systeme erfasst. Das sind vor allem technische Daten (z. B. Internetbrowser, 
              Betriebssystem oder Uhrzeit des Seitenaufrufs).
            </p>
            <p>
              <strong>Wofür nutzen wir Ihre Daten?</strong>
            </p>
            <p>
              Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website 
              zu gewährleisten. Andere Daten werden zur Organisation der Dinner-Events verwendet 
              (Gruppenzuordnung, Host-Zuweisung, Benachrichtigungen).
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>2. Hosting</h2>
          <div className="legal-content">
            <p>
              Diese Website wird auf einem Server gehostet. Die personenbezogenen Daten, die auf 
              dieser Website verarbeitet werden, werden auf diesem Server gespeichert.
            </p>
            <p>
              <strong>Server-Log-Dateien:</strong> Der Provider der Seiten erhebt und speichert 
              automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser 
              automatisch an uns übermittelt. Dies sind:
            </p>
            <ul>
              <li>Browsertyp und Browserversion</li>
              <li>Verwendetes Betriebssystem</li>
              <li>Referrer URL (die zuvor besuchte Seite)</li>
              <li>Hostname des zugreifenden Rechners</li>
              <li>Uhrzeit der Serveranfrage</li>
              <li>IP-Adresse</li>
            </ul>
            <p>
              Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
          <div className="legal-content">
            <h3>Datenschutz</h3>
            <p>
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. 
              Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der 
              gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
            </p>
            <p>
              Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. 
              Personenbezogene Daten sind Daten, mit denen Sie persönlich identifiziert werden 
              können. Die vorliegende Datenschutzerklärung erläutert, welche Daten wir erheben 
              und wofür wir sie nutzen. Sie erläutert auch, wie und zu welchem Zweck das geschieht.
            </p>
            <p>
              Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der 
              Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser 
              Schutz der Daten vor dem Zugriff durch Dritte ist nicht möglich.
            </p>

            <h3>Hinweis zur verantwortlichen Stelle</h3>
            <p>
              Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
            </p>
            <p>
              Dietrich<br />
              79117 Freiburg<br />
              E-Mail: [Deine E-Mail-Adresse]
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              Aus Datenschutzgründen wird hier nur der Vorname und der Ort angegeben. 
              Die vollständige Anschrift wird auf Anfrage mitgeteilt.
            </p>
            <p>
              Verantwortliche Stelle ist die natürliche oder juristische Person, die allein 
              oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von 
              personenbezogenen Daten (z. B. Namen, E-Mail-Adressen o. Ä.) entscheidet.
            </p>

            <h3>Speicherdauer</h3>
            <p>
              Ihre personenbezogenen Daten werden solange gespeichert, wie Sie auf der Plattform 
              registriert sind. Nach Löschung Ihres Kontos werden Ihre Daten gelöscht, sofern keine 
              gesetzlichen Aufbewahrungspflichten entgegenstehen.
            </p>

            <h3>Rechtsgrundlagen der Datenverarbeitung</h3>
            <p>
              Die Datenverarbeitung erfolgt auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) 
              und zur Erfüllung eines Vertrags (Art. 6 Abs. 1 lit. b DSGVO), da die Nutzung der Plattform 
              auf einem Nutzungsverhältnis beruht.
            </p>

            <h3>Ihre Rechte</h3>
            <p>
              Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger 
              und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben 
              außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. 
              Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese 
              Einwilligung jederzeit für die Zukunft widerrufen. Außerdem haben Sie das Recht, 
              unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer personenbezogenen 
              Daten zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen 
              Aufsichtsbehörde zu.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>4. Datenerfassung auf dieser Website</h2>
          <div className="legal-content">
            <h3>Cookies</h3>
            <p>
              Unsere Internetseiten verwenden so genannte "Cookies". Cookies sind kleine 
              Textdateien und richten auf Ihrem Endgerät keinen Schaden an. Sie werden 
              entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder 
              dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.
            </p>
            <p>
              <strong>Notwendige Cookies:</strong> Diese Cookies sind für die Funktion der 
              Website unbedingt erforderlich (z. B. Login-Session). Sie werden auf Grundlage 
              von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) gespeichert.
            </p>
            <p>
              Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies 
              informiert werden und Cookies nur im Einzelfall erlauben oder generell ausschließen. 
              Bei der Deaktivierung von Cookies kann die Funktionalität dieser Website eingeschränkt sein.
            </p>

            <h3>Registrierung auf dieser Website</h3>
            <p>
              Sie können sich auf dieser Website registrieren, um die Funktionen der Plattform 
              zu nutzen. Die dazu eingegebenen Daten verwenden wir nur zum Zwecke der Nutzung 
              des jeweiligen Angebotes.
            </p>
            <p>
              <strong>Erhobene Daten bei der Registrierung:</strong>
            </p>
            <ul>
              <li>Name</li>
              <li>E-Mail-Adresse</li>
              <li>Passwort (verschlüsselt gespeichert)</li>
              <li>Gegebenenfalls zusätzliche Informationen für Dinner-Events (z. B. Allergien, 
                Host-Präferenzen)</li>
            </ul>
            <p>
              Die Verarbeitung der bei der Registrierung eingegebenen Daten erfolgt auf 
              Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) und zur Vertragserfüllung 
              (Art. 6 Abs. 1 lit. b DSGVO). Sie können eine von Ihnen erteilte Einwilligung 
              jederzeit widerrufen. Dazu reicht eine formlose Mitteilung per E-Mail an uns.
            </p>
            <p>
              Die bei der Registrierung erfassten Daten werden von uns gespeichert, solange 
              Sie auf dieser Website registriert sind und werden anschließend gelöscht.
            </p>

            <h3>Kontaktaufnahme per E-Mail</h3>
            <p>
              Wenn Sie uns per E-Mail kontaktieren, werden Ihre mitgeteilten Daten zwecks 
              Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. 
              Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
            </p>
            <p>
              Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, 
              sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt. In allen übrigen 
              Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven 
              Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO).
            </p>
            <p>
              Die von Ihnen im Kontaktformular oder per E-Mail eingegebenen Daten verbleiben 
              bei uns, bis Sie uns zur Löschung auffordern, Ihre Einwilligung zur Speicherung 
              widerrufen oder der Zweck für die Datenspeicherung entfällt.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>5. E-Mail-Versand (Benachrichtigungen)</h2>
          <div className="legal-content">
            <p>
              Um Sie über anstehende Dinner-Events, Änderungen und wichtige Informationen zu 
              benachrichtigen, versenden wir E-Mails an die bei der Registrierung angegebene 
              E-Mail-Adresse.
            </p>
            <p>
              <strong>Verwendeter E-Mail-Service:</strong> Für den Versand der E-Mails nutzen 
              wir einen externen SMTP-Server. Ihre E-Mail-Adresse wird dabei an diesen Server 
              übertragen, um die Zustellung der E-Mail zu gewährleisten. Der E-Mail-Provider 
              speichert die E-Mail-Adresse nicht dauerhaft, sondern leitet diese nur zum Zweck 
              der Zustellung weiter.
            </p>
            <p>
              Die Rechtsgrundlage für den E-Mail-Versand ist Art. 6 Abs. 1 lit. b DSGVO 
              (Vertragserfüllung), da die Benachrichtigungen notwendig sind, um die 
              Dinner-Events zu organisieren.
            </p>
            <p>
              <strong>Art der Benachrichtigungen:</strong>
            </p>
            <ul>
              <li>Einladungen zu Dinner-Events</li>
              <li>Bestätigung von RSVPs (Zu- oder Absagen)</li>
              <li>Informationen über Host-Zuweisungen</li>
              <li>Erinnerungen an anstehende Termine</li>
              <li>Wichtige Änderungen an Events</li>
            </ul>
          </div>
        </section>

        <section className="legal-section">
          <h2>6. Keine externen Analyse-Tools oder Plugins</h2>
          <div className="legal-content">
            <p>
              Diese Website verwendet <strong>keine</strong> externen Analyse-Tools wie Google Analytics.
            </p>
            <p>
              Diese Website verwendet <strong>keine</strong> externen Plugins von Drittanbietern, 
              die Daten an externe Server übertragen (z. B. keine Social-Media-Plugins, keine 
              Google Fonts von externen Servern, keine Tracking-Pixel).
            </p>
            <p>
              Alle verwendeten Ressourcen (Schriften, Icons) sind entweder lokal eingebettet 
              oder verwenden systemseitige Fonts.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>7. Ihre Rechte</h2>
          <div className="legal-content">
            <p>
              Sie haben gemäß DSGVO folgende Rechte:
            </p>
            <ul>
              <li><strong>Auskunft:</strong> Sie können jederzeit Auskunft über die bei uns 
                gespeicherten personenbezogenen Daten verlangen (Art. 15 DSGVO).</li>
              <li><strong>Berichtigung:</strong> Sie können die Berichtigung unrichtiger Daten 
                verlangen (Art. 16 DSGVO).</li>
              <li><strong>Löschung:</strong> Sie können die Löschung Ihrer Daten verlangen, 
                sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (Art. 17 DSGVO).</li>
              <li><strong>Einschränkung:</strong> Sie können die Einschränkung der Verarbeitung 
                Ihrer Daten verlangen (Art. 18 DSGVO).</li>
              <li><strong>Datenübertragbarkeit:</strong> Sie haben das Recht, Ihre Daten in einem 
                strukturierten, gängigen Format zu erhalten (Art. 20 DSGVO).</li>
              <li><strong>Widerspruch:</strong> Sie können der Verarbeitung Ihrer Daten widersprechen 
                (Art. 21 DSGVO).</li>
              <li><strong>Einwilligung widerrufen:</strong> Sie können eine erteilte Einwilligung 
                jederzeit widerrufen.</li>
              <li><strong>Beschwerde:</strong> Sie haben das Recht, sich bei der zuständigen 
                Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).</li>
            </ul>
            <p>
              Um diese Rechte wahrzunehmen, kontaktieren Sie uns bitte unter den im Impressum 
              angegebenen Kontaktdaten.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>8. Sicherheit</h2>
          <div className="legal-content">
            <p>
              Wir verwenden SSL- bzw. TLS-Verschlüsselung aus Sicherheitsgründen und zum 
              Schutz der Übertragung vertraulicher Inhalte, die Sie an uns als Seitenbetreiber 
              senden. Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile 
              des Browsers von "http://" auf "https://" wechselt und an dem Schloss-Symbol 
              in Ihrer Browserzeile.
            </p>
            <p>
              Passwörter werden verschlüsselt gespeichert (Hash-Verfahren) und sind für uns 
              nicht im Klartext lesbar.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>9. Änderung dieser Datenschutzerklärung</h2>
          <div className="legal-content">
            <p>
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets 
              den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer 
              Dienstleistungen in der Datenschutzerklärung umzusetzen.
            </p>
            <p>
              Wenn Sie die Website erneut besuchen, gilt die jeweils aktuelle Version der 
              Datenschutzerklärung.
            </p>
            <p>
              <strong>Stand:</strong> Juni 2026
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
