import { sortOptions, tabs } from '../../lib/transferView';
import React from 'react';
import { Button, Dropdown } from 'semantic-ui-react';

// tabs that filter transfers by state, and controls for ordering users
const TransfersToolbar = ({
  allExpanded,
  counts,
  onSortChange,
  onTabChange,
  onToggleExpanded,
  view,
}) => (
  <div className="transfers-toolbar">
    <div
      aria-label="Filter by state"
      className="transfers-tabs"
      role="group"
    >
      {tabs.map(({ key, label }) => (
        <button
          aria-pressed={view.tab === key}
          className={`transfers-tab ${view.tab === key ? 'active' : ''}`}
          key={key}
          onClick={() => onTabChange(key)}
          type="button"
        >
          {label}
          <span className="transfers-tab-count">
            {counts[key].toLocaleString()}
          </span>
        </button>
      ))}
    </div>
    <div className="transfers-sort">
      <Dropdown
        aria-label="Sort by"
        inline
        onChange={(_event, { value }) => onSortChange({ sortBy: value })}
        options={sortOptions.map(({ key, label }) => ({
          key,
          text: label,
          value: key,
        }))}
        value={view.sortBy}
      />
      <Button
        aria-label={view.descending ? 'Descending' : 'Ascending'}
        basic
        compact
        icon={view.descending ? 'sort amount down' : 'sort amount up'}
        onClick={() => onSortChange({ descending: !view.descending })}
        size="small"
        title={
          view.descending
            ? 'Descending (click for ascending)'
            : 'Ascending (click for descending)'
        }
      />
      <Button
        basic
        compact
        content={allExpanded ? 'Collapse all' : 'Expand all'}
        icon={allExpanded ? 'compress' : 'expand'}
        onClick={onToggleExpanded}
        size="small"
      />
    </div>
  </div>
);

export default TransfersToolbar;
