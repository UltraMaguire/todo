AURA Focus Timer Fix

Replace your existing index.html, app.js, and style.css with the three files in this folder. Keep all three in the same project directory.

Timer behavior:
- Pause keeps the current session elapsed time in memory. Resume continues it.
- Save Session records the actual elapsed focus minutes, including a partially completed Pomodoro.
- Reset discards the unsaved session.
- Break timers do not add focus minutes or XP.
- A completed focus timer records the preset duration.

After replacing the files, refresh the app (Ctrl+F5). Existing saved data in localStorage is preserved.
