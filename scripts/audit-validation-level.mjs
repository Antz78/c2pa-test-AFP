import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('app.js','utf8');
const begin=source.indexOf('function validationLevel(v) {');
const end=source.indexOf('function signatureOf(a) {',begin);
if(begin<0||end<0)throw Error('C2PA validation classifier not found');
const validationLevel=vm.runInNewContext(source.slice(begin,end)+'; validationLevel;');
const cases=[
  [{code:'assertion.hashedURI.match',afpResultKind:'success'},'ok'],
  [{code:'claimSignature.validated',afpResultKind:'success'},'ok'],
  [{code:'claim.missing',afpResultKind:'failure'},'bad'],
  [{code:'assertion.hashedURI.mismatch',afpResultKind:'failure'},'bad'],
  [{code:'signingCredential.ocsp.revoked',afpResultKind:'failure'},'bad'],
  [{code:'signingCredential.untrusted',afpResultKind:'failure'},'warn'],
  [{code:'cawg.x509.credential.untrusted',afpResultKind:'failure'},'warn'],
  [{code:'timeStamp.untrusted',afpResultKind:'informational'},'warn'],
  [{code:'signingCredential.ocsp.skipped',afpResultKind:'informational'},'neutral'],
  [{code:'assertion.dataHash.additionalExclusionsPresent',afpResultKind:'informational'},'neutral'],
  [{code:'cawg.x509.signature.validated',afpResultKind:'informational'},'neutral'],
  [{code:'com.example.securityCheck.failed',afpResultKind:'failure'},'bad'],
  [{code:'com.example.unknown'},'neutral'],
  [{code:'timeStamp.validated',afpResultKind:'success'},'ok']
];
for(const [entry,expected] of cases){
 const got=validationLevel(entry);
 if(got!==expected)throw Error(entry.code+': '+got+' !== '+expected);
}
console.log('VALIDATION_CODE_AUDIT',cases.length+' cases passed');