from pathlib import Path
import shutil, hashlib, json, zipfile, re

ROOT=Path(__file__).resolve().parent
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
for directory in ['src','wallpaper','web','itch','docs','evidence']:
    (ROOT/directory).mkdir(parents=True,exist_ok=True)
ICON='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="16" fill="%23050a16"/%3E%3Cpath d="M32 8L37 27L56 32L37 37L32 56L27 37L8 32L27 27Z" fill="%2375dcff"/%3E%3C/svg%3E'
html=(ROOT/'src/template.html').read_text(encoding='utf-8').replace('<!--STYLE-->','<style>\n'+(ROOT/'src/style.css').read_text(encoding='utf-8')+'\n</style>').replace('<!--ENGINE-->','<script>\n'+(ROOT/'src/core.js').read_text(encoding='utf-8')+'\n'+(ROOT/'src/engine.js').read_text(encoding='utf-8')+'\n</script>')
(ROOT/'wallpaper/index.html').write_text(html.replace('<body>','<body><script>window.__NebulaWallpaper=true;</script>'),encoding='utf-8')
assert sha(ROOT/'wallpaper/index.html')=='f81b44c2fb917eda4ff0a6529f1ab8671d1cfff7b12177350cdd832189234127'
html=html.replace('</head>','<link rel="icon" href=\''+ICON+'\'>\n</head>')
for target in ['web/index.html','itch/index.html','index.html']:
    (ROOT/target).write_text(html,encoding='utf-8')
(ROOT/'web/.nojekyll').write_text('',encoding='utf-8')
shutil.copy2(ROOT/'wallpaper/preview.jpg',ROOT/'cover.jpg')
with zipfile.ZipFile(ROOT/'NebulaFlow_v1.5.0_itch.zip','w',zipfile.ZIP_DEFLATED) as z:
    z.write(ROOT/'itch/index.html','index.html')
props=json.loads((ROOT/'wallpaper/project.json').read_text(encoding='utf-8'))['general']['properties']
assert len(props)==16
assert not re.search(r'(?:src|href)=["\']https?://',html)
result={'version':'1.5.0','sharedCoreUnchanged':True,'nativeHTMLUnchanged':True,'nativeProperties':16,'webAndItchIdentical':True,'webSha256':sha(ROOT/'web/index.html'),'wallpaperSha256':sha(ROOT/'wallpaper/index.html'),'itchZipSha256':sha(ROOT/'NebulaFlow_v1.5.0_itch.zip')}
(ROOT/'evidence/build.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
