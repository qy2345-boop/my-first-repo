# When Do I Wake Up?

A D3.js visualization of nighttime awakenings using Apple Health sleep-stage data from Q4 2025.

## Research question

The page asks two related questions:

1. How many times did I wake during each recorded night?
2. Do awakenings cluster around a particular clock time or after a particular sleep stage?

## Awakening definition

To avoid counting tiny watch-detected fragments as separate events:

- Awake segments shorter than 1 minute are ignored.
- Awake segments separated by 3 minutes or less are merged into one awakening.

This is a descriptive visualization, not a medical assessment.

## Run

Open the folder in VS Code and use Live Server, or run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
