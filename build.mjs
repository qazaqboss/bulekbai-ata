// Сборка index.html: кит Anatomy (iso-kit + lathe) + сцена + страница — в один самодостаточный файл.
// Запуск: node build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8");

// Превращает ES-модуль в пространство имён: const name = (() => { ...; return { exports } })();
function namespace(name, source, prelude = "") {
  const names = [];
  const body = source
    .replace(/^import .*$/gm, "")
    .replace(/^export (async function|function|const|let|class) ([A-Za-z0-9_$]+)/gm, (_, kind, id) => {
      names.push(id);
      return `${kind} ${id}`;
    });
  return `const ${name} = (() => {\n${prelude}\n${body}\nreturn { ${names.join(", ")} };\n})();\n`;
}

const kit = namespace("k", read("vendor/anatomy/iso-kit.mjs"));
const lathe = namespace("G", read("vendor/anatomy/lathe.mjs"), "const { cameraOf, iso, pathOf } = k;");
const scene = read("src/scene.js");
const page = read("src/page.html");

const code = `"use strict";\n${kit}${lathe}${scene}`.replace(/<\/(script)/gi, "<\\/$1");
const script = `<script>\n${code}\n</script>`;
const out = page.replace("<!--SCENE_SCRIPT-->", () => script);
writeFileSync(join(HERE, "index.html"), out);

// Баннер: те же стили и сцена; PNG снимается скриптом scripts/banner.cjs
const style = page.match(/<style>[\s\S]*?<\/style>/)[0];
const banner = read("src/banner.html").replace("<!--PAGE_STYLE-->", () => style).replace("<!--SCENE_SCRIPT-->", () => script);
writeFileSync(join(HERE, "banner.html"), banner);
const og = read("src/og.html").replace("<!--PAGE_STYLE-->", () => style).replace("<!--SCENE_SCRIPT-->", () => script);
writeFileSync(join(HERE, "og.html"), og);
console.log(`index.html: ${(out.length / 1024).toFixed(0)} KB`);
