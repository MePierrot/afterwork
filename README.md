# afterwork

A desktop afterwork-time calculator built with Electron.

## Run in development

```bash
npm install
npm start
```

## Build installer (Windows)

```bash
npm install
npm run dist
```

Installer output is in the `dist` directory.

## Features

- Input start time
- Auto-calculate off-work time (+8h45m)
- Countdown to off-work time
- Tray resident and minimize to tray
- Single instance only
- Local notifications on off-work time
