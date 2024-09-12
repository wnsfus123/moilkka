const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const session = require('express-session');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 세션 설정
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // HTTPS를 사용하는 경우 true로 설정합니다.
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 세션 쿠키의 만료 시간 (예: 24시간)
  }
}));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'mysql'
});

connection.connect(err => {
  if (err) {
    console.error('MySQL 데이터베이스에 연결 중 오류 발생:', err.stack);
    return;
  }
  console.log('MySQL 데이터베이스에 연결되었습니다.');
});

http.listen(8080, () => {
  console.log("http://localhost:8080/ 에서 서비스를 시작합니다.");
});

app.use(express.static(path.join(__dirname, '/build')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/build/index.html'));
});

app.get('/api/check-login-status', (req, res) => {
  if (req.session.userInfo) {
    res.json({ isLoggedIn: true, userInfo: req.session.userInfo });
  } else {
    res.json({ isLoggedIn: false });
  }
});

app.post('/api/login', (req, res) => {
  const { token } = req.body;

  axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(response => {
    req.session.userInfo = response.data;
    res.json({ success: true, userInfo: response.data });
  })
  .catch(error => {
    res.status(500).json({ success: false, message: 'Login failed', error });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 이벤트 생성 API
app.post("/api/events", (req, res) => {
  const { uuid, eventName, startDay, endDay, startTime, endTime, kakaoId, nickname, createDay } = req.body;

  const startDateTime = moment(`${startDay} ${startTime}`, 'YYYY-MM-DD HH:mm').format('YYYY-MM-DD HH:mm:ss');
  const endDateTime = moment(`${endDay} ${endTime}`, 'YYYY-MM-DD HH:mm').format('YYYY-MM-DD HH:mm:ss');

  const eventData = {
    uuid: uuid,
    eventname: eventName,
    startday: startDateTime,
    endday: endDateTime,
    kakaoId: kakaoId,
    nickname: nickname,
    createday: createDay
  };

  connection.query('INSERT INTO test SET ?', eventData, (error, results, fields) => {
    if (error) {
      console.error('이벤트 추가 중 오류 발생:', error);
      res.status(500).send('이벤트 추가 중 오류 발생');
      return;
    }

    res.status(200).send('이벤트가 성공적으로 추가되었습니다.');
  });
});

app.post("/api/save-event-schedule", (req, res) => {
  const { kakaoId, nickname, event_name, event_uuid, event_datetime } = req.body;

  const eventData = {
    kakaoId: kakaoId,
    nickname: nickname,
    event_name: event_name,
    event_uuid: event_uuid,
    event_datetime: event_datetime
  };

  connection.query('INSERT INTO eventschedule SET ?', eventData, (error, results, fields) => {
    if (error) {
      console.error('이벤트 스케줄 추가 중 오류 발생:', error);
      res.status(500).send('이벤트 스케줄 추가 중 오류 발생');
      return;
    }

    res.status(200).send('이벤트 스케줄이 성공적으로 추가되었습니다.');
  });
});

app.get("/api/events/:uuid", (req, res) => {
  const { uuid } = req.params;

  connection.query("SELECT * FROM test WHERE uuid = ?", [uuid], (error, results, fields) => {
    if (error) {
      console.error("이벤트를 가져오는 중 오류 발생:", error);
      res.status(500).send("이벤트를 가져오는 중 오류 발생");
      return;
    }

    if (results.length === 0) {
      res.status(404).send("해당 이벤트를 찾을 수 없습니다.");
      return;
    }

    const eventData = results[0];
    res.status(200).json(eventData);
  });
});

app.get("/api/event-schedules/:uuid", (req, res) => {
  const { uuid } = req.params;

  connection.query("SELECT * FROM eventschedule WHERE event_uuid = ?", [uuid], (error, results, fields) => {
    if (error) {
      console.error("이벤트 스케줄을 가져오는 중 오류 발생:", error);
      res.status(500).send("이벤트 스케줄을 가져오는 중 오류 발생");
      return;
    }

    res.status(200).json(results);
  });
});

app.post("/api/save-user-info", (req, res) => {
  const { kakaoId, nickname } = req.body;

  const userInfo = {
    user_id: kakaoId,
    nickname: nickname
  };

  connection.query('INSERT INTO users SET ?', userInfo, (error, results, fields) => {
    if (error) {
      console.error('사용자 정보 추가 중 오류 발생:', error);
      res.status(500).send('사용자 정보 추가 중 오류 발생');
      return;
    }

    res.status(200).send('사용자 정보가 성공적으로 추가되었습니다.');
  });
});

app.delete("/api/delete-event-schedule", (req, res) => {
  const { kakaoId, event_uuid } = req.body;

  connection.query("DELETE FROM eventschedule WHERE kakaoId = ? AND event_uuid = ?", [kakaoId, event_uuid], (error, results, fields) => {
    if (error) {
      console.error("이벤트 스케줄 삭제 중 오류 발생:", error);
      res.status(500).send("이벤트 스케줄 삭제 중 오류 발생");
      return;
    }

    res.status(200).send("이벤트 스케줄이 성공적으로 삭제되었습니다.");
  });
});

// 서버 코드에 추가
app.get("/api/events/user/:kakaoId", (req, res) => {
  const { kakaoId } = req.params;

  connection.query("SELECT * FROM test WHERE kakaoId = ?", [kakaoId], (error, results, fields) => {
    if (error) {
      console.error("이벤트를 가져오는 중 오류 발생:", error);
      res.status(500).send("이벤트를 가져오는 중 오류 발생");
      return;
    }

    res.status(200).json(results);
  });
});

app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, '/build/index.html'));
});
