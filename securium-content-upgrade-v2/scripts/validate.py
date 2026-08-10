import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
files=['data/theory-seeds.json','data/written-seeds.json','data/practical-seeds.json']
ids=set(); errors=[]
for f in files:
    data=json.loads((ROOT/f).read_text(encoding='utf-8'))
    for x in data:
        if x['id'] in ids: errors.append(f"duplicate id: {x['id']}")
        ids.add(x['id'])
        if not x.get('source_refs'): errors.append(f"missing source_refs: {x['id']}")
        if 'prompt' in x and len(x['prompt']) < 30: errors.append(f"question too short: {x['id']}")
if errors:
    print('\n'.join(errors)); sys.exit(1)
print(f'OK: {len(ids)} transformed seed records validated')
