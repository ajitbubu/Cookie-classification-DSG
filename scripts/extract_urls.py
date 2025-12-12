import xml.etree.ElementTree as ET
import pandas as pd
from pathlib import Path

# Parse the sitemap XML file
sitemap_file = Path(__file__).parent / "sitemap.xml"
tree = ET.parse(sitemap_file)
root = tree.getroot()

# Define the namespace used in the sitemap
namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

# Extract all URLs from <loc> tags
urls = []
for url_element in root.findall('.//ns:loc', namespace):
    url = url_element.text
    if url:
        urls.append(url)

# Remove duplicates by converting to set and back to list
unique_urls = sorted(list(set(urls)))

print(f"Total URLs found: {len(urls)}")
print(f"Unique URLs: {len(unique_urls)}")

# Create a DataFrame and save to Excel
df = pd.DataFrame({'URL': unique_urls})
output_file = Path(__file__).parent / "sitemap_urls.xlsx"
df.to_excel(output_file, index=False, sheet_name='URLs')

print(f"\nExcel file created: {output_file}")
print(f"Total unique URLs exported: {len(unique_urls)}")
