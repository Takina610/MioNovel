/**
 * 演示模式的验收脚本：把生成器当作会写代码的人来审。
 *
 * 它检查的是「一眼假」的那些特征，而不是「能不能跑」——
 * 这份代码永远不会被编译，但它是给人看的，所以下面每一条都必须是零：
 *
 *   1. 有函数体是空的（`if (…) {` 紧跟 `}`，或者函数开了括号里面什么都没有）
 *   2. 括号不配对（文件里开了 `{` 却没关）
 *   3. 文件停在「刚开了一块」的行上（最后一行是 `… {` 或只有一个 `@注解`）
 *   4. 出现重复的方法名（Java / C# 里是编译错误）
 *   5. 行数与段落数不等（行号、缩略图、翻页位置都靠它对齐）
 *   6. 检查不到缩进（第一行的类体里应该有空白开头的行）
 *
 * 用法：bun run verify:decoy
 */
import { DECOY_PRESETS, buildDecoyDocument, decoyFileName, decoyFolderName, decoySeed } from '../src/lib/decoy'

interface Problem {
  preset: string
  count: number
  kind: string
  detail: string
}

const problems: Problem[] = []
let checked = 0

/** 去掉字符串字面量，避免把字符串里的括号算进配对 */
function stripStrings(line: string): string {
  return line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''")
}

function audit(presetId: string, count: number): void {
  checked++
  const document = buildDecoyDocument(presetId, decoySeed('book', count), count)
  const text = document.lines

  if (text.length !== count) {
    problems.push({ preset: presetId, count, kind: '行数不符', detail: `${text.length} != ${count}` })
    return
  }

  // 1) 空块：`… {` 之后紧接着 `}`
  for (let i = 0; i < text.length - 1; i++) {
    const current = stripStrings(text[i]).trim()
    const next = text[i + 1].trim()
    if (current.endsWith('{') && next === '}') {
      problems.push({ preset: presetId, count, kind: '空块', detail: `第 ${i + 1} 行` })
    }
  }

  // 2) 括号配对
  let depth = 0
  for (const line of text) {
    for (const char of stripStrings(line)) {
      if (char === '{') depth++
      else if (char === '}') depth--
    }
    if (depth < 0) break
  }
  if (depth !== 0) {
    problems.push({ preset: presetId, count, kind: '括号不配对', detail: `depth=${depth}` })
  }

  // 3) 结尾不能是「刚开了一块」
  const last = text[text.length - 1]?.trim() ?? ''
  if (last.endsWith('{') || last.endsWith('(') || last.startsWith('@')) {
    problems.push({ preset: presetId, count, kind: '结尾悬空', detail: `「${last}」` })
  }

  // 4) 方法名不重复。按语言各用各的「声明」写法来认——
  //    用一条通用正则去套八种语言，既会把调用（`std::sort(`）当成声明，
  //    也会漏掉跨行的签名（Go 的 `func (s *X) Name(ctx ...)`），两头都不准
  const names = new Map<string, number>()
  const declare = (name: string | undefined) => {
    if (!name) return
    names.set(name, (names.get(name) ?? 0) + 1)
  }
  for (const raw of text) {
    const line = raw.trimEnd()
    let match: RegExpExecArray | null
    if ((match = /^(?:public|private|protected|internal).*?(\w+)\s*\(/.exec(line))) declare(match[1])
    else if ((match = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/.exec(line))) declare(match[1])
    else if ((match = /^func\s+(?:\([^)]*\)\s*)?(\w+)/.exec(line))) declare(match[1])
    else if ((match = /^def\s+(\w+)/.exec(line))) declare(match[1])
    else if ((match = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/.exec(line))) declare(match[1])
    // C++ 的成员函数定义在行首（缩进的都是函数体里的调用）
    else if ((match = /^[A-Za-z_][\w<>,.?\[\]]*\s+\w+::(\w+)\s*\(/.exec(line))) declare(match[1])
  }
  for (const [name, times] of names) {
    if (times > 1) {
      problems.push({ preset: presetId, count, kind: '方法名重复', detail: `${name} × ${times}` })
    }
  }

  // 5) 缩进：文件里至少要有带缩进的行（短文件除外）。
  //    这条要抓的是「缩进整块丢了」（CSS 折掉行首空白那类事故），
  //    不是要求某个数量——24 行的 C++ 文件只有三行缩进也是正常的
  if (count >= 24) {
    const indented = text.filter((line) => /^[ 	]+\S/.test(line)).length
    if (indented < 2) {
      problems.push({ preset: presetId, count, kind: '没有缩进', detail: `${indented} 行` })
    }
  }
}

for (const preset of DECOY_PRESETS) {
  for (let count = 1; count <= 80; count++) audit(preset.id, count)
}

// 顺带确认名字是对得上的：同一本书同一章，三处推导必须一致
const folderA = decoyFolderName('spring', decoySeed('book-1', 3))
const folderB = decoyFolderName('spring', decoySeed('book-1', 3))
const fileA = decoyFileName('spring', decoySeed('book-1', 3))
const fileB = decoyFileName('spring', decoySeed('book-1', 3))
if (folderA !== folderB || fileA !== fileB) {
  problems.push({ preset: '-', count: 0, kind: '不幂等', detail: `${fileA} / ${fileB}` })
}
const className = buildDecoyDocument('spring', decoySeed('book-1', 3), 40)
  .lines.map((line) => /public class (\w+)/.exec(line)?.[1])
  .find(Boolean)
const fileStem = fileA.replace(/\.java$/, '')
if (className !== fileStem) {
  problems.push({
    preset: 'spring',
    count: 40,
    kind: '文件名与类名不一致',
    detail: `${fileA} 里写着 ${className}`,
  })
}

if (problems.length === 0) {
  console.log(`演示模式验收通过（${checked} 份文件 × 6 类检查）`)
} else {
  console.log(`发现 ${problems.length} 个问题：`)
  for (const problem of problems.slice(0, 40)) {
    console.log(`  ✗ [${problem.preset} ${problem.count} 行] ${problem.kind}：${problem.detail}`)
  }
  process.exit(1)
}
