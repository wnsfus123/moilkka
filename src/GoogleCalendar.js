import React, { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';
import { format, isBefore, isAfter } from 'date-fns';
import { Button, List } from 'antd';

const GoogleCalendar = ({ scheduleStart, scheduleEnd, setOverlappingEvents }) => {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);

  useEffect(() => {
    const listCalendars = () => {
      gapi.client.calendar.calendarList.list().then(response => {
        const items = response.result.items.map(calendar => ({
          ...calendar,
          summary: calendar.summary.includes('@gmail.com')
            ? calendar.summary.split('@')[0]
            : calendar.summary,
        }));
        setCalendars(items);
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
      calendarId,
      timeMin: now.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 1000,
      orderBy: 'startTime',
    }).then(response => {
      const fetched = response.result.items.map(event => {
        const eventDetails = {
          title: event.summary,
          start: new Date(event.start.dateTime || event.start.date),
          end: new Date(event.end.dateTime || event.end.date),
        };

        if (isBefore(scheduleStart, eventDetails.end) && isAfter(scheduleEnd, eventDetails.start)) {
          console.log(`겹치는 구글 캘린더 일정: ${eventDetails.title}`);
          setOverlappingEvents(prev => [...prev, eventDetails]);
        }

        return eventDetails;
      });
      setEvents(fetched);
    }).catch(error => {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);
    });
  };

  return (
    <div>
      <h2>나의 일정</h2>
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
      <h2>일정</h2>
      <ul>
        {events.length > 0 ? (
          events.map((event, index) => (
            <li key={index}>
              <strong>{event.title}</strong><br />
              {format(event.start, 'yyyy-MM-dd HH:mm')} - {format(event.end, 'yyyy-MM-dd HH:mm')}
            </li>
          ))
        ) : (
          <li>일정이 없습니다.</li>
        )}
      </ul>
    </div>
  );
};

export default GoogleCalendar;
