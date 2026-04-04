import { Plugin } from 'vite';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export function versionPlugin(): Plugin {
  const version = Date.now().toString();

  return {
    name: 'version-plugin',

    config() {
      return {
        define: {
          '__APP_VERSION__': JSON.stringify(version),
        },
      };
    },

    writeBundle(options) {
      const outDir = options.dir || resolve(process.cwd(), 'dist');
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }
      writeFileSync(
        resolve(outDir, 'version.json'),
        JSON.stringify({
          version,
          buildDate: new Date().toISOString(),
        })
      );
    },
  };
}
