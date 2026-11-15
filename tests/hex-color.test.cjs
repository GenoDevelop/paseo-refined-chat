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

test('PR and issue references are not colors, while standalone numeric HEX values remain colors',()=>{
 for(const text of ['PR #123','pr: #1234','pull request #123','Issue #123456','issues #123','Fixes #123','PR #12345678'])assert.deepEqual(hexMatches(text),[],text);
 assert.deepEqual(hexMatches('#123','PR '),[]);
 assert.deepEqual(hexMatches('#123','pull request '),[]);
 assert.equal(hexMatches('#123').length,1);
 assert.equal(hexMatches('Color #123').length,1);
 assert.equal(hexMatches('PR #123 uses #ff8800')[0].hex,'#ff8800');
});
