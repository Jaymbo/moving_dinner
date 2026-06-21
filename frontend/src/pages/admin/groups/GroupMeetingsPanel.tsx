import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { meetings, admin } from '../../../api/client';

interface GroupMeetingsPanelProps {
  groupId: number;
  isAdmin: boolean;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export default function GroupMeetingsPanel({ groupId, isAdmin, onMessage, onError }: GroupMeetingsPanelProps) {
  const [groupMeetings, setGroupMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeetings();
  }, [groupId]);

  async function loadMeetings() {
    setLoading(true);
    try {
      const data = await meetings.groupMeetings(groupId);
      setGroupMeetings(data);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(meetingId: number) {
    if (!confirm('Treffen wirklich löschen? Alle Anmeldungen werden gelöscht!')) return;
    try {
      await meetings.delete(meetingId);
      onMessage('Treffen gelöscht');
      await loadMeetings();
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleFreeze(meetingId: number) {
    if (!confirm('Treffen wirklich abschließen? Dadurch werden die Zuweisungen finalisiert und E-Mails versendet.')) return;
    try {
      await admin.freeze(meetingId);
      onMessage('Treffen abgeschlossen');
      await loadMeetings();
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleRemind(meetingId: number) {
    try {
      await admin.remind(meetingId);
      onMessage('Erinnerungen versendet');
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleSendRsvp(meetingId: number) {
    try {
      await admin.sendRsvp(meetingId);
      onMessage('RSVP-Einladungen versendet');
    } catch (err: any) {
      onError(err.message);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE');
  }

  function formatDeadline(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (loading) return <p className="text-sm text-muted">Lade Treffen...</p>;

  return (
    <div className="card mt-4" style={{ background: '#f9fafb', border: '1px solid var(--color-border)' }}>
      <h4 style={{ marginTop: 0 }}>📅 Treffen ({groupMeetings.length})</h4>
      {groupMeetings.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Treffen in dieser Gruppe.</p>
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <div className="table-wrapper table-desktop">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Anmeldungen</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {groupMeetings.map((m: any) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.date)}</td>
                    <td className="text-sm">{formatDeadline(m.deadline)}</td>
                    <td>
                      {m.frozen ? (
                        <span className="badge badge-gray">Abgeschlossen</span>
                      ) : (
                        <span className="badge badge-green">Offen</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{m._count?.responses ?? 0}</td>
                    <td>
                      <div className="card-actions">
                        <Link className="btn-sm" to={`/groups/${groupId}/assignment/${m.id}`}>Zuweisung</Link>
                        {!m.frozen && isAdmin && (
                          <>
                            <button className="btn-sm" onClick={() => handleSendRsvp(m.id)}>RSVP</button>
                            <button className="btn-sm" onClick={() => handleRemind(m.id)}>Erinnern</button>
                            <button className="btn-sm btn-danger" onClick={() => handleFreeze(m.id)}>Abschließen</button>
                            <button className="btn-sm btn-danger" onClick={() => handleDelete(m.id)}>🗑️</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="mobile-card-list">
            {groupMeetings.map((m: any) => (
              <div key={m.id} className="ui-mobile-card">
                <div className="ui-mobile-card-row">
                  <div className="ui-mobile-card-main">
                    <span className="ui-mobile-card-value">{formatDate(m.date)}</span>
                    <span className="ui-mobile-card-label">Deadline: {formatDeadline(m.deadline)}</span>
                  </div>
                  {m.frozen ? (
                    <span className="badge badge-gray">Abgeschlossen</span>
                  ) : (
                    <span className="badge badge-green">Offen</span>
                  )}
                </div>
                <div className="ui-mobile-card-row">
                  <span className="ui-mobile-card-label">Anmeldungen</span>
                  <span className="ui-mobile-card-value">{m._count?.responses ?? 0}</span>
                </div>
                <div className="ui-mobile-card-actions">
                  <Link className="btn-sm" to={`/groups/${groupId}/assignment/${m.id}`}>Zuweisung</Link>
                  {!m.frozen && isAdmin && (
                    <>
                      <button className="btn-sm" onClick={() => handleSendRsvp(m.id)}>RSVP versenden</button>
                      <button className="btn-sm" onClick={() => handleRemind(m.id)}>Erinnern</button>
                      <button className="btn-sm btn-danger" onClick={() => handleFreeze(m.id)}>Abschließen</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(m.id)}>🗑️ Löschen</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}