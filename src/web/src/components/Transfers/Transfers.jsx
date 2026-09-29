import './Transfers.css';
import * as transfersLibrary from '../../lib/transfers';
import {
  countByTab,
  filterByTab,
  sortOptions,
  sortUsers,
  tabs,
} from '../../lib/transferView';
import { getErrorMessage } from '../../lib/util';
import { LoaderSegment, PlaceholderSegment } from '../Shared';
import TransferGroup from './TransferGroup';
import TransfersHeader from './TransfersHeader';
import TransfersToolbar from './TransfersToolbar';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const defaultView = { descending: true, sortBy: 'added', tab: 'all' };

const viewKey = (direction) => `slskd-transfers-${direction}-view`;

// the tab and order are remembered separately for downloads and uploads
const loadView = (direction) => {
  try {
    const saved = {
      ...defaultView,
      ...JSON.parse(localStorage.getItem(viewKey(direction)) ?? '{}'),
    };

    return {
      descending: Boolean(saved.descending),
      sortBy: sortOptions.some(({ key }) => key === saved.sortBy)
        ? saved.sortBy
        : defaultView.sortBy,
      tab: tabs.some(({ key }) => key === saved.tab)
        ? saved.tab
        : defaultView.tab,
    };
  } catch {
    return defaultView;
  }
};

const Transfers = ({ direction, server }) => {
  const [connecting, setConnecting] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [view, setView] = useState(() => loadView(direction));
  const [expanded, setExpanded] = useState(() => new Set());

  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetch = async () => {
    try {
      const response = await transfersLibrary.getAll({ direction });
      setTransfers(response ?? []);
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
    }
  };

  useEffect(() => {
    setConnecting(true);

    const init = async () => {
      await fetch();
      setConnecting(false);
    };

    init();
    const interval = window.setInterval(fetch, 1_000);

    return () => {
      clearInterval(interval);
    };
  }, [direction]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setView(loadView(direction));
    setExpanded(new Set());
  }, [direction]);

  const updateView = (patch) => {
    setView((previous) => {
      const next = { ...previous, ...patch };
      localStorage.setItem(viewKey(direction), JSON.stringify(next));
      return next;
    });
  };

  const counts = useMemo(() => countByTab(transfers), [transfers]);

  const shown = useMemo(
    () =>
      sortUsers(filterByTab(transfers, view.tab), view.sortBy, view.descending),
    [transfers, view],
  );

  const allExpanded =
    shown.length > 0 && shown.every((user) => expanded.has(user.username));

  const toggleUser = (username) =>
    setExpanded((previous) => {
      const next = new Set(previous);

      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }

      return next;
    });

  const toggleAll = () =>
    setExpanded(
      allExpanded ? new Set() : new Set(shown.map((user) => user.username)),
    );

  useMemo(() => {
    // this is used to prevent weird update issues if switching
    // between uploads and downloads.  useEffect fires _after_ the
    // prop 'direction' updates, meaning there's a flash where the
    // screen contents switch to the new direction for a brief moment
    // before the connecting animation shows.  this memo fires the instant
    // the direction prop changes, preventing this flash.
    setConnecting(true);
  }, [direction]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async ({ file, suppressStateChange = false }) => {
    const { filename, size, username } = file;

    try {
      if (!suppressStateChange) setRetrying(true);
      await transfersLibrary.download({
        files: [{ filename, size }],
        username,
      });
      if (!suppressStateChange) setRetrying(false);
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
      if (!suppressStateChange) setRetrying(false);
    }
  };

  const retryAll = async (transfersToRetry) => {
    setRetrying(true);

    try {
      const { failed } =
        await transfersLibrary.retryDownloads(transfersToRetry);

      if (failed.length > 0) {
        const count = failed.reduce((total, user) => total + user.count, 0);
        const [first] = failed;

        toast.error(
          `Couldn't retry ${count} download${count === 1 ? '' : 's'} from ${
            failed.length === 1 ? first.username : `${failed.length} users`
          }: ${getErrorMessage(first.error)}`,
        );
      }
    } finally {
      setRetrying(false);
    }
  };

  const cancel = async ({ file, suppressStateChange = false }) => {
    const { id, username } = file;

    try {
      if (!suppressStateChange) setCancelling(true);
      await transfersLibrary.cancel({ direction, id, username });
      if (!suppressStateChange) setCancelling(false);
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
      if (!suppressStateChange) setCancelling(false);
    }
  };

  const cancelAll = async (transfersToCancel) => {
    setCancelling(true);
    await Promise.all(
      transfersToCancel.map((file) =>
        cancel({ file, suppressStateChange: true }),
      ),
    );
    setCancelling(false);
  };

  const remove = async ({ file, suppressStateChange = false }) => {
    const { id, username } = file;

    try {
      if (!suppressStateChange) setRemoving(true);
      await transfersLibrary.cancel({ direction, id, remove: true, username });
      if (!suppressStateChange) setRemoving(false);
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
      if (!suppressStateChange) setRemoving(false);
    }
  };

  const removeAll = async (transfersToRemove) => {
    setRemoving(true);
    await Promise.all(
      transfersToRemove.map((file) =>
        remove({ file, suppressStateChange: true }),
      ),
    );
    setRemoving(false);
  };

  if (connecting) {
    return <LoaderSegment />;
  }

  return (
    <>
      <TransfersHeader
        cancelling={cancelling}
        direction={direction}
        onCancelAll={cancelAll}
        onRemoveAll={removeAll}
        onRetryAll={retryAll}
        removing={removing}
        retrying={retrying}
        server={server}
        transfers={transfers}
      />
      {/* tabs that sit on the panel below */}
      {transfers.length > 0 && (
        <TransfersToolbar
          allExpanded={allExpanded}
          counts={counts}
          onSortChange={updateView}
          onTabChange={(tab) => updateView({ tab })}
          onToggleExpanded={toggleAll}
          view={view}
        />
      )}
      {/* the tabs sit on this panel, and the list sits inside it */}
      <div className={transfers.length > 0 ? 'transfers-panel' : undefined}>
        {shown.length === 0 ? (
          <PlaceholderSegment
            caption={
              transfers.length === 0 || view.tab === 'all'
                ? `No ${direction}s to display`
                : `No ${tabs
                    .find(({ key }) => key === view.tab)
                    ?.label.toLowerCase()} ${direction}s`
            }
            icon={direction}
          />
        ) : (
          <div className="transfer-users">
            {shown.map((user) => (
              <TransferGroup
                cancel={cancel}
                cancelAll={cancelAll}
                direction={direction}
                expanded={expanded.has(user.username)}
                key={user.username}
                onToggle={() => toggleUser(user.username)}
                remove={remove}
                removeAll={removeAll}
                retry={retry}
                retryAll={retryAll}
                user={user}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Transfers;
