import React, { useState, useEffect } from 'react';
import { meetings, responses, groups } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FormField from '../components/ui/FormField';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';

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
      <PageHeader
        title="Meine Treffen"
        subtitle="Verwalte deine Moving-Dinner-Treffen und melde dich an."
        action={
          <Button
            variant="primary"
            onClick={() => setShowCreate(!showCreate)}
            disabled={creatableGroups.length === 0}
          >
            {showCreate ? '✕ Abbrechen' : '+ Neues Treffen'}
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {showCreate && (
        <Card className="mb-4">
          <h3>Neues Treffen erstellen</h3>
          <form onSubmit={handleCreate} className="mt-4">
            <FormField
              label="Gruppe"
              as="select"
              value={newGroupId || ''}
              onChange={e => setNewGroupId(parseInt(e.target.value))}
              required
            >
              {creatableGroups.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.meetingCreation === 'all' ? ' (Alle dürfen)' : ' (Nur Admins)'}
                </option>
              ))}
            </FormField>
            <FormField
              label="Datum"
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              required
            />
            <div className="form-group">
              <label className="ui-label">Anmeldeschluss</label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="ui-input"
                  type="date"
                  value={newDeadlineDate}
                  onChange={e => setNewDeadlineDate(e.target.value)}
                  required
                  aria-label="Anmeldeschluss Datum"
                />
                <input
                  className="ui-input"
                  type="time"
                  value={newDeadlineTime}
                  onChange={e => setNewDeadlineTime(e.target.value)}
                  required
                  aria-label="Anmeldeschluss Uhrzeit"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" loading={creating}>
              {creating ? 'Erstellen...' : 'Treffen erstellen'}
            </Button>
          </form>
        </Card>
      )}

      {myMeetings.length === 0 ? (
        <div className="empty-state">
          <p>📡 Keine offenen Treffen</p>
          <p>Du bist noch in keinen Gruppen mit offenen Treffen.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {myMeetings.map((m: any) => (
            <Card key={m.id}>
              <CardHeader
                title={<>📅 {formatDate(m.date)}</>}
                subtitle={m.group?.name}
                action={
                  m.frozen ? (
                    <span className="badge badge-gray">Abgeschlossen</span>
                  ) : (
                    <span className="badge badge-green">Offen</span>
                  )
                }
              />
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
                      <div className="actions-stack">
                        <Button size="sm" onClick={() => handleResponse(m.id, 'will_host')}>🏠 Will hosten</Button>
                        <Button size="sm" onClick={() => handleResponse(m.id, 'indifferent')}>🤷 Egal</Button>
                        <Button size="sm" onClick={() => handleResponse(m.id, 'cannot_host')}>❌ Kann nicht</Button>
                        <Button size="sm" variant="danger" onClick={() => handleWithdraw(m.id)}>Zurückziehen</Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm mb-2">Du hast dich noch nicht angemeldet:</p>
                      <div className="actions-stack">
                        <Button size="sm" variant="primary" onClick={() => handleResponse(m.id, 'will_host')}>🏠 Will hosten</Button>
                        <Button size="sm" onClick={() => handleResponse(m.id, 'indifferent')}>🤷 Egal</Button>
                        <Button size="sm" onClick={() => handleResponse(m.id, 'cannot_host')}>❌ Kann nicht</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}