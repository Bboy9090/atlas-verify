import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { configurationState, summarizeConfiguration, providerAllowed } from '../lib/provider-readiness.ts'

test('missing, empty and whitespace credentials are missing configuration', () => {
  assert.deepEqual(configurationState(['A','B','C'], { A:' ', B:'' }), {
    status:'missing_configuration', missingVariables:['A','B','C'], verification:'not_tested',
  })
})
test('credentials present never prove live service or expose values', () => {
  const r=configurationState(['A'], { A:'synthetic-secret-value' })
  assert.equal(r.status,'configured')
  assert.equal(r.verification,'not_tested')
  assert.equal(JSON.stringify(r).includes('synthetic-secret-value'),false)
})
test('public without key is not a live probe', () => {
  assert.deepEqual(configurationState([],{}),{status:'public_no_key',missingVariables:[],verification:'not_tested'})
})
test('summary keeps operational coverage unknown', () => {
  const s=summarizeConfiguration([{status:'configured'},{status:'public_no_key'},{status:'missing_configuration'}])
  assert.deepEqual(s,{operational:null,configured:1,publicNoKey:1,missingConfiguration:1,total:3,liveVerifiedCount:0,liveVerificationPerformed:false})
})
test('empty inventory is not a successful operational probe', () => {
  const s=summarizeConfiguration([])
  assert.equal(s.operational,null)
  assert.equal(s.liveVerificationPerformed,false)
})
test('synthetic blocked in production even with explicit flag and contradictory policy', () => {
  for(const production of [true,false]) {
    assert.equal(providerAllowed({sourceKind:'synthetic',production},{NODE_ENV:'production',ALLOW_SYNTHETIC_PROVIDERS:'true'}),false)
  }
})
test('synthetic requires explicit flag and development or test environment', () => {
  const p={sourceKind:'synthetic',production:false}
  assert.equal(providerAllowed(p,{NODE_ENV:'development'}),false)
  assert.equal(providerAllowed(p,{NODE_ENV:'test',ALLOW_SYNTHETIC_PROVIDERS:'true'}),true)
  assert.equal(providerAllowed(p,{ALLOW_SYNTHETIC_PROVIDERS:'true'}),false)
})
test('real adapters still follow declared production policy', () => {
  assert.equal(providerAllowed({sourceKind:'licensed_api',production:true},{NODE_ENV:'production'}),true)
  assert.equal(providerAllowed({sourceKind:'licensed_api',production:false},{NODE_ENV:'development'}),false)
})
test('source wiring: suppression precedes provider calls and both selection paths use same policy', () => {
  const src=readFileSync('app/api/cases/[id]/subjects/[subjectId]/enrich/route.ts','utf8')
  const check=src.indexOf('if (isSubjectSuppressed(subject, approved))')
  assert.ok(check>src.indexOf('const approved = await loadApprovedSuppressionHashes([subject])'))
  assert.ok(check>0 && check<src.indexOf('let providers = getAllProviders()'))
  assert.ok(check<src.indexOf('await provider.lookupSubject('))
  assert.ok(check<src.indexOf('await provider.lookup(input)'))
  assert.equal(src.split('providerAllowed(provider.sourcePolicy, process.env)').length-1,2)
  assert.match(src,/Subject is suppressed from live enrichment/)
})
test('source wiring: readiness API and registry use authentication and no-store', () => {
  for(const path of ['app/api/providers/readiness/route.ts','app/api/providers/route.ts']) {
    const src=readFileSync(path,'utf8')
    assert.match(src,/getServerSession\(authOptions\)/)
    assert.match(src,/'Cache-Control': 'no-store, private'/)
  }
  const src=readFileSync('app/api/providers/readiness/route.ts','utf8')
  assert.match(src,/summary: summarizeConfiguration\(integrations\)/)
})
