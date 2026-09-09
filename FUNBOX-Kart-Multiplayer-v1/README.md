# FUNBOX Kart Race

Multiplayer browser kart racing built with Phaser 3 + Socket.IO.

## Local development

1. Start the server:
   `cd server && npm install && npm start`
2. Serve the client from a static server, or use the included Netlify configuration.
3. Set the client Socket.IO URL to your Render server URL in `client/src/config.js`.

## Deployment

- Server: Render Web Service, root directory `server`, build command `npm install`, start command `npm start`.
- Frontend: Netlify, publish directory `client`.
