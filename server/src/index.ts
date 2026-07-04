import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`[lam-server] listening on :${env.port} (${env.nodeEnv})`);
  if (env.devAuthBypass) {
    console.warn('[lam-server] DEV_AUTH_BYPASS is ON — x-dev-user header accepted');
  }
});
