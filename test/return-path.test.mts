import assert from 'node:assert/strict';
import {safeReturnPath} from '../lib/return-path';
for (const input of [undefined,null,12,'','https://other.invalid','//other.invalid','/\\other.invalid','/\n/other.invalid','/signin','/api/auth/signin']) assert.equal(safeReturnPath(input),'/library',String(input));
for (const input of ['/library','/packs/pr-review-pass','/packs?q=review#categories']) assert.equal(safeReturnPath(input),input);
console.log('13 safe-return-path checks passed');
