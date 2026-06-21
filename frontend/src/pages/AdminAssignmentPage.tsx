import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetings, assignment } from '../api/client';

export default function AdminAssignmentPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!meetingId) return;
    try {
      const id = parseInt(meetingId);
      const [m, a] = await Promise.all([meetings.get(id), assignment.get(id)]);
      setMeeting(m);
      setAssignmentData(a);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadData();
  }, [loadData]);

  async function handleAutoAssign() {
    if (!meetingId) return;
    setAssigning(true);
    setError('');
    try {
      await assignment.autoAssign(parseInt(meetingId));
      setMessage('Automatische Zuweisung berechnet!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleManualSave() {
    if (!meetingId || !assignmentData) return;
    setSaving(true);
    setError('');
    try {
      const assignments = Object.entries(assignmentData.hostGroups).flatMap(
        ([, group]: [string, any]) =>
          [
            ...group.guests.map((g: any) => ({
              userId: g.userId,
              assignedHost: parseInt(group.host?.id || '0'),
            })),
          ].filter((a: any) => a.assignedHost !== 0)
      );

      // Also include hosts pointing to themselves
      const hostAssignments = Object.entries(assignmentData.hostGroups)
        .map(([, group]: [string, any]) => ({
          userId: parseInt(group.host?.id || '0'),
          assignedHost: parseInt(group.host?.id || '0'),
        }))
        .filter((a: any) => a.userId !== 0);

      await assignment.manual(parseInt(meetingId), [...hostAssignments, ...assignments]);
      setMessage('Manuelle Zuweisung gespeichert!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveGuest(userId: number, newHostId: number) {
    if (!assignmentData) return;
    const newHostGroups = { ...assignmentData.hostGroups };
    let guestResponse: any = null;

    // Remove guest from current host group
    for (const [_hostId, group] of Object.entries(newHostGroups)) {
      const g = (group as any).guests as any[];
      const idx = g.findIndex((r: any) => r.userId === userId);
      if (idx !== -1) {
        guestResponse = g.splice(idx, 1)[0];
        break;
      }
    }

    if (guestResponse && newHostGroups[newHostId]) {
      (newHostGroups[newHostId] as any).guests.push(guestResponse);
    }

    setAssignmentData({ ...assignmentData, hostGroups: newHostGroups });
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE');
  }

  if (loading) return <div className="loading">Laden...</div>;
  if (!meeting) return <div className="error-box">Treffen nicht gefunden</div>;

  const responseList = meeting.responses || [];
  const hostWishes = responseList.reduce((acc: any, r: any) => {
    acc[r.hostWish] = (acc[r.hostWish] || 0) + 1;
    return acc;
  }, {});
  const isAdmin = meeting.userRole === 'admin';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <button className="btn-sm" onClick={() => navigate('/groups')}>
          ← Zurück
        </button>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Zuweisung – {formatDate(meeting.date)}
        </h1>
        {meeting.frozen && <span className="badge badge-gray">Abgeschlossen</span>}
        {!meeting.frozen && <span className="badge badge-green">Offen</span>}
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <div className="card mb-4">
        <h3>Anmeldungen ({responseList.length})</h3>
        <div className="flex flex-wrap gap-4 mt-2">
          <span>
            🏠 Will hosten: <strong>{hostWishes['will_host'] || 0}</strong>
          </span>
          <span>
            🤷 Egal: <strong>{hostWishes['indifferent'] || 0}</strong>
          </span>
          <span>
            ❌ Kann nicht: <strong>{hostWishes['cannot_host'] || 0}</strong>
          </span>
        </div>
      </div>

      {!meeting.frozen && isAdmin && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button className="btn-primary" onClick={handleAutoAssign} disabled={assigning}>
            {assigning ? 'Berechne...' : '🔄 Automatische Zuweisung'}
          </button>
          <button className="" onClick={handleManualSave} disabled={saving}>
            {saving ? 'Speichern...' : '💾 Manuelle Zuweisung speichern'}
          </button>
        </div>
      )}

      {assignmentData && Object.keys(assignmentData.hostGroups).length > 0 ? (
        <div>
          <h3>Host-Gruppen</h3>
          {Object.entries(assignmentData.hostGroups).map(([hostId, group]: [string, any]) => (
            <div key={hostId} className="assignment-group">
              <h4>🏠 {group.host?.name || 'Unbekannt'}</h4>
              <p className="text-sm text-muted">{group.host?.address || 'Keine Adresse'}</p>
              {group.guests.length === 0 ? (
                <p className="text-sm text-muted mt-2">Keine Gäste zugewiesen</p>
              ) : (
                <div className="mt-2">
                  {group.guests.map((g: any) => (
                    <div
                      key={g.userId}
                      className="assignment-guest flex items-center justify-between"
                    >
                      <span>
                        {g.user?.name || 'Unbekannt'}
                        {g.user?.diet && (
                          <span className="text-sm text-muted"> ({g.user.diet})</span>
                        )}
                      </span>
                      {!meeting.frozen &&
                        isAdmin &&
                        Object.keys(assignmentData.hostGroups).length > 1 && (
                          <select
                            value={hostId}
                            onChange={(e) => handleMoveGuest(g.userId, parseInt(e.target.value))}
                            style={{ width: 'auto' }}
                          >
                            {Object.entries(assignmentData.hostGroups).map(
                              ([hid, hg]: [string, any]) => (
                                <option key={hid} value={hid}>
                                  {hg.host?.name}
                                </option>
                              )
                            )}
                          </select>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {assignmentData.unassigned && assignmentData.unassigned.length > 0 && (
            <div className="card" style={{ border: '2px solid var(--color-danger)' }}>
              <h4>⚠️ Nicht zugewiesen ({assignmentData.unassigned.length})</h4>
              {assignmentData.unassigned.map((r: any) => (
                <p key={r.userId}>
                  {r.user?.name} – {r.hostWish}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>Noch keine Zuweisung</p>
          <p>Klicke auf „Automatische Zuweisung" um Hosts zuzuordnen.</p>
        </div>
      )}
    </div>
  );
}
