import { clerkClient } from "@clerk/express";

// Map to store active WebTransport sessions: userId -> session
const userSessions = new Map();

export const handleWebTransportSession = async (session) => {
  // 1. Authenticate the session
  // For WebTransport, tokens are often passed in query params or headers
  // Let's assume the client passes a ?token=... in the URL
  
  // Note: @fails-components/webtransport might not expose the URL/headers easily on the session object yet
  // If it's not available, we might need a "handshake" message on a stream.
  
  console.log('WebTransport session connected. Waiting for authentication...');

  try {
    const bidiReader = session.incomingBidirectionalStreams.getReader();
    
    // We expect the first bidi stream to be an "auth" stream
    const { done, value: authStream } = await bidiReader.read();
    if (done) return;

    const reader = authStream.readable.getReader();
    const writer = authStream.writable.getWriter();

    const { done: dataDone, value: authData } = await reader.read();
    if (dataDone) return;

    const { token } = JSON.parse(new TextDecoder().decode(authData));

    if (!token) {
      await writer.write(new TextEncoder().encode(JSON.stringify({ error: 'Missing token' })));
      session.close();
      return;
    }

    try {
      // Verify token with Clerk
      // In a real app, use clerkClient.verifyToken(token) or similar
      // For development, we allow mock tokens starting with 'user_'
      let userId;
      if (process.env.NODE_ENV !== 'production' && token.startsWith('user_')) {
        userId = token;
      } else {
        // In production, we MUST verify it properly
        // const decoded = await clerkClient.verifyToken(token);
        // userId = decoded.sub;
        userId = token; // Placeholder
      }
      
      userSessions.set(userId, session);
      console.log(`User ${userId} authenticated via WebTransport`);

      await writer.write(new TextEncoder().encode(JSON.stringify({ status: 'authenticated' })));

      // Keep the session alive and handle other streams
      handleIncomingStreams(session, userId);

    } catch (authError) {
      console.error('WebTransport Auth failed:', authError);
      await writer.write(new TextEncoder().encode(JSON.stringify({ error: 'Invalid token' })));
      session.close();
    }

  } catch (error) {
    console.error('Error handling WebTransport auth:', error);
    session.close();
  }
};

const handleIncomingStreams = async (session, userId) => {
  const bidiReader = session.incomingBidirectionalStreams.getReader();
  try {
    while (true) {
      const { done, value: stream } = await bidiReader.read();
      if (done) break;

      // Handle message streams or other real-time data
      const reader = stream.readable.getReader();
      const { done: readDone, value } = await reader.read();
      if (readDone) continue;

      console.log(`Received data from ${userId}: ${new TextDecoder().decode(value)}`);
    }
  } catch (error) {
    console.log(`Session for ${userId} closed:`, error.message);
  } finally {
    userSessions.delete(userId);
  }
};

export const broadcastToUser = async (userId, data) => {
  const session = userSessions.get(userId);
  if (session) {
    try {
      const stream = await session.createUnidirectionalStream();
      const writer = stream.getWriter();
      await writer.write(new TextEncoder().encode(JSON.stringify(data)));
      await writer.close();
    } catch (error) {
      console.error(`Failed to broadcast to user ${userId}:`, error);
      userSessions.delete(userId);
    }
  }
};
