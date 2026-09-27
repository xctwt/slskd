import React from 'react';

const segments = [
  { key: 'succeeded', label: 'completed' },
  { key: 'active', label: 'in progress' },
  { key: 'queued', label: 'queued' },
  { key: 'failed', label: 'errored' },
  { key: 'cancelled', label: 'cancelled' },
];

// one bar per user, split by how many of their files are in each state
const TransferStatusBar = ({ counts, progress }) => {
  const parts = segments.filter(({ key }) => counts[key] > 0);
  const others = parts
    .filter(({ key }) => key !== 'succeeded')
    .map(({ key, label: name }) => `${counts[key].toLocaleString()} ${name}`);

  const label = [
    `${counts.succeeded.toLocaleString()}/${counts.all.toLocaleString()} done`,
    ...others,
  ].join(' · ');

  return (
    <div
      aria-label={`${label}, ${Math.floor(progress * 100)}% transferred`}
      className="transfer-status"
      role="img"
      title={`${label}\n${Math.floor(progress * 100)}% of bytes transferred`}
    >
      {parts.map(({ key }) => (
        <span
          className={`transfer-status-segment transfer-status-${key}`}
          key={key}
          style={{ flexGrow: counts[key] }}
        />
      ))}
      <span
        aria-hidden="true"
        className="transfer-status-label"
      >
        {label}
      </span>
    </div>
  );
};

export default TransferStatusBar;
