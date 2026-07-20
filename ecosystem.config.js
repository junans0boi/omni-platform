module.exports = {
  apps: [
    {
      name: "omni-platform",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/home/ubuntu/omni-platform",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "/home/ubuntu/omni-platform/logs/err.log",
      out_file: "/home/ubuntu/omni-platform/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
