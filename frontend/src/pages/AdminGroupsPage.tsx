import React, { useState, useEffect } from 'react';
import { groups, join } from '../api/client';

export default function AdminGroupsPage() {
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinGroup, setJoinGroup] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [newInvMaxUses, setNewInvMaxUses] = useState('');
  const [tab, setTab] = useState<'my' | 'all'>('my');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [my, all] = await Promise.all([groups.my(), groups.list()]);
      setMyGroups(my);
      setAllGroups(all);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const result = await groups.create({ name: newName, description: newDesc || undefined });
      setMessage(`Gruppe "${newName}" erstellt! Einladungscode: ${result.inviteCode}`);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleLookupCode() {
    setError('');
    setJoinGroup(null);
    try {
      const result = await join.lookup(joinCode);
      setJoinGroup(result.group);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleJoinGroup() {
    setJoining(true);
    setError('');
    try {
      await join.join(joinCode);
      setMessage('Gruppe beigetreten!');
      setShowJoin(false);
      setJoinCode('');
      setJoinGroup(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function handleSelectGroup(groupId: number) {
    setSelectedGroup(groupId === selectedGroup ? null : groupId);
    if (groupId !== selectedGroup) {
      try {
        const [m, inv] = await Promise.all([groups.members(groupId), groups.listInvitations(groupId)]);
        setMembers(m);
        setInvitations(inv);
      } catch (err: any) {
        setError(err.message);
      }
    }
  }

  async function handleRemoveMember(groupId: number, userId: number) {
    if (!confirm('Mitglied wirklich entfernen?')) return;
    try {
      await groups.removeMember(groupId, userId);
      const m = await groups.members(groupId);
      setMembers(m);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateInvitation(groupId: number) {
    try {
      const result = await groups.createInvitation(groupId, newInvMaxUses ? parseInt(newInvMaxUses) : undefined);
      setMessage(`Einladungscode erstellt: ${result.code}`);
      setNewInvMaxUses('');
      const inv = await groups.listInvitations(groupId);
      setInvitations(inv);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteGroup(groupId: number) {
    if (!confirm('Gruppe wirklich löschen? Alle Treffen und Anmeldungen werden gelöscht!')) return;
    try {
      await groups.delete(groupId);
      setSelectedGroup(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div className="loading">Laden...</div>;

  const displayGroups = tab === 'my' ? myGroups : allGroups;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Gruppen</h1>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '✕ Abbrechen' : '+ Neue Gruppe'}
          </button>
          <button className="" onClick={() => setShowJoin(!showJoin)}>
            {showJoin ? '✕ Abbrechen' : '🔗 Gruppe beitreten'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      {showCreate && (
        <div className="card mb-4">
          <h3>Neue Gruppe erstellen</h3>
          <form onSubmit={handleCreate} className="mt-4">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
            </div>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Erstellen...' : 'Gruppe erstellen'}
            </button>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="card mb-4">
          <h3>Gruppe beitreten</h3>
          <div className="flex gap-2 mt-4">
            <input
              type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
              placeholder="Einladungscode eingeben (z.B. JOIN-X7K9M2 oder GRP-DEMO01)"
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={handleLookupCode}>Suchen</button>
          </div>
          {joinGroup && (
            <div className="card mt-4" style={{ background: '#f0fdf4' }}>
              <h4>{joinGroup.name}</h4>
              <p className="text-sm text-muted">{joinGroup.description || 'Keine Beschreibung'}</p>
              <button className="btn-primary mt-2" onClick={handleJoinGroup} disabled={joining}>
                {joining ? 'Beitreten...' : 'Gruppe beitreten'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button className={tab === 'my' ? 'btn-primary btn-sm' : 'btn-sm'} onClick={() => setTab('my')}>Meine Gruppen</button>
        <button className={tab === 'all' ? 'btn-primary btn-sm' : 'btn-sm'} onClick={() => setTab('all')}>Alle Gruppen</button>
      </div>

      {displayGroups.length === 0 ? (
        <div className="empty-state">
          <p>👥 Keine Gruppen gefunden</p>
          <p>Erstelle eine neue Gruppe oder trete einer bei.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {displayGroups.map((g: any) => (
            <div key={g.id} className="card">
              <div className="card-header">
                <div>
                  <h3>{g.name}</h3>
                  <span className="text-sm text-muted">{g.description || 'Keine Beschreibung'}</span>
                </div>
                <span className="badge badge-blue">{g.role || 'Mitglied'}</span>
              </div>
              <p className="text-sm mb-2">
                📋 Code: <strong>{g.inviteCode}</strong> · 👥 {g._count?.members || g.members?.length || 0} Mitglieder · 📅 {g._count?.meetings || 0} Treffen
              </p>
              <div className="flex gap-2">
                <button className="btn-sm" onClick={() => handleSelectGroup(g.id)}>
                  {selectedGroup === g.id ? '✕ Schließen' : '👁️ Details'}
                </button>
                <button className="btn-sm btn-danger" onClick={() => handleDeleteGroup(g.id)}>🗑️</button>
              </div>

              {selectedGroup === g.id && (
                <div className="mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                  <h4>Mitglieder ({members.length})</h4>
                  <table className="mt-2">
                    <thead>
                      <tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Aktion</th></tr>
                    </thead>
                    <tbody>
                      {members.map((m: any) => (
                        <tr key={m.id}>
                          <td>{m.user.name} {m.user.isGuest && <span className="badge badge-yellow">Gast</span>}</td>
                          <td className="text-sm">{m.user.email}</td>
                          <td><span className="badge badge-blue">{m.role}</span></td>
                          <td>{m.role !== 'admin' && <button className="btn-sm btn-danger" onClick={() => handleRemoveMember(g.id, m.userId)}>Entfernen</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4 className="mt-4">Einladungscodes ({invitations.length})</h4>
                  <div className="flex gap-2 mt-2 mb-2">
                    <input type="number" value={newInvMaxUses} onChange={e => setNewInvMaxUses(e.target.value)} placeholder="Max. Nutzungen (leer = unbegrenzt)" style={{ width: 300 }} />
                    <button className="btn-sm btn-primary" onClick={() => handleCreateInvitation(g.id)}>+ Neuer Code</button>
                  </div>
                  {invitations.length > 0 && (
                    <table>
                      <thead><tr><th>Code</th><th>Max</th><th>Verwendet</th><th>Gültig bis</th></tr></thead>
                      <tbody>
                        {invitations.map((inv: any) => (
                          <tr key={inv.id}>
                            <td><strong>{inv.code}</strong></td>
                            <td>{inv.maxUses || '∞'}</td>
                            <td>{inv.usedCount}</td>
                            <td>{inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('de-DE') : 'Unbegrenzt'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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