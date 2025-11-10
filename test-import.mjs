// Quick test to see if the plugin exports correctly
import plugin from './src/index.ts';

console.log('Module exports:', Object.keys(plugin));
console.log('Type of default export:', typeof plugin);

// Simulate what OpenCode does
const mod = await import('./src/index.ts');
console.log('Object.entries result:', Object.entries(mod));

for (const [name, fn] of Object.entries(mod)) {
  console.log(`Found export: ${name}, type: ${typeof fn}`);
}



