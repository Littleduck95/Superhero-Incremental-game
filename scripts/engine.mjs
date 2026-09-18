/* Loads the game engine out of src/Mantle.jsx for the scripts in here.
   esbuild bundles the file with React stubbed out, so the exported
   `engine` — content tables, derive, step and the cost helpers — can be
   driven from node without a DOM. */
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(os.tmpdir(), "mantle-engine.mjs");

await build({
  entryPoints: [path.join(here, "../src/Mantle.jsx")],
  bundle: true, format: "esm", outfile: out, jsx: "automatic", logLevel: "silent",
  external: ["react", "react/jsx-runtime"],
});

const react = path.join(os.tmpdir(), "mantle-react.js");
const runtime = path.join(os.tmpdir(), "mantle-react-jsx.js");
fs.writeFileSync(react, "export default {}; export const useState=0,useEffect=0,useRef=0,useCallback=0,useMemo=0;");
fs.writeFileSync(runtime, "export const jsx=0,jsxs=0,Fragment=0;");
fs.writeFileSync(out, fs.readFileSync(out, "utf8")
  .replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(runtime).href)}`)
  .replace(/from "react"/g, `from ${JSON.stringify(pathToFileURL(react).href)}`));

export const E = (await import(pathToFileURL(out).href)).engine;
