'use client';

import { useState } from 'react';
import type { NetworkEvent } from '@/lib/types';

interface NetworkTrailProps {
  events: NetworkEvent[];
}

export default function NetworkTrail({ events }: NetworkTrailProps) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  return (
    <div className="mt-4" style={{ border: '1px solid var(--border)' }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-xs tracking-widest"
        style={{ color: 'var(--muted)' }}
        onClick={() => setOpen(o => !o)}
      >
        <span>
          NETWORK TRAIL{' '}
          <span style={{ color: 'var(--fg)' }}>{events.length} requests</span>
        </span>
        <span>{open ? '▲ HIDE' : '▼ SHOW'}</span>
      </button>

      {open && (
        <div
          className="border-t text-xs leading-relaxed"
          style={{ borderColor: 'var(--border)', maxHeight: '280px', overflowY: 'auto' }}
        >
          {events.map((e, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Status indicator */}
              {e.cached ? (
                <span className="shrink-0 w-12 text-center text-xs px-1" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>CACHE</span>
              ) : e.ok === undefined ? (
                <span className="shrink-0 w-12 text-center" style={{ color: 'var(--muted)' }}>...</span>
              ) : e.ok ? (
                <span className="shrink-0 w-12 text-center" style={{ color: 'var(--clean)' }}>{e.status ?? 'OK'}</span>
              ) : (
                <span className="shrink-0 w-12 text-center" style={{ color: 'var(--critical)' }}>{e.status ?? 'ERR'}</span>
              )}

              {/* Package */}
              <span className="shrink-0 w-32 truncate" style={{ color: 'var(--warning)' }}>{e.pkg}</span>

              {/* Label */}
              <span className="shrink-0 w-28" style={{ color: 'var(--muted)' }}>{e.label}</span>

              {/* URL */}
              {e.url.startsWith('http') ? (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate"
                  style={{ color: 'var(--fg)', opacity: 0.6, textDecoration: 'none' }}
                  onMouseEnter={ev => (ev.currentTarget.style.opacity = '1')}
                  onMouseLeave={ev => (ev.currentTarget.style.opacity = '0.6')}
                >
                  {e.url}
                </a>
              ) : (
                <span className="flex-1 truncate" style={{ color: 'var(--fg)', opacity: 0.6 }}>{e.url}</span>
              )}

              {/* Timing */}
              {e.ms !== undefined && (
                <span className="shrink-0 text-right" style={{ color: 'var(--muted)' }}>{e.ms}ms</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
