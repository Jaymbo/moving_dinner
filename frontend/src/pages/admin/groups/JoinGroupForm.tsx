import React, { useState } from 'react';
import { join } from '../../../api/client';

interface JoinGroupFormProps {
  onJoined: () => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}

export default function JoinGroupForm({ onJoined, onMessage, onError }: JoinGroupFormProps) {
  const [code, setCode] = useState('');
  const [joinGroup, setJoinGroup] = useState<any>(null);
  const [joining, setJoining] = useState(false);

  async function handleLookup() {
    setJoinGroup(null);
    try {
      const result = await join.lookup(code);
      setJoinGroup(result.group);
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleJoin() {
    setJoining(true);
    try {
      await join.join(code);
      onMessage('Gruppe beigetreten!');
      setCode('');
      setJoinGroup(null);
      onJoined();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="card mb-4">
      <h3>Gruppe beitreten</h3>
      <div className="flex flex-wrap gap-2 mt-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Einladungscode eingeben"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-primary" onClick={handleLookup}>
          Suchen
        </button>
      </div>
      {joinGroup && (
        <div className="card mt-4" style={{ background: '#f0fdf4' }}>
          <h4>{joinGroup.name}</h4>
          <p className="text-sm text-muted">{joinGroup.description || 'Keine Beschreibung'}</p>
          <button className="btn-primary mt-2" onClick={handleJoin} disabled={joining}>
            {joining ? 'Beitreten...' : 'Gruppe beitreten'}
          </button>
        </div>
      )}
    </div>
  );
}
