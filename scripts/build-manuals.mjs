// Genera src/content/manual-*.ts a partir de docs/manuales/*.md (node scripts/build-manuals.mjs)
import { readFileSync, writeFileSync } from "node:fs";
for (const name of ["atletas", "coaches"]) {
  const md = readFileSync(`docs/manuales/${name}.md`, "utf8");
  writeFileSync(
    `src/content/manual-${name}.ts`,
    `// Generado desde docs/manuales/${name}.md (node scripts/build-manuals.mjs). No editar a mano.\nconst md = ${JSON.stringify(md)};\nexport default md;\n`,
  );
  console.log(`manual-${name}.ts`);
}
