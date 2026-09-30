import { isStateCancellable, isStateRetryable } from '../../lib/transfers';
import React, { useMemo, useState } from 'react';
import { Button, Dropdown, Icon } from 'semantic-ui-react';

const getRetryableFiles = ({ files, retryOption }) => {
  switch (retryOption) {
    case 'Errored':
      return files.filter((file) =>
        [
          'Completed, TimedOut',
          'Completed, Errored',
          'Completed, Rejected',
        ].includes(file.state),
      );
    case 'Cancelled':
      return files.filter((file) => file.state === 'Completed, Cancelled');
    case 'All':
      return files.filter((file) => isStateRetryable(file.state));
    default:
      return [];
  }
};

const getCancellableFiles = ({ cancelOption, files }) => {
  switch (cancelOption) {
    case 'All':
      return files.filter((file) => isStateCancellable(file.state));
    case 'Queued':
      return files.filter((file) =>
        ['Queued, Locally', 'Queued, Remotely'].includes(file.state),
      );
    case 'In Progress':
      return files.filter((file) => file.state === 'InProgress');
    default:
      return [];
  }
};

const getRemovableFiles = ({ files, removeOption }) => {
  switch (removeOption) {
    case 'Succeeded':
      return files.filter((file) => file.state === 'Completed, Succeeded');
    case 'Errored':
      return files.filter((file) =>
        [
          'Completed, TimedOut',
          'Completed, Errored',
          'Completed, Rejected',
        ].includes(file.state),
      );
    case 'Cancelled':
      return files.filter((file) => file.state === 'Completed, Cancelled');
    case 'Completed':
      return files.filter((file) => file.state.includes('Completed'));
    default:
      return [];
  }
};

// a compact button that acts on every matching transfer, so it fits beside the
// tabs, with a menu for which ones; the tooltip says exactly what it will do
const ActionButton = ({
  color,
  content,
  disabled,
  icon,
  label,
  loading,
  onChange,
  onClick,
  options,
  value,
}) => (
  <Button.Group
    className="transfers-action"
    color={color}
    size="tiny"
  >
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      <Icon
        loading={loading}
        name={icon}
      />
      {content}
    </Button>
    <Dropdown
      aria-label={`Choose what to ${content.toLowerCase()}`}
      className="button icon"
      disabled={disabled}
      onChange={onChange}
      options={options}
      title={`Choose what to ${content.toLowerCase()}`}
      // an empty trigger, since a null one shows the selected option's text
      trigger={<span />}
      value={value}
    />
  </Button.Group>
);

const TransfersActions = ({
  cancelling = false,
  direction,
  onCancelAll,
  onRemoveAll,
  onRetryAll,
  removing = false,
  retrying = false,
  server = { isConnected: true },
  transfers,
}) => {
  const [removeOption, setRemoveOption] = useState('Succeeded');
  const [cancelOption, setCancelOption] = useState('All');
  const [retryOption, setRetryOption] = useState('Errored');

  const files = useMemo(() => {
    return transfers
      .reduce((accumulator, username) => {
        const allUserFiles = username.directories.reduce(
          (directoryAccumulator, directory) => {
            return directoryAccumulator.concat(directory.files);
          },
          [],
        );

        return accumulator.concat(allUserFiles);
      }, [])
      .filter((file) => file.direction.toLowerCase() === direction);
  }, [direction, transfers]);

  if (files.length === 0) {
    return null;
  }

  const working = retrying || cancelling || removing;

  return (
    <div className="transfers-actions">
      {direction !== 'upload' && (
        <ActionButton
          color="green"
          content="Retry"
          disabled={working || !server.isConnected}
          icon="redo"
          label={`Retry ${retryOption === 'All' ? retryOption : `All ${retryOption}`}`}
          loading={retrying}
          onChange={(_, data) => setRetryOption(data.value)}
          onClick={() => onRetryAll(getRetryableFiles({ files, retryOption }))}
          options={[
            { key: 'errored', text: 'Errored', value: 'Errored' },
            { key: 'cancelled', text: 'Cancelled', value: 'Cancelled' },
            { key: 'all', text: 'All', value: 'All' },
          ]}
          value={retryOption}
        />
      )}
      <ActionButton
        color="red"
        content="Cancel"
        disabled={working}
        icon="x"
        label={`Cancel ${cancelOption === 'All' ? cancelOption : `All ${cancelOption}`}`}
        loading={cancelling}
        onChange={(_, data) => setCancelOption(data.value)}
        onClick={() =>
          onCancelAll(getCancellableFiles({ cancelOption, files }))
        }
        options={[
          { key: 'all', text: 'All', value: 'All' },
          { key: 'queued', text: 'Queued', value: 'Queued' },
          { key: 'inProgress', text: 'In Progress', value: 'In Progress' },
        ]}
        value={cancelOption}
      />
      <ActionButton
        content="Remove"
        disabled={working}
        icon="trash alternate"
        label={`Remove All ${removeOption}`}
        loading={removing}
        onChange={(_, data) => setRemoveOption(data.value)}
        onClick={() => onRemoveAll(getRemovableFiles({ files, removeOption }))}
        options={[
          { key: 'succeeded', text: 'Succeeded', value: 'Succeeded' },
          { key: 'errored', text: 'Errored', value: 'Errored' },
          { key: 'cancelled', text: 'Cancelled', value: 'Cancelled' },
          { key: 'completed', text: 'Completed', value: 'Completed' },
        ]}
        value={removeOption}
      />
    </div>
  );
};

export default TransfersActions;
