from __future__ import annotations
import argparse, csv, hashlib, json, shutil, uuid
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path.cwd()

def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

def tsv(path):
 fields=['id','kind','stored','original','type','length','sha','public','active','alt','product_refs','gallery_refs','desktop_refs','mobile_refs','setting_refs']
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f,fieldnames=fields,delimiter='\t'))

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--copy-generated-files',action='store_true',help='copy verified PNG derivatives into the active media root; still does not update DB')
 ap.add_argument('--assets',type=Path,default=Path('.tmp-existing-image-audit/media-assets-references.tsv'))
 ap.add_argument('--product-stage',type=Path,default=Path('.tmp-existing-image-audit/staged/manifest.json'))
 ap.add_argument('--hero-stage',type=Path,default=Path('.tmp-existing-image-audit/staged-hero/manifest.json'))
 ap.add_argument('--logo-png',type=Path,default=Path('.tmp-existing-image-audit/logo-key/logo-white-key.png'))
 ap.add_argument('--media-root',type=Path,default=Path('backend/App_Data/media'))
 ap.add_argument('--out',type=Path,default=Path('.tmp-existing-image-audit/rollout'))
 a=ap.parse_args(); root=a.media_root.resolve(); a.out.mkdir(parents=True,exist_ok=True)
 rows={r['id']:r for r in tsv(a.assets)}; candidates=[]
 for path,expected_kind in [(a.product_stage,'PRODUCT'),(a.hero_stage,'HERO')]:
  for group in json.loads(path.read_text(encoding='utf-8')):
   if group.get('status')!='staged':continue
   staged=path.parent/group['staged_file']
   with Image.open(staged) as im:
    im.load()
    if im.format!='PNG' or im.mode!='RGBA' or im.getchannel('A').getextrema()[0]!=0 or im.getchannel('A').getextrema()[1]!=255:raise SystemExit(f'Bad transparent PNG stage: {staged}')
    src=(root/group['source_file']).resolve()
    if root not in src.parents or not src.is_file() or digest(src)!=group['source_sha256']:raise SystemExit(f'Source changed since audit: {src}')
    if expected_kind=='PRODUCT':
     with Image.open(src) as original:
      if original.size!=im.size or not np.array_equal(np.asarray(original.convert('RGB')),np.asarray(im.convert('RGB'))):raise SystemExit(f'RGB/dimensions changed in proposed cutout {staged}')
   for asset_id in group['asset_ids']:
    row=rows.get(asset_id)
    if not row or row['kind']!=expected_kind or row['active']!='1' or row['public']!='1':raise SystemExit(f'Asset scope/status mismatch for {asset_id}')
    row_src=(root/row['stored']).resolve()
    if row['sha'].lower()!=group['source_sha256'] or root not in row_src.parents or not row_src.is_file() or digest(row_src)!=group['source_sha256']:raise SystemExit(f'Media row no longer matches audited source: {asset_id}')
    with Image.open(staged) as proposed, Image.open(row_src) as original:
     if original.size!=proposed.size or not np.array_equal(np.asarray(original.convert('RGB')),np.asarray(proposed.convert('RGB'))):raise SystemExit(f'RGB/dimensions changed for asset {asset_id}')
    candidates.append((row,staged,'U2Net background matte; original RGB unchanged'))
 # The current public website logo has pure-white, pixel-uniform corners. U2Net
 # removed the company name, so use the separately checkerboard-reviewed white key.
 logo_ids=[r['id'] for r in rows.values() if r['kind']=='LOGO' and r['active']=='1' and int(r['setting_refs'])>0]
 if len(logo_ids)!=1:raise SystemExit(f'Expected the single active logo referenced by website.logoUrl; found {len(logo_ids)}')
 logo=rows[logo_ids[0]]; logo_src=(root/logo['stored']).resolve()
 if digest(logo_src)!=logo['sha'].lower():raise SystemExit('The active logo file changed since it was reviewed')
 with Image.open(a.logo_png) as im:
  im.load()
  if im.format!='PNG' or im.mode!='RGBA' or im.getchannel('A').getextrema()[0]!=0 or im.size!=Image.open(logo_src).size:raise SystemExit('Logo keyed output failed format/alpha/dimension checks')
 candidates.append((logo,a.logo_png,'White-background key with edge decontamination; name and mark visually verified'))
 if len({r['id'] for r,_,_ in candidates})!=len(candidates):raise SystemExit('Duplicate MediaAsset candidate')
 operation=[]
 for row,stage,method in candidates:
  new='transparent-'+row['id'].replace('-','')+'.png'; dest=root/new
  if dest.exists():raise SystemExit(f'Refusing to overwrite existing file {dest}')
  with Image.open(stage) as im:
   alpha=im.getchannel('A'); extrema=alpha.getextrema()
   if extrema[0]!=0 or extrema[1]!=255:raise SystemExit(f'Missing real alpha channel: {stage}')
   entry={'id':row['id'],'kind':row['kind'],'isPublic':row['public']=='1','isActive':True,'originalName':row['original'],'oldStoredFileName':row['stored'],'oldContentType':row['type'],'oldLength':int(row['length']),'oldSha256':row['sha'].lower(),'newStoredFileName':new,'newContentType':'image/png','newLength':stage.stat().st_size,'newSha256':digest(stage),'sourceWidth':im.width,'sourceHeight':im.height,'transparentPixelFraction':round(float((np.asarray(alpha)<255).mean()),5),'method':method,'productUrlRefs':int(row['product_refs']),'productGalleryUrlRefs':int(row['gallery_refs']),'desktopAssetRefs':int(row['desktop_refs']),'mobileAssetRefs':int(row['mobile_refs']),'siteSettingRefs':int(row['setting_refs']),'publicUrlBeforeAndAfter':f"/api/site/media/{row['id']}"}
   if entry['transparentPixelFraction']<=0:raise SystemExit(f'No transparent pixels: {stage}')
   operation.append(entry)
 opfile=a.out/'media-asset-update-plan.json';opfile.write_text(json.dumps(operation,indent=2,ensure_ascii=False),encoding='utf-8')
 with (a.out/'media-asset-update-plan.csv').open('w',encoding='utf-8-sig',newline='') as f:
  fields=list(operation[0]); w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(operation)
 sql=['START TRANSACTION;']
 for e in operation:
  id=e['id'];old=e['oldStoredFileName'].replace("'","''");oldsha=e['oldSha256'];oldtype=e['oldContentType'].replace("'","''");new=e['newStoredFileName'];newsha=e['newSha256'];length=e['newLength']
  sql.append(f"UPDATE media_assets SET StoredFileName='{new}',ContentType='image/png',Length={length},Sha256='{newsha}',UpdatedAt=UTC_TIMESTAMP(6) WHERE Id='{id}' AND StoredFileName='{old}' AND ContentType='{oldtype}' AND Sha256='{oldsha}';")
 sql.append('COMMIT;')
 (a.out/'update-media-assets.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
 rollback=['START TRANSACTION;']
 for e in operation:
  rollback.append(f"UPDATE media_assets SET StoredFileName='{e['oldStoredFileName']}',ContentType='{e['oldContentType']}',Length={e['oldLength']},Sha256='{e['oldSha256']}',UpdatedAt=UTC_TIMESTAMP(6) WHERE Id='{e['id']}' AND StoredFileName='{e['newStoredFileName']}' AND Sha256='{e['newSha256']}';")
 rollback.append('COMMIT;')
 (a.out/'rollback-media-assets.sql').write_text('\n'.join(rollback)+'\n',encoding='utf-8')
 if a.copy_generated_files:
  for e,(_,stage,_) in zip(operation,candidates):
   dest=root/e['newStoredFileName'];shutil.copyfile(stage,dest)
   if dest.stat().st_size!=e['newLength'] or digest(dest)!=e['newSha256']:raise SystemExit(f'Copied file verification failed: {dest}')
  print(f'Copied {len(operation)} verified new PNG files. Source files and database references are unchanged.')
 else:print(f'Prepared {len(operation)} updates without copying files or changing the database.')
 by_kind={}
 for e in operation:by_kind[e['kind']]=by_kind.get(e['kind'],0)+1
 print(json.dumps({'rows':len(operation),'rowsByKind':by_kind,'totalTransparentPixelsFiles':sum(e['transparentPixelFraction']>0 for e in operation),'plan':str(opfile),'rollbackSql':str(a.out/'rollback-media-assets.sql')},indent=2))

if __name__=='__main__':main()
