# Generate Challenges Markdown Script

This script generates a markdown file (`CHALLENGES.md`) with all challenges and location bonus points from CSV files.

## Setup

The CSV export buttons automatically appear when running the website on localhost. No configuration needed!

## Usage

1. **Run the website locally** (on localhost, 127.0.0.1, or file://)
   - The "📥 Export CSV" buttons will appear automatically

2. **Export CSV files from the website:**
   - Go to the Challenges page → click "📥 Export CSV" → save to `data/challenges.csv`
   - Go to the Neighborhoods page → click "📥 Export CSV" → save to `data/neighborhoods.csv`

3. **Run the generator script:**
   ```bash
   node scripts/generate-challenges-md.js
   ```

## Output

The script generates `CHALLENGES.md` in the root directory with:
- Link to website
- General challenges table (sorted by difficulty, then points)
- Location-specific challenges table (with location and bonus columns)
- Neighborhood bonus points tables (grouped by borough)

## Re-running

To regenerate with updated data:
1. Export fresh CSV files from the website
2. Run: `node scripts/generate-challenges-md.js`

## Files

- `generate-challenges-md.js` - Generator script (no dependencies needed)
- `../data/challenges.csv` - Exported challenges data
- `../data/neighborhoods.csv` - Exported neighborhoods data
- `../CHALLENGES.md` - Generated markdown file (excluded from git)
