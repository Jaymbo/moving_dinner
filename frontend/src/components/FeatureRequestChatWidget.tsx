import React, { useState, useEffect, useRef } from 'react';
import { featureRequests } from '../api/client';

export default function FeatureRequestChatWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'new' | 'my'>('new');
  const [type, setType] = useState<'bug' | 'feature'>('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && tab === 'my') {
      loadMyRequests();
    }
  }, [open, tab]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [myRequests]);

  async function loadMyRequests() {
    setLoadingRequests(true);
    try {
      const data = await featureRequests.my();
      setMyRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await featureRequests.create({ type, title: title.trim(), description: description.trim() });
      setSuccess('Vielen Dank! Dein Request wurde gesendet.');
      setTitle('');
      setDescription('');
      setTab('my');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      open: '#3b82f6',
      in_progress: '#f59e0b',
      done: '#10b981',
      rejected: '#ef4444',
    };
    const labels: Record<string, string> = {
      open: 'Offen',
      in_progress: 'In Bearbeitung',
      done: 'Erledigt',
      rejected: 'Abgelehnt',
    };
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        color: '#fff',
        background: colors[status] || '#6b7280',
      }}>
        {labels[status] || status}
      </span>
    );
  }

  function priorityBadge(priority: string) {
    const colors: Record<string, string> = {
      low: '#9ca3af',
      medium: '#f59e0b',
      high: '#ef4444',
    };
    const labels: Record<string, string> = {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch',
    };
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        color: '#fff',
        background: colors[priority] || '#6b7280',
      }}>
        {labels[priority] || priority}
      </span>
    );
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: open ? '#6b7280' : '#3b82f6',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        title="Feedback & Feature Requests"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 92,
            right: 24,
            width: 'calc(100vw - 48px)',
            maxWidth: 380,
            maxHeight: '70vh',
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: '#3b82f6',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            💬 Feedback & Requests
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setTab('new')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                background: tab === 'new' ? '#eff6ff' : 'transparent',
                fontWeight: tab === 'new' ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              ✏️ Neu
            </button>
            <button
              onClick={() => setTab('my')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                background: tab === 'my' ? '#eff6ff' : 'transparent',
                fontWeight: tab === 'my' ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              📋 Meine Requests
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            {success && <div style={{ color: '#10b981', fontSize: 13, marginBottom: 8 }}>{success}</div>}

            {tab === 'new' ? (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Art</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setType('feature')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: `2px solid ${type === 'feature' ? '#3b82f6' : '#e5e7eb'}`,
                        borderRadius: 8,
                        background: type === 'feature' ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: type === 'feature' ? 700 : 400,
                      }}
                    >
                      💡 Feature
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('bug')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: `2px solid ${type === 'bug' ? '#ef4444' : '#e5e7eb'}`,
                        borderRadius: 8,
                        background: type === 'bug' ? '#fef2f2' : '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: type === 'bug' ? 700 : 400,
                      }}
                    >
                      🐛 Bug
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Titel</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Kurze Zusammenfassung"
                    required
                    maxLength={200}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Beschreibung</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Beschreibe dein Problem oder deine Idee..."
                    required
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 13,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Senden...' : '📩 Absenden'}
                </button>
              </form>
            ) : (
              <div>
                {loadingRequests ? (
                  <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Laden...</p>
                ) : myRequests.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Noch keine Requests gesendet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {myRequests.map((r: any) => (
                      <div
                        key={r.id}
                        style={{
                          padding: 10,
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          background: '#f9fafb',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>{r.type === 'bug' ? '🐛' : '💡'}</span>
                          <strong style={{ fontSize: 13, flex: 1 }}>{r.title}</strong>
                        </div>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0', lineHeight: 1.4 }}>
                          {r.description}
                        </p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                          {statusBadge(r.status)}
                          {priorityBadge(r.priority)}
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{formatDate(r.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}