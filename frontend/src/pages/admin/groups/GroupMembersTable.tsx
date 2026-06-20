import React from 'react';
import { useAuth } from '../../../context/AuthContext';

interface GroupMembersTableProps {
  groupId: number;
  members: any[];
  isAdmin: boolean;
  onChangeRole: (groupId: number, userId: number, role: string) => void;
  onRemoveMember: (groupId: number, userId: number) => void;
}

export default function GroupMembersTable({ groupId, members, isAdmin, onChangeRole, onRemoveMember }: GroupMembersTableProps) {
  const { user } = useAuth();

  return (
    <div>
      <h4>Mitglieder ({members.length})</h4>
      <div className="table-wrapper mt-2">
        <table>
          <thead>
            <tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Aktion</th></tr>
          </thead>
          <tbody>
            {members.map((m: any) => {
              const memberId = m.userId || m.user?.id;
              const isSelf = memberId === user?.id;
              return (
                <tr key={m.id}>
                  <td>
                    {m.user.name}{' '}
                    {m.user.isSuperAdmin && <span className="badge" style={{ background: '#7c3aed', color: '#fff', marginLeft: 2 }}>⭐</span>}
                    {m.user.isGuest && <span className="badge badge-yellow">Gast</span>}
                    {isSelf && <span className="text-sm text-muted">(du)</span>}
                  </td>
                  <td className="text-sm">{m.user.email}</td>
                  <td><span className="badge badge-blue">{m.role}</span></td>
                  <td>
                    {isAdmin && !isSelf && (
                      <div className="card-actions">
                        {m.role === 'member' && (
                          <button className="btn-sm" onClick={() => onChangeRole(groupId, memberId, 'admin')} title="Zum Admin machen">
                            👑 Admin
                          </button>
                        )}
                        {m.role === 'admin' && (
                          <button className="btn-sm" onClick={() => onChangeRole(groupId, memberId, 'member')} title="Zum Mitglied machen">
                            👤 Mitglied
                          </button>
                        )}
                        <button className="btn-sm btn-danger" onClick={() => onRemoveMember(groupId, memberId)}>Entfernen</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
