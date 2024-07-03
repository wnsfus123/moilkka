import React, { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';
import dayjs from 'dayjs';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const CLIENT_ID = '993727092994-0f6lcbsel1pk3kt5n7tn8oa06sd93vc0.apps.googleusercontent.com';
const API_KEY = 'AIzaSyB3sPvIDuqx_6d1JNCzSlH0swGPYJT1yak';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

const LoadGoogleCalendar = () => {
  const [events, setEvents] = useState([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [calendars, setCalendars] = useState([]);

  useEffect(() => {
    const initClient = () => {
      gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES,
      }).then(() => {
        const authInstance = gapi.auth2.getAuthInstance();
        setIsSignedIn(authInstance.isSignedIn.get());
        setIsInitialized(true);
        authInstance.isSignedIn.listen(setIsSignedIn);
        console.log('Google API Client initialized');
      }).catch(error => {
        console.error('Error initializing Google API client:', error);
      });
    };

    gapi.load('client:auth2', initClient);
  }, []);

  const handleSignInClick = () => {
    gapi.auth2.getAuthInstance().signIn().catch(error => {
      console.error('Error signing in:', error);
    });
  };

  const handleSignOutClick = () => {
    gapi.auth2.getAuthInstance().signOut().catch(error => {
      console.error('Error signing out:', error);
    });
  };

  const listCalendars = () => {
    gapi.client.calendar.calendarList.list().then(response => {
      const calendars = response.result.items;
      console.log('User calendars:', calendars);
      setCalendars(calendars);
    }).catch(error => {
      console.error('Error fetching calendars:', error);
    });
  };

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
      const events = response.result.items.map(event => ({
        title: event.summary,
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date),
      }));
      console.log(`Fetched events from calendar ${calendarId}:`, events);
      setEvents(events);
    }).catch(error => {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);
    });
  };

  useEffect(() => {
    if (isSignedIn && isInitialized) {
      listCalendars();
    }
  }, [isSignedIn, isInitialized]);

  return (
    <div>
      <h1>Google Calendar Events</h1>
      {isSignedIn ? (
        <div>
          <button onClick={handleSignOutClick}>Sign Out</button>
          <h2>Available Calendars</h2>
          <ul>
            {calendars.map(calendar => (
              <li key={calendar.id}>
                <button onClick={() => fetchEvents(calendar.id)}>
                  Fetch events from {calendar.summary}
                </button>
              </li>
            ))}
          </ul>
          <h2>Calendar</h2>
          <Calendar
            tileContent={({ date, view }) => {
              const event = events.find(event => dayjs(event.start).isSame(date, 'day'));
              return event ? <p>{event.title}</p> : null;
            }}
          />
          <h2>Events</h2>
          <ul>
            {events.length > 0 ? (
              events.map((event, index) => (
                <li key={index}>
                  <strong>{event.title}</strong><br/>
                  {dayjs(event.start).format('YYYY-MM-DD HH:mm')} - {dayjs(event.end).format('YYYY-MM-DD HH:mm')}
                </li>
              ))
            ) : (
              <li>No events found</li>
            )}
          </ul>
        </div>
      ) : (
        <button onClick={handleSignInClick}>Sign In with Google</button>
      )}
    </div>
  );
};

export default LoadGoogleCalendar;
