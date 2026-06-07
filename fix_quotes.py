import os

files = ['./frontend/nginx.conf', './frontend/src/index.css', './docker-compose.yml']
for f in files:
    with open(f, 'r') as fh:
        content = fh.read()
    if content.startswith('"') and content.endswith('"'):
        content = content[1:-1]
    elif content.startswith('"'):
        content = content[1:]
    with open(f, 'w') as fh:
        fh.write(content)
    print(f'Fixed: {f}')