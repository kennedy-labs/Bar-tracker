import zipfile
import os

exclude = {'node_modules', 'dist', '.git', '.aistudio', 'bun.lock', 'public', '__pycache__'}

public_dir = 'public'
os.makedirs(public_dir, exist_ok=True)
zip_path = os.path.join(public_dir, 'bar-track-source.zip')

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude and not d.startswith('.git')]
        for file in files:
            if file in exclude or file.endswith('.zip'):
                continue
            filepath = os.path.join(root, file)
            arcname = os.path.relpath(filepath, '.')
            if arcname.startswith('./'):
                arcname = arcname[2:]
            zipf.write(filepath, arcname)

print(f"Successfully generated Windows-compatible zip at {zip_path} ({os.path.getsize(zip_path)} bytes)")
