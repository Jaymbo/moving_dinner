import React from 'react';

interface MeetupMatrixPanelProps {
  scores: any[];
  matrix: any[];
}

export default function MeetupMatrixPanel({ scores, matrix }: MeetupMatrixPanelProps) {
  return (
    <div
      className="card"
      style={{ background: '#f9fafb', border: '1px solid var(--color-border)' }}
    >
      <h4 style={{ marginTop: 0 }}>🤝 Treffen-Matrix</h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th></th>
              {scores.map((s: any) => (
                <th key={s.userId} style={{ minWidth: 60 }} title={s.user?.name || s.userName}>
                  {(s.user?.name || s.userName).charAt(0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scores.map((sRow: any) => (
              <tr key={sRow.userId}>
                <th
                  style={{ textAlign: 'left', minWidth: 60 }}
                  title={sRow.user?.name || sRow.userName}
                >
                  {(sRow.user?.name || sRow.userName).charAt(0)}
                </th>
                {scores.map((sCol: any) => {
                  const pair = matrix.find(
                    (m) =>
                      (m.userAId === sRow.userId && m.userBId === sCol.userId) ||
                      (m.userAId === sCol.userId && m.userBId === sRow.userId)
                  );
                  return (
                    <td
                      key={sCol.userId}
                      style={{
                        textAlign: 'center',
                        background: pair
                          ? `rgba(124, 58, 237, ${Math.min(pair.count / 5, 1)})`
                          : 'transparent',
                      }}
                    >
                      {pair?.count || 0}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-2">Farbe zeigt Häufigkeit der gemeinsamen Treffen an.</p>
    </div>
  );
}
