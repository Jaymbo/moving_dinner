import React, { useState } from 'react';

export function getJoinLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button className="btn-sm" onClick={handleCopy} title={text} style={{ fontSize: 12 }}>
      {copied ? '✅ Kopiert!' : (label || '📋 Kopieren')}
    </button>
  );
}

export function getMyRole(group: any, currentUserId?: number): string {
  if (group.members) {
    const m = group.members.find((mem: any) => mem.userId === currentUserId || mem.user?.id === currentUserId);
    if (m) return m.role;
  }
  return group.role || 'member';
}

export function isActualMember(group: any, currentUserId?: number): boolean {
  if (group.members) {
    return group.members.some((mem: any) => mem.userId === currentUserId || mem.user?.id === currentUserId);
  }
  return false;
}