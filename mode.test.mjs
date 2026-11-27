import assert from 'node:assert/strict';
import { createMembers } from './members.mjs';
import { createHub } from './hub.mjs';

// Doğrulama servisi durumu: sms / test / off
assert.equal(createMembers({}).mode(), 'off');
assert.equal(createMembers({ testMode: true }).mode(), 'test');
assert.equal(createMembers({ sender: { send: async () => {} } }).mode(), 'sms');
assert.equal(createHub({ memberStore: createMembers({}) }).statsSnapshot().members, 'off');
assert.equal(createHub({ memberStore: createMembers({ testMode: true }) }).statsSnapshot().members, 'test');
console.log('Üyelik servis durumu testleri geçti');
