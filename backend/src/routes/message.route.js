import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import prisma from "../lib/prisma.js";
import { broadcastToUser } from "../lib/realtime.js";
import sharp from "sharp";

const router = express.Router();

router.get("/users", protectRoute, async (req, res) => {
  try {
    const loggedInUserId = req.userId;
    const { search } = req.query;

    if (!search) {
      if (process.env.NODE_ENV !== 'production') {
        const users = await prisma.user.findMany({
          where: { id: { not: loggedInUserId } },
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            profilePic: true,
            publicKey: true,
          },
        });
        return res.status(200).json(users);
      }
      return res.status(200).json([]);
    }

    const [searchUsername, idSuffix] = search.split("#");
    if (!searchUsername || !idSuffix) {
      return res.status(200).json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: loggedInUserId },
        username: { equals: searchUsername, mode: 'insensitive' },
        id: { endsWith: idSuffix },
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        profilePic: true,
        publicKey: true,
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getUsers: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/public-key", protectRoute, async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.userId;

    if (!publicKey) {
      return res.status(400).json({ message: "Public key is required" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { publicKey },
    });

    res.status(200).json({ message: "Public key updated successfully" });
  } catch (error) {
    console.error("Error in updatePublicKey: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", protectRoute, async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.userId;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/send/:id", protectRoute, async (req, res) => {
  try {
    let { text, image, voice, location } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.userId;

    if (image && image.startsWith("data:image")) {
      try {
        const base64Data = image.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        const optimizedBuffer = await sharp(buffer)
          .avif({ quality: 50 })
          .toBuffer();
        image = `data:image/avif;base64,${optimizedBuffer.toString("base64")}`;
      } catch (sharpError) {
        console.error("Error optimizing image:", sharpError);
      }
    }

    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        text,
        image,
        voice,
        location,
      },
    });

    await broadcastToUser(receiverId, {
      type: "NEW_MESSAGE",
      data: newMessage,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/clear/:id", protectRoute, async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.userId;

    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      },
    });

    res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    console.log("Error in clearChat: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
