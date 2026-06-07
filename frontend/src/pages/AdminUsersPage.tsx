import React, { useState, useEffect } from 'react';
import { users } from '../api/client';

export default function AdminUsersPage() {
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});

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

  function startEdit(u: any) {
    setEditingId(u.id);
    setEditData({ name: u.name, address: u.address || '', maxGuests: u.maxGuests, diet: u.diet || '', notes: u.notes || '' });
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <h1 className="page-title">Benutzer verwalten</h1>
      {error && <div className="error-box">{error}</div>}

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
            <th>Score</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {userList.map((u: any) => (
            <tr key={u.id}>
              {editingId === u.id ? (
                <>
                  <td>{u.id}</td>
                  <td><input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{width:120}} /></td>
                  <td>{u.email}</td>
                  <td><input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} style={{width:180}} /></td>
                  <td><input type="number" value={editData.maxGuests} onChange={e => setEditData({...editData, maxGuests: parseInt(e.target.value)||0})} style={{width:60}} /></td>
                  <td><input value={editData.diet} onChange={e => setEditData({...editData, diet: e.target.value})} style={{width:100}} /></td>
                  <td>{u.isGuest ? <span className="badge badge-yellow">Gast</span> : <span className="badge badge-green">User</span>}</td>
                  <td>{u.scores ? Number(u.scores.score).toFixed(2) : '–'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-sm btn-primary" onClick={() => handleSave(u.id)}>✓</button>
                      <button className="btn-sm" onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td className="text-sm">{u.email}</td>
                  <td className="text-sm">{u.address || '–'}</td>
                  <td>{u.maxGuests}</td>
                  <td className="text-sm">{u.diet || '–'}</td>
                  <td>{u.isGuest ? <span className="badge badge-yellow">Gast</span> : <span className="badge badge-green">User</span>}</td>
                  <td>{u.scores ? Number(u.scores.score).toFixed(2) : '–'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-sm" onClick={() => startEdit(u)}>✏️</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(u.id)}>🗑️</button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}