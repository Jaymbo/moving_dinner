import React, { useState } from 'react';

export default function CopyButton({ text, label }: { text: string; label?: string }) {
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
      {copied ? '✅ Kopiert!' : label || '📋 Kopieren'}
    </button>
  );
}
