module.exports = {
  apps: [
    {
      name: 'storygame-backend',
      cwd: './platform/backend',
      script: 'cmd',
      args: '/c npm run dev',
      watch: false,
    },
    {
      name: 'storygame-frontend',
      cwd: './platform/frontend',
      script: 'cmd',
      args: '/c npm run dev',
      watch: false,
    },
  ],
};
