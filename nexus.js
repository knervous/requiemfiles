import fs from "node:fs";
import path from "node:path";
import xxhash from "xxhash-wasm";

const manifestTemplate = {
  shortName: "",
  longName: "",
  customFilesUrl: "",
  filesUrlPrefix: "",
  version: "0.1",
  website: "",
  description: "",
  hosts: [],
  required: [],
  files: {},
};

(async () => {
  try {
      let manifest;
      try {
        manifest = await import("./manifest.json", { assert: { type: "json" } });
        manifest = manifest.default;
      } catch {
        console.log(
          "Manifest file did not exist. Creating a new file from template."
        );
        manifest = manifestTemplate;
      }
  
    const { create64 } = await xxhash();
    const files = getFilesRecursively("./rof");
    const newFiles = files.reduce(
      (acc, val) => ({
        ...acc,
        ...generateFileHashSync(create64, val),
      }),
      {}
    );

    manifest.files = newFiles;
    fs.writeFileSync("./manifest.json", JSON.stringify(manifest, null, 4));
  } catch (error) {
    console.error("Error generating hash:", error);
  }
})();

/**
 *
 * @param {import('xxhash-wasm').XXHashAPI.create64} create64
 * @param {string} filePath
 * @returns
 */
function generateFileHashSync(create64, filePath) {
  const fp = path.join("rof", filePath);
  const hasher = create64();
  const bufferSize = 4096;
  const fileDescriptor = fs.openSync(fp, "r");
  const buffer = Buffer.alloc(bufferSize);

  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fileDescriptor, buffer, 0, bufferSize, null);
      hasher.update(buffer.slice(0, bytesRead));
    } while (bytesRead > 0);

    const hash = hasher.digest();
    return { [filePath]: hash.toString(16).toUpperCase().padStart(16, "0") };
  } catch (err) {
    console.error(`Failed to process file: ${filePath}`, err);
    return "";
  } finally {
    fs.closeSync(fileDescriptor);
  }
}

function getFilesRecursively(startFolder) {
  const result = [];
  function readDirRecursive(currentFolder) {
    const entries = fs.readdirSync(currentFolder, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        readDirRecursive(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path
          .relative(startFolder, fullPath)
          .replace(/\\/g, "/");
        result.push(relativePath);
      }
    }
  }
  readDirRecursive(startFolder);
  return result;
}
