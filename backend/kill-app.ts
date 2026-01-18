#!/usr/bin/env -S deno run -A

// Simple script to kill the running main.ts process using /proc filesystem

try {
  console.log("Looking for running main.ts process...");

  // Read /proc to find processes
  const procDir = "/proc";

  for await (const entry of Deno.readDir(procDir)) {
    // Check if directory name is a number (PID)
    const pid = parseInt(entry.name);
    if (isNaN(pid) || !entry.isDirectory) continue;

    try {
      // Read the cmdline file to see what command this process is running
      const cmdlinePath = `${procDir}/${pid}/cmdline`;
      const cmdline = await Deno.readTextFile(cmdlinePath);

      // Check if this is our main.ts process (but not this kill script)
      if (cmdline.includes("main.ts") && !cmdline.includes("kill-app.ts")) {
        console.log(`Found main.ts process with PID ${pid}`);
        console.log(`Command: ${cmdline.replace(/\0/g, " ")}`);

        // Kill the process
        Deno.kill(pid, "SIGTERM");
        console.log(`Successfully sent SIGTERM to process ${pid}`);

        // Wait a moment and check if still alive
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          // Check if process still exists
          await Deno.stat(`${procDir}/${pid}`);
          console.log("Process still running, sending SIGKILL...");
          Deno.kill(pid, "SIGKILL");
        } catch {
          console.log("Process terminated successfully");
        }

        Deno.exit(0);
      }
    } catch {
      // Skip processes we can't read
      continue;
    }
  }

  console.log("No running main.ts process found");
} catch (error) {
  console.error("Error:", error.message);
  Deno.exit(1);
}
