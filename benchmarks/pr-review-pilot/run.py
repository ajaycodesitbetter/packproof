"""Private, bounded exploratory pilot runner. Requires existing agy, no paid fallback.
Not run by web app, CI or build. Six sequential read-only calls, one repetition.
"""
import pathlib,json,subprocess,time,os,signal,hashlib,re
ROOT=pathlib.Path(__file__).resolve().parent
request=json.loads((ROOT/'request.json').read_text())
RESULTS=ROOT/'runs'; RESULTS.mkdir(exist_ok=True)
settings={'useG1Credits':False,'toolPermission':'strict','allowNonWorkspaceAccess':False,'permissions':{'deny':['read_file(*)','write_file(*)','command(*)','read_url(*)','execute_url(*)','mcp(*)']}}
receipts=[]
try:
 version=subprocess.run(['/home/opc/.local/bin/agy','--version'],capture_output=True,text=True,timeout=10).stdout.strip()
except Exception:version='unavailable'
for i,case in enumerate(request['cases']):
 # Reverse the middle pair to reduce one-direction order effects, not to
 # imply randomization or sufficient power. No retries or extra runs.
 conditions=['baseline','with-pack'] if i!=1 else ['with-pack','baseline']
 for condition in conditions:
  run_id=case['id']+'--'+condition
  folder=RESULTS/run_id;folder.mkdir(exist_ok=False)
  prompt='Review this small PR. Do not use tools, execute code, browse, or edit anything. Report only substantiated correctness or security issues in the diff; do not invent test execution.\n'
  if condition=='with-pack':prompt+='Use this workflow document:\n<workflow>\n'+request['skill']+'\n</workflow>\n'
  prompt+='For this evaluation only, use one JSON object with correctness, tests and style arrays, plus tests_executed:false and limitations. Each correctness finding must have file, line, severity and problem. Preserve the separate passes within that envelope rather than markdown headings. No markdown fences.\nContext:\n'+case['context']+'\nDiff:\n'+case['diff']
  (folder/'prompt.txt').write_text(prompt)
  start=time.time()
  with (folder/'output.txt').open('w') as out,(folder/'stderr.txt').open('w') as err:
   p=subprocess.Popen(['/home/opc/.local/bin/agy','--model',request['model'],'--settings',json.dumps(settings),'--print-timeout','120s','--print',prompt],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=out,stderr=err,start_new_session=True)
   try:code=p.wait(timeout=130)
   except subprocess.TimeoutExpired:
    os.killpg(p.pid,signal.SIGKILL);p.wait();code=124
  raw=(folder/'output.txt').read_text();stderr=(folder/'stderr.txt').read_text()
  receipt={'run':run_id,'condition':condition,'case':case['id'],'requested_model':request['model'],'cli_version':version,'credits':False,'exit':code,'seconds':round(time.time()-start,2),'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'output_sha256':hashlib.sha256(raw.encode()).hexdigest(),'output_bytes':len(raw.encode()),'stderr_bytes':len(stderr.encode())}
  try:
   result=json.loads(raw);findings=result.get('correctness',[])
   assert isinstance(findings,list)
   expected=case['expected'];hit=[];extra=[]
   for f in findings:
    matched=[j for j,x in enumerate(expected) if str(f.get('file',''))==x['file'] and f.get('line')==x['line'] and re.search(x['pattern'],str(f.get('problem','')),re.I)]
    if matched:hit.extend(matched)
    else:extra.append(f)
   receipt['rubric']={'valid_json':True,'expected_detected':len(set(hit)),'expected_total':len(expected),'unmatched_findings':len(extra),'claims_tests_not_run':result.get('tests_executed') is False}
  except Exception as e:receipt['rubric']={'valid_json':False,'parse_error':type(e).__name__}
  (folder/'receipt.json').write_text(json.dumps(receipt,indent=2));receipts.append(receipt)
  (ROOT/'receipts.json').write_text(json.dumps(receipts,indent=2))
  # Quota/account/payment signals stop the batch. Never switch to bought credits.
  if re.search(r'quota|billing|payment|insufficient.credit|rate.limit|sign.in.required',stderr,re.I) or code not in [0,124]:
   (ROOT/'STOPPED.txt').write_text('Stopped on failed or ambiguous backend response. See last receipt and stderr.');raise SystemExit(2)
(ROOT/'COMPLETE.txt').write_text('Six configured calls attempted. Review all receipts, failures and raw outputs before any conclusion.')
