import React from 'react';
import { Layout, Menu } from 'antd';

const { Header } = Layout;

const MoHeader = ({ colorBgContainer }) => {
  return (
    <Header
      style={{
        color: "white",
        width: "110%",
        height: 72,
        paddingLeft: 20,
        paddingRight: 0,
        position: "fixed",
        top: 0,
        zIndex: 1,
        background: colorBgContainer,
        display: "flex",
        alignItems: "center"
      }}
    >
      <a href="http://localhost:8080">
        <img
          src="/logo.png"
          width="128"
          height="64"
          className="d-inline-block align-top logo"
          alt="모일까 로고"
        />
      </a>

    </Header>
  );
};

export default MoHeader;
