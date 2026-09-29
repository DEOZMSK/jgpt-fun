import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {calculateAstrology} from './astrology/engine-core';
import {calculateTransit} from './astrology/transit-core';
import {allowedLabRequest,acquireCalculation} from './lab-request';
const fixture=JSON.parse(readFileSync('tests/global-baseline.json','utf8'));
function equivalent(actual:unknown,expected:unknown,path='result') {
 if(typeof actual==='number'&&typeof expected==='number') {assert.ok(Math.abs(actual-expected)<=1e-8,`${path}: ${actual} != ${expected}`);return;}
 if(actual&&expected&&typeof actual==='object'&&typeof expected==='object') {
  assert.deepEqual(Object.keys(actual),Object.keys(expected),path);
  for(const key of Object.keys(expected)) {
   if(['node','icu','tz'].includes(key)&&(path.endsWith('.dataVersions')||path.endsWith('.timeData')))continue;
   equivalent((actual as Record<string,unknown>)[key],(expected as Record<string,unknown>)[key],`${path}.${key}`);
  }return;
 }assert.equal(actual,expected,path);
}
test('extracted mathematical modules retain their exact source baseline',()=>{
 const baseline=JSON.parse(readFileSync('docs/engine-baseline.json','utf8'));
 for(const {file,sha256}of baseline.files)assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),sha256,file);
});
test('synthetic GLOBAL baseline survives migration and interleaved node settings',()=>{
 for(const {input,result}of [...fixture.cases,...fixture.cases.toReversed()])equivalent(calculateAstrology(input),result);
 equivalent(calculateTransit(fixture.transit.input),fixture.transit.result);
 equivalent(calculateAstrology(fixture.cases[0].input),fixture.cases[0].result);
});
test('public API admits only same-origin application requests',()=>{
 const request=(host:string,origin:string)=>new Request(`https://${host}/api/astrology/calculate`,{headers:{host,origin}});
 assert.equal(allowedLabRequest(request('jgpt.fun','https://jgpt.fun')),true);
 assert.equal(allowedLabRequest(request('jgpt.fun','https://attacker.invalid')),false);
 assert.equal(allowedLabRequest(request('jgpt.site','https://jgpt.site')),false);
 assert.equal(allowedLabRequest(request('unrelated.vercel.app','https://unrelated.vercel.app')),false);
 const r=request('jgpt.fun','https://jgpt.fun'); const one=acquireCalculation(r),two=acquireCalculation(r);
 assert.ok(one&&two);assert.equal(acquireCalculation(r),null);one();two();
 const next=acquireCalculation(r);assert.ok(next);next();
});
