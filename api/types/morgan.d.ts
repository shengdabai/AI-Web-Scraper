// 项目未安装 @types/morgan；这里只声明实际用到的最小形状，避免为类型检查新增依赖。
declare module 'morgan' {
  import type { RequestHandler } from 'express';
  function morgan(format: string): RequestHandler;
  export default morgan;
}
