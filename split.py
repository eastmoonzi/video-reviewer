import sys

def extract_lines(file_path, ranges, out_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    with open(out_path, 'w', encoding='utf-8') as f:
        for start, end in ranges:
            f.writelines(lines[start-1:end])

ranges = {
    'js/state.js': [(8, 354)],
    'js/main.js': [(356, 445)],
    'js/video.js': [(447, 668)],
    'js/tabs.js': [(670, 721)],
    'js/api.js': [(723, 1001)],
    'js/render.js': [(1003, 1198)],
    'js/scoring.js': [(1201, 1236)],
    'js/task.js': [(1239, 1729), (2885, 2932)],
    'js/parser.js': [(1732, 2883)],
    'js/export.js': [(2934, 3022), (4085, 4396)],
    'js/storage.js': [(3025, 3077)],
    'js/panels.js': [(3100, 3173)],
    'js/shortcuts.js': [(3175, 3201)],
    'js/demo.js': [(3215, 3274)],
    'js/modes.js': [(3278, 3883), (3886, 4083)],
    'js/compare.js': [(4398, 4914)]
}

for out_path, rng in ranges.items():
    extract_lines('app.js', rng, out_path)
    print(f"Extracted to {out_path}")
