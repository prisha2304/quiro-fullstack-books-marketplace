import React from 'react';
import NotificationDropdown from './NotificationDropdown';
import NotificationBell from './NotificationBell';

const NotificationCenter = (props) => {
  return <NotificationBell {...props} />;
};

export default NotificationCenter;
export { NotificationBell, NotificationDropdown };
