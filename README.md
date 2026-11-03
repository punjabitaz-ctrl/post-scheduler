# Social Media Post Scheduler

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/1e3pm/post-scheduler)

A minimal, open-source social media post scheduler that focuses on doing one thing well: reliably scheduling posts across multiple platforms.

Don't take my word for it. Try it yourself (deploys in <1 minute).

Designed for easy self-hosting on Cloudflare Workers, it lets users deploy a lightweight, transparent, and lifetime-free scheduler in minutes.

This project is not AI slop. The frontend, however, was vibe-coded.

Currently, it supports 8 platforms: Bluesky, Discord, LinkedIn, Mastodon, Telegram, TikTok, X, and YouTube.

To further reduce friction, no S3/R2 is needed, as it stores files up to 25 MB by chunking them into a Cloudflare D1 SQL database.

There are two optional environment variables:

JWT_SECRET: Secret for HS256 JWT signing.

DISABLE_REGISTRATION: Setting this to true will only allow a single user registration. After that, the sign-up page will be disabled. Useful for self-hosting when you want complete control over access.

> Backward compatibility is currently not guaranteed.
> Project intentionally uses plain SHA-256 for password hashing.

Click the Deploy to Cloudflare button to instantly deploy this app to your Cloudflare account and schedule posts FREE FOREVER.

This project is licensed under the GNU Affero General Public License v3.0.
