import { clerkClient } from "@clerk/express";

export const protectRoute = async (req, res, next) => {
  try {
    // Development Mock Auth Bypass
    const mockUserId = req.headers['x-mock-user'];
    if (process.env.NODE_ENV !== 'production' && mockUserId) {
      req.userId = mockUserId;
      return next();
    }

    const { auth } = req;
    if (!auth || !auth.userId) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    req.userId = auth.userId;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
