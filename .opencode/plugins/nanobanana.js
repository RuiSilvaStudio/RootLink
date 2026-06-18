// nanobanana OpenCode plugin wrapper
// Loads opencode-nanobanana from global ~/.opencode/node_modules
import { createRequire } from "module";
import { join } from "path";
import { homedir } from "os";

const require = createRequire(import.meta.url);
const nanobananaPath = join(homedir(), ".opencode", "node_modules", "opencode-nanobanana", "dist", "plugin.js");

const { default: nanobananaPlugin } = await import(nanobananaPath);

export default nanobananaPlugin;
