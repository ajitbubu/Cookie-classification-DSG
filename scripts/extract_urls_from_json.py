import json
import pandas as pd
from pathlib import Path

# Read the JSON file
json_file = Path(__file__).parent / "page-scan.json"
with open(json_file, 'r') as f:
    data = json.load(f)

# Extract URLs from the pagesVisited array
urls = data.get('pagesVisited', [])

print(f"Total URLs found: {len(urls)}")

# Remove duplicates and sort
unique_urls = sorted(list(set(urls)))

print(f"Unique URLs: {len(unique_urls)}")

# Create a DataFrame and save to Excel
df = pd.DataFrame({'URL': unique_urls})
output_file = Path(__file__).parent / "page_scan_urls.xlsx"
df.to_excel(output_file, index=False, sheet_name='URLs')

print(f"\nExcel file created: {output_file}")
print(f"Total unique URLs exported: {len(unique_urls)}")
