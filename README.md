# 🗳️ P2P Verified Polling App

A decentralized, real-time polling application built with **Nuxt 3**, **Yjs**, and **WebRTC**. This app allows users to create and participate in polls where every vote is cryptographically signed and verified peer-to-peer, ensuring data integrity without a central authority "owning" the results.

---

## 🌟 Key Features

* **Serverless Real-time Sync:** Uses **Yjs** (CRDTs) and **WebRTC** to sync poll data directly between browsers. No database is required for live updates.
* **Persistence with Nitro:** While the logic is P2P, the **Nuxt/Nitro** backend provides a "Snapshot" service to ensure polls persist even after all peers go offline.
* **Cryptographic Integrity:** Every vote is signed using **RSA-PSS (Web Crypto API)**. Each user has a unique private key (stored locally via `.pem` files) to ensure votes cannot be forged or tampered with.
* **Chained Verification:** Implements a "History-Signing" logic where each new vote signs the entire preceding state of the poll, creating a verifiable chain of trust.
* **Privacy First:** Users identify via UUIDs and Public/Private key pairs rather than traditional accounts.

---

## ⚙️ How It Works

### 1. Identity Creation
When a new user is created, the system generates a unique **UUID (User ID)** and an **RSA Key Pair**. The user is prompted to save their **Private Key** as a `.pem` file, named after their User ID (e.g., `550e8400-e29b.pem`). This file acts as their "Passport"—it is never uploaded to the server and must be kept secure by the user.

### 2. Authentication
Upon returning to the app, users load their local `.pem` file. The application extracts the Private Key for signing and the UUID for identification. No passwords or central servers are involved in this local-first login process.

### 3. Joining a Poll
When a user joins a poll, the app fetches the latest binary snapshot from the server to populate a local **Y.Doc**. This ensures the user sees the current state immediately, even before connecting to other peers.

### 4. The P2P Mesh
The app establishes connections to other active voters via a WebRTC signaling server. Any changes made to the poll (adding options or voting) are broadcasted instantly to all peers using Conflict-free Replicated Data Types (CRDTs) to prevent sync conflicts.

### 5. Casting a Signed Vote
To ensure security, the voting process follows a strict cryptographic chain:
* The app captures the current list of votes.
* It appends the new vote data (User ID + Timestamp).
* It signs the **entire array** (the previous history + the new vote) using the user's RSA private key.
* The signed update is merged into the shared Yjs Map and broadcasted.

### 6. Distributed Verification
Whenever a peer receives a new update, they fetch the voter's **Public Key** from the API. They then verify that the signature matches the current state of the poll history. If a signature is invalid or the history has been tampered with, the vote is rejected by the peer's local state.

---

## 🛠️ Tech Stack

* **Framework:** [Nuxt 3](https://nuxt.com/) (Vue 3 + TypeScript)
* **Conflict-Free Replicated Data Types (CRDT):** [Yjs](https://yjs.dev/)
* **P2P Transport:** `y-webrtc`
* **Security:** Web Crypto API (SubtleCrypto)
* **Backend/Storage:** Nitro (Nuxt's server engine) with filesystem storage drivers

# AI Disclaimer

This App was developed with the assistance of AI.

# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
