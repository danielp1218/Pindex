import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pindex',
    permissions: ['storage'],
    host_permissions: [
      'https://*.workers.dev/*',
      'https://gamma-api.polymarket.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
    // Remove default_popup to allow onClicked to fire
    icons: {
      '16': 'logo.png',
      '32': 'logo.png',
      '48': 'logo.png',
      '96': 'logo.png',
      '128': 'logo.png',
    },
    action: {
      default_icon: {
        '16': 'logo.png',
        '32': 'logo.png',
        '48': 'logo.png',
        '96': 'logo.png',
        '128': 'logo.png',
      },
      default_title: 'Pindex',
    },
    web_accessible_resources: [
      {
        resources: ['0117.mp4'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
