import React, { useState } from 'react';
import { groups } from '../../../api/client';
import CopyButton from './CopyButton';
import { getJoinLink } from './groupUtils';

interface InvitationsPanelProps {
  groupId: number;
  invitations: any[];
  onChange: (invitations: any[]) => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export default function InvitationsPanel({ groupId, invitations, onChange, onMessage, onError }: InvitationsPanelProps) {
  const [newInvMaxUses, setNewInvMaxUses] = useState('');

  async function handleCreateInvitation() {
    try {
      const result = await groups.createInvitation(groupId, newInvMaxUses ? parseInt(newInvMaxUses) : undefined);
      onMessage(`Einladungslink erstellt: ${getJoinLink(result.code)}`);
      setNewInvMaxUses('');
      const inv = await groups.listInvitations(groupId);
      onChange(inv);
    } catch (err: any) {
      onError(err.message);
    }
  }

  return (
    <div>
      <h4 className="mt-4">Einladungscodes ({invitations.length})</h4>
      <div className="flex flex-wrap gap-2 mt-2 mb-2">
        <input type="number" value={newInvMaxUses} onChange={e => setNewInvMaxUses(e.target.value)} placeholder="Max. Nutzungen (leer = unbegrenzt)" style={{ flex: 1, minWidth: 220, maxWidth: 320 }} />
        <button className="btn-sm btn-primary" onClick={handleCreateInvitation}>+ Neuer Code</button>
      </div>
      {invitations.length > 0 && (
        <div className="table-wrapper">
          <table style={{ width: '100%', marginBottom: 24 }}>
            <thead><tr><th>Einladungslink</th><th>Max</th><th>Verwendet</th><th>Gültig bis</th><th></th></tr></thead>
            <tbody>
              {invitations.map((inv: any) => (
                <tr key={inv.id}>
                  <td>
                    <a href={getJoinLink(inv.code)} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>{getJoinLink(inv.code)}</a>
                  </td>
                  <td style={{ textAlign: 'center' }}>{inv.maxUses || '∞'}</td>
                  <td style={{ textAlign: 'center' }}>{inv.usedCount}</td>
                  <td style={{ textAlign: 'center' }}>{inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('de-DE') : 'Unbegrenzt'}</td>
                  <td style={{ textAlign: 'center' }}><CopyButton text={getJoinLink(inv.code)} label="📋" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
