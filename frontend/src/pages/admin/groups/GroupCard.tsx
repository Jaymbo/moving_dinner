import React from 'react';
import { Link } from 'react-router-dom';
import { groups } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { CopyButton, getJoinLink, getMyRole, isActualMember } from './utils';
import GroupMembersTable from './GroupMembersTable';
import InvitationsPanel from './InvitationsPanel';
import GroupScoresPanel from './GroupScoresPanel';
import GroupMeetingsPanel from './GroupMeetingsPanel';

interface GroupCardProps {
  group: any;
  selected: boolean;
  members: any[];
  invitations: any[];
  scores: any[];
  onToggle: (groupId: number) => void;
  onEdit: (group: any) => void;
  onDelete: (groupId: number) => void;
  onLeave: (groupId: number) => void;
  onRefresh: () => void;
  onMembersChange: (members: any[]) => void;
  onInvitationsChange: (invitations: any[]) => void;
  onScoresChange: (scores: any[]) => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export default function GroupCard(props: GroupCardProps) {
  const { user } = useAuth();
  const { group, selected, members, invitations, scores, onToggle, onEdit, onDelete, onLeave, onRefresh, onMembersChange, onInvitationsChange, onMessage, onError } = props;

  const myRole = getMyRole(group, user?.id);
  const isAdmin = myRole === 'admin';
  const isMember = isActualMember(group, user?.id);

  async function handleChangeRole(groupId: number, userId: number, newRole: string) {
    try {
      await groups.changeRole(groupId, userId, newRole);
      const m = await groups.members(groupId);
      onMembersChange(m);
      onMessage('Rolle geändert!');
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleRemoveMember(groupId: number, userId: number) {
    if (!confirm('Mitglied wirklich entfernen?')) return;
    try {
      await groups.removeMember(groupId, userId);
      const m = await groups.members(groupId);
      onMembersChange(m);
      onRefresh();
    } catch (err: any) {
      onError(err.message);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>{group.name}</h3>
          <span className="text-sm text-muted">{group.description || 'Keine Beschreibung'}</span>
        </div>
        <span className="badge badge-blue">{myRole === 'admin' ? 'Admin' : 'Mitglied'}</span>
      </div>

      <p className="text-sm mb-2">
        📋 Code: <strong>{group.inviteCode}</strong> · 👥 {group._count?.members || group.members?.length || 0} Mitglieder · 📅 {group._count?.meetings || 0} Treffen
      </p>
      <p className="text-sm mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        🔗 Link: <a href={getJoinLink(group.inviteCode)} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>{getJoinLink(group.inviteCode)}</a>
        <CopyButton text={getJoinLink(group.inviteCode)} label="📋" />
      </p>
      <p className="text-sm mb-2">
        🎯 Treffen erstellen: <strong>{group.meetingCreation === 'all' ? 'Alle Mitglieder' : 'Nur Admins'}</strong>
      </p>

      <div className="card-actions">
        {(isMember || isAdmin) && (
          <button className="btn-sm" onClick={() => onToggle(group.id)}>
            {selected ? '✕ Schließen' : '👁️ Details'}
          </button>
        )}
        {isAdmin && (
          <>
            <button className="btn-sm" onClick={() => onEdit(group)}>✏️ Bearbeiten</button>
            <button className="btn-sm btn-danger" onClick={() => onDelete(group.id)}>🗑️</button>
          </>
        )}
        {isMember && (
          <button className="btn-sm btn-danger" onClick={() => onLeave(group.id)}>🚪 Verlassen</button>
        )}
      </div>

      {selected && (
        <div className="mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <GroupMembersTable
            groupId={group.id}
            members={members}
            isAdmin={isAdmin}
            onChangeRole={handleChangeRole}
            onRemoveMember={handleRemoveMember}
          />

          {isAdmin && (
            <>
              <InvitationsPanel
                groupId={group.id}
                invitations={invitations}
                onChange={onInvitationsChange}
                onMessage={onMessage}
                onError={onError}
              />

              <GroupMeetingsPanel
                groupId={group.id}
                isAdmin={isAdmin}
                onMessage={onMessage}
                onError={onError}
              />

              <div className="grid grid-2 mt-6">
                <GroupScoresPanel
                  groupId={group.id}
                  scores={scores}
                  onRefresh={onRefresh}
                  onMessage={onMessage}
                  onError={onError}
                />
                <div className="card" style={{ background: '#f9fafb', border: '1px solid var(--color-border)' }}>
                  <h4 style={{ marginTop: 0 }}>🤝 Treffen-Matrix</h4>
                  <p className="text-sm text-muted">
                    Zeigt, wie oft zwei Personen bereits gemeinsam zu Abend gegessen sind.
                  </p>
                  <Link
                    className="btn-sm mt-3"
                    to={`/groups/${group.id}/matrix`}
                    style={{ width: '100%' }}
                  >
                    🔍 Matrix öffnen
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}