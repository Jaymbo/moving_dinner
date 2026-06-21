import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { join } from '../api/client';
import useAuth from '../context/useAuth';

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState(false);

  const lookupCode = useCallback(async () => {
    if (!code) return;
    try {
      const data = await join.lookup(code);
      setGroupInfo(data.group);
    } catch (err: any) {
      setError(err.message || 'Ungültiger Einladungscode');
    } finally {
      setLoading(false);
    }
  }, [code]);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void lookupCode();
  }, [lookupCode]);

  async function handleJoin() {
    if (!code) return;
    setJoining(true);
    setError('');
    try {
      await join.join(code);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <h1>🍽️ Moving Dinner</h1>
        <p>Gruppe beitreten</p>

        {error && <div className="error-box">{error}</div>}

        {success ? (
          <div className="success-box">
            <h3>✅ Gruppe beigetreten!</h3>
            <p className="mt-2">Du bist jetzt Mitglied in „{groupInfo?.name}".</p>
            <p className="text-sm text-muted mt-2">Du wirst weitergeleitet...</p>
          </div>
        ) : groupInfo ? (
          <div>
            <div className="card" style={{ background: '#f0fdf4', marginBottom: 16 }}>
              <h3>{groupInfo.name}</h3>
              <p className="text-sm text-muted">{groupInfo.description || 'Keine Beschreibung'}</p>
            </div>

            {!user ? (
              <div className="error-box">
                Du musst angemeldet sein, um einer Gruppe beizutreten.
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => navigate('/login')}>Anmelden</button>
                  <button className="btn-sm" onClick={() => navigate('/register')}>Registrieren</button>
                </div>
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={handleJoin} disabled={joining} style={{ justifyContent: 'center' }}>
                {joining ? 'Beitreten...' : `„${groupInfo.name}" beitreten`}
              </button>
            )}
          </div>
        ) : (
          <p>Der Einladungscode konnte nicht gefunden werden.</p>
        )}
      </div>
    </div>
  );
}