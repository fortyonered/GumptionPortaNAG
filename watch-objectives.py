import subprocess
import time
from pathlib import Path

FILE = Path("objectives.json")
CHECK_EVERY_SECONDS = 2
DEBOUNCE_SECONDS = 3

def run(cmd):
    print(">", " ".join(cmd))
    subprocess.run(cmd, check=True)

last_mtime = FILE.stat().st_mtime
pending = False
last_change = 0

print("Watching objectives.json for changes... Ctrl+C to stop.")

while True:
    try:
        mtime = FILE.stat().st_mtime

        if mtime != last_mtime:
            last_mtime = mtime
            pending = True
            last_change = time.time()
            print("Change detected...")

        if pending and time.time() - last_change >= DEBOUNCE_SECONDS:
            pending = False
            try:
                run(["git", "add", "objectives.json"])
                run(["git", "commit", "-m", "Update objectives.json"])
                run(["git", "push"])
                print("Pushed objectives.json.")
            except subprocess.CalledProcessError:
                print("Git push failed, or no changes to commit.")

        time.sleep(CHECK_EVERY_SECONDS)

    except KeyboardInterrupt:
        print("\nStopped.")
        break