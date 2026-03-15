import re
from html.parser import HTMLParser

class EventHandlerExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.output_html = ''
        self.event_bindings = []
        self.id_counter = 0

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        events_found = {}
        
        # Check for event handlers
        for k, v in list(attr_dict.items()):
            if k.startswith('on'):
                events_found[k[2:]] = v
                del attr_dict[k]
        
        if events_found:
            # Need an ID
            if 'id' not in attr_dict:
                self.id_counter += 1
                attr_dict['id'] = f"auto_id_{self.id_counter}"
            
            element_id = attr_dict['id']
            for event_name, func_call in events_found.items():
                self.event_bindings.append({
                    'id': element_id,
                    'event': event_name,
                    'call': func_call
                })

        # Reconstruct tag
        attr_str = ' '.join([f'{k}="{v}"' if v is not None else k for k, v in attr_dict.items()])
        self.output_html += f"<{tag} {attr_str}>" if attr_str else f"<{tag}>"

    def handle_startendtag(self, tag, attrs):
        attr_dict = dict(attrs)
        events_found = {}
        for k, v in list(attr_dict.items()):
            if k.startswith('on'):
                events_found[k[2:]] = v
                del attr_dict[k]
        
        if events_found:
            if 'id' not in attr_dict:
                self.id_counter += 1
                attr_dict['id'] = f"auto_id_{self.id_counter}"
            element_id = attr_dict['id']
            for event_name, func_call in events_found.items():
                self.event_bindings.append({
                    'id': element_id,
                    'event': event_name,
                    'call': func_call
                })
        attr_str = ' '.join([f'{k}="{v}"' if v is not None else k for k, v in attr_dict.items()])
        self.output_html += f"<{tag} {attr_str}/>" if attr_str else f"<{tag}/>"

    def handle_endtag(self, tag):
        self.output_html += f"</{tag}>"

    def handle_data(self, data):
        self.output_html += data

    def handle_entityref(self, name):
        self.output_html += f"&{name};"

    def handle_charref(self, name):
        self.output_html += f"&#{name};"

    def handle_comment(self, data):
        self.output_html += f"<!--{data}-->"

    def handle_decl(self, decl):
        self.output_html += f"<!{decl}>"
    
    def handle_pi(self, data):
        self.output_html += f"<?{data}>"


with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

parser = EventHandlerExtractor()
# HTMLParser parses piece by piece. output_html gathers the reconstructed HTML
parser.feed(html_content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(parser.output_html)

js_bindings = "import * as Api from './api.js';\nimport * as State from './state.js';\nimport * as Ui from './ui.js';\nimport * as Parser from './parser.js';\nimport * as Tasks from './task.js';\nimport * as Modes from './modes.js';\nimport * as Compare from './compare.js';\nimport * as Export from './export.js';\n// Assume all exported symbols from those files might be needed\n\ndocument.addEventListener('DOMContentLoaded', () => {\n"
for b in parser.event_bindings:
    call_code = b['call']
    # If the call is just a function name like `submitReview()`, it works well.
    # Since we don't have global scope, we need a way to execute it.
    # The safest way without parsing AST is `eval` or converting them to global just for the evaluation.
    # Wait, B requires removing inline onclicks. We should use standard event listeners.
    js_bindings += f"\tconst el_{b['id']} = document.getElementById('{b['id']}');\n"
    js_bindings += f"\tif (el_{b['id']}) el_{b['id']}.addEventListener('{b['event']}', function(event) {{ {call_code} }});\n"
js_bindings += "});\n"

with open('js/events.js', 'w', encoding='utf-8') as f:
    f.write(js_bindings)
print(f"Extracted {len(parser.event_bindings)} bindings to js/events.js")
