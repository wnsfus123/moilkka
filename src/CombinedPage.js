import React, { useState } from 'react';
import EventDashboard from './EventDashboard';
import CreateEvent from './CreateEvent';
import './CombinedPage.css';

const CombinedPage = () => {
  const [activeTab, setActiveTab] = useState('events');

  return (
    <div className="combined-page">
      <div className="combined-desktop">
        <div className="combined-panel">
          <EventDashboard />
        </div>
        <div className="combined-panel">
          <CreateEvent />
        </div>
      </div>

      <div className="combined-mobile">
        <div className="mobile-tabs-bar">
          <button
            className={`mobile-tabs-btn${activeTab === 'events' ? ' active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            내 모임 목록
          </button>
          <button
            className={`mobile-tabs-btn${activeTab === 'create' ? ' active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            새 모임 만들기
          </button>
        </div>
        <div className="mobile-tab-panel">
          {activeTab === 'events' ? <EventDashboard /> : <CreateEvent />}
        </div>
      </div>
    </div>
  );
};

export default CombinedPage;
