# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brok is a Discord bot built with TypeScript and Bun runtime. The project uses the low-level Discord.js Core API (@discordjs/core) for interaction with Discord's API, providing more control over the bot's behavior.

## Package Manager

This project uses **Bun** as the package manager and runtime. The lockfile is `bun.lock`.

Commands:
- Install dependencies: `bun install`
- Run the bot: `bun run index.ts`
- Add dependencies: `bun add <package>`
- Add dev dependencies: `bun add -d <package>`

## Architecture

### Entry Point

The main entry point is `index.ts`, which contains:
- Discord REST client initialization
- WebSocket Gateway Manager for real-time events
- Discord Client setup with event listeners
- Interaction handlers (currently handles `/ping` command)

### Discord.js Core Architecture

The project uses `@discordjs/core` instead of the full `discord.js` library, which provides:
- **REST API client** (`@discordjs/rest`): For making HTTP requests to Discord API
- **WebSocket Manager** (`@discordjs/ws`): For receiving real-time events from Discord Gateway
- **Client**: Event emitter that combines REST and Gateway functionality

This architecture gives more control and reduces bundle size compared to the full discord.js library.

### Current Implementation

- Gateway intents configured for: `Guilds` and `GuildMessages`
- Event listeners for:
  - `InteractionCreate`: Handles slash commands (currently only `/ping`)
  - `Ready`: Logs when bot is connected

### Environment Variables

Required environment variable:
- `DISCORD_TOKEN`: Bot token from Discord Developer Portal (stored in `.env.local`)

## Development Roadmap

From README.md, the planned features are:
- [x] Configure Discord bot
- [x] Add bot to test server
- [ ] Install Discord lib and send first message
- [ ] Add AI to bot
- [ ] Add basic RAG to bot
- [ ] Add stemming and prompt injection protection

## Code Standards

- TypeScript strict mode is enabled
- `noUncheckedIndexedAccess` is enabled for safer array/object access
- Target is ESNext with bundler module resolution
- No emit (Bun handles execution directly)
