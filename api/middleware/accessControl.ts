import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * 计费路由的访问控制。
 *
 * - 配置了 SCRAPER_API_TOKEN（至少 24 字符）：所有计费请求必须携带 `Authorization: Bearer <token>`。
 * - 配置了但过短：视为配置错误，一律 503，不回退到本机模式。
 * - 未配置：只允许本机直连（回环地址、Host 为回环主机名、没有任何代理转发头），其余一律 503，
 *   避免把服务端 Firecrawl 额度暴露成公开代理。Host 校验用于阻断 DNS rebinding。
 *   同机反向代理若不添加任何转发头，应用层无法识别——经反向代理部署必须配置 token。
 * - 额度：按客户端的每分钟与每日成本预算，进程内计数（重启清零，多实例不共享）。
 */

const MIN_TOKEN_LENGTH = 24;
const DEFAULT_PER_MINUTE = 30;
const DEFAULT_DAILY_BUDGET = 500;
const MAX_TRACKED_JOBS = 1000;
const FORWARD_HEADERS = ['x-forwarded-for', 'forwarded', 'x-real-ip', 'x-forwarded-host', 'x-forwarded-proto', 'via'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const TOKEN_CLIENT_ID = 'token';
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

interface Usage {
  minuteStart: number;
  minuteCost: number;
  dayStart: number;
  dayCost: number;
}

const usage = new Map<string, Usage>();
const jobOwners = new Map<string, string>();

export function resetAccessControlState(): void {
  usage.clear();
  jobOwners.clear();
}

type TokenConfig = { state: 'valid'; token: string } | { state: 'invalid' } | { state: 'absent' };

function tokenConfig(): TokenConfig {
  const token = process.env.SCRAPER_API_TOKEN?.trim();
  if (!token) return { state: 'absent' };
  return token.length >= MIN_TOKEN_LENGTH ? { state: 'valid', token } : { state: 'invalid' };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sameToken(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

function hostName(req: Request): string {
  const host = (req.headers.host ?? '').toLowerCase();
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : (host.split(':')[0] ?? '');
}

function isDirectLoopback(req: Request): boolean {
  if (FORWARD_HEADERS.some((name) => req.headers[name] !== undefined)) return false;
  if (!LOOPBACK_HOSTS.has(hostName(req))) return false;
  return LOOPBACK.has(req.socket.remoteAddress ?? '');
}

function clientId(req: Request): string {
  return (req.res?.locals.clientId as string | undefined) ?? 'unknown';
}

export const requireAccess: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const config = tokenConfig();
  if (config.state === 'invalid') {
    res.status(503).json({
      success: false,
      code: 'ACCESS_TOKEN_INVALID',
      error: 'SCRAPER_API_TOKEN is set but shorter than 24 chars; fix or unset it',
    });
    return;
  }
  if (config.state === 'valid') {
    const match = /^bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    const presented = match?.[1]?.trim() ?? '';
    if (!presented || !sameToken(presented, config.token)) {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Valid access token required' });
      return;
    }
    // 单一共享密钥：身份不拼来源 IP，否则换 IP 即可重置额度并丢失任务归属。
    res.locals.clientId = TOKEN_CLIENT_ID;
  } else if (isDirectLoopback(req)) {
    res.locals.clientId = 'loopback';
  } else {
    res.status(503).json({
      success: false,
      code: 'ACCESS_TOKEN_UNCONFIGURED',
      error: 'SCRAPER_API_TOKEN (>= 24 chars) must be configured before this service accepts non-local requests',
    });
    return;
  }

  // 跨站页面可以不经预检发送表单 POST；计费接口只接受 JSON。
  if (req.method === 'POST' && !req.is('application/json')) {
    res.status(415).json({ success: false, code: 'UNSUPPORTED_MEDIA_TYPE', error: 'Content-Type must be application/json' });
    return;
  }
  next();
};

/** 在 body 校验之后执行：按本次请求的成本扣减额度。 */
export function chargeCost(costOf: (req: Request) => number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const perMinute = positiveInt(process.env.SCRAPER_RATE_LIMIT_PER_MINUTE, DEFAULT_PER_MINUTE);
    const daily = positiveInt(process.env.SCRAPER_DAILY_BUDGET, DEFAULT_DAILY_BUDGET);
    const cost = Math.max(1, Math.ceil(costOf(req)));
    if (cost > perMinute || cost > daily) {
      // 再等也不会成功：不给 Retry-After，避免误导调用方重试。
      res.status(400).json({
        success: false,
        code: 'COST_EXCEEDS_LIMIT',
        error: `Request cost ${cost} exceeds the configured capacity (per minute ${perMinute}, per day ${daily})`,
      });
      return;
    }
    const now = Date.now();
    const id = clientId(req);
    const entry = usage.get(id) ?? { minuteStart: now, minuteCost: 0, dayStart: now, dayCost: 0 };
    if (now - entry.minuteStart >= 60_000) {
      entry.minuteStart = now;
      entry.minuteCost = 0;
    }
    if (now - entry.dayStart >= 86_400_000) {
      entry.dayStart = now;
      entry.dayCost = 0;
    }

    const overMinute = entry.minuteCost + cost > perMinute;
    const overDay = entry.dayCost + cost > daily;
    if (overMinute || overDay) {
      const retryMs = overDay ? entry.dayStart + 86_400_000 - now : entry.minuteStart + 60_000 - now;
      usage.set(id, entry);
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryMs / 1000))));
      res.status(429).json({
        success: false,
        code: overDay ? 'DAILY_BUDGET_EXCEEDED' : 'RATE_LIMITED',
        error: 'Request cost exceeds the configured budget',
      });
      return;
    }

    entry.minuteCost += cost;
    entry.dayCost += cost;
    usage.set(id, entry);
    next();
  };
}

export function rememberJob(req: Request, jobId: string): void {
  if (jobOwners.size >= MAX_TRACKED_JOBS) {
    const oldest = jobOwners.keys().next().value;
    if (oldest !== undefined) jobOwners.delete(oldest);
  }
  jobOwners.set(jobId, clientId(req));
}

export function ownsJob(req: Request, jobId: string): boolean {
  return jobOwners.get(jobId) === clientId(req);
}
