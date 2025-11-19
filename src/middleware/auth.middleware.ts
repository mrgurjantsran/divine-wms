import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../config/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | null = null;

    // 1️⃣ Try token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // 2️⃣ If not found, try token from Cookies
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // 3️⃣ If still no token → unauthorized
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    // Validate token
    const user = verifyToken(token);
    req.user = user;

    next();

  } catch (error: any) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};


// 🔥 ADMIN ONLY middleware
export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};
