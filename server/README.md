# Rocket Ball ranked service

This server supplies a public 1v1 queue, persistent Elo ratings, five placement games and a leaderboard. Gameplay still uses the game's PeerJS/WebRTC host. GitHub Pages serves the game and cannot run this server.

## Start locally

Use Node 22.13 or newer (Node 24 also works):

```sh
npm ci --prefix server
ALLOWED_ORIGINS=http://localhost:8080 DB_PATH=/tmp/rocket-ball.sqlite npm start --prefix server
```

Serve the repository on `http://localhost:8080`, open Settings → Online matchmaking, and save `ws://localhost:8787/ranked`. Both players must use the same server. Run `npm test --prefix server` for the service integration checks.

## Deploy with persistent storage

From the repository root:

```sh
docker compose -f server/compose.yaml up -d --build
```

The named volume retains SQLite ratings across container replacements. Back it up regularly; for a live database use SQLite's backup API or stop the service before copying the database and its WAL files together. Do not run multiple service instances against this database: the active queue and matches belong to one process.

Put an HTTPS reverse proxy in front of port 8787. Example Caddy configuration, with your actual DNS name:

```caddy
ranked.your-domain.example {
    reverse_proxy 127.0.0.1:8787
}
```

Caddy obtains TLS and forwards WebSocket upgrades. DNS must point to your host, and ports 80/443 must be reachable. The compose file binds the backend to loopback so it is exposed through the HTTPS proxy. On a managed container host, publish its assigned port and attach a persistent disk at `/app/data`; set `DB_PATH=/app/data/rocket-ball.sqlite`.

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP/WebSocket listener |
| `DB_PATH` | `rocket-ball.sqlite` | SQLite path on persistent storage |
| `ALLOWED_ORIGINS` | `https://monkeymansilly1.github.io` | Comma-separated exact game origins, without a trailing slash |

Check `https://your-host/health`, then set `rankedServerUrl: 'wss://your-host/ranked'` in the repository's public `config.js` and publish it. Alternatively, each player can save that URL in Settings. Until configured and hosted, the game shows an explicit unavailable state and does not simulate matchmaking locally. No secrets belong in `config.js`.

## Match and rating behavior

The queue starts within 150 MMR, widening by 10 MMR per second up to 1000. The first player registers the room before the server tells the second player to join. A completed result needs matching scores from both authenticated players; discrepancies or missing confirmations do not change MMR. A voluntary forfeit or a disconnect longer than 30 seconds during an active ranked match awards the other player a win. Failed initial connections cancel without a rating change. Elo uses K=32; placement progress changes the displayed rank after five games.

After a ranked result, the in-room Rematch button starts an explicitly **casual** game. Use Find Ranked Match again for another rated game. A server restart cancels in-flight matches and preserves finished results. Clients reconnect using a browser-specific anonymous account secret stored locally; clearing browser storage creates a new identity. There is no account recovery or cross-device login yet.

## Trust limits

This is a deployable community ladder, not an anti-cheat tournament authority. The match host still runs physics, and score confirmation prevents one client awarding itself a result but cannot stop colluding clients or a cheating host. Competitive production use needs authoritative gameplay simulation, stronger accounts, abuse controls and moderation. The service stores secret hashes, checks browser origins, caps message size and request rate, and never accepts a client-supplied rating. Use HTTPS/WSS and preserve the database volume.
