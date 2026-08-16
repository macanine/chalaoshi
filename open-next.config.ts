import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// 本应用所有路由都是 force-dynamic + fetch no-store, 不用 Next 数据缓存,
// 因此不接 R2 incremental cache, 用默认内存实现即可。
export default defineCloudflareConfig();
