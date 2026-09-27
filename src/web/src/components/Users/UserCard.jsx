import { loadCountry, loadInfo } from '../../lib/userInfo';
import UserLink from '../Shared/UserLink';
import CountryFlag from './CountryFlag';
import { toPictureUrl } from './UserProfile';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from 'semantic-ui-react';

// start loading a little before a card scrolls into view
const visibleMargin = '200px';

const useVisible = (ref) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (visible || !element) {
      return undefined;
    }

    if (typeof IntersectionObserver !== 'function') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
        }
      },
      { rootMargin: visibleMargin },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, visible]);

  return visible;
};

// requests are only made once the card is on screen. user info needs a peer
// connection, and some users can't be reached at all.
const useLoader = ({ enabled, load, username }) => {
  const [state, setState] = useState({ loading: enabled });

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false });
      return undefined;
    }

    let cancelled = false;
    const { promise, release } = load(username);
    setState({ loading: true });

    const settle = async () => {
      const value = await promise;

      if (!cancelled) {
        setState({ loading: false, value });
      }
    };

    settle();

    return () => {
      cancelled = true;
      release();
    };
  }, [enabled, load, username]);

  return state;
};

const UserCard = ({ description, isSelf, onOpen, username }) => {
  const ref = useRef();
  const visible = useVisible(ref);
  const { loading, value: info } = useLoader({
    enabled: visible && !isSelf,
    load: loadInfo,
    username,
  });
  const { value: country } = useLoader({
    enabled: visible,
    load: loadCountry,
    username,
  });

  const picture = useMemo(
    () => (info?.hasPicture ? toPictureUrl(info.picture) : undefined),
    [info],
  );
  const text = (isSelf ? description : info?.description)?.trim();

  let summary;

  if (text) {
    summary = <span className="interests-user-description">{text}</span>;
  } else if (loading || (!visible && !isSelf)) {
    summary = <span className="user-profile-muted">Loading…</span>;
  } else if (info === null) {
    summary = <span className="user-profile-muted">Couldn&apos;t reach</span>;
  } else {
    summary = <span className="user-profile-muted">No description</span>;
  }

  // the whole card opens the full profile, and the name, like names everywhere
  // else, opens the side panel; the card's button sits behind the name
  return (
    <div
      className="interests-user"
      ref={ref}
    >
      <button
        aria-label={`Open ${username}'s full profile`}
        className="interests-user-open"
        onClick={onOpen}
        title={`Open ${username}'s full profile`}
        type="button"
      />
      <span className="interests-user-picture">
        {picture ? (
          <img
            alt=""
            src={picture}
          />
        ) : (
          <Icon
            fitted
            name="user"
          />
        )}
      </span>
      <span className="interests-user-text">
        <span className="interests-user-heading">
          <UserLink
            className="interests-user-name"
            username={username}
          />
          {isSelf && <span className="user-profile-muted">(you)</span>}
          <CountryFlag code={country} />
        </span>
        {summary}
      </span>
    </div>
  );
};

export default UserCard;
