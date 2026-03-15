import os, re, glob

# Regex to find top-level declarations
decl_pattern = re.compile(r'^(?:export\s+)?(const|let|var|function|async\s+function)\s+([a-zA-Z0-9_]+)', re.MULTILINE)

files = glob.glob('js/*.js')
symbol_map = {} # symbol -> filename
file_symbols = {f: [] for f in files}

# 1. Add exports and register symbols
for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Prepend export if not there
    def replace_decl(match):
        full_match = match.group(0)
        sym = match.group(2)
        symbol_map[sym] = os.path.basename(fpath)
        file_symbols[fpath].append(sym)
        if not full_match.startswith('export '):
            return 'export ' + full_match
        return full_match
    
    new_content = decl_pattern.sub(replace_decl, content)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_content)

# 2. Add imports based on usage
all_symbols = list(symbol_map.keys())

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    imports_needed = {}
    for sym in all_symbols:
        # Check if sym is used in this file but not declared in it
        # Simple heuristic: exact word match
        if sym not in file_symbols[fpath] and re.search(r'\b' + sym + r'\b', content):
            source_file = symbol_map[sym]
            if source_file not in imports_needed:
                imports_needed[source_file] = []
            imports_needed[source_file].append(sym)
    
    import_lines = []
    for source_file, syms in imports_needed.items():
        import_lines.append(f"import {{ {', '.join(syms)} }} from './{source_file}';\n")
    
    if import_lines:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(''.join(import_lines) + '\n' + content)
    
print("Auto module processing complete.")
