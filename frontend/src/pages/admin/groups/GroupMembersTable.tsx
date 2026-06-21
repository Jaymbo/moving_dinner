import React from 'react';
import useAuth from '../../../context/useAuth';

interface GroupMembersTableProps {
  groupId: number;
  members: any[];
  isAdmin: boolean;
  onChangeRole: (groupId: number, userId: number, role: string) => void;
  onRemoveMember: (groupId: number, userId: number) => void;
}

export default function GroupMembersTable({
  groupId,
  members,
  isAdmin,
  onChangeRole,
  onRemoveMember,
}: GroupMembersTableProps) {
  const { user } = useAuth();

  return (
    <div>
      <h4>Mitglieder ({members.length})</h4>

      {/* Desktop: Tabelle */}
      <div className="table-wrapper mt-2 table-desktop">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m: any) => {
              const memberId = m.userId || m.user?.id;
              const isSelf = memberId === user?.id;
              return (
                <tr key={m.id}>
                  <td>
                    {m.user.name}{' '}
                    {m.user.isSuperAdmin && (
                      <span
                        className="badge"
                        style={{ background: '#7c3aed', color: '#fff', marginLeft: 2 }}
                      >
                        ⭐
                      </span>
                    )}
                    {m.user.isGuest && <span className="badge badge-yellow">Gast</span>}
                    {isSelf && <span className="text-sm text-muted">(du)</span>}
                  </td>
                  <td className="text-sm">{m.user.email}</td>
                  <td>
                    <span className="badge badge-blue">{m.role}</span>
                  </td>
                  <td>
                    {isAdmin && !isSelf && (
                      <div className="card-actions">
                        {m.role === 'member' && (
                          <button
                            className="btn-sm"
                            onClick={() => onChangeRole(groupId, memberId, 'admin')}
                            title="Zum Admin machen"
                          >
                            👑 Admin
                          </button>
                        )}
                        {m.role === 'admin' && (
                          <button
                            className="btn-sm"
                            onClick={() => onChangeRole(groupId, memberId, 'member')}
                            title="Zum Mitglied machen"
                          >
                            👤 Mitglied
                          </button>
                        )}
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => onRemoveMember(groupId, memberId)}
                        >
                          Entfernen
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="mobile-card-list mt-2">
        {members.map((m: any) => {
          const memberId = m.userId || m.user?.id;
          const isSelf = memberId === user?.id;
          return (
            <div key={m.id} className="ui-mobile-card">
              <div className="ui-mobile-card-row">
                <div className="ui-mobile-card-main">
                  <span className="ui-mobile-card-value">
                    {m.user.name}{' '}
                    {m.user.isSuperAdmin && (
                      <span
                        className="badge"
                        style={{ background: '#7c3aed', color: '#fff', marginLeft: 2 }}
                      >
                        ⭐
                      </span>
                    )}
                    {m.user.isGuest && <span className="badge badge-yellow">Gast</span>}
                    {isSelf && <span className="text-sm text-muted">(du)</span>}
                  </span>
                  <span className="ui-mobile-card-label" style={{ wordBreak: 'break-all' }}>
                    {m.user.email}
                  </span>
                </div>
                <span className="badge badge-blue">{m.role}</span>
              </div>
              {isAdmin && !isSelf && (
                <div className="ui-mobile-card-actions">
                  {m.role === 'member' && (
                    <button
                      className="btn-sm"
                      onClick={() => onChangeRole(groupId, memberId, 'admin')}
                    >
                      👑 Zum Admin machen
                    </button>
                  )}
                  {m.role === 'admin' && (
                    <button
                      className="btn-sm"
                      onClick={() => onChangeRole(groupId, memberId, 'member')}
                    >
                      👤 Zum Mitglied machen
                    </button>
                  )}
                  <button
                    className="btn-sm btn-danger"
                    onClick={() => onRemoveMember(groupId, memberId)}
                  >
                    Entfernen
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
