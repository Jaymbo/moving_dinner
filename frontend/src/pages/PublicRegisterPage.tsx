import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../api/client';

export default function PublicRegisterPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hostWish, setHostWish] = useState('indifferent');
  const [diet, setDiet] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { loadMeeting(); }, [meetingId]);

  async function loadMeeting() {
    try {
      const meetings = await publicApi.activeMeetings();
      const found = meetings.find((m: any) => m.id === parseInt(meetingId || ''));
      if (found) {
        setMeeting(found);
      } else {
        setError('Treffen nicht gefunden oder Anmeldung nicht mehr möglich');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingId) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await publicApi.register(parseInt(meetingId), {
        name,
        email,
        hostWish,
        diet: diet || undefined,
      });
      setSuccess(true);
      if (result.isGuest) {
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE');
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <h1>🍽️ Moving Dinner</h1>
        <p>Gast-Anmeldung</p>

        {error && <div className="error-box">{error}</div>}

        {success ? (
          <div className="success-box">
            <h3>✅ Anmeldung erfolgreich!</h3>
            <p className="mt-2">Vielen Dank, {name}! Du wurdest als Gast angemeldet.</p>
            <p className="text-sm text-muted mt-2">
              Du erhältst nach dem Anmeldeschluss eine E-Mail mit der Zuweisung.
            </p>
          </div>
        ) : meeting ? (
          <form onSubmit={handleSubmit}>
            <div className="card mb-4" style={{ background: '#f0fdf4' }}>
              <h3>📅 {formatDate(meeting.date)}</h3>
              <p className="text-sm text-muted">{meeting.group?.name || 'Moving Dinner'}</p>
              <p className="text-sm text-muted">Anmeldeschluss: {formatDate(meeting.deadline)}</p>
            </div>

            <div className="form-group">
              <label>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Ernährungsbesonderheiten</label>
              <input type="text" value={diet} onChange={e => setDiet(e.target.value)} placeholder="z.B. vegetarisch, vegan, glutenfrei" />
            </div>
            <div className="form-group">
              <label>Was ist deine Präferenz?</label>
              <div className="host-wish-options">
                <label className={`host-wish-option ${hostWish === 'will_host' ? 'selected' : ''}`}>
                  <input type="radio" name="hostWish" value="will_host" checked={hostWish === 'will_host'} onChange={() => setHostWish('will_host')} />
                  <div>
                    <div className="label">🏠 Ich will hosten</div>
                    <div className="desc">Ich lade Gäste zu mir ein</div>
                  </div>
                </label>
                <label className={`host-wish-option ${hostWish === 'indifferent' ? 'selected' : ''}`}>
                  <input type="radio" name="hostWish" value="indifferent" checked={hostWish === 'indifferent'} onChange={() => setHostWish('indifferent')} />
                  <div>
                    <div className="label">🤷 Mir egal</div>
                    <div className="desc">Ich kann hosten oder Gast sein</div>
                  </div>
                </label>
                <label className={`host-wish-option ${hostWish === 'cannot_host' ? 'selected' : ''}`}>
                  <input type="radio" name="hostWish" value="cannot_host" checked={hostWish === 'cannot_host'} onChange={() => setHostWish('cannot_host')} />
                  <div>
                    <div className="label">❌ Ich kann nicht hosten</div>
                    <div className="desc">Ich möchte nur Gast sein</div>
                  </div>
                </label>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting} style={{ justifyContent: 'center' }}>
              {submitting ? 'Anmelden...' : 'Als Gast anmelden'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}