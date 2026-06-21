import React, { useState, useEffect, useCallback, useRef } from 'react';
import { featureRequests } from '../api/client';
import type {
  FeatureRequest,
  FeatureRequestStatus,
  FeatureRequestPriority,
  FeatureRequestType,
} from '../types/api';

export default function AdminFeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<FeatureRequestStatus | ''>('');
  const [filterType, setFilterType] = useState<FeatureRequestType | ''>('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { status?: FeatureRequestStatus; type?: FeatureRequestType } = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterType) filters.type = filterType;
      const data = await featureRequests.list(filters);
      setRequests(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadRequests();
  }, [loadRequests]);

  async function handleUpdateStatus(id: number, status: FeatureRequestStatus) {
    try {
      await featureRequests.update(id, { status });
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  async function handleUpdatePriority(id: number, priority: FeatureRequestPriority) {
    try {
      await featureRequests.update(id, { priority });
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Request wirklich löschen?')) return;
    try {
      await featureRequests.delete(id);
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const statusColors: Record<FeatureRequestStatus, string> = {
    open: '#3b82f6',
    in_progress: '#f59e0b',
    done: '#10b981',
    rejected: '#ef4444',
  };

  const priorityColors: Record<FeatureRequestPriority, string> = {
    low: '#9ca3af',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div>
      <h1 className="page-title">Feature Requests & Bug Reports</h1>

      {error && <div className="error-box">{error}</div>}

      {/* Filters */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FeatureRequestStatus | '')}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}
        >
          <option value="">Alle Status</option>
          <option value="open">Offen</option>
          <option value="in_progress">In Bearbeitung</option>
          <option value="done">Erledigt</option>
          <option value="rejected">Abgelehnt</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FeatureRequestType | '')}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}
        >
          <option value="">Alle Typen</option>
          <option value="feature">💡 Feature</option>
          <option value="bug">🐛 Bug</option>
        </select>
        <span className="text-sm text-muted" style={{ lineHeight: '36px' }}>
          {requests.length} Requests
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <p>📭 Keine Requests gefunden</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>{r.type === 'bug' ? '🐛' : '💡'}</span>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{r.title}</h3>
                </div>
                <button className="btn-sm btn-danger" onClick={() => handleDelete(r.id)}>
                  🗑️
                </button>
              </div>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '8px 0', lineHeight: 1.5 }}>
                {r.description}
              </p>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                Von {r.user?.name || 'Unbekannt'} ({r.user?.email || ''}) ·{' '}
                {formatDate(r.createdAt)}
              </div>
              <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                <div className="flex gap-1 items-center">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Status:</span>
                  <select
                    value={r.status}
                    onChange={(e) => handleUpdateStatus(r.id, e.target.value as FeatureRequestStatus)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                      background: statusColors[r.status],
                      cursor: 'pointer',
                    }}
                  >
                    <option value="open">Offen</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="done">Erledigt</option>
                    <option value="rejected">Abgelehnt</option>
                  </select>
                </div>
                <div className="flex gap-1 items-center">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                    Priorität:
                  </span>
                  <select
                    value={r.priority}
                    onChange={(e) => handleUpdatePriority(r.id, e.target.value as FeatureRequestPriority)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                      background: priorityColors[r.priority],
                      cursor: 'pointer',
                    }}
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
