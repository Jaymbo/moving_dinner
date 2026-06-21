import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groups } from '../api/client';

interface ScoreItem {
  userId: number;
  userName?: string;
  user?: { id: number; name: string } | null;
}

interface MatrixItem {
  userAId: number;
  userBId: number;
  count: number;
}

export default function MeetupMatrixPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [matrix, setMatrix] = useState<MatrixItem[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [xFilter, setXFilter] = useState('');
  const [yFilter, setYFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [scoresData, matrixData, groupData] = await Promise.all([
        groups.scores(id),
        groups.matrix(id),
        groups.get(id),
      ]);
      setScores(scoresData || []);
      setMatrix(matrixData || []);
      setGroupName(groupData?.name || '');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Matrix');
    } finally {
      setLoading(false);
    }
  }

  function getUserName(s: ScoreItem): string {
    return s.user?.name || s.userName || `User ${s.userId}`;
  }

  function matchesFilter(name: string, filter: string): boolean {
    if (!filter.trim()) return true;
    const terms = filter
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const lower = name.toLowerCase();
    return terms.length === 0 || terms.some((term) => lower.includes(term));
  }

  const filteredX = useMemo(
    () => scores.filter((s) => matchesFilter(getUserName(s), xFilter)),
    [scores, xFilter]
  );

  const filteredY = useMemo(
    () => scores.filter((s) => matchesFilter(getUserName(s), yFilter)),
    [scores, yFilter]
  );

  function getPairCount(aId: number, bId: number): number {
    const pair = matrix.find(
      (m) =>
        (m.userAId === aId && m.userBId === bId) ||
        (m.userAId === bId && m.userBId === aId)
    );
    return pair?.count ?? 0;
  }

  function getCellBackground(count: number): string {
    if (count === 0) return 'transparent';
    const opacity = Math.min(count / 5, 1);
    return `rgba(124, 58, 237, ${opacity})`;
  }

  if (loading) return <div className="loading">Lade Matrix...</div>;

  return (
    <div>
      <header className="ui-page-header">
        <div>
          <h1 className="ui-page-title">🤝 Treffen-Matrix</h1>
          {groupName && <p className="ui-page-subtitle">Gruppe: {groupName}</p>}
        </div>
        <div className="ui-page-header-action">
          <Link className="ui-btn ui-btn-md ui-btn-outline" to="/groups">
            ← Zurück zu Gruppen
          </Link>
          <button className="ui-btn ui-btn-sm ui-btn-outline" onClick={loadData}>
            🔄 Neu laden
          </button>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      <div className="card mb-4">
        <p className="text-sm text-muted mb-4">
          Filtere die X- und Y-Achse unabhängig voneinander. Kommagetrennte Begriffe werden als ODER verknüpft.
        </p>
        <div className="grid grid-2 gap-4">
          <div className="form-group">
            <label htmlFor="x-filter">X-Achse filtern</label>
            <input
              id="x-filter"
              type="text"
              className="ui-input"
              value={xFilter}
              onChange={(e) => setXFilter(e.target.value)}
              placeholder="z. B. Anna, Max"
            />
          </div>
          <div className="form-group">
            <label htmlFor="y-filter">Y-Achse filtern</label>
            <input
              id="y-filter"
              type="text"
              className="ui-input"
              value={yFilter}
              onChange={(e) => setYFilter(e.target.value)}
              placeholder="z. B. Lisa, Tom"
            />
          </div>
        </div>
      </div>

      <div className="card matrix-card">
        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-corner"></th>
                {filteredX.map((s) => (
                  <th key={s.userId} className="matrix-col-header" title={getUserName(s)}>
                    <span className="matrix-initial">{getUserName(s).charAt(0)}</span>
                    <span className="matrix-fullname">{getUserName(s)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredY.map((sRow) => (
                <tr key={sRow.userId}>
                  <th className="matrix-row-header" title={getUserName(sRow)}>
                    <span className="matrix-initial">{getUserName(sRow).charAt(0)}</span>
                    <span className="matrix-fullname">{getUserName(sRow)}</span>
                  </th>
                  {filteredX.map((sCol) => {
                    const count = getPairCount(sRow.userId, sCol.userId);
                    return (
                      <td
                        key={sCol.userId}
                        className="matrix-cell"
                        style={{ backgroundColor: getCellBackground(count) }}
                        title={`${getUserName(sRow)} ↔ ${getUserName(sCol)}: ${count}`}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted mt-3">
          Farbe zeigt die Häufigkeit gemeinsamer Treffen an. Hover über eine Zelle zeigt das Paar.
        </p>
      </div>
    </div>
  );
}
