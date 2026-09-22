/** 拼 className。house 里没有 clsx / class-variance-authority，这点需求不值得加依赖 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
