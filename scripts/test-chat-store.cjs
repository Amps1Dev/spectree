const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

global.window = { localStorage: new MemoryStorage() };

const sourcePath = path.join(process.cwd(), 'lib', 'chatStore.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
}).outputText;
const loadedModule = new Module(sourcePath, module);
loadedModule.filename = sourcePath;
loadedModule.paths = module.paths;
loadedModule._compile(compiled, sourcePath);
const chatStore = loadedModule.exports;

const conversation = chatStore.createConversation('Persistence test');
conversation.messages.push(
  chatStore.createMessage('user', 'Scan example.test'),
  chatStore.createMessage('assistant', 'Ready.'),
);

assert.equal(chatStore.writeChats([conversation]), true);
chatStore.writeActiveChatId(conversation.id);

const readBack = chatStore.readChats();
assert.equal(readBack.length, 1);
assert.equal(readBack[0].id, conversation.id);
assert.equal(readBack[0].messages.length, 2);
assert.equal(chatStore.readActiveChatId(), conversation.id);

const remaining = chatStore.deleteChat(conversation.id);
assert.equal(remaining.length, 0);
assert.equal(chatStore.readChats().length, 0);
assert.equal(chatStore.readActiveChatId(), null);

console.log('chatStore write: PASS');
console.log('chatStore read: PASS (2 messages)');
console.log('chatStore delete: PASS');
