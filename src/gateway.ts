import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';

interface Route {
  path: string;
  target: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class APIGateway {
  private app = express();
  private routes: Route[] = [];
  private rateLimits = new Map<string, RateLimitEntry>();
  private rateLimitWindow = 60000;
  private rateLimitMax = 100;

  constructor() {
    this.app.use(express.json());
  }

  addRoute(path: string, target: string): void {
    this.routes.push({ path, target });
    this.app.use(path, async (req, res) => {
      try {
        const response = await axios.request({
          method: req.method,
          url: target + req.path,
          headers: { ...req.headers, host: undefined },
          data: req.body
        });
        res.status(response.status).json(response.data);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });
  }

  rateLimit(max: number, windowMs: number): void {
    this.rateLimitMax = max;
    this.rateLimitWindow = windowMs;
    this.app.use((req, res, next) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const entry = this.rateLimits.get(key);
      if (!entry || now > entry.resetAt) {
        this.rateLimits.set(key, { count: 1, resetAt: now + this.rateLimitWindow });
        return next();
      }
      if (entry.count >= this.rateLimitMax) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      entry.count++;
      next();
    });
  }

  getApp() { return this.app; }
  listen(port: number, cb?: () => void) { return this.app.listen(port, cb); }
}
