import React from 'react';
import { Layout } from 'antd';

const { Header } = Layout;

const MoHeader = ({ colorBgContainer }) => {
  return (
    <Header
      style={{
        color: "white",
        width: "100%",
        height: 72,
        paddingLeft: 20,
        paddingRight: 0,
        position: "fixed",
        top: 0,
        zIndex: 1,
        background: colorBgContainer,
        display: "flex",
        alignItems: "center" // 세로 중앙 정렬
      }}
    >
      <a href="http://localhost:8080">
        <img
          src="/logo.png"
          width="128"
          height="64"
          className="d-inline-block align-top logo"
          alt="모일까 로고"
          style={{ marginTop: '20px',marginLeft: '20px'  }} // 추가: 위쪽으로 약간 밀어주기
        />
      </a>
    </Header>
  );
};

export default MoHeader;
