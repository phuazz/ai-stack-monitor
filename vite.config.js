import {defineConfig} from "vite";
import {viteSingleFile} from "vite-plugin-singlefile";

export default defineConfig({
  base:"./",
  esbuild:{jsxFactory:"localElement",jsxInject:'import {localElement} from "/app/src/locale-element.js"'},
  plugins:[viteSingleFile()],
  build:{outDir:"docs"}
});
