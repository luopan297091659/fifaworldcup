module.exports = {
  apps: [
    {
      name: "fifaworldcup-api",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 8005,
        HOST: "127.0.0.1"
      }
    }
  ]
};
