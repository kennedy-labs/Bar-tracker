import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const databaseUrl =
    env.VITE_NEON_DATABASE_URL ||
    env.VITE_DATABASE_URL ||
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    process.env.VITE_NEON_DATABASE_URL ||
    process.env.VITE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    'postgresql://neondb_owner:npg_3H9lLezpVIMy@ep-mute-firefly-b1blllpb-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_NEON_DATABASE_URL': JSON.stringify(databaseUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
