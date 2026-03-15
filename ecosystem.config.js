module.exports = {
  apps: [
    {
      name: 'storygame-backend',
      cwd: './platform/backend',
      script: 'node',
      args: 'dist/server.js',
      interpreter: 'none',
      watch: false,
    },
    {
      name: 'storygame-frontend',
      cwd: './platform/frontend',
      script: 'C:\\Windows\\System32\\cmd.exe',
      args: '/c npm run dev',
      interpreter: 'none',
      watch: false,
    },
  ],
};
