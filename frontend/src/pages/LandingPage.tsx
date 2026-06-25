import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function LandingPage() {
  const features = [
    {
      icon: '🏠',
      title: 'Wechselnde Locations',
      description: 'Jeder Gang wird bei einer anderen Person genossen – so lernt ihr alle Homes kennen.',
    },
    {
      icon: '👥',
      description: 'Faire Gruppenbildung durch intelligente Algorithmen.',
      title: 'Ausgewogene Gruppen',
    },
    {
      icon: '🎯',
      title: 'Automatische Zuweisung',
      description: 'Das System weist Hosts fair zu – basierend auf bisherigen Treffen.',
    },
    {
      icon: '📧',
      title: 'Automatische Benachrichtigungen',
      description: 'Alle Teilnehmer erhalten rechtzeitig E-Mails mit Details zum nächsten Treffen.',
    },
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="emoji">🍽️</span> Moving Dinner
          </h1>
          <p className="hero-subtitle">
            Organisiere unvergessliche Dinner-Events, bei denen jeder Gang an einem neuen Ort stattfindet.
          </p>
          <div className="hero-cta">
            <Link to="/register">
              <Button variant="primary" size="md">
                Kostenlos starten
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="md">
                Anmelden
              </Button>
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-illustration">
            <div className="dinner-table">
              <div className="plate plate-1"></div>
              <div className="plate plate-2"></div>
              <div className="plate plate-3"></div>
              <div className="plate plate-4"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">So funktioniert's</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">Ablauf eines Moving Dinners</h2>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Gruppe erstellen</h3>
              <p>Lade Freunde, Kollegen oder Nachbarn in deine Dinner-Gruppe ein.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Treffen planen</h3>
              <p>Lege Datum, Uhrzeit und Anzahl der Gänge fest.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Hosts ermitteln</h3>
              <p>Teilnehmer tragen sich als Host ein, das System weist fair zu.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Genießen!</h3>
              <p>Treff euch und genießt gemeinsam die verschiedenen Gänge.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Bereit für dein erstes Moving Dinner?</h2>
        <p>Starte jetzt kostenlos und organisiere dein erstes Event in Minuten.</p>
        <Link to="/register">
          <Button variant="primary" size="md">
            Jetzt loslegen
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-links">
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
          <Link to="/agb">AGB</Link>
        </div>
        <p>© 2026 Moving Dinner – Gemeinsam essen macht mehr Spaß</p>
      </footer>
    </div>
  );
}
