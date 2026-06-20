import React, { useState, useEffect } from 'react';
import { users } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminUsersPage() {
  const { user, isSuperAdmin, refreshUser } = useAuth();
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [togglingSuperAdmin, setTogglingSuperAdmin] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const data = await users.list();
      setUserList(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(id: number) {
    try {
      await users.update(id, editData);
      setEditingId(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('User wirklich löschen?')) return;
    try {
      await users.delete(id);
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleSuperAdmin(id: number, currentValue: boolean) {
    const targetUser = userList.find((u: any) => u.id === id);
    const action = currentValue ? 'Super-Admin Status entfernen' : 'Zum Super-Admin ernennen';
    const userName = targetUser?.name || 'diesen Benutzer';
    if (!confirm(`${action}: ${userName}?\n\n${!currentValue ? 'Dieser Benutzer erhält volle Admin-Rechte inkl. Zugriff auf alle Admin-Funktionen und kann andere Super-Admins verwalten.' : 'Dieser Benutzer verliert alle Super-Admin-Rechte.'}`)) return;
    
    setTogglingSuperAdmin(id);
    setError('');
    setSuccess('');
    try {
      await users.toggleSuperAdmin(id, !currentValue);
      await loadUsers();
      await refreshUser();
      setSuccess(`${userName} wurde ${!currentValue ? 'zum Super-Admin ernannt' : 'als Super-Admin entfernt'}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingSuperAdmin(null);
    }
  }

  function startEdit(u: any) {
    setEditingId(u.id);
    setEditData({ name: u.name, address: u.address || '', maxGuests: u.maxGuests, diet: u.diet || '', notes: u.notes || '' });
  }

  function getUserTypeBadge(u: any) {
    if (u.isSuperAdmin) return <span className="badge" style={{ background: '#7c3aed', color: '#fff' }}>⭐ Super-Admin</span>;
    if (u.isGuest) return <span className="badge badge-yellow">Gast</span>;
    return <span className="badge badge-green">User</span>;
  }

  const filteredUsers = userList.filter((u: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.address?.toLowerCase().includes(q) ||
      u.diet?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <h1 className="page-title">Benutzer verwalten</h1>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Suche nach Name, E-Mail, Adresse, Diät..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220, maxWidth: 400 }}
        />
        {search && (
          <span className="text-sm text-muted">
            {filteredUsers.length} von {userList.length} Benutzern
          </span>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Adresse</th>
              <th>Max Gäste</th>
              <th>Diät</th>
              <th>Typ</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u: any) => (
              <tr key={u.id} style={u.isSuperAdmin ? { background: '#f5f3ff' } : undefined}>
                {editingId === u.id ? (
                  <>
                    <td>{u.id}</td>
                    <td><input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} /></td>
                    <td>{u.email}</td>
                    <td><input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} /></td>
                    <td><input type="number" value={editData.maxGuests} onChange={e => setEditData({...editData, maxGuests: parseInt(e.target.value)||0})} /></td>
                    <td><input value={editData.diet} onChange={e => setEditData({...editData, diet: e.target.value})} /></td>
                    <td>{getUserTypeBadge(u)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-sm btn-primary" onClick={() => handleSave(u.id)}>✓</button>
                        <button className="btn-sm" onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{u.id}</td>
                    <td>{u.name} {u.id === user?.id && <span style={{ color: '#7c3aed', fontSize: '0.8rem' }}>(du)</span>}</td>
                    <td className="text-sm">{u.email}</td>
                    <td className="text-sm">{u.address || '–'}</td>
                    <td>{u.maxGuests}</td>
                    <td className="text-sm">{u.diet || '–'}</td>
                    <td>{getUserTypeBadge(u)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-sm" onClick={() => startEdit(u)}>✏️</button>
                        {u.id !== user?.id && (
                          <button className="btn-sm btn-danger" onClick={() => handleDelete(u.id)}>🗑️</button>
                        )}
                        {isSuperAdmin && u.id !== user?.id && (
                          <button
                            className="btn-sm"
                            style={{
                              background: u.isSuperAdmin ? '#7c3aed' : '#e5e7eb',
                              color: u.isSuperAdmin ? '#fff' : '#374151',
                              border: '1px solid #d1d5db',
                            }}
                            onClick={() => handleToggleSuperAdmin(u.id, u.isSuperAdmin)}
                            disabled={togglingSuperAdmin === u.id}
                            title={u.isSuperAdmin ? 'Super-Admin entfernen' : 'Zum Super-Admin machen'}
                          >
                            {togglingSuperAdmin === u.id ? '...' : '⭐'}
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filteredUsers.length === 0 && search && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: '#999' }}>
                  Keine Benutzer gefunden für „{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}