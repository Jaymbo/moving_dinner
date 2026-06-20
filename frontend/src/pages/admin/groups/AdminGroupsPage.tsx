import React, { useState, useEffect } from 'react';
import { groups } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import CreateGroupForm from './CreateGroupForm';
import JoinGroupForm from './JoinGroupForm';
import GroupCard from './GroupCard';
import EditGroupForm from './EditGroupForm';

export default function AdminGroupsPage() {
  const { user } = useAuth();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [groupScores, setGroupScores] = useState<any[]>([]);
  const [groupMatrix, setGroupMatrix] = useState<any[]>([]);

  const [editingGroup, setEditingGroup] = useState<any | null>(null);

  useEffect(() => { loadData(); }, []);

  function clearMessages() {
    setError('');
    setMessage('');
  }

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

  async function loadGroupDetails(groupId: number) {
    const [m, inv, scores, matrix] = await Promise.all([
      groups.members(groupId),
      groups.listInvitations(groupId),
      groups.scores(groupId),
      groups.matrix(groupId),
    ]);
    setMembers(m);
    setInvitations(inv);
    setGroupScores(scores);
    setGroupMatrix(matrix);
  }

  async function handleSelectGroup(groupId: number) {
    clearMessages();
    const nextId = groupId === selectedGroupId ? null : groupId;
    setSelectedGroupId(nextId);
    if (nextId) {
      try {
        await loadGroupDetails(nextId);
      } catch (err: any) {
        setError(err.message);
      }
    }
  }

  async function handleDeleteGroup(groupId: number) {
    if (!confirm('Gruppe wirklich löschen? Alle Treffen und Anmeldungen werden gelöscht!')) return;
    clearMessages();
    try {
      await groups.delete(groupId);
      setSelectedGroupId(null);
      setMessage('Gruppe gelöscht!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleLeaveGroup(groupId: number) {
    if (!confirm('Möchtest du diese Gruppe wirklich verlassen?')) return;
    clearMessages();
    try {
      await groups.leave(groupId);
      setSelectedGroupId(null);
      setMessage('Gruppe verlassen!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEditGroup(g: any) {
    setEditingGroup(g);
  }

  async function handleSaveGroup(savedGroupId: number) {
    clearMessages();
    setEditingGroup(null);
    setMessage('Gruppe aktualisiert!');
    try {
      await loadData();
      if (selectedGroupId === savedGroupId) {
        await loadGroupDetails(savedGroupId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Gruppen</h1>
        <div className="actions-stack">
          <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '✕ Abbrechen' : '+ Neue Gruppe'}
          </button>
          <button className="btn" onClick={() => setShowJoin(!showJoin)}>
            {showJoin ? '✕ Abbrechen' : '🔗 Gruppe beitreten'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box" onClick={() => setMessage('')}>{message}</div>}

      {showCreate && (
        <CreateGroupForm
          onCreated={loadData}
          onMessage={setMessage}
          onError={setError}
        />
      )}

      {showJoin && (
        <JoinGroupForm
          onJoined={loadData}
          onMessage={setMessage}
          onError={setError}
        />
      )}

      {myGroups.length === 0 ? (
        <div className="empty-state">
          <p>👥 Keine Gruppen gefunden</p>
          <p>Erstelle eine neue Gruppe oder trete einer bei.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {myGroups.map((g: any) => (
            <div key={g.id} className="card">
              {editingGroup?.id === g.id ? (
                <EditGroupForm
                  group={g}
                  onSaved={() => handleSaveGroup(g.id)}
                  onCancel={() => setEditingGroup(null)}
                  onError={setError}
                />
              ) : (
                <GroupCard
                  group={g}
                  selected={selectedGroupId === g.id}
                  members={selectedGroupId === g.id ? members : []}
                  invitations={selectedGroupId === g.id ? invitations : []}
                  scores={selectedGroupId === g.id ? groupScores : []}
                  matrix={selectedGroupId === g.id ? groupMatrix : []}
                  onToggle={handleSelectGroup}
                  onEdit={startEditGroup}
                  onDelete={handleDeleteGroup}
                  onLeave={handleLeaveGroup}
                  onRefresh={() => selectedGroupId && loadGroupDetails(selectedGroupId)}
                  onMembersChange={setMembers}
                  onInvitationsChange={setInvitations}
                  onScoresChange={setGroupScores}
                  onMatrixChange={setGroupMatrix}
                  onMessage={setMessage}
                  onError={setError}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}