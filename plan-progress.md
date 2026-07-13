The Bestra Stack :
   * Backend: Node.js v25 utilizing experimental node:quic or @fails-components/webtransport for HTTP/3
     (WebTransport). This will provide the "best performance" you're looking for, especially on flaky mobile networks.
   * Database: PostgreSQL for core data (users, chat metadata).
   * Auth: Clerk (Pro 240$) for enterprise-grade security and user management. We will sync Clerk users to our PostgreSQL via Webhooks.
   * Storage: Camber ($75GB) for large media. We will use the Node backend to process and pipe files there.
   * Media Processing:
       * Images: Automated AVIF conversion via sharp on the Node backend.
       * Voice: Opus encoding (we'll aim for native recording on the mobile side and validation on the server).
   * Security: End-to-End Encryption (E2EE) using a Signal-style double-ratchet protocol (implemented via Web Crypto API).

  ---

  Implementation Plan (Summary)
   1. Phase 1: Backend Infrastructure & HTTP/3 Setup (Proof of Concept). [DONE]
      - [x] Initialize backend project with Node.js.
      - [x] Create core HTTP/3 WebTransport server structure.
      - [x] Setup local TLS certificates for testing.
      - [x] Implement initial health-check and connection logging.
   2. Phase 2: Clerk Auth & PostgreSQL Integration. [DONE]
      - [x] Configure PostgreSQL connection string.
      - [x] Implement Clerk Webhook handler for user sync.
      - [x] Setup Prisma for database schema management (containerized).
      - [x] Implement initial WebTransport (HTTP/3) server logic.
   3. Phase 3: Real-time Messaging (WebTransport) & UI Logic Porting. [DONE]
      - [x] Port `useChatStore` logic to ReactLynx (Zustand).
      - [x] Implement backend REST API routes (Users, Messages, Send).
      - [x] Integrate Clerk auth middleware in backend.
      - [x] Implement secure authentication for WebTransport sessions.
      - [x] Build the real-time message routing logic.
   4. Phase 4: Media Pipeline (AVIF/Opus) & Camber Storage. [IN PROGRESS]
      - [x] Implement server-side AVIF optimization via Sharp.
      - [x] Implement native Android media capture (Gallery/Mic).
   5. Phase 5: E2EE Implementation. [DONE]
      - [x] Add publicKey field to User model.
      - [x] Implement RSA-OAEP key generation and sync.
      - [x] Implement local encryption and decryption logic.
      - [x] Add visual indicator for encrypted messages.
   6. Phase 6: ReactLynx UI Development & Final Polishing. [DONE]
      - [x] Fix Android Permissions (API 24-34+).
      - [x] Resolve Lynx Native Bridge ("No provider or fetcher" error).
      - [x] Implement automated bridge testing and diagnostic UI.
      - [x] Optimize location fetching with multi-provider support.

   7. Phase 7: Advanced Native Features (Next Session).
      - [] Implement Native VoIP calling (WebRTC) between users.
      - [] Integrate E2EE for signaling and call setup.
      - [] Finalize Camber storage integration for permanent media.
