import React from 'react';
import { groups } from '../../../api/client';

interface GroupScoresPanelProps {
  groupId: number;
  scores: any[];
  onRefresh: () => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export default function GroupScoresPanel({ groupId, scores, onRefresh, onMessage, onError }: GroupScoresPanelProps) {
  async function handleRecalculate() {
    try {
      await groups.recalculate(groupId);
      onMessage('Scores neu berechnet!');
      onRefresh();
    } catch (err: any) {
      onError(err.message);
    }
  }

  return (
    <div className="card" style={{ background: '#f9fafb', border: '1px solid var(--color-border)' }}>
      <h4 style={{ marginTop: 0 }}>📊 Gruppen-Scores</h4>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>User</th>
            <th style={{ textAlign: 'center' }}>Score</th>
            <th style={{ textAlign: 'center' }}>Teilnahmen</th>
            <th style={{ textAlign: 'center' }}>Hostings</th>
            <th style={{ textAlign: 'center' }}>Gäste</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s: any) => (
            <tr key={s.userId}>
              <td style={{ textAlign: 'left' }}>{s.user?.name || s.userName}</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{Number(s.score).toFixed(2)}</td>
              <td style={{ textAlign: 'center' }}>{s.participations}</td>
              <td style={{ textAlign: 'center' }}>{s.hostings}</td>
              <td style={{ textAlign: 'center' }}>{s.hostedGuests}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-sm mt-3" style={{ width: '100%' }} onClick={handleRecalculate}>
        🔄 Scores aktualisieren
      </button>
    </div>
  );
}