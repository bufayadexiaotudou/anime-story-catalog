import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'source.html');
const metaPath = path.join(root, 'payload-meta.json');
const ITERATIONS = 310000;
const PART_SIZE = 9000;

function die(message, code = 1) {
  console.error(`\n[错误] ${message}`);
  process.exit(code);
}

function runGit(args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    throw new Error(stderr || stdout || `git ${args.join(' ')} 执行失败`);
  }
}

function askLine(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (data) => {
      process.stdin.pause();
      process.stdin.off('data', onData);
      resolve(data.replace(/[\r\n]+$/, ''));
    };
    process.stdin.on('data', onData);
  });
}

function askHidden(promptText) {
  if (!process.stdin.isTTY) return askLine(promptText);
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    let value = '';
    output.write(promptText);
    input.resume();
    input.setEncoding('utf8');
    input.setRawMode(true);

    const cleanup = () => {
      input.off('data', onData);
      try { input.setRawMode(false); } catch {}
      input.pause();
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('用户取消操作'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }
        if (ch >= ' ') {
          value += ch;
          output.write('*');
        }
      }
    };

    input.on('data', onData);
  });
}

function deriveKey(password, salt, iterations = ITERATIONS) {
  return pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, 32, 'sha256');
}

function encryptBuffer(plain, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(password, salt, ITERATIONS);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([ciphertext, tag]);
  return { salt, iv, packed };
}

function decryptBuffer(packed, password, salt, iv, iterations = ITERATIONS) {
  if (packed.length < 16) throw new Error('密文长度异常');
  const key = deriveKey(password, salt, iterations);
  const ciphertext = packed.subarray(0, packed.length - 16);
  const tag = packed.subarray(packed.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function readCurrentPayload() {
  if (!fs.existsSync(metaPath)) throw new Error('找不到 payload-meta.json，无法恢复当前明文。');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (!Array.isArray(meta.parts) || meta.parts.length === 0) throw new Error('payload-meta.json 中没有有效的 parts。');
  const b64 = meta.parts.map((name) => {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) throw new Error(`缺少密文分片：${name}`);
    return fs.readFileSync(file, 'utf8').trim();
  }).join('');
  return { meta, packed: Buffer.from(b64, 'base64') };
}

function writeNewPayload(plain, password) {
  const { salt, iv, packed } = encryptBuffer(plain, password);
  const b64 = packed.toString('base64');
  const parts = [];
  for (let i = 0; i < b64.length; i += PART_SIZE) parts.push(b64.slice(i, i + PART_SIZE));

  const names = parts.map((_, i) => `payload-${String(i + 1).padStart(2, '0')}.txt`);
  const existing = fs.readdirSync(root).filter((name) => /^payload-.*\.txt$/i.test(name));

  for (let i = 0; i < parts.length; i++) fs.writeFileSync(path.join(root, names[i]), parts[i], 'utf8');
  for (const name of existing) if (!names.includes(name)) fs.rmSync(path.join(root, name));

  const meta = {
    v: 1,
    kdf: 'PBKDF2-SHA-256',
    iter: ITERATIONS,
    salt: salt.toString('base64'),
    cipher: 'AES-256-GCM',
    iv: iv.toString('base64'),
    parts: names,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');

  const verifyPacked = Buffer.from(parts.join(''), 'base64');
  const verify = decryptBuffer(verifyPacked, password, salt, iv, ITERATIONS);
  if (!verify.equals(plain)) throw new Error('新密文自检失败，已停止 Git 提交。');

  return { names, oldNames: existing };
}

function assertRepoSafety() {
  const top = path.resolve(runGit(['rev-parse', '--show-toplevel']).trim());
  if (top.toLowerCase() !== root.toLowerCase()) throw new Error(`脚本必须位于仓库根目录下。当前 Git 根目录：${top}`);

  const remote = runGit(['remote', 'get-url', 'origin']).trim();
  if (!/bufayadexiaotudou[\/:]anime-story-catalog(?:\.git)?$/i.test(remote)) throw new Error(`origin 不是预期仓库：${remote}`);

  try {
    runGit(['check-ignore', '-q', 'source.html']);
  } catch {
    throw new Error('source.html 没有被 .gitignore 忽略，拒绝继续，以免误上传明文。');
  }

  try {
    runGit(['ls-files', '--error-unmatch', 'source.html']);
    throw new Error('source.html 已经被 Git 跟踪！请先从 Git 索引和历史中移除后再运行。');
  } catch (error) {
    if (String(error.message).includes('source.html 已经被 Git 跟踪')) throw error;
  }

  const dirty = runGit(['status', '--porcelain', '--untracked-files=all']).trim();
  if (dirty) throw new Error(`工作区存在未提交改动。请先处理后再换密码：\n${dirty}`);
}

function stageAndPush(generatedNames, oldNames, noPush = false) {
  const targets = new Set(['payload-meta.json', ...generatedNames, ...oldNames]);
  runGit(['add', '-A', '--', ...targets]);

  const staged = runGit(['diff', '--cached', '--name-only']).trim().split(/\r?\n/).filter(Boolean);
  if (staged.includes('source.html') || staged.some((p) => /(?:^|\/)source\.html$/i.test(p))) {
    runGit(['reset']);
    throw new Error('检测到 source.html 被加入暂存区，已取消提交。');
  }
  const unexpected = staged.filter((p) => p !== 'payload-meta.json' && !/^payload-.*\.txt$/i.test(p));
  if (unexpected.length) {
    runGit(['reset']);
    throw new Error(`检测到非加密数据文件进入暂存区，已取消：${unexpected.join(', ')}`);
  }
  if (!staged.length) throw new Error('没有检测到需要提交的加密文件变化。');

  console.log('\n将提交这些文件：');
  for (const file of staged) console.log(`  - ${file}`);

  if (noPush) {
    console.log('\n[完成] 已生成并暂存新密文；--no-push 模式未提交、未上传。');
    return;
  }

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  runGit(['commit', '-m', `Rotate catalog password (${stamp})`], { inherit: true });
  runGit(['push', 'origin', 'HEAD'], { inherit: true });
  console.log('\n[完成] 新密码对应的密文已经提交并推送到 GitHub。GitHub Pages 更新后旧密码即失效。');
}

async function main() {
  console.log('剧情动画候选库 · 一键换密码 / 重新加密 / Git 推送');
  console.log('---------------------------------------------------');
  assertRepoSafety();

  console.log('[1/5] 检查仓库并同步最新版本…');
  runGit(['pull', '--ff-only'], { inherit: true });

  let plain;
  if (fs.existsSync(sourcePath)) {
    console.log('[2/5] 使用本机已存在的 source.html（该文件被 Git 忽略）。');
    plain = fs.readFileSync(sourcePath);
  } else {
    console.log('[2/5] 本机没有 source.html，将从当前密文恢复明文。');
    const oldPassword = await askHidden('请输入当前旧密码：');
    if (!oldPassword) throw new Error('旧密码不能为空。');
    try {
      const { meta, packed } = readCurrentPayload();
      plain = decryptBuffer(packed, oldPassword, Buffer.from(meta.salt, 'base64'), Buffer.from(meta.iv, 'base64'), Number(meta.iter));
    } catch {
      throw new Error('旧密码不正确，或当前密文文件不完整。');
    }
    fs.writeFileSync(sourcePath, plain);
    console.log('      已恢复到本机 source.html。它不会被 Git 上传。');
  }

  if (!plain.length) throw new Error('source.html 为空。');

  console.log('[3/5] 输入新密码（输入内容不会显示，只显示 *）。');
  const password1 = await askHidden('请输入新密码（至少 12 个字符）：');
  if (password1.length < 12) throw new Error('新密码少于 12 个字符，已取消。');
  const password2 = await askHidden('请再次输入新密码：');
  if (password1 !== password2) throw new Error('两次输入的新密码不一致，已取消。');

  console.log('[4/5] 重新加密、生成新分片并进行 AES-GCM 完整性自检…');
  const { names, oldNames } = writeNewPayload(plain, password1);
  console.log(`      已生成 ${names.length} 个密文分片，自检通过。`);

  console.log('[5/5] 覆盖旧密文并提交到 GitHub…');
  stageAndPush(names, oldNames, process.argv.includes('--no-push'));

  console.log('\n提示：source.html 是本机明文副本。若不希望长期保留，可在完成后手动删除；下次仍可用当时的旧密码从密文恢复。');
}

main().catch((error) => die(error?.message || String(error)));
