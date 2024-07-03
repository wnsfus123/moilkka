import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom"; // BrowserRouter를 사용하기 위해 수정
import CreateEvent from "./CreateEvent";
import EventPage from "./EventPage";
import TimeTest from "./TimeTest";
import AddLayout from "./Components/AddLayout";
import Socialkakao from "./Components/Socialkakao";
import GetToken from "./GetToken";
import LoginSuccess from "./LoginSuccess";
import Loginpage from "./Loginpage";
import GoogleCalendar from "./GoogleCalendar";

const App = () => {
  return (
      <div className="app">
        <Router> {/* BrowserRouter로 변경 */}
          <Routes> 
            <Route path="/" element={<AddLayout />}>
              <Route path="/create" element={<CreateEvent />} />
              <Route path="/main" element={<Loginpage />} />
              <Route path="/test" element={<EventPage />} />
              <Route path="/test/:uuid" element={<EventPage />} />
              <Route path="/time" element={<TimeTest />} />
              <Route path='/auth' element={<GetToken />} />
              <Route path='/LoginSuccess' element={<LoginSuccess/>} />
              <Route path='/google' element={<GoogleCalendar />} />
            </Route>
            <Route index={true} element={<Navigate replace to={"/main"}/>} />
          </Routes>
        </Router> {/* Router 태그 종료 */}
      </div>
  );
};

export default App;
