// PM2 설정 파일
module.exports = {
  apps: [
    // API Server (4개 인스턴스, 클러스터 모드)
    {
      name: 'api-server',
      script: 'dist/api/server.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3000,
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true,
      time: true,
    },
    // Game Daemon (1개 인스턴스, 포크 모드)
    {
      name: 'game-daemon',
      script: 'dist/daemon/game-daemon.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/daemon-error.log',
      out_file: 'logs/daemon-out.log',
      time: true,
      restart_delay: 5000,
    },
  ],
};
