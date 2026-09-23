/**
 * 演示模式的替换内容。
 *
 * 这里只干一件事：**按语言把这个作者的文本写成一份像样的源文件**。
 * 生成的是**纯文本**（每一段正文对应文件里的一行），语法高亮交给 highlight.js
 * （见 lib/highlight.ts）——自己写一套 token 规则既不准也不值当，
 * 而 highlight.js 认得这些语言里什么该是什么颜色。
 *
 * 一份文件的组装方式是固定的（见 `buildDecoyDocument`）：
 *
 *     preamble  顶层自足行（按「组」组织：一组要么整个放下、要么不写）
 *     open      容器开头：注解 + 类声明 / impl / namespace（可省）
 *     fields    容器里的字段与构造函数
 *     block     一个个完整的方法，循环铺到放不下为止
 *     pad       放不下块时用来填满的单行内容（常量声明 + 注释）
 *     tail      容器收尾：} / </template>（和 open 同进退）
 *
 * 五条不能破的约束（`bun run verify:decoy` 会逐份文件检查）：
 *
 * 1. **行数与段落数严格相等**。正文的每一段对应文件里的一行，行号、缩略图、
 *    翻页位置因此不需要为演示模式做任何特殊处理。
 * 2. **任何长度都是一份合法的文件**。段落很少时（一张整页插图就一段）不能把
 *    文件头切一半——那会留下没有收尾的 `class X {` 或者孤零零的 `@Mapper`。
 *    放不下容器就只留顶层声明（`package …;` 加几行空行也是合法文件）。
 * 3. **不留半截函数**。一个块要么完整放下，要么不写；剩下的位置用单行常量填。
 * 4. **名字不重复**。方法名用「动作 × 字段 × 变体」交叉，撞了就加序号——
 *    两个同名方法在 Java / C# 里是编译错误，看代码的人一眼就会发现。
 * 5. **文件名和文件里的类名同源**。两者都从同一个 `Ctx` 推出来，种子由
 *    `decoySeed(bookId, chapterIndex)` 统一给出；各自哈希一遍会出现
 *    `ReportMapper.java` 里写着 `class CatalogService` 这种事。
 *
 * 缩进是**写在文本里的**（那四个空格是字符串的一部分），显示由
 * `.mn-content--code` 的 `white-space: pre-wrap` 负责：HTML 默认会把行首空白折掉，
 * 不设那一条的话代码会平铺到左边，一眼就是假的。
 */

export interface DecoyDocument {
  /** 整份文件的源文本，一行一个元素 */
  lines: string[]
  /** 交给 highlight.js 的语言名 */
  language: string
}

interface Ctx {
  /** 小写：catalog */
  domain: string
  /** 首字母大写：Catalog */
  Domain: string
  /** 类型后缀：Service / Controller / Card …… 没有就是空串 */
  suffix: string
  rng: () => number
  /** 取一个没被用过的方法名（动作 + 字段 + 变体，撞了加序号） */
  name: (action: string, field: string, variant?: string) => string
}

interface DecoyPreset {
  id: string
  /** 设置里的名字 */
  name: string
  /** 状态栏上显示的语言 */
  language: string
  /** 缩进方式（状态栏右侧那一项） */
  indent: string
  /** 设置里的图标：一个字母和它的底色 */
  badge: { label: string; color: string }
  /** 交给 highlight.js 的语法名 */
  hljs: string
  /** 这份文件的类型后缀候选，空数组表示不加后缀 */
  suffixes: readonly string[]
  /** 书 → 仓库名 */
  folder: (ctx: Ctx) => string
  /** 章 → 文件名 */
  file: (ctx: Ctx) => string
  /** 顶层自足片段；每个片段要么整个写进文件，要么整个不写 */
  preamble: (ctx: Ctx) => string[][]
  /** 容器开头；空数组表示这份文件没有容器（React / Vue 的结尾是顶层代码） */
  open: (ctx: Ctx) => string[]
  /** 容器里的字段与构造函数；也是按「组」给，半截的构造函数写出来就是语法错误 */
  fields: (ctx: Ctx) => string[][]
  /** 一个完整的方法（最后一行是它自己的收尾） */
  block: (ctx: Ctx, index: number) => string[]
  /** 收尾。和 open 同进退；open 为空时它自己就是文件结尾 */
  tail: (ctx: Ctx) => string[]
  /** 放不下块时用来填满的单行内容 */
  pad: (ctx: Ctx, index: number) => string
}

// ---------------------------------------------------------------------------
// 词表
// ---------------------------------------------------------------------------

const DOMAINS = [
  'order',
  'invoice',
  'catalog',
  'session',
  'billing',
  'shipment',
  'profile',
  'payment',
  'inventory',
  'notification',
  'report',
  'account',
  'tenant',
  'meter',
  'ledger',
]

const ACTIONS = ['Create', 'Update', 'Resolve', 'Apply', 'Sync', 'Submit', 'Confirm', 'Refresh']
const FIELDS = ['Sku', 'Quantity', 'Status', 'Total', 'Currency', 'Channel', 'Reference', 'Region']
/** 方法名的第三个轴：动作 × 字段 × 变体 = 512 个组合 */
const VARIANTS = ['', 'Batch', 'Draft', 'Delta', 'Slice', 'Window', 'Bundle', 'Archive']
/** 文件尾那些常量的名字也要错开，不然同一个类里会出现两条同名常量 */
const PAD_NAMES = ['RETRY', 'TIMEOUT', 'PAGE', 'BATCH', 'FLUSH', 'AUDIT', 'QUOTA', 'SWEEP']
/** 文件尾常量的说明。写成真的踩过坑的样子，比「TODO」可信 */
const PAD_NOTES = [
  'keep in sync with the schema',
  'retry budget shared with the scheduler',
  'tuned against the staging dataset',
  'measured on last quarter imports',
  'guarded by the rate limiter',
]

function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/** mulberry32：够随机、够短、不引依赖 */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(list: readonly T[], next: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(next() * list.length))]
}

function capitalize(word: string): string {
  return word[0].toUpperCase() + word.slice(1)
}

function snake(word: string): string {
  return word.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

/** 章节 → 生成用的种子。目录树、标签页、正文三处必须用同一个 */
export function decoySeed(bookId: string, chapterIndex: number): string {
  return `${bookId}#${chapterIndex}`
}

function makeCtx(preset: DecoyPreset, seed: string): Ctx {
  const rng = random(hash(seed))
  const domain = pick(DOMAINS, rng)
  const suffix = preset.suffixes.length > 0 ? pick(preset.suffixes, rng) : ''
  const used = new Set<string>()
  const name = (action: string, field: string, variant = '') => {
    const base = action.toLowerCase() + field + variant
    let candidate = base
    let index = 2
    while (used.has(candidate)) candidate = base + index++
    used.add(candidate)
    return candidate
  }
  return { domain, Domain: capitalize(domain), suffix, rng, name }
}

/** 第 index 个块的变体轴，方法名靠它拉开距离 */
function variantOf(index: number): string {
  return VARIANTS[Math.floor(index / (ACTIONS.length * FIELDS.length)) % VARIANTS.length]
}

// ---------------------------------------------------------------------------
// 各语言的模板
// ---------------------------------------------------------------------------

const JAVA_SUFFIXES = ['Service', 'Controller', 'Client', 'Mapper', 'Gateway', 'Repository']
/** 后缀对得上注解：Controller 挂 @RestController、Repository 挂 @Repository */
const SPRING_ANNOTATION: Record<string, string> = {
  Service: '@Service',
  Controller: '@RestController',
  Client: '@Component',
  Mapper: '@Mapper',
  Gateway: '@Component',
  Repository: '@Repository',
}

const spring: DecoyPreset = {
  id: 'spring',
  name: 'Java · Spring Boot',
  language: 'Java',
  indent: 'Spaces: 4',
  badge: { label: 'J', color: '#E76F00' },
  hljs: 'java',
  suffixes: JAVA_SUFFIXES,
  folder: (ctx) => `${ctx.domain}-service`,
  file: (ctx) => `${ctx.Domain}${ctx.suffix}.java`,
  preamble: (ctx) => [
    [`package com.example.${ctx.domain};`],
    [''],
    ['import java.time.Instant;'],
    [`import com.example.${ctx.domain}.${ctx.Domain}Repository;`],
    ['import org.springframework.stereotype.Service;'],
    ['import org.springframework.transaction.annotation.Transactional;'],
  ],
  open: (ctx) => ['', SPRING_ANNOTATION[ctx.suffix] ?? '@Service', `public class ${ctx.Domain}${ctx.suffix} {`],
  fields: (ctx) => [
    [
      '',
      `    private final ${ctx.Domain}Repository repository;`,
      '    private final PaymentClient paymentClient;',
    ],
  ],
  block: (ctx, index) => {
    const field = FIELDS[index % FIELDS.length]
    const name = ctx.name(ACTIONS[index % ACTIONS.length], field, variantOf(index))
    const message = pick(['missing sku', 'quantity not set', 'region unpriced'], ctx.rng)
    return [
      '',
      '    @Transactional',
      `    public ${ctx.Domain}Response ${name}(${ctx.Domain}Request request) {`,
      `        var ${ctx.domain} = repository.findById(request.getId())`,
      `            .orElseThrow(() -> new ${ctx.Domain}NotFoundException(request.getId()));`,
      '',
      `        if (${ctx.domain}.get${field}() == null) {`,
      `            paymentClient.sync(${ctx.domain}.getId(), "${message}");`,
      `            ${ctx.domain} = repository.save(${ctx.domain}.with${field}(defaults.${ctx.domain}()));`,
      '        }',
      '',
      `        ${ctx.domain}.touch(Instant.now());`,
      `        log.info("${ctx.domain} {} updated", ${ctx.domain}.getId());`,
      `        return ${ctx.Domain}Response.from(${ctx.domain});`,
      '    }',
    ]
  },
  tail: () => ['}'],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `    private static final int ${PAD_NAMES[index / 2 % PAD_NAMES.length]}_LIMIT_${index / 2 + 2} = ${(index + 2) * 3};`
      : `    // ${pick(PAD_NOTES, ctx.rng)}`,
}

const dotnet: DecoyPreset = {
  id: 'dotnet',
  name: 'C# · ASP.NET Core',
  language: 'C#',
  indent: 'Spaces: 4',
  badge: { label: 'C#', color: '#512BD4' },
  hljs: 'csharp',
  suffixes: ['Service', 'Controller', 'Handler', 'Repository', 'Client', 'Mapper'],
  folder: (ctx) => `${ctx.Domain}Service.Api`,
  file: (ctx) => `${ctx.Domain}${ctx.suffix}.cs`,
  preamble: (ctx) => [
    ['using Microsoft.Extensions.Logging;', 'using System.Threading;', 'using System.Threading.Tasks;'],
    [''],
    [`namespace Example.${ctx.Domain}.Services;`],
  ],
  open: (ctx) => ['', `public sealed class ${ctx.Domain}${ctx.suffix} : I${ctx.Domain}${ctx.suffix}`, '{'],
  fields: (ctx) => [
    [
      `    private readonly I${ctx.Domain}Repository _repository;`,
      `    private readonly ILogger<${ctx.Domain}${ctx.suffix}> _logger;`,
      '',
      `    public ${ctx.Domain}${ctx.suffix}(I${ctx.Domain}Repository repository, ILogger<${ctx.Domain}${ctx.suffix}> logger)`,
      '        => (_repository, _logger) = (repository, logger);',
    ],
  ],
  block: (ctx, index) => {
    const field = FIELDS[index % FIELDS.length]
    const name = ctx.name(ACTIONS[index % ACTIONS.length], field, variantOf(index))
    return [
      '',
      `    public async Task<${ctx.Domain}Dto> ${name}Async(`,
      `        ${ctx.Domain}Request request, CancellationToken cancellationToken)`,
      '    {',
      `        var ${ctx.domain} = await _repository.FindAsync(request.Id, cancellationToken);`,
      `        if (${ctx.domain} is null) throw new ${ctx.Domain}NotFoundException(request.Id);`,
      '',
      `        if (${ctx.domain}.${field} is null)`,
      '        {',
      `            ${ctx.domain} = ${ctx.domain}.With${field}(_defaults.Create());`,
      '        }',
      '',
      `        await _repository.SaveAsync(${ctx.domain}, cancellationToken);`,
      `        _logger.LogInformation("${ctx.domain} {Id} {Field} updated", ${ctx.domain}.Id, ${ctx.domain}.${field});`,
      `        return ${ctx.Domain}Dto.From(${ctx.domain});`,
      '    }',
    ]
  },
  tail: () => ['}'],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `    private const int ${PAD_NAMES[index / 2 % PAD_NAMES.length]}Limit${index / 2 + 2} = ${(index + 2) * 3};`
      : `    // ${pick(PAD_NOTES, ctx.rng)}`,
}

const python: DecoyPreset = {
  id: 'python',
  name: 'Python · Django',
  language: 'Python',
  indent: 'Spaces: 4',
  badge: { label: 'PY', color: '#3776AB' },
  hljs: 'python',
  suffixes: [],
  folder: (ctx) => snake(ctx.domain),
  file: (ctx) => `${snake(ctx.domain)}_service.py`,
  preamble: (ctx) => [
    ['from __future__ import annotations'],
    [''],
    ['import logging', 'from datetime import datetime'],
    [''],
    [`from .repository import ${ctx.Domain}Repository`],
    [''],
    ['logger = logging.getLogger(__name__)'],
  ],
  open: (ctx) => [
    '',
    '',
    `class ${ctx.Domain}Service:`,
    `    """Reads and writes ${ctx.domain} records; the transaction boundary lives here."""`,
  ],
  fields: (ctx) => [
    [
      '',
      `    def __init__(self, repository: ${ctx.Domain}Repository) -> None:`,
      '        self._repository = repository',
    ],
  ],
  block: (ctx, index) => {
    const field = snake(FIELDS[index % FIELDS.length])
    const name = snake(ctx.name(ACTIONS[index % ACTIONS.length], FIELDS[index % FIELDS.length], variantOf(index)))
    return [
      '',
      `    def ${name}(self, request: ${ctx.Domain}Request) -> ${ctx.Domain}Dto:`,
      `        ${ctx.domain} = self._repository.get(request.id)`,
      `        if ${ctx.domain} is None:`,
      `            raise ${ctx.Domain}NotFound(request.id)`,
      '',
      `        if ${ctx.domain}.${field} is None:`,
      `            ${ctx.domain}.${field} = defaults.for_tenant(request.tenant_id)`,
      `        ${ctx.domain}.updated_at = datetime.utcnow()`,
      '',
      `        self._repository.save(${ctx.domain})`,
      `        logger.info("${ctx.domain} %s updated", ${ctx.domain}.id)`,
      `        return ${ctx.Domain}Dto.from_model(${ctx.domain})`,
    ]
  },
  tail: () => [''],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `${PAD_NAMES[index / 2 % PAD_NAMES.length]}_LIMIT_${index / 2 + 2} = ${(index + 2) * 3}`
      : `# ${pick(PAD_NOTES, ctx.rng)}`,
}

const cpp: DecoyPreset = {
  id: 'cpp',
  name: 'C++ · CMake',
  language: 'C++',
  indent: 'Spaces: 2',
  badge: { label: 'C++', color: '#00599C' },
  hljs: 'cpp',
  suffixes: [],
  folder: (ctx) => `${ctx.domain}-core`,
  file: (ctx) => `${snake(ctx.domain)}_service.cpp`,
  preamble: (ctx) => [
    [`#include "${snake(ctx.domain)}_service.h"`],
    [''],
    ['#include <algorithm>', '#include <memory>', '#include <vector>'],
  ],
  open: () => ['', 'namespace example {'],
  fields: (ctx) => [
    [
      '',
      `${ctx.Domain}Service::${ctx.Domain}Service(`,
      `    std::shared_ptr<${ctx.Domain}Repository> repository)`,
      '    : repository_(std::move(repository)) {}',
    ],
  ],
  block: (ctx, index) => {
    const verb = ['List', 'Find', 'Flush', 'Apply', 'Compact'][index % 5]
    const name = ctx.name(verb, FIELDS[index % FIELDS.length], variantOf(index))
    return [
      '',
      `std::vector<${ctx.Domain}> ${ctx.Domain}Service::${name}(`,
      `    const ${ctx.Domain}Query& query) const {`,
      `  std::vector<${ctx.Domain}> result;`,
      '  result.reserve(query.limit() > 0 ? query.limit() : 32);',
      '',
      '  for (const auto& item : repository_->Scan(query)) {',
      '    if (item.status() == Status::kPending) {',
      '      result.push_back(item);',
      '    }',
      '  }',
      '',
      '  std::sort(result.begin(), result.end(), CompareByUpdatedAt{});',
      '  return result;',
      '}',
    ]
  },
  tail: () => ['}  // namespace example'],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `constexpr int k${PAD_NAMES[index / 2 % PAD_NAMES.length]}Limit${index / 2 + 2} = ${(index + 2) * 3};`
      : `// ${pick(PAD_NOTES, ctx.rng)}`,
}

const react: DecoyPreset = {
  id: 'react',
  name: 'React · TypeScript',
  language: 'TypeScript React',
  indent: 'Spaces: 2',
  badge: { label: 'TS', color: '#3178C6' },
  hljs: 'typescript',
  suffixes: ['List', 'Panel', 'Table', 'Form', 'Toolbar', 'Detail'],
  folder: (ctx) => `${ctx.domain}-app`,
  file: (ctx) => `${ctx.Domain}${ctx.suffix}.tsx`,
  preamble: (ctx) => [
    ["import { useCallback, useMemo, useState } from 'react'"],
    [''],
    [`import type { ${ctx.Domain} } from './types'`],
    [''],
    ['const PAGE_SIZE = 25'],
    [''],
    ['interface Props {', `  items: ${ctx.Domain}[]`, `  onSelect: (item: ${ctx.Domain}) => void`, '}'],
  ],
  // 没有容器：块是顶层的小钩子，tail 是这份文件的主角组件
  open: () => [],
  fields: () => [],
  block: (ctx, index) => {
    const word = ['Rows', 'Selection', 'Summary', 'Page', 'Detail', 'History'][index % 6]
    if (index % 2 === 0) {
      return [
        '',
        `function ${ctx.name('use', ctx.Domain, word)}(items: ${ctx.Domain}[]) {`,
        "  const [query, setQuery] = useState('')",
        '  const rows = useMemo(',
        '    () => items.filter((item) => item.sku.toLowerCase().includes(query.toLowerCase())),',
        '    [items, query],',
        '  )',
        '',
        '  return { rows, query, setQuery }',
        '}',
      ]
    }
    return [
      '',
      `function ${ctx.name('use', ctx.Domain, `${word}Page`)}(total: number) {`,
      '  const [page, setPage] = useState(1)',
      '  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))',
      '  const next = useCallback(() => setPage((n) => Math.min(n + 1, pages)), [pages])',
      '',
      '  return { page, pages, next }',
      '}',
    ]
  },
  tail: (ctx) => [
    '',
    `export function ${ctx.Domain}${ctx.suffix}({ items, onSelect }: Props) {`,
    "  const [query, setQuery] = useState('')",
    '  const rows = items.filter((item) => item.sku.toLowerCase().includes(query.toLowerCase()))',
    '',
    '  return (',
    `    <ul className="${ctx.domain}-list">`,
    '      {rows.map((item) => (',
    '        <li key={item.id} onClick={() => onSelect(item)}>',
    '          <span className="sku">{item.sku}</span>',
    '          <span className="total">{item.total}</span>',
    '        </li>',
    '      ))}',
    '    </ul>',
    '  )',
    '}',
  ],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `const ${PAD_NAMES[index / 2 % PAD_NAMES.length]}Limit${index / 2 + 2} = ${(index + 2) * 3}`
      : `// ${pick(PAD_NOTES, ctx.rng)}`,
}

const vue: DecoyPreset = {
  id: 'vue',
  name: 'Vue 3 · 单文件组件',
  language: 'Vue',
  indent: 'Spaces: 2',
  badge: { label: 'V', color: '#41B883' },
  // 单文件组件里有两种语法：脚本段是 TS、模板段是 HTML（见 lib/highlight.ts 的切分）
  hljs: 'vue',
  suffixes: ['List', 'Panel', 'Table', 'Dialog', 'Toolbar', 'Detail'],
  folder: (ctx) => `${ctx.domain}-ui`,
  file: (ctx) => `${ctx.Domain}${ctx.suffix}.vue`,
  preamble: (ctx) => [
    ['<script setup lang="ts">'],
    ["import { computed, ref, watch } from 'vue'"],
    [''],
    [`import type { ${ctx.Domain} } from './types'`],
    [''],
    ['interface Props {', `  items: ${ctx.Domain}[]`, '}'],
    [''],
    ['const props = defineProps<Props>()'],
    [`const emit = defineEmits<{ select: [item: ${ctx.Domain}] }>()`],
    ["const query = ref('')"],
    ['const visible = computed(() => props.items.filter((item) => item.sku.includes(query.value)))'],
  ],
  open: () => [],
  fields: () => [],
  block: (ctx, index) => {
    const word = ['Query', 'Filter', 'Scope', 'Range', 'Page', 'Sort', 'Batch', 'Export'][index % 8]
    return [
      '',
      `function ${ctx.name('apply', word)}() {`,
      '  query.value = query.value.trim()',
      '}',
      '',
      'watch(query, (value) => {',
      `  console.debug('${ctx.domain} query', value)`,
      '})',
    ]
  },
  tail: (ctx) => [
    '</script>',
    '',
    '<template>',
    `  <ul class="${ctx.domain}-list">`,
    `    <li v-for="item in visible" :key="item.id" @click="emit('select', item)">`,
    '      {{ item.sku }}',
    '    </li>',
    '  </ul>',
    '</template>',
    '',
  ],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `const ${PAD_NAMES[index / 2 % PAD_NAMES.length]}Limit${index / 2 + 2} = ${(index + 2) * 3}`
      : `// ${pick(PAD_NOTES, ctx.rng)}`,
}

const go: DecoyPreset = {
  id: 'go',
  name: 'Go · 标准库',
  language: 'Go',
  indent: 'Tabs: 4',
  badge: { label: 'GO', color: '#00ADD8' },
  hljs: 'go',
  suffixes: [],
  folder: (ctx) => `${ctx.domain}-service`,
  file: (ctx) => `${snake(ctx.domain)}_service.go`,
  preamble: (ctx) => [
    ['package service'],
    [''],
    ['import (', '\t"context"', '\t"errors"', '\t"fmt"', '\t"log/slog"', ')'],
    [''],
    [`type ${ctx.Domain}Service struct {`, '    repository Repository', '    logger     *slog.Logger', '}'],
  ],
  open: () => [],
  fields: () => [],
  block: (ctx, index) => {
    const verb = ['Create', 'Update', 'Cancel', 'Retry', 'Expire'][index % 5]
    const name = ctx.name(verb, FIELDS[index % FIELDS.length], variantOf(index))
    return [
      '',
      `func (s *${ctx.Domain}Service) ${name}(ctx context.Context, req Request) (*${ctx.Domain}, error) {`,
      `    ${ctx.domain}, err := s.repository.Get(ctx, req.ID)`,
      '    if err != nil {',
      `        return nil, fmt.Errorf("get ${ctx.domain} %d: %w", req.ID, err)`,
      '    }',
      '',
      `    if ${ctx.domain}.Settled() {`,
      '        return nil, errors.New("already settled")',
      '    }',
      '',
      `    if err := s.repository.Save(ctx, ${ctx.domain}); err != nil {`,
      '        return nil, err',
      '    }',
      `    s.logger.Info("${ctx.domain} updated", "id", ${ctx.domain}.ID)`,
      `    return ${ctx.domain}, nil`,
      '}',
    ]
  },
  tail: () => [''],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `var ${snake(PAD_NAMES[index / 2 % PAD_NAMES.length])}Limit${index / 2 + 2} = ${(index + 2) * 3}`
      : `// ${pick(PAD_NOTES, ctx.rng)}`,
}

const rust: DecoyPreset = {
  id: 'rust',
  name: 'Rust · Cargo',
  language: 'Rust',
  indent: 'Spaces: 4',
  badge: { label: 'RS', color: '#DEA584' },
  hljs: 'rust',
  suffixes: [],
  folder: (ctx) => `${snake(ctx.domain)}_service`,
  file: (ctx) => `${snake(ctx.domain)}_service.rs`,
  preamble: (ctx) => [
    ['use serde::{Deserialize, Serialize};', 'use tracing::{info, warn};'],
    [''],
    ['use crate::error::Error;', `use crate::repo::${ctx.Domain}Repo;`],
    [''],
    [
      '#[derive(Debug, Clone, Serialize, Deserialize)]',
      `pub struct ${ctx.Domain}Service {`,
      `    repo: ${ctx.Domain}Repo,`,
      `    cache: Vec<${ctx.Domain}>,`,
      '}',
    ],
  ],
  open: (ctx) => ['', `impl ${ctx.Domain}Service {`],
  fields: (ctx) => [
    [
      `    pub fn new(repo: ${ctx.Domain}Repo) -> Self {`,
      '        Self { repo, cache: Vec::new() }',
      '    }',
    ],
  ],
  block: (ctx, index) => {
    const verb = ['create', 'update', 'resolve', 'expire', 'retry'][index % 5]
    const name = snake(ctx.name(verb, FIELDS[index % FIELDS.length], variantOf(index)))
    return [
      '',
      `    pub async fn ${name}(&mut self, id: u64) -> Result<&${ctx.Domain}, Error> {`,
      '        let record = self.repo.get(id).await?;',
      '',
      '        if record.settled {',
      '            warn!(id, "already settled");',
      '            return Err(Error::Conflict(id));',
      '        }',
      '',
      `        info!(id, "${verb} ${ctx.domain}");`,
      '        self.cache.push(record);',
      '        Ok(self.cache.last().unwrap())',
      '    }',
    ]
  },
  tail: () => ['}'],
  pad: (ctx, index) =>
    index % 2 === 0
      ? `    const ${PAD_NAMES[index / 2 % PAD_NAMES.length]}_LIMIT_${index / 2 + 2}: usize = ${(index + 2) * 3};`
      : `    // ${pick(PAD_NOTES, ctx.rng)}`,
}

export const DECOY_PRESETS: readonly DecoyPreset[] = [
  spring,
  dotnet,
  python,
  cpp,
  react,
  vue,
  go,
  rust,
]

/** 设置里没有指定、或者指定了一个不认识的 id 时用 React */
export const DEFAULT_DECOY_PRESET = 'react'

export function decoyPreset(id: string | undefined): DecoyPreset {
  return DECOY_PRESETS.find((item) => item.id === id) ?? react
}

// ---------------------------------------------------------------------------
// 组装
// ---------------------------------------------------------------------------

/**
 * 一章 → 一份完整的源文件，行数严格等于段落数。
 *
 * 组装顺序：preamble → open → fields → block×N → pad×N → tail。
 * 容器（class / impl / namespace）放不下时，open 与 tail 一起省略，
 * 只留顶层声明——`package x;` 加几行空行也是一份合法文件，而半截 `class X {`
 * 不是（这就是「一眼假」的来源之一）。
 */
export function buildDecoyDocument(
  id: string | undefined,
  seed: string,
  count: number,
): DecoyDocument {
  const preset = decoyPreset(id)
  const ctx = makeCtx(preset, seed)
  const open = preset.open(ctx)
  const tail = preset.tail(ctx)
  const fields = preset.fields(ctx)

  const out: string[] = []
  const push = (lines: string[], limit: number) => {
    for (const line of lines) if (out.length < limit) out.push(line)
  }

  // 顶层片段：整段放不下就整段不写（`interface Props {` 不能只写一半）
  for (const group of preset.preamble(ctx)) {
    if (out.length + group.length > count) break
    push(group, count)
  }

  const fixed = open.length + tail.length
  const room = count - out.length
  if (room >= fixed + 1) {
    // 容器：**先把 tail 的位置留出来**再放 open 与 fields。
    // 少了这个上限，短文件会出现「类开了括号、收尾没地方放」——那正是半截文件
    const bodyLimit = count - tail.length
    push(open, bodyLimit)
    // 字段与构造函数也是整组写：半截的构造函数比没有构造函数更假
    for (const group of fields) {
      if (out.length + group.length > bodyLimit) break
      push(group, bodyLimit)
    }
    let index = 0
    let pad = 0
    while (out.length < bodyLimit) {
      const block = preset.block(ctx, index++)
      if (out.length + block.length <= bodyLimit) {
        push(block, bodyLimit)
        continue
      }
      // 放不下整块：剩下的位置用单行内容填满。宁可少写一个方法，
      // 也不留半截函数（少一个 return 在 Go / Rust 里就是编译错误）
      while (out.length < bodyLimit) push([preset.pad(ctx, pad++)], bodyLimit)
      break
    }
    push(tail, count)
  } else if (open.length === 0 && room >= tail.length) {
    // 没有容器：结尾是顶层代码，可以直接接上
    let pad = 0
    while (out.length < count - tail.length) push([preset.pad(ctx, pad++)], count - tail.length)
    push(tail, count)
  }

  // 剩下的空位一律补空行：这是唯一在哪儿都合法的内容
  while (out.length < count) out.push('')
  return { lines: out.slice(0, count), language: preset.hljs }
}

/** 书 → 仓库名 */
export function decoyFolderName(id: string | undefined, seed: string): string {
  const preset = decoyPreset(id)
  return preset.folder(makeCtx(preset, seed))
}

/** 章 → 文件名（和文件里的类名同源） */
export function decoyFileName(id: string | undefined, seed: string): string {
  const preset = decoyPreset(id)
  return preset.file(makeCtx(preset, seed))
}

/** 状态栏右侧那两项 */
export function decoyStatus(id: string | undefined): { language: string; indent: string } {
  const preset = decoyPreset(id)
  return { language: preset.language, indent: preset.indent }
}

/** 光标位置，状态栏上的 `Ln 171, Col 26` */
export function decoyCursor(seed: string): { line: number; col: number } {
  const next = random(hash(seed))
  return { line: Math.floor(next() * 320 + 3), col: Math.floor(next() * 88 + 1) }
}

/** 浏览器标签页上的图标：一个带语言缩写的小方块 */
export function decoyFavicon(id: string | undefined): string {
  const { badge } = decoyPreset(id)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${badge.color}"/>` +
    `<text x="16" y="21.5" text-anchor="middle" font-family="Consolas,monospace" ` +
    `font-size="${badge.label.length > 2 ? 10 : 14}" font-weight="700" fill="#fff">${badge.label}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** 演示模式下的「空编辑器」那一屏写的字 */
export function decoyEmptyState(id: string | undefined, seed: string): { title: string; hint: string } {
  return {
    title: `${decoyFolderName(id, seed)} · workspace`,
    hint: 'Select a file from the explorer to open it.',
  }
}
