# systemd user unit

`pigraphics.service` runs pigraphics as a systemd user service.

Expected layout (relative to the service user's home, `%h`):

- app checkout (built, with `dist/`): `~/apps/pigraphics`
- environment file: `~/apps/pigraphics.env` (all settings and secrets live here, never in git)
- Node.js: `~/.local/bin/node`

Install:

```sh
mkdir -p ~/.config/systemd/user
cp deploy/pigraphics.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pigraphics
loginctl enable-linger "$USER"   # once, so it runs without a login session
```

Status and logs: `systemctl --user status pigraphics`, `journalctl --user -u pigraphics -f`.
