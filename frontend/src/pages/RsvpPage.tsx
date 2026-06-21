import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { rsvp } from '../api/client';
import type { RsvpInfo, HostWish } from '../types/api';

export default function RsvpPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rsvpInfo, setRsvpInfo] = useState<RsvpInfo | null>(null);
  const [hostWish, setHostWish] = useState<HostWish>('indifferent');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const lookupToken = useCallback(async () => {
    if (!token) return;
    try {
      const data = await rsvp.lookup(token);
      if (data.valid) {
        setRsvpInfo(data);
      } else {
        setRsvpInfo({ valid: false, reason: data.reason });
      }
    } catch {
      setError('Ungültiger oder abgelaufener Anmelde-Link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void lookupToken();
  }, [lookupToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      await rsvp.submit(token, hostWish);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(d: string | undefined) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <h1>🍽️ Moving Dinner</h1>

        {error && <div className="error-box">{error}</div>}

        {!rsvpInfo?.valid ? (
          <div>
            <p>Dieser Anmelde-Link ist nicht mehr gültig.</p>
            {rsvpInfo?.reason === 'already_used' && (
              <p className="text-muted mt-2">Du hast dich bereits für dieses Treffen angemeldet.</p>
            )}
            {rsvpInfo?.reason === 'expired' && (
              <p className="text-muted mt-2">Die Anmeldefrist ist abgelaufen.</p>
            )}
            {rsvpInfo?.reason === 'frozen' && (
              <p className="text-muted mt-2">Dieses Treffen wurde bereits abgeschlossen.</p>
            )}
          </div>
        ) : success ? (
          <div className="success-box">
            <h3>✅ Anmeldung gespeichert!</h3>
            <p className="mt-2">
              Vielen Dank, {rsvpInfo.userName ?? ''}! Deine Anmeldung wurde erfolgreich gespeichert.
            </p>
            <p className="text-sm text-muted mt-2">
              Du erhältst nach dem Anmeldeschluss eine E-Mail mit der Zuweisung.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-2">
              Hallo <strong>{rsvpInfo.userName}</strong>,
            </p>
            <p className="mb-4">
              du bist eingeladen zum Moving Dinner am{' '}
              <strong>{formatDate(rsvpInfo.meetingDate)}</strong>.
            </p>
            <p className="text-sm text-muted mb-4">
              Anmeldeschluss: {formatDate(rsvpInfo.deadline)}
            </p>

            <div className="form-group">
              <label>Was ist deine Präferenz?</label>
              <div className="host-wish-options">
                <label className={`host-wish-option ${hostWish === 'will_host' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="hostWish"
                    value="will_host"
                    checked={hostWish === 'will_host'}
                    onChange={() => setHostWish('will_host')}
                  />
                  <div>
                    <div className="label">🏠 Ich will hosten</div>
                    <div className="desc">Ich lade Gäste zu mir ein</div>
                  </div>
                </label>
                <label
                  className={`host-wish-option ${hostWish === 'indifferent' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="hostWish"
                    value="indifferent"
                    checked={hostWish === 'indifferent'}
                    onChange={() => setHostWish('indifferent')}
                  />
                  <div>
                    <div className="label">🤷 Mir egal</div>
                    <div className="desc">Ich kann hosten oder Gast sein</div>
                  </div>
                </label>
                <label
                  className={`host-wish-option ${hostWish === 'cannot_host' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="hostWish"
                    value="cannot_host"
                    checked={hostWish === 'cannot_host'}
                    onChange={() => setHostWish('cannot_host')}
                  />
                  <div>
                    <div className="label">❌ Ich kann nicht hosten</div>
                    <div className="desc">Ich möchte nur Gast sein</div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
              style={{ justifyContent: 'center' }}
            >
              {submitting ? 'Speichern...' : 'Anmeldung absenden'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
