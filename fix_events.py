import os, re

# Load all exported symbols
symbol_map = {}
decl_pattern = re.compile(r'^export\s+(const|let|var|function|async\s+function)\s+([a-zA-Z0-9_]+)', re.MULTILINE)

import glob
for fpath in glob.glob('js/*.js'):
    if fpath.endswith('events.js') or fpath.endswith('main.js'):
        continue
    module_name = os.path.basename(fpath).replace('.js', '')
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    for match in decl_pattern.finditer(content):
        symbol_map[match.group(2)] = module_name

with open('js/events.js', 'r', encoding='utf-8') as f:
    events_content = f.read()

# Fix variable names with hyphen
events_content = re.sub(r'el_([a-zA-Z0-9_\-]+)', lambda m: 'el_' + m.group(1).replace('-', '_'), events_content)

# Replace function calls with Module.function()
def replace_call(match):
    func_name = match.group(0)
    if func_name in symbol_map:
        return f"{symbol_map[func_name]}.{func_name}"
    return func_name

events_content = re.sub(r'[a-zA-Z0-9_]+', replace_call, events_content)

with open('js/events.js', 'w', encoding='utf-8') as f:
    f.write(events_content)

print("Fixed events.js")
