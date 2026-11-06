// validateWith() 把通过 Zod 校验的 body 挂在请求上。
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
    }
  }
}

export {};
