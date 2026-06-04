const packages = [
  {
    name: "leaflet",
    version: "1.9.4",
    files: ["dist/leaflet.css", "dist/leaflet.js"],
  },
  {
    name: "leaflet.markercluster",
    version: "1.5.3",
    files: [
      "dist/MarkerCluster.css",
      "dist/MarkerCluster.Default.css",
      "dist/leaflet.markercluster.js",
    ],
  },
];

const vendorDir = "public/vendor";
await Deno.mkdir(vendorDir, { recursive: true });

for (const pkg of packages) {
  const tarballUrl =
    `https://registry.npmjs.org/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`;
  console.log(`Downloading ${pkg.name}@${pkg.version} from npm registry...`);

  const response = await fetch(tarballUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${tarballUrl}: ${response.status} ${response.statusText}`,
    );
  }

  const tarball = new Uint8Array(await response.arrayBuffer());
  const tmpFile = await Deno.makeTempFile({ suffix: ".tgz" });
  try {
    await Deno.writeFile(tmpFile, tarball);

    for (const file of pkg.files) {
      const filename = file.split("/").pop()!;
      const dest = `${vendorDir}/${filename}`;

      const cmd = new Deno.Command("tar", {
        args: ["-xzf", tmpFile, "-O", `package/${file}`],
        stdout: "piped",
        stderr: "piped",
      });
      const { code, stdout, stderr } = await cmd.output();
      if (code !== 0) {
        const errMsg = new TextDecoder().decode(stderr);
        throw new Error(`Failed to extract ${file} from ${pkg.name}: ${errMsg}`);
      }

      await Deno.writeFile(dest, stdout);
      console.log(`  -> ${dest}`);
    }
  } finally {
    await Deno.remove(tmpFile);
  }
}

console.log("Vendor complete.");
