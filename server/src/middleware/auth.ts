import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { verifyIdToken } from '../lib/firebase';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Resolves the authenticated user:
 *  - Production: "Authorization: Bearer <firebase-id-token>" verified with firebase-admin.
 *  - Dev bypass: "x-dev-user: <email>" auto-provisions/loads a user (DEV_AUTH_BYPASS=true only).
 * The User row is auto-provisioned on first authenticated request.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (env.devAuthBypass) {
      const devEmail = req.header('x-dev-user');
      if (devEmail) {
        req.user = await prisma.user.upsert({
          where: { firebaseUid: `dev:${devEmail}` },
          update: {},
          create: { firebaseUid: `dev:${devEmail}`, email: devEmail, displayName: devEmail.split('@')[0] },
        });
        next();
        return;
      }
    }

    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return;
    }

    const decoded = await verifyIdToken(token);
    req.user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        email: decoded.email ?? undefined,
        photoUrl: decoded.picture ?? undefined,
      },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown.local`,
        displayName: decoded.name ?? null,
        photoUrl: decoded.picture ?? null,
      },
    });
    next();
  } catch (err) {
    console.error('[auth] verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
