module.exports = {
  apps: [
    {
      name: "frontend",
      cwd: __dirname, // текущая папка (корень фронта)
      script: "node",
      args: "node_modules/vite/bin/vite.js --port 3000 --host 0.0.0.0",
      env: {
        NODE_ENV: "development",
      },

      // по желанию:
      autorestart: true,
      watch: false,
      max_restarts: 10,
      time: true,
    },
  ],
};
