import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const isWatch = process.argv.includes("--watch");

// Build the main plugin code (runs in Figma sandbox)
const codeBuildOptions = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  format: "iife",
  target: "es2020",
  platform: "browser",
  minify: !isWatch,
  sourcemap: false,
};

// Build the UI (we inline it into an HTML file)
const uiBuildOptions = {
  entryPoints: ["src/ui.tsx"],
  bundle: true,
  outfile: "dist/ui.js",
  format: "iife",
  target: "es2020",
  platform: "browser",
  minify: !isWatch,
  sourcemap: false,
  loader: { ".tsx": "tsx", ".ts": "ts" },
  jsxFactory: "h",
  jsxFragment: "Fragment",
};

function generateHtml() {
  const jsPath = path.resolve("dist/ui.js");
  let js = "";
  try {
    js = fs.readFileSync(jsPath, "utf-8");
  } catch {
    console.warn("Warning: dist/ui.js not found, generating empty HTML");
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #333; background: #fff; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>${js}</script>
</body>
</html>`;

  fs.writeFileSync("dist/ui.html", html, "utf-8");
  console.log("Generated dist/ui.html");
}

async function build() {
  fs.mkdirSync("dist", { recursive: true });

  if (isWatch) {
    const codeCtx = await esbuild.context(codeBuildOptions);
    const uiCtx = await esbuild.context(uiBuildOptions);

    await codeCtx.watch();
    await uiCtx.watch();

    // Initial build + HTML generation
    await codeCtx.rebuild();
    await uiCtx.rebuild();
    generateHtml();

    console.log("Watching for changes…");

    // Re-generate HTML on rebuild (poll-based for simplicity)
    setInterval(() => {
      generateHtml();
    }, 2000);
  } else {
    await esbuild.build(codeBuildOptions);
    console.log("Built dist/code.js");

    await esbuild.build(uiBuildOptions);
    console.log("Built dist/ui.js");

    generateHtml();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
