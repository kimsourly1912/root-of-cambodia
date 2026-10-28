import {access,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
try {await access('.dev.vars');}
catch {await writeFile('.dev.vars','BETTER_AUTH_SECRET='+randomBytes(32).toString('hex')+'\n',{mode:0o600});}
console.log('Local proof secret is available; no secret value is printed.');
