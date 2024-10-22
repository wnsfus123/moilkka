import { gapi } from 'gapi-script';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.events"; // 일정 추가를 위해 SCOPES 변경

// 구글 API 초기화
export const initGoogleAPI = () => {
  return gapi.load('client:auth2', () => {
    gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES,
    });
  });
};

// 구글 로그인
export const signInWithGoogle = () => {
  return gapi.auth2.getAuthInstance().signIn();
};

// 구글 로그아웃
export const signOutFromGoogle = () => {
  return gapi.auth2.getAuthInstance().signOut();
};

// 구글 로그인 상태 확인
export const isGoogleSignedIn = () => {
  return gapi.auth2.getAuthInstance().isSignedIn.get();
};

// 구글 캘린더에 이벤트 추가하기
export const addEventToGoogleCalendar = (event) => {
  return gapi.client.calendar.events.insert({
    calendarId: 'primary', // 기본 캘린더에 추가
    resource: event // 일정 정보
  });
};
