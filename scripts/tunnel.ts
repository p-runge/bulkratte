import { spawn } from "child_process";
import * as qrcode from "qrcode-terminal";

const port = process.env.PORT ?? "3000";

const cf = spawn(
  "cloudflared",
  ["tunnel", "--url", `http://localhost:${port}`],
  {
    stdio: ["inherit", "inherit", "pipe"],
  },
);

let urlPrinted = false;

cf.stderr.on("data", (chunk: Buffer) => {
  const text = chunk.toString();
  process.stderr.write(text);

  if (!urlPrinted) {
    const match = text.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
    if (match) {
      urlPrinted = true;
      const url = match[0];
      console.log(`\n🚇  ${url}\n`);
      qrcode.generate(url, { small: true });
    }
  }
});

cf.on("close", (code) => process.exit(code ?? 0));
