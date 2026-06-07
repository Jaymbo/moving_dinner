import React, { useState, useEffect } from 'react';
import { groups, join } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminGroupsPage() {
  const { user } = useAuth();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMeetingCreation, setNewMeetingCreation] = useState<string>('admin');
  const [creating, setCreating] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinGroup, setJoinGroup] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [newInvMaxUses, setNewInvMaxUses] = useState('');
  // Groups are now filtered by backend - only showing user's groups
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMeetingCreation, setEditMeetingCreation] = useState<string>('admin');

  useEffect(() => { loadData(); }, []);

  function clearMessages() { setError(''); setMessage(''); }

  async function loadData() {
    try {
      const my = await groups.list();
      setMyGroups(my);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    clearMessages();
    try {
      const result = await groups.create({ name: newName, description: newDesc || undefined, meetingCreation: newMeetingCreation });
      setMessage(`Gruppe "${newName}" erstellt! Einladungscode: ${result.inviteCode}`);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewMeetingCreation('admin');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleLookupCode() {
    clearMessages();
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
    clearMessages();
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
    clearMessages();
    try {
      await groups.removeMember(groupId, userId);
      const m = await groups.members(groupId);
      setMembers(m);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleChangeRole(groupId: number, userId: number, newRole: string) {
    clearMessages();
    try {
      await groups.changeRole(groupId, userId, newRole);
      const m = await groups.members(groupId);
      setMembers(m);
      await loadData();
      setMessage('Rolle geändert!');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleLeaveGroup(groupId: number) {
    if (!confirm('Möchtest du diese Gruppe wirklich verlassen?')) return;
    clearMessages();
    try {
      await groups.leave(groupId);
      setSelectedGroup(null);
      setMessage('Gruppe verlassen!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateInvitation(groupId: number) {
    clearMessages();
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
    clearMessages();
    try {
      await groups.delete(groupId);
      setSelectedGroup(null);
      setMessage('Gruppe gelöscht!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEditGroup(g: any) {
    setEditingGroup(g.id);
    setEditName(g.name);
    setEditDesc(g.description || '');
    setEditMeetingCreation(g.meetingCreation || 'admin');
  }

  async function handleSaveGroup(groupId: number) {
    clearMessages();
    try {
      await groups.update(groupId, {
        name: editName,
        description: editDesc || undefined,
        meetingCreation: editMeetingCreation,
      });
      setEditingGroup(null);
      setMessage('Gruppe aktualisiert!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div className="loading">Laden...</div>;

  // Determine current user's role in a group
  function getMyRole(g: any): string {
    if (g.members) {
      const m = g.members.find((mem: any) => mem.userId === user?.id || mem.user?.id === user?.id);
      if (m) return m.role;
    }
    return g.role || 'member';
  }

  const displayGroups = myGroups;

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
      {message && <div className="success-box" onClick={() => setMessage('')}>{message}</div>}

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
            <div className="form-group">
              <label>Wer darf Treffen erstellen?</label>
              <select value={newMeetingCreation} onChange={e => setNewMeetingCreation(e.target.value)}>
                <option value="admin">Nur Admins</option>
                <option value="all">Alle Mitglieder</option>
              </select>
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


      {displayGroups.length === 0 ? (
        <div className="empty-state">
          <p>👥 Keine Gruppen gefunden</p>
          <p>Erstelle eine neue Gruppe oder trete einer bei.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {displayGroups.map((g: any) => {
            const myRole = getMyRole(g);
            const isAdmin = myRole === 'admin';
            const isMember = myRole === 'member' || isAdmin;

            return (
              <div key={g.id} className="card">
                {editingGroup === g.id ? (
                  /* Edit Mode */
                  <div>
                    <h3>✏️ Gruppe bearbeiten</h3>
                    <div className="form-group mt-4">
                      <label>Name</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Beschreibung</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} />
                    </div>
                    <div className="form-group">
                      <label>Wer darf Treffen erstellen?</label>
                      <select value={editMeetingCreation} onChange={e => setEditMeetingCreation(e.target.value)}>
                        <option value="admin">Nur Admins</option>
                        <option value="all">Alle Mitglieder</option>
                      </select>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button className="btn-primary" onClick={() => handleSaveGroup(g.id)}>💾 Speichern</button>
                      <button className="btn-sm" onClick={() => setEditingGroup(null)}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div>
                    <div className="card-header">
                      <div>
                        <h3>{g.name}</h3>
                        <span className="text-sm text-muted">{g.description || 'Keine Beschreibung'}</span>
                      </div>
                      <span className="badge badge-blue">{myRole === 'admin' ? 'Admin' : 'Mitglied'}</span>
                    </div>
                    <p className="text-sm mb-2">
                      📋 Code: <strong>{g.inviteCode}</strong> · 👥 {g._count?.members || g.members?.length || 0} Mitglieder · 📅 {g._count?.meetings || 0} Treffen
                    </p>
                    <p className="text-sm mb-2">
                      🎯 Treffen erstellen: <strong>{g.meetingCreation === 'all' ? 'Alle Mitglieder' : 'Nur Admins'}</strong>
                    </p>
                    <div className="flex gap-2">
                      {isMember && (
                        <button className="btn-sm" onClick={() => handleSelectGroup(g.id)}>
                          {selectedGroup === g.id ? '✕ Schließen' : '👁️ Details'}
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button className="btn-sm" onClick={() => startEditGroup(g)}>✏️ Bearbeiten</button>
                          <button className="btn-sm btn-danger" onClick={() => handleDeleteGroup(g.id)}>🗑️</button>
                        </>
                      )}
                      {isMember && (
                        <button className="btn-sm btn-danger" onClick={() => handleLeaveGroup(g.id)}>🚪 Verlassen</button>
                      )}
                    </div>
                  </div>
                )}

                {selectedGroup === g.id && (
                  <div className="mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                    <h4>Mitglieder ({members.length})</h4>
                    <table className="mt-2">
                      <thead>
                        <tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Aktion</th></tr>
                      </thead>
                      <tbody>
                        {members.map((m: any) => {
                          const memberId = m.userId || m.user?.id;
                          const isSelf = memberId === user?.id;
                          return (
                            <tr key={m.id}>
                              <td>{m.user.name} {m.user.isGuest && <span className="badge badge-yellow">Gast</span>} {isSelf && <span className="text-sm text-muted">(du)</span>}</td>
                              <td className="text-sm">{m.user.email}</td>
                              <td>
                                <span className="badge badge-blue">{m.role}</span>
                              </td>
                              <td>
                                {isAdmin && !isSelf && (
                                  <div className="flex gap-1">
                                    {m.role === 'member' && (
                                      <button className="btn-sm" onClick={() => handleChangeRole(g.id, memberId, 'admin')} title="Zum Admin machen">
                                        👑 Admin
                                      </button>
                                    )}
                                    {m.role === 'admin' && (
                                      <button className="btn-sm" onClick={() => handleChangeRole(g.id, memberId, 'member')} title="Zum Mitglied machen">
                                        👤 Mitglied
                                      </button>
                                    )}
                                    <button className="btn-sm btn-danger" onClick={() => handleRemoveMember(g.id, memberId)}>Entfernen</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {isAdmin && (
                      <>
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
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}