import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"; // BrowserRouter를 사용하기 위해 수정
import CreateEvent from "./CreateEvent";
import EventPage from "./EventPage";
import HelpSection from "./HelpSection";
import AddLayout from "./Components/AddLayout";
import GetToken from "./GetToken";
import LoginSuccess from "./LoginSuccess";
import Loginpage from "./Loginpage";
import GoogleCalendar from "./GoogleCalendar";
import CombinedPage from "./CombinedPage";
import CalendarPage from "./CalendarPage";
import TimetablePage from "./TimetablePage";
import MannalkaPage from "./MannalkaPage";
import MannalkaManagePage from "./MannalkaManagePage";
import BookingPage from "./BookingPage";
import ProfilePage from "./ProfilePage";

const TestRedirect = () => {
  const location = useLocation();
  return <Navigate replace to={`/meet${location.pathname.replace(/^\/test/, '')}${location.search}`} />;
};

const App = () => {
  return (
      <div className="app">
        <Router> {/* BrowserRouter로 변경 */}
          <Routes> 
            <Route path="/" element={<AddLayout />}>
              <Route path="/create" element={<CreateEvent />} />
              <Route path="/main" element={<Loginpage />} />
              <Route path="/meet" element={<EventPage />} />
              <Route path="/meet/:uuid" element={<EventPage />} />
              <Route path="/test" element={<TestRedirect />} />
              <Route path="/test/*" element={<TestRedirect />} />
              <Route path="/help" element={<HelpSection />} />
              <Route path='/auth' element={<GetToken />} />
              <Route path='/LoginSuccess' element={<LoginSuccess/>} />
              <Route path='/google' element={<GoogleCalendar />} />
              <Route path='/event' element={<CombinedPage />} />
              <Route path='/calendar' element={<CalendarPage />} />
              <Route path='/timetable' element={<TimetablePage />} />
              <Route path='/mannalka' element={<MannalkaPage />} />
              <Route path='/mannalka/manage/:uuid' element={<MannalkaManagePage />} />
              <Route path='/book/:uuid' element={<BookingPage />} />
              <Route path='/profile' element={<ProfilePage />} />
            </Route>
            <Route index={true} element={<Navigate replace to={"/main"}/>} />
          </Routes>
        </Router> {/* Router 태그 종료 */}
      </div>
  );
};

export default App;
