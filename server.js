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
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'mysql80'
});

connection.connect(err => {
  if (err) {
    console.error('MySQL 데이터베이스에 연결 중 오류 발생:', err.stack);
    return;
  }
  console.log('MySQL 데이터베이스에 연결되었습니다.');

  // 테이블 생성
  const createTables = () => {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS test (
        id INT PRIMARY KEY AUTO_INCREMENT,
        kakaoId VARCHAR(20) NOT NULL,
        nickname VARCHAR(20) NOT NULL,
        uuid VARCHAR(20) NOT NULL,
        eventname VARCHAR(20) NOT NULL,
        startday TIMESTAMP,
        endday TIMESTAMP,
        createday TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS eventschedule(
        id INT PRIMARY KEY AUTO_INCREMENT,
        kakaoId VARCHAR(20) NOT NULL,
        nickname VARCHAR(20) NOT NULL,
        event_name VARCHAR(20) NOT NULL,
        event_uuid VARCHAR(20) NOT NULL,
        event_datetime TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        nickname VARCHAR(255) NOT NULL
      )`
    ];
    
    tableQueries.forEach(query => {
      connection.query(query, (err, results) => {
        if (err) {
          console.error('테이블 생성 중 오류 발생:', err);
        } else {
          console.log('테이블이 생성되었거나 이미 존재합니다.');
        }
      });
    });
  };

  createTables(); // 테이블 생성 함수 호출
});

http.listen(8080, () => {
  console.log("http://localhost:8080/ 에서 서비스를 시작합니다.");
});

app.use(express.static(path.join(__dirname, '/build')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/build/index.html'));
});

// 로그인 상태 확인
app.get('/api/check-login-status', (req, res) => {
  if (req.session.userInfo) {
    res.json({ isLoggedIn: true, userInfo: req.session.userInfo });
  } else {
    res.json({ isLoggedIn: false });
  }
});

// 로그인 처리
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

// 로그아웃 처리
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 이벤트 생성
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

// 이벤트 스케줄 저장
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

// 사용자 정보 저장
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


// 특정 이벤트 조회
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

// 이벤트 삭제
app.delete('/api/delete-event', (req, res) => {
  const { event_uuid, kakaoId } = req.body;

  // 이벤트 생성자 확인 쿼리
  connection.query("SELECT kakaoId FROM test WHERE uuid = ?", [event_uuid], (error, results) => {
    if (error) {
      console.error("이벤트 생성자 확인 중 오류 발생:", error);
      res.status(500).send("이벤트 생성자 확인 중 오류 발생");
      return;
    }

    if (results.length === 0) {
      return res.status(404).send("이벤트를 찾을 수 없습니다.");
    }

    const creatorKakaoId = results[0].kakaoId;

    if (creatorKakaoId === kakaoId) {
      // 생성자일 경우 두 테이블에서 삭제
      connection.query("DELETE FROM test WHERE uuid = ?", [event_uuid], (error) => {
        if (error) {
          console.error("이벤트 삭제 중 오류 발생:", error);
          res.status(500).send("이벤트 삭제 중 오류 발생");
          return;
        }

        // eventschedule에서 관련 데이터 삭제
        connection.query("DELETE FROM eventschedule WHERE event_uuid = ?", [event_uuid], (error) => {
          if (error) {
            console.error("참여자 데이터 삭제 중 오류 발생:", error);
            res.status(500).send("참여자 데이터 삭제 중 오류 발생");
            return;
          }
          
          res.status(200).send("이벤트가 성공적으로 삭제되었습니다.");
        });
      });
    } else {
      // 참여자인 경우 eventschedule에서만 삭제
      connection.query("DELETE FROM eventschedule WHERE event_uuid = ? AND kakaoId = ?", [event_uuid, kakaoId], (error) => {
        if (error) {
          console.error("참여자 데이터 삭제 중 오류 발생:", error);
          res.status(500).send("참여자 데이터 삭제 중 오류 발생");
          return;
        }
        
        res.status(200).send("참여자 데이터가 성공적으로 삭제되었습니다.");
      });
    }
  });
});



// 특정 이벤트 스케줄 조회
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

// 이벤트 스케줄 삭제
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

// 현재 db를 connection으로 수정
app.get('/api/events/user/:kakaoId', async (req, res) => {
  try {
      const kakaoId = req.params.kakaoId;

      // 생성자로서의 이벤트 가져오기
      const createdEvents = await new Promise((resolve, reject) => {
          connection.query(`SELECT * FROM test WHERE kakaoId = ?`, [kakaoId], (error, results) => {
              if (error) return reject(error);
              resolve(results);
          });
      });

      // 참여자로서 등록된 이벤트 가져오기
      const participatedEvents = await new Promise((resolve, reject) => {
          connection.query(`SELECT e.* FROM eventschedule ep JOIN test e ON ep.event_uuid = e.uuid WHERE ep.kakaoId = ?`, [kakaoId], (error, results) => {
              if (error) return reject(error);
              resolve(results);
          });
      });

      // 생성자로 등록한 이벤트와 참여자로 등록된 이벤트 합치기
      const allEvents = [...createdEvents, ...participatedEvents];

      // 중복 제거
      const uniqueEvents = (events) => {
        const unique = {};
        events.forEach(event => {
          if (!unique[event.uuid]) {
            unique[event.uuid] = event;
          }
        });
        return Object.values(unique);
      };

      res.json(uniqueEvents(allEvents));
  } catch (error) {
      console.error("Error fetching user's events:", error);
      res.status(500).json({ error: "Error fetching user's events" });
  }
});

// 상세보기 API 수정
app.get('/api/event-schedules/details/:uuid', async (req, res) => {
  try {
    const eventUuid = req.params.uuid;

    // 이벤트 정보 가져오기
    const eventDetails = await new Promise((resolve, reject) => {
      connection.query(`SELECT * FROM test WHERE uuid = ?`, [eventUuid], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

     // 참여자 정보 가져오기
     const participants = await new Promise((resolve, reject) => {
      connection.query(`SELECT ep.kakaoId, ep.nickname, ep.event_datetime 
          FROM eventschedule ep
          WHERE ep.event_uuid = ?`, [eventUuid], (error, results) => {
          if (error) return reject(error);
          resolve(results);
      });
  });

    // 생성자 정보는 eventDetails에서 가져오기
    const creatorNickname = eventDetails[0].nickname; // test 테이블에서 생성자 닉네임 가져오기

    res.json({
      eventDetails: eventDetails[0], // 이벤트 기본 정보
      participants: participants, // 이벤트 참여자 정보
      creator: { nickname: creatorNickname } // test 테이블에서 가져온 생성자 닉네임 추가
    });
  } catch (error) {
    console.error("Error fetching event details:", error);
    res.status(500).json({ error: "Error fetching event details" });
  }
});


app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, '/build/index.html'));
});
