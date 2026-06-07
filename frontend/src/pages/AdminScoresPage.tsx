import React, { useState, useEffect } from 'react';
import { users, admin } from '../api/client';

export default function AdminScoresPage() {
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalcing, setRecalcing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const data = await users.list();
      setUserList(data.sort((a: any, b: any) => (a.scores?.score ?? 0) - (b.scores?.score ?? 0)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalc() {
    setRecalcing(true);
    setError('');
    setMessage('');
    try {
      await admin.recalculateScores();
      setMessage('Scores neu berechnet!');
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRecalcing(false);
    }
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Score-Board</h1>
        <button className="btn-primary" onClick={handleRecalc} disabled={recalcing}>
          {recalcing ? 'Berechne...' : '🔄 Neu berechnen'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <div className="card">
        <p className="text-sm text-muted mb-4">
          Score = (Teilnahmen - Hostings - Gäste hosten) / MaxGäste. Niedriger Score = eher dran zu hosten.
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Teilnahmen</th>
              <th>Hostings</th>
              <th>Gäste hosten</th>
              <th>Max Gäste</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u: any, i: number) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td>{u.name} {u.isSuperAdmin && <span className="badge" style={{ background: '#7c3aed', color: '#fff', marginLeft: 4 }}>⭐</span>} {u.isGuest && <span className="badge badge-yellow">Gast</span>}</td>
                <td>{u.scores?.participations ?? 0}</td>
                <td>{u.scores?.hostings ?? 0}</td>
                <td>{u.scores?.hostedGuests ?? 0}</td>
                <td>{u.maxGuests}</td>
                <td><strong>{u.scores ? Number(u.scores.score).toFixed(3) : '–'}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}