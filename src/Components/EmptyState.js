import React from 'react';

const EmptyState = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon}</div>
    <p className="empty-state-title">{title}</p>
    {description && <p className="empty-state-desc">{description}</p>}
    {actionLabel && onAction && (
      <button className="empty-state-btn" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
