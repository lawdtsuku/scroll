import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const declaration=name=>app.split('\n').find(line=>line.startsWith('function '+name+'('));
test('reference card stays visible with owner stats hidden; both notices export the exact pending character',()=>{
 const characters=[{character_id:'a',name:'Owner A',reference_revision:2,profile:{}},{character_id:'b',name:'Owner B',reference_revision:3,profile:{}}];
 const ctx={state:{characters},refMarks:{a:2,b:2},selected:()=>characters[0],heading:()=>'',ownerSheetEnabled:()=>false,esc:s=>s??'',exchangeStepper:()=>''};
 vm.createContext(ctx);vm.runInContext(['referenceReminder','referenceView','updatesView'].map(declaration).join('\n'),ctx);
 let html=vm.runInContext('referenceView()',ctx);assert.match(html,/<section class="card character-reference"><h2>Character reference/);assert.ok(html.indexOf('data-action="reference-export"')<html.indexOf('<details class="reference-management"'));
 html=vm.runInContext('updatesView()',ctx);assert.match(html,/data-reference-character="b">Export character reference/);assert.doesNotMatch(html,/data-reference-character="a"/);
 ctx.selected=()=>characters[1];html=vm.runInContext('referenceView()',ctx);assert.match(html,/reference-reminder/);assert.match(html,/data-reference-character="b">Export character reference/);
});
