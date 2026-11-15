const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const m={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync('client/components/markdown/hex-color.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports);
const {hexMatches,hexChannels}=m.exports;
test('Recognizes all CSS hex lengths without consuming identifiers or paths',()=>{
 assert.deepEqual(hexMatches('#fff #abcd #112233 #12345678').map(x=>x.hex),['#fff','#abcd','#112233','#12345678']);
 for(const text of ['#12345','#1234567','#123456789','abc#fff','https://host/#abc','file#abc','foo_#abc','#deadbeef00'])assert.equal(hexMatches(text).length,0,text);
 assert.equal(hexMatches('Color: (#f80), next.')[0].index,8);
});
test('Expands channels and alpha and converts HSL including achromatic colors',()=>{
 assert.deepEqual(hexChannels('#f00'),{r:255,g:0,b:0,alpha:1,h:0,s:100,l:50});
 assert.equal(hexChannels('#fff').s,0);assert.equal(hexChannels('#000').l,0);
 assert.equal(hexChannels('#0f08').alpha,136/255);assert.equal(hexChannels('#11223300').alpha,0);
 assert.equal(hexChannels('#00ff00').h,120);assert.equal(hexChannels('#0000ff').h,240);
});
