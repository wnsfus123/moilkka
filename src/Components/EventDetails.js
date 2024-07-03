import React from 'react';
import { Card, Row, Col, Typography, Button, Input } from 'antd';
import KakaoShareButton from './KakaoShareButton';
import moment from 'moment';

const { Title, Text } = Typography;

const EventDetails = ({ eventData, userInfo, handleCopyLink }) => {
  const shareUrl = `http://9899-203-232-203-105.ngrok-free.app/test/?key=${eventData.uuid}`;

  return (
    <Row gutter={16}>
      <Col span={12}>
        <Card style={{ margin: "20px", padding: "20px" }}>
          <Title level={2}>Event Details</Title>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Event Name: </Text>
              <Text>{eventData.eventname}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Event UUID: </Text>
              <Text>{eventData.uuid}</Text>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Start Day: </Text>
              <Text>{moment(eventData.startday).format("YYYY-MM-DD")}</Text>
            </Col>
            <Col span={12}>
              <Text strong>End Day: </Text>
              <Text>{moment(eventData.endday).format("YYYY-MM-DD")}</Text>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Start Time: </Text>
              <Text>{moment(eventData.startday).format("HH:mm")}</Text>
            </Col>
            <Col span={12}>
              <Text strong>End Time: </Text>
              <Text>{moment(eventData.endday).format("HH:mm")}</Text>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={12}>
        <Card style={{ margin: "20px", padding: "20px", display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <KakaoShareButton userInfo={userInfo} eventData={eventData} />
          <Input.Group compact style={{ marginTop: "20px" }}>
            <Input
              style={{ width: 'calc(100% - 100px)', cursor: 'not-allowed' }}
              value={shareUrl}
              readOnly
            />
            <Button type="primary" onClick={handleCopyLink}>복사하기</Button>
          </Input.Group>
        </Card>
      </Col>
    </Row>
  );
};

export default EventDetails;
