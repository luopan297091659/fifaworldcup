# WorldCup Node Server

Node.js/Express service for the mini program API.

Recommended runtime: Node.js 18 or newer.

## Run Locally

```bash
cd server
npm install
npm start
```

The service listens on `127.0.0.1:8005` by default.

Run the smoke test:

```bash
npm run smoke
npm run contract
```

## Storage

Default storage is file mode:

```env
STORE_DRIVER=file
```

For MySQL mode:

```env
STORE_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=worldcup
DB_PASSWORD=your-password
DB_NAME=worldcup
```

Initialize the database:

```bash
npm run db:init
```

The server uses a single JSON state table for the first production version:

```text
worldcup_app_state
```

This keeps the API stable while moving from file storage to MySQL. You can later
split it into dedicated `users`, `matches`, `predictions`, `rooms`, and
`rankings` tables.

Migrate existing file data to MySQL:

```bash
# make sure .env has STORE_DRIVER=mysql first
npm run db:migrate-file
```

## PM2

```bash
cd server
cp .env.example .env
# edit .env, especially JWT_SECRET, WECHAT_APPID, WECHAT_SECRET
pm2 start ecosystem.config.js
pm2 save
```

If PM2 is not installed:

```bash
npm install -g pm2
```

One-command server scripts:

```bash
chmod +x scripts/*.sh
./scripts/start-pm2.sh
```

After pulling new code:

```bash
./scripts/restart-pm2.sh
```

## Nginx

```nginx
location /worldcup/ {
    proxy_pass http://127.0.0.1:8005/worldcup/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
}
```

Set the mini program request domain to:

```text
https://kotabi.top
```

## Data

The MVP data store is `data/store.json`. It is intentionally simple so the first
deployment can run without MySQL. Keep this file backed up, then replace
`src/store.js` with MySQL/TencentDB access when traffic grows.

Back up MVP data:

```bash
cp data/store.json data/store.$(date +%Y%m%d%H%M%S).json
```

Or use the helper scripts:

```bash
./scripts/backup-file-store.sh
./scripts/backup-mysql.sh
```
