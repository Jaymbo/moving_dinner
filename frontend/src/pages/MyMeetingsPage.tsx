import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meetings, responses, groups } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function MyMeetingsPage() {
  const { user } = useAuth();
  const [myMeetings, setMyMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Creation state
  const [showCreate, setShowCreate] = useState(false);
  const [creatableGroups, setCreatableGroups] = useState<any[]>([]);
  const [newGroupId, setNewGroupId] = useState<number | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [newDeadlineTime, setNewDeadlineTime] = useState('23:59');
  const [creating, setCreating] = useState(false);

  useEffect(() => { 
    loadMeetings(); 
    loadCreatableGroups();
  }, []);

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

  async function loadCreatableGroups() {
    try {
      const g = await groups.list();
      const creatable = g.filter((group: any) => {
        const role = group.role || (group.members?.find((mem: any) => mem.userId === user?.id || mem.user?.id === user?.id)?.role);
        return group.meetingCreation === 'all' || role === 'admin';
      });
      setCreatableGroups(creatable);
      if (creatable.length > 0) setNewGroupId(creatable[0].id);
    } catch (err: any) {
      console.error('Error loading creatable groups:', err);
    }
  }

  function combineDateTime(date: string, time: string): string {
    return `${date}T${time}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupId || !newDate || !newDeadlineDate || !newDeadlineTime) return;
    setCreating(true);
    setError('');
    try {
      await meetings.create(newGroupId, { date: newDate, deadline: combineDateTime(newDeadlineDate, newDeadlineTime) });
      setShowCreate(false);
      setNewDate('');
      setNewDeadlineDate('');
      setNewDeadlineTime('23:59');
      await loadMeetings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
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
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Meine Treffen</h1>
        <button 
          className="btn-primary" 
          onClick={() => setShowCreate(!showCreate)} 
          disabled={creatableGroups.length === 0}
        >
          {showCreate ? '✕ Abbrechen' : '+ Neues Treffen'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {showCreate && (
        <div className="card mb-4">
          <h3>Neues Treffen erstellen</h3>
          <form onSubmit={handleCreate} className="mt-4">
            <div className="form-group">
              <label>Gruppe</label>
              <select 
                value={newGroupId || ''} 
                onChange={e => setNewGroupId(parseInt(e.target.value))}
                required
              >
                {creatableGroups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.meetingCreation === 'all' ? ' (Alle dürfen)' : ' (Nur Admins)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Datum</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Anmeldeschluss</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={newDeadlineDate}
                  onChange={e => setNewDeadlineDate(e.target.value)}
                  required
                  aria-label="Anmeldeschluss Datum"
                />
                <input
                  type="time"
                  value={newDeadlineTime}
                  onChange={e => setNewDeadlineTime(e.target.value)}
                  required
                  aria-label="Anmeldeschluss Uhrzeit"
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Erstellen...' : 'Treffen erstellen'}
            </button>
          </form>
        </div>
      )}

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
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'will_host')}>🏠 Will hosten</button>
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'indifferent')}>🤷 Egal</button>
                        <button className="btn-sm" onClick={() => handleResponse(m.id, 'cannot_host')}>❌ Kann nicht</button>
                        <button className="btn-sm btn-danger" onClick={() => handleWithdraw(m.id)}>Zurückziehen</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm mb-2">Du hast dich noch nicht angemeldet:</p>
                      <div className="flex flex-wrap gap-2">
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