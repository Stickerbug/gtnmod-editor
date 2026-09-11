import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  /* 界面顶部显示的构建时间：用来确认浏览器加载的到底是哪一版 */
  define: { __GTN_STUDIO_BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  /* 只复制真正需要的站点图标；渲染器资源改成直接引游戏的文件
     （见 preview/card-host.html），因此不再把 public/vendor（3 MB）打进产物。 */
  publicDir: 'public-assets',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        /* 编辑器本体 + 卡面预览宿主页（iframe 用它渲染卡面） */
        main: 'index.html',
        'card-host': 'preview/card-host.html',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    /* 模组校验接口走同源代理转发到游戏服务：
       这样游戏服务不必为编辑器开 CORS，暴露面不变。
       换服务器地址时改这一行的 target 即可。 */
    proxy: {
      '/api/mod-studio': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        /* 游戏服务对 POST 做同源检查（Origin 必须在白名单里）。
           代理转发时把 Origin/Referer 改写成目标服务自身，避免被 403 拦下，
           同时不需要放宽服务端的 allowlist。 */
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://127.0.0.1:5000');
            proxyReq.setHeader('referer', 'http://127.0.0.1:5000/');
          });
        },
      },
      /* 卡面预览的 iframe 会取游戏的静态资源与版本号；线上同源天然可用，
         本地开发时靠这两条代理转发到本机游戏服务。 */
      '/static': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/api/healthz': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
});
