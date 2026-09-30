import { urlBase } from '../../config';
import AppContext from '../AppContext';
import { Section, UserList } from './Interests';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';

export const groupsPath = () => `${urlBase}/groups`;

const settingsPath = `${urlBase}/settings/users`;

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

// the user groups defined in the config and who is in them, shown like the
// interests lists; groups are edited in settings
const Groups = () => {
  const { options = {}, state = {} } = useContext(AppContext) ?? {};
  const selfUsername = state.user?.username;
  const groups = Object.entries(
    options.transfers?.groups?.userDefined ?? {},
  ).sort(([a], [b]) => byName(a, b));

  if (groups.length === 0) {
    return (
      <div className="interests">
        <p className="user-profile-muted">
          No user groups yet.{' '}
          <Link to={settingsPath}>Create one in Settings</Link>, like a
          "buddies" group, then use <code>prefer:buddies</code> in search
          filters to put its members first.
        </p>
      </div>
    );
  }

  return (
    <div className="interests">
      <p className="user-profile-muted">
        Use <code>prefer:{groups[0][0].toLowerCase()}</code> in search filters
        to put a group's members first.{' '}
        <Link to={settingsPath}>Edit groups in Settings</Link>
      </p>
      {groups.map(([name, group]) => {
        const members = [...(group?.members ?? [])].sort(byName);

        return (
          <Section
            count={members.length}
            icon="users"
            key={name}
            title={name}
          >
            <UserList
              empty="Nobody in this group yet"
              selfUsername={selfUsername}
              usernames={members}
            />
          </Section>
        );
      })}
    </div>
  );
};

export default Groups;
