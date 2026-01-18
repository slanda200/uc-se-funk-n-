import fs from "fs";
import path from "path";
import Papa from "papaparse";

const IN_DIR = "base44-data";
const OUT_DIR = path.join("src", "data", "base44");

fs.mkdirSync(OUT_DIR, { recursive: true });

function convert(file) {
  const csvPath = path.join(IN_DIR, file);
  const csv = fs.readFileSync(csvPath, "utf8");

  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data.map((r) => ({
    ...r,
    order: r.order !== "" ? Number(r.order) : r.order,
    grade: r.grade !== "" ? Number(r.grade) : r.grade,
    points: r.points !== "" ? Number(r.points) : r.points,
    difficulty: r.difficulty !== "" ? Number(r.difficulty) : r.difficulty,
    is_test: r.is_test === "true",
  }));

  const outName = file
    .replace("_export.csv", "")
    .replace(".csv", "")
    .toLowerCase();

  fs.writeFileSync(
    path.join(OUT_DIR, `${outName}.json`),
    JSON.stringify(rows, null, 2),
    "utf8"
  );

  console.log("✔", outName);
}

convert("Subject_export.csv");
convert("Topic_export.csv");
convert("Category_export.csv");
convert("Exercise_export.csv");
convert("UserProgress_export.csv");
