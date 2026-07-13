import { Http3Server } from '@fails-components/webtransport';
import { readFileSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Webhook } from 'svix';
import { clerkMiddleware } from '@clerk/express';
import prisma from './lib/prisma.js';
import messageRoutes from './routes/message.route.js';

import { handleWebTransportSession } from './lib/realtime.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: true, // Allow all origins for dev/mobile testing
  credentials: true
}));

// Clerk Middleware (required for req.auth)
app.use(clerkMiddleware());

// Health check
app.get('/health', (req, res) => {
  res.send('Bestra Backend is running');
});

// Clerk Webhook Handler
// Note: We use express.raw() for the webhook to verify signatures correctly
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Get the headers
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  const payload = req.body;
  const body = payload.toString();

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt;
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).json({ error: 'Verification failed' });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook received: ${eventType} for user ${id}`);

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { email_addresses, first_name, last_name, image_url, username } = evt.data;
    const email = email_addresses[0]?.email_address;
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();

    try {
      await prisma.user.upsert({
        where: { id },
        update: {
          email,
          username: username || email.split('@')[0], // Fallback to email prefix if username is missing
          fullName,
          profilePic: image_url,
        },
        create: {
          id,
          email,
          username: username || email.split('@')[0],
          fullName,
          profilePic: image_url,
        },
      });
      console.log(`User ${id} synced to database`);
    } catch (error) {
      console.error('Error syncing user:', error);
    }
  }

  if (eventType === 'user.deleted') {
    try {
      await prisma.user.delete({ where: { id } });
      console.log(`User ${id} deleted from database`);
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }

  return res.status(200).json({ success: true });
});

app.use(express.json({ limit: "50mb" })); // Increased limit for media
app.use("/api/messages", messageRoutes);

const PORT = process.env.PORT || 3000;
const H3_PORT = process.env.H3_PORT || 4433;

// WebTransport / HTTP3 Setup
// In a real production environment on DO, we would use a valid certificate from Let's Encrypt.
// For initial setup/dev, we assume self-signed certs are provided via env or files.

const startServer = async () => {
  try {
    // Standard HTTP server for API (matching frontend api.ts default)
    const httpServer = createHttpServer(app);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`HTTP API Server listening on port ${PORT}`);
    });

    // HTTP/3 WebTransport Server (Requires HTTPS/Certs)
    const cert = readFileSync(process.env.CERT_PATH || './certs/server.crt');
    const key = readFileSync(process.env.KEY_PATH || './certs/server.key');

    const h3Server = new Http3Server({
      port: H3_PORT,
      host: '0.0.0.0',
      path: '/',
      cert,
      privKey: key,
      secret: process.env.H3_SECRET || 'bestra-secret-change-me'
    });

    h3Server.startServer();
    console.log(`WebTransport (HTTP/3) Server listening on port ${H3_PORT}`);

    // Seed Mock User for Dev
    if (process.env.NODE_ENV !== 'production') {
      await prisma.user.upsert({
        where: { id: 'user_2t4v_dev_test' },
        update: {},
        create: {
          id: 'user_2t4v_dev_test',
          email: 'test@bestra.app',
          username: 'testuser',
          fullName: 'Test User',
        }
      });

      await prisma.user.upsert({
        where: { id: 'user_other_dev_test' },
        update: {},
        create: {
          id: 'user_other_dev_test',
          email: 'bob@bestra.app',
          username: 'bob',
          fullName: 'Bob (Test Contact)',
        }
      });
      console.log('Mock users seeded for development');
    }

    /* 
    // Handle WebTransport Sessions
    (async () => {
      try {
        const sessionStream = await h3Server.sessionStream();
        const sessionReader = sessionStream.getReader();

        while (true) {
          const { done, value: session } = await sessionReader.read();
          if (done) break;
          handleWebTransportSession(session);
        }
      } catch (error) {
        console.error('WebTransport session loop error:', error);
      }
    })();
    */

  } catch (error) {
    console.error('Failed to start servers:', error);
  }
};

startServer();
