import re
import os

filepath = 'frontend/index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
if style_match:
    with open('frontend/style.css', 'w', encoding='utf-8') as f:
        f.write(style_match.group(1).strip())
    content = content.replace(style_match.group(0), '<link rel="stylesheet" href="style.css">')
    print("Extracted style.css")

# Extract scripts (skip config.js line which doesn't have closing tag right next to body content if match is greedy, but we look for the main one)
script_match = re.search(r'<script>\s*// ── CONFIG(.*?)</script>', content, re.DOTALL)
if script_match:
    with open('frontend/app.js', 'w', encoding='utf-8') as f:
        f.write(("// ── CONFIG" + script_match.group(1)).strip())
    content = content.replace(script_match.group(0), '<script src="app.js"></script>')
    print("Extracted app.js")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.html")
