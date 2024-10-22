import React, { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';
import moment from 'moment'; // moment 라이브러리 사용
import { Button, List } from 'antd'; // Ant Design의 Button 및 List 컴포넌트 사용

const GoogleCalendar = ({ scheduleStart, scheduleEnd ,setOverlappingEvents}) => {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  
  useEffect(() => {
    const listCalendars = () => {
      gapi.client.calendar.calendarList.list().then(response => {
        const calendars = response.result.items;
        setCalendars(calendars);
      }).catch(error => {
        console.error('Error fetching calendars:', error);
      });
    };

    listCalendars();
  }, []);

  const fetchEvents = (calendarId) => {
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    gapi.client.calendar.events.list({
      'calendarId': calendarId,
      'timeMin': now.toISOString(),
      'timeMax': oneYearFromNow.toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'maxResults': 1000,
      'orderBy': 'startTime'
    }).then(response => {
      const events = response.result.items.map(event => {
        const eventDetails = {
          title: event.summary,
          start: moment(new Date(event.start.dateTime || event.start.date)),
          end: moment(new Date(event.end.dateTime || event.end.date)),
        };

        // 겹치는 일정 확인
        if (moment(scheduleStart).isBefore(eventDetails.end) && moment(scheduleEnd).isAfter(eventDetails.start)) {
          console.log(`겹치는 구글 캘린더 일정: ${eventDetails.title}`);
          setOverlappingEvents(prev => [...prev, eventDetails]); // 겹치는 일정 추가
        }

        return eventDetails;
      });
      
      setEvents(events);
    }).catch(error => {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);      //캘린더
    });
  };

  return (
    <div>
      <h2>Available Calendars</h2>
      <List
        dataSource={calendars}
        renderItem={calendar => (
          <List.Item>
            <Button onClick={() => fetchEvents(calendar.id)}>
              {calendar.summary} 일정 불러오기
            </Button>
          </List.Item>
        )}
      />

      <h2>Events</h2>
      <ul>
        {events.length > 0 ? (
          events.map((event, index) => (
            <li key={index}>
              <strong>{event.title}</strong><br/>
              {moment(event.start).format('YYYY-MM-DD HH:mm')} - {moment(event.end).format('YYYY-MM-DD HH:mm')}     
            </li>
          ))
        ) : (
          <li>No events found</li>
        )}
      </ul>
    </div>
  );
};

export default GoogleCalendar;
