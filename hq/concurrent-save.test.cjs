const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/app6.js', 'utf8');
const writer = source.slice(source.indexOf('async function writeCloudState()'), source.indexOf('async function syncReceipts()'));

function session(expected, revisions, rejectFirst = false) {
  const writes = [];
  const sandbox = {
    ghStateSha: expected, ghPass: 'test', state: { jobs: [{id: 'local'}] },
    withStateWriteLock: fn => fn(), structuredClone, sealText: async text => text,
    getFile: async () => revisions.shift(), console: {warn() {}}, setTimeout: fn => fn(),
    putFile: async (_path, _text, _message, sha) => {
      writes.push(sha);
      if (rejectFirst && writes.length === 1) throw Object.assign(new Error('conflict'), {status: 409});
      return {content: {sha: 'saved'}};
    }
  };
  return {run: () => vm.runInNewContext(writer + '\nwriteCloudState()', sandbox), writes, sandbox};
}

test('a racing save preserves the local edits and the other computer’s revision', async () => {
  const s = session('original', [{sha:'original'}, {sha:'other'}], true);
  await assert.rejects(s.run(), /Another computer/);
  assert.deepEqual(s.writes, ['original']);
  assert.equal(s.sandbox.ghStateSha, 'original');
  assert.equal(s.sandbox.state.jobs[0].id, 'local');
});

test('unexpected file creation or disappearance cannot overwrite either copy', async () => {
  for (const [expected, remote] of [['', {sha:'other'}], ['original', null]]) {
    const s = session(expected, [remote]);
    await assert.rejects(s.run(), /Another computer/);
    assert.deepEqual(s.writes, []);
  }
});

test('unrelated repository conflict retries successfully against the same revision', async () => {
  const s = session('original', [{sha:'original'}, {sha:'original'}], true);
  await s.run();
  assert.deepEqual(s.writes, ['original', 'original']);
  assert.equal(s.sandbox.ghStateSha, 'saved');
});
