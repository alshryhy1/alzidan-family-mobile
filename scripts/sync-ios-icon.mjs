#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'assets', 'icon.png');
const target = join(
  root,
  'ios',
  'aaelhalzydan',
  'Images.xcassets',
  'AppIcon.appiconset',
  'App-Icon-1024x1024@1x.png',
);

if (!existsSync(source)) {
  console.error('Missing assets/icon.png');
  process.exit(1);
}

if (!existsSync(target)) {
  console.error('Missing iOS AppIcon target:', target);
  process.exit(1);
}

copyFileSync(source, target);
console.log('Synced assets/icon.png -> iOS AppIcon.appiconset');
