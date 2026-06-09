require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const session = require('express-session');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const schedule = require('node-schedule');
const crypto = require('crypto');


const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET_KEY;
const ALGORITHM = 'aes-256-cbc';


// 토큰 암호화
const encrypt = (text) => {
  if (typeof text !== 'string') {
    throw new TypeError("암호화할 데이터는 문자열이어야 합니다.");
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

// 토큰 복호화
const decrypt = (text) => {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

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

// KakaoTalk 메시지 보내기 함수
const sendKakaoMessage = async (accessToken, kakaoId, message) => {
  try {
    if (!accessToken) {
      console.error(`${kakaoId}의 카카오톡 토큰이 없습니다.`);
      return;
    }
    
    await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: {
          web_url: "http://localhost:8080/test/",  // 실제 링크 추가 필요
        },
      }),
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    console.log(`${kakaoId}에게 메시지 전송 성공`);
  } catch (error) {
    console.error('메시지 전송 실패:', error);
  }
};

// 매일 09시에 이벤트 확인
schedule.scheduleJob('00 09 * * *', async () => { // 매일 09:00 AM에 실행
  console.log("09시에 이벤트 알림을 확인합니다.");

  const today = moment().tz('Asia/Seoul').startOf('day'); // 오늘 날짜 기준
  const threeDaysAfter = today.clone().add(3, 'days').format('YYYY-MM-DD');
  const oneDayAfter = today.clone().add(1, 'days').format('YYYY-MM-DD');

  try {
     // 3일 후 알람 보낼 이벤트
     const threeDaysEvents = await new Promise((resolve, reject) => {
      connection.query(`SELECT kakaoId, eventname FROM test WHERE DATE(startday) = ?`, [threeDaysAfter], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    // 1일 후 알람 보낼 이벤트
    const oneDayEvents = await new Promise((resolve, reject) => {
      connection.query(`SELECT kakaoId, eventname FROM test WHERE DATE(startday) = ?`, [oneDayAfter], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });

    // 3일 전 알림 보내기
    for (const { kakaoId, eventname } of threeDaysEvents) {
      // tokens 테이블에서 accessToken 조회
      const tokens = await new Promise((resolve, reject) => {
        connection.query(
          `SELECT accessToken FROM tokens WHERE kakaoId = ?`,
          [kakaoId],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      if (tokens.length > 0) {
        const accessToken = decrypt(tokens[0].accessToken); // 복호화
        const message = `모일까에서 ${eventname} 모임이 3일 남았어요! 얼른 일정을 등록하고 확인해주세요!`;
        await sendKakaoMessage(accessToken, kakaoId, message);
      }
    }

    // 1일 전 알림 보내기
    for (const { kakaoId, eventname } of oneDayEvents) {
      // tokens 테이블에서 accessToken 조회
      const tokens = await new Promise((resolve, reject) => {
        connection.query(
          `SELECT accessToken FROM tokens WHERE kakaoId = ?`,
          [kakaoId],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      if (tokens.length > 0) {
        const accessToken = decrypt(tokens[0].accessToken); // 복호화
        const message = `모일까에서 ${eventname} 모임이 1일 남았어요! 얼른 일정을 등록하고 확인해주세요!`;
        await sendKakaoMessage(accessToken, kakaoId, message);
      }
    }
  } catch (error) {
    console.error('이벤트 조회 중 오류 발생:', error);
  }
});

// 토큰 갱신 함수
const refreshTokens = async () => {
  try {
    const query = 'SELECT * FROM tokens';
    connection.query(query, async (err, results) => {
      if (err) {
        console.error('토큰 조회 오류:', err);
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000); // 현재 시간(초 단위)

      for (const row of results) {
        const { kakaoId, accessToken, refreshToken, issuedAt, expiresIn } = row;

        // 암호화된 토큰 복호화
        const decryptedAccessToken = decrypt(accessToken);
        const decryptedRefreshToken = decrypt(refreshToken);

        // Access Token 만료 여부 확인
        const isAccessTokenExpired = (currentTime - issuedAt) >= expiresIn;

        if (!isAccessTokenExpired) {
          // Access Token이 유효한 경우
          console.log(`Access Token이 유효합니다: ${kakaoId}`);
        } else {
          // Access Token이 만료된 경우 Refresh Token으로 새로운 Access Token 요청
          console.log(`Access Token이 만료되어 갱신합니다: ${kakaoId}`);

          try {
            const response = await axios.post('https://kauth.kakao.com/oauth/token', null, {
              params: {
                grant_type: 'refresh_token',
                client_id: process.env.REACT_APP_KAKAO_REST_API_KEY, // Kakao API 클라이언트 ID
                refresh_token: decryptedRefreshToken
              },
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });

            
            const { access_token, refresh_token, expires_in } = response.data;

            
            // 새로운 토큰 암호화
            const encryptedAccessToken = encrypt(access_token);
            const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : refreshToken;

            // 현재 시간(초 단위) 계산
            const newIssuedAt = Math.floor(Date.now() / 1000);

            // 새로운 토큰을 데이터베이스에 업데이트
            const updateQuery = `
              UPDATE tokens
              SET accessToken = ?, refreshToken = ?, issuedAt = ?, expiresIn = ?, updatedAt = NOW()
              WHERE kakaoId = ?
            `;
            connection.query(updateQuery, [encryptedAccessToken, encryptedRefreshToken, newIssuedAt, expires_in, kakaoId], (err) => {
              if (err) {
                console.error('토큰 업데이트 오류:', err);
              } else {
                console.log(`토큰 갱신 완료: ${kakaoId}`);
              }
            });
          } catch (error) {
            console.error('Refresh Token을 사용한 Access Token 갱신 오류:', error);
          }
        }
      }
    });
  } catch (error) {
    console.error('토큰 갱신 오류:', error);
  }
};

// 매일 아침 9시에 토큰 갱신 작업 스케줄링
schedule.scheduleJob('00 09 * * *', () => {
  console.log('매일 아침 9시에 토큰 갱신 작업 실행');
  refreshTokens();
});

// 매일 자정에 실행될 작업 설정
schedule.scheduleJob('00 00 * * *', () => {
  const today = moment().tz('Asia/Seoul').startOf('day'); // 오늘 날짜 기준
  console.log('자동 삭제 작업이 시작되었습니다:', today.format()); // 한국 시간 기준으로 출력

  const query = `DELETE FROM test WHERE endday < ?`;
  // moment 객체를 포맷하여 문자열로 변환
  connection.query(query, [today.format('YYYY-MM-DD HH:mm:ss')], (error, result) => {
      if (error) {
          console.error('이벤트 삭제 중 오류 발생:', error);
          return;
      }    
      console.log('지난 날짜의 이벤트가 삭제되었습니다. 삭제된 행 수:', result.affectedRows);
  });
});

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
      `CREATE TABLE IF NOT EXISTS event (
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
      `CREATE TABLE IF NOT EXISTS tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kakaoId VARCHAR(20) NOT NULL UNIQUE,
        accessToken VARCHAR(255) NOT NULL,
        refreshToken VARCHAR(255) NOT NULL,
        issuedAt INT NOT NULL,  
        expiresIn INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

// 토큰 저장 API
app.post('/api/save-token', async (req, res) => {
  const { kakaoId, accessToken, refreshToken, expiresIn } = req.body;

  // 현재 시간(초 단위)
  const issuedAt = Math.floor(Date.now() / 1000); // 초 단위로 변환

  // accessToken과 refreshToken을 암호화하는 방법
  try {
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = encrypt(refreshToken);
    
    connection.query(
      `INSERT INTO tokens (kakaoId, accessToken, refreshToken, issuedAt, expiresIn) VALUES (?, ?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE accessToken = ?, refreshToken = ?, issuedAt = ?, expiresIn = ?`,
      [kakaoId, encryptedAccessToken, encryptedRefreshToken, issuedAt, expiresIn, encryptedAccessToken, encryptedRefreshToken, issuedAt, expiresIn],
      (error, results) => {
        if (error) {
          console.error("토큰 저장 중 오류 발생:", error);
          return res.status(500).send("토큰 저장 중 오류 발생");
        }
        res.status(200).send("토큰이 성공적으로 저장되었습니다.");
      }
    );
  } catch (error) {
    console.error("암호화 중 오류 발생:", error);
    return res.status(500).send("암호화 중 오류 발생");
  }
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
