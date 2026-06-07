import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meetings, responses } from '../api/client';

export default function MyMeetingsPage() {
  const [myMeetings, setMyMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadMeetings(); }, []);

  async function loadMeetings() {
    try {
      const data = await meetings.my();
      setMyMeetings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResponse(meetingId: number, hostWish: string) {
    try {
      const existing = myMeetings.find(m => m.id === meetingId);
      if (existing?.hasResponded) {
        await responses.updateMine(meetingId, hostWish);
      } else {
        await responses.create(meetingId, hostWish);
      }
      await loadMeetings();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleWithdraw(meetingId: number) {
    try {
      await responses.deleteMine(meetingId);
      await loadMeetings();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDeadline(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <h1 className="page-title">Meine Treffen</h1>
      {error && <div className="error-box">{error}</div>}

      {myMeetings.length === 0 ? (
        <div className="empty-state">
          <p>📡 Keine offenen Treffen</p>
          <p>Du bist noch in keinen Gruppen mit offenen Treffen.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {myMeetings.map((m: any) => (
            <div key={m.id} className="card">
              <div className="card-header">
                <div>
                  <h3>📅 {formatDate(m.date)}</h3>
                  <span className="text-sm text-muted">{m.group?.name}</span>
                </div>
                {m.frozen ? (
                  <span className="badge badge-gray">Abgeschlossen</span>
                ) : (
                  <span className="badge badge-green">Offen</span>
                )}
              </div>
              <p className="text-sm mb-2">Deadline: {formatDeadline(m.deadline)}</p>
              <p className="text-sm mb-4">Anmeldungen: {m.totalResponses ?? m._count?.responses ?? m.responses?.length ?? 0}</p>

              {!m.frozen && (
                <div>
                  {m.hasResponded ? (
                    <div>
                      <p className="text-sm mb-2">
                        Deine Anmeldung: <strong>{
                          m.response?.hostWish === 'will_host' ? '🏠 Will hosten' :
                          m.response?.hostWish === 'cannot_host' ? '❌ Kann nicht hosten' :
                          '🤷 Egal'
                        }</strong>
                      </p>
                      <div className="flex gap-2">
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'will_host')}>🏠 Will hosten</button>
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'indifferent')}>🤷 Egal</button>
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'cannot_host')}>❌ Kann nicht</button>
                        <button className="btn-sm btn-danger" onClick={() => handleWithdraw(m.id)}>Zurückziehen</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm mb-2">Du hast dich noch nicht angemeldet:</p>
                      <div className="flex gap-2">
                        <button className="btn-primary btn-sm" onClick={() => handleResponse(m.id, 'will_host')}>🏠 Will hosten</button>
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'indifferent')}>🤷 Egal</button>
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'cannot_host')}>❌ Kann nicht</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}