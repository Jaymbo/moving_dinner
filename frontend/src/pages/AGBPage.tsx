import React from 'react';
import { Link } from 'react-router-dom';

export default function AGBPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <Link to="/" className="legal-back-link">
            ← Zurück zur Startseite
          </Link>
        </div>

        <h1>Nutzungsbedingungen</h1>

        <section className="legal-section">
          <h2>1. Geltungsbereich</h2>
          <div className="legal-content">
            <p>
              Diese Nutzungsbedingungen regeln die Nutzung der Plattform "Moving Dinner" 
              (nachfolgend "Plattform") und die Teilnahme an über die Plattform organisierten 
              Dinner-Events (nachfolgend "Moving Dinners").
            </p>
            <p>
              Die Plattform wird betrieben von Jason Dietrich (nachfolgend "Betreiber").
            </p>
            <p>
              Mit der Registrierung auf der Plattform erkennt der Nutzer diese Nutzungsbedingungen an.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>2. Leistungen der Plattform</h2>
          <div className="legal-content">
            <p>
              Die Plattform ermöglicht es Nutzern, Dinner-Events zu organisieren, bei 
              denen die einzelnen Gänge an verschiedenen Locations (in der Regel bei den 
              Teilnehmern zu Hause) eingenommen werden.
            </p>
            <p>
              <strong>Funktionen der Plattform:</strong>
            </p>
            <ul>
              <li>Erstellung und Verwaltung von Dinner-Gruppen</li>
              <li>Planung von Treffen mit Datum, Uhrzeit und Gang-Anzahl</li>
              <li>Verwaltung von Teilnehmer-RSVPs (Zu- oder Absagen)</li>
              <li>Faire Zuweisung von Host-Rollen anhand eines Algorithmus</li>
              <li>Versand von Benachrichtigungen an Teilnehmer</li>
              <li>Bereitstellung von Übersichtsseiten für anstehende Treffen</li>
            </ul>
            <p>
              <strong>Wichtig:</strong> Der Betreiber stellt die Plattform nur als technisches 
              Werkzeug zur Verfügung. Der Betreiber ist <strong>nicht</strong> Veranstalter 
              der über die Plattform organisierten Dinner-Events. Veranstalter sind die 
              jeweiligen Teilnehmer selbst.
            </p>
            <p>
              Der Betreiber übernimmt keine Gewähr für die Durchführung, Qualität oder 
              Sicherheit der über die Plattform organisierten Events.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>3. Registrierung und Nutzerkonto</h2>
          <div className="legal-content">
            <p>
              Zur Nutzung der Plattform ist eine Registrierung erforderlich.
            </p>
            <p>
              Bei der Registrierung müssen wahrheitsgemäße Angaben gemacht werden. 
              Insbesondere muss der Nutzer eine gültige E-Mail-Adresse angeben.
            </p>
            <p>
              Der Nutzer ist für die Sicherheit seiner Zugangsdaten (Passwort) verantwortlich. 
              Bei Verdacht auf Missbrauch sollte der Betreiber unverzüglich informiert werden.
            </p>
            <p>
              Der Nutzer darf nur ein Konto erstellen.
            </p>
            <p>
              Der Betreiber behält sich das Recht vor, Nutzerkonten bei Verstößen gegen 
              diese Nutzungsbedingungen oder bei missbräuchlicher Nutzung zu sperren oder zu löschen.
            </p>
            <p>
              Der Nutzer kann sein Konto jederzeit kostenlos löschen.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>4. Teilnahme an Moving Dinners</h2>
          <div className="legal-content">
            <p>
              Die Teilnahme an Moving Dinners erfolgt auf eigene Verantwortung der Teilnehmer.
            </p>
            <p>
              <strong>Pflichten der Hosts:</strong> Hosts verpflichten sich, die zugesagten 
              Gänge in angemessener Qualität und Menge bereitzustellen.
            </p>
            <p>
              <strong>Pflichten der Gäste:</strong> Gäste verpflichten sich, zugesagte 
              Termine einzuhalten oder rechtzeitig abzusagen.
            </p>
            <p>
              Der Betreiber vermittelt nicht zwischen Teilnehmern bei Konflikten. Die 
              Teilnehmer regeln Angelegenheiten untereinander.
            </p>
            <p>
              <strong>Kosten:</strong> Kosten für Lebensmittel, Getränke und andere Ausgaben 
              werden, sofern nicht anders vereinbart, von den Hosts getragen. Eine 
              Kostenerstattung durch Gäste ist nicht vorgesehen, kann aber privat vereinbart werden.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>5. Verhaltensregeln</h2>
          <div className="legal-content">
            <p>
              Nutzer verpflichten sich, bei der Nutzung der Plattform höflich und respektvoll zu agieren.
            </p>
            <p>
              <strong>Untersagt sind insbesondere:</strong>
            </p>
            <ul>
              <li>Belästigung oder Diskriminierung anderer Nutzer</li>
              <li>Verbreitung falscher oder irreführender Informationen</li>
              <li>Missbrauch der Plattform für kommerzielle Zwecke</li>
              <li>Technische Manipulationen oder Versuche, die Plattform zu stören</li>
              <li>Verletzung von Urheber- oder anderen Rechten Dritter</li>
            </ul>
            <p>
              Bei Verstößen behält sich der Betreiber vor, den Nutzer von der Plattform auszuschließen.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>6. Haftung</h2>
          <div className="legal-content">
            <p>
              Der Betreiber haftet nur für Vorsatz und grobe Fahrlässigkeit.
            </p>
            <p>
              <strong>Keine Haftung besteht für:</strong>
            </p>
            <ul>
              <li>Schäden, die im Zusammenhang mit der Teilnahme an Moving Dinners stehen 
                (z. B. Lebensmittelvergiftungen, Unfälle, Diebstahl)</li>
              <li>Nichterfüllung von Zusagen zwischen Teilnehmern</li>
              <li>Technische Störungen oder Ausfälle der Plattform</li>
              <li>Datenverlust, sofern nicht vom Betreiber verschuldet</li>
              <li>Inhalte, die von Nutzern eingestellt werden</li>
            </ul>
            <p>
              Die Haftung für Personenschäden bleibt von den vorstehenden Haftungsbeschränkungen unberührt.
            </p>
            <p>
              <strong>Wichtig:</strong> Teilnehmer nehmen an Moving Dinners auf eigene Gefahr teil. 
              Der Betreiber empfiehlt, bei der Einladung von Personen, die man nicht kennt, 
              angemessene Vorsichtsmaßnahmen zu treffen.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>7. Datenschutz</h2>
          <div className="legal-content">
            <p>
              Der Betreiber verarbeitet personenbezogene Daten der Nutzer gemäß den 
              gesetzlichen Datenschutzbestimmungen und der separaten Datenschutzerklärung.
            </p>
            <p>
              Mit der Registrierung willigt der Nutzer in die Verarbeitung der für die 
              Nutzung der Plattform erforderlichen Daten ein.
            </p>
            <p>
              Details zur Datenverarbeitung sind in der <a href="/datenschutz">Datenschutzerklärung</a> aufgeführt.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>8. Änderungen der Nutzungsbedingungen</h2>
          <div className="legal-content">
            <p>
              Der Betreiber behält sich das Recht vor, diese Nutzungsbedingungen zu ändern.
            </p>
            <p>
              Änderungen werden den Nutzern per E-Mail oder durch Hinweis auf der 
              Plattform mitgeteilt.
            </p>
            <p>
              Setzt der Nutzer die Nutzung der Plattform nach Wirksamwerden der 
              Änderungen fort, gelten die geänderten Bedingungen als anerkannt.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>9. Laufzeit und Kündigung</h2>
          <div className="legal-content">
            <p>
              Die Nutzung der Plattform ist auf unbestimmte Zeit möglich.
            </p>
            <p>
              Der Nutzer kann die Nutzung der Plattform jederzeit einstellen und sein 
              Konto löschen.
            </p>
            <p>
              Der Betreiber kann das Nutzerkonto aus wichtigem Grund fristlos kündigen. 
              Ein wichtiger Grund liegt insbesondere bei Verstößen gegen diese Nutzungsbedingungen vor.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>10. Schlussbestimmungen</h2>
          <div className="legal-content">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland.
            </p>
            <p>
              Sollte eine Bestimmung dieser Nutzungsbedingungen unwirksam sein oder werden, bleibt 
              die Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
            <p>
              Diese Nutzungsbedingungen sind in deutscher Sprache verfasst.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>11. Privates Projekt</h2>
          <div className="legal-content">
            <p>
              Moving Dinner ist ein privates, nicht-kommerzielles Projekt. Es wird kein Gewinn 
              erzielt und es finden keine gewerblichen Aktivitäten statt. Die Plattform dient 
              ausschließlich der Organisation von privaten Dinner-Events in Freundes- und 
              Bekanntenkreisen.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Kontakt</h2>
          <div className="legal-content">
            <p>
              Bei Fragen zu diesen Nutzungsbedingungen wenden Sie sich bitte an:
            </p>
            <p>
              Dietrich<br />
              79117 Freiburg<br />
              E-Mail: <a href="mailto:kontakt@movingdinner.jasondietrich.de">kontakt@movingdinner.jasondietrich.de</a>
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Stand</h2>
          <div className="legal-content">
            <p>
              Diese Nutzungsbedingungen sind zuletzt aktualisiert worden im Juni 2026.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
