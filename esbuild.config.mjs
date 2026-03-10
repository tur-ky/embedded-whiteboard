import esbuild from "esbuild";
import process from "node:process";

const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/state", "@codemirror/view"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: "inline",
  treeShaking: true,
  outfile: "main.js"
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
